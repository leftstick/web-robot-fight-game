// build-assets-bg.js —— 生成各关 4~5 层视差背景图片
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
const LOGICAL_W = 480;
const LOGICAL_H = 270;
const TILE_W = Math.round(LOGICAL_W * 1.2); // 576 —— 1.2 横向平铺

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function savePng(canvas, name) {
  fs.writeFileSync(path.join(OUT, name + '.png'), canvas.toBuffer('image/png'));
  console.log('  ✓', name, canvas.width + 'x' + canvas.height);
}

const NEON = ['#ff2e88', '#00e5ff', '#b14aed', '#39ff88', '#ff8a3d', '#ffe066'];

// 每层绘制函数。参数 ctx, w, h, r, palette
function drawSky(ctx, w, h, r, pal) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, pal.sky0);
  grd.addColorStop(0.5, pal.sky1);
  grd.addColorStop(1, pal.sky2);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  // 月亮/光晕
  const mx = w * 0.78, my = 50;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
  mg.addColorStop(0, pal.moon);
  mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  // 星星
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = r() * h * 0.5;
    const a = 0.3 + r() * 0.7;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawFar(ctx, w, h, r, pal) {
  // 远景天际线
  const base = h - 18;
  let x = -20;
  while (x < w + 20) {
    const bw = 50 + r() * 90;
    const bh = 70 + r() * 160;
    px(ctx, x, base - bh, bw, bh, pal.farBuild);
    // 顶部航标灯
    px(ctx, x + bw / 2 - 1, base - bh + 2, 2, 2, '#ff4757');
    // 全息广告
    if (r() < 0.35) {
      const hy = base - bh + 20 + r() * 60;
      px(ctx, x + bw * 0.2, hy, bw * 0.6, 5, pal.holo);
    }
    x += bw + 6;
  }
  // 地平线辉光
  const gg = ctx.createRadialGradient(w * 0.6, base - 30, 0, w * 0.6, base - 30, w * 0.5);
  gg.addColorStop(0, pal.horizon);
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, w, h);
}

function drawMid(ctx, w, h, r, pal) {
  const base = h - 12;
  let x = -30;
  while (x < w + 30) {
    const bw = 70 + r() * 110;
    const bh = 120 + r() * 180;
    px(ctx, x, base - bh, bw, bh, pal.midBuild);
    px(ctx, x, base - bh, 5, bh, 'rgba(0,0,0,0.35)');
    px(ctx, x + bw - 3, base - bh, 3, bh, 'rgba(255,255,255,0.05)');
    // 窗户
    const cols = Math.max(3, Math.floor(bw / 16));
    const rows = Math.max(4, Math.floor(bh / 22));
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (r() < 0.6) {
          const wx = x + 6 + cc * ((bw - 12) / cols);
          const wy = base - bh + 10 + rr * ((bh - 20) / rows);
          const ww = Math.max(3, (bw - 12) / cols - 7);
          const wh = Math.max(3, (bh - 20) / rows - 9);
          px(ctx, wx, wy, ww, wh, r() < 0.7 ? pal.win : NEON[Math.floor(r() * NEON.length)]);
        }
      }
    }
    // 霓虹招牌
    if (r() < 0.7) {
      const sy = base - bh + 12 + r() * (bh * 0.5);
      px(ctx, x + bw * 0.18, sy, bw * (0.3 + r() * 0.35), 5, pal.sign);
    }
    x += bw + 12;
  }
}

function drawNear(ctx, w, h, r, pal) {
  const base = h - 6;
  let x = -20;
  while (x < w + 20) {
    const bw = 60 + r() * 100;
    const kind = r();
    if (kind < 0.35) {
      // 店铺门面
      px(ctx, x, base - 52, bw, 52, pal.shop);
      px(ctx, x + 5, base - 48, bw - 10, 8, pal.neon1);
      px(ctx, x + 6, base - 38, bw * 0.45, 34, 'rgba(20,15,30,0.9)');
      px(ctx, x + bw * 0.55, base - 30, bw * 0.25, 30, '#0a0a14');
    } else if (kind < 0.6) {
      // 卷帘门
      px(ctx, x, base - 46, bw, 46, pal.shutter);
      for (let sy = base - 44; sy < base; sy += 5) {
        px(ctx, x, sy, bw, 1, 'rgba(0,0,0,0.4)');
      }
    } else if (kind < 0.8) {
      // 涂鸦墙
      px(ctx, x, base - 38, bw, 38, pal.wall);
      px(ctx, x + 8, base - 30, bw * 0.4, 3, pal.neon2);
      px(ctx, x + 12, base - 22, bw * 0.3, 2, pal.neon1);
    } else {
      // 电话亭/售货机
      px(ctx, x, base - 50, 18, 50, pal.phone);
      px(ctx, x + 2, base - 46, 14, 30, 'rgba(0,229,255,0.25)');
      px(ctx, x + 3, base - 48, 12, 3, '#ff2e88');
    }
    x += bw + 20 + r() * 60;
  }
}

