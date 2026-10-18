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

// —— 通用侧脸（朝右 / +x）：后脑在左，鼻尖在右，单只可见眼睛 ——
// 占位 10 列（cx-5..cx+4）× 10 行（y..y+9）
function drawSideHead(ctx, cx, y, o) {
  const K = PAL.K;
  const skin = o.skin || PAL.b, skinHi = o.skinHi || PAL.c, skinSh = o.skinSh || PAL.a;
  const hair = o.hair, hairHi = o.hairHi;
  const hairline = cx - 1;      // 发际线：其左为后脑头发，其右为面部

  // 1px 描边轮廓（逐行 span）：圆颅 + 前突鼻尖
  const outline = [
    [0, cx - 4, 6], [1, cx - 5, 8], [2, cx - 5, 9], [3, cx - 5, 9],
    [4, cx - 5, 10], [5, cx - 5, 9], [6, cx - 5, 9],
    [7, cx - 4, 7], [8, cx - 4, 7], [9, cx - 3, 5],
  ];
  for (const [r, sx, w] of outline) px(ctx, sx, y + r, w, 1, K);

  // 逐行填充：后脑头发 + 面部（去掉 1px 描边）
  const fillRow = (r, sx, w) => {
    const ix = sx + 1, iw = w - 2;
    if (iw <= 0) return;
    if (hair) {                                   // 后脑头发
      const hw = Math.max(0, Math.min(iw, hairline - ix));
      if (hw > 0) {
        px(ctx, ix, y + r, hw, 1, hair);
        if (hairHi) px(ctx, ix, y + r, 1, 1, hairHi);   // 后脑高光
      }
    }
    const fx = Math.max(ix, hairline);            // 面部
    const fw = (hair && r < 2) ? 0 : (ix + iw - fx); // 头顶两行整行是头发
    if (fw > 0) px(ctx, fx, y + r, fw, 1, skin);
  };
  fillRow(1, cx - 4, 8); fillRow(2, cx - 4, 9); fillRow(3, cx - 4, 9);
  fillRow(5, cx - 4, 9); fillRow(6, cx - 4, 9); fillRow(7, cx - 3, 7); fillRow(8, cx - 3, 7);

  // 鼻梁行（r=4）：额外前突，整行高光
  px(ctx, cx - 4, y + 4, hair ? Math.max(0, hairline - (cx - 4)) : 0, 1, hair);
  px(ctx, Math.max(cx - 4, hairline), y + 4, (cx + 3) - Math.max(cx - 4, hairline), 1, skinHi);
  px(ctx, cx + 3, y + 4, 1, 1, skinHi);
  // 下巴阴影
  px(ctx, cx - 2, y + 9, 3, 1, skinSh);
  // 顶发高光 / 后脑弧高光
  if (hair) {
    px(ctx, cx - 3, y + 1, 4, 1, hairHi || hair);
    px(ctx, cx - 4, y + 2, 1, 5, hairHi || hair);
  }

  // —— 眼部 / 护目镜 / 面罩 ——
  if (o.style === 'mask') {
    for (let r = 2; r <= 6; r++) px(ctx, cx - 1, y + r, 4, 1, o.mask);
    px(ctx, cx - 1, y + 2, 4, 1, o.maskHi || '#f0f0f8');
    px(ctx, cx - 1, y + 6, 4, 1, o.maskSh || '#a0a0b0');
    px(ctx, cx + 1, y + 4, 1, 1, K);              // 单眼孔
    px(ctx, cx - 2, y + 5, 1, 1, '#9090a0');      // 呼吸阀
  } else if (o.visor) {
    px(ctx, cx - 1, y + 3, 4, 2, o.visor);        // 单片护目镜横带
    px(ctx, cx + 2, y + 3, 1, 1, '#ffffff');      // 高光
    px(ctx, cx - 1, y + 4, 1, 1, o.visorLo || o.visor);
  } else {
    px(ctx, cx + 1, y + 3, 1, 2, K);              // 单眼
    px(ctx, cx + 1, y + 3, 1, 1, o.eyeGlow || PAL.u);
    px(ctx, cx - 1, y + 2, 2, 1, skinSh);         // 眉
  }

  // 莫西干发型
  if (o.style === 'mohawk' && hair) {
    px(ctx, cx - 2, y - 1, 2, 2, o.mohawk || '#a8243a');
    px(ctx, cx - 1, y - 2, 2, 1, o.mohawkHi || '#ff4757');
    px(ctx, cx - 2, y, 2, 1, PAL.d);
  }
  if (o.hurt) px(ctx, cx - 1, y + 2, 4, 4, PAL.w);
}

