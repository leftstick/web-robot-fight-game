// 像素建模生成器：把「角色骨骼 + 装备 + 武器」程序化画进 64/112 像素帧，
// 输出与 AssetLoader 兼容的 PNG + Aseprite JSON。运行：node tools/generate-sprites.mjs
//
// 设计原则：
// 1. 只使用整数矩形/扫描线多边形，不产生抗锯齿，保持硬像素边缘。
// 2. 每个兵种有独立轮廓、头饰、武器和配色，避免只换颜色。
// 3. 动画帧只改变关节和身体偏移，装备保持连续，不像逐帧手绘那样容易断形。

import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '#05070d';
const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

// ------------------------------------------------------------
// 基础像素绘制
// ------------------------------------------------------------
function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function ellipse(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const k = 1 - (y * y) / (ry * ry);
    if (k <= 0) continue;
    const w = Math.floor(rx * Math.sqrt(k));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

function ellipseO(ctx, cx, cy, rx, ry, fill, outline = OUT) {
  ellipse(ctx, cx, cy, rx + 1, ry + 1, outline);
  ellipse(ctx, cx, cy, rx, ry, fill);
}

function poly(ctx, pts, c) {
  const minY = Math.floor(Math.min(...pts.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  ctx.fillStyle = c;
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.ceil(xs[i]);
      const xb = Math.floor(xs[i + 1]);
      if (xb >= xa) ctx.fillRect(xa, y, xb - xa + 1, 1);
    }
  }
}

function polyO(ctx, pts, fill, outline = OUT) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    poly(ctx, pts.map(([x, y]) => [x + dx, y + dy]), outline);
  }
  poly(ctx, pts, fill);
}

function box(ctx, x, y, w, h, fill, outline = OUT) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  rect(ctx, x, y, w, h, fill);
}

function shadeBox(ctx, x, y, w, h, fill, shade, light = null) {
  box(ctx, x, y, w, h, fill);
  rect(ctx, x + w - 1, y, 1, h, shade);
  rect(ctx, x, y + h - 1, w, 1, shade);
  if (light) rect(ctx, x, y, w - 1, 1, light);
}

function limb(ctx, x0, y0, x1, y1, w, fill, outline = OUT) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const stamp = (size, color) => {
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t - size / 2);
      const y = Math.round(y0 + (y1 - y0) * t - size / 2);
      ctx.fillRect(x, y, size, size);
    }
  };
  stamp(w + 2, outline);
  stamp(w, fill);
}

function highlightLine(ctx, x0, y0, x1, y1, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  ctx.fillStyle = c;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
}

// ------------------------------------------------------------
// 配色：每个兵种 4 层明度 + 2 个强调色，保证暗背景下可读
// ------------------------------------------------------------
const P = {
  player: {
    skin: '#cf916f', skinShade: '#92533d',
    coat: '#173646', coatShade: '#0a1c26', coatLight: '#2f6b7e',
    armor: '#263c4b', armorLight: '#5c8798', armorShade: '#14232c',
    accent: '#3ee6ff', accent2: '#ff2e88',
    boot: '#101a22', metal: '#7893a3', gun: '#1a2732', gunLight: '#536d7e',
  },
  mohawk: {
    skin: '#c98863', skinShade: '#8a4a32',
    coat: '#3a2320', coatShade: '#1c0f0e', coatLight: '#6a3b31',
    armor: '#4a2e28', armorLight: '#82513f', armorShade: '#251613',
    accent: '#ff3b3b', accent2: '#ffd166',
    boot: '#16100e', metal: '#8b6a52', gun: '#221a16', gunLight: '#6b5140',
  },
  mask: {
    skin: '#b07a61', skinShade: '#74432f',
    coat: '#2b1a25', coatShade: '#130a10', coatLight: '#543044',
    armor: '#3a2634', armorLight: '#79506a', armorShade: '#1c1119',
    accent: '#f0e6d2', accent2: '#ff4d6a',
    boot: '#130c10', metal: '#8d7c86', gun: '#1f171c', gunLight: '#6c5b64',
  },
  bald: {
    skin: '#c58a63', skinShade: '#845034',
    coat: '#3c3322', coatShade: '#1d180f', coatLight: '#6d5c3a',
    armor: '#4d4029', armorLight: '#8f7850', armorShade: '#241e13',
    accent: '#ffb347', accent2: '#8dff9d',
    boot: '#17130d', metal: '#8f7b55', gun: '#211c14', gunLight: '#69583d',
  },
  rusher: {
    skin: '#b97858', skinShade: '#7a422c',
    coat: '#25151a', coatShade: '#10080b', coatLight: '#4d252e',
    armor: '#3b1d24', armorLight: '#8f3346', armorShade: '#1d0d11',
    accent: '#ff2e4a', accent2: '#ffb3b3',
    boot: '#120a0c', metal: '#7e5260', gun: '#1c1116', gunLight: '#5f3a45',
  },
  gunner: {
    skin: '#c78c62', skinShade: '#825034',
    coat: '#3a2a19', coatShade: '#1b120a', coatLight: '#6b4e2c',
    armor: '#5a3c1f', armorLight: '#a97635', armorShade: '#2b1c0d',
    accent: '#ffa23d', accent2: '#ffe066',
    boot: '#181109', metal: '#9c7745', gun: '#231a11', gunLight: '#77603e',
  },
  sniper: {
    skin: '#a8775f', skinShade: '#6e4534',
    coat: '#152527', coatShade: '#091112', coatLight: '#2c4a4e',
    armor: '#20383a', armorLight: '#4b7b7e', armorShade: '#101d1e',
    accent: '#5fe6ff', accent2: '#b9ffe8',
    boot: '#0b1314', metal: '#6b8d8e', gun: '#152022', gunLight: '#4e6c6e',
  },
  shield: {
    skin: '#b98467', skinShade: '#764b36',
    coat: '#1a2b3b', coatShade: '#0b151d', coatLight: '#355a74',
    armor: '#27445c', armorLight: '#5f9cc0', armorShade: '#132433',
    accent: '#7cc7ff', accent2: '#e6f7ff',
    boot: '#0c151d', metal: '#7fa4b8', gun: '#16232e', gunLight: '#547184',
  },
  heavy: {
    skin: '#bd7d5c', skinShade: '#78462f',
    coat: '#3e2919', coatShade: '#1d120a', coatLight: '#6f4a2b',
    armor: '#57331d', armorLight: '#a05a2c', armorShade: '#2a170c',
    accent: '#ff7a3d', accent2: '#ffd166',
    boot: '#17100a', metal: '#8c6b49', gun: '#24180f', gunLight: '#72563a',
  },
  biker: {
    skin: '#b8785c', skinShade: '#74422e',
    coat: '#22152e', coatShade: '#0e0814', coatLight: '#4a2a62',
    armor: '#352044', armorLight: '#7b4aa6', armorShade: '#190e21',
    accent: '#c46bff', accent2: '#ff2e88',
    boot: '#100a16', metal: '#7b5c93', gun: '#1b1122', gunLight: '#5d3f73',
  },
};

