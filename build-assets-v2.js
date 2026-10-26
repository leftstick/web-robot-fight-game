// build-assets-v2.js —— 1px 像素网格美术资产生成器
// 用法：
//   node build-assets-v2.js bg       只生成背景
//   node build-assets-v2.js props    只生成掩体
//   node build-assets-v2.js chars    只生成角色
//   node build-assets-v2.js all      全部
// 依赖：@napi-rs/canvas（避免 node-canvas 原生编译）

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const H = 270;
const TILE = 576;
const GROUND = 235;

// ============================================================
// 通用工具
// ============================================================
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function canvas(w, h) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function savePNG(c, name) {
  fs.writeFileSync(path.join(OUT, name + '.png'), c.toBuffer('image/png'));
  console.log('  ✓', name + '.png', c.width + 'x' + c.height);
}

function makeAsepriteJSON(frameW, frameH, count, tags, prefix) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      filename: (prefix || i) + '_' + i + '.png',
      frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
      sourceSize: { w: frameW, h: frameH },
      duration: 100,
    });
  }
  return {
    frames,
    meta: {
      app: 'neon-huntdown-build-v2',
      version: '2.0',
      image: '',
      format: 'RGBA8888',
      size: { w: frameW * count, h: frameH },
      scale: '1',
      frameTags: tags || [],
      layers: [{ name: 'default', opacity: 255, blendMode: 'normal' }],
    },
  };
}

function saveSheet(c, json, name) {
  fs.writeFileSync(path.join(OUT, name + '.png'), c.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(json, null, 2));
  console.log('  ✓', name + '.png', c.width + 'x' + c.height, '(' + json.frames.length + ' frames)');
}

// 固定种子随机，保证每次构建一致
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex2rgb(hex) {
  const s = hex.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function mix(c1, c2, t) {
  const a = hex2rgb(c1), b = hex2rgb(c2);
  return rgb2hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
function rgba(hex, a) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amt) {
  const [r, g, b] = hex2rgb(hex);
  return rgb2hex(r + amt, g + amt, b + amt);
}

// 1px 直线（Bresenham）
function line(ctx, x0, y0, x1, y1, color, skip = 0) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  ctx.fillStyle = color;
  while (guard++ < 2000) {
    if (skip <= 0) ctx.fillRect(x0, y0, 1, 1);
    else skip--;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 像素圆（扫描线）
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (w >= 0) ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function glow(ctx, cx, cy, r, color, alpha) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function fogBand(ctx, y0, y1, color) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, 0.42));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, TILE, y1 - y0);
}

function cable(ctx, x0, y0, x1, y1, sag, color) {
  const steps = Math.max(24, Math.abs(x1 - x0));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

// 3x5 像素字形，用于霓虹招牌
const GLYPHS = [
  [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
  [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
  [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
  [1,1,1, 0,0,1, 0,1,1, 0,0,1, 1,1,1],
  [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
  [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
  [0,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
];
function glyph(ctx, x, y, pattern, color, step = 2) {
  ctx.fillStyle = color;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (pattern[r * 3 + c]) ctx.fillRect(x + c * step, y + r * step, step - 1, step - 1);
    }
  }
}

// ============================================================
// 背景色板
// ============================================================
const BG_PALETTES = {
  1: {
    top: '#04030c', mid: '#120a25', low: '#2a1138', horizon: '#56205a',
    moon: '#ffe9c9', moonShade: '#c9a7a8', star: '#bcd8ff',
    far: '#0c0917', farEdge: '#241333', farWin: '#6f5a92', farLit: '#ffb86b',
    mid: '#0f1122', midWall: '#171a30', midEdge: '#2c3452', midWin: '#232238',
    litWarm: '#ffc46b', litCool: '#59e6ff',
    near: '#090a12', nearWall: '#141623', nearEdge: '#2b3247',
    neonA: '#ff2e88', neonB: '#00e5ff', neonC: '#ffb347',
    road: '#11111a', roadLight: '#2c2d3d', fog: '#5a246e', curb: '#3a3e50',
  },
  2: {
    top: '#01060b', mid: '#04161f', low: '#082a33', horizon: '#0d4650',
    moon: '#d8fff4', moonShade: '#8fc9bd', star: '#b8f3ff',
    far: '#061018', farEdge: '#0e2a33', farWin: '#3a7a80', farLit: '#ffb257',
    mid: '#081420', midWall: '#0d1e28', midEdge: '#1c3a44', midWin: '#142c34',
    litWarm: '#ffb257', litCool: '#45f0d0',
    near: '#050d12', nearWall: '#0c171d', nearEdge: '#213b42',
    neonA: '#2ee6c8', neonB: '#3d8bff', neonC: '#ffa93d',
    road: '#0b1114', roadLight: '#25383b', fog: '#0e4a55', curb: '#31484d',
  },
  3: {
    top: '#070104', mid: '#1a0510', low: '#360812', horizon: '#6a1220',
    moon: '#ffd7c2', moonShade: '#c47a6a', star: '#ffc9b8',
    far: '#12060a', farEdge: '#2e0c16', farWin: '#7c3540', farLit: '#ff7a2e',
    mid: '#180811', midWall: '#220b16', midEdge: '#462030', midWin: '#341522',
    litWarm: '#ff8a3d', litCool: '#ff4d6a',
    near: '#0e0508', nearWall: '#1a0a10', nearEdge: '#40202c',
    neonA: '#ff2e4a', neonB: '#a848ff', neonC: '#ff7a2e',
    road: '#150a0d', roadLight: '#34202a', fog: '#5a1420', curb: '#4a3038',
  },
};

// ============================================================
// 背景层：sky
// ============================================================
function buildSky(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);

  // 分层渐变（逐行，无平滑插值）
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let col;
    if (t < 0.50) col = mix(P.top, P.mid, t / 0.50);
    else if (t < 0.78) col = mix(P.mid, P.low, (t - 0.50) / 0.28);
    else col = mix(P.low, P.horizon, (t - 0.78) / 0.22);
    px(ctx, 0, y, TILE, 1, col);
    // 横向色带抖动
    if (y % 3 === 0) {
      const band = mix(col, '#ffffff', 0.025);
      for (let x = 0; x < TILE; x += 7) {
        if (rnd() < 0.35) px(ctx, x, y, 1, 1, band);
      }
    }
  }

  // 星星
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = Math.floor(rnd() * 190);
    const a = 0.25 + rnd() * 0.65;
    const col = rgba(P.star, a);
    px(ctx, x, y, 1, 1, col);
    if (rnd() < 0.08) {
      px(ctx, x - 1, y, 3, 1, rgba(P.star, a * 0.35));
      px(ctx, x, y - 1, 1, 3, rgba(P.star, a * 0.35));
    }
  }

  // 远处云带
  for (let i = 0; i < 7; i++) {
    const y = 92 + Math.floor(rnd() * 78);
    const w = 60 + Math.floor(rnd() * 150);
    const x = Math.floor(rnd() * TILE);
    const col = mix(P.low, P.mid, 0.45 + rnd() * 0.3);
    px(ctx, x, y, w, 1, rgba(col, 0.55));
    px(ctx, x + 8, y + 1, w - 22, 1, rgba(col, 0.32));
    px(ctx, x + 22, y - 1, w - 44, 1, rgba(P.horizon, 0.22));
  }

  // 月亮（带光晕与环形山）
  const mx = 438, my = 54, mr = 19;
  glow(ctx, mx, my, 52, P.moon, 0.10);
  glow(ctx, mx, my, 30, P.moon, 0.16);
  disc(ctx, mx, my, mr, P.moon);
  // 月海 / 环形山
  disc(ctx, mx - 5, my - 3, 4, P.moonShade);
  disc(ctx, mx + 5, my + 5, 3, P.moonShade);
  disc(ctx, mx + 2, my - 8, 2, P.moonShade);
  disc(ctx, mx - 9, my + 7, 2, P.moonShade);
  // 边缘暗部
  for (let y = -mr; y <= mr; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, mr * mr - y * y)));
    px(ctx, mx - w, my + y, 1, 1, rgba(P.moonShade, 0.5));
    px(ctx, mx + w, my + y, 1, 1, rgba(P.moonShade, 0.35));
  }
  // 月晕颗粒
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = mr + 3 + rnd() * 10;
    px(ctx, Math.round(mx + Math.cos(a) * r), Math.round(my + Math.sin(a) * r), 1, 1, rgba(P.moon, 0.18));
  }

  // 城市上空的霓虹尘雾
  const g = ctx.createLinearGradient(0, 160, 0, 235);
  g.addColorStop(0, rgba(P.fog, 0));
  g.addColorStop(0.65, rgba(P.fog, 0.16));
  g.addColorStop(1, rgba(P.horizon, 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, 160, TILE, 75);

  return c;
}

