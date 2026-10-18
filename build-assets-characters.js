// build-assets.js —— 生成全部 PNG 精灵图 + Aseprite 风格 JSON 元数据
// 用法：node build-assets.js
// 依赖：canvas (npm i canvas)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

// ============================================================
// 通用工具
// ============================================================
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function rimLight(ctx, x, y, w, h, color, leftSide) {
  if (leftSide) px(ctx, x, y, 1, h, color);
  else px(ctx, x + w - 1, y, 1, h, color);
}

// 24 色赛博朋克调色板
const PAL = {
  K: '#0a0a14', a: '#7a4a2a', b: '#b8784e', c: '#e0a878',
  d: '#1a1020', e: '#3a2848', f: '#1a2a3a', g: '#2a4a5a',
  h: '#3a6a7a', i: '#00e5ff', j: '#2a1a2a', k: '#4a2a3a',
  l: '#1a1a2a', m: '#2a2a44', n: '#0a0a10', o: '#1a1a28',
  p: '#1a1a22', q: '#3a3a48', r: '#fff0a0', t: '#ff2e88',
  u: '#00e5ff', v: '#cc1a3a', w: '#ffffff', x: '#5a5a7a',
};

function saveSheet(canvas, json, name) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, name + '.png'), buf);
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(json, null, 2));
  console.log('  ✓', name, canvas.width + 'x' + canvas.height, '(' + json.frames.length + ' frames)');
}

// Aseprite-style JSON 输出
function makeAsepriteJSON(frameW, frameH, frames, metaTags) {
  return {
    frames: frames.map((f, i) => ({
      filename: f.name || (i + '.png'),
      frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
      sourceSize: { w: frameW, h: frameH },
      duration: f.duration || 100,
    })),
    meta: {
      app: 'neon-huntdown-build',
      version: '1.0',
      image: '',
      format: 'RGBA8888',
      size: { w: frameW * frames.length, h: frameH },
      scale: '1',
      frameTags: metaTags || [],
      layers: [{ name: 'default', opacity: 255, blendMode: 'normal' }],
    },
  };
}

// ============================================================
// 角色绘制（移植自 SpriteSheet.js，逻辑 32x32）
// ============================================================
const PBC = 16;

function drawPlayerHead(ctx, cx, y, hurt) {
  px(ctx, cx - 4, y, 8, 8, PAL.K);
  px(ctx, cx - 3, y + 1, 6, 6, PAL.b);
  px(ctx, cx - 3, y + 1, 1, 6, PAL.a);
  px(ctx, cx + 2, y + 1, 1, 6, PAL.a);
  px(ctx, cx - 2, y + 2, 4, 1, PAL.c);
  px(ctx, cx - 3, y + 3, 6, 2, PAL.K);
  px(ctx, cx - 2, y + 3, 2, 1, PAL.u);
  px(ctx, cx + 1, y + 3, 2, 1, PAL.t);
  px(ctx, cx - 3, y + 3, 1, 2, PAL.K);
  px(ctx, cx - 4, y, 8, 2, PAL.d);
  px(ctx, cx - 4, y + 1, 8, 1, PAL.e);
  px(ctx, cx - 4, y + 2, 1, 3, PAL.d);
  px(ctx, cx + 3, y + 2, 1, 3, PAL.d);
  px(ctx, cx - 4, y + 5, 1, 2, PAL.d);
  px(ctx, cx + 3, y + 5, 1, 2, PAL.d);
  px(ctx, cx - 1, y + 6, 2, 1, PAL.a);
  if (hurt) px(ctx, cx - 3, y + 3, 6, 2, PAL.w);
}

