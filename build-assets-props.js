// build-assets-props.js —— 掩体道具 / 特效 / UI / 背景 精灵图
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const PAL = {
  K: '#0a0a14', outline: '#0a0a14',
  neonPink: '#ff2e88', neonCyan: '#00e5ff', neonPurple: '#b14aed',
  neonGreen: '#39ff88', neonOrange: '#ff8a3d', neonYellow: '#ffe066',
};

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function saveSheet(canvas, json, name) {
  fs.writeFileSync(path.join(OUT, name + '.png'), canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(json, null, 2));
  console.log('  ✓', name, canvas.width + 'x' + canvas.height);
}

function makeJSON(frameW, frameH, frames, tags) {
  return {
    frames: frames.map((f, i) => ({
      filename: f.name || (i + '.png'),
      frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
      rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
      sourceSize: { w: frameW, h: frameH },
      duration: f.duration || 100,
    })),
    meta: {
      app: 'neon-huntdown-build', version: '1.0', image: '', format: 'RGBA8888',
      size: { w: frameW * frames.length, h: frameH }, scale: '1',
      frameTags: tags || [],
      layers: [{ name: 'default', opacity: 255, blendMode: 'normal' }],
    },
  };
}

// ============================================================
// 掩体道具：7 种 × 3 阶段（完好/受损/破碎），统一 96x64 帧，底部对齐
// ============================================================
const COVER_FRAME_W = 96;
const COVER_FRAME_H = 64;

// 混凝土路障
function drawBarrier(ctx, x, stage) {
  const baseY = 64;
  const w = 88, h = 38;
  const bx = x + 4, by = baseY - h;
  if (stage === 2) {
    // 破碎：只剩残块
    px(ctx, bx, by + h - 10, 30, 10, '#4a4a5a');
    px(ctx, bx + 40, by + h - 8, 35, 8, '#3a3a4a');
    px(ctx, bx + 20, by + h - 6, 12, 6, '#5a5a6a');
    return;
  }
  // 主体
  px(ctx, bx, by, w, h, '#3b4048');
  px(ctx, bx, by, w, 3, '#5a5f6a');
  px(ctx, bx, by + h - 3, w, 3, '#2a2e35');
  // 黄黑斜纹
  for (let i = 0; i < w; i += 12) {
    px(ctx, bx + i, by + 4, 6, h - 8, stage === 1 ? '#5a4a2a' : '#ffc83d');
    px(ctx, bx + i + 6, by + 4, 6, h - 8, '#1a1a22');
  }
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    // 裂纹
    ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 20, by + 4); ctx.lineTo(bx + 30, by + 20); ctx.lineTo(bx + 22, by + h - 4);
    ctx.moveTo(bx + 60, by + 6); ctx.lineTo(bx + 55, by + 24); ctx.lineTo(bx + 65, by + h - 6);
    ctx.stroke();
  }
}

// 油桶
function drawOilDrum(ctx, x, stage) {
  const baseY = 64;
  const w = 36, h = 56;
  const bx = x + 30, by = baseY - h;
  if (stage === 2) {
    px(ctx, bx + 2, by + h - 12, 32, 12, '#2a1a1a');
    px(ctx, bx + 6, by + h - 8, 10, 8, '#3a2a2a');
    return;
  }
  // 桶身
  px(ctx, bx, by, w, h, '#5a2a1a');
  px(ctx, bx, by, w, 3, '#7a3a2a');
  px(ctx, bx, by + h - 3, w, 3, '#3a1a0a');
  // 桶顶/底箍
  px(ctx, bx, by, w, 4, '#3a1a0a');
  px(ctx, bx, by + h - 4, w, 4, '#3a1a0a');
  // 中间箍
  px(ctx, bx, by + h / 2 - 2, w, 3, '#3a1a0a');
  // 霓虹危险标识
  px(ctx, bx + 4, by + 10, w - 8, 6, stage === 1 ? '#7a5a1a' : PAL.neonYellow);
  px(ctx, bx + 8, by + 22, w - 16, 3, PAL.neonOrange);
  // 高光
  px(ctx, bx + 2, by + 4, 3, h - 8, 'rgba(255,255,255,0.15)');
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#1a0a00'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 10, by + 6); ctx.lineTo(bx + 16, by + 30); ctx.lineTo(bx + 12, by + h - 6);
    ctx.stroke();
  }
}