function drawPlayerHead(ctx, cx, y, hurt) {
  drawSideHead(ctx, cx, y, {
    hair: PAL.d, hairHi: PAL.e, visor: PAL.t, visorLo: PAL.t, eyeGlow: PAL.u, hurt,
  });
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

  drawPlayerHead(ctx, PBC, 2 + oy, hurt);
  // 脖子（前倾）
  px(ctx, PBC - 1, 12 + oy, 3, 2, PAL.K);
  px(ctx, PBC, 12 + oy, 2, 2, PAL.b);

  // 躯干（侧视：胸口挺向 +x）
  px(ctx, PBC - 5, 13 + oy, 10, 11, PAL.K);    // 轮廓 x: PBC-5..PBC+4
  px(ctx, PBC - 4, 13 + oy, 9, 10, PAL.g);     // 机甲填充
  px(ctx, PBC - 4, 13 + oy, 9, 1, PAL.h);      // 顶部
  px(ctx, PBC - 4, 13 + oy, 1, 10, PAL.h);     // 背侧（-x）高光
  px(ctx, PBC + 3, 13 + oy, 2, 10, PAL.f);     // 前侧（+x）阴影
  px(ctx, PBC + 4, 13 + oy, 1, 10, PAL.i);     // 胸前霓虹描边（朝前）
  // 胸前霓虹条
  px(ctx, PBC - 2, 15 + oy, 6, 1, PAL.i);
  px(ctx, PBC - 1, 19 + oy, 5, 1, PAL.t);
  // 背部装置（背包/推进器）
  px(ctx, PBC - 7, 14 + oy, 3, 8, PAL.K);
  px(ctx, PBC - 6, 15 + oy, 1, 6, PAL.e);
  px(ctx, PBC - 6, 20 + oy, 1, 2, PAL.i);
  // 腰带
  px(ctx, PBC - 5, 23 + oy, 10, 1, PAL.K);
  px(ctx, PBC - 4, 23 + oy, 9, 1, PAL.n);
  // 边缘光（霓虹描边）
  rimLight(ctx, PBC - 5, 13 + oy, 10, 10, PAL.t, true);
  drawPlayerLegs(ctx, legPhase, oy, shooting);
  drawPlayerArms(ctx, shooting, flash, oy, hurt);
}

function drawPlayerLegs(ctx, phase, oy, shooting) {
  const baseY = 24 + oy;
  const swing = Math.sin(phase * Math.PI / 4) * 2;      // 前后摆动
  const lift = Math.max(0, Math.sin(phase * Math.PI / 4)) * 1;
  // 后腿（-x 侧）
  px(ctx, PBC - 4 - swing, baseY - lift, 4, 5 + lift, PAL.K);
  px(ctx, PBC - 3 - swing, baseY - lift, 2, 4 + lift, PAL.m);
  px(ctx, PBC - 4 - swing, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC - 5 - swing, baseY + 4, 5, 1, PAL.o);
  // 前腿（+x 侧）
  px(ctx, PBC + 1 + swing, baseY - lift, 4, 5 + lift, PAL.K);
  px(ctx, PBC + 2 + swing, baseY - lift, 2, 4 + lift, PAL.m);
  px(ctx, PBC + 1 + swing, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC + 1 + swing, baseY + 4, 5, 1, PAL.o);
}