function drawPlayer(ctx, spec) {
  const bob = spec.bob || 0;
  const oy = -bob;
  const hurt = spec.pose === 'hurt' ? 1 : 0;
  const flash = spec.flash;
  if (spec.pose === 'death') { drawPlayerDeath(ctx, spec.phase); return; }
  if (spec.pose === 'crouch') { drawPlayerCrouch(ctx, flash, oy); return; }
  if (spec.pose === 'jump') { drawPlayerJump(ctx, spec.phase, oy); return; }
  const legPhase = spec.legPhase || 0;
  const shooting = spec.pose === 'shoot';
  drawPlayerHead(ctx, PBC, 3 + oy, hurt);
  px(ctx, PBC - 2, 11 + oy, 4, 2, PAL.b);
  px(ctx, PBC - 2, 11 + oy, 1, 2, PAL.a);
  px(ctx, PBC - 7, 13 + oy, 14, 10, PAL.K);
  px(ctx, PBC - 6, 13 + oy, 12, 9, PAL.g);
  px(ctx, PBC - 6, 13 + oy, 12, 1, PAL.h);
  px(ctx, PBC - 6, 21 + oy, 12, 1, PAL.f);
  px(ctx, PBC - 6, 13 + oy, 12, 1, PAL.i);
  px(ctx, PBC - 1, 13 + oy, 1, 9, PAL.i);
  px(ctx, PBC + 5, 13 + oy, 1, 9, PAL.i);
  px(ctx, PBC - 4, 15 + oy, 8, 5, PAL.k);
  px(ctx, PBC - 4, 15 + oy, 8, 1, PAL.j);
  px(ctx, PBC - 3, 16 + oy, 1, 3, PAL.j);
  px(ctx, PBC + 2, 16 + oy, 1, 3, PAL.j);
  px(ctx, PBC - 7, 22 + oy, 14, 2, PAL.K);
  px(ctx, PBC - 6, 22 + oy, 12, 1, PAL.n);
  px(ctx, PBC - 1, 22 + oy, 2, 2, PAL.x);
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.t, true);
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.u, false);
  drawPlayerLegs(ctx, legPhase, oy, shooting);
  drawPlayerArms(ctx, shooting, flash, oy, hurt);
}

function drawPlayerLegs(ctx, phase, oy, shooting) {
  const baseY = 24 + oy;
  const swing = Math.sin(phase * Math.PI / 4) * 2;
  const lift = Math.max(0, Math.sin(phase * Math.PI / 4)) * 1;
  px(ctx, PBC - 5, baseY - lift, 4, 5 + lift, PAL.K);
  px(ctx, PBC - 4, baseY - lift, 2, 4 + lift, PAL.m);
  px(ctx, PBC - 4, baseY - lift, 1, 4 + lift, PAL.l);
  px(ctx, PBC - 5, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC - 4, baseY + 4, 3, 1, PAL.o);
  px(ctx, PBC + 1 + swing, baseY, 4, 5, PAL.K);
  px(ctx, PBC + 2 + swing, baseY, 2, 4, PAL.m);
  px(ctx, PBC + 2 + swing, baseY, 1, 4, PAL.l);
  px(ctx, PBC + 1 + swing, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC + 2 + swing, baseY + 4, 3, 1, PAL.o);
}

function drawPlayerArms(ctx, shooting, flash, oy, hurt) {
  const armY = 14 + oy;
  if (shooting) {
    px(ctx, PBC - 6, armY, 3, 2, PAL.g);
    px(ctx, PBC - 4, armY, 4, 2, PAL.b);
    px(ctx, PBC + 2, armY, 3, 2, PAL.g);
    px(ctx, PBC + 4, armY, 4, 2, PAL.b);
    px(ctx, PBC + 7, armY - 1, 6, 4, PAL.K);
    px(ctx, PBC + 8, armY, 4, 2, PAL.q);
    px(ctx, PBC + 8, armY, 4, 1, PAL.x);
    px(ctx, PBC + 7, armY + 1, 2, 2, PAL.p);
    if (flash) {
      px(ctx, PBC + 13, armY - 1, 4, 5, PAL.r);
      px(ctx, PBC + 13, armY, 3, 3, PAL.w);
    }
  } else {
    px(ctx, PBC - 7, armY, 2, 6, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 4, PAL.g);
    px(ctx, PBC - 6, armY + 5, 2, 2, PAL.b);
    px(ctx, PBC + 5, armY, 2, 6, PAL.K);
    px(ctx, PBC + 5, armY + 1, 1, 4, PAL.g);
    px(ctx, PBC + 5, armY + 5, 2, 2, PAL.b);
    px(ctx, PBC + 6, armY + 4, 5, 3, PAL.K);
    px(ctx, PBC + 7, armY + 5, 3, 1, PAL.q);
  }
}