// 木箱
function drawCrate(ctx, x, stage) {
  const baseY = 64;
  const w = 52, h = 48;
  const bx = x + 22, by = baseY - h;
  if (stage === 2) {
    px(ctx, bx + 2, by + h - 10, 20, 10, '#4a3a1a');
    px(ctx, bx + 28, by + h - 8, 18, 8, '#3a2a1a');
    return;
  }
  px(ctx, bx, by, w, h, '#6a4a2a');
  px(ctx, bx, by, w, 3, '#8a6a3a');
  px(ctx, bx, by + h - 3, w, 3, '#4a3a1a');
  // 木板纹理
  for (let i = 0; i < 4; i++) {
    px(ctx, bx, by + 4 + i * 11, w, 1, '#4a3a1a');
  }
  // 交叉加固
  ctx.strokeStyle = '#4a3a1a'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + 3, by + 3); ctx.lineTo(bx + w - 3, by + h - 3);
  ctx.moveTo(bx + w - 3, by + 3); ctx.lineTo(bx + 3, by + h - 3);
  ctx.stroke();
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 14, by + 4); ctx.lineTo(bx + 20, by + 24); ctx.lineTo(bx + 16, by + h - 4);
    ctx.stroke();
  }
}

// 垃圾桶
function drawTrash(ctx, x, stage) {
  const baseY = 64;
  const w = 40, h = 52;
  const bx = x + 28, by = baseY - h;
  if (stage === 2) {
    px(ctx, bx, by + h - 10, w, 10, '#2a3a2a');
    px(ctx, bx + 6, by + h - 6, 12, 6, '#3a4a3a');
    return;
  }
  // 桶身（绿色金属）
  px(ctx, bx, by, w, h, '#2a5a3a');
  px(ctx, bx, by, w, 3, '#3a7a4a');
  px(ctx, bx, by + h - 3, w, 3, '#1a3a2a');
  // 桶盖
  px(ctx, bx - 2, by - 4, w + 4, 6, '#1a3a2a');
  px(ctx, bx - 2, by - 4, w + 4, 2, '#3a7a4a');
  // 竖纹
  for (let i = 0; i < w; i += 6) {
    px(ctx, bx + i, by, 1, h, '#1a3a2a');
  }
  // 霓虹标识
  px(ctx, bx + 6, by + 12, w - 12, 4, PAL.neonGreen);
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#0a2a1a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 10, by + 6); ctx.lineTo(bx + 14, by + 26); ctx.lineTo(bx + 10, by + h - 6);
    ctx.stroke();
  }
}

// 80年代老式轿车
function drawCar(ctx, x, stage) {
  const baseY = 64;
  const w = 92, h = 40;
  const bx = x + 2, by = baseY - h;
  if (stage === 2) {
    // 烧毁残骸
    px(ctx, bx, by + h - 14, w, 14, '#1a1a22');
    px(ctx, bx + 8, by + h - 8, 30, 8, '#2a2a32');
    px(ctx, bx + 50, by + h - 10, 28, 10, '#2a2028');
    px(ctx, bx + 14, by + h - 6, 6, 4, '#3a2020');
    px(ctx, bx + 60, by + h - 4, 8, 4, '#3a2020');
    return;
  }
  // 车身
  px(ctx, bx, by + 14, w, h - 14, '#4a2a6a');
  px(ctx, bx, by + 14, w, 3, '#6a4a8a');
  px(ctx, bx, by + h - 4, w, 4, '#2a1a4a');
  // 车顶（80年代方盒子造型）
  px(ctx, bx + 14, by, w - 32, 18, '#3a1a5a');
  px(ctx, bx + 14, by, w - 32, 2, '#5a3a7a');
  // 车窗
  px(ctx, bx + 18, by + 3, 20, 12, 'rgba(0,229,255,0.5)');
  px(ctx, bx + 46, by + 3, 22, 12, 'rgba(255,46,136,0.4)');
  // 车窗分隔
  px(ctx, bx + 42, by + 3, 2, 12, '#2a1a4a');
  // 车门线
  px(ctx, bx + 30, by + 17, 1, h - 22, '#2a1a4a');
  // 霓虹底光
  px(ctx, bx + 4, by + h - 3, w - 8, 2, PAL.neonPink);
  // 轮子
  px(ctx, bx + 12, by + h - 6, 16, 8, '#0a0a10');
  px(ctx, bx + 64, by + h - 6, 16, 8, '#0a0a10');
  px(ctx, bx + 15, by + h - 4, 10, 4, '#2a2a34');
  px(ctx, bx + 67, by + h - 4, 10, 4, '#2a2a34');
  // 前灯
  px(ctx, bx + 2, by + 18, 4, 6, PAL.neonYellow);
  // 尾灯
  px(ctx, bx + w - 6, by + 18, 4, 6, PAL.neonPink);
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#1a0a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 30, by + 4); ctx.lineTo(bx + 36, by + 20); ctx.lineTo(bx + 32, by + h - 6);
    ctx.moveTo(bx + 60, by + 18); ctx.lineTo(bx + 66, by + 28);
    ctx.stroke();
    // 引擎盖冒烟感
    px(ctx, bx + 40, by + 12, 12, 2, 'rgba(120,120,140,0.4)');
  }
}