function drawFg(ctx, w, h, r, pal) {
  // 前景剪影：路灯、电线杆、铁丝网
  const base = h - 2;
  let x = -40;
  while (x < w + 40) {
    if (r() < 0.5) {
      // 路灯
      px(ctx, x, base - 90, 3, 90, 'rgba(6,6,14,0.92)');
      px(ctx, x - 6, base - 90, 16, 3, 'rgba(6,6,14,0.92)');
      const lg = ctx.createRadialGradient(x + 1, base - 88, 0, x + 1, base - 88, 36);
      lg.addColorStop(0, 'rgba(255,224,102,0.4)');
      lg.addColorStop(1, 'rgba(255,224,102,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 40, base - 130, 84, 84);
      px(ctx, x, base - 90, 3, 3, '#ffe066');
    } else {
      // 电线杆
      px(ctx, x, base - 105, 3, 105, 'rgba(6,6,14,0.88)');
      px(ctx, x - 10, base - 98, 24, 2, 'rgba(6,6,14,0.88)');
      ctx.strokeStyle = 'rgba(50,50,70,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 8, base - 96);
      ctx.quadraticCurveTo(x + 50, base - 80, x + 110, base - 96);
      ctx.stroke();
    }
    x += 140 + r() * 180;
  }
  // 底部铁丝网
  ctx.fillStyle = 'rgba(6,6,14,0.7)';
  for (let x2 = 0; x2 < w; x2 += 12) {
    ctx.fillRect(x2, base - 3, 1, 6);
  }
  ctx.fillRect(0, base, w, 1);
}

// 地面层（近地面，含潮湿反光）
function drawGround(ctx, w, h, r, pal) {
  const base = h;
  // 沥青
  px(ctx, 0, h - 30, w, 30, '#0e0e18');
  px(ctx, 0, h - 30, w, 3, '#1a1a2a');
  // 霓虹反光条
  px(ctx, 0, h - 27, w, 2, 'rgba(255,46,136,0.15)');
  px(ctx, 0, h - 24, w, 1, 'rgba(0,229,255,0.1)');
  // 路面纹理
  for (let x = 0; x < w; x += 180) {
    px(ctx, x, h - 18, 60, 12, 'rgba(255,255,255,0.03)');
  }
}

const LEVEL_PALETTES = [
  { // Level 1: 霓虹街区
    sky0: '#06071a', sky1: '#0f0a28', sky2: '#1e0f30',
    moon: 'rgba(180,160,255,0.3)', farBuild: 'rgba(16,20,44,0.85)',
    holo: '#b14aed', horizon: 'rgba(255,46,136,0.18)',
    midBuild: '#171c30', win: '#ffd27a', sign: '#ff2e88',
    shop: '#1a1428', shutter: '#2a2438', wall: '#1c1830',
    phone: '#7a1a2a', neon1: '#ff2e88', neon2: '#00e5ff',
  },
  { // Level 2: 雨夜码头
    sky0: '#040812', sky1: '#08121e', sky2: '#0a1e2e',
    moon: 'rgba(120,180,220,0.25)', farBuild: 'rgba(12,20,32,0.85)',
    holo: '#39ff88', horizon: 'rgba(57,255,136,0.15)',
    midBuild: '#101e2a', win: '#9ad8ff', sign: '#39ff88',
    shop: '#0e1a22', shutter: '#1e2e38', wall: '#14242e',
    phone: '#1a4a5a', neon1: '#39ff88', neon2: '#00e5ff',
  },
  { // Level 3: 帮派老巢
    sky0: '#140404', sky1: '#240808', sky2: '#3a0c1a',
    moon: 'rgba(255,100,100,0.25)', farBuild: 'rgba(28,12,16,0.85)',
    holo: '#ff2e88', horizon: 'rgba(255,46,136,0.2)',
    midBuild: '#241018', win: '#ffaa66', sign: '#ff8a3d',
    shop: '#1e0e14', shutter: '#2e1a20', wall: '#241418',
    phone: '#5a1a2a', neon1: '#ff2e88', neon2: '#ff8a3d',
  },
];

console.log('Building backgrounds...');
for (let lv = 0; lv < 3; lv++) {
  const pal = LEVEL_PALETTES[lv];
  const id = lv + 1;
  // 天空层（0.05）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawSky(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 1), pal);
    savePng(c, `bg_level${id}_sky`);
  }
  // 远景（0.1）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawFar(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 2), pal);
    savePng(c, `bg_level${id}_far`);
  }
  // 中景（0.3）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawMid(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 3), pal);
    savePng(c, `bg_level${id}_mid`);
  }
  // 近景（0.6）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawNear(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 4), pal);
    savePng(c, `bg_level${id}_near`);
  }
  // 前景（1.0）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawFg(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 5), pal);
    savePng(c, `bg_level${id}_fg`);
  }
  // 地面（1.0）
  {
    const c = createCanvas(TILE_W, LOGICAL_H);
    const ctx = c.getContext('2d');
    drawGround(ctx, TILE_W, LOGICAL_H, rng(id * 100 + 6), pal);
    savePng(c, `bg_level${id}_ground`);
  }
}
console.log('Backgrounds build complete.');