function drawPlayerCrouch(ctx, flash, oy) {
  const y = 10 + oy;
  drawPlayerHead(ctx, PBC, y, 0);
  px(ctx, PBC - 2, y + 8, 4, 1, PAL.b);
  px(ctx, PBC - 7, y + 9, 14, 7, PAL.K);
  px(ctx, PBC - 6, y + 9, 12, 6, PAL.g);
  px(ctx, PBC - 6, y + 9, 12, 1, PAL.i);
  px(ctx, PBC - 1, y + 9, 1, 6, PAL.i);
  px(ctx, PBC - 4, y + 11, 8, 3, PAL.k);
  px(ctx, PBC - 6, y + 16, 5, 4, PAL.K);
  px(ctx, PBC - 5, y + 16, 3, 3, PAL.m);
  px(ctx, PBC + 1, y + 16, 5, 4, PAL.K);
  px(ctx, PBC + 2, y + 16, 3, 3, PAL.m);
  px(ctx, PBC - 6, y + 19, 5, 2, PAL.K);
  px(ctx, PBC + 1, y + 19, 5, 2, PAL.K);
  px(ctx, PBC + 2, y + 10, 3, 2, PAL.g);
  px(ctx, PBC + 4, y + 10, 4, 2, PAL.b);
  px(ctx, PBC + 7, y + 9, 6, 4, PAL.K);
  px(ctx, PBC + 8, y + 10, 4, 2, PAL.q);
  if (flash) {
    px(ctx, PBC + 13, y + 8, 4, 5, PAL.r);
    px(ctx, PBC + 13, y + 9, 3, 3, PAL.w);
  }
}

function drawPlayerJump(ctx, phase, oy) {
  const y = 3 + oy;
  drawPlayerHead(ctx, PBC, y, 0);
  px(ctx, PBC - 2, y + 8, 4, 2, PAL.b);
  const tuck = phase === 1 ? 1 : 0;
  px(ctx, PBC - 7, y + 10, 14, 9, PAL.K);
  px(ctx, PBC - 6, y + 10, 12, 8, PAL.g);
  px(ctx, PBC - 6, y + 10, 12, 1, PAL.i);
  px(ctx, PBC - 1, y + 10, 1, 8, PAL.i);
  px(ctx, PBC - 4, y + 12, 8, 4, PAL.k);
  px(ctx, PBC - 7, y + 18, 14, 2, PAL.K);
  px(ctx, PBC - 6, y + 18, 12, 1, PAL.n);
  const legY = y + 20 + tuck;
  px(ctx, PBC - 5, legY, 4, 3 + tuck, PAL.K);
  px(ctx, PBC - 4, legY, 2, 2 + tuck, PAL.m);
  px(ctx, PBC + 1, legY, 4, 3 + tuck, PAL.K);
  px(ctx, PBC + 2, legY, 2, 2 + tuck, PAL.m);
  px(ctx, PBC - 5, legY + 3, 4, 2, PAL.K);
  px(ctx, PBC + 1, legY + 3, 4, 2, PAL.K);
  px(ctx, PBC - 8, y + 10, 2, 4, PAL.K);
  px(ctx, PBC - 7, y + 11, 1, 2, PAL.g);
  px(ctx, PBC + 6, y + 10, 2, 4, PAL.K);
  px(ctx, PBC + 6, y + 11, 1, 2, PAL.g);
}

function drawPlayerDeath(ctx, phase) {
  const t = phase / 7;
  const fallX = PBC + 2 + t * 6;
  const fallY = 16 + t * 8;
  ctx.save();
  ctx.translate(fallX, fallY);
  ctx.rotate(t * Math.PI / 2 * 0.3);
  ctx.translate(-PBC, -fallY);
  px(ctx, PBC - 8, fallY, 16, 6, PAL.K);
  px(ctx, PBC - 7, fallY + 1, 14, 4, PAL.g);
  px(ctx, PBC - 7, fallY + 1, 14, 1, PAL.i);
  px(ctx, PBC + 6, fallY - 2, 6, 6, PAL.K);
  px(ctx, PBC + 7, fallY - 1, 4, 4, PAL.b);
  px(ctx, PBC + 7, fallY, 4, 1, PAL.c);
  px(ctx, PBC + 7, fallY + 1, 4, 1, PAL.K);
  px(ctx, PBC + 6, fallY - 2, 6, 2, PAL.d);
  px(ctx, PBC - 12, fallY + 1, 5, 3, PAL.K);
  px(ctx, PBC - 11, fallY + 2, 3, 1, PAL.m);
  px(ctx, PBC - 16, fallY + 2, 5, 2, PAL.K);
  const bloodR = 2 + t * 4;
  px(ctx, PBC - 2, fallY - 1, bloodR, 2, PAL.v);
  px(ctx, PBC - 1, fallY + 3, bloodR + 1, 1, PAL.v);
  if (phase > 2) px(ctx, PBC + 4, fallY + 4, 3, 1, PAL.v);
  ctx.restore();
}