// 霓虹自动售货机
function drawVending(ctx, x, stage) {
  const baseY = 64;
  const w = 52, h = 60;
  const bx = x + 22, by = baseY - h;
  if (stage === 2) {
    px(ctx, bx + 2, by + h - 14, w - 4, 14, '#2a2a3a');
    px(ctx, bx + 8, by + h - 8, 16, 8, '#3a3a4a');
    px(ctx, bx + 30, by + h - 10, 14, 10, '#3a2a4a');
    return;
  }
  // 机身
  px(ctx, bx, by, w, h, '#2a2a4a');
  px(ctx, bx, by, w, 3, '#4a4a6a');
  px(ctx, bx, by + h - 3, w, 3, '#1a1a2a');
  // 玻璃橱窗
  px(ctx, bx + 4, by + 6, w - 8, 30, '#0a1a2a');
  px(ctx, bx + 4, by + 6, w - 8, 2, 'rgba(0,229,255,0.6)');
  // 商品格子
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      px(ctx, bx + 6 + c * 10, by + 9 + r * 9, 8, 7,
        [PAL.neonPink, PAL.neonCyan, PAL.neonYellow, PAL.neonGreen][(r + c) % 4]);
    }
  }
  // 霓虹灯箱
  px(ctx, bx + 4, by + 38, w - 8, 6, PAL.neonCyan);
  px(ctx, bx + 4, by + 38, w - 8, 1, '#ffffff');
  // 取货口
  px(ctx, bx + 10, by + 48, w - 20, 8, '#0a0a14');
  px(ctx, bx + 10, by + 48, w - 20, 1, PAL.neonPink);
  // 投币口
  px(ctx, bx + w - 10, by + 40, 6, 4, '#5a5a7a');
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#0a0a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 16, by + 8); ctx.lineTo(bx + 20, by + 28); ctx.lineTo(bx + 16, by + 44);
    ctx.stroke();
    // 橱窗闪烁
    px(ctx, bx + 4, by + 6, w - 8, 1, 'rgba(255,255,255,0.3)');
  }
}

// 沙袋墙
function drawSandbags(ctx, x, stage) {
  const baseY = 64;
  const w = 84, h = 32;
  const bx = x + 6, by = baseY - h;
  if (stage === 2) {
    px(ctx, bx, by + h - 8, 40, 8, '#6a5a3a');
    px(ctx, bx + 38, by + h - 6, 36, 6, '#5a4a2a');
    return;
  }
  // 多层沙袋
  for (let row = 0; row < 3; row++) {
    const ry = by + row * 11;
    const offset = row % 2 === 0 ? 0 : 12;
    for (let i = -1; i < 6; i++) {
      const sbx = bx + offset + i * 16;
      if (sbx < bx - 4 || sbx + 16 > bx + w + 4) continue;
      px(ctx, sbx, ry, 16, 11, '#7a6a4a');
      px(ctx, sbx, ry, 16, 2, '#9a8a5a');
      px(ctx, sbx, ry + 9, 16, 2, '#5a4a2a');
      // 沙袋扎口
      px(ctx, sbx + 2, ry + 1, 2, 2, '#5a4a2a');
      px(ctx, sbx + 12, ry + 1, 2, 2, '#5a4a2a');
    }
  }
  px(ctx, bx, by, w, h, PAL.outline);
  if (stage === 1) {
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 20, by + 4); ctx.lineTo(bx + 26, by + 16); ctx.lineTo(bx + 22, by + h - 4);
    ctx.moveTo(bx + 55, by + 6); ctx.lineTo(bx + 50, by + 20);
    ctx.stroke();
  }
}