function drawPlayerArms(ctx, shooting, flash, oy, hurt) {
  const armY = 14 + oy;
  if (shooting) {
    // 前臂前伸持枪
    px(ctx, PBC + 3, armY + 1, 3, 3, PAL.K);
    px(ctx, PBC + 3, armY + 2, 2, 1, PAL.g);
    // 枪
    px(ctx, PBC + 6, armY, 7, 4, PAL.K);
    px(ctx, PBC + 7, armY + 1, 5, 2, PAL.q);
    px(ctx, PBC + 7, armY + 1, 5, 1, PAL.x);
    px(ctx, PBC + 6, armY + 3, 2, 2, PAL.p);
    if (flash) {
      px(ctx, PBC + 13, armY, 4, 5, PAL.r);
      px(ctx, PBC + 13, armY + 1, 3, 3, PAL.w);
    }
  } else {
    // 前臂自然下垂
    px(ctx, PBC + 1, armY + 2, 3, 7, PAL.K);
    px(ctx, PBC + 2, armY + 3, 1, 5, PAL.g);
    px(ctx, PBC + 1, armY + 8, 3, 2, PAL.K);
    px(ctx, PBC + 2, armY + 8, 2, 1, PAL.b);
  }
}

function drawPlayerCrouch(ctx, flash, oy) {
  const y = 10 + oy;
  drawPlayerHead(ctx, PBC, y - 1, 0);
  // 躯干（蹲伏前倾）
  px(ctx, PBC - 5, y + 9, 10, 7, PAL.K);
  px(ctx, PBC - 4, y + 9, 9, 6, PAL.g);
  px(ctx, PBC - 4, y + 9, 1, 6, PAL.h);
  px(ctx, PBC + 4, y + 9, 1, 6, PAL.i);
  px(ctx, PBC - 2, y + 11, 6, 1, PAL.i);
  // 后腿（屈膝）
  px(ctx, PBC - 5, y + 16, 5, 4, PAL.K);
  px(ctx, PBC - 4, y + 16, 3, 3, PAL.m);
  px(ctx, PBC - 5, y + 19, 5, 2, PAL.K);
  // 前腿（前伸）
  px(ctx, PBC + 1, y + 15, 6, 4, PAL.K);
  px(ctx, PBC + 2, y + 15, 4, 3, PAL.m);
  px(ctx, PBC + 2, y + 18, 5, 2, PAL.K);
  // 持枪前臂
  px(ctx, PBC + 6, y + 10, 7, 4, PAL.K);
  px(ctx, PBC + 7, y + 11, 5, 2, PAL.q);
  if (flash) {
    px(ctx, PBC + 13, y + 9, 4, 5, PAL.r);
    px(ctx, PBC + 13, y + 10, 3, 3, PAL.w);
  }
}