// ------------------------------------------------------------
// 人形武器：紧凑版，枪口统一落在帧中心 +24 像素处（x≈56），
// 与 Player/Enemy 的 getMuzzle 偏移一致，避免枪管出框或被裁切。
// 全部朝右绘制（朝左时由 SpriteSheet 翻转整帧）。
// ------------------------------------------------------------
function drawWeapon(ctx, type, x, y, c) {
  const gun = c.gun || '#1b2833';
  const light = c.gunLight || '#536d7e';
  const accent = c.accent;

  switch (type) {
    case 'pistol': {
      box(ctx, x, y - 2, 9, 4, gun);
      box(ctx, x + 8, y - 1, 3, 2, light);
      rect(ctx, x + 1, y + 2, 3, 4, gun);
      rect(ctx, x + 1, y + 2, 1, 3, light);
      rect(ctx, x + 3, y - 2, 2, 1, accent);
      break;
    }
    case 'rifle': {
      box(ctx, x - 3, y - 1, 4, 4, c.coatShade || gun);
      box(ctx, x, y - 2, 10, 5, gun);
      box(ctx, x + 9, y - 1, 4, 2, light);
      rect(ctx, x + 10, y - 2, 3, 1, accent);
      rect(ctx, x + 1, y - 2, 6, 1, light);
      box(ctx, x + 4, y + 3, 3, 4, gun);
      rect(ctx, x + 5, y + 3, 2, 1, accent);
      break;
    }
    case 'smg': {
      box(ctx, x - 2, y - 1, 3, 3, c.coatShade || gun);
      box(ctx, x, y - 3, 9, 6, gun);
      box(ctx, x + 8, y - 2, 4, 3, light);
      rect(ctx, x + 9, y - 2, 3, 1, accent);
      box(ctx, x + 3, y + 3, 2, 4, gun);
      box(ctx, x + 5, y + 2, 3, 3, light);
      break;
    }
    case 'shotgun': {
      box(ctx, x - 3, y - 2, 4, 5, c.coatShade || gun);
      box(ctx, x, y - 3, 10, 6, gun);
      rect(ctx, x + 1, y - 2, 10, 1, light);
      rect(ctx, x + 1, y + 1, 10, 1, light);
      rect(ctx, x + 9, y - 2, 3, 4, accent);
      box(ctx, x + 4, y + 2, 3, 3, gun);
      break;
    }
    case 'sniper': {
      box(ctx, x - 4, y - 1, 5, 4, c.coatShade || gun);
      box(ctx, x, y - 2, 12, 4, gun);
      box(ctx, x + 11, y - 1, 3, 2, light);
      box(ctx, x + 3, y - 6, 7, 3, gun);
      rect(ctx, x + 4, y - 6, 5, 1, accent);
      rect(ctx, x + 5, y - 3, 2, 1, light);
      box(ctx, x + 4, y + 2, 2, 4, gun);
      rect(ctx, x + 10, y - 1, 1, 2, '#ffffff');
      break;
    }
    case 'minigun': {
      box(ctx, x - 1, y - 5, 8, 10, light);
      rect(ctx, x, y - 4, 6, 8, gun);
      for (let i = -1; i <= 1; i++) {
        box(ctx, x + 6, y + i * 3 - 1, 6, 2, light);
      }
      rect(ctx, x + 11, y - 4, 1, 9, accent);
      box(ctx, x + 1, y + 5, 4, 4, gun);
      break;
    }
    default:
      box(ctx, x, y - 2, 9, 4, gun);
      rect(ctx, x + 8, y - 1, 2, 2, light);
  }
}

// ------------------------------------------------------------
// Boss 武器：112 像素帧 + 更大的手部锚点，沿用长枪管版本
// ------------------------------------------------------------
function drawWeaponBig(ctx, type, x, y, c) {
  const gun = c.gun || '#1b2833';
  const light = c.gunLight || '#536d7e';
  const accent = c.accent;
  const boxG = (bx, by, bw, bh, fill = gun) => box(ctx, bx, by, bw, bh, fill);

  switch (type) {
    case 'pistol': {
      boxG(x, y - 2, 10, 4);
      box(ctx, x + 9, y - 1, 3, 3, light);
      rect(ctx, x + 1, y + 2, 4, 5, OUT);
      rect(ctx, x + 1, y + 2, 3, 4, gun);
      rect(ctx, x + 2, y - 2, 3, 1, accent);
      break;
    }
    case 'rifle': {
      box(ctx, x - 4, y - 1, 5, 4, c.coatShade || gun);
      boxG(x, y - 2, 18, 5);
      box(ctx, x + 15, y - 1, 8, 2, light);
      rect(ctx, x + 18, y - 2, 5, 1, accent);
      box(ctx, x + 5, y + 3, 4, 7, gun);
      rect(ctx, x + 5, y + 3, 4, 1, light);
      box(ctx, x + 9, y - 4, 6, 2, gun);
      rect(ctx, x + 10, y - 4, 4, 1, accent);
      break;
    }
    case 'smg': {
      box(ctx, x - 3, y - 1, 4, 3, c.coatShade || gun);
      boxG(x, y - 3, 14, 6);
      box(ctx, x + 13, y - 2, 8, 3, light);
      rect(ctx, x + 16, y - 2, 4, 1, accent);
      box(ctx, x + 5, y + 3, 3, 7, gun);
      box(ctx, x + 8, y + 2, 4, 5, light);
      rect(ctx, x + 8, y + 3, 4, 1, accent);
      break;
    }
    case 'shotgun': {
      box(ctx, x - 5, y - 2, 6, 5, c.coatShade || gun);
      boxG(x, y - 3, 17, 6);
      rect(ctx, x + 2, y - 2, 17, 1, light);
      rect(ctx, x + 2, y + 1, 17, 1, light);
      rect(ctx, x + 18, y - 2, 3, 5, gun);
      box(ctx, x + 6, y + 2, 5, 4, gun);
      rect(ctx, x + 7, y + 2, 3, 1, accent);
      break;
    }
    case 'sniper': {
      box(ctx, x - 6, y - 1, 7, 4, c.coatShade || gun);
      boxG(x, y - 2, 24, 4);
      box(ctx, x + 23, y - 1, 6, 2, light);
      box(ctx, x + 6, y - 6, 9, 3, gun);
      rect(ctx, x + 7, y - 6, 7, 1, accent);
      rect(ctx, x + 9, y - 3, 2, 1, light);
      rect(ctx, x + 10, y - 5, 1, 1, accent);
      box(ctx, x + 8, y + 2, 3, 5, gun);
      break;
    }
    case 'minigun': {
      boxG(x - 2, y - 5, 12, 10, light);
      rect(ctx, x - 1, y - 4, 9, 8, gun);
      for (let i = -1; i <= 1; i++) {
        box(ctx, x + 9, y + i * 3 - 1, 12, 2, light);
      }
      rect(ctx, x + 20, y - 4, 1, 9, accent);
      box(ctx, x + 2, y + 5, 6, 5, gun);
      rect(ctx, x + 3, y + 6, 4, 1, accent);
      break;
    }
    case 'cleaver': {
      box(ctx, x - 2, y - 1, 9, 5, '#6b4a2a');
      rect(ctx, x + 1, y, 5, 1, '#b07a45');
      const pts = [[x + 7, y - 8], [x + 25, y - 10], [x + 27, y + 7], [x + 9, y + 6], [x + 6, y]];
      polyO(ctx, pts, '#a9b7c4');
      poly(ctx, [[x + 10, y - 6], [x + 23, y - 7], [x + 24, y + 3], [x + 10, y + 4]], '#dce8f2');
      rect(ctx, x + 8, y + 4, 17, 1, '#5c6a78');
      break;
    }
    case 'hook': {
      rect(ctx, x, y - 1, 16, 1, OUT);
      rect(ctx, x, y, 16, 1, '#8d99a6');
      for (let i = 0; i < 4; i++) rect(ctx, x + 2 + i * 3, y - 2, 1, 5, '#5f6a76');
      polyO(ctx, [[x + 16, y - 4], [x + 25, y - 3], [x + 27, y + 4], [x + 22, y + 8], [x + 20, y + 4], [x + 23, y + 3], [x + 21, y - 1], [x + 16, y]], '#b9c6d2');
      break;
    }
    case 'staff': {
      box(ctx, x - 2, y - 1, 28, 3, '#3b3344');
      rect(ctx, x + 1, y - 1, 24, 1, '#81719a');
      ellipseO(ctx, x + 28, y, 4, 4, accent);
      ellipse(ctx, x + 28, y, 2, 2, '#ffffff');
      break;
    }
    case 'railgun': {
      box(ctx, x - 4, y - 3, 7, 6, c.coatShade || gun);
      boxG(x, y - 4, 22, 8);
      rect(ctx, x + 2, y - 3, 18, 2, light);
      for (let i = 0; i < 3; i++) {
        box(ctx, x + 5 + i * 5, y - 6, 2, 12, accent);
        rect(ctx, x + 5 + i * 5, y - 6, 2, 1, '#ffffff');
      }
      box(ctx, x + 21, y - 2, 8, 4, light);
      rect(ctx, x + 25, y - 1, 4, 2, accent);
      break;
    }
    case 'wrench': {
      box(ctx, x, y - 1, 18, 3, c.gunLight || '#8d99a6');
      polyO(ctx, [[x + 17, y - 6], [x + 23, y - 6], [x + 26, y - 2], [x + 22, y - 1], [x + 22, y + 3], [x + 26, y + 4], [x + 23, y + 8], [x + 17, y + 8], [x + 19, y + 3], [x + 19, y + 1]], '#b9c6d2');
      break;
    }
    default:
      boxG(x, y - 2, 12, 4);
  }
}

