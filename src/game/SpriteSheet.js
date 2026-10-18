// 程序化像素 sprite sheet —— 80 年代赛博朋克横版动作射击
// 24 色调色板，1px 深色外描边，3-4 赛璐璐明暗，洋红/青色霓虹轮廓逆光
// 主角 64x64（逻辑 32x32 × pixel 2），杂兵 64x64，Boss 96x96（逻辑 32x32 × pixel 3）

// —— 24 色赛博朋克调色板 ——
const PAL = {
  K: '#0a0a14',   // 1 外描边
  a: '#7a4a2a',   // 2 皮肤阴影
  b: '#b8784e',   // 3 皮肤中间
  c: '#e0a878',   // 4 皮肤高光
  d: '#1a1020',   // 5 头发暗
  e: '#3a2848',   // 6 头发亮
  f: '#1a2a3a',   // 7 风衣暗
  g: '#2a4a5a',   // 8 风衣中
  h: '#3a6a7a',   // 9 风衣亮
  i: '#00e5ff',   // 10 风衣滚边/霓虹青
  j: '#2a1a2a',   // 11 战术背心暗
  k: '#4a2a3a',   // 12 战术背心中
  l: '#1a1a2a',   // 13 裤子暗
  m: '#2a2a44',   // 14 裤子中
  n: '#0a0a10',   // 15 靴子暗
  o: '#1a1a28',   // 16 靴子中
  p: '#1a1a22',   // 17 枪暗
  q: '#3a3a48',   // 18 枪中
  r: '#fff0a0',   // 19 枪口火焰
  t: '#ff2e88',   // 20 洋红霓虹轮廓
  u: '#00e5ff',   // 21 青色霓虹轮廓
  v: '#cc1a3a',   // 22 血液
  w: '#ffffff',   // 23 白/护目镜反光
  x: '#5a5a7a',   // 24 金属/配饰
};

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// 绘制 1px 外描边的矩形：先画描边，再画内部填充
function outlinedRect(ctx, x, y, w, h, fill, outline) {
  px(ctx, x, y, w, h, outline);
  px(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

// 霓虹轮廓光：在角色背光侧（左侧）叠加洋红/青色边
function rimLight(ctx, x, y, w, h, color, leftSide) {
  if (leftSide) {
    px(ctx, x, y, 1, h, color);
  } else {
    px(ctx, x + w - 1, y, 1, h, color);
  }
}

// ============================================================
// 主角：赏金猎人，逻辑 32x32，身高约 24 逻辑单位 = 48px
// 身穿带青色滚边的皮质风衣，内搭战术背心，飞行员墨镜，两侧推短发型，双手持重型手枪
// ============================================================
const PBC = 16; // 身体中心 x

function drawPlayer(ctx, spec) {
  const bob = spec.bob || 0;
  const oy = -bob;
  const hurt = spec.pose === 'hurt' ? 1 : 0;
  const flash = spec.flash;

  // —— 死亡动画（8 帧）：倒地 + 血雾 ——
  if (spec.pose === 'death') {
    drawPlayerDeath(ctx, spec.phase);
    return;
  }

  // —— 蹲下（射击 / 掩体）——
  if (spec.pose === 'crouch') {
    drawPlayerCrouch(ctx, flash, oy);
    return;
  }

  // —— 跳跃（3 帧）——
  if (spec.pose === 'jump') {
    drawPlayerJump(ctx, spec.phase, oy);
    return;
  }

  // —— 站立：待机 / 奔跑 / 射击 ——
  const legPhase = spec.legPhase || 0;
  const shooting = spec.pose === 'shoot';

  // 头部（y=3~11）
  drawPlayerHead(ctx, PBC, 3 + oy, hurt);

  // 颈部
  px(ctx, PBC - 2, 11 + oy, 4, 2, PAL.b);
  px(ctx, PBC - 2, 11 + oy, 1, 2, PAL.a); // 左阴影

  // 风衣躯干（y=13~22）
  // 外描边
  px(ctx, PBC - 7, 13 + oy, 14, 10, PAL.K);
  // 风衣主体
  px(ctx, PBC - 6, 13 + oy, 12, 9, PAL.g);
  px(ctx, PBC - 6, 13 + oy, 12, 1, PAL.h); // 上缘高光
  px(ctx, PBC - 6, 21 + oy, 12, 1, PAL.f); // 下缘阴影
  // 青色滚边（领口 + 前襟）
  px(ctx, PBC - 6, 13 + oy, 12, 1, PAL.i);
  px(ctx, PBC - 1, 13 + oy, 1, 9, PAL.i);
  px(ctx, PBC + 5, 13 + oy, 1, 9, PAL.i);
  // 战术背心（胸前）
  px(ctx, PBC - 4, 15 + oy, 8, 5, PAL.k);
  px(ctx, PBC - 4, 15 + oy, 8, 1, PAL.j);
  px(ctx, PBC - 3, 16 + oy, 1, 3, PAL.j); // 背心分隔线
  px(ctx, PBC + 2, 16 + oy, 1, 3, PAL.j);
  // 腰带
  px(ctx, PBC - 7, 22 + oy, 14, 2, PAL.K);
  px(ctx, PBC - 6, 22 + oy, 12, 1, PAL.n);
  px(ctx, PBC - 1, 22 + oy, 2, 2, PAL.x); // 带扣

  // 背光侧霓虹轮廓（左侧洋红，右侧青）
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.t, true);
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.u, false);

  // 腿部
  drawPlayerLegs(ctx, legPhase, oy, shooting);

  // 手臂 + 双枪
  drawPlayerArms(ctx, shooting, flash, oy, hurt);
}