// ============================================================
// 背景层：far —— 巨型城市剪影
// ============================================================
function buildFar(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);

  // 地平线雾
  const hg = ctx.createLinearGradient(0, 150, 0, 236);
  hg.addColorStop(0, rgba(P.horizon, 0));
  hg.addColorStop(1, rgba(P.horizon, 0.42));
  ctx.fillStyle = hg;
  ctx.fillRect(0, 150, TILE, 86);

  let x = -20;
  while (x < TILE) {
    const w = 24 + Math.floor(rnd() * 48);
    const h = 58 + Math.floor(rnd() * 100);
    const y = 236 - h;
    const body = mix(P.far, P.farEdge, 0.15 + rnd() * 0.4);
    const edge = mix(P.farEdge, P.farWin, 0.18);

    // 主楼
    px(ctx, x, y, w, h, body);
    // 顶部退台
    if (rnd() < 0.55) {
      const tw = Math.max(8, Math.floor(w * 0.55));
      px(ctx, x + Math.floor((w - tw) / 2), y - 8, tw, 8, body);
      px(ctx, x + Math.floor((w - tw) / 2), y - 8, tw, 1, edge);
    }
    // 天线
    if (rnd() < 0.6) {
      const ax = x + Math.floor(w * 0.5);
      const ah = 10 + Math.floor(rnd() * 22);
      px(ctx, ax, y - ah, 1, ah, edge);
      if (rnd() < 0.5) px(ctx, ax - 3, y - ah + 4, 7, 1, rgba(P.neonA, 0.35));
      px(ctx, ax, y - ah - 1, 1, 1, rnd() < 0.5 ? P.neonA : P.litWarm);
    }
    // 侧面轮廓光
    px(ctx, x + w - 1, y + 2, 1, h - 2, edge);

    // 窗户（1px，远景只保留少量亮窗）
    for (let wy = y + 7; wy < 230; wy += 5) {
      for (let wx = x + 3; wx < x + w - 3; wx += 4) {
        const r = rnd();
        if (r < 0.07) px(ctx, wx, wy, 1, 1, rgba(P.farLit, 0.75));
        else if (r < 0.22) px(ctx, wx, wy, 1, 1, rgba(P.farWin, 0.55));
        else if (r < 0.32) px(ctx, wx, wy, 1, 1, rgba(P.farEdge, 0.5));
      }
    }

    // 屋顶设备
    if (rnd() < 0.45) {
      const rx = x + 4 + Math.floor(rnd() * Math.max(1, w - 14));
      px(ctx, rx, y - 6, 9, 5, mix(body, edge, 0.4));
      px(ctx, rx + 1, y - 7, 2, 1, edge);
    }

    x += w + 2 + Math.floor(rnd() * 7);
  }

  // 巨型全息广告牌
  const bx = 238, by = 72, bw = 62, bh = 34;
  glow(ctx, bx + bw / 2, by + bh / 2, 62, P.neonB, 0.16);
  px(ctx, bx - 2, by - 2, bw + 4, bh + 4, '#05030a');
  px(ctx, bx, by, bw, bh, mix(P.far, P.neonB, 0.12));
  px(ctx, bx, by, bw, 1, rgba(P.neonB, 0.85));
  px(ctx, bx, by + bh - 1, bw, 1, rgba(P.neonA, 0.5));
  // 屏幕扫描线 + 字形
  for (let sy = by + 4; sy < by + bh - 3; sy += 4) {
    px(ctx, bx + 3, sy, bw - 6, 1, rgba(P.neonB, 0.08));
  }
  glyph(ctx, bx + 10, by + 8, GLYPHS[2], P.neonB, 2);
  glyph(ctx, bx + 22, by + 8, GLYPHS[5], P.neonA, 2);
  glyph(ctx, bx + 34, by + 8, GLYPHS[0], P.litWarm, 2);
  glyph(ctx, bx + 46, by + 8, GLYPHS[3], P.neonB, 2);
  px(ctx, bx + 8, by + 24, 32, 1, rgba(P.neonB, 0.55));
  px(ctx, bx + 8, by + 27, 18, 1, rgba(P.neonA, 0.5));
  // 支架
  px(ctx, bx + 8, by + bh, 2, 40, '#05030a');
  px(ctx, bx + bw - 10, by + bh, 2, 40, '#05030a');

  // 近地面亮窗零星
  for (let i = 0; i < 60; i++) {
    const wx = Math.floor(rnd() * TILE);
    const wy = 180 + Math.floor(rnd() * 48);
    if (rnd() < 0.4) px(ctx, wx, wy, 1, 1, rgba(P.farLit, 0.35 + rnd() * 0.3));
  }

  fogBand(ctx, 175, 236, P.fog);
  return c;
}

// ============================================================
// 背景层：mid —— 中景楼体、招牌、管线
// ============================================================
function buildMid(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);

  // 远景底色楼群，增加层次
  let bx = -12;
  while (bx < TILE) {
    const bw = 40 + Math.floor(rnd() * 54);
    const bh = 62 + Math.floor(rnd() * 72);
    const by = 236 - bh;
    px(ctx, bx, by, bw, bh, mix(P.mid, P.midWall, 0.55));
    for (let wy = by + 8; wy < 228; wy += 7) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) {
        if (rnd() < 0.10) px(ctx, wx, wy, 2, 2, rgba(P.litCool, 0.45));
        else if (rnd() < 0.12) px(ctx, wx, wy, 2, 2, rgba(P.litWarm, 0.32));
      }
    }
    bx += bw + Math.floor(rnd() * 9);
  }

  // 中景主楼
  const buildings = [];
  let x = -18;
  while (x < TILE + 40) {
    const w = 46 + Math.floor(rnd() * 50);
    const h = 78 + Math.floor(rnd() * 92);
    buildings.push({ x, w, h, y: 236 - h, seed: Math.floor(rnd() * 9999) });
    x += w + 3 + Math.floor(rnd() * 12);
  }

  for (const b of buildings) {
    const r2 = rng(b.seed);
    const wall = mix(P.midWall, P.midEdge, 0.15 + r2() * 0.5);
    const dark = mix(P.mid, wall, 0.55);
    // 楼梯井 / 主墙体
    px(ctx, b.x, b.y, b.w, b.h, wall);
    px(ctx, b.x, b.y, 2, b.h, dark);
    px(ctx, b.x + b.w - 2, b.y, 2, b.h, shade(wall, 8));
    px(ctx, b.x, b.y, b.w, 1, mix(P.midEdge, P.neonB, 0.16));
    // 楼层分隔
    for (let fy = b.y + 10; fy < 230; fy += 12) {
      px(ctx, b.x + 3, fy, b.w - 6, 1, rgba(P.mid, 0.55));
    }
    // 窗户
    for (let wy = b.y + 6; wy < 226; wy += 7) {
      for (let wx = b.x + 5; wx < b.x + b.w - 6; wx += 6) {
        const r = r2();
        if (r < 0.14) {
          px(ctx, wx - 1, wy - 1, 4, 4, rgba('#05040a', 0.85));
          px(ctx, wx, wy, 2, 2, r2() < 0.5 ? P.litWarm : P.litCool);
          if (r2() < 0.25) glow(ctx, wx + 1, wy + 1, 8, r2() < 0.5 ? P.litWarm : P.litCool, 0.10);
        } else if (r < 0.38) {
          px(ctx, wx - 1, wy - 1, 4, 4, rgba('#05040a', 0.8));
          px(ctx, wx, wy, 2, 2, rgba(P.midWin, 0.9));
        } else {
          px(ctx, wx - 1, wy - 1, 4, 4, rgba(P.mid, 0.55));
          px(ctx, wx, wy, 2, 2, rgba('#05040a', 0.55));
        }
      }
    }
    // 屋顶水箱 / 空调
    if (r2() < 0.7) {
      const tx = b.x + 6 + Math.floor(r2() * Math.max(1, b.w - 30));
      px(ctx, tx, b.y - 11, 14, 10, shade(wall, -10));
      px(ctx, tx, b.y - 12, 14, 2, mix(wall, P.midEdge, 0.5));
      px(ctx, tx + 3, b.y - 3, 2, 4, '#07060d');
      px(ctx, tx + 9, b.y - 3, 2, 4, '#07060d');
      px(ctx, tx + 1, b.y - 9, 1, 7, rgba(P.midEdge, 0.7));
    }
    // 外挂空调
    for (let k = 0; k < 2; k++) {
      if (r2() < 0.6) {
        const ax = b.x + 4 + Math.floor(r2() * Math.max(1, b.w - 12));
        const ay = b.y + 16 + Math.floor(r2() * Math.max(1, b.h - 40));
        px(ctx, ax, ay, 9, 7, mix(P.mid, P.midEdge, 0.7));
        px(ctx, ax + 1, ay + 1, 7, 5, '#0a0912');
        for (let gx = 0; gx < 6; gx += 2) px(ctx, ax + 2 + gx, ay + 2, 1, 3, rgba(P.midEdge, 0.8));
      }
    }
    // 防火梯
    if (r2() < 0.45) {
      const fx = b.x + 8 + Math.floor(r2() * Math.max(1, b.w - 20));
      for (let fy = b.y + 24; fy < 232; fy += 14) {
        px(ctx, fx, fy, 18, 1, rgba(P.midEdge, 0.8));
        px(ctx, fx + 2, fy, 1, 11, rgba(P.midEdge, 0.55));
        px(ctx, fx + 16, fy, 1, 11, rgba(P.midEdge, 0.55));
      }
    }
    // 楼顶轮廓光
    px(ctx, b.x, b.y, Math.max(4, b.w - 8), 1, rgba(P.neonB, 0.20));
  }

  // 霓虹竖招牌（带烘焙辉光）
  const signDefs = [
    { x: 78, y: 96, color: P.neonA, glyph: GLYPHS[1] },
    { x: 354, y: 118, color: P.neonB, glyph: GLYPHS[4] },
    { x: 500, y: 86, color: P.neonC, glyph: GLYPHS[2] },
  ];
  for (const s of signDefs) {
    const sw = 13, sh = 44;
    px(ctx, s.x - 2, s.y - 2, sw + 4, sh + 4, '#06040a');
    px(ctx, s.x, s.y, sw, sh, mix('#06040a', s.color, 0.28));
    px(ctx, s.x, s.y, 1, sh, s.color);
    px(ctx, s.x + sw - 1, s.y, 1, sh, s.color);
    glyph(ctx, s.x + 3, s.y + 5, s.glyph, s.color, 2);
    glyph(ctx, s.x + 3, s.y + 17, GLYPHS[(s.glyph[1] + 3) % GLYPHS.length], s.color, 2);
    glyph(ctx, s.x + 3, s.y + 29, GLYPHS[(s.glyph[3] + 5) % GLYPHS.length], s.color, 2);
    glow(ctx, s.x + sw / 2, s.y + sh / 2, 48, s.color, 0.22);
    // 支架
    px(ctx, s.x + 2, s.y + sh, 2, 24, '#06040a');
    px(ctx, s.x + sw - 4, s.y + sh, 2, 24, '#06040a');
  }

  // 横跨楼体的管线 / 电缆
  line(ctx, 0, 176, 160, 174, rgba(P.midEdge, 0.8));
  line(ctx, 160, 174, 320, 178, rgba(P.midEdge, 0.8));
  line(ctx, 320, 178, 576, 175, rgba(P.midEdge, 0.8));
  for (let cx = 20; cx < 560; cx += 42) {
    px(ctx, cx, Math.round(176 + Math.sin(cx / 70) * 2), 1, 1, rgba(P.neonB, 0.4));
  }
  cable(ctx, 0, 196, 190, 190, 12, rgba('#05040a', 0.85));
  cable(ctx, 390, 192, 576, 198, 10, rgba('#05040a', 0.85));

  fogBand(ctx, 168, 236, P.fog);
  return c;
}