// ------------------------------------------------------------
// 头部：每个兵种有独立剪影
// ------------------------------------------------------------
function drawHead(ctx, spec, x, cy, lean, bob) {
  const c = spec.colors;
  const rx = (spec.bulk === 2 ? 7 : spec.bulk === 0 ? 5 : 6);
  const ry = (spec.bulk === 2 ? 8 : spec.bulk === 0 ? 6 : 7);
  const hx = x + lean;
  const hy = cy + bob;

  // 脖子
  rect(ctx, hx - 2, hy + ry - 2, 4, 4, OUT);
  rect(ctx, hx - 1, hy + ry - 2, 2, 3, c.skinShade);

  switch (spec.head) {
    case 'player': {
      ellipseO(ctx, hx, hy, rx, ry, c.skin);
      // 头盔罩住上半头
      polyO(ctx, [
        [hx - rx, hy - 1], [hx - rx + 1, hy - ry - 1],
        [hx + rx - 1, hy - ry - 1], [hx + rx, hy + 1],
        [hx + rx - 2, hy + 2], [hx - rx + 2, hy + 2],
      ], c.armor);
      rect(ctx, hx - rx + 2, hy - ry + 1, rx * 2 - 4, 1, c.armorLight);
      // 青色面罩 + 白色高光
      rect(ctx, hx - rx + 1, hy, rx * 2 - 2, 3, OUT);
      rect(ctx, hx - rx + 2, hy, rx * 2 - 4, 2, c.accent);
      rect(ctx, hx + 1, hy, 3, 1, '#ffffff');
      // 下颌/围巾
      rect(ctx, hx - 2, hy + 5, 5, 2, c.skinShade);
      rect(ctx, hx - 4, hy + 6, 9, 3, OUT);
      rect(ctx, hx - 4, hy + 6, 8, 2, c.accent2);
      // 天线
      rect(ctx, hx + rx - 1, hy - ry - 4, 1, 5, OUT);
      rect(ctx, hx + rx, hy - ry - 4, 1, 4, c.accent);
      break;
    }
    case 'mohawk': {
      ellipseO(ctx, hx, hy, rx, ry, c.skin);
      // 红鸡冠
      polyO(ctx, [
        [hx - 1, hy - ry - 1], [hx + 1, hy - ry - 8],
        [hx + 3, hy - ry - 1], [hx + 4, hy - ry - 6],
        [hx + 6, hy - ry + 1],
      ], c.accent);
      rect(ctx, hx - rx, hy - 1, rx * 2, 3, c.coatShade);
      rect(ctx, hx - rx + 1, hy, 1, 2, '#ffffff');
      rect(ctx, hx + 1, hy + 3, 3, 1, c.skinShade);
      break;
    }
    case 'mask': {
      // 兜帽
      ellipseO(ctx, hx, hy, rx + 2, ry + 1, c.coat);
      ellipseO(ctx, hx + 1, hy + 1, rx - 1, ry - 1, '#0b080d');
      // 白色面具
      ellipseO(ctx, hx + 1, hy + 1, rx - 2, ry - 2, c.accent);
      rect(ctx, hx - 1, hy - 1, 2, 2, OUT);
      rect(ctx, hx + 3, hy - 1, 2, 2, OUT);
      rect(ctx, hx - 1, hy - 1, 1, 1, c.accent2);
      rect(ctx, hx + 3, hy - 1, 1, 1, c.accent2);
      for (let i = 0; i < 3; i++) rect(ctx, hx, hy + 3 + i, 5, 1, '#b9a999');
      break;
    }
    case 'bald': {
      ellipseO(ctx, hx, hy, rx + 1, ry, c.skin);
      rect(ctx, hx - rx + 1, hy - ry + 1, rx * 2 - 1, 2, c.skinShade);
      // 大胡子
      polyO(ctx, [
        [hx - rx, hy + 2], [hx - rx + 1, hy + ry + 3],
        [hx + rx - 1, hy + ry + 3], [hx + rx, hy + 2],
      ], '#3a2418');
      rect(ctx, hx - 3, hy - 1, 2, 2, OUT);
      rect(ctx, hx + 2, hy - 1, 2, 2, OUT);
      rect(ctx, hx - 3, hy - 1, 1, 1, '#ffd166');
      rect(ctx, hx + 2, hy - 1, 1, 1, '#ffd166');
      // 疤
      rect(ctx, hx + 3, hy - 3, 1, 4, c.skinShade);
      break;
    }
    case 'hood': {
      ellipseO(ctx, hx, hy, rx + 2, ry + 1, c.coat);
      ellipseO(ctx, hx + 1, hy + 1, rx - 2, ry - 2, '#0b1214');
      rect(ctx, hx - 2, hy, 7, 2, OUT);
      rect(ctx, hx - 1, hy, 5, 1, c.accent);
      rect(ctx, hx + 3, hy, 1, 1, '#ffffff');
      break;
    }
    case 'helmet': {
      ellipseO(ctx, hx, hy, rx + 1, ry + 1, c.armor);
      rect(ctx, hx - rx, hy - ry - 1, rx * 2, 3, c.armorLight);
      rect(ctx, hx - rx, hy, rx * 2, 3, OUT);
      rect(ctx, hx - rx + 1, hy, rx * 2 - 2, 2, c.accent);
      rect(ctx, hx + 2, hy, 2, 1, '#ffffff');
      break;
    }
    case 'gas': {
      ellipseO(ctx, hx, hy, rx + 1, ry, c.armor);
      rect(ctx, hx - rx, hy - 2, rx * 2, 4, OUT);
      rect(ctx, hx - rx + 1, hy - 1, 3, 2, c.accent);
      rect(ctx, hx + 2, hy - 1, 3, 2, c.accent);
      // 滤毒罐
      ellipseO(ctx, hx + rx + 1, hy + 3, 3, 3, c.metal);
      rect(ctx, hx + rx, hy + 5, 3, 2, OUT);
      break;
    }
    case 'spike': {
      ellipseO(ctx, hx, hy, rx + 1, ry + 1, c.armor);
      for (let i = -1; i <= 1; i++) {
        polyO(ctx, [
          [hx + i * 4 - 1, hy - ry], [hx + i * 4, hy - ry - 5], [hx + i * 4 + 2, hy - ry],
        ], c.accent);
      }
      rect(ctx, hx - rx, hy, rx * 2, 3, OUT);
      rect(ctx, hx - rx + 1, hy, rx * 2 - 2, 2, c.accent2);
      break;
    }
    default:
      ellipseO(ctx, hx, hy, rx, ry, c.skin);
  }

  // 头部高光：统一从左上打光
  rect(ctx, hx - rx + 1, hy - ry + 1, 2, 1, 'rgba(255,255,255,0.35)');
}