function drawPlayerHead(ctx, cx, y, hurt) {
  // 头部外框
  px(ctx, cx - 4, y, 8, 8, PAL.K);
  // 脸
  px(ctx, cx - 3, y + 1, 6, 6, PAL.b);
  px(ctx, cx - 3, y + 1, 1, 6, PAL.a); // 左阴影
  px(ctx, cx + 2, y + 1, 1, 6, PAL.a); // 右阴影
  px(ctx, cx - 2, y + 2, 4, 1, PAL.c); // 额头高光

  // 飞行员墨镜
  px(ctx, cx - 3, y + 3, 6, 2, PAL.K);
  px(ctx, cx - 2, y + 3, 2, 1, PAL.u); // 左镜片青反光
  px(ctx, cx + 1, y + 3, 2, 1, PAL.t); // 右镜片洋红反光
  px(ctx, cx - 3, y + 3, 1, 2, PAL.K); // 鼻梁

  // 两侧推短发型
  px(ctx, cx - 4, y, 8, 2, PAL.d); // 头顶
  px(ctx, cx - 4, y + 1, 8, 1, PAL.e); // 头发高光
  px(ctx, cx - 4, y + 2, 1, 3, PAL.d); // 左侧推短
  px(ctx, cx + 3, y + 2, 1, 3, PAL.d); // 右侧推短
  px(ctx, cx - 4, y + 5, 1, 2, PAL.d); // 鬓角
  px(ctx, cx + 3, y + 5, 1, 2, PAL.d);

  // 嘴
  px(ctx, cx - 1, y + 6, 2, 1, PAL.a);

  if (hurt) {
    // 受击：头后仰 + 眼泛白
    px(ctx, cx - 3, y + 3, 6, 2, PAL.w);
  }
}

function drawPlayerLegs(ctx, phase, oy, shooting) {
  const baseY = 24 + oy;
  // phase 0~7 奔跑循环
  const swing = Math.sin(phase * Math.PI / 4) * 2;
  const lift = Math.max(0, Math.sin(phase * Math.PI / 4)) * 1;

  // 左腿
  px(ctx, PBC - 5, baseY - lift, 4, 5 + lift, PAL.K);
  px(ctx, PBC - 4, baseY - lift, 2, 4 + lift, PAL.m);
  px(ctx, PBC - 4, baseY - lift, 1, 4 + lift, PAL.l); // 阴影
  // 左腿靴子
  px(ctx, PBC - 5, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC - 4, baseY + 4, 3, 1, PAL.o);

  // 右腿
  px(ctx, PBC + 1 + swing, baseY, 4, 5, PAL.K);
  px(ctx, PBC + 2 + swing, baseY, 2, 4, PAL.m);
  px(ctx, PBC + 2 + swing, baseY, 1, 4, PAL.l);
  px(ctx, PBC + 1 + swing, baseY + 4, 4, 2, PAL.K);
  px(ctx, PBC + 2 + swing, baseY + 4, 3, 1, PAL.o);
}