// ============================================================
// 背景层：near —— 街面店招、灯柱、围栏
// ============================================================
function buildNear(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);
  const BASE = 236;

  // 连续暗墙：保证街道底部不会露出中景楼体
  px(ctx, 0, 198, TILE, BASE - 198, mix(P.near, P.nearWall, 0.55));
  px(ctx, 0, 198, TILE, 1, rgba('#000000', 0.45));

  // 临街建筑：不同屋顶高度 + 不同店面，制造中景与近景之间的第三层
  const bays = [
    { x: -10, w: 112, top: 176, tone: 0 }, // 拉面馆：暖光橱窗 + 红灯笼
    { x: 100, w: 90, top: 189, tone: 1 },  // 卷帘门 + 涂鸦
    { x: 196, w: 126, top: 170, tone: 2 }, // 游戏厅：冷色灯箱 + 竖向招牌
    { x: 320, w: 94, top: 192, tone: 3 },  // 设备墙 + 铁栅栏
    { x: 414, w: 108, top: 180, tone: 4 }, // 酒吧：品红雨棚
    { x: 520, w: 66, top: 174, tone: 5 },  // 砖楼转角 + 防火梯
  ];

  for (let bi = 0; bi < bays.length; bi++) {
    const b = bays[bi];
    const wall = mix(P.nearWall, P.nearEdge, 0.28 + (bi % 3) * 0.10);
    const wallDark = mix(wall, '#000000', 0.38);
    const wallLit = mix(wall, '#ffffff', 0.06);

    // 主体
    px(ctx, b.x, b.top, b.w, BASE - b.top, wall);
    px(ctx, b.x, b.top, 2, BASE - b.top, wallDark);
    px(ctx, b.x + b.w - 2, b.top, 2, BASE - b.top, wallLit);
    // 屋顶压顶石与霓虹檐口
    px(ctx, b.x - 1, b.top - 2, b.w + 2, 3, mix(wall, P.nearEdge, 0.55));
    px(ctx, b.x - 1, b.top - 2, b.w + 2, 1, rgba(P.neonB, 0.16));
    px(ctx, b.x + 1, b.top + 1, b.w - 2, 1, rgba('#000000', 0.42));

    // 砖缝 / 楼层线
    for (let y = b.top + 8; y < 204; y += 5) {
      for (let x = b.x + ((y % 10) ? 3 : 8); x < b.x + b.w - 3; x += 13) {
        px(ctx, x, y, 7, 1, rgba('#000000', 0.18));
      }
    }
    for (let fy = b.top + 16; fy < 205; fy += 13) {
      px(ctx, b.x + 3, fy, b.w - 6, 1, rgba(P.near, 0.50));
    }

    // 上层窗户：不统一，偶尔亮灯
    for (let wy = b.top + 7; wy < 199; wy += 12) {
      for (let wx = b.x + 7; wx < b.x + b.w - 9; wx += 10) {
        const r = rnd();
        px(ctx, wx - 1, wy - 1, 7, 6, rgba('#04040a', 0.62));
        if (r < 0.17) {
          const warm = r < 0.09;
          px(ctx, wx, wy, 5, 4, warm ? P.litWarm : P.litCool);
          px(ctx, wx, wy, 1, 4, rgba('#ffffff', 0.28));
          px(ctx, wx + 1, wy + 2, 3, 1, rgba('#000000', 0.25));
          if (r < 0.05) glow(ctx, wx + 2, wy + 2, 9, warm ? P.litWarm : P.litCool, 0.10);
        } else {
          px(ctx, wx, wy, 5, 4, mix(P.nearWall, '#000000', 0.25));
          px(ctx, wx + 1, wy + 1, 3, 1, rgba(P.nearEdge, 0.28));
        }
      }
    }

    // 外挂空调 / 立管
    if (bi % 2 === 0) {
      const ax = b.x + b.w - 18;
      const ay = b.top + 21;
      px(ctx, ax, ay, 11, 8, mix(wallDark, P.nearEdge, 0.5));
      px(ctx, ax + 1, ay + 1, 9, 6, '#07070d');
      for (let gx = ax + 3; gx < ax + 10; gx += 2) px(ctx, gx, ay + 2, 1, 4, rgba(P.nearEdge, 0.8));
      px(ctx, ax + 2, ay + 8, 1, 4, '#07070d');
      px(ctx, ax + 8, ay + 8, 1, 4, '#07070d');
    }
    const pipeX = b.x + (bi % 2 === 0 ? 4 : b.w - 5);
    px(ctx, pipeX, b.top + 4, 2, BASE - b.top - 6, '#08070c');
    px(ctx, pipeX, b.top + 4, 1, BASE - b.top - 6, rgba(P.nearEdge, 0.55));
    for (let py = b.top + 18; py < 232; py += 22) {
      px(ctx, pipeX - 1, py, 4, 1, rgba('#000000', 0.55));
    }

    // 店面层
    if (b.tone === 0) {
      // 拉面馆：暖黄橱窗 + 布帘 + 灯笼
      const sx = b.x + 9;
      const sw = b.w - 22;
      px(ctx, sx, 207, sw, 27, '#07060a');
      px(ctx, sx + 2, 209, sw - 4, 20, rgba('#25170e', 0.95));
      px(ctx, sx + 2, 209, sw - 4, 2, rgba(P.litWarm, 0.55));
      // 吧台与座位剪影
      px(ctx, sx + 4, 222, sw - 8, 5, '#0a0707');
      for (let ix = sx + 6; ix < sx + sw - 5; ix += 8) {
        px(ctx, ix, 213, 3, 7, rgba('#08060a', 0.9));
        px(ctx, ix + 1, 212, 1, 1, rgba(P.litWarm, 0.5));
      }
      // 竖向暖光条
      for (let lx = sx + 4; lx < sx + sw - 4; lx += 12) {
        px(ctx, lx, 209, 1, 18, rgba(P.litWarm, 0.18));
      }
      // 门帘
      for (let fx = sx + sw - 15; fx < sx + sw - 2; fx += 4) {
        px(ctx, fx, 207, 3, 6, rgba(P.neonA, 0.55));
        px(ctx, fx + 1, 213, 1, 2, rgba(P.neonA, 0.28));
      }
      for (let lx = sx + 1; lx < sx + sw - 2; lx += 7) {
        px(ctx, lx, 207, 4, 1, rgba(P.litWarm, 0.42));
      }
      px(ctx, sx, 234, sw, 1, rgba(P.litWarm, 0.22));
      // 灯笼
      for (const lx of [b.x + 4, b.x + b.w - 8]) {
        px(ctx, lx, 205, 4, 5, P.neonA);
        px(ctx, lx + 1, 206, 2, 3, '#ffd0a0');
        px(ctx, lx + 1, 210, 2, 1, '#3a0a18');
        glow(ctx, lx + 2, 208, 13, P.neonA, 0.18);
      }
    } else if (b.tone === 1) {
      // 卷帘门 + 侧门 + 涂鸦
      const dx = b.x + 8;
      const dw = b.w - 28;
      px(ctx, dx, 211, dw, 23, '#08070c');
      for (let sy = 213; sy < 233; sy += 2) {
        px(ctx, dx + 1, sy, dw - 2, 1, rgba(wall, 0.42));
        if ((sy - 213) % 6 === 0) px(ctx, dx + 3, sy, dw - 6, 1, rgba('#000000', 0.35));
      }
      px(ctx, dx, 211, dw, 1, rgba(P.neonB, 0.38));
      px(ctx, dx + dw - 3, 220, 1, 9, '#1a1a24');
      // 涂鸦
      line(ctx, dx + 5, 227, dx + 12, 220, rgba(P.neonA, 0.45));
      line(ctx, dx + 12, 220, dx + 20, 226, rgba(P.neonA, 0.35));
      line(ctx, dx + 8, 224, dx + 17, 224, rgba(P.neonB, 0.30));
      // 侧门与台阶
      px(ctx, b.x + b.w - 18, 216, 12, 18, '#05050a');
      px(ctx, b.x + b.w - 17, 218, 10, 15, rgba(P.litCool, 0.08));
      px(ctx, b.x + b.w - 19, 233, 15, 2, mix(P.curb, '#000000', 0.35));
    } else if (b.tone === 2) {
      // 游戏厅：冷色灯箱 + 海报墙
      const sx = b.x + 8;
      const sw = b.w - 24;
      px(ctx, sx, 206, sw, 28, '#06050b');
      px(ctx, sx + 1, 208, sw - 2, 24, rgba('#07141c', 0.95));
      for (let lx = sx + 4; lx < sx + sw - 4; lx += 9) {
        px(ctx, lx, 209, 1, 21, rgba(P.neonB, 0.30));
        px(ctx, lx + 1, 213, 4, 7, rgba('#05050a', 0.55));
      }
      for (let lx = sx + 1; lx < sx + sw - 2; lx += 8) {
        px(ctx, lx, 209, 5, 1, rgba(P.neonB, 0.55));
      }
      px(ctx, sx, 208, 2, 23, rgba(P.neonB, 0.25));
      // 门头灯箱
      px(ctx, sx + 2, 204, sw - 4, 4, mix(P.neonB, '#000000', 0.25));
      px(ctx, sx + 4, 205, sw - 8, 1, rgba(P.neonB, 0.55));
      for (let lx = sx + 4; lx < sx + sw - 6; lx += 11) {
        px(ctx, lx, 205, 1, 3, rgba('#05050a', 0.6));
      }
      glyph(ctx, sx + 6, 205, GLYPHS[5], '#7ff6ff', 1);
      glow(ctx, sx + sw / 2, 206, 22, P.neonB, 0.12);
    } else if (b.tone === 3) {
      // 设备墙：栅栏 + 配电箱 + 管线
      for (let fy = 215; fy < 233; fy += 3) {
        for (let fx = b.x + 6; fx < b.x + b.w - 8; fx += 4) {
          px(ctx, fx + (((fy / 3) | 0) % 2 ? 2 : 0), fy, 2, 1, rgba('#06050a', 0.75));
        }
      }
      px(ctx, b.x + 5, 214, b.w - 10, 1, '#05050a');
      px(ctx, b.x + 5, 233, b.w - 10, 1, '#05050a');
      const boxX = b.x + b.w - 34;
      px(ctx, boxX, 216, 18, 14, '#0a0a11');
      px(ctx, boxX + 1, 217, 16, 12, '#161822');
      px(ctx, boxX + 3, 219, 5, 2, rgba(P.litWarm, 0.65));
      px(ctx, boxX + 3, 223, 8, 1, rgba(P.litCool, 0.35));
      px(ctx, boxX + 12, 219, 1, 8, '#05050a');
      px(ctx, boxX + 15, 219, 1, 8, '#05050a');
    } else if (b.tone === 4) {
      // 酒吧：品红雨棚 + 玻璃门 + 霓虹杯
      const sx = b.x + 9;
      const sw = b.w - 22;
      px(ctx, sx, 208, sw, 26, '#07060a');
      px(ctx, sx + 2, 210, sw - 4, 20, rgba('#140a17', 0.95));
      px(ctx, sx + 2, 210, sw - 4, 1, rgba(P.neonA, 0.55));
      for (let lx = sx + 4; lx < sx + sw - 4; lx += 6) {
        px(ctx, lx, 213, 1, 13, rgba(P.neonA, 0.12));
      }
      // 吧台剪影
      px(ctx, sx + 4, 224, sw - 8, 4, '#08050b');
      px(ctx, sx + 8, 218, 3, 6, rgba('#05040a', 0.75));
      px(ctx, sx + 20, 218, 2, 6, rgba('#05040a', 0.75));
      px(ctx, sx + sw - 14, 219, 8, 10, rgba('#05040a', 0.8));
      // 雨棚：品红/黑条纹
      const aw = b.w - 14;
      const ax = b.x + 7;
      for (let fx = 0; fx < aw; fx += 8) {
        px(ctx, ax + fx, 203, 4, 5, mix(P.neonA, '#320a1d', 0.35));
        px(ctx, ax + fx + 4, 203, 4, 5, mix(P.nearWall, '#000000', 0.45));
      }
      px(ctx, ax, 203, aw, 1, rgba(P.neonA, 0.42));
      px(ctx, ax + 2, 208, aw - 4, 1, rgba('#000000', 0.55));
      // 霓虹杯招牌
      px(ctx, b.x + 3, 198, 5, 6, '#05040a');
      px(ctx, b.x + 4, 199, 3, 4, P.neonA);
      glow(ctx, b.x + 5, 201, 14, P.neonA, 0.20);
    } else {
      // 砖楼转角：防火梯 + 暖窗
      const fx = b.x + 8;
      for (let fy = b.top + 18; fy < 231; fy += 14) {
        px(ctx, fx, fy, 22, 1, 'rgba(20,20,30,0.9)');
        px(ctx, fx + 2, fy, 1, 12, 'rgba(20,20,30,0.75)');
        px(ctx, fx + 20, fy, 1, 12, 'rgba(20,20,30,0.75)');
        px(ctx, fx + 2, fy + 12, 19, 1, 'rgba(10,10,16,0.85)');
        px(ctx, fx + 4, fy + 1, 4, 1, rgba(P.litWarm, 0.20));
      }
      px(ctx, b.x + b.w - 24, 212, 15, 22, '#07070c');
      px(ctx, b.x + b.w - 23, 214, 13, 17, rgba(P.litWarm, 0.10));
      px(ctx, b.x + b.w - 23, 214, 13, 1, rgba(P.litWarm, 0.55));
      // 屋顶水箱
      px(ctx, b.x + 12, b.top - 10, 16, 9, mix(wallDark, P.nearEdge, 0.6));
      px(ctx, b.x + 12, b.top - 10, 16, 1, rgba(P.nearEdge, 0.9));
      px(ctx, b.x + 15, b.top - 1, 2, 3, '#05040a');
      px(ctx, b.x + 23, b.top - 1, 2, 3, '#05040a');
    }
  }

  // 大尺寸霓虹招牌：压在建筑外沿，跨两层
  const bladeSigns = [
    { x: 232, y: 178, w: 15, h: 44, col: P.neonA, glyph: GLYPHS[1] },
    { x: 452, y: 184, w: 14, h: 38, col: P.neonB, glyph: GLYPHS[4] },
  ];
  for (const s of bladeSigns) {
    // 支架
    px(ctx, s.x - 6, s.y + 2, 6, 1, '#05040a');
    px(ctx, s.x - 6, s.y + s.h - 4, 6, 1, '#05040a');
    px(ctx, s.x - 6, s.y + 2, 1, s.h - 5, '#05040a');
    // 灯箱
    px(ctx, s.x - 2, s.y - 2, s.w + 4, s.h + 4, '#04030a');
    px(ctx, s.x, s.y, s.w, s.h, mix('#06050b', s.col, 0.30));
    px(ctx, s.x, s.y, 1, s.h, s.col);
    px(ctx, s.x + s.w - 1, s.y, 1, s.h, s.col);
    px(ctx, s.x, s.y, s.w, 1, mix(s.col, '#ffffff', 0.35));
    glyph(ctx, s.x + 3, s.y + 4, s.glyph, s.col, 2);
    glyph(ctx, s.x + 3, s.y + 16, GLYPHS[(s.glyph[1] + 4) % GLYPHS.length], s.col, 2);
    glyph(ctx, s.x + 3, s.y + 28, GLYPHS[(s.glyph[3] + 2) % GLYPHS.length], s.col, 2);
    glow(ctx, s.x + s.w / 2, s.y + s.h / 2, 42, s.col, 0.20);
  }

  // 竖向霓虹灯带（店门边缘）
  for (const s of [{ x: 190, col: P.neonA }, { x: 410, col: P.neonB }, { x: 558, col: P.neonC }]) {
    px(ctx, s.x, 201, 2, 33, s.col);
    px(ctx, s.x - 1, 201, 4, 2, mix(s.col, '#ffffff', 0.35));
    glow(ctx, s.x + 1, 218, 30, s.col, 0.24);
  }

  // 街灯：灯柱 + 暖光锥 + 灯下广告
  for (const lx of [64, 424]) {
    const poleTop = 138;
    px(ctx, lx, poleTop, 2, 98, '#06050a');
    px(ctx, lx - 1, poleTop, 4, 1, '#181820');
    px(ctx, lx + 1, poleTop + 2, 1, 96, rgba(P.nearEdge, 0.35));
    for (let i = 0; i < 11; i++) {
      px(ctx, lx + 2 + i, poleTop + 1 + Math.round(Math.sin((i / 10) * Math.PI / 2) * 2), 1, 1, '#0a0910');
    }
    px(ctx, lx + 11, poleTop + 2, 1, 3, '#0a0910');
    px(ctx, lx + 7, poleTop + 4, 8, 2, mix(P.litWarm, '#ffffff', 0.25));
    px(ctx, lx + 8, poleTop + 6, 6, 1, rgba(P.litWarm, 0.8));
    glow(ctx, lx + 10, poleTop + 5, 44, P.litWarm, 0.28);
    const lg = ctx.createLinearGradient(0, poleTop + 6, 0, BASE);
    lg.addColorStop(0, rgba(P.litWarm, 0.18));
    lg.addColorStop(0.55, rgba(P.litWarm, 0.055));
    lg.addColorStop(1, rgba(P.litWarm, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(lx + 5, poleTop + 6);
    ctx.lineTo(lx + 15, poleTop + 6);
    ctx.lineTo(lx + 48, BASE);
    ctx.lineTo(lx - 28, BASE);
    ctx.closePath();
    ctx.fill();
    // 灯柱海报
    px(ctx, lx - 5, 198, 9, 12, '#0b0a12');
    px(ctx, lx - 4, 199, 7, 1, rgba(P.neonB, 0.55));
    px(ctx, lx - 4, 202, 5, 1, rgba(P.neonB, 0.30));
    px(ctx, lx - 4, 205, 6, 1, rgba(P.neonA, 0.32));
  }

  // 横跨街道的电缆与灯串
  cable(ctx, -10, 182, 190, 176, 10, 'rgba(3,3,8,0.9)');
  cable(ctx, 190, 176, 386, 183, 8, 'rgba(3,3,8,0.9)');
  cable(ctx, 386, 183, 586, 175, 11, 'rgba(3,3,8,0.9)');
  for (let x = 20; x < 576; x += 46) {
    const y = Math.round(179 + Math.sin(x / 61) * 3);
    px(ctx, x, y, 1, 1, rgba(P.neonB, 0.34));
    if ((x / 46) % 2 < 1) px(ctx, x - 1, y - 1, 3, 1, rgba(P.neonB, 0.12));
  }

  // 地面反光：把店面霓虹压到人行道边缘
  for (let x = 0; x < TILE; x += 17) {
    px(ctx, x, 234, 6, 1, rgba(P.neonA, 0.08));
  }
  px(ctx, 0, 234, TILE, 1, rgba(P.neonB, 0.10));
  px(ctx, 0, 235, TILE, 1, rgba('#000000', 0.45));

  fogBand(ctx, 214, 236, P.fog);
  return c;
}

// ============================================================
// 背景层：ground —— 濕漉漉的街面
// ============================================================
function buildGround(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);

  // 人行道：亮边 + 湿掉的砖缝
  px(ctx, 0, GROUND, TILE, 2, mix(P.curb, '#ffffff', 0.22));
  px(ctx, 0, GROUND, TILE, 1, rgba(P.neonB, 0.38));
  px(ctx, 0, GROUND + 2, TILE, 1, rgba('#000000', 0.55));
  px(ctx, 0, GROUND + 3, TILE, 4, mix(P.curb, '#000000', 0.22));
  for (let x = 0; x < TILE; x += 12) {
    px(ctx, x, GROUND + 3, 1, 4, rgba('#000000', 0.28));
    if ((x / 12) % 2 < 1) px(ctx, x + 3, GROUND + 4, 5, 1, rgba(P.roadLight, 0.22));
  }
  px(ctx, 0, GROUND + 7, TILE, 1, '#07060a');

  // 沥青
  px(ctx, 0, GROUND + 8, TILE, H - GROUND - 8, P.road);
  for (let i = 0; i < 1300; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = GROUND + 8 + Math.floor(rnd() * 27);
    const v = rnd();
    const col = v < 0.45 ? rgba('#ffffff', 0.045) : rgba('#000000', 0.30);
    px(ctx, x, y, 1, 1, col);
  }
  // 旧沥青补丁与轮胎湿痕
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = GROUND + 11 + Math.floor(rnd() * 14);
    const w = 18 + Math.floor(rnd() * 40);
    px(ctx, x, y, w, 1, rgba('#ffffff', 0.025));
    px(ctx, x, y + 1, w - 8, 1, rgba('#000000', 0.15));
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = GROUND + 10 + Math.floor(rnd() * 24);
    const w = 4 + Math.floor(rnd() * 18);
    px(ctx, x, y, w, 1, rgba(P.roadLight, 0.16 + rnd() * 0.14));
  }

  // 黄色车道虚线：低位、被雨水打湿
  for (let x = 8; x < TILE; x += 34) {
    px(ctx, x, GROUND + 27, 16, 1, rgba(P.litWarm, 0.32));
    px(ctx, x + 3, GROUND + 28, 10, 1, rgba(P.litWarm, 0.14));
    px(ctx, x + 5, GROUND + 29, 6, 1, rgba('#000000', 0.18));
  }

  // 水洼：深色水面 + 多层霓虹倒影
  const puddles = [
    { x: 20, w: 104, hue: P.neonA },
    { x: 188, w: 76, hue: P.neonB },
    { x: 314, w: 122, hue: P.neonC },
    { x: 478, w: 74, hue: P.neonB },
  ];
  for (const p of puddles) {
    const py = GROUND + 9 + Math.floor(rnd() * 5);
    px(ctx, p.x, py, p.w, 10, rgba('#04060c', 0.45));
    px(ctx, p.x + 3, py + 1, p.w - 6, 8, rgba('#08101b', 0.55));
    // 水面上的霓虹竖纹
    for (let i = 0; i < 16; i++) {
      const rx = p.x + 3 + Math.floor(rnd() * (p.w - 10));
      const rw = 2 + Math.floor(rnd() * 16);
      const ry = py + 1 + Math.floor(rnd() * 8);
      px(ctx, rx, ry, rw, 1, rgba(p.hue, 0.08 + rnd() * 0.24));
      if (rnd() < 0.3) px(ctx, rx + 2, ry - 1, Math.max(1, rw - 4), 1, rgba(p.hue, 0.18));
    }
    px(ctx, p.x + 2, py, p.w - 4, 1, rgba(p.hue, 0.32));
    px(ctx, p.x + 7, py + 10, p.w - 14, 1, rgba('#000000', 0.40));
    // 雨点涟漪
    for (let i = 0; i < 4; i++) {
      const rx = p.x + 5 + Math.floor(rnd() * (p.w - 12));
      const ry = py + 2 + Math.floor(rnd() * 6);
      px(ctx, rx - 1, ry, 3, 1, rgba('#c8e8ff', 0.22));
      px(ctx, rx, ry - 1, 1, 3, rgba('#c8e8ff', 0.14));
    }
  }

  // 井盖
  const mx = 170, my = GROUND + 20;
  disc(ctx, mx, my, 7, '#0b0b12');
  disc(ctx, mx, my, 6, '#1c1d27');
  for (let i = -4; i <= 4; i += 2) px(ctx, mx - 4, my + i, 9, 1, '#0e0e16');
  px(ctx, mx - 5, my - 5, 2, 1, rgba('#ffffff', 0.12));
  px(ctx, mx + 2, my + 5, 4, 1, rgba('#ffffff', 0.06));

  // 排水格栅：积水从边缘反光
  const gx = 412, gy = GROUND + 22;
  px(ctx, gx, gy, 26, 6, '#08080e');
  px(ctx, gx, gy, 26, 1, '#2a2b36');
  for (let x = gx + 2; x < gx + 25; x += 3) px(ctx, x, gy + 1, 1, 4, '#1a1b24');
  px(ctx, gx + 1, gy + 6, 24, 1, rgba(P.neonB, 0.18));
  px(ctx, gx - 2, gy + 7, 30, 1, rgba(P.neonB, 0.06));

  // 裂缝 / 破损
  for (let i = 0; i < 12; i++) {
    const sx = Math.floor(rnd() * TILE);
    const sy = GROUND + 9 + Math.floor(rnd() * 22);
    let cx = sx, cy = sy;
    const len = 4 + Math.floor(rnd() * 18);
    for (let j = 0; j < len; j++) {
      px(ctx, cx, cy, 1, 1, rgba('#000000', 0.55));
      if (j % 3 === 0) px(ctx, cx + 1, cy, 1, 1, rgba('#ffffff', 0.025));
      cx += rnd() < 0.5 ? 1 : -1;
      cy += rnd() < 0.35 ? 1 : 0;
    }
  }

  // 散落弹壳 / 纸屑 / 烟头
  for (let i = 0; i < 42; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = GROUND + 10 + Math.floor(rnd() * 23);
    const v = rnd();
    const col = v < 0.4 ? 'rgba(255,210,120,0.38)'
      : v < 0.7 ? 'rgba(180,190,210,0.20)'
      : 'rgba(160,120,90,0.22)';
    px(ctx, x, y, v < 0.3 ? 2 : 1, 1, col);
  }

  // 垂直霓虹倒影：与近景灯箱/灯柱呼应
  for (const r of [
    { x: 66, col: P.litWarm, w: 14, a: 0.24 },
    { x: 238, col: P.neonA, w: 10, a: 0.24 },
    { x: 420, col: P.neonB, w: 11, a: 0.22 },
    { x: 456, col: P.neonB, w: 8, a: 0.18 },
    { x: 552, col: P.neonC, w: 9, a: 0.18 },
  ]) {
    for (let i = 0; i < 18; i++) {
      const a = (1 - i / 18) * r.a;
      px(ctx, r.x + Math.round(Math.sin(i * 1.7) * 2), GROUND + 2 + i, Math.max(2, r.w - Math.floor(i / 4)), 1, rgba(r.col, a));
      if (i % 3 === 0) {
        px(ctx, r.x + 2 + Math.round(Math.sin(i * 2.1) * 3), GROUND + 2 + i, Math.max(1, r.w - 4), 1, rgba(r.col, a * 0.45));
      }
    }
  }
  // 整体湿光：把彩色反射托在沥青上，避免下半屏死黑
  const sheen = ctx.createLinearGradient(0, GROUND + 2, 0, 264);
  sheen.addColorStop(0, rgba(P.neonB, 0.055));
  sheen.addColorStop(0.35, rgba(P.neonA, 0.028));
  sheen.addColorStop(1, rgba(P.neonB, 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(0, GROUND + 2, TILE, 264 - GROUND);

  // 人行道上的纸屑与水光
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd() * TILE);
    px(ctx, x, GROUND + 4, 2, 1, rnd() < 0.5 ? 'rgba(210,220,235,0.18)' : 'rgba(255,190,120,0.16)');
  }

  // 底部压暗
  const bg = ctx.createLinearGradient(0, 252, 0, 270);
  bg.addColorStop(0, rgba('#000000', 0));
  bg.addColorStop(1, rgba('#000000', 0.55));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 252, TILE, 18);

  return c;
}