// ------------------------------------------------------------
// 人形角色
// pose: { kind, phase, crouch, bob, lean, death, melee }
// ------------------------------------------------------------
function drawHuman(ctx, spec, pose) {
  const c = spec.colors;
  const cx = 32;
  const bulk = spec.bulk ?? 1;
  const crouch = !!pose.crouch;
  const bob = pose.bob || 0;
  const lean = pose.lean || 0;
  const kind = pose.kind || 'idle';

  const torsoW = (bulk === 2 ? 22 : bulk === 0 ? 15 : 18);
  const shoulderW = (bulk === 2 ? 28 : bulk === 0 ? 20 : 24);
  const torsoTop = (crouch ? 33 : 22) - bob;
  const torsoBot = crouch ? 51 : 44;
  const hipY = crouch ? 50 : 44;
  const headCY = (crouch ? 29 : 15) - bob;
  const gunY = (crouch ? 45 : 33) - bob;
  const sx = cx + lean;
  const shoulderY = torsoTop + 5;

  // 腿的落脚点
  let frontFootX = cx + 5;
  let backFootX = cx - 5;
  let frontFootY = 62;
  let backFootY = 62;
  let frontKneeX = cx + 6;
  let backKneeX = cx - 6;
  let frontKneeY = 53;
  let backKneeY = 53;

  if (crouch) {
    frontFootX = cx + 9; backFootX = cx - 4;
    frontKneeX = cx + 10; backKneeX = cx - 8;
    frontKneeY = 57; backKneeY = 57;
  } else if (kind === 'run') {
    const p = pose.phase || 0;
    const swing = Math.sin(p) * 7;
    frontFootX = cx + swing;
    backFootX = cx - swing;
    frontKneeX = cx + swing * 0.55;
    backKneeX = cx - swing * 0.55;
    frontFootY = 62 - Math.max(0, Math.sin(p + Math.PI * 0.5)) * 2;
    backFootY = 62 - Math.max(0, -Math.sin(p + Math.PI * 0.5)) * 2;
  } else if (kind === 'jump') {
    frontFootX = cx + 7; backFootX = cx - 6;
    frontFootY = 56; backFootY = 59;
    frontKneeX = cx + 9; backKneeX = cx - 8;
    frontKneeY = 50; backKneeY = 52;
  } else if (kind === 'hurt') {
    frontFootX = cx + 6; backFootX = cx - 7;
    frontKneeX = cx + 7; backKneeX = cx - 8;
  }

  // —— 身后装备 ——
  if (spec.backpack) {
    const bx = sx - torsoW / 2 - 8;
    const by = torsoTop + 4;
    box(ctx, bx, by, 7, 15, c.armorShade);
    rect(ctx, bx + 1, by + 2, 2, 8, c.armorLight);
    ellipseO(ctx, bx + 4, by + 1, 2, 2, c.metal);
    rect(ctx, bx + 5, by + 6, 4, 2, c.accent);
  }
  if (spec.tank) {
    const bx = sx - torsoW / 2 - 10;
    const by = torsoTop + 2;
    ellipseO(ctx, bx + 4, by + 6, 5, 8, c.armor);
    rect(ctx, bx + 1, by + 4, 3, 12, c.armorLight);
    rect(ctx, bx + 4, by - 2, 3, 4, c.metal);
    rect(ctx, bx + 4, by + 12, 5, 2, c.accent);
  }
  if (spec.coatTails || spec.cape) {
    polyO(ctx, [
      [sx - torsoW / 2 + 1, torsoBot - 6],
      [sx - torsoW / 2 - 5, 56],
      [sx - 2, 50],
      [sx + 1, 57],
      [sx + 6, 49],
      [sx + torsoW / 2 - 1, torsoBot - 6],
    ], spec.cape ? c.coatShade : c.coat);
    if (spec.cape) {
      poly(ctx, [[sx - 4, torsoBot - 6], [sx - 6, 54], [sx - 2, 50]], c.accent);
    }
  }

  // —— 后腿 ——
  limb(ctx, sx - 4, hipY, backKneeX, backKneeY, 6, c.coatShade);
  limb(ctx, backKneeX, backKneeY, backFootX, backFootY, 5, c.boot);
  rect(ctx, backFootX - 3, backFootY - 1, 8, 3, OUT);
  rect(ctx, backFootX - 3, backFootY - 1, 7, 2, c.boot);

  // —— 后臂 ——
  const backShoulderX = sx - shoulderW / 2 + 3;
  const backElbowX = sx - shoulderW / 2 - 1;
  if (pose.twoHand) {
    limb(ctx, backShoulderX, shoulderY, backElbowX, gunY + 2, 5, c.coatShade);
    limb(ctx, backElbowX, gunY + 2, sx + 2, gunY + 1, 4, c.coatLight);
    rect(ctx, sx + 1, gunY, 3, 3, c.skin);
  } else {
    limb(ctx, backShoulderX, shoulderY, backElbowX, shoulderY + 9, 5, c.coatShade);
    limb(ctx, backElbowX, shoulderY + 9, backElbowX + 2, shoulderY + 15, 4, c.coatShade);
    rect(ctx, backElbowX + 1, shoulderY + 14, 3, 3, c.skinShade);
  }

  // —— 躯干 ——
  const torsoPts = [
    [sx - torsoW / 2, torsoTop],
    [sx + torsoW / 2, torsoTop],
    [sx + torsoW / 2 + 2, torsoBot],
    [sx - torsoW / 2 - 2, torsoBot],
  ];
  polyO(ctx, torsoPts, c.coat);
  // 右侧阴影 / 左侧高光
  poly(ctx, [
    [sx + torsoW / 2 - 2, torsoTop + 1],
    [sx + torsoW / 2, torsoTop + 1],
    [sx + torsoW / 2 + 2, torsoBot - 1],
    [sx + torsoW / 2 - 2, torsoBot - 1],
  ], c.coatShade);
  rect(ctx, sx - torsoW / 2 + 1, torsoTop + 1, 2, Math.max(3, torsoBot - torsoTop - 4), c.coatLight);

  // 胸甲 / 背心
  if (spec.armorChest) {
    box(ctx, sx - torsoW / 2 + 3, torsoTop + 4, torsoW - 6, 10, c.armor);
    rect(ctx, sx - torsoW / 2 + 4, torsoTop + 4, torsoW - 8, 1, c.armorLight);
    rect(ctx, sx - 1, torsoTop + 6, 2, 6, c.accent);
  }
  if (spec.belly) {
    ellipseO(ctx, sx + 1, torsoBot - 6, 8, 9, c.coatLight);
    rect(ctx, sx - 2, torsoBot - 10, 5, 1, c.coatShade);
  }
  // 腰带
  rect(ctx, sx - torsoW / 2 - 1, torsoBot - 5, torsoW + 2, 3, OUT);
  rect(ctx, sx - torsoW / 2, torsoBot - 5, torsoW, 2, c.armorShade);
  rect(ctx, sx - 1, torsoBot - 5, 3, 2, c.accent);

  // 肩甲
  if (spec.pauldron) {
    box(ctx, sx - shoulderW / 2 - 2, shoulderY - 4, 7, 6, c.armor);
    rect(ctx, sx - shoulderW / 2 - 1, shoulderY - 4, 5, 1, c.armorLight);
  }

  // —— 前腿 ——
  limb(ctx, sx + 4, hipY, frontKneeX, frontKneeY, 6, c.coat);
  limb(ctx, frontKneeX, frontKneeY, frontFootX, frontFootY, 5, c.boot);
  rect(ctx, frontFootX - 3, frontFootY - 1, 8, 3, OUT);
  rect(ctx, frontFootX - 3, frontFootY - 1, 7, 2, c.boot);
  rect(ctx, frontFootX + 2, frontFootY - 1, 2, 1, c.metal);

  // —— 头部 ——
  drawHead(ctx, spec, sx, headCY, lean, 0);

  // —— 前臂 + 武器 ——
  const frontShoulderX = sx + shoulderW / 2 - 3;
  const handX = sx + torsoW / 2 + 3;
  limb(ctx, frontShoulderX, shoulderY, handX - 1, gunY - 1, 5, c.coat);
  limb(ctx, handX - 1, gunY - 1, handX + 2, gunY, 4, c.skin);
  rect(ctx, handX + 1, gunY - 1, 3, 3, c.skin);

  const recoil = pose.recoil || 0;
  // 近战帧不画枪：Player.drawBlade 会在同一位置补上挥砍光刃
  if (!pose.hideWeapon) drawWeapon(ctx, spec.weapon, handX + 1 - recoil, gunY, c);

  // 膝盖金属高光：暗色裤腿在夜景里也能看出腿型
  rect(ctx, frontKneeX - 2, frontKneeY - 1, 4, 1, c.metal);
  rect(ctx, backKneeX - 2, backKneeY - 1, 3, 1, c.armorShade);

  // —— 兵种专属细节 ——
  switch (spec.extra) {
    case 'ammoBelt': {
      for (let i = 0; i < 4; i++) {
        rect(ctx, sx - 6 + i * 3, torsoTop + 14, 2, 3, c.accent2);
      }
      break;
    }
    case 'bladeArm': {
      const bx = frontShoulderX + 2;
      const by = gunY - 2;
      polyO(ctx, [[bx, by], [bx + 13, by + 5], [bx + 2, by + 9]], '#b9c6d2');
      rect(ctx, bx + 1, by + 3, 9, 1, '#ffffff');
      break;
    }
    case 'shieldPack': {
      // 背部备用盾牌
      box(ctx, sx - torsoW / 2 - 11, torsoTop + 8, 6, 18, c.armor);
      rect(ctx, sx - torsoW / 2 - 10, torsoTop + 9, 4, 1, c.armorLight);
      rect(ctx, sx - torsoW / 2 - 9, torsoTop + 12, 2, 10, c.accent);
      break;
    }
    case 'exhaust': {
      // 背后的排气管
      box(ctx, sx - torsoW / 2 - 9, torsoTop + 5, 4, 10, c.metal);
      rect(ctx, sx - torsoW / 2 - 9, torsoTop + 3, 4, 3, OUT);
      rect(ctx, sx - torsoW / 2 - 8, torsoTop + 3, 2, 2, c.accent);
      break;
    }
    case 'cloakPin': {
      ellipseO(ctx, sx + 5, shoulderY - 1, 2, 2, c.accent);
      break;
    }
  }

  // 武器高光/发光点
  rect(ctx, sx + torsoW / 2 + 5, gunY - 1, 1, 1, '#ffffff');
}