function drawPlayerArms(ctx, shooting, flash, oy, hurt) {
  const armY = 14 + oy;
  if (shooting) {
    // 双手持枪前伸
    // 左手
    px(ctx, PBC - 6, armY, 3, 2, PAL.g);
    px(ctx, PBC - 4, armY, 4, 2, PAL.b); // 手
    // 右手 + 重型手枪
    px(ctx, PBC + 2, armY, 3, 2, PAL.g);
    px(ctx, PBC + 4, armY, 4, 2, PAL.b);
    // 手枪
    px(ctx, PBC + 7, armY - 1, 6, 4, PAL.K);
    px(ctx, PBC + 8, armY, 4, 2, PAL.q);
    px(ctx, PBC + 8, armY, 4, 1, PAL.x); // 枪管高光
    px(ctx, PBC + 7, armY + 1, 2, 2, PAL.p); // 握把
    if (flash) {
      px(ctx, PBC + 13, armY - 1, 4, 5, PAL.r);
      px(ctx, PBC + 13, armY, 3, 3, PAL.w);
    }
  } else {
    // 待机：双手垂在身侧，右手持枪
    px(ctx, PBC - 7, armY, 2, 6, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 4, PAL.g); // 左臂
    px(ctx, PBC - 6, armY + 5, 2, 2, PAL.b); // 左手

    px(ctx, PBC + 5, armY, 2, 6, PAL.K);
    px(ctx, PBC + 5, armY + 1, 1, 4, PAL.g); // 右臂
    px(ctx, PBC + 5, armY + 5, 2, 2, PAL.b); // 右手
    // 手枪垂在腿侧
    px(ctx, PBC + 6, armY + 4, 5, 3, PAL.K);
    px(ctx, PBC + 7, armY + 5, 3, 1, PAL.q);
  }
}

function drawPlayerCrouch(ctx, flash, oy) {
  const y = 10 + oy;
  // 头部
  drawPlayerHead(ctx, PBC, y, 0);
  // 颈部
  px(ctx, PBC - 2, y + 8, 4, 1, PAL.b);
  // 躯干（矮）
  px(ctx, PBC - 7, y + 9, 14, 7, PAL.K);
  px(ctx, PBC - 6, y + 9, 12, 6, PAL.g);
  px(ctx, PBC - 6, y + 9, 12, 1, PAL.i); // 青色滚边
  px(ctx, PBC - 1, y + 9, 1, 6, PAL.i);
  // 战术背心
  px(ctx, PBC - 4, y + 11, 8, 3, PAL.k);
  // 腿（弯曲）
  px(ctx, PBC - 6, y + 16, 5, 4, PAL.K);
  px(ctx, PBC - 5, y + 16, 3, 3, PAL.m);
  px(ctx, PBC + 1, y + 16, 5, 4, PAL.K);
  px(ctx, PBC + 2, y + 16, 3, 3, PAL.m);
  // 靴子
  px(ctx, PBC - 6, y + 19, 5, 2, PAL.K);
  px(ctx, PBC + 1, y + 19, 5, 2, PAL.K);
  // 双手持枪前伸（蹲姿射击）
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
  // phase 0: 起跳, 1: 空中, 2: 落地
  const y = 3 + oy;
  drawPlayerHead(ctx, PBC, y, 0);
  px(ctx, PBC - 2, y + 8, 4, 2, PAL.b);

  const tuck = phase === 1 ? 1 : 0; // 空中收腿

  // 躯干
  px(ctx, PBC - 7, y + 10, 14, 9, PAL.K);
  px(ctx, PBC - 6, y + 10, 12, 8, PAL.g);
  px(ctx, PBC - 6, y + 10, 12, 1, PAL.i);
  px(ctx, PBC - 1, y + 10, 1, 8, PAL.i);
  px(ctx, PBC - 4, y + 12, 8, 4, PAL.k);
  px(ctx, PBC - 7, y + 18, 14, 2, PAL.K);
  px(ctx, PBC - 6, y + 18, 12, 1, PAL.n);

  // 腿（屈膝）
  const legY = y + 20 + tuck;
  px(ctx, PBC - 5, legY, 4, 3 + tuck, PAL.K);
  px(ctx, PBC - 4, legY, 2, 2 + tuck, PAL.m);
  px(ctx, PBC + 1, legY, 4, 3 + tuck, PAL.K);
  px(ctx, PBC + 2, legY, 2, 2 + tuck, PAL.m);
  px(ctx, PBC - 5, legY + 3, 4, 2, PAL.K);
  px(ctx, PBC + 1, legY + 3, 4, 2, PAL.K);

  // 手臂上摆
  px(ctx, PBC - 8, y + 10, 2, 4, PAL.K);
  px(ctx, PBC - 7, y + 11, 1, 2, PAL.g);
  px(ctx, PBC + 6, y + 10, 2, 4, PAL.K);
  px(ctx, PBC + 6, y + 11, 1, 2, PAL.g);
}