const PLAYER_SPECS = [
  { pose: 'idle', bob: 0 }, { pose: 'idle', bob: 1 }, { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 }, { pose: 'idle', bob: 0 }, { pose: 'idle', bob: 1 },
  { pose: 'run', legPhase: 0 }, { pose: 'run', legPhase: 1 }, { pose: 'run', legPhase: 2 },
  { pose: 'run', legPhase: 3 }, { pose: 'run', legPhase: 4 }, { pose: 'run', legPhase: 5 },
  { pose: 'run', legPhase: 6 }, { pose: 'run', legPhase: 7 },
  { pose: 'shoot', flash: true }, { pose: 'shoot', flash: false }, { pose: 'shoot', flash: false },
  { pose: 'crouch', flash: true }, { pose: 'crouch', flash: false }, { pose: 'crouch', flash: false },
  { pose: 'jump', phase: 0 }, { pose: 'jump', phase: 1 }, { pose: 'jump', phase: 2 },
  { pose: 'hurt' }, { pose: 'hurt' },
  { pose: 'death', phase: 0 }, { pose: 'death', phase: 1 }, { pose: 'death', phase: 2 },
  { pose: 'death', phase: 3 }, { pose: 'death', phase: 4 }, { pose: 'death', phase: 5 },
  { pose: 'death', phase: 6 }, { pose: 'death', phase: 7 },
];

// —— 杂兵 ——
const THUG_VARIANTS = {
  mohawk: { hair: PAL.d, hairHi: '#a8243a', jacket: '#6a1a2a', jacketHi: '#9c2135', trim: '#ff4757', weapon: 'smg' },
  mask: { hair: '#2a2a3a', hairHi: '#3a3a4a', jacket: '#2a3a2a', jacketHi: '#3a5a3a', trim: '#39ff88', weapon: 'shotgun', mask: '#d8d8e0' },
  bald: { hair: PAL.b, hairHi: PAL.c, jacket: '#3a2a1a', jacketHi: '#5a4a2a', trim: '#ffd700', weapon: 'bat', chain: '#ffd700' },
};

function drawThugHead(ctx, cx, y, variant, hurt) {
  px(ctx, cx - 4, y, 8, 8, PAL.K);
  px(ctx, cx - 3, y + 1, 6, 6, PAL.b);
  px(ctx, cx - 3, y + 1, 1, 6, PAL.a);
  if (variant.mask) {
    px(ctx, cx - 3, y + 2, 6, 5, variant.mask);
    px(ctx, cx - 3, y + 2, 6, 1, '#f0f0f8');
    px(ctx, cx - 2, y + 4, 1, 1, PAL.K);
    px(ctx, cx + 1, y + 4, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 6, 2, 1, PAL.K);
    px(ctx, cx - 3, y + 3, 1, 1, '#a0a0b0');
  } else if (variant.weapon === 'bat') {
    px(ctx, cx - 3, y + 1, 6, 2, PAL.b);
    px(ctx, cx - 2, y + 3, 1, 1, PAL.K);
    px(ctx, cx + 1, y + 3, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 5, 3, 1, PAL.a);
    px(ctx, cx - 3, y + 6, 6, 1, PAL.a);
  } else {
    px(ctx, cx - 2, y + 3, 1, 1, PAL.K);
    px(ctx, cx + 1, y + 3, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 5, 2, 1, PAL.a);
  }
  if (variant.weapon === 'smg') {
    px(ctx, cx - 1, y - 2, 2, 3, variant.hairHi);
    px(ctx, cx - 1, y, 2, 1, variant.hairHi);
    px(ctx, cx - 4, y, 8, 1, PAL.d);
    px(ctx, cx - 4, y + 1, 1, 2, PAL.d);
    px(ctx, cx + 3, y + 1, 1, 2, PAL.d);
  }
}