// ------------------------------------------------------------
// 死亡姿势：分阶段塌陷，最后一帧是横向尸体
// ------------------------------------------------------------
function drawHumanDeath(ctx, spec, stage, boss = false) {
  const c = spec.colors;
  if (boss) return drawBossDeath(ctx, spec, stage);
  const cx = 32;
  if (stage <= 1) {
    drawHuman(ctx, spec, {
      kind: 'hurt', twoHand: true, lean: -2 - stage * 2,
      bob: stage * 3, crouch: stage > 0,
    });
    return;
  }
  if (stage === 2) {
    // 跪倒
    ellipseO(ctx, cx, 54, 10, 7, c.coat);
    rect(ctx, cx - 8, 48, 16, 12, OUT);
    rect(ctx, cx - 7, 48, 14, 11, c.coat);
    drawHead(ctx, spec, cx + 1, 44, 0, 0);
    limb(ctx, cx - 3, 56, cx - 10, 62, 5, c.boot);
    limb(ctx, cx + 4, 56, cx + 10, 62, 5, c.boot);
    return;
  }
  // 横躺：身体从左向右铺开
  const drop = stage >= 4 ? 4 : 1;
  const y = 54 + drop;
  polyO(ctx, [[cx - 16, y - 6], [cx + 10, y - 7], [cx + 14, y], [cx + 8, y + 5], [cx - 16, y + 4]], c.coat);
  rect(ctx, cx - 15, y - 5, 10, 1, c.coatLight);
  drawHead(ctx, spec, cx + 17, y - 2, 0, 0);
  limb(ctx, cx - 14, y + 2, cx - 24, y + 6, 5, c.boot);
  limb(ctx, cx - 10, y + 2, cx - 20, y + 9, 5, c.boot);
  limb(ctx, cx + 2, y, cx + 6, y - 8, 4, c.coatShade);
  // 血迹/碎片
  rect(ctx, cx - 24, 62, 3, 1, '#4a1119');
  rect(ctx, cx + 12, 62, 5, 1, '#4a1119');
  if (stage >= 4) {
    rect(ctx, cx - 12, y - 8, 5, 1, c.accent);
    rect(ctx, cx + 6, y + 5, 4, 1, c.accent2);
  }
}