// ============================================================
// 背景层：fg —— 前景电缆 / 悬挂物 / 栅栏剪影
// ============================================================
function buildFg(P, seed) {
  const { c, ctx } = canvas(TILE, H);
  const rnd = rng(seed);
  const dark = '#030308';

  // 顶部电缆
  cable(ctx, -20, 12, 210, 8, 14, dark);
  cable(ctx, 210, 8, 420, 16, 10, dark);
  cable(ctx, 420, 16, 596, 10, 16, dark);
  cable(ctx, -10, 24, 170, 30, 8, rgba('#06050b', 0.9));
  cable(ctx, 170, 30, 360, 22, 12, rgba('#06050b', 0.9));
  cable(ctx, 360, 22, 586, 30, 9, rgba('#06050b', 0.9));
  cable(ctx, -30, 42, 260, 36, 9, rgba('#0a0812', 0.8));
  cable(ctx, 260, 36, 606, 44, 12, rgba('#0a0812', 0.8));

  // 电缆上的小灯 / 雨滴
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = 8 + Math.floor(rnd() * 40);
    px(ctx, x, y, 1, 1, rgba(P.neonB, 0.20 + rnd() * 0.2));
  }

  // 左上悬挂招牌
  px(ctx, 58, 0, 2, 22, dark);
  px(ctx, 44, 22, 34, 22, '#060510');
  px(ctx, 45, 23, 32, 1, rgba(P.neonA, 0.8));
  px(ctx, 45, 42, 32, 1, rgba(P.neonB, 0.5));
  glyph(ctx, 49, 28, GLYPHS[6], P.neonA, 2);
  glyph(ctx, 63, 28, GLYPHS[2], P.neonB, 2);
  glow(ctx, 61, 33, 28, P.neonA, 0.14);

  // 右侧悬吊管线与吊灯
  px(ctx, 512, 0, 2, 34, dark);
  px(ctx, 504, 34, 30, 8, '#05040a');
  px(ctx, 508, 36, 22, 2, rgba(P.neonC, 0.65));
  glow(ctx, 519, 38, 22, P.neonC, 0.16);
  line(ctx, 500, 0, 500, 52, dark);
  line(ctx, 546, 0, 548, 40, dark);

  // 中景悬挂布幡：被雨打湿、边缘带霓虹反光
  for (const b of [
    { x: 132, y: 0, w: 22, h: 58, col: P.neonA, glyph: GLYPHS[3] },
    { x: 456, y: 0, w: 18, h: 42, col: P.neonB, glyph: GLYPHS[1] },
  ]) {
    px(ctx, b.x + 2, 0, 2, 10, dark);
    px(ctx, b.x, 8, b.w, b.h - 8, '#06050b');
    px(ctx, b.x + b.w - 2, 8, 1, b.h - 8, rgba(b.col, 0.22));
    px(ctx, b.x, b.h - 2, b.w, 1, rgba(b.col, 0.12));
    glyph(ctx, b.x + Math.floor((b.w - 3) / 2), 20, b.glyph, rgba(b.col, 0.55), 1);
    glyph(ctx, b.x + Math.floor((b.w - 3) / 2), 34, GLYPHS[(b.glyph[0] + 4) % GLYPHS.length], rgba(b.col, 0.35), 1);
  }

  // 右下角只保留很低的垃圾堆，避免遮住角色（前景遮挡交给镜头边缘的构图画框）
  px(ctx, 4, 254, 24, 10, '#05040a');
  px(ctx, 8, 249, 14, 6, '#08070d');
  px(ctx, 11, 247, 8, 3, '#0b0910');
  px(ctx, 30, 260, 12, 3, '#05040a');
  px(ctx, 34, 256, 6, 4, '#08070d');
  px(ctx, 544, 256, 22, 10, '#05040a');
  px(ctx, 548, 252, 14, 5, '#08070d');
  px(ctx, 552, 250, 6, 3, '#0b0910');
  px(ctx, 544, 256, 20, 1, rgba(P.neonC, 0.12));

  // 底部前景管线：从画面下沿横穿，形成画框
  px(ctx, 0, 266, TILE, 4, '#040308');
  px(ctx, 0, 266, TILE, 1, rgba(P.nearEdge, 0.35));
  for (let x = 8; x < TILE; x += 54) {
    px(ctx, x, 263, 8, 3, '#06050a');
    px(ctx, x + 1, 263, 6, 1, rgba(P.neonB, 0.10));
  }

  return c;
}