function drawPlayerDeath(ctx, phase) {
  // phase 0~7：从站姿倒地 + 血雾扩散
  const t = phase / 7;
  const fallX = PBC + 2 + t * 6;
  const fallY = 16 + t * 8;
  const angle = t * Math.PI / 2;

  ctx.save();
  ctx.translate(fallX, fallY);
  ctx.rotate(angle * 0.3);
  ctx.translate(-PBC, -fallY);

  // 身体（横躺）
  px(ctx, PBC - 8, fallY, 16, 6, PAL.K);
  px(ctx, PBC - 7, fallY + 1, 14, 4, PAL.g);
  px(ctx, PBC - 7, fallY + 1, 14, 1, PAL.i);
  // 头
  px(ctx, PBC + 6, fallY - 2, 6, 6, PAL.K);
  px(ctx, PBC + 7, fallY - 1, 4, 4, PAL.b);
  px(ctx, PBC + 7, fallY, 4, 1, PAL.c);
  // 墨镜
  px(ctx, PBC + 7, fallY + 1, 4, 1, PAL.K);
  // 头发
  px(ctx, PBC + 6, fallY - 2, 6, 2, PAL.d);
  // 腿伸直
  px(ctx, PBC - 12, fallY + 1, 5, 3, PAL.K);
  px(ctx, PBC - 11, fallY + 2, 3, 1, PAL.m);
  px(ctx, PBC - 16, fallY + 2, 5, 2, PAL.K);
  // 血雾
  const bloodR = 2 + t * 4;
  px(ctx, PBC - 2, fallY - 1, bloodR, 2, PAL.v);
  px(ctx, PBC - 1, fallY + 3, bloodR + 1, 1, PAL.v);
  if (phase > 2) {
    px(ctx, PBC + 4, fallY + 4, 3, 1, PAL.v);
  }
  ctx.restore();
}

// 主角帧序列
const PLAYER_SPECS = [
  // IDLE 0-5（6 帧：呼吸 + 轻微重心转移）
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  // RUN 6-13（8 帧奔跑）
  { pose: 'run', legPhase: 0 },
  { pose: 'run', legPhase: 1 },
  { pose: 'run', legPhase: 2 },
  { pose: 'run', legPhase: 3 },
  { pose: 'run', legPhase: 4 },
  { pose: 'run', legPhase: 5 },
  { pose: 'run', legPhase: 6 },
  { pose: 'run', legPhase: 7 },
  // SHOOT_STAND 14-16（3 帧：后坐力）
  { pose: 'shoot', flash: true },
  { pose: 'shoot', flash: false },
  { pose: 'shoot', flash: false },
  // SHOOT_CROUCH 17-19
  { pose: 'crouch', flash: true },
  { pose: 'crouch', flash: false },
  { pose: 'crouch', flash: false },
  // JUMP 20-22
  { pose: 'jump', phase: 0 },
  { pose: 'jump', phase: 1 },
  { pose: 'jump', phase: 2 },
  // HURT 23-24
  { pose: 'hurt' },
  { pose: 'hurt' },
  // DEATH 25-32
  { pose: 'death', phase: 0 },
  { pose: 'death', phase: 1 },
  { pose: 'death', phase: 2 },
  { pose: 'death', phase: 3 },
  { pose: 'death', phase: 4 },
  { pose: 'death', phase: 5 },
  { pose: 'death', phase: 6 },
  { pose: 'death', phase: 7 },
];

// ============================================================
// 杂兵：街头帮派暴徒，逻辑 32x32，身高 46px
// 三种变体：红色莫西干+冲锋枪 / 冰球面具+霰弹枪 / 光头金链+棒球棍
// ============================================================
const THUG_VARIANTS = {
  mohawk: {
    hair: PAL.d, hairHi: '#a8243a', jacket: '#6a1a2a', jacketHi: '#9c2135',
    trim: '#ff4757', weapon: 'smg',
  },
  mask: {
    hair: '#2a2a3a', hairHi: '#3a3a4a', jacket: '#2a3a2a', jacketHi: '#3a5a3a',
    trim: '#39ff88', weapon: 'shotgun', mask: '#d8d8e0',
  },
  bald: {
    hair: PAL.b, hairHi: PAL.c, jacket: '#3a2a1a', jacketHi: '#5a4a2a',
    trim: '#ffd700', weapon: 'bat', chain: '#ffd700',
  },
};