// ------------------------------------------------------------
// Boss：112x112，四个独立轮廓
// ------------------------------------------------------------
function drawBoss(ctx, spec, pose) {
  const c = spec.colors;
  const cx = 56;
  const bob = pose.bob || 0;
  const lean = pose.lean || 0;
  const kind = pose.kind || 'idle';
  const sx = cx + lean;
  const torsoTop = 38 - bob;
  const torsoBot = 82;
  const headCY = 27 - bob;
  const gunY = 59 - bob;
  const hipY = 82;
  const shoulderY = torsoTop + 9;
  const shoulderW = 52;
  const torsoW = 36;

  let frontFootX = cx + 9, backFootX = cx - 9;
  let frontFootY = 108, backFootY = 108;
  let frontKneeX = cx + 11, backKneeX = cx - 11;
  let frontKneeY = 94, backKneeY = 94;

  if (kind === 'walk') {
    const p = pose.phase || 0;
    const swing = Math.sin(p) * 10;
    frontFootX = cx + swing;
    backFootX = cx - swing;
    frontKneeX = cx + swing * 0.5;
    backKneeX = cx - swing * 0.5;
  } else if (kind === 'charge') {
    frontFootX = cx + 15; backFootX = cx - 14;
    frontKneeX = cx + 16; backKneeX = cx - 15;
  }

  // —— 背后装备 ——
  if (spec.bossType === 'steam') {
    // 蒸汽背包：双罐 + 压力表
    box(ctx, sx - 31, 44, 16, 30, c.armorShade);
    ellipseO(ctx, sx - 27, 50, 7, 9, c.metal);
    ellipseO(ctx, sx - 18, 52, 6, 8, c.armorLight);
    rect(ctx, sx - 28, 48, 2, 3, c.accent);
    rect(ctx, sx - 19, 50, 2, 2, c.accent);
    rect(ctx, sx - 26, 40, 4, 6, c.metal);
    rect(ctx, sx - 20, 43, 8, 2, c.accent);
    // 背后大砍刀
    polyO(ctx, [[sx - 34, 66], [sx - 46, 88], [sx - 38, 92], [sx - 28, 70]], '#a9b7c4');
    rect(ctx, sx - 40, 74, 9, 1, '#dce8f2');
  }
  if (spec.bossType === 'crane') {
    // 吊机吊臂 + 链条
    box(ctx, sx - 34, 42, 12, 34, c.armorShade);
    rect(ctx, sx - 33, 44, 10, 2, '#ffd166');
    rect(ctx, sx - 33, 50, 10, 2, '#ffd166');
    rect(ctx, sx - 33, 56, 10, 2, '#ffd166');
    limb(ctx, sx - 34, 50, sx - 50, 34, 3, c.metal);
    for (let i = 0; i < 5; i++) rect(ctx, sx - 50 + i * 2, 34 + i * 3, 2, 2, '#aab6c2');
    polyO(ctx, [[sx - 42, 50], [sx - 36, 52], [sx - 38, 60], [sx - 46, 58]], c.metal);
  }
  if (spec.bossType === 'warden') {
    // 披风 + 背后能量柱
    polyO(ctx, [[sx - 18, 44], [sx - 34, 98], [sx - 20, 104], [sx - 4, 52]], c.coatShade);
    rect(ctx, sx - 30, 60, 2, 34, c.accent);
    rect(ctx, sx - 26, 70, 1, 20, c.accent);
  }
  if (spec.bossType === 'rail') {
    // 摩托车轮肩甲 + 排气管
    ellipseO(ctx, sx - 26, 48, 10, 10, c.armor);
    ellipseO(ctx, sx - 26, 48, 6, 6, c.armorShade);
    ellipseO(ctx, sx - 26, 48, 2, 2, c.metal);
    box(ctx, sx - 32, 60, 8, 18, c.metal);
    rect(ctx, sx - 31, 58, 6, 3, OUT);
    rect(ctx, sx - 30, 58, 4, 1, c.accent);
  }

  // —— 后腿 ——
  limb(ctx, sx - 9, hipY, backKneeX, backKneeY, 12, c.coatShade);
  limb(ctx, backKneeX, backKneeY, backFootX, backFootY, 10, c.boot);
  rect(ctx, backFootX - 7, backFootY - 3, 16, 5, OUT);
  rect(ctx, backFootX - 7, backFootY - 3, 14, 3, c.boot);

  // —— 后臂 ——
  limb(ctx, sx - 22, shoulderY, sx - 30, shoulderY + 18, 10, c.coatShade);
  limb(ctx, sx - 30, shoulderY + 18, sx - 26, shoulderY + 30, 8, c.coatLight);
  rect(ctx, sx - 28, shoulderY + 28, 5, 5, c.skinShade);

  // —— 躯干 ——
  polyO(ctx, [
    [sx - torsoW / 2, torsoTop],
    [sx + torsoW / 2, torsoTop],
    [sx + torsoW / 2 + 5, torsoBot],
    [sx - torsoW / 2 - 5, torsoBot],
  ], c.coat);
  poly(ctx, [
    [sx + torsoW / 2 - 4, torsoTop + 1],
    [sx + torsoW / 2, torsoTop + 1],
    [sx + torsoW / 2 + 5, torsoBot - 1],
    [sx + torsoW / 2 - 4, torsoBot - 1],
  ], c.coatShade);
  rect(ctx, sx - torsoW / 2 + 1, torsoTop + 1, 3, torsoBot - torsoTop - 3, c.coatLight);

  // 胸甲
  if (spec.bossType === 'steam') {
    // 屠夫围裙
    polyO(ctx, [[sx - 12, 46], [sx + 13, 46], [sx + 17, 86], [sx - 16, 86]], '#c9b79a');
    rect(ctx, sx - 10, 50, 3, 2, '#8a3b2f');
    rect(ctx, sx + 8, 62, 4, 1, '#8a3b2f');
    rect(ctx, sx - 14, 76, 6, 2, '#8a3b2f');
    // 胸口压力阀
    ellipseO(ctx, sx + 8, 48, 4, 4, c.metal);
    rect(ctx, sx + 7, 47, 2, 1, c.accent);
  } else if (spec.bossType === 'crane') {
    box(ctx, sx - 17, 44, 34, 22, c.armor);
    for (let i = 0; i < 4; i++) {
      rect(ctx, sx - 16 + i * 9, 46, 4, 3, '#ffd166');
      rect(ctx, sx - 16 + i * 9, 52, 4, 3, '#ffd166');
    }
    rect(ctx, sx - 2, 58, 4, 10, c.accent);
  } else if (spec.bossType === 'warden') {
    box(ctx, sx - 17, 44, 34, 24, c.armor);
    rect(ctx, sx - 15, 45, 30, 2, c.armorLight);
    rect(ctx, sx - 1, 47, 3, 16, c.accent);
    // 胸前能量核心
    ellipseO(ctx, sx, 57, 5, 5, c.accent);
    ellipse(ctx, sx, 57, 2, 2, '#ffffff');
  } else if (spec.bossType === 'rail') {
    box(ctx, sx - 17, 44, 34, 24, c.armor);
    rect(ctx, sx - 15, 45, 30, 2, c.armorLight);
    for (let i = 0; i < 3; i++) rect(ctx, sx - 12 + i * 10, 50, 5, 2, c.accent);
    rect(ctx, sx - 3, 56, 6, 10, c.armorShade);
    rect(ctx, sx - 2, 58, 4, 1, c.accent2);
  }

  // 腰带
  rect(ctx, sx - torsoW / 2 - 3, torsoBot - 8, torsoW + 6, 5, OUT);
  rect(ctx, sx - torsoW / 2 - 2, torsoBot - 8, torsoW + 4, 3, c.armorShade);
  rect(ctx, sx - 3, torsoBot - 8, 6, 3, c.accent);

  // 肩甲
  box(ctx, sx - shoulderW / 2 - 2, shoulderY - 7, 14, 12, c.armor);
  rect(ctx, sx - shoulderW / 2 - 1, shoulderY - 7, 12, 2, c.armorLight);
  box(ctx, sx + shoulderW / 2 - 12, shoulderY - 7, 14, 12, c.armor);
  rect(ctx, sx + shoulderW / 2 - 11, shoulderY - 7, 12, 2, c.armorLight);

  // —— 前腿 ——
  limb(ctx, sx + 9, hipY, frontKneeX, frontKneeY, 12, c.coat);
  limb(ctx, frontKneeX, frontKneeY, frontFootX, frontFootY, 10, c.boot);
  rect(ctx, frontFootX - 7, frontFootY - 3, 16, 5, OUT);
  rect(ctx, frontFootX - 7, frontFootY - 3, 14, 3, c.boot);
  rect(ctx, frontFootX + 4, frontFootY - 3, 3, 2, c.metal);

  // —— 头 ——
  drawBossHead(ctx, spec, sx, headCY, lean, 0);

  // —— 前臂 + 专属武器 ——
  const frontShoulderX = sx + shoulderW / 2 - 6;
  const handX = sx + torsoW / 2 + 10;
  limb(ctx, frontShoulderX, shoulderY, handX - 6, gunY - 4, 11, c.coat);
  limb(ctx, handX - 6, gunY - 4, handX, gunY, 8, c.skin);
  rect(ctx, handX - 2, gunY - 3, 8, 7, c.skin);

  const recoil = pose.recoil || 0;
  switch (spec.bossType) {
    case 'steam':
      drawWeaponBig(ctx, 'cleaver', handX - 6 - recoil, gunY + 2, c);
      break;
    case 'crane':
      drawWeaponBig(ctx, 'wrench', handX - 5 - recoil, gunY, c);
      break;
    case 'warden':
      // 塔盾：正面大盾 + 中央能量槽
      polyO(ctx, [
        [handX - 2, gunY - 22], [handX + 9, gunY - 20],
        [handX + 9, gunY + 20], [handX + 1, gunY + 25],
        [handX - 6, gunY + 18], [handX - 6, gunY - 16],
      ], c.armor);
      rect(ctx, handX - 3, gunY - 18, 9, 2, c.armorLight);
      rect(ctx, handX + 1, gunY - 14, 2, 28, c.accent);
      rect(ctx, handX - 1, gunY - 2, 6, 3, '#ffffff');
      break;
    case 'rail':
      drawWeaponBig(ctx, 'railgun', handX - 8 - recoil, gunY, c);
      break;
    default:
      drawWeaponBig(ctx, 'minigun', handX - 4 - recoil, gunY, c);
  }

  // 胸口/武器高光
  rect(ctx, sx + 6, torsoTop + 6, 2, 1, '#ffffff');
}