function drawThugArms(ctx, variant, shooting, aiming, flash, oy) {
  const armY = 14 + oy;
  if (variant.weapon === 'bat') {
    px(ctx, PBC - 7, armY, 2, 5, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 3, variant.jacket);
    px(ctx, PBC + 5, armY, 2, 5, PAL.K);
    px(ctx, PBC + 5, armY + 1, 1, 3, variant.jacket);
    px(ctx, PBC + 6, armY - 2, 2, 12, PAL.K);
    px(ctx, PBC + 6, armY - 2, 1, 11, '#8a5a2a');
    px(ctx, PBC + 6, armY - 2, 1, 1, '#a87a4a');
  } else {
    px(ctx, PBC - 7, armY, 2, 5, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 3, variant.jacket);
    px(ctx, PBC + 3, armY, 3, 2, variant.jacket);
    px(ctx, PBC + 5, armY, 3, 2, PAL.b);
    if (variant.weapon === 'smg') {
      px(ctx, PBC + 7, armY - 1, 7, 4, PAL.K);
      px(ctx, PBC + 8, armY, 5, 2, PAL.q);
      px(ctx, PBC + 8, armY, 5, 1, PAL.x);
      px(ctx, PBC + 7, armY + 2, 3, 3, PAL.p);
      if (flash) {
        px(ctx, PBC + 14, armY - 1, 3, 4, PAL.r);
        px(ctx, PBC + 14, armY, 2, 2, PAL.w);
      }
    } else {
      px(ctx, PBC + 7, armY - 1, 9, 4, PAL.K);
      px(ctx, PBC + 8, armY, 7, 2, PAL.q);
      px(ctx, PBC + 8, armY, 7, 1, PAL.x);
      px(ctx, PBC + 7, armY + 1, 2, 3, '#5a3a1a');
      if (flash) {
        px(ctx, PBC + 16, armY - 2, 4, 5, PAL.r);
        px(ctx, PBC + 16, armY - 1, 3, 3, PAL.w);
      }
    }
  }
}

function drawThugCrouch(ctx, variant, oy) {
  const y = 10 + oy;
  drawThugHead(ctx, PBC, y, variant, 0);
  px(ctx, PBC - 2, y + 8, 4, 1, PAL.b);
  px(ctx, PBC - 7, y + 9, 14, 7, PAL.K);
  px(ctx, PBC - 6, y + 9, 12, 6, variant.jacket);
  px(ctx, PBC - 6, y + 9, 12, 1, variant.trim);
  px(ctx, PBC - 1, y + 9, 1, 6, variant.trim);
  px(ctx, PBC - 6, y + 16, 5, 4, PAL.K);
  px(ctx, PBC - 5, y + 16, 3, 3, PAL.l);
  px(ctx, PBC + 1, y + 16, 5, 4, PAL.K);
  px(ctx, PBC + 2, y + 16, 3, 3, PAL.l);
  px(ctx, PBC - 6, y + 19, 5, 2, PAL.K);
  px(ctx, PBC + 1, y + 19, 5, 2, PAL.K);
}

function drawThugDeath(ctx, phase, variant) {
  const t = phase / 5;
  const fallX = PBC + 2 + t * 6;
  const fallY = 16 + t * 8;
  ctx.save();
  ctx.translate(fallX, fallY);
  ctx.rotate(t * 1.2);
  ctx.translate(-PBC, -fallY);
  px(ctx, PBC - 8, fallY, 16, 6, PAL.K);
  px(ctx, PBC - 7, fallY + 1, 14, 4, variant.jacket);
  px(ctx, PBC + 6, fallY - 2, 6, 6, PAL.K);
  px(ctx, PBC + 7, fallY - 1, 4, 4, PAL.b);
  if (variant.weapon === 'smg') px(ctx, PBC + 6, fallY - 3, 2, 2, variant.hairHi);
  px(ctx, PBC - 12, fallY + 1, 5, 3, PAL.K);
  px(ctx, PBC - 11, fallY + 2, 3, 1, PAL.l);
  px(ctx, PBC - 2, fallY - 1, 4 + t * 3, 2, PAL.v);
  px(ctx, PBC, fallY + 4, 3 + t * 2, 1, PAL.v);
  ctx.restore();
}