const COVER_DRAWERS = [
  { name: 'barrier', fn: drawBarrier },
  { name: 'oildrum', fn: drawOilDrum },
  { name: 'crate', fn: drawCrate },
  { name: 'trash', fn: drawTrash },
  { name: 'car', fn: drawCar },
  { name: 'vending', fn: drawVending },
  { name: 'sandbags', fn: drawSandbags },
];

console.log('Building cover props...');
{
  const cols = COVER_DRAWERS.length;
  const rows = 3; // 完好/受损/破碎
  const canvas = createCanvas(COVER_FRAME_W * cols, COVER_FRAME_H * rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frames = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.save();
      ctx.translate(col * COVER_FRAME_W, row * COVER_FRAME_H);
      COVER_DRAWERS[col].fn(ctx, 0, row);
      ctx.restore();
      frames.push({ name: COVER_DRAWERS[col].name + '_' + row, duration: 100 });
    }
  }
  // JSON: 把网格展平为帧序列，同时提供按类型查找
  const json = makeJSON(COVER_FRAME_W, COVER_FRAME_H, frames, [
    { name: 'barrier', from: 0, to: 2, direction: 'forward' },
    { name: 'oildrum', from: 3, to: 5, direction: 'forward' },
    { name: 'crate', from: 6, to: 8, direction: 'forward' },
    { name: 'trash', from: 9, to: 11, direction: 'forward' },
    { name: 'car', from: 12, to: 14, direction: 'forward' },
    { name: 'vending', from: 15, to: 17, direction: 'forward' },
    { name: 'sandbags', from: 18, to: 20, direction: 'forward' },
  ]);
  saveSheet(canvas, json, 'covers');
}

// ============================================================
// 特效序列帧：每格 96x96
// ============================================================
const FX = 96;
const fxColors = {
  orange: '#ff8a3d', yellow: '#ffe066', white: '#ffffff',
  hot: '#ff4757', red: '#cc1a3a',
};

// 枪口火焰 3 帧
function drawMuzzleFlash(ctx, frame) {
  const cx = 32, cy = 48;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (frame === 0) {
    px(ctx, cx, cy - 6, 28, 12, fxColors.yellow);
    px(ctx, cx + 8, cy - 2, 36, 4, fxColors.orange);
    px(ctx, cx + 2, cy - 2, 24, 4, fxColors.white);
  } else if (frame === 1) {
    px(ctx, cx, cy - 10, 36, 20, fxColors.orange);
    px(ctx, cx + 6, cy - 4, 44, 8, fxColors.yellow);
    px(ctx, cx + 4, cy - 2, 30, 4, fxColors.white);
    px(ctx, cx + 30, cy - 8, 14, 16, fxColors.hot);
  } else {
    px(ctx, cx, cy - 4, 22, 8, fxColors.orange);
    px(ctx, cx + 4, cy - 2, 18, 4, fxColors.yellow);
    px(ctx, cx + 6, cy - 1, 12, 2, fxColors.white);
  }
  ctx.restore();
}

// 子弹命中火花 5 帧
function drawSparks(ctx, frame) {
  const cx = 48, cy = 48;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const t = frame / 4;
  const count = 8 - frame;
  for (let i = 0; i < count; i++) {
    const ang = (i / 8) * Math.PI * 2 + frame * 0.3;
    const dist = 4 + t * 24;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const s = Math.max(1, 4 - frame);
    px(ctx, x - s / 2, y - s / 2, s, s, i % 2 ? fxColors.yellow : fxColors.orange);
  }
  // 中心爆点
  if (frame < 3) {
    const s = 8 - frame * 2;
    px(ctx, cx - s / 2, cy - s / 2, s, s, fxColors.white);
  }
  ctx.restore();
}