// ============================================================
// 生成背景
// ============================================================
function buildBackgrounds() {
  console.log('Building backgrounds (576x270, 1px grid)...');
  for (const lv of [1, 2, 3]) {
    const P = BG_PALETTES[lv];
    const seedBase = 1200 + lv * 97;
    savePNG(buildSky(P, seedBase + 1), `bg_level${lv}_sky`);
    savePNG(buildFar(P, seedBase + 2), `bg_level${lv}_far`);
    savePNG(buildMid(P, seedBase + 3), `bg_level${lv}_mid`);
    savePNG(buildNear(P, seedBase + 4), `bg_level${lv}_near`);
    savePNG(buildGround(P, seedBase + 5), `bg_level${lv}_ground`);
    savePNG(buildFg(P, seedBase + 6), `bg_level${lv}_fg`);
  }
}

// ============================================================
// 掩体：7 种 × 3 阶段，96x64 帧，原生尺寸锚定底部中心
// ============================================================
const COVER_TYPES = ['barrier', 'oildrum', 'crate', 'trash', 'car', 'vending', 'sandbags'];

function drawBarrier(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    px(ctx, cx - 20, base - 7, 40, 4, '#1b1d25');
    px(ctx, cx - 22, base - 3, 44, 2, '#0a0a10');
    for (let i = 0; i < 8; i++) {
      const x = cx - 20 + i * 5;
      px(ctx, x, base - 8 - (i % 3), 3, 2, i % 2 ? '#b8433f' : '#cfd3dc');
    }
    px(ctx, cx + 8, base - 10, 2, 8, '#2a2d36');
    px(ctx, cx - 16, base - 9, 5, 2, '#7b2a2a');
    return;
  }
  const w = 44, h = 26, x = cx - w / 2, y = base - h;
  // 支脚
  px(ctx, x + 2, y + 14, 3, 12, '#15171e');
  px(ctx, x + w - 5, y + 14, 3, 12, '#15171e');
  px(ctx, x, base - 3, 7, 3, '#0b0c12');
  px(ctx, x + w - 7, base - 3, 7, 3, '#0b0c12');
  // 主体框架
  px(ctx, x, y + 6, w, 3, '#0b0c12');
  px(ctx, x, y + 17, w, 3, '#0b0c12');
  px(ctx, x, y + 6, w, 1, '#9aa3b5');
  px(ctx, x, y + 19, w, 1, '#373b48');
  px(ctx, x, y + 6, 2, 14, '#242732');
  px(ctx, x + w - 2, y + 6, 2, 14, '#0d0e14');
  // 竖杆
  for (let i = 0; i < 5; i++) {
    const bx = x + 5 + i * 8;
    px(ctx, bx, y + 6, 2, 14, i % 2 ? '#3e4352' : '#2a2e3a');
    px(ctx, bx, y + 6, 1, 11, '#5d6476');
  }
  // 警示斜纹
  for (let i = 0; i < 12; i++) {
    const sx = x + 1 + i * 4;
    px(ctx, sx, y + 1, 2, 4, i % 2 ? '#d8dce6' : '#c23a42');
  }
  px(ctx, x, y, w, 1, '#f0f3f8');
  px(ctx, x, y + 5, w, 1, '#1a1c24');
  // 涂鸦 / 弹孔
  px(ctx, x + 10, y + 9, 3, 1, '#ff2e88');
  px(ctx, x + 16, y + 9, 2, 3, '#ff2e88');
  px(ctx, x + 30, y + 12, 4, 2, '#0b0c12');
  if (stage === 1) {
    // 弯折 + 裂纹 + 火花
    px(ctx, x + 26, y + 6, 2, 8, '#15171e');
    px(ctx, x + 27, y + 14, 6, 2, '#15171e');
    px(ctx, x + 34, y + 6, 8, 1, '#0b0c12');
    line(ctx, x + 8, y + 7, x + 13, y + 16, '#0b0c12');
    px(ctx, x + 12, y + 17, 4, 1, '#0b0c12');
    px(ctx, x + 20, y + 10, 1, 3, '#ffb347');
    px(ctx, x + 21, y + 9, 2, 1, '#ffe066');
    px(ctx, x + 38, y + 4, 4, 1, '#0b0c12');
  }
}