function drawThug(ctx, spec) {
  const variant = THUG_VARIANTS[spec.variant || 'mohawk'];
  const bob = spec.bob || 0;
  const oy = -bob;
  if (spec.pose === 'death') { drawThugDeath(ctx, spec.phase, variant); return; }
  if (spec.pose === 'crouch') { drawThugCrouch(ctx, variant, oy); return; }
  const shooting = spec.pose === 'shoot';
  const aiming = spec.pose === 'aim';
  drawThugHead(ctx, PBC, 3 + oy, variant, spec.pose === 'hurt');
  px(ctx, PBC - 2, 11 + oy, 4, 2, variant.hair);
  px(ctx, PBC - 7, 13 + oy, 14, 10, PAL.K);
  px(ctx, PBC - 6, 13 + oy, 12, 9, variant.jacket);
  px(ctx, PBC - 6, 13 + oy, 12, 1, variant.jacketHi);
  px(ctx, PBC - 6, 21 + oy, 12, 1, PAL.K);
  px(ctx, PBC - 6, 13 + oy, 12, 1, variant.trim);
  px(ctx, PBC - 1, 13 + oy, 1, 9, variant.trim);
  px(ctx, PBC - 6, 13 + oy, 2, 1, PAL.x);
  px(ctx, PBC + 4, 13 + oy, 2, 1, PAL.x);
  if (variant.chain) {
    px(ctx, PBC - 3, 14 + oy, 6, 1, variant.chain);
    px(ctx, PBC - 1, 15 + oy, 2, 2, variant.chain);
  }
  px(ctx, PBC - 7, 22 + oy, 14, 2, PAL.K);
  px(ctx, PBC - 6, 22 + oy, 12, 1, PAL.n);
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.t, true);
  const legPhase = spec.legPhase || 0;
  const swing = Math.sin(legPhase * Math.PI / 4) * 1.5;
  px(ctx, PBC - 5, 24 + oy, 4, 5, PAL.K);
  px(ctx, PBC - 4, 24 + oy, 2, 4, PAL.l);
  px(ctx, PBC - 5, 28 + oy, 4, 2, PAL.K);
  px(ctx, PBC - 4, 28 + oy, 3, 1, PAL.n);
  px(ctx, PBC + 1 + swing, 24 + oy, 4, 5, PAL.K);
  px(ctx, PBC + 2 + swing, 24 + oy, 2, 4, PAL.l);
  px(ctx, PBC + 1 + swing, 28 + oy, 4, 2, PAL.K);
  px(ctx, PBC + 2 + swing, 28 + oy, 3, 1, PAL.n);
  drawThugArms(ctx, variant, shooting, aiming, spec.flash, oy);
}

function buildThugSpecs(variant) {
  return [
    { pose: 'idle', variant, bob: 0 }, { pose: 'idle', variant, bob: 1 },
    { pose: 'idle', variant, bob: 0 }, { pose: 'idle', variant, bob: 1 },
    { pose: 'walk', variant, legPhase: 0 }, { pose: 'walk', variant, legPhase: 1 },
    { pose: 'walk', variant, legPhase: 2 }, { pose: 'walk', variant, legPhase: 3 },
    { pose: 'walk', variant, legPhase: 4 }, { pose: 'walk', variant, legPhase: 5 },
    { pose: 'aim', variant }, { pose: 'aim', variant },
    { pose: 'shoot', variant, flash: true }, { pose: 'shoot', variant, flash: false },
    { pose: 'crouch', variant }, { pose: 'crouch', variant },
    { pose: 'hurt', variant }, { pose: 'hurt', variant },
    { pose: 'death', variant, phase: 0 }, { pose: 'death', variant, phase: 1 },
    { pose: 'death', variant, phase: 2 }, { pose: 'death', variant, phase: 3 },
    { pose: 'death', variant, phase: 4 }, { pose: 'death', variant, phase: 5 },
  ];
}

// —— Boss ——
const BBC = 16;

function drawBossHead(ctx, cx, y, hurt) {
  px(ctx, cx - 5, y, 10, 9, PAL.K);
  px(ctx, cx - 4, y + 1, 8, 7, PAL.b);
  px(ctx, cx - 4, y + 1, 1, 7, PAL.a);
  px(ctx, cx - 3, y + 2, 6, 1, PAL.c);
  px(ctx, cx - 4, y + 3, 8, 2, PAL.K);
  px(ctx, cx - 3, y + 3, 3, 1, '#b06bff');
  px(ctx, cx + 1, y + 3, 3, 1, '#b06bff');
  px(ctx, cx - 3, y + 4, 3, 1, '#d090ff');
  px(ctx, cx + 1, y + 4, 3, 1, '#d090ff');
  px(ctx, cx - 5, y, 10, 2, PAL.d);
  px(ctx, cx - 5, y + 1, 10, 1, '#3a2848');
  px(ctx, cx - 2, y + 6, 4, 1, PAL.a);
  if (hurt) px(ctx, cx - 4, y + 3, 8, 2, PAL.w);
}