// 血雾喷溅 6 帧
function drawBlood(ctx, frame) {
  const cx = 48, cy = 48;
  ctx.save();
  const t = frame / 5;
  // 主血团
  const r = 6 + t * 22;
  ctx.fillStyle = `rgba(204,26,58,${0.8 - t * 0.5})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // 飞溅血滴
  const drops = 10 - frame;
  for (let i = 0; i < drops; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const dist = 8 + t * 30;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const s = Math.max(1, 3 - Math.floor(frame / 2));
    ctx.fillStyle = i % 3 === 0 ? '#ff5a5a' : '#cc1a3a';
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  // 核心
  if (frame < 4) {
    ctx.fillStyle = `rgba(255,90,90,${0.9 - t * 0.3})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 - frame * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 手雷爆炸 12 帧
function drawExplosion(ctx, frame) {
  const cx = 48, cy = 48;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const t = frame / 11;
  // 外圈
  const r1 = 4 + t * 38;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
  grd.addColorStop(0, `rgba(255,240,160,${1 - t * 0.7})`);
  grd.addColorStop(0.4, `rgba(255,138,61,${0.9 - t * 0.6})`);
  grd.addColorStop(0.75, `rgba(255,71,87,${0.6 - t * 0.5})`);
  grd.addColorStop(1, 'rgba(255,71,87,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, r1, 0, Math.PI * 2);
  ctx.fill();
  // 核心白热
  if (frame < 6) {
    const r2 = 6 - frame * 0.8;
    ctx.fillStyle = `rgba(255,255,255,${1 - frame / 6})`;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r2), 0, Math.PI * 2);
    ctx.fill();
  }
  // 锯齿状火焰边缘
  if (frame < 10) {
    const spikes = 10;
    for (let i = 0; i < spikes; i++) {
      const ang = (i / spikes) * Math.PI * 2 + frame * 0.5;
      const len = r1 * (0.5 + Math.sin(frame + i) * 0.3);
      const x = cx + Math.cos(ang) * len;
      const y = cy + Math.sin(ang) * len;
      px(ctx, x - 2, y - 2, 4, 4, fxColors.orange);
    }
  }
  // 烟雾
  if (frame > 4) {
    const sr = (frame - 4) * 3;
    ctx.fillStyle = `rgba(80,80,100,${0.3 - (frame - 4) * 0.03})`;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6, sr, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy + 4, sr * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 烟雾 8 帧
function drawSmoke(ctx, frame) {
  const cx = 48, cy = 52;
  ctx.save();
  const t = frame / 7;
  const r = 4 + t * 30;
  ctx.fillStyle = `rgba(140,140,160,${0.5 - t * 0.35})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(100,100,120,${0.4 - t * 0.25})`;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(170,170,190,${0.3 - t * 0.2})`;
  ctx.beginPath();
  ctx.arc(cx + r * 0.2, cy - r * 0.4, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 弹壳抛出（序列）
function drawShell(ctx, frame) {
  ctx.save();
  const ang = frame * 0.6;
  ctx.translate(48, 48);
  ctx.rotate(ang);
  // 弹壳
  px(ctx, -2, -8, 4, 12, '#ffd24a');
  px(ctx, -2, -8, 4, 2, '#ffe066');
  px(ctx, -2, 2, 4, 2, '#cc8800');
  // 底火
  px(ctx, -1, 3, 2, 1, '#3a2a1a');
  ctx.restore();
}

// 碎石飞溅
function drawDebris(ctx, frame) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const t = frame / 5;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + frame * 0.4;
    const dist = 6 + t * 30;
    const x = 48 + Math.cos(ang) * dist;
    const y = 48 + Math.sin(ang) * dist;
    const s = Math.max(1, 4 - frame);
    px(ctx, x - s / 2, y - s / 2, s, s, i % 2 ? '#8a8a9a' : '#5a5a6a');
  }
  ctx.restore();
}

function buildFxSheet(name, count, drawFn) {
  const canvas = createCanvas(FX * count, FX);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate(i * FX, 0);
    drawFn(ctx, i);
    ctx.restore();
  }
  const frames = Array.from({ length: count }, (_, i) => ({ name: name + '_' + i, duration: 80 }));
  const json = makeJSON(FX, FX, frames, [{ name, from: 0, to: count - 1, direction: 'forward' }]);
  saveSheet(canvas, json, 'fx_' + name);
}

console.log('Building VFX...');
buildFxSheet('muzzle_flash', 3, drawMuzzleFlash);
buildFxSheet('sparks', 5, drawSparks);
buildFxSheet('blood', 6, drawBlood);
buildFxSheet('explosion', 12, drawExplosion);
buildFxSheet('smoke', 8, drawSmoke);
buildFxSheet('shell', 4, drawShell);
buildFxSheet('debris', 6, drawDebris);

// ============================================================
// UI 元素
// ============================================================
console.log('Building UI...');

// HUD: 血条 + 弹药条 + 武器图标
{
  const W = 256, H = 96;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // 血条背景
  px(ctx, 0, 0, 120, 14, 'rgba(10,10,20,0.8)');
  ctx.strokeStyle = PAL.neonPink; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 119, 13);
  // 血条填充
  px(ctx, 2, 2, 100, 10, PAL.neonPink);
  // 血条高光
  px(ctx, 2, 2, 100, 2, '#ff8ac4');
  // 弹药条
  px(ctx, 0, 20, 120, 10, 'rgba(10,10,20,0.8)');
  ctx.strokeStyle = PAL.neonCyan;
  ctx.strokeRect(0.5, 20.5, 119, 9);
  px(ctx, 2, 22, 80, 6, PAL.neonCyan);
  px(ctx, 2, 22, 80, 1, '#aaf0ff');
  // 武器图标：手枪
  const drawPistol = (ox, oy) => {
    px(ctx, ox, oy + 2, 14, 4, '#3a3a48');
    px(ctx, ox, oy + 2, 14, 1, '#5a5a7a');
    px(ctx, ox + 4, oy + 6, 6, 6, '#2a2a34');
    px(ctx, ox + 14, oy + 3, 4, 2, '#5a5a7a');
  };
  drawPistol(130, 0);
  // 步枪
  const drawRifle = (ox, oy) => {
    px(ctx, ox, oy + 3, 20, 3, '#3a3a48');
    px(ctx, ox, oy + 3, 20, 1, '#5a5a7a');
    px(ctx, ox + 2, oy + 6, 5, 5, '#2a2a34');
    px(ctx, ox + 18, oy + 4, 4, 1, '#5a5a7a');
    px(ctx, ox + 8, oy, 3, 3, '#3a3a48');
  };
  drawRifle(160, 0);
  // 线光线弹枪
  const drawPlasma = (ox, oy) => {
    px(ctx, ox, oy + 3, 18, 3, '#2a4a5a');
    px(ctx, ox, oy + 3, 18, 1, PAL.neonCyan);
    px(ctx, ox + 2, oy + 6, 5, 5, '#1a2a3a');
    px(ctx, ox + 16, oy + 2, 4, 5, PAL.neonGreen);
  };
  drawPlasma(190, 0);
  // 手雷
  const drawGrenade = (ox, oy) => {
    px(ctx, ox + 2, oy + 3, 10, 10, '#2f5a2a');
    px(ctx, ox + 2, oy + 3, 10, 2, '#4a8a3c');
    px(ctx, ox + 5, oy, 4, 4, '#5a5a7a');
    px(ctx, ox + 6, oy - 1, 2, 2, PAL.neonYellow);
  };
  drawGrenade(218, 0);
  const json = makeJSON(W, H, [{ name: 'hud', duration: 100 }], []);
  saveSheet(canvas, json, 'ui_hud');
}

// 标题字
{
  const W = 320, H = 64;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // 霓虹光晕
  ctx.fillStyle = 'rgba(255,46,136,0.3)';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEON', W / 2, 30);
  ctx.fillStyle = PAL.neonPink;
  ctx.fillText('NEON', W / 2, 30);
  ctx.fillStyle = 'rgba(0,229,255,0.3)';
  ctx.fillText('HUNTDOWN', W / 2, 56);
  ctx.fillStyle = PAL.neonCyan;
  ctx.fillText('HUNTDOWN', W / 2, 56);
  const json = makeJSON(W, H, [{ name: 'title', duration: 100 }], []);
  saveSheet(canvas, json, 'ui_title');
}

// 结算面板
{
  const W = 320, H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // 面板背景
  px(ctx, 0, 0, W, H, 'rgba(10,10,30,0.92)');
  // 霓虹边框
  ctx.strokeStyle = PAL.neonCyan; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = PAL.neonPink; ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  // 四角装饰
  for (const [x, y] of [[0, 0], [W - 8, 0], [0, H - 8], [W - 8, H - 8]]) {
    px(ctx, x, y, 8, 2, PAL.neonYellow);
    px(ctx, x, y, 2, 8, PAL.neonYellow);
  }
  const json = makeJSON(W, H, [{ name: 'panel', duration: 100 }], []);
  saveSheet(canvas, json, 'ui_panel');
}

// CRT 扫描线贴图（可平铺）
{
  const W = 4, H = 4;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  px(ctx, 0, 0, W, 1, 'rgba(0,0,0,0.6)');
  px(ctx, 0, 2, W, 1, 'rgba(0,0,0,0.3)');
  const json = makeJSON(W, H, [{ name: 'crt', duration: 100 }], []);
  saveSheet(canvas, json, 'ui_crt');
}

console.log('Props/VFX/UI build complete.');