function drawOildrum(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    px(ctx, cx - 11, base - 6, 22, 6, '#2a1c18');
    px(ctx, cx - 13, base - 3, 26, 3, '#120b0b');
    px(ctx, cx - 8, base - 9, 5, 4, '#6b3b2a');
    px(ctx, cx + 2, base - 8, 4, 3, '#8a4a32');
    px(ctx, cx + 8, base - 10, 2, 6, '#3a2a20');
    px(ctx, cx - 9, base - 2, 9, 1, '#c23a42');
    return;
  }
  const w = 22, h = 30, x = cx - w / 2, y = base - h;
  // 桶身
  px(ctx, x + 1, y, w - 2, h, '#1a0d0b');
  px(ctx, x, y + 2, w, h - 4, '#0b0707');
  px(ctx, x + 2, y + 3, w - 4, h - 6, '#8c342a');
  px(ctx, x + 3, y + 3, 4, h - 6, '#c24a35');
  px(ctx, x + 6, y + 3, 1, h - 7, '#e06a48');
  px(ctx, x + w - 5, y + 4, 2, h - 8, '#5e1e1a');
  // 箍
  px(ctx, x + 2, y + 6, w - 4, 2, '#2a1410');
  px(ctx, x + 2, y + 21, w - 4, 2, '#2a1410');
  px(ctx, x + 2, y + 6, w - 4, 1, '#b9a06a');
  px(ctx, x + 2, y + 21, w - 4, 1, '#8a7350');
  // 顶盖
  px(ctx, x + 2, y, w - 4, 2, '#6b3b2a');
  px(ctx, x + 3, y, w - 6, 1, '#c08458');
  // 危险标志
  px(ctx, x + 8, y + 11, 6, 6, '#ffd34d');
  px(ctx, x + 10, y + 12, 2, 3, '#1a0d0b');
  px(ctx, x + 8, y + 16, 6, 1, '#1a0d0b');
  // 锈斑
  px(ctx, x + 4, y + 18, 2, 2, '#4d2018');
  px(ctx, x + 15, y + 9, 2, 1, '#5e1e1a');
  if (stage === 1) {
    px(ctx, x + 13, y + 14, 3, 2, '#0b0707');
    line(ctx, x + 13, y + 16, x + 16, y + 19, '#0b0707');
    px(ctx, x + 4, y + h - 1, 2, 3, '#2b1a12');
    // 漏液
    px(ctx, x + 4, base - 1, 5, 1, '#5d2b2b');
  }
}