function drawThug(ctx, spec) {
  const variant = THUG_VARIANTS[spec.variant || 'mohawk'];
  const bob = spec.bob || 0;
  const oy = -bob;

  if (spec.pose === 'death') {
    drawThugDeath(ctx, spec.phase, variant);
    return;
  }
  if (spec.pose === 'crouch') {
    drawThugCrouch(ctx, variant, oy);
    return;
  }

  const shooting = spec.pose === 'shoot';
  const aiming = spec.pose === 'aim';

  // 头部
  drawThugHead(ctx, PBC, 3 + oy, variant, spec.pose === 'hurt');

  // 颈部
  px(ctx, PBC - 2, 11 + oy, 4, 2, variant.hair);

  // 躯干：柳丁皮夹克 / 运动外套
  px(ctx, PBC - 7, 13 + oy, 14, 10, PAL.K);
  px(ctx, PBC - 6, 13 + oy, 12, 9, variant.jacket);
  px(ctx, PBC - 6, 13 + oy, 12, 1, variant.jacketHi);
  px(ctx, PBC - 6, 21 + oy, 12, 1, PAL.K);
  // 夹克滚边
  px(ctx, PBC - 6, 13 + oy, 12, 1, variant.trim);
  px(ctx, PBC - 1, 13 + oy, 1, 9, variant.trim);
  // 柳丁（肩部）
  px(ctx, PBC - 6, 13 + oy, 2, 1, PAL.x);
  px(ctx, PBC + 4, 13 + oy, 2, 1, PAL.x);

  // 金链（光头壮汉）
  if (variant.chain) {
    px(ctx, PBC - 3, 14 + oy, 6, 1, variant.chain);
    px(ctx, PBC - 1, 15 + oy, 2, 2, variant.chain);
  }

  // 腰带
  px(ctx, PBC - 7, 22 + oy, 14, 2, PAL.K);
  px(ctx, PBC - 6, 22 + oy, 12, 1, PAL.n);

  // 背光轮廓
  rimLight(ctx, PBC - 7, 13 + oy, 14, 9, PAL.t, true);

  // 腿
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

  // 手臂 + 武器
  drawThugArms(ctx, variant, shooting, aiming, spec.flash, oy);
}

function drawThugHead(ctx, cx, y, variant, hurt) {
  px(ctx, cx - 4, y, 8, 8, PAL.K);
  px(ctx, cx - 3, y + 1, 6, 6, PAL.b);
  px(ctx, cx - 3, y + 1, 1, 6, PAL.a);

  if (variant.mask) {
    // 冰球面具
    px(ctx, cx - 3, y + 2, 6, 5, variant.mask);
    px(ctx, cx - 3, y + 2, 6, 1, '#f0f0f8');
    px(ctx, cx - 2, y + 4, 1, 1, PAL.K); // 眼洞
    px(ctx, cx + 1, y + 4, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 6, 2, 1, PAL.K); // 嘴栅
    px(ctx, cx - 3, y + 3, 1, 1, '#a0a0b0'); // 面具阴影
  } else if (variant.weapon === 'bat') {
    // 光头 + 凶狠表情
    px(ctx, cx - 3, y + 1, 6, 2, PAL.b);
    px(ctx, cx - 2, y + 3, 1, 1, PAL.K); // 眼
    px(ctx, cx + 1, y + 3, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 5, 3, 1, PAL.a); // 嘴
    px(ctx, cx - 3, y + 6, 6, 1, PAL.a); // 下巴阴影
  } else {
    // 莫西干 + 普通脸
    px(ctx, cx - 2, y + 3, 1, 1, PAL.K); // 眼
    px(ctx, cx + 1, y + 3, 1, 1, PAL.K);
    px(ctx, cx - 1, y + 5, 2, 1, PAL.a); // 嘴
  }

  // 莫西干头
  if (variant.weapon === 'smg') {
    px(ctx, cx - 1, y - 2, 2, 3, variant.hairHi);
    px(ctx, cx - 1, y, 2, 1, variant.hairHi);
    px(ctx, cx - 4, y, 8, 1, PAL.d); // 两侧剃光
    px(ctx, cx - 4, y + 1, 1, 2, PAL.d);
    px(ctx, cx + 3, y + 1, 1, 2, PAL.d);
  }
}