function drawBossHead(ctx, spec, x, cy, lean, bob) {
  const c = spec.colors;
  const hx = x + lean;
  const hy = cy + bob;
  const rx = 12;
  const ry = 14;

  rect(ctx, hx - 4, hy + ry - 3, 8, 6, OUT);
  rect(ctx, hx - 3, hy + ry - 3, 6, 5, c.skinShade);

  if (spec.bossType === 'steam') {
    ellipseO(ctx, hx, hy, rx + 1, ry, c.skin);
    // 光头 + 呼吸面罩
    rect(ctx, hx - rx + 1, hy - ry + 1, rx * 2 - 2, 3, c.skinShade);
    box(ctx, hx - 7, hy + 1, 15, 8, c.metal);
    rect(ctx, hx - 5, hy + 2, 4, 2, c.accent);
    rect(ctx, hx + 2, hy + 2, 4, 2, c.accent);
    rect(ctx, hx - 2, hy + 8, 5, 3, OUT);
    // 屠夫帽/头巾
    polyO(ctx, [
      [hx - rx, hy - ry + 3], [hx - 8, hy - ry - 4],
      [hx + 8, hy - ry - 3], [hx + rx, hy - ry + 4],
    ], '#4a2b25');
    rect(ctx, hx - 8, hy - ry - 1, 16, 2, '#7a3b31');
    // 疤
    rect(ctx, hx + 6, hy - 4, 1, 6, c.skinShade);
  } else if (spec.bossType === 'crane') {
    ellipseO(ctx, hx, hy, rx, ry, c.skin);
    // 安全帽
    polyO(ctx, [
      [hx - rx - 2, hy - 4], [hx - 9, hy - ry - 5],
      [hx + 9, hy - ry - 5], [hx + rx + 2, hy - 4],
    ], '#ffc93d');
    rect(ctx, hx - rx - 2, hy - 5, rx * 2 + 4, 3, '#a86f1e');
    rect(ctx, hx - 2, hy - ry - 6, 4, 2, '#ffe066');
    // 护目镜
    rect(ctx, hx - 8, hy, 16, 4, OUT);
    rect(ctx, hx - 7, hy, 14, 3, c.accent);
    rect(ctx, hx + 3, hy, 2, 1, '#ffffff');
    // 大胡子
    polyO(ctx, [[hx - 8, hy + 6], [hx, hy + 12], [hx + 8, hy + 6], [hx + 5, hy + 11], [hx - 5, hy + 11]], '#3a2418');
  } else if (spec.bossType === 'warden') {
    ellipseO(ctx, hx, hy, rx, ry, c.armor);
    // 典狱长头盔：高冠 + 观察缝
    polyO(ctx, [
      [hx - rx, hy - 2], [hx - 6, hy - ry - 8],
      [hx + 6, hy - ry - 8], [hx + rx, hy - 2],
    ], c.armorLight);
    rect(ctx, hx - rx, hy - 3, rx * 2, 3, c.armorShade);
    rect(ctx, hx - 8, hy - 1, 16, 3, OUT);
    rect(ctx, hx - 7, hy - 1, 14, 2, c.accent);
    rect(ctx, hx + 3, hy - 1, 3, 1, '#ffffff');
    // 面甲下缘
    rect(ctx, hx - 6, hy + 8, 12, 2, c.armorShade);
    rect(ctx, hx - 2, hy + 8, 4, 2, c.accent);
  } else {
    ellipseO(ctx, hx, hy, rx, ry, c.armor);
    // 高架追猎者：全覆式头盔 + 紫色单眼
    polyO(ctx, [
      [hx - rx - 1, hy - 2], [hx - 8, hy - ry - 3],
      [hx + 8, hy - ry - 3], [hx + rx + 1, hy - 2],
    ], c.armor);
    rect(ctx, hx - rx, hy - 2, rx * 2, 4, OUT);
    rect(ctx, hx - 7, hy - 2, 14, 3, c.accent);
    rect(ctx, hx + 2, hy - 2, 4, 1, '#ffffff');
    // 侧管
    box(ctx, hx + rx - 1, hy + 3, 5, 7, c.metal);
    rect(ctx, hx + rx + 1, hy + 4, 2, 2, c.accent2);
    rect(ctx, hx - 5, hy + 9, 10, 2, c.armorShade);
  }
  rect(ctx, hx - rx + 2, hy - ry + 2, 3, 1, 'rgba(255,255,255,0.35)');
}

function drawBossDeath(ctx, spec, stage) {
  const c = spec.colors;
  if (stage <= 1) {
    drawBoss(ctx, spec, { kind: 'hurt', lean: -3 - stage * 3, bob: stage * 4 });
    return;
  }
  if (stage === 2) {
    // 单膝跪地
    ellipseO(ctx, 56, 92, 24, 14, c.coat);
    rect(ctx, 34, 78, 44, 28, OUT);
    rect(ctx, 35, 78, 42, 26, c.coat);
    drawBossHead(ctx, spec, 56, 66, 0, 0);
    limb(ctx, 46, 96, 28, 106, 12, c.boot);
    limb(ctx, 64, 96, 84, 106, 12, c.boot);
    return;
  }
  // 倒塌：横向巨躯
  const y = stage >= 4 ? 96 : 88;
  polyO(ctx, [[20, y - 14], [70, y - 18], [88, y - 8], [82, y + 10], [24, y + 8]], c.coat);
  rect(ctx, 26, y - 12, 20, 2, c.coatLight);
  drawBossHead(ctx, spec, 84, y - 8, 0, 0);
  limb(ctx, 28, y + 4, 8, y + 12, 12, c.boot);
  limb(ctx, 36, y + 5, 14, y + 18, 10, c.boot);
  limb(ctx, 64, y - 6, 78, y - 20, 8, c.coatShade);
  if (stage >= 4) {
    rect(ctx, 18, y + 10, 10, 2, '#4a1119');
    rect(ctx, 70, y + 12, 14, 1, '#4a1119');
    rect(ctx, 46, y - 20, 6, 1, c.accent);
  }
}

// ------------------------------------------------------------
// 角色规格
// ------------------------------------------------------------
const SPECS = {
  player: {
    colors: P.player, head: 'player', weapon: 'rifle', bulk: 1,
    backpack: true, coatTails: true, armorChest: true, pauldron: true, twoHand: true,
  },
  thug_mohawk: {
    colors: P.mohawk, head: 'mohawk', weapon: 'pistol', bulk: 1,
    armorChest: true, twoHand: false,
  },
  thug_mask: {
    colors: P.mask, head: 'mask', weapon: 'smg', bulk: 1,
    armorChest: true, twoHand: true,
  },
  thug_bald: {
    colors: P.bald, head: 'bald', weapon: 'pistol', bulk: 2,
    armorChest: true, belly: true, twoHand: false,
  },
  rusher: {
    colors: P.rusher, head: 'mohawk', weapon: 'pistol', bulk: 0,
    armorChest: true, extra: 'bladeArm', twoHand: false,
  },
  gunner: {
    colors: P.gunner, head: 'helmet', weapon: 'minigun', bulk: 2,
    armorChest: true, extra: 'ammoBelt', pauldron: true, twoHand: true,
  },
  sniper: {
    colors: P.sniper, head: 'hood', weapon: 'sniper', bulk: 0,
    cape: true, twoHand: true,
  },
  shield: {
    colors: P.shield, head: 'helmet', weapon: 'smg', bulk: 2,
    armorChest: true, extra: 'shieldPack', pauldron: true, twoHand: true,
  },
  heavy: {
    colors: P.heavy, head: 'gas', weapon: 'shotgun', bulk: 2,
    armorChest: true, belly: true, tank: true, twoHand: true,
  },
  biker: {
    colors: P.biker, head: 'spike', weapon: 'pistol', bulk: 0,
    armorChest: true, extra: 'exhaust', pauldron: true, twoHand: false,
  },
};

const BOSS_SPECS = {
  boss_steam: {
    bossType: 'steam',
    colors: {
      skin: '#c58b68', skinShade: '#7d4a32',
      coat: '#3e2420', coatShade: '#1d0f0d', coatLight: '#724034',
      armor: '#4d2b26', armorLight: '#95503f', armorShade: '#251210',
      accent: '#ff7a3d', accent2: '#ffd166',
      boot: '#17100d', metal: '#9b7a55', gun: '#2a1b15', gunLight: '#7a5a3d',
    },
  },
  boss_crane: {
    bossType: 'crane',
    colors: {
      skin: '#c98b62', skinShade: '#815032',
      coat: '#3c2b18', coatShade: '#1c130a', coatLight: '#70502b',
      armor: '#5c411f', armorLight: '#b07a2c', armorShade: '#2b1d0c',
      accent: '#ffc93d', accent2: '#ffe066',
      boot: '#181108', metal: '#9c7745', gun: '#241a10', gunLight: '#7d6037',
    },
  },
  boss_warden: {
    bossType: 'warden',
    colors: {
      skin: '#b98568', skinShade: '#744b35',
      coat: '#172a3b', coatShade: '#0a141d', coatLight: '#2e516d',
      armor: '#24445e', armorLight: '#5f9cc0', armorShade: '#111f2c',
      accent: '#7cc7ff', accent2: '#e6f7ff',
      boot: '#0b131b', metal: '#84a6ba', gun: '#15222e', gunLight: '#547184',
    },
  },
  boss_rail: {
    bossType: 'rail',
    colors: {
      skin: '#a8765d', skinShade: '#6d4230',
      coat: '#22142e', coatShade: '#0e0814', coatLight: '#4b2a63',
      armor: '#352044', armorLight: '#7b4aa6', armorShade: '#180d20',
      accent: '#c46bff', accent2: '#ff2e88',
      boot: '#0f0915', metal: '#7b5c93', gun: '#1b1122', gunLight: '#5d3f73',
    },
  },
};