function drawPlayerJump(ctx, phase, oy) {
  const y = 3 + oy;
  drawPlayerHead(ctx, PBC, y - 1, 0);
  px(ctx, PBC - 1, y + 9, 3, 2, PAL.K);
  const tuck = phase === 1 ? 1 : 0;
  // 躯干
  px(ctx, PBC - 5, y + 10, 10, 9, PAL.K);
  px(ctx, PBC - 4, y + 10, 9, 8, PAL.g);
  px(ctx, PBC - 4, y + 10, 1, 8, PAL.h);
  px(ctx, PBC + 4, y + 10, 1, 8, PAL.i);
  px(ctx, PBC - 2, y + 12, 6, 1, PAL.i);
  // 腿部（腾空收起）
  const legY = y + 19 + tuck;
  px(ctx, PBC - 4, legY, 4, 4 - tuck, PAL.K);
  px(ctx, PBC - 3, legY, 2, 3 - tuck, PAL.m);
  px(ctx, PBC - 5, legY + 2 - tuck, 4, 2, PAL.K);
  px(ctx, PBC + 1, legY, 5, 4 - tuck, PAL.K);
  px(ctx, PBC + 2, legY, 3, 3 - tuck, PAL.m);
  px(ctx, PBC + 2, legY + 2 - tuck, 5, 2, PAL.K);
  // 前臂
  px(ctx, PBC + 1, y + 11, 3, 6, PAL.K);
  px(ctx, PBC + 2, y + 12, 1, 4, PAL.g);
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
  const opts = { skin: PAL.b, skinHi: PAL.c, skinSh: PAL.a, hurt };
  if (variant.mask) {                                  // 面罩
    opts.style = 'mask'; opts.mask = variant.mask;
    opts.hair = '#2a2a3a'; opts.hairHi = '#3a3a4a';
  } else if (variant.weapon === 'smg') {               // 莫西干
    opts.style = 'mohawk'; opts.hair = PAL.d; opts.hairHi = '#3a2030';
    opts.mohawk = variant.hairHi; opts.mohawkHi = variant.trim;
  }                                                    // 秃头：无头发
  drawSideHead(ctx, cx, y, opts);
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
  drawThugHead(ctx, PBC, y - 1, variant, 0);
  // 躯干（侧视蹲伏）
  px(ctx, PBC - 5, y + 9, 10, 7, PAL.K);
  px(ctx, PBC - 4, y + 9, 9, 6, variant.jacket);
  px(ctx, PBC - 4, y + 9, 1, 6, PAL.n);
  px(ctx, PBC + 4, y + 9, 1, 6, variant.trim);
  px(ctx, PBC - 3, y + 11, 8, 1, variant.trim);
  // 后腿（屈膝）
  px(ctx, PBC - 5, y + 16, 5, 4, PAL.K);
  px(ctx, PBC - 4, y + 16, 3, 3, PAL.l);
  px(ctx, PBC - 5, y + 19, 5, 2, PAL.K);
  // 前腿（前伸）
  px(ctx, PBC + 1, y + 15, 6, 4, PAL.K);
  px(ctx, PBC + 2, y + 15, 4, 3, PAL.l);
  px(ctx, PBC + 2, y + 18, 5, 2, PAL.K);
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
  drawThugHead(ctx, PBC, 2 + oy, variant, spec.pose === 'hurt');
  // 脖子
  px(ctx, PBC - 1, 12 + oy, 3, 1, variant.hair || PAL.b);
  // 躯干（侧视：略窄，胸口朝 +x）
  px(ctx, PBC - 5, 13 + oy, 10, 10, PAL.K);        // 轮廓 x: PBC-5..PBC+4
  px(ctx, PBC - 4, 13 + oy, 9, 9, variant.jacket);  // 夹克填充
  px(ctx, PBC - 4, 13 + oy, 9, 1, variant.jacketHi);// 肩部高光
  px(ctx, PBC - 4, 13 + oy, 1, 9, PAL.n);           // 背侧阴影
  px(ctx, PBC + 3, 13 + oy, 2, 9, variant.jacketHi);// 前侧亮面
  px(ctx, PBC + 4, 13 + oy, 1, 9, variant.trim);    // 胸前霓虹描边
  px(ctx, PBC - 3, 16 + oy, 8, 1, variant.trim);    // 胸前横带
  if (variant.chain) {
    px(ctx, PBC - 2, 15 + oy, 5, 1, variant.chain);
    px(ctx, PBC + 1, 16 + oy, 2, 2, variant.chain);
  }
  // 腰带
  px(ctx, PBC - 5, 22 + oy, 10, 2, PAL.K);
  px(ctx, PBC - 4, 22 + oy, 9, 1, PAL.n);
  rimLight(ctx, PBC - 5, 13 + oy, 10, 9, PAL.t, true);
  // 腿（前后错开）
  const legPhase = spec.legPhase || 0;
  const swing = Math.sin(legPhase * Math.PI / 4) * 1.5;
  px(ctx, PBC - 4 - swing, 24 + oy, 4, 5, PAL.K);
  px(ctx, PBC - 3 - swing, 24 + oy, 2, 4, PAL.l);
  px(ctx, PBC - 4 - swing, 28 + oy, 4, 2, PAL.K);
  px(ctx, PBC - 4 - swing, 28 + oy, 3, 1, PAL.n);
  px(ctx, PBC + 1 + swing, 24 + oy, 4, 5, PAL.K);
  px(ctx, PBC + 2 + swing, 24 + oy, 2, 4, PAL.l);
  px(ctx, PBC + 1 + swing, 28 + oy, 4, 2, PAL.K);
  px(ctx, PBC + 1 + swing, 28 + oy, 3, 1, PAL.n);
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
  drawSideHead(ctx, cx, y, {
    hair: '#2a1a3a', hairHi: '#43285f', skin: PAL.b, skinHi: PAL.c, visor: '#b06bff', hurt,
  });
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
  drawBossHead(ctx, BBC, 1 + oy, spec.pose === 'hurt');
  // 颈部（侧视）
  px(ctx, BBC - 2, 11 + oy, 5, 2, PAL.a);
  px(ctx, BBC - 2, 11 + oy, 1, 2, '#5a3a2a');
  // 躯干（侧视：厚重，背甲在 -x，胸口朝 +x）
  px(ctx, BBC - 7, 13 + oy, 13, 12, PAL.K);           // 轮廓 x: BBC-7..BBC+5
  px(ctx, BBC - 6, 13 + oy, 11, 11, '#43285f');        // 填充
  px(ctx, BBC - 6, 13 + oy, 11, 1, '#6a4a8f');         // 肩部高光
  px(ctx, BBC - 6, 13 + oy, 1, 11, '#5a3a7f');         // 背侧阴影
  px(ctx, BBC - 6, 15 + oy, 11, 1, '#5a3a7f');         // 背部横槽
  px(ctx, BBC + 5, 13 + oy, 1, 11, '#6a4a8f');         // 前侧亮面
  px(ctx, BBC - 4, 14 + oy, 9, 1, '#b06bff');          // 胸前霓虹
  // 腰带
  px(ctx, BBC - 7, 24 + oy, 13, 3, PAL.K);
  px(ctx, BBC - 6, 24 + oy, 11, 2, '#1a1520');
  px(ctx, BBC - 1, 24 + oy, 2, 3, '#b06bff');
  // 边缘光
  rimLight(ctx, BBC - 7, 13 + oy, 13, 11, PAL.t, true);
  rimLight(ctx, BBC - 7, 13 + oy, 13, 11, '#b06bff', false);
  // 腿（前后错开）
  const legPhase = spec.legPhase || 0;
  const swing = Math.sin(legPhase * Math.PI / 3) * 1;
  px(ctx, BBC - 6, 26 + oy, 5, 5, PAL.K);
  px(ctx, BBC - 5, 26 + oy, 3, 4, '#20202c');
  px(ctx, BBC - 6, 30 + oy, 5, 2, PAL.K);
  px(ctx, BBC - 5, 30 + oy, 4, 1, PAL.n);
  px(ctx, BBC + 1 + swing, 26 + oy, 5, 5, PAL.K);
  px(ctx, BBC + 2 + swing, 26 + oy, 3, 4, '#20202c');
  px(ctx, BBC + 1 + swing, 30 + oy, 5, 2, PAL.K);
  px(ctx, BBC + 2 + swing, 30 + oy, 4, 1, PAL.n);
  // 背甲后臂（-x 侧）
  px(ctx, BBC - 8, 14 + oy, 3, 8, PAL.K);
  px(ctx, BBC - 7, 15 + oy, 2, 6, '#43285f');
  px(ctx, BBC - 8, 21 + oy, 3, 2, PAL.K);
  px(ctx, BBC - 7, 22 + oy, 2, 1, PAL.b);
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