function drawThugArms(ctx, variant, shooting, aiming, flash, oy) {
  const armY = 14 + oy;
  if (variant.weapon === 'bat') {
    // 棒球棍
    px(ctx, PBC - 7, armY, 2, 5, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 3, variant.jacket);
    px(ctx, PBC + 5, armY, 2, 5, PAL.K);
    px(ctx, PBC + 5, armY + 1, 1, 3, variant.jacket);
    // 球棍
    px(ctx, PBC + 6, armY - 2, 2, 12, PAL.K);
    px(ctx, PBC + 6, armY - 2, 1, 11, '#8a5a2a');
    px(ctx, PBC + 6, armY - 2, 1, 1, '#a87a4a');
  } else {
    // 枪
    px(ctx, PBC - 7, armY, 2, 5, PAL.K);
    px(ctx, PBC - 6, armY + 1, 1, 3, variant.jacket);
    px(ctx, PBC + 3, armY, 3, 2, variant.jacket);
    px(ctx, PBC + 5, armY, 3, 2, PAL.b);

    if (variant.weapon === 'smg') {
      // 冲锋枪
      px(ctx, PBC + 7, armY - 1, 7, 4, PAL.K);
      px(ctx, PBC + 8, armY, 5, 2, PAL.q);
      px(ctx, PBC + 8, armY, 5, 1, PAL.x);
      px(ctx, PBC + 7, armY + 2, 3, 3, PAL.p); // 弹匣
      if (flash) {
        px(ctx, PBC + 14, armY - 1, 3, 4, PAL.r);
        px(ctx, PBC + 14, armY, 2, 2, PAL.w);
      }
    } else {
      // 霰弹枪
      px(ctx, PBC + 7, armY - 1, 9, 4, PAL.K);
      px(ctx, PBC + 8, armY, 7, 2, PAL.q);
      px(ctx, PBC + 8, armY, 7, 1, PAL.x);
      px(ctx, PBC + 7, armY + 1, 2, 3, '#5a3a1a'); // 枪托
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
  if (variant.weapon === 'smg') {
    px(ctx, PBC + 6, fallY - 3, 2, 2, variant.hairHi);
  }
  px(ctx, PBC - 12, fallY + 1, 5, 3, PAL.K);
  px(ctx, PBC - 11, fallY + 2, 3, 1, PAL.l);
  px(ctx, PBC - 2, fallY - 1, 4 + t * 3, 2, PAL.v);
  px(ctx, PBC, fallY + 4, 3 + t * 2, 1, PAL.v);
  ctx.restore();
}

// 杂兵帧序列（每种变体共用同一套动作帧）
function buildThugSpecs(variant) {
  return [
    // IDLE 0-3
    { pose: 'idle', variant, bob: 0 },
    { pose: 'idle', variant, bob: 1 },
    { pose: 'idle', variant, bob: 0 },
    { pose: 'idle', variant, bob: 1 },
    // WALK 4-9
    { pose: 'walk', variant, legPhase: 0 },
    { pose: 'walk', variant, legPhase: 1 },
    { pose: 'walk', variant, legPhase: 2 },
    { pose: 'walk', variant, legPhase: 3 },
    { pose: 'walk', variant, legPhase: 4 },
    { pose: 'walk', variant, legPhase: 5 },
    // AIM 10-11
    { pose: 'aim', variant },
    { pose: 'aim', variant },
    // SHOOT 12-13
    { pose: 'shoot', variant, flash: true },
    { pose: 'shoot', variant, flash: false },
    // CROUCH 14-15
    { pose: 'crouch', variant },
    { pose: 'crouch', variant },
    // HURT 16-17
    { pose: 'hurt', variant },
    { pose: 'hurt', variant },
    // DEATH 18-23
    { pose: 'death', variant, phase: 0 },
    { pose: 'death', variant, phase: 1 },
    { pose: 'death', variant, phase: 2 },
    { pose: 'death', variant, phase: 3 },
    { pose: 'death', variant, phase: 4 },
    { pose: 'death', variant, phase: 5 },
  ];
}

// ============================================================
// Boss：帮派老大，逻辑 32x32 × pixel 3 = 96x96，身高 80px
// 体型魁梧，右臂机械义肢转管机枪，紫色皮草大衣，紫光护目镜
// ============================================================
const BBC = 16;

function drawBoss(ctx, spec) {
  const bob = spec.bob || 0;
  const oy = -bob;

  if (spec.pose === 'death') {
    drawBossDeath(ctx, spec.phase);
    return;
  }

  const shooting = spec.pose === 'gatling';
  const charging = spec.pose === 'charge';

  // 头部
  drawBossHead(ctx, BBC, 2 + oy, spec.pose === 'hurt');

  // 粗颈
  px(ctx, BBC - 3, 10 + oy, 6, 3, PAL.a);
  px(ctx, BBC - 3, 10 + oy, 1, 3, '#5a3a2a');

  // 紫色皮草大衣（魁梧躯干）
  px(ctx, BBC - 9, 13 + oy, 18, 12, PAL.K);
  px(ctx, BBC - 8, 13 + oy, 16, 11, '#43285f');
  px(ctx, BBC - 8, 13 + oy, 16, 1, '#6a4a8f'); // 皮草高光
  px(ctx, BBC - 8, 13 + oy, 16, 2, '#5a3a7f'); // 毛领
  px(ctx, BBC - 8, 13 + oy, 1, 11, '#6a4a8f'); // 左侧毛边
  px(ctx, BBC + 7, 13 + oy, 1, 11, '#6a4a8f'); // 右侧毛边
  // 大衣滚边
  px(ctx, BBC - 8, 13 + oy, 16, 1, '#b06bff');
  px(ctx, BBC - 1, 13 + oy, 1, 11, '#b06bff');
  // 腰带
  px(ctx, BBC - 9, 24 + oy, 18, 3, PAL.K);
  px(ctx, BBC - 8, 24 + oy, 16, 2, '#1a1520');
  px(ctx, BBC - 1, 24 + oy, 2, 3, '#b06bff');

  // 背光轮廓
  rimLight(ctx, BBC - 9, 13 + oy, 18, 11, PAL.t, true);
  rimLight(ctx, BBC - 9, 13 + oy, 18, 11, '#b06bff', false);

  // 腿（粗壮）
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

  // 左臂（普通）
  px(ctx, BBC - 10, 14 + oy, 3, 8, PAL.K);
  px(ctx, BBC - 9, 15 + oy, 2, 6, '#43285f');
  px(ctx, BBC - 10, 21 + oy, 3, 2, PAL.K);
  px(ctx, BBC - 9, 22 + oy, 2, 1, PAL.b);

  // 右臂：机械义肢 + 转管机枪
  drawBossMechArm(ctx, shooting, spec.flash, oy, charging);
}

function drawBossHead(ctx, cx, y, hurt) {
  px(ctx, cx - 5, y, 10, 9, PAL.K);
  px(ctx, cx - 4, y + 1, 8, 7, PAL.b);
  px(ctx, cx - 4, y + 1, 1, 7, PAL.a);
  px(ctx, cx - 3, y + 2, 6, 1, PAL.c);
  // 紫色护目镜（发光）
  px(ctx, cx - 4, y + 3, 8, 2, PAL.K);
  px(ctx, cx - 3, y + 3, 3, 1, '#b06bff');
  px(ctx, cx + 1, y + 3, 3, 1, '#b06bff');
  px(ctx, cx - 3, y + 4, 3, 1, '#d090ff');
  px(ctx, cx + 1, y + 4, 3, 1, '#d090ff');
  // 头发（后梳）
  px(ctx, cx - 5, y, 10, 2, PAL.d);
  px(ctx, cx - 5, y + 1, 10, 1, '#3a2848');
  // 嘴
  px(ctx, cx - 2, y + 6, 4, 1, PAL.a);
  if (hurt) {
    px(ctx, cx - 4, y + 3, 8, 2, PAL.w);
  }
}

function drawBossMechArm(ctx, shooting, flash, oy, charging) {
  const armY = 14 + oy;
  // 机械义肢（深色金属 + 紫色光条）
  px(ctx, BBC + 5, armY, 4, 8, PAL.K);
  px(ctx, BBC + 6, armY + 1, 2, 6, PAL.p);
  px(ctx, BBC + 6, armY + 1, 1, 6, PAL.x);
  px(ctx, BBC + 6, armY + 3, 2, 1, '#b06bff'); // 关节光
  px(ctx, BBC + 6, armY + 6, 2, 1, '#b06bff');

  // 转管机枪
  const gunX = BBC + 9;
  px(ctx, gunX, armY - 1, 8, 5, PAL.K);
  px(ctx, gunX + 1, armY, 6, 3, PAL.q);
  px(ctx, gunX + 1, armY, 6, 1, PAL.x);
  // 枪管（多管）
  px(ctx, gunX + 6, armY, 3, 1, PAL.p);
  px(ctx, gunX + 6, armY + 2, 3, 1, PAL.p);
  px(ctx, gunX + 7, armY + 1, 2, 1, PAL.p);
  // 旋转指示
  if (shooting) {
    px(ctx, gunX + 1, armY + 1, 2, 1, '#ff4757');
    if (flash) {
      px(ctx, gunX + 8, armY - 2, 5, 7, PAL.r);
      px(ctx, gunX + 8, armY - 1, 4, 5, PAL.w);
    }
  }
  // 弹链
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
  // 爆炸
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

// Boss 帧序列
const BOSS_SPECS = [
  // IDLE 0-3
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  // WALK 4-7
  { pose: 'walk', legPhase: 0 },
  { pose: 'walk', legPhase: 1 },
  { pose: 'walk', legPhase: 2 },
  { pose: 'walk', legPhase: 3 },
  // GATLING 8-11
  { pose: 'gatling', flash: true },
  { pose: 'gatling', flash: false },
  { pose: 'gatling', flash: true },
  { pose: 'gatling', flash: false },
  // CHARGE 12-13
  { pose: 'charge' },
  { pose: 'charge' },
  // HURT 14-15
  { pose: 'hurt' },
  { pose: 'hurt' },
  // DEATH 16-21
  { pose: 'death', phase: 0 },
  { pose: 'death', phase: 1 },
  { pose: 'death', phase: 2 },
  { pose: 'death', phase: 3 },
  { pose: 'death', phase: 4 },
  { pose: 'death', phase: 5 },
];

// ============================================================
// 帧索引映射（供 Player / Enemy 调用）
// ============================================================
export const ANIM = {
  // 主角
  PLAYER_IDLE: [0, 1, 2, 3, 4, 5],
  PLAYER_RUN: [6, 7, 8, 9, 10, 11, 12, 13],
  PLAYER_SHOOT: [14, 15, 16],
  PLAYER_SHOOT_CROUCH: [17, 18, 19],
  PLAYER_JUMP: [20, 21, 22],
  PLAYER_HURT: [23, 24],
  PLAYER_DEATH: [25, 26, 27, 28, 29, 30, 31, 32],
  // 杂兵
  THUG_IDLE: [0, 1, 2, 3],
  THUG_WALK: [4, 5, 6, 7, 8, 9],
  THUG_AIM: [10, 11],
  THUG_SHOOT: [12, 13],
  THUG_CROUCH: [14, 15],
  THUG_HURT: [16, 17],
  THUG_DEATH: [18, 19, 20, 21, 22, 23],
  // Boss
  BOSS_IDLE: [0, 1, 2, 3],
  BOSS_WALK: [4, 5, 6, 7],
  BOSS_GATLING: [8, 9, 10, 11],
  BOSS_CHARGE: [12, 13],
  BOSS_HURT: [14, 15],
  BOSS_DEATH: [16, 17, 18, 19, 20, 21],
  // 兼容旧接口
  IDLE: [0, 1],
  WALK: [4, 5, 6, 7],
  RUN: [6, 7, 8, 9],
  SHOOT: [14, 15],
  JUMP: [20],
  CROUCH: [17],
  HURT: [23],
};

// ============================================================
// SpriteSheet 类：feet 对齐、facing 翻转、hit flash
// ============================================================
export class SpriteSheet {
  constructor(canvas, flashCanvas, frameW, frameH) {
    this.canvas = canvas;
    this.flashCanvas = flashCanvas;
    this.frameW = frameW;
    this.frameH = frameH;
  }

  draw(ctx, frame, centerX, bottomY, facing, flash) {
    const src = flash ? this.flashCanvas : this.canvas;
    const x = Math.round(centerX - this.frameW / 2);
    const y = Math.round(bottomY - this.frameH);
    const sx = frame * this.frameW;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      ctx.translate(x + this.frameW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, 0, this.frameW, this.frameH, 0, 0, this.frameW, this.frameH);
    } else {
      ctx.drawImage(src, sx, 0, this.frameW, this.frameH, x, y, this.frameW, this.frameH);
    }
    ctx.restore();
  }
}

function buildSheet(logW, logH, pixel, specs, drawFn) {
  const frameW = logW * pixel;
  const frameH = logH * pixel;
  const canvas = document.createElement('canvas');
  canvas.width = frameW * specs.length;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < specs.length; i++) {
    ctx.save();
    ctx.translate(i * frameW, 0);
    ctx.scale(pixel, pixel);
    drawFn(ctx, specs[i]);
    ctx.restore();
  }

  // 白闪版本（受击反馈）
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = canvas.width;
  flashCanvas.height = canvas.height;
  const fctx = flashCanvas.getContext('2d');
  fctx.drawImage(canvas, 0, 0);
  fctx.globalCompositeOperation = 'source-atop';
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, flashCanvas.width, flashCanvas.height);

  return new SpriteSheet(canvas, flashCanvas, frameW, frameH);
}

const LOG_W = 32;
const LOG_H = 32;

let cache = null;

export function getSprites() {
  if (cache) return cache;
  cache = {
    player: buildSheet(LOG_W, LOG_H, 2, PLAYER_SPECS, drawPlayer),
    thug_mohawk: buildSheet(LOG_W, LOG_H, 2, buildThugSpecs('mohawk'), drawThug),
    thug_mask: buildSheet(LOG_W, LOG_H, 2, buildThugSpecs('mask'), drawThug),
    thug_bald: buildSheet(LOG_W, LOG_H, 2, buildThugSpecs('bald'), drawThug),
    boss: buildSheet(LOG_W, LOG_H, 3, BOSS_SPECS, drawBoss),
  };
  return cache;
}