function drawCrate(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    px(ctx, cx - 15, base - 4, 30, 4, '#2a1c14');
    px(ctx, cx - 12, base - 6, 8, 3, '#7a4a2a');
    px(ctx, cx + 2, base - 7, 7, 4, '#5e3820');
    px(ctx, cx + 10, base - 4, 6, 2, '#8a5a34');
    line(ctx, cx - 10, base - 6, cx - 2, base - 2, '#3a2414');
    px(ctx, cx - 4, base - 9, 2, 5, '#3a2414');
    return;
  }
  const w = 30, h = 26, x = cx - w / 2, y = base - h;
  // 外框
  px(ctx, x, y, w, h, '#1a110b');
  px(ctx, x + 1, y + 1, w - 2, h - 2, '#7a4a2a');
  // 木板
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 2, y + 3 + i * 7, w - 4, 6, i % 2 ? '#8a5632' : '#74421f');
    px(ctx, x + 2, y + 3 + i * 7, w - 4, 1, '#a8703e');
    px(ctx, x + 2, y + 8 + i * 7, w - 4, 1, '#4a2a16');
  }
  // 金属加固
  px(ctx, x, y, 3, h, '#2a2c34');
  px(ctx, x + w - 3, y, 3, h, '#2a2c34');
  px(ctx, x, y, w, 2, '#3c404b');
  px(ctx, x, y + h - 2, w, 2, '#15161c');
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 1, y + 4 + i * 8, 1, 1, '#8c92a2');
    px(ctx, x + w - 2, y + 4 + i * 8, 1, 1, '#8c92a2');
  }
  // 喷涂标记
  px(ctx, x + 10, y + 10, 10, 1, '#ff2e88');
  px(ctx, x + 10, y + 12, 7, 1, '#ff2e88');
  px(ctx, x + 17, y + 10, 1, 3, '#ff2e88');
  px(ctx, x + 11, y + 14, 3, 1, '#ff2e88');
  if (stage === 1) {
    line(ctx, x + 20, y + 2, x + 24, y + 13, '#24160c');
    line(ctx, x + 24, y + 13, x + 21, y + 22, '#24160c');
    px(ctx, x + 25, y + 12, 3, 2, '#24160c');
    px(ctx, x + 19, y + 21, 4, 1, '#a8703e');
    px(ctx, x + 5, y + 20, 3, 2, '#24160c');
  }
}

function drawTrash(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    // 翻倒的垃圾箱 + 垃圾堆
    px(ctx, cx - 16, base - 7, 24, 7, '#1f2a24');
    px(ctx, cx - 14, base - 10, 22, 4, '#2e4036');
    px(ctx, cx + 1, base - 13, 5, 3, '#203028');
    px(ctx, cx - 20, base - 5, 5, 3, '#3a3a2a');
    px(ctx, cx - 12, base - 5, 4, 2, '#5e4a24');
    px(ctx, cx + 9, base - 5, 6, 3, '#244a52');
    px(ctx, cx + 13, base - 7, 3, 2, '#3a6a5a');
    px(ctx, cx - 6, base - 11, 3, 2, '#8a2b3a');
    return;
  }
  const w = 24, h = 30, x = cx - w / 2, y = base - h;
  // 箱体
  px(ctx, x, y + 5, w, h - 8, '#0b0f0d');
  px(ctx, x + 1, y + 6, w - 2, h - 10, '#20342c');
  px(ctx, x + 2, y + 7, 5, h - 12, '#2b4639');
  px(ctx, x + w - 5, y + 8, 3, h - 13, '#16251f');
  // 盖
  px(ctx, x - 1, y + 1, w + 2, 5, '#0b0f0d');
  px(ctx, x, y + 2, w, 3, '#2e4a3c');
  px(ctx, x + 1, y + 2, w - 2, 1, '#4f6d5a');
  px(ctx, x + 5, y, 8, 2, '#1a2a22');
  // 轮子
  disc(ctx, x + 4, base - 2, 2, '#08090c');
  disc(ctx, x + w - 4, base - 2, 2, '#08090c');
  px(ctx, x + 3, base - 3, 2, 1, '#4a5058');
  px(ctx, x + w - 5, base - 3, 2, 1, '#4a5058');
  // 标识
  px(ctx, x + 9, y + 12, 6, 1, '#39ff88');
  px(ctx, x + 10, y + 14, 4, 1, '#39ff88');
  px(ctx, x + 11, y + 16, 2, 1, '#39ff88');
  // 垃圾溢出
  px(ctx, x + 8, y - 2, 3, 3, '#7a4a2a');
  px(ctx, x + 13, y - 3, 2, 4, '#3a6a5a');
  px(ctx, x + 17, y - 1, 3, 2, '#8a2b3a');
  if (stage === 1) {
    line(ctx, x + 4, y + 8, x + 8, y + 14, '#0b0f0d');
    px(ctx, x + 8, y + 14, 4, 2, '#0b0f0d');
    px(ctx, x + w - 7, y + 12, 3, 3, '#0b0f0d');
    px(ctx, x + 2, y + 3, 5, 1, '#0b0f0d');
    px(ctx, x + 16, y - 4, 2, 2, '#d8d8c8');
  }
}