// ------------------------------------------------------------
// 动画帧定义
// ------------------------------------------------------------
const PLAYER_TAGS = [
  { name: 'idle', from: 0, to: 5 },
  { name: 'run', from: 6, to: 13 },
  { name: 'shoot', from: 14, to: 16 },
  { name: 'crouch', from: 17, to: 19 },
  { name: 'jump', from: 20, to: 22 },
  { name: 'hurt', from: 23, to: 24 },
  { name: 'death', from: 25, to: 32 },
  { name: 'melee', from: 33, to: 38 },
];

function playerFrame(spec, i) {
  if (i < 6) {
    const bob = [0, 0, 1, 1, 0, 0][i];
    const sway = [0, 1, 1, 0, -1, -1][i];
    return { kind: 'idle', bob, lean: sway, twoHand: true };
  }
  if (i < 14) {
    const p = ((i - 6) / 8) * Math.PI * 2;
    return { kind: 'run', phase: p, bob: Math.abs(Math.sin(p)) > 0.5 ? 1 : 0, lean: 2, twoHand: true };
  }
  if (i < 17) {
    const k = i - 14;
    return { kind: 'idle', bob: 0, lean: -1, recoil: [0, 1, 2][k], twoHand: true };
  }
  if (i < 20) {
    const k = i - 17;
    return { kind: 'idle', crouch: true, bob: 0, recoil: [0, 1, 0][k], twoHand: true };
  }
  if (i < 23) {
    const k = i - 20;
    return { kind: 'jump', bob: [-3, -2, 0][k], lean: 1, twoHand: true };
  }
  if (i < 25) {
    const k = i - 23;
    return { kind: 'hurt', bob: 1 + k, lean: -3 - k, twoHand: true };
  }
  if (i < 33) {
    return { kind: 'death', stage: i - 25 };
  }
  const k = i - 33;
  const melee = [
    { lean: -1, bob: 0, twoHand: false, hideWeapon: true },
    { lean: -2, bob: 0, twoHand: false, hideWeapon: true },
    { lean: 1, bob: 1, twoHand: false, hideWeapon: true },
    { lean: 3, bob: 0, twoHand: false, hideWeapon: true },
    { lean: 3, bob: 0, twoHand: false, hideWeapon: true },
    { lean: 1, bob: 0, twoHand: false, hideWeapon: true },
  ];
  return melee[k] || melee[5];
}

const ENEMY_TAGS = [
  { name: 'idle', from: 0, to: 3 },
  { name: 'walk', from: 4, to: 9 },
  { name: 'aim', from: 10, to: 11 },
  { name: 'shoot', from: 12, to: 13 },
  { name: 'crouch', from: 14, to: 15 },
  { name: 'hurt', from: 16, to: 17 },
  { name: 'death', from: 18, to: 23 },
];

function enemyFrame(spec, i) {
  if (i < 4) {
    const bob = [0, 1, 1, 0][i];
    return { kind: 'idle', bob, lean: 0, twoHand: spec.twoHand };
  }
  if (i < 10) {
    const p = ((i - 4) / 6) * Math.PI * 2;
    return { kind: 'run', phase: p, bob: Math.abs(Math.sin(p)) > 0.5 ? 1 : 0, lean: 1, twoHand: spec.twoHand };
  }
  if (i < 12) {
    return { kind: 'idle', bob: 0, lean: 0, recoil: i - 10, twoHand: true };
  }
  if (i < 14) {
    return { kind: 'idle', bob: 0, lean: -1, recoil: [1, 2][i - 12], twoHand: true };
  }
  if (i < 16) {
    return { kind: 'idle', crouch: true, bob: 0, twoHand: true };
  }
  if (i < 18) {
    const k = i - 16;
    return { kind: 'hurt', bob: 1 + k, lean: -2 - k, twoHand: spec.twoHand };
  }
  return { kind: 'death', stage: i - 18 };
}

const BOSS_TAGS = [
  { name: 'idle', from: 0, to: 3 },
  { name: 'walk', from: 4, to: 7 },
  { name: 'gatling', from: 8, to: 11 },
  { name: 'charge', from: 12, to: 13 },
  { name: 'hurt', from: 14, to: 15 },
  { name: 'death', from: 16, to: 21 },
];

function bossFrame(spec, i) {
  if (i < 4) {
    const bob = [0, 1, 1, 0][i];
    return { kind: 'idle', bob, lean: 0, twoHand: true };
  }
  if (i < 8) {
    const p = ((i - 4) / 4) * Math.PI * 2;
    return { kind: 'walk', phase: p, bob: Math.abs(Math.sin(p)) > 0.5 ? 1 : 0, lean: 1, twoHand: true };
  }
  if (i < 12) {
    const k = i - 8;
    return { kind: 'idle', bob: 0, lean: -1, recoil: [0, 2, 3, 1][k], twoHand: true };
  }
  if (i < 14) {
    return { kind: 'charge', bob: 0, lean: 4 + (i - 12) * 2, twoHand: true };
  }
  if (i < 16) {
    const k = i - 14;
    return { kind: 'hurt', bob: 1 + k, lean: -3 - k, twoHand: true };
  }
  return { kind: 'death', stage: i - 16 };
}

// ------------------------------------------------------------
// 生成 + 输出
// ------------------------------------------------------------
function makeSheet(name, frameSize, tags, drawFrame) {
  const count = tags[tags.length - 1].to + 1;
  const canvas = createCanvas(frameSize * count, frameSize);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(i * frameSize, 0);
    drawFrame(ctx, i);
    ctx.restore();
  }

  const png = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(ASSETS, `${name}.png`), png);

  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      filename: `${name}_${i}.png`,
      frame: { x: i * frameSize, y: 0, w: frameSize, h: frameSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameSize, h: frameSize },
      sourceSize: { w: frameSize, h: frameSize },
      duration: 100,
    });
  }
  const json = {
    frames,
    meta: {
      app: 'neon-huntdown-sprite-forge',
      version: '2.0',
      image: `${name}.png`,
      format: 'RGBA8888',
      size: { w: frameSize * count, h: frameSize },
      scale: '1',
      frameTags: tags.map((t) => ({ ...t, direction: 'forward' })),
      layers: [{ name: 'default', opacity: 255, blendMode: 'normal' }],
    },
  };
  fs.writeFileSync(path.join(ASSETS, `${name}.json`), JSON.stringify(json, null, 2));
  console.log(`${name}: ${count} frames, ${frameSize}x${frameSize}`);
}

function renderHumanSheet(name, spec) {
  makeSheet(name, 64, PLAYER_TAGS, (ctx, i) => {
    const pose = playerFrame(spec, i);
    if (pose.kind === 'death') drawHumanDeath(ctx, spec, pose.stage);
    else drawHuman(ctx, spec, pose);
  });
}

function renderEnemySheet(name, spec) {
  makeSheet(name, 64, ENEMY_TAGS, (ctx, i) => {
    const pose = enemyFrame(spec, i);
    if (pose.kind === 'death') drawHumanDeath(ctx, spec, pose.stage);
    else drawHuman(ctx, spec, pose);
  });
}

function renderBossSheet(name, spec) {
  makeSheet(name, 112, BOSS_TAGS, (ctx, i) => {
    const pose = bossFrame(spec, i);
    if (pose.kind === 'death') drawBossDeath(ctx, spec, pose.stage);
    else drawBoss(ctx, spec, pose);
  });
}

fs.mkdirSync(ASSETS, { recursive: true });
renderHumanSheet('player', SPECS.player);
for (const [name, spec] of Object.entries(SPECS)) {
  if (name === 'player') continue;
  renderEnemySheet(name, spec);
}
for (const [name, spec] of Object.entries(BOSS_SPECS)) {
  renderBossSheet(name, spec);
}

console.log('done');