function drawBossMechArm(ctx, shooting, flash, oy, charging) {
  const armY = 14 + oy;
  px(ctx, BBC + 5, armY, 4, 8, PAL.K);
  px(ctx, BBC + 6, armY + 1, 2, 6, PAL.p);
  px(ctx, BBC + 6, armY + 1, 1, 6, PAL.x);
  px(ctx, BBC + 6, armY + 3, 2, 1, '#b06bff');
  px(ctx, BBC + 6, armY + 6, 2, 1, '#b06bff');
  const gunX = BBC + 9;
  px(ctx, gunX, armY - 1, 8, 5, PAL.K);
  px(ctx, gunX + 1, armY, 6, 3, PAL.q);
  px(ctx, gunX + 1, armY, 6, 1, PAL.x);
  px(ctx, gunX + 6, armY, 3, 1, PAL.p);
  px(ctx, gunX + 6, armY + 2, 3, 1, PAL.p);
  px(ctx, gunX + 7, armY + 1, 2, 1, PAL.p);
  if (shooting) {
    px(ctx, gunX + 1, armY + 1, 2, 1, '#ff4757');
    if (flash) {
      px(ctx, gunX + 8, armY - 2, 5, 7, PAL.r);
      px(ctx, gunX + 8, armY - 1, 4, 5, PAL.w);
    }
  }
  px(ctx, gunX - 1, armY + 4, 3, 1, PAL.x);
  px(ctx, gunX - 2, armY + 5, 2, 1, PAL.x);
}

function drawBossDeath(ctx, phase) {
  const t = phase / 5;
  const fallY = 20 + t * 10;
  ctx.save();
  ctx.translate(BBC, fallY);
  ctx.rotate(t * 1.0);
  ctx.translate(-BBC, -fallY);
  px(ctx, BBC - 10, fallY, 20, 7, PAL.K);
  px(ctx, BBC - 9, fallY + 1, 18, 5, '#43285f');
  px(ctx, BBC + 8, fallY - 3, 8, 8, PAL.K);
  px(ctx, BBC + 9, fallY - 2, 6, 6, PAL.b);
  px(ctx, BBC + 9, fallY, 6, 1, '#b06bff');
  if (phase >= 2) {
    const ex = 3 + t * 4;
    px(ctx, BBC - 3, fallY - 2, ex, 3, PAL.r);
    px(ctx, BBC - 2, fallY + 5, ex + 1, 2, '#ff8a3d');
    px(ctx, BBC, fallY - 4, 2, 2, PAL.w);
  }
  px(ctx, BBC - 14, fallY + 1, 6, 4, PAL.K);
  px(ctx, BBC - 13, fallY + 2, 4, 2, '#20202c');
  ctx.restore();
}

function drawBoss(ctx, spec) {
  const bob = spec.bob || 0;
  const oy = -bob;
  if (spec.pose === 'death') { drawBossDeath(ctx, spec.phase); return; }
  const shooting = spec.pose === 'gatling';
  drawBossHead(ctx, BBC, 2 + oy, spec.pose === 'hurt');
  px(ctx, BBC - 3, 10 + oy, 6, 3, PAL.a);
  px(ctx, BBC - 3, 10 + oy, 1, 3, '#5a3a2a');
  px(ctx, BBC - 9, 13 + oy, 18, 12, PAL.K);
  px(ctx, BBC - 8, 13 + oy, 16, 11, '#43285f');
  px(ctx, BBC - 8, 13 + oy, 16, 1, '#6a4a8f');
  px(ctx, BBC - 8, 13 + oy, 16, 2, '#5a3a7f');
  px(ctx, BBC - 8, 13 + oy, 1, 11, '#6a4a8f');
  px(ctx, BBC + 7, 13 + oy, 1, 11, '#6a4a8f');
  px(ctx, BBC - 8, 13 + oy, 16, 1, '#b06bff');
  px(ctx, BBC - 1, 13 + oy, 1, 11, '#b06bff');
  px(ctx, BBC - 9, 24 + oy, 18, 3, PAL.K);
  px(ctx, BBC - 8, 24 + oy, 16, 2, '#1a1520');
  px(ctx, BBC - 1, 24 + oy, 2, 3, '#b06bff');
  rimLight(ctx, BBC - 9, 13 + oy, 18, 11, PAL.t, true);
  rimLight(ctx, BBC - 9, 13 + oy, 18, 11, '#b06bff', false);
  const legPhase = spec.legPhase || 0;
  const swing = Math.sin(legPhase * Math.PI / 3) * 1;
  px(ctx, BBC - 7, 27 + oy, 6, 5, PAL.K);
  px(ctx, BBC - 6, 27 + oy, 4, 4, '#20202c');
  px(ctx, BBC - 7, 31 + oy, 6, 2, PAL.K);
  px(ctx, BBC - 6, 31 + oy, 5, 1, PAL.n);
  px(ctx, BBC + 1 + swing, 27 + oy, 6, 5, PAL.K);
  px(ctx, BBC + 2 + swing, 27 + oy, 4, 4, '#20202c');
  px(ctx, BBC + 1 + swing, 31 + oy, 6, 2, PAL.K);
  px(ctx, BBC + 2 + swing, 31 + oy, 5, 1, PAL.n);
  px(ctx, BBC - 10, 14 + oy, 3, 8, PAL.K);
  px(ctx, BBC - 9, 15 + oy, 2, 6, '#43285f');
  px(ctx, BBC - 10, 21 + oy, 3, 2, PAL.K);
  px(ctx, BBC - 9, 22 + oy, 2, 1, PAL.b);
  drawBossMechArm(ctx, shooting, spec.flash, oy, spec.pose === 'charge');
}