function drawCar(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    // 烧毁残骸
    px(ctx, cx - 40, base - 13, 80, 9, '#161016');
    px(ctx, cx - 34, base - 18, 58, 6, '#251418');
    px(ctx, cx - 26, base - 21, 34, 4, '#34191c');
    px(ctx, cx - 41, base - 8, 82, 3, '#08060a');
    disc(ctx, cx - 26, base - 5, 5, '#08060a');
    disc(ctx, cx + 26, base - 5, 5, '#08060a');
    // 残火与烟痕
    px(ctx, cx - 10, base - 15, 4, 2, '#ff7a2e');
    px(ctx, cx - 6, base - 18, 2, 4, '#ffb347');
    px(ctx, cx + 16, base - 16, 3, 2, '#ff4d3a');
    for (let i = 0; i < 10; i++) px(ctx, cx - 30 + i * 6, base - 24 - (i % 3) * 2, 2, 1, '#120a10');
    return;
  }
  const w = 88, h = 34, x = cx - w / 2, y = base - h;
  // 车底阴影
  px(ctx, x + 2, base - 4, w - 4, 3, 'rgba(0,0,0,0.5)');
  // 车身
  px(ctx, x, y + 12, w, 16, '#0a0d13');
  px(ctx, x + 2, y + 13, w - 4, 14, '#25384a');
  px(ctx, x + 2, y + 13, w - 4, 2, '#3f5f75');
  px(ctx, x + 2, y + 25, w - 4, 2, '#111a24');
  // 车顶
  px(ctx, x + 20, y + 2, 46, 12, '#0a0d13');
  px(ctx, x + 22, y + 3, 42, 10, '#2b4054');
  px(ctx, x + 24, y + 4, 18, 8, '#183040');
  px(ctx, x + 43, y + 4, 19, 8, '#183040');
  px(ctx, x + 24, y + 4, 18, 1, '#4e7a92');
  px(ctx, x + 43, y + 4, 19, 1, '#4e7a92');
  // 窗框
  px(ctx, x + 42, y + 3, 2, 10, '#0a0d13');
  px(ctx, x + 22, y + 12, 42, 2, '#0a0d13');
  // 车门缝 / 把手
  px(ctx, x + 56, y + 14, 1, 11, '#0a0d13');
  px(ctx, x + 51, y + 18, 3, 1, '#7d8a99');
  // 前灯 / 尾灯
  px(ctx, x + w - 6, y + 15, 4, 3, '#0a0d13');
  px(ctx, x + w - 5, y + 16, 2, 1, '#ffe9a8');
  px(ctx, x + 2, y + 16, 3, 3, '#0a0d13');
  px(ctx, x + 3, y + 17, 1, 1, '#ff2e4a');
  // 轮胎
  for (const wx of [x + 16, x + w - 18]) {
    disc(ctx, wx, y + 27, 6, '#07080c');
    disc(ctx, wx, y + 27, 4, '#1a1c24');
    px(ctx, wx - 2, y + 25, 3, 2, '#3a3e4a');
  }
  // 车顶霓虹 / 反光
  px(ctx, x + 26, y + 2, 34, 1, 'rgba(0,229,255,0.35)');
  px(ctx, x + 4, y + 14, w - 8, 1, 'rgba(255,255,255,0.20)');
  // 锈斑
  for (let i = 0; i < 10; i++) {
    const rx = x + 8 + (i * 13) % (w - 16);
    const ry = y + 16 + (i * 7) % 8;
    px(ctx, rx, ry, 2, 1, '#5a2a22');
  }
  if (stage === 1) {
    // 破窗 / 凹陷 / 弹孔
    px(ctx, x + 25, y + 4, 16, 7, '#0a0d13');
    line(ctx, x + 26, y + 5, x + 32, y + 9, '#7d8a99');
    line(ctx, x + 38, y + 4, x + 33, y + 10, '#7d8a99');
    px(ctx, x + 28, y + 8, 2, 2, '#05060a');
    px(ctx, x + 64, y + 14, 5, 4, '#0a0d13');
    px(ctx, x + 70, y + 20, 2, 2, '#0a0d13');
    for (let i = 0; i < 4; i++) px(ctx, x + 12 + i * 8, y + 19 + (i % 2) * 3, 1, 1, '#0a0d13');
  }
}

function drawVending(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    px(ctx, cx - 13, base - 5, 26, 5, '#0a0c12');
    px(ctx, cx - 10, base - 10, 20, 5, '#1a1e28');
    px(ctx, cx - 8, base - 13, 16, 4, '#242a36');
    px(ctx, cx - 12, base - 4, 8, 2, '#0a0c12');
    px(ctx, cx + 4, base - 4, 7, 2, '#0a0c12');
    px(ctx, cx - 6, base - 15, 4, 3, '#39ff88');
    px(ctx, cx + 2, base - 14, 3, 2, '#ff2e88');
    px(ctx, cx + 8, base - 8, 4, 1, '#39ff88');
    for (let i = 0; i < 6; i++) px(ctx, cx - 10 + i * 4, base - 17 - (i % 2), 2, 1, '#0a0c12');
    return;
  }
  const w = 28, h = 42, x = cx - w / 2, y = base - h;
  // 机柜
  px(ctx, x, y, w, h, '#080a10');
  px(ctx, x + 1, y + 1, w - 2, h - 2, '#232a38');
  px(ctx, x + 2, y + 2, w - 4, h - 4, '#171c27');
  // 顶部灯箱
  px(ctx, x + 2, y + 2, w - 4, 6, stage === 1 ? '#3a2430' : '#4a1028');
  px(ctx, x + 4, y + 3, w - 8, 4, stage === 1 ? '#ff2e88' : '#ff5ea6');
  px(ctx, x + 4, y + 3, w - 8, 1, '#ffd0e4');
  if (stage === 1) px(ctx, x + 14, y + 3, 4, 4, '#4a1028');
  // 玻璃展窗
  px(ctx, x + 2, y + 10, w - 4, 20, '#05070c');
  px(ctx, x + 3, y + 11, w - 6, 18, 'rgba(0,229,255,0.09)');
  for (let r = 0; r < 3; r++) {
    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const px0 = x + 4 + cIdx * 7;
      const py0 = y + 12 + r * 6;
      px(ctx, px0, py0, 5, 4, r === 0 ? '#ff2e88' : r === 1 ? '#39ff88' : '#ffb347');
      px(ctx, px0, py0, 5, 1, 'rgba(255,255,255,0.35)');
    }
  }
  if (stage === 1) {
    line(ctx, x + 5, y + 10, x + 16, y + 24, '#9ab6c0');
    line(ctx, x + 16, y + 10, x + 9, y + 27, '#9ab6c0');
    px(ctx, x + 19, y + 13, 3, 3, '#05070c');
    px(ctx, x + 6, y + 26, 7, 2, '#05070c');
  }
  // 投币区 / 出货口
  px(ctx, x + 4, y + 32, 8, 4, '#0a0d13');
  px(ctx, x + 5, y + 33, 6, 1, '#ffb347');
  px(ctx, x + 15, y + 32, 9, 5, '#05070c');
  px(ctx, x + 16, y + 33, 7, 2, '#10151e');
  // 底部灯带
  px(ctx, x + 2, y + h - 3, w - 4, 1, stage === 1 ? 'rgba(255,46,136,0.35)' : 'rgba(0,229,255,0.65)');
  glow(ctx, cx, y + h - 3, 22, stage === 1 ? '#ff2e88' : '#00e5ff', stage === 1 ? 0.12 : 0.24);
}

function drawSandbags(ctx, stage) {
  const cx = 48, base = 64;
  if (stage === 2) {
    for (let i = 0; i < 7; i++) {
      const bx = cx - 21 + i * 6;
      const by = base - 4 - (i % 3) * 2;
      px(ctx, bx, by, 7, 3, i % 2 ? '#4a4a2e' : '#3a3a24');
      px(ctx, bx + 1, by, 5, 1, '#6a6a42');
    }
    px(ctx, cx - 18, base - 3, 36, 2, '#2a2a18');
    return;
  }
  const w = 46, h = 20, x = cx - w / 2, y = base - h;
  // 三排沙袋
  const rows = [
    { y: y + 13, count: 5, off: 0 },
    { y: y + 7, count: 4, off: 4 },
    { y: y + 1, count: 4, off: 3 },
  ];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let i = 0; i < row.count; i++) {
      const bx = x + row.off + i * 9;
      const bw = 10, bh = 7;
      const col = (r + i) % 2 ? '#565236' : '#48442c';
      px(ctx, bx, row.y, bw, bh, '#1a1a10');
      px(ctx, bx + 1, row.y + 1, bw - 2, bh - 2, col);
      px(ctx, bx + 1, row.y + 1, bw - 2, 1, '#726c48');
      px(ctx, bx + 2, row.y + bh - 2, bw - 4, 1, '#2e2c1a');
      px(ctx, bx + 4, row.y + 3, 2, 1, '#7a744c');
      if ((i + r) % 3 === 0) px(ctx, bx + 7, row.y + 4, 1, 1, '#2e2c1a');
    }
  }
  if (stage === 1) {
    px(ctx, x + 18, y + 4, 4, 2, '#1a1a10');
    px(ctx, x + 19, y + 6, 2, 4, '#2e2c1a');
    px(ctx, x + 8, y + 14, 5, 2, '#1a1a10');
    px(ctx, x + 30, y + 15, 4, 3, '#1a1a10');
    px(ctx, x + 36, y + 9, 5, 2, '#6a6a42');
  }
}

const COVER_DRAW = {
  barrier: drawBarrier,
  oildrum: drawOildrum,
  crate: drawCrate,
  trash: drawTrash,
  car: drawCar,
  vending: drawVending,
  sandbags: drawSandbags,
};

// 掩体原生尺寸（480x270 逻辑空间）
const COVER_SIZES = {
  barrier: { w: 44, h: 26 },
  oildrum: { w: 22, h: 30 },
  crate: { w: 30, h: 26 },
  trash: { w: 24, h: 30 },
  car: { w: 88, h: 34 },
  vending: { w: 28, h: 42 },
  sandbags: { w: 46, h: 20 },
};

function buildCovers() {
  console.log('Building covers (96x64 frames, 7 types x 3 stages)...');
  const fw = 96, fh = 64;
  const count = COVER_TYPES.length * 3;
  const { c, ctx } = canvas(fw * count, fh);
  let frame = 0;
  for (let stage = 0; stage < 3; stage++) {
    for (const type of COVER_TYPES) {
      ctx.save();
      ctx.translate(frame * fw, 0);
      COVER_DRAW[type](ctx, stage);
      ctx.restore();
      frame++;
    }
  }
  const tags = [];
  for (let t = 0; t < COVER_TYPES.length; t++) {
    tags.push({ name: COVER_TYPES[t], from: t * 3, to: t * 3 + 2, direction: 'forward' });
  }
  saveSheet(c, makeAsepriteJSON(fw, fh, count, tags, 'cover'), 'covers');
}

// ============================================================
// 主入口
// ============================================================
if (require.main === module) {
  const mode = process.argv[2] || 'all';
  if (mode === 'bg' || mode === 'all') buildBackgrounds();
  if (mode === 'props' || mode === 'all') buildCovers();
  if (mode === 'chars') {
    require('./build-characters-v2.js');
  }
}

module.exports = { px, canvas, savePNG, saveSheet, makeAsepriteJSON, COVER_TYPES, COVER_SIZES, COVER_DRAW, GLYPHS, glyph, line, disc, glow, rgba, mix, rng, OUT };