const BOSS_SPECS = [
  { pose: 'idle', bob: 0 }, { pose: 'idle', bob: 1 }, { pose: 'idle', bob: 0 }, { pose: 'idle', bob: 1 },
  { pose: 'walk', legPhase: 0 }, { pose: 'walk', legPhase: 1 }, { pose: 'walk', legPhase: 2 }, { pose: 'walk', legPhase: 3 },
  { pose: 'gatling', flash: true }, { pose: 'gatling', flash: false }, { pose: 'gatling', flash: true }, { pose: 'gatling', flash: false },
  { pose: 'charge' }, { pose: 'charge' },
  { pose: 'hurt' }, { pose: 'hurt' },
  { pose: 'death', phase: 0 }, { pose: 'death', phase: 1 }, { pose: 'death', phase: 2 },
  { pose: 'death', phase: 3 }, { pose: 'death', phase: 4 }, { pose: 'death', phase: 5 },
];

// ============================================================
// 构建角色 spritesheet（逻辑 32x32，pixel=2 → 64x64 帧）
// ============================================================
function buildCharacterSheet(logW, logH, pixel, specs, drawFn, frameTags) {
  const frameW = logW * pixel;
  const frameH = logH * pixel;
  const canvas = createCanvas(frameW * specs.length, frameH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < specs.length; i++) {
    ctx.save();
    ctx.translate(i * frameW, 0);
    ctx.scale(pixel, pixel);
    drawFn(ctx, specs[i]);
    ctx.restore();
  }
  const frames = specs.map((s, i) => ({ name: s.pose + '_' + i, duration: 100 }));
  const json = makeAsepriteJSON(frameW, frameH, frames, frameTags);
  return { canvas, json, frameW, frameH };
}

const PLAYER_TAGS = [
  { name: 'idle', from: 0, to: 5, direction: 'forward' },
  { name: 'run', from: 6, to: 13, direction: 'forward' },
  { name: 'shoot', from: 14, to: 16, direction: 'forward' },
  { name: 'crouch', from: 17, to: 19, direction: 'forward' },
  { name: 'jump', from: 20, to: 22, direction: 'forward' },
  { name: 'hurt', from: 23, to: 24, direction: 'forward' },
  { name: 'death', from: 25, to: 32, direction: 'forward' },
];
const THUG_TAGS = [
  { name: 'idle', from: 0, to: 3, direction: 'forward' },
  { name: 'walk', from: 4, to: 9, direction: 'forward' },
  { name: 'aim', from: 10, to: 11, direction: 'forward' },
  { name: 'shoot', from: 12, to: 13, direction: 'forward' },
  { name: 'crouch', from: 14, to: 15, direction: 'forward' },
  { name: 'hurt', from: 16, to: 17, direction: 'forward' },
  { name: 'death', from: 18, to: 23, direction: 'forward' },
];
const BOSS_TAGS = [
  { name: 'idle', from: 0, to: 3, direction: 'forward' },
  { name: 'walk', from: 4, to: 7, direction: 'forward' },
  { name: 'gatling', from: 8, to: 11, direction: 'forward' },
  { name: 'charge', from: 12, to: 13, direction: 'forward' },
  { name: 'hurt', from: 14, to: 15, direction: 'forward' },
  { name: 'death', from: 16, to: 21, direction: 'forward' },
];

console.log('Building character sprites...');
{
  const s = buildCharacterSheet(32, 32, 2, PLAYER_SPECS, drawPlayer, PLAYER_TAGS);
  saveSheet(s.canvas, s.json, 'player');
}
for (const v of ['mohawk', 'mask', 'bald']) {
  const s = buildCharacterSheet(32, 32, 2, buildThugSpecs(v), drawThug, THUG_TAGS);
  saveSheet(s.canvas, s.json, 'thug_' + v);
}
{
  const s = buildCharacterSheet(32, 32, 3, BOSS_SPECS, drawBoss, BOSS_TAGS);
  saveSheet(s.canvas, s.json, 'boss');
}

module.exports = { PAL, px, createCanvas, saveSheet, makeAsepriteJSON };
