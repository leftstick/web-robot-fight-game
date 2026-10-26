// build-characters-v2.js —— 1px 网格角色动画
// 64x64 主角/暴徒，112x112 BOSS；保留原有帧索引布局。

const { px, canvas, saveSheet, makeAsepriteJSON, rgba, line, disc, glow } = require('./build-assets-v2.js');

// ============================================================
// 主角调色板
// ============================================================
const P = {
  K: '#07050b',
  coatD: '#0e1a22', coat: '#19333e', coatL: '#2a5660', coatHi: '#4b8790',
  lining: '#6e1038',
  armorD: '#141a26', armor: '#253047', armorL: '#40506c', armorHi: '#6f82a2',
  metal: '#6b788e', metalHi: '#b8c6d8', metalD: '#394252',
  skin: '#e2a372', skinD: '#b5764e', skinL: '#f4c69d',
  scarf: '#ff2e88', scarfD: '#a5155b', scarfL: '#ff8ec0',
  visor: '#45eeff', visorHot: '#e9ffff',
  boot: '#0f131c', bootL: '#2a3446',
  gold: '#ffcf5a', red: '#ff3b5c',
};

// ============================================================
// 主角头部
// ============================================================
function drawPlayerHead(ctx, hy, hurt) {
  // 轮廓（压缩到 ~17px 高，避免大头娃娃比例）
  px(ctx, 30, hy - 2, 6, 2, P.K);
  px(ctx, 28, hy, 9, 1, P.K);
  px(ctx, 27, hy + 1, 12, 7, P.K);
  px(ctx, 28, hy + 8, 12, 4, P.K);
  px(ctx, 30, hy + 12, 9, 2, P.K);

  // 头盔
  px(ctx, 29, hy - 1, 6, 1, P.armorL);
  px(ctx, 28, hy + 1, 10, 6, P.armorD);
  px(ctx, 29, hy + 1, 8, 5, P.armor);
  px(ctx, 29, hy + 1, 7, 1, P.armorL);
  px(ctx, 29, hy + 2, 2, 3, P.armorHi);
  px(ctx, 30, hy + 6, 9, 2, P.armorD);
  // 护目镜
  px(ctx, 32, hy + 4, 8, 3, P.K);
  px(ctx, 33, hy + 4, 6, 2, P.visor);
  px(ctx, 37, hy + 4, 3, 1, P.visorHot);
  px(ctx, 32, hy + 5, 1, 2, P.visor);
  // 面部
  px(ctx, 34, hy + 6, 6, 3, P.skin);
  px(ctx, 35, hy + 6, 5, 1, P.skinL);
  px(ctx, 38, hy + 8, 2, 2, P.skinD);
  // 呼吸面罩
  px(ctx, 34, hy + 9, 6, 4, P.armorD);
  px(ctx, 35, hy + 10, 5, 2, P.armor);
  px(ctx, 36, hy + 10, 3, 1, P.visor);
  px(ctx, 35, hy + 12, 4, 1, P.armorL);
  // 耳部通讯器
  px(ctx, 25, hy + 3, 2, 5, P.K);
  px(ctx, 25, hy + 4, 1, 2, P.visor);
  px(ctx, 26, hy + 8, 1, 1, P.metalHi);
  // 顶部鳍片
  px(ctx, 30, hy - 3, 4, 1, P.armorL);
  px(ctx, 31, hy - 2, 2, 1, P.visor);
  // 围巾
  px(ctx, 27, hy + 13, 12, 3, P.scarf);
  px(ctx, 29, hy + 14, 9, 1, P.scarfD);
  px(ctx, 30, hy + 13, 6, 1, P.scarfL);
  // 右侧轮廓光
  px(ctx, 40, hy + 4, 1, 3, rgba(P.visor, 0.85));
  if (hurt) {
    px(ctx, 35, hy + 8, 3, 1, P.red);
    px(ctx, 38, hy + 5, 1, 1, P.red);
  }
}

// ============================================================
// 主角躯干 / 四肢
// ============================================================
function drawPlayerScarfTail(ctx, oy, wave) {
  px(ctx, 22, 24 + oy, 6, 3, P.K);
  px(ctx, 23, 24 + oy, 5, 2, P.scarfD);
  px(ctx, 19, 25 + oy + wave, 6, 2, P.K);
  px(ctx, 19, 25 + oy + wave, 5, 2, P.scarf);
  px(ctx, 15, 26 + oy - wave, 6, 2, P.K);
  px(ctx, 16, 26 + oy - wave, 5, 2, P.scarfD);
  px(ctx, 12, 28 + oy + wave, 5, 2, P.K);
  px(ctx, 12, 28 + oy + wave, 4, 1, P.scarf);
  px(ctx, 10, 29 + oy + wave, 3, 1, P.scarfD);
  px(ctx, 20, 25 + oy + wave, 3, 1, P.scarfL);
}

function drawPlayerTorso(ctx, oy, hurt) {
  // 大衣轮廓（下摆缩短，露出更多腿部动画）
  px(ctx, 21, 25 + oy, 22, 4, P.K);
  px(ctx, 20, 29 + oy, 24, 17, P.K);
  px(ctx, 22, 46 + oy, 20, 5, P.K);
  px(ctx, 24, 50 + oy, 17, 1, P.K);
  // 大衣
  px(ctx, 22, 26 + oy, 20, 3, P.coatD);
  px(ctx, 21, 29 + oy, 22, 16, P.coat);
  px(ctx, 22, 45 + oy, 19, 5, P.coat);
  px(ctx, 21, 29 + oy, 3, 16, P.coatL);
  px(ctx, 24, 30 + oy, 1, 14, P.coatHi);
  px(ctx, 40, 30 + oy, 2, 14, P.coatD);
  // 肩甲
  px(ctx, 22, 26 + oy, 8, 5, P.armorD);
  px(ctx, 24, 27 + oy, 5, 3, P.armor);
  px(ctx, 36, 26 + oy, 8, 6, P.armorD);
  px(ctx, 37, 27 + oy, 6, 4, P.armorL);
  px(ctx, 37, 27 + oy, 5, 1, P.armorHi);
  // 胸甲
  px(ctx, 27, 29 + oy, 12, 11, P.K);
  px(ctx, 28, 30 + oy, 10, 9, P.armor);
  px(ctx, 29, 30 + oy, 8, 1, P.armorL);
  px(ctx, 28, 31 + oy, 1, 7, P.armorD);
  px(ctx, 31, 33 + oy, 7, 1, P.visor);
  px(ctx, 32, 32 + oy, 1, 1, P.visorHot);
  px(ctx, 32, 36 + oy, 5, 1, P.scarf);
  // 腰带
  px(ctx, 23, 41 + oy, 18, 2, P.K);
  px(ctx, 24, 41 + oy, 16, 2, P.armorD);
  px(ctx, 31, 41 + oy, 4, 2, P.gold);
  px(ctx, 32, 41 + oy, 2, 1, '#fff2b0');
  // 大衣开衩
  px(ctx, 31, 44 + oy, 2, 7, P.lining);
  px(ctx, 26, 46 + oy, 4, 1, P.coatD);
  px(ctx, 35, 48 + oy, 5, 1, P.coatD);
  px(ctx, 23, 49 + oy, 5, 1, P.coatD);
  // 轮廓光
  px(ctx, 43, 28 + oy, 1, 17, P.coatL);
  px(ctx, 21, 30 + oy, 1, 15, rgba(P.scarf, 0.45));
}

function drawPlayerBackArm(ctx, oy, legPhase) {
  const sw = legPhase != null ? [-2, -1, 0, 1, 2, 1, 0, -1][legPhase % 8] : 0;
  px(ctx, 23, 28 + oy, 5, 3, P.K);
  px(ctx, 24, 29 + oy, 3, 2, P.coatL);
  px(ctx, 22, 31 + oy + sw, 4, 9, P.K);
  px(ctx, 23, 32 + oy + sw, 2, 7, P.coat);
  px(ctx, 23, 39 + oy + sw, 3, 2, P.armorD);
  px(ctx, 23, 41 + oy + sw, 2, 1, P.skin);
}

function drawPlayerLeg(ctx, x, yTop, lift, front) {
  const y = yTop - lift;
  // 大腿
  px(ctx, x, y, 6, 8, P.K);
  px(ctx, x + 1, y, 4, 7, P.armorD);
  px(ctx, x + 1, y, 2, 5, P.armor);
  // 膝
  px(ctx, x, y + 7, 6, 2, P.K);
  px(ctx, x + 1, y + 7, 4, 1, front ? P.armorL : P.armorD);
  // 小腿
  px(ctx, x, y + 9, 5, 6, P.K);
  px(ctx, x + 1, y + 9, 3, 5, P.coatD);
  // 靴子
  px(ctx, x - 1, y + 14, 8, 4, P.K);
  px(ctx, x, y + 15, 6, 3, P.boot);
  px(ctx, x + 1, y + 15, 4, 1, P.bootL);
  px(ctx, x + 1, y + 17, 4, 1, P.visor);
  if (front) {
    px(ctx, x + 6, y + 15, 2, 3, P.K);
    px(ctx, x + 6, y + 15, 2, 1, P.bootL);
  }
}

function drawPlayerStandingLegs(ctx, oy, phase) {
  const swing = phase != null ? [-4, -2, 0, 2, 4, 2, 0, -2][phase % 8] : 0;
  const lift = phase != null ? [1, 2, 1, 0, 1, 2, 1, 0][phase % 8] : 0;
  const backX = 27 - Math.round(swing * 0.5);
  const frontX = 32 + Math.round(swing * 0.5);
  drawPlayerLeg(ctx, backX, 44 + oy, Math.max(0, -Math.round(swing * 0.4)), false);
  drawPlayerLeg(ctx, frontX, 44 + oy, lift, true);
}

function drawPlayerGunArm(ctx, oy, recoil) {
  const y = 28 + oy;
  const rx = recoil || 0;
  // 肩 / 上臂
  px(ctx, 37, y + 1, 5, 5, P.K);
  px(ctx, 38, y + 2, 4, 3, P.coatL);
  px(ctx, 40, y + 3, 3, 2, P.armor);
  // 前臂
  px(ctx, 41 - rx, y + 3, 4, 3, P.coatD);
  px(ctx, 42 - rx, y + 4, 3, 1, P.coatL);
  // 手
  px(ctx, 44 - rx, y + 4, 3, 2, P.skin);
  px(ctx, 44 - rx, y + 5, 3, 1, P.skinD);
  // 手枪
  px(ctx, 41 - rx, y + 3, 10, 5, P.K);
  px(ctx, 42 - rx, y + 4, 8, 3, P.metalD);
  px(ctx, 43 - rx, y + 4, 6, 1, P.metal);
  px(ctx, 50 - rx, y + 4, 5, 2, P.K);
  px(ctx, 51 - rx, y + 4, 4, 1, P.metalHi);
  px(ctx, 54 - rx, y + 4, 1, 2, P.visor);
  // 能量弹匣
  px(ctx, 44 - rx, y + 4, 2, 2, P.visor);
  px(ctx, 45 - rx, y + 4, 1, 1, P.visorHot);
  // 握把
  px(ctx, 44 - rx, y + 7, 3, 3, P.K);
  px(ctx, 45 - rx, y + 7, 2, 2, P.armorD);
  // 顶部导轨
  px(ctx, 44 - rx, y + 3, 5, 1, P.metalHi);
  px(ctx, 47 - rx, y + 3, 1, 1, P.metal);
}

function drawPlayerMeleeArm(ctx, oy, pose) {
  if (pose === 0 || pose === 1) {
    // 举起
    px(ctx, 36, 26 + oy, 5, 4, P.K);
    px(ctx, 37, 27 + oy, 3, 2, P.coatL);
    px(ctx, 37, 22 + oy, 3, 6, P.K);
    px(ctx, 38, 22 + oy, 2, 5, P.coat);
    px(ctx, 37, 17 + oy, 3, 5, P.K);
    px(ctx, 38, 18 + oy, 2, 3, P.armorD);
    px(ctx, 37, 14 + oy, 4, 4, P.skin);
    px(ctx, 38, 14 + oy, 2, 1, P.skinL);
    px(ctx, 36, 15 + oy, 1, 2, P.skinD);
  } else if (pose === 2 || pose === 3) {
    // 落下
    px(ctx, 37, 28 + oy, 5, 4, P.K);
    px(ctx, 38, 29 + oy, 3, 2, P.coatL);
    px(ctx, 40, 30 + oy, 6, 3, P.K);
    px(ctx, 41, 31 + oy, 5, 1, P.coat);
    px(ctx, 45, 30 + oy, 4, 4, P.skin);
    px(ctx, 45, 31 + oy, 3, 1, P.skinL);
    px(ctx, 48, 32 + oy, 1, 2, P.skinD);
  } else {
    // 收回
    px(ctx, 37, 28 + oy, 5, 4, P.K);
    px(ctx, 38, 29 + oy, 3, 2, P.coatL);
    px(ctx, 40, 31 + oy, 4, 3, P.K);
    px(ctx, 41, 32 + oy, 3, 1, P.coat);
    px(ctx, 43, 31 + oy, 4, 3, P.skin);
    px(ctx, 43, 32 + oy, 3, 1, P.skinL);
  }
}

function drawPlayerStanding(ctx, opts) {
  const oy = opts.oy || 0;
  const lean = opts.lean || 0;
  drawPlayerScarfTail(ctx, oy, opts.wave || 0);
  drawPlayerBackArm(ctx, oy, opts.legPhase);
  drawPlayerStandingLegs(ctx, oy, opts.legPhase);
  ctx.save();
  ctx.translate(lean, 0);
  drawPlayerTorso(ctx, oy, opts.hurt);
  drawPlayerHead(ctx, 8 + oy, opts.hurt);
  if (opts.meleePose != null) drawPlayerMeleeArm(ctx, oy, opts.meleePose);
  else drawPlayerGunArm(ctx, oy, opts.recoil || 0);
  ctx.restore();
}

// ============================================================
// 主角蹲伏 / 跳跃 / 死亡
// ============================================================
function drawPlayerCrouch(ctx, spec) {
  const oy = spec.bob ? -1 : 0;
  drawPlayerScarfTail(ctx, 16 + oy, spec.wave || 0);

  // 后腿折叠
  px(ctx, 25, 50 + oy, 8, 7, P.K);
  px(ctx, 26, 51 + oy, 6, 5, P.armorD);
  px(ctx, 26, 51 + oy, 3, 4, P.armor);
  px(ctx, 23, 57 + oy, 9, 5, P.K);
  px(ctx, 24, 58 + oy, 7, 3, P.boot);
  px(ctx, 24, 58 + oy, 5, 1, P.bootL);
  // 前腿前伸
  px(ctx, 32, 50 + oy, 8, 7, P.K);
  px(ctx, 33, 51 + oy, 6, 5, P.armorD);
  px(ctx, 33, 51 + oy, 4, 3, P.armor);
  px(ctx, 34, 57 + oy, 10, 5, P.K);
  px(ctx, 35, 58 + oy, 8, 3, P.boot);
  px(ctx, 35, 58 + oy, 6, 1, P.bootL);
  px(ctx, 37, 58 + oy, 5, 1, P.visor);

  // 躯干（压缩）
  px(ctx, 23, 39 + oy, 20, 4, P.K);
  px(ctx, 22, 42 + oy, 22, 13, P.K);
  px(ctx, 22, 54 + oy, 19, 4, P.K);
  px(ctx, 23, 42 + oy, 20, 12, P.coat);
  px(ctx, 23, 42 + oy, 3, 12, P.coatL);
  px(ctx, 38, 43 + oy, 3, 10, P.coatD);
  // 胸甲
  px(ctx, 27, 42 + oy, 12, 8, P.K);
  px(ctx, 28, 43 + oy, 10, 7, P.armor);
  px(ctx, 29, 43 + oy, 8, 1, P.armorL);
  px(ctx, 31, 45 + oy, 6, 1, P.visor);
  px(ctx, 32, 48 + oy, 4, 1, P.scarf);
  // 腰带 / 下摆
  px(ctx, 23, 52 + oy, 18, 2, P.K);
  px(ctx, 24, 52 + oy, 16, 2, P.armorD);
  px(ctx, 31, 52 + oy, 4, 2, P.gold);
  px(ctx, 31, 55 + oy, 2, 5, P.lining);
  px(ctx, 24, 55 + oy, 6, 1, P.coatD);
  px(ctx, 36, 55 + oy, 4, 1, P.coatD);

  // 头部
  drawPlayerHead(ctx, 30 + oy, spec.hurt);

  // 持枪手臂（低位）
  const y = 41 + oy;
  px(ctx, 37, y + 1, 5, 4, P.K);
  px(ctx, 38, y + 2, 3, 2, P.coatL);
  px(ctx, 41, y + 2, 5, 3, P.coatD);
  px(ctx, 44, y + 2, 3, 2, P.skin);
  px(ctx, 41, y + 2, 10, 4, P.K);
  px(ctx, 42, y + 3, 8, 2, P.metalD);
  px(ctx, 43, y + 3, 5, 1, P.metal);
  px(ctx, 50, y + 3, 4, 1, P.metalHi);
  px(ctx, 53, y + 3, 1, 1, P.visor);
  px(ctx, 44, y + 3, 2, 1, P.visor);
  px(ctx, 44, y + 6, 3, 2, P.K);
  px(ctx, 45, y + 6, 2, 1, P.armorD);
}

function drawPlayerJump(ctx, spec) {
  const phase = spec.phase || 0;
  const oy = phase === 0 ? -3 : (phase === 1 ? -1 : 1);
  drawPlayerScarfTail(ctx, 4 + oy, phase === 1 ? 1 : 0);

  // 腿
  if (phase === 0) {
    drawPlayerLeg(ctx, 26, 42 + oy, 5, false);
    drawPlayerLeg(ctx, 33, 42 + oy, 3, true);
    px(ctx, 26, 51 + oy, 8, 2, P.armorD);
  } else if (phase === 1) {
    // 收起
    drawPlayerLeg(ctx, 26, 43 + oy, 8, false);
    drawPlayerLeg(ctx, 33, 43 + oy, 6, true);
    px(ctx, 25, 48 + oy, 9, 2, P.coatD);
    px(ctx, 32, 47 + oy, 9, 2, P.coatD);
  } else {
    drawPlayerLeg(ctx, 26, 43 + oy, 0, false);
    drawPlayerLeg(ctx, 33, 43 + oy, 1, true);
    px(ctx, 35, 58 + oy, 7, 3, P.K);
    px(ctx, 35, 58 + oy, 5, 2, P.boot);
  }

  drawPlayerBackArm(ctx, oy, null);
  ctx.save();
  drawPlayerTorso(ctx, oy, false);
  drawPlayerHead(ctx, 8 + oy, false);
  drawPlayerGunArm(ctx, oy, 0);
  ctx.restore();
}

function drawBlood(ctx, x, y, w, h, alpha) {
  px(ctx, x, y, w, h, rgba('#7a0d22', alpha));
  px(ctx, x + 2, y + h, Math.max(1, w - 4), 1, rgba('#a51530', alpha * 0.7));
}

function drawPlayerDeath(ctx, phase) {
  if (phase === 0) {
    drawPlayerStanding(ctx, { oy: 1, lean: -2, hurt: true, recoil: 1 });
    px(ctx, 31, 32, 5, 2, P.red);
    px(ctx, 35, 29, 2, 1, P.red);
    drawBlood(ctx, 35, 43, 3, 1, 0.7);
    return;
  }

  // 阴影
  px(ctx, 20, 61, 30, 2, 'rgba(0,0,0,0.42)');

  if (phase === 1) {
    // 单膝跪地
    drawPlayerScarfTail(ctx, 8, 1);
    // 后腿
    px(ctx, 24, 48, 9, 8, P.K);
    px(ctx, 25, 49, 7, 6, P.armorD);
    px(ctx, 22, 55, 12, 7, P.K);
    px(ctx, 23, 56, 10, 5, P.boot);
    px(ctx, 23, 56, 8, 1, P.bootL);
    // 前腿屈膝
    px(ctx, 34, 44, 7, 10, P.K);
    px(ctx, 35, 45, 5, 8, P.armorD);
    px(ctx, 32, 52, 12, 6, P.K);
    px(ctx, 33, 53, 10, 4, P.boot);
    px(ctx, 33, 53, 8, 1, P.bootL);
    // 躯干
    px(ctx, 23, 34, 19, 16, P.K);
    px(ctx, 24, 35, 17, 14, P.coat);
    px(ctx, 24, 35, 3, 13, P.coatL);
    px(ctx, 27, 35, 11, 8, P.armor);
    px(ctx, 29, 37, 6, 1, P.visor);
    px(ctx, 30, 40, 4, 1, P.scarfD);
    px(ctx, 31, 48, 2, 2, P.red);
    // 头
    drawPlayerHead(ctx, 20, true);
    // 垂下的手臂
    px(ctx, 38, 38, 4, 9, P.K);
    px(ctx, 39, 39, 2, 7, P.coat);
    px(ctx, 39, 47, 3, 2, P.skin);
    // 脱落的枪
    px(ctx, 43, 56, 9, 3, P.K);
    px(ctx, 44, 57, 7, 1, P.metalD);
    drawBlood(ctx, 28, 58, 12, 2, 0.7);
    return;
  }

  if (phase === 2) {
    // 侧倒中
    px(ctx, 18, 50, 18, 12, P.K);
    px(ctx, 19, 51, 16, 9, P.coat);
    px(ctx, 19, 51, 3, 8, P.coatL);
    px(ctx, 24, 49, 14, 6, P.armorD);
    px(ctx, 30, 46, 12, 10, P.K);
    px(ctx, 31, 47, 10, 8, P.coat);
    px(ctx, 36, 48, 7, 6, P.armor);
    px(ctx, 41, 50, 7, 7, P.K);
    drawPlayerHead(ctx, 45, true);
    px(ctx, 9, 46, 12, 6, P.K);
    px(ctx, 10, 47, 10, 4, P.armorD);
    px(ctx, 4, 51, 9, 4, P.K);
    px(ctx, 5, 52, 7, 2, P.coat);
    drawPlayerScarfTail(ctx, 5, 1);
    drawBlood(ctx, 22, 59, 15, 3, 0.6);
    return;
  }

  // 倒地（phase 3..7）
  const t = phase - 3;
  px(ctx, 13, 60, 36, 2, 'rgba(0,0,0,0.5)');
  // 腿
  px(ctx, 12, 53 + (t % 2), 17, 7, P.K);
  px(ctx, 13, 54 + (t % 2), 15, 5, P.armorD);
  px(ctx, 13, 54, 12, 1, P.armor);
  px(ctx, 9, 57, 7, 4, P.K);
  px(ctx, 10, 58, 5, 3, P.boot);
  // 大衣 / 躯干
  px(ctx, 24, 50 + (t % 2), 22, 12, P.K);
  px(ctx, 25, 51 + (t % 2), 20, 10, P.coat);
  px(ctx, 25, 51, 3, 9, P.coatL);
  px(ctx, 32, 52, 11, 6, P.armor);
  px(ctx, 34, 54, 5, 1, P.visor);
  px(ctx, 35, 56, 3, 1, P.scarfD);
  // 头
  px(ctx, 45, 52 + (t % 2), 10, 9, P.K);
  px(ctx, 46, 53 + (t % 2), 8, 7, P.armor);
  px(ctx, 47, 54 + (t % 2), 6, 1, P.armorL);
  px(ctx, 49, 55 + (t % 2), 5, 2, P.visor);
  px(ctx, 51, 55 + (t % 2), 3, 1, P.visorHot);
  px(ctx, 47, 58 + (t % 2), 6, 2, P.armorD);
  // 围巾
  px(ctx, 41, 58, 6, 2, P.scarfD);
  px(ctx, 38, 59, 5, 1, P.scarf);
  // 手 / 枪
  px(ctx, 40, 59, 5, 2, P.K);
  px(ctx, 40, 59, 3, 1, P.skin);
  px(ctx, 48, 60, 8, 2, P.K);
  px(ctx, 49, 60, 6, 1, P.metalD);
  // 血泊
  const bw = 16 + t * 2;
  drawBlood(ctx, 30 - Math.floor(bw / 4), 61, bw, 2, 0.65);
}

// ============================================================
// 暴徒
// ============================================================
const THUG_VARIANTS = {
  mohawk: {
    skin: '#d59a68', skinD: '#a66540', skinL: '#efbd8c',
    top: '#2a1720', topL: '#472735', topD: '#160b12',
    pants: '#191b24', pantsL: '#2a2d3a',
    accent: '#ff2e88', accentHot: '#ff8ec0',
    mohawk: '#ff3048', mohawkD: '#941326',
    metal: '#6a7488', boots: '#0d1017',
  },
  mask: {
    skin: '#c98a60', skinD: '#8f5436', skinL: '#e8b38a',
    top: '#1b2a32', topL: '#2f4a55', topD: '#0d171d',
    pants: '#151a22', pantsL: '#28313e',
    accent: '#39ff88', accentHot: '#b9ffd4',
    mask: '#c3ccd8', maskD: '#7e8a99', hood: '#20343d',
    metal: '#78869c', boots: '#0d1118',
  },
  bald: {
    skin: '#b97a4f', skinD: '#7d4a2e', skinL: '#d79b6c',
    top: '#4a2222', topL: '#6e3636', topD: '#2a1010',
    pants: '#20222b', pantsL: '#333644',
    accent: '#ffb347', accentHot: '#ffe0a0',
    beard: '#2a1b16',
    metal: '#6a7488', boots: '#0d1017',
  },
};

function drawThugHead(ctx, v, hy, hurt) {
  const K = '#08060a';
  // 轮廓（压缩比例）
  px(ctx, 29, hy - 1, 8, 1, K);
  px(ctx, 28, hy, 11, 2, K);
  px(ctx, 27, hy + 2, 14, 8, K);
  px(ctx, 28, hy + 10, 13, 4, K);
  px(ctx, 31, hy + 14, 7, 3, K);
  // 脖子
  px(ctx, 31, hy + 13, 8, 4, v.skinD);

  if (v.mohawk) {
    // 光头 / 两鬓
    px(ctx, 28, hy + 2, 11, 7, v.skin);
    px(ctx, 29, hy + 1, 9, 2, v.skinL);
    px(ctx, 28, hy + 6, 2, 3, v.skinD);
    // 莫西干
    px(ctx, 30, hy - 3, 2, 5, v.mohawkD);
    px(ctx, 31, hy - 4, 3, 5, v.mohawk);
    px(ctx, 32, hy - 4, 2, 2, '#ff7a8c');
    px(ctx, 29, hy - 1, 2, 2, v.mohawkD);
    px(ctx, 34, hy - 1, 1, 2, v.mohawkD);
    // 耳朵
    px(ctx, 27, hy + 6, 2, 3, K);
    px(ctx, 27, hy + 7, 1, 2, v.skinD);
    // 面部
    px(ctx, 32, hy + 5, 8, 7, v.skin);
    px(ctx, 33, hy + 5, 6, 2, v.skinL);
    px(ctx, 37, hy + 7, 3, 3, v.skinD);
    px(ctx, 39, hy + 6, 1, 2, v.skinL);
    // 眼睛 / 眉毛
    px(ctx, 36, hy + 5, 3, 1, K);
    px(ctx, 37, hy + 6, 1, 1, v.accent);
    px(ctx, 34, hy + 4, 4, 1, v.topD);
    // 鼻 / 嘴
    px(ctx, 40, hy + 8, 1, 2, v.skinD);
    px(ctx, 36, hy + 10, 4, 1, K);
    px(ctx, 37, hy + 11, 2, 1, v.skinD);
    // 胡茬 / 耳环
    px(ctx, 34, hy + 12, 5, 1, v.topD);
    px(ctx, 28, hy + 9, 1, 2, '#ffcf5a');
    // 头带
    px(ctx, 28, hy + 3, 10, 1, v.accent);
    px(ctx, 28, hy + 4, 10, 1, v.accentHot);
  } else if (v.mask) {
    // 兜帽
    px(ctx, 27, hy + 2, 13, 8, v.topD);
    px(ctx, 28, hy + 3, 11, 6, v.hood);
    px(ctx, 29, hy + 2, 8, 1, v.topL);
    px(ctx, 27, hy + 8, 3, 5, v.topD);
    px(ctx, 28, hy + 8, 2, 4, v.hood);
    // 面具
    px(ctx, 32, hy + 4, 8, 9, K);
    px(ctx, 33, hy + 5, 6, 7, v.mask);
    px(ctx, 33, hy + 5, 5, 1, '#eef3fa');
    px(ctx, 38, hy + 6, 1, 5, v.maskD);
    // 眼缝
    px(ctx, 34, hy + 6, 5, 2, '#101820');
    px(ctx, 35, hy + 6, 3, 1, v.accent);
    px(ctx, 37, hy + 6, 1, 1, v.accentHot);
    // 呼吸阀
    px(ctx, 35, hy + 10, 4, 3, v.maskD);
    px(ctx, 36, hy + 11, 2, 1, '#0c1218');
    px(ctx, 34, hy + 13, 5, 1, '#0c1218');
    // 头顶褶皱
    px(ctx, 31, hy + 3, 7, 1, v.accent);
    // 耳朵
    px(ctx, 27, hy + 8, 1, 2, v.skinD);
  } else {
    // 光头 + 胡子
    px(ctx, 28, hy + 1, 11, 9, v.skin);
    px(ctx, 29, hy + 1, 8, 2, v.skinL);
    px(ctx, 28, hy + 5, 2, 4, v.skinD);
    px(ctx, 27, hy + 6, 2, 3, K);
    px(ctx, 27, hy + 7, 1, 2, v.skinD);
    // 面部
    px(ctx, 32, hy + 5, 8, 7, v.skin);
    px(ctx, 33, hy + 5, 6, 2, v.skinL);
    px(ctx, 37, hy + 7, 3, 3, v.skinD);
    px(ctx, 39, hy + 6, 1, 2, v.skinL);
    // 眼睛
    px(ctx, 35, hy + 6, 4, 1, K);
    px(ctx, 37, hy + 6, 1, 1, v.accent);
    px(ctx, 33, hy + 5, 4, 1, v.beard);
    // 鼻 / 嘴
    px(ctx, 40, hy + 8, 1, 2, v.skinD);
    px(ctx, 36, hy + 11, 4, 1, K);
    // 络腮胡
    px(ctx, 31, hy + 9, 8, 5, v.beard);
    px(ctx, 34, hy + 10, 5, 3, v.beard);
    px(ctx, 36, hy + 11, 2, 2, v.skinD);
    px(ctx, 31, hy + 13, 7, 1, '#3f2a22');
    // 伤疤
    line(ctx, 34, hy + 4, 37, hy + 8, v.skinD);
    px(ctx, 30, hy + 3, 1, 1, v.skinL);
  }

  if (hurt) {
    px(ctx, 35, hy + 7, 3, 1, '#7a0d1c');
    px(ctx, 38, hy + 10, 2, 1, '#7a0d1c');
  }
}

function drawThugBody(ctx, v, oy, opts) {
  // 围巾 / 领口
  px(ctx, 26, 23 + oy, 15, 3, v.topD);
  // 躯干
  px(ctx, 23, 25 + oy, 20, 19, '#08060a');
  px(ctx, 24, 26 + oy, 18, 17, v.top);
  px(ctx, 25, 26 + oy, 3, 16, v.topL);
  px(ctx, 40, 27 + oy, 2, 15, v.topD);
  // 肩部
  px(ctx, 22, 26 + oy, 5, 5, v.topD);
  px(ctx, 38, 26 + oy, 5, 5, v.topD);
  px(ctx, 23, 27 + oy, 3, 3, v.topL);
  px(ctx, 39, 27 + oy, 3, 3, v.topL);
  // 胸甲 / 背心
  px(ctx, 28, 27 + oy, 10, 12, v.topD);
  px(ctx, 29, 28 + oy, 8, 10, v.top);
  px(ctx, 30, 28 + oy, 6, 1, v.topL);
  px(ctx, 32, 31 + oy, 4, 1, v.accent);
  // 皮带 / 勋章
  px(ctx, 24, 40 + oy, 18, 2, '#08060a');
  px(ctx, 25, 40 + oy, 16, 1, v.topD);
  px(ctx, 30, 40 + oy, 3, 2, '#ffcf5a');
  px(ctx, 34, 40 + oy, 2, 2, v.metal);
  // 口袋
  px(ctx, 25, 36 + oy, 4, 3, v.topD);
  px(ctx, 26, 36 + oy, 2, 1, v.topL);
  // 纹身手臂
  if (v.bald) {
    px(ctx, 23, 30 + oy, 2, 8, v.accent);
    px(ctx, 24, 33 + oy, 1, 1, v.accentHot);
  }
  // 轮廓光
  px(ctx, 42, 27 + oy, 1, 14, v.topL);
}

function drawThugLeg(ctx, v, x, yTop, lift, front) {
  const y = yTop - lift;
  px(ctx, x, y, 6, 9, '#08060a');
  px(ctx, x + 1, y, 4, 8, v.pants);
  px(ctx, x + 1, y, 2, 5, v.pantsL);
  px(ctx, x, y + 8, 6, 2, '#08060a');
  px(ctx, x + 1, y + 8, 4, 1, front ? v.pantsL : v.pants);
  px(ctx, x, y + 10, 5, 5, '#08060a');
  px(ctx, x + 1, y + 10, 3, 4, v.pants);
  px(ctx, x - 1, y + 14, 8, 4, '#08060a');
  px(ctx, x, y + 15, 6, 3, v.boots);
  if (front) {
    px(ctx, x + 6, y + 15, 2, 3, '#08060a');
    px(ctx, x + 6, y + 15, 2, 1, v.pantsL);
  }
  // 护膝
  px(ctx, x + 1, y + 9, 3, 1, v.metal);
}

function drawThugLegs(ctx, v, oy, phase) {
  const swing = phase != null ? [-3, -1, 1, 3, 1, -1][phase % 6] : 0;
  const backX = 27 - Math.round(swing * 0.6);
  const frontX = 33 + Math.round(swing * 0.6);
  drawThugLeg(ctx, v, backX, 42 + oy, Math.max(0, -swing), false);
  drawThugLeg(ctx, v, frontX, 42 + oy, Math.max(0, swing), true);
}

function drawThugBackArm(ctx, v, oy, phase) {
  const sw = phase != null ? [-1, 0, 1, 1, 0, -1][phase % 6] : 0;
  px(ctx, 22, 28 + oy, 4, 3, '#08060a');
  px(ctx, 23, 29 + oy, 2, 2, v.topL);
  px(ctx, 21, 31 + oy + sw, 4, 8, '#08060a');
  px(ctx, 22, 32 + oy + sw, 2, 6, v.skin);
  px(ctx, 22, 38 + oy + sw, 2, 2, v.skinD);
  // 手
  px(ctx, 21, 39 + oy + sw, 3, 2, v.skin);
  // 臂环
  px(ctx, 21, 35 + oy + sw, 3, 1, v.accent);
}

function drawThugGunArm(ctx, v, oy, opts) {
  const raised = !!opts.aim;
  const rx = opts.recoil || 0;
  const y = (raised ? 26 : 29) + oy;
  // 肩 / 臂
  px(ctx, 37, 27 + oy, 5, 4, '#08060a');
  px(ctx, 38, 28 + oy, 3, 2, v.topL);
  px(ctx, 39 - rx, y + 1, 5, 3, '#08060a');
  px(ctx, 40 - rx, y + 1, 4, 2, v.top);
  px(ctx, 43 - rx, y + 2, 4, 3, v.skin);
  px(ctx, 43 - rx, y + 2, 3, 1, v.skinL);
  px(ctx, 46 - rx, y + 3, 2, 2, v.skinD);
  // 枪
  if (v.mask) {
    // 冲锋枪
    px(ctx, 42 - rx, y + 2, 13, 4, '#08060a');
    px(ctx, 43 - rx, y + 3, 11, 2, v.metal);
    px(ctx, 44 - rx, y + 3, 6, 1, '#aeb9c9');
    px(ctx, 54 - rx, y + 3, 3, 1, '#0a0d13');
    px(ctx, 45 - rx, y + 6, 3, 3, '#08060a');
    px(ctx, 46 - rx, y + 6, 2, 2, v.topD);
    px(ctx, 48 - rx, y + 3, 2, 1, v.accent);
    px(ctx, 52 - rx, y + 2, 1, 1, v.accentHot);
  } else {
    // 手枪 / 左轮
    px(ctx, 42 - rx, y + 2, 9, 4, '#08060a');
    px(ctx, 43 - rx, y + 3, 7, 2, v.metal);
    px(ctx, 44 - rx, y + 3, 5, 1, '#aeb9c9');
    px(ctx, 50 - rx, y + 3, 3, 1, '#0a0d13');
    px(ctx, 45 - rx, y + 6, 3, 3, '#08060a');
    px(ctx, 46 - rx, y + 6, 2, 2, v.topD);
    px(ctx, 44 - rx, y + 3, 1, 1, v.accent);
  }
  // 枪口光点
  px(ctx, v.mask ? 56 - rx : 52 - rx, y + 3, 1, 1, v.accentHot);
}

function drawThugStanding(ctx, v, opts) {
  const oy = opts.oy || 0;
  drawThugBackArm(ctx, v, oy, opts.legPhase);
  drawThugLegs(ctx, v, oy, opts.legPhase);
  drawThugBody(ctx, v, oy, opts);
  drawThugHead(ctx, v, 9 + oy, opts.hurt);
  drawThugGunArm(ctx, v, oy, opts);
}

function drawThugCrouch(ctx, v, spec) {
  const oy = spec.bob ? -1 : 0;
  // 折叠腿
  px(ctx, 25, 50 + oy, 8, 7, '#08060a');
  px(ctx, 26, 51 + oy, 6, 5, v.pants);
  px(ctx, 23, 57 + oy, 10, 5, '#08060a');
  px(ctx, 24, 58 + oy, 8, 3, v.boots);
  px(ctx, 33, 50 + oy, 8, 7, '#08060a');
  px(ctx, 34, 51 + oy, 6, 5, v.pants);
  px(ctx, 34, 57 + oy, 11, 5, '#08060a');
  px(ctx, 35, 58 + oy, 9, 3, v.boots);
  // 躯干
  px(ctx, 23, 38 + oy, 20, 16, '#08060a');
  px(ctx, 24, 39 + oy, 18, 14, v.top);
  px(ctx, 25, 39 + oy, 3, 13, v.topL);
  px(ctx, 28, 40 + oy, 10, 8, v.topD);
  px(ctx, 29, 41 + oy, 8, 6, v.top);
  px(ctx, 32, 43 + oy, 4, 1, v.accent);
  px(ctx, 24, 51 + oy, 18, 2, '#08060a');
  px(ctx, 25, 51 + oy, 16, 1, v.topD);
  // 头
  drawThugHead(ctx, v, 30 + oy, spec.hurt);
  // 枪
  const y = 40 + oy;
  px(ctx, 37, 40 + oy, 4, 3, '#08060a');
  px(ctx, 38, 40 + oy, 2, 2, v.topL);
  px(ctx, 40, y + 2, 5, 2, v.top);
  px(ctx, 44, y + 2, 3, 2, v.skin);
  px(ctx, 42, y + 2, 9, 3, '#08060a');
  px(ctx, 43, y + 3, 7, 1, v.metal);
  px(ctx, 50, y + 3, 2, 1, '#0a0d13');
  px(ctx, 44, y + 4, 2, 1, v.accent);
}

function drawThugDeath(ctx, v, phase) {
  px(ctx, 20, 61, 28, 2, 'rgba(0,0,0,0.4)');
  if (phase === 0) {
    drawThugStanding(ctx, v, { oy: 1, hurt: true, recoil: 1 });
    px(ctx, 31, 33, 4, 2, '#7a0d1c');
    return;
  }
  if (phase === 1) {
    // 跪倒
    px(ctx, 24, 48, 9, 8, '#08060a');
    px(ctx, 25, 49, 7, 6, v.pants);
    px(ctx, 22, 56, 12, 6, '#08060a');
    px(ctx, 23, 57, 10, 4, v.boots);
    px(ctx, 34, 44, 7, 11, '#08060a');
    px(ctx, 35, 45, 5, 9, v.pants);
    px(ctx, 32, 53, 12, 6, '#08060a');
    px(ctx, 33, 54, 10, 4, v.boots);
    px(ctx, 23, 34, 19, 15, '#08060a');
    px(ctx, 24, 35, 17, 13, v.top);
    px(ctx, 24, 35, 3, 12, v.topL);
    px(ctx, 28, 35, 10, 7, v.topD);
    px(ctx, 32, 38, 4, 1, v.accent);
    drawThugHead(ctx, v, 21, true);
    px(ctx, 38, 38, 4, 9, '#08060a');
    px(ctx, 39, 39, 2, 7, v.skin);
    px(ctx, 42, 55, 9, 3, '#08060a');
    px(ctx, 43, 56, 7, 1, v.metal);
    px(ctx, 28, 59, 12, 2, 'rgba(122,13,28,0.65)');
    return;
  }
  if (phase === 2) {
    px(ctx, 18, 50, 19, 12, '#08060a');
    px(ctx, 19, 51, 17, 10, v.top);
    px(ctx, 19, 51, 3, 9, v.topL);
    px(ctx, 30, 46, 14, 11, '#08060a');
    px(ctx, 31, 47, 12, 9, v.top);
    px(ctx, 43, 48, 8, 8, '#08060a');
    drawThugHead(ctx, v, 48, true);
    px(ctx, 8, 48, 13, 6, '#08060a');
    px(ctx, 9, 49, 11, 4, v.pants);
    px(ctx, 4, 53, 9, 4, '#08060a');
    px(ctx, 5, 54, 7, 2, v.boots);
    px(ctx, 24, 59, 14, 3, 'rgba(122,13,28,0.6)');
    return;
  }
  const t = phase - 3;
  px(ctx, 13, 60, 34, 2, 'rgba(0,0,0,0.5)');
  px(ctx, 12, 53 + (t % 2), 16, 7, '#08060a');
  px(ctx, 13, 54 + (t % 2), 14, 5, v.pants);
  px(ctx, 8, 57, 8, 4, '#08060a');
  px(ctx, 9, 58, 6, 3, v.boots);
  px(ctx, 24, 50 + (t % 2), 20, 12, '#08060a');
  px(ctx, 25, 51 + (t % 2), 18, 10, v.top);
  px(ctx, 25, 51, 3, 9, v.topL);
  px(ctx, 33, 52, 8, 6, v.topD);
  px(ctx, 35, 54, 4, 1, v.accent);
  px(ctx, 43, 52 + (t % 2), 10, 9, '#08060a');
  px(ctx, 44, 53 + (t % 2), 8, 7, v.skin);
  px(ctx, 46, 55 + (t % 2), 5, 1, '#ff3048');
  px(ctx, 47, 57 + (t % 2), 4, 2, v.topD);
  px(ctx, 38, 59, 6, 2, '#08060a');
  px(ctx, 38, 59, 4, 1, v.skin);
  px(ctx, 46, 60, 8, 2, '#08060a');
  px(ctx, 47, 60, 6, 1, v.metal);
  const bw = 14 + t * 2;
  px(ctx, 30 - Math.floor(bw / 4), 61, bw, 2, 'rgba(122,13,28,0.6)');
}

// ============================================================
// BOSS
// ============================================================
const B = {
  K: '#070509', cape: '#3a0c1e', capeD: '#220711', capeL: '#611830',
  armorD: '#12141d', armor: '#232838', armorL: '#3d465e', armorHi: '#6b7a96',
  metal: '#5f6a7e', metalHi: '#aab6c9', metalD: '#333b4b',
  red: '#ff2e4a', redHot: '#ffb3b8', redD: '#8a0e21',
  gold: '#ffcf5a', orange: '#ff8a3d',
  skin: '#9d6a50', tube: '#3f4858',
};

function drawBossCape(ctx, oy, lean) {
  // 披风
  px(ctx, 26 + lean, 44 + oy, 58, 50, B.K);
  px(ctx, 27 + lean, 45 + oy, 56, 47, B.capeD);
  px(ctx, 29 + lean, 46 + oy, 52, 44, B.cape);
  px(ctx, 31 + lean, 47 + oy, 6, 38, B.capeL);
  // 破损下摆
  for (let i = 0; i < 9; i++) {
    const x = 27 + lean + i * 6;
    const h = 2 + (i % 3);
    px(ctx, x, 90 + oy, 5, 3 + h, B.capeD);
    px(ctx, x + 1, 92 + oy, 4, h, B.cape);
  }
  px(ctx, 73 + lean, 56 + oy, 2, 20, B.capeL);
  // 披风上的帮派纹样
  px(ctx, 40 + lean, 68 + oy, 12, 2, rgba(B.red, 0.45));
  px(ctx, 45 + lean, 72 + oy, 14, 1, rgba(B.red, 0.3));
}

function drawBossLeg(ctx, x, yTop, lift, front, oy) {
  const y = yTop - lift;
  // 大腿
  px(ctx, x, y, 18, 17, B.K);
  px(ctx, x + 1, y, 16, 15, B.armorD);
  px(ctx, x + 3, y + 1, 12, 12, B.armor);
  px(ctx, x + 4, y + 2, 9, 2, B.armorL);
  // 液压管
  px(ctx, x + 2, y + 4, 2, 10, B.tube);
  px(ctx, x + 14, y + 5, 2, 9, B.tube);
  // 膝甲
  px(ctx, x - 1, y + 14, 20, 7, B.K);
  px(ctx, x + 1, y + 15, 16, 5, B.armorL);
  px(ctx, x + 4, y + 16, 10, 2, B.metal);
  px(ctx, x + 7, y + 15, 4, 1, B.armorHi);
  // 小腿
  px(ctx, x + 2, y + 20, 15, 12, B.K);
  px(ctx, x + 3, y + 21, 13, 10, B.armorD);
  px(ctx, x + 5, y + 22, 9, 7, B.armor);
  px(ctx, x + 6, y + 22, 2, 6, B.armorL);
  // 脚
  px(ctx, x - 2, y + 30, 23, 8, B.K);
  px(ctx, x, y + 31, 19, 6, B.armorD);
  px(ctx, x + 2, y + 32, 16, 3, B.metalD);
  px(ctx, x + (front ? 17 : 4), y + 32, 3, 1, B.red);
  // 铆钉
  px(ctx, x + 5, y + 26, 1, 1, B.metalHi);
  px(ctx, x + 11, y + 26, 1, 1, B.metalHi);
}

function drawBossTorso(ctx, oy, lean) {
  // 腰 / 胯
  px(ctx, 34 + lean, 72 + oy, 44, 14, B.K);
  px(ctx, 36 + lean, 73 + oy, 40, 12, B.armorD);
  px(ctx, 39 + lean, 74 + oy, 34, 8, B.armor);
  px(ctx, 40 + lean, 76 + oy, 30, 2, B.armorL);
  // 腰部警示条
  for (let i = 0; i < 8; i++) {
    px(ctx, 40 + lean + i * 4, 80 + oy, 2, 3, i % 2 ? B.gold : B.armorD);
  }
  // 躯干主体
  px(ctx, 30 + lean, 38 + oy, 54, 40, B.K);
  px(ctx, 32 + lean, 40 + oy, 50, 34, B.armorD);
  px(ctx, 35 + lean, 42 + oy, 44, 28, B.armor);
  px(ctx, 36 + lean, 42 + oy, 4, 26, B.armorL);
  // 胸甲
  px(ctx, 38 + lean, 43 + oy, 40, 22, B.K);
  px(ctx, 40 + lean, 44 + oy, 36, 19, B.armorD);
  px(ctx, 42 + lean, 45 + oy, 32, 15, B.armor);
  px(ctx, 43 + lean, 45 + oy, 18, 2, B.armorL);
  px(ctx, 43 + lean, 47 + oy, 2, 9, B.armorHi);
  // 胸口反应堆
  px(ctx, 54 + lean, 49 + oy, 12, 12, B.K);
  px(ctx, 55 + lean, 50 + oy, 10, 10, B.metalD);
  px(ctx, 56 + lean, 51 + oy, 8, 8, B.redD);
  px(ctx, 57 + lean, 52 + oy, 6, 6, B.red);
  px(ctx, 58 + lean, 53 + oy, 4, 4, B.redHot);
  px(ctx, 59 + lean, 54 + oy, 2, 2, '#ffffff');
  glow(ctx, 60 + lean, 55 + oy, 24, B.red, 0.25);
  // 胸甲铆钉 / 分缝
  px(ctx, 42 + lean, 58 + oy, 10, 1, B.armorD);
  px(ctx, 66 + lean, 46 + oy, 1, 14, B.armorD);
  for (let i = 0; i < 6; i++) {
    px(ctx, 42 + lean + i * 5, 46 + oy, 1, 1, B.metalHi);
  }
  // 腹部装甲
  px(ctx, 39 + lean, 68 + oy, 32, 8, B.K);
  px(ctx, 40 + lean, 68 + oy, 30, 6, B.armorD);
  px(ctx, 42 + lean, 69 + oy, 26, 3, B.armor);
  px(ctx, 43 + lean, 69 + oy, 12, 1, B.armorL);
  // 排气管 / 管线
  px(ctx, 32 + lean, 34 + oy, 4, 12, B.K);
  px(ctx, 33 + lean, 35 + oy, 2, 10, B.tube);
  px(ctx, 76 + lean, 36 + oy, 4, 10, B.K);
  px(ctx, 77 + lean, 37 + oy, 2, 8, B.tube);
  px(ctx, 34 + lean, 48 + oy, 3, 18, B.tube);
  px(ctx, 75 + lean, 50 + oy, 3, 16, B.tube);
}

function drawBossShoulders(ctx, oy, lean) {
  // 左肩甲
  px(ctx, 18 + lean, 36 + oy, 24, 20, B.K);
  px(ctx, 20 + lean, 37 + oy, 20, 17, B.armorD);
  px(ctx, 22 + lean, 38 + oy, 16, 14, B.armor);
  px(ctx, 23 + lean, 38 + oy, 13, 2, B.armorL);
  px(ctx, 19 + lean, 40 + oy, 4, 12, B.armorD);
  // 尖刺
  px(ctx, 17 + lean, 38 + oy, 4, 2, B.metal);
  px(ctx, 15 + lean, 37 + oy, 3, 2, B.metalHi);
  px(ctx, 20 + lean, 44 + oy, 2, 6, B.redD);
  px(ctx, 17 + lean, 52 + oy, 8, 2, B.metalD);
  // 右肩甲（机枪侧，更厚重）
  px(ctx, 74 + lean, 34 + oy, 26, 22, B.K);
  px(ctx, 76 + lean, 35 + oy, 22, 19, B.armorD);
  px(ctx, 78 + lean, 36 + oy, 18, 16, B.armor);
  px(ctx, 79 + lean, 36 + oy, 14, 2, B.armorL);
  px(ctx, 80 + lean, 40 + oy, 12, 2, B.armorHi);
  // 警告条纹
  for (let i = 0; i < 5; i++) {
    px(ctx, 78 + lean + i * 3, 45 + oy, 2, 4, i % 2 ? B.gold : B.armorD);
  }
  px(ctx, 94 + lean, 38 + oy, 4, 2, B.metal);
  px(ctx, 97 + lean, 36 + oy, 3, 2, B.metalHi);
  // 铆钉
  for (let i = 0; i < 4; i++) {
    px(ctx, 79 + lean + i * 4, 39 + oy, 1, 1, B.metalHi);
  }
}

function drawBossHead(ctx, hy, hurt, lean) {
  const x = 44 + lean;
  // 头盔轮廓
  px(ctx, x + 4, hy - 2, 16, 1, B.K);
  px(ctx, x + 2, hy - 1, 20, 2, B.K);
  px(ctx, x, hy + 1, 24, 20, B.K);
  px(ctx, x + 2, hy + 21, 20, 6, B.K);
  px(ctx, x + 5, hy + 27, 14, 3, B.K);
  // 头盔
  px(ctx, x + 2, hy + 1, 20, 10, B.armorD);
  px(ctx, x + 4, hy + 1, 16, 8, B.armor);
  px(ctx, x + 5, hy + 1, 12, 1, B.armorL);
  px(ctx, x + 3, hy + 4, 3, 8, B.armorD);
  // 犄角
  px(ctx, x - 2, hy + 2, 3, 3, B.metal);
  px(ctx, x - 4, hy, 3, 3, B.metalHi);
  px(ctx, x + 22, hy + 2, 3, 3, B.metal);
  px(ctx, x + 24, hy, 3, 3, B.metalHi);
  // 红色面罩 / 护目镜
  px(ctx, x + 5, hy + 8, 18, 7, B.K);
  px(ctx, x + 6, hy + 9, 16, 5, B.metalD);
  px(ctx, x + 7, hy + 10, 14, 3, B.redD);
  px(ctx, x + 8, hy + 10, 12, 2, B.red);
  px(ctx, x + 10, hy + 10, 7, 1, B.redHot);
  px(ctx, x + 17, hy + 11, 3, 1, '#ffffff');
  // 呼吸格栅
  px(ctx, x + 7, hy + 16, 14, 6, B.K);
  px(ctx, x + 8, hy + 17, 12, 4, B.armorD);
  for (let i = 0; i < 4; i++) px(ctx, x + 9 + i * 3, hy + 18, 2, 2, B.armorL);
  px(ctx, x + 10, hy + 21, 8, 1, B.metalD);
  // 面颊管线
  px(ctx, x + 2, hy + 12, 3, 10, B.K);
  px(ctx, x + 3, hy + 13, 1, 8, B.tube);
  px(ctx, x + 22, hy + 12, 2, 9, B.K);
  px(ctx, x + 22, hy + 13, 1, 7, B.tube);
  // 头盔顶部散热孔
  for (let i = 0; i < 4; i++) px(ctx, x + 7 + i * 3, hy + 3, 2, 1, B.armorD);
  // 轮廓光
  px(ctx, x + 23, hy + 3, 1, 6, rgba(B.red, 0.45));
  if (hurt) {
    px(ctx, x + 10, hy + 10, 6, 1, '#ffffff');
    px(ctx, x + 4, hy + 6, 3, 1, B.redHot);
  }
}

function drawBossGatling(ctx, oy, phase, aim, lean) {
  const spin = phase || 0;
  const rx = aim ? 2 : 0;
  // 肩关节
  px(ctx, 84 + lean, 48 + oy, 14, 16, B.K);
  px(ctx, 86 + lean, 49 + oy, 10, 13, B.armorD);
  px(ctx, 87 + lean, 50 + oy, 8, 10, B.armor);
  px(ctx, 88 + lean, 51 + oy, 6, 2, B.armorL);
  // 上臂
  px(ctx, 88 + lean, 58 + oy, 12, 8, B.K);
  px(ctx, 89 + lean, 59 + oy, 10, 6, B.armorD);
  px(ctx, 90 + lean, 60 + oy, 8, 3, B.armor);
  // 机枪主体
  px(ctx, 90 + lean - rx, 55 + oy, 19, 14, B.K);
  px(ctx, 91 + lean - rx, 56 + oy, 17, 12, B.armorD);
  px(ctx, 92 + lean - rx, 57 + oy, 15, 10, B.metalD);
  px(ctx, 93 + lean - rx, 58 + oy, 12, 2, B.metal);
  px(ctx, 92 + lean - rx, 64 + oy, 15, 2, B.armorD);
  // 弹鼓
  px(ctx, 88 + lean - rx, 68 + oy, 12, 10, B.K);
  px(ctx, 89 + lean - rx, 69 + oy, 10, 8, B.armorD);
  px(ctx, 90 + lean - rx, 70 + oy, 8, 6, B.metalD);
  px(ctx, 92 + lean - rx, 71 + oy, 4, 4, B.gold);
  px(ctx, 93 + lean - rx, 72 + oy, 2, 2, B.armorD);
  // 枪管
  const bx = 106 + lean - rx;
  px(ctx, bx, 57 + oy, 6, 9, B.K);
  px(ctx, bx + 1, 58 + oy, 5, 7, B.metalD);
  for (let i = 0; i < 3; i++) {
    const by = 58 + oy + i * 2;
    const hot = (spin + i) % 3 === 0;
    px(ctx, bx + 1, by, 5, 1, hot ? B.metalHi : B.metal);
    px(ctx, bx + 5, by, 1, 1, hot ? B.redHot : B.metal);
  }
  // 枪口环 / 火焰
  px(ctx, bx + 5, 56 + oy, 2, 11, B.K);
  px(ctx, bx + 6, 57 + oy, 1, 9, B.metalHi);
  if (aim) {
    glow(ctx, 111 + lean - rx, 62 + oy, 18, B.orange, 0.3);
    px(ctx, 111 + lean - rx, 60 + oy, 3, 4, B.orange);
    px(ctx, 112 + lean - rx, 61 + oy, 1, 2, '#ffe9a8');
  }
  // 弹链
  for (let i = 0; i < 5; i++) {
    px(ctx, 88 + lean + i * 2, 78 + oy - (i % 2) * 2, 2, 3, B.K);
    px(ctx, 88 + lean + i * 2, 78 + oy - (i % 2) * 2, 1, 2, B.gold);
  }
}

function drawBossClaw(ctx, oy, lean) {
  // 左臂
  px(ctx, 22 + lean, 52 + oy, 12, 26, B.K);
  px(ctx, 23 + lean, 53 + oy, 10, 23, B.armorD);
  px(ctx, 24 + lean, 54 + oy, 8, 18, B.armor);
  px(ctx, 25 + lean, 55 + oy, 2, 14, B.armorL);
  // 爪
  px(ctx, 18 + lean, 76 + oy, 14, 8, B.K);
  px(ctx, 19 + lean, 77 + oy, 12, 6, B.metalD);
  px(ctx, 17 + lean, 80 + oy, 4, 2, B.metal);
  px(ctx, 15 + lean, 82 + oy, 4, 2, B.metalHi);
  px(ctx, 20 + lean, 83 + oy, 4, 2, B.metal);
  px(ctx, 25 + lean, 83 + oy, 4, 2, B.metalHi);
  // 液压
  px(ctx, 30 + lean, 56 + oy, 2, 14, B.tube);
  px(ctx, 28 + lean, 58 + oy, 2, 10, B.tube);
  // 肩部连接
  px(ctx, 28 + lean, 50 + oy, 6, 5, B.metalD);
}

function drawBossStanding(ctx, opts) {
  const oy = opts.oy || 0;
  const lean = opts.lean || 0;
  drawBossCape(ctx, oy, lean);
  drawBossLeg(ctx, 34 + lean, 80 + oy, opts.legLiftL || 0, false, oy);
  drawBossLeg(ctx, 60 + lean, 80 + oy, opts.legLiftR || 0, true, oy);
  drawBossClaw(ctx, oy, lean);
  drawBossTorso(ctx, oy, lean);
  drawBossShoulders(ctx, oy, lean);
  drawBossHead(ctx, 12 + oy, opts.hurt, lean);
  drawBossGatling(ctx, oy, opts.spin || 0, opts.gatling, lean);
}

function drawBossDeath(ctx, phase) {
  px(ctx, 16, 108, 80, 3, 'rgba(0,0,0,0.45)');
  if (phase <= 1) {
    drawBossStanding(ctx, { oy: phase * 2, lean: -2 - phase, hurt: true, spin: phase % 3 });
    px(ctx, 54 + (phase ? -2 : 0), 50, 8, 3, B.redHot);
    px(ctx, 40, 40, 4, 1, B.red);
    return;
  }
  if (phase === 2) {
    // 单膝跪地
    px(ctx, 30, 78, 28, 30, B.K);
    px(ctx, 32, 79, 24, 27, B.armorD);
    px(ctx, 34, 82, 18, 16, B.armor);
    px(ctx, 62, 88, 22, 20, B.K);
    px(ctx, 64, 89, 18, 17, B.armorD);
    px(ctx, 66, 91, 13, 12, B.armor);
    px(ctx, 28, 100, 68, 10, B.K);
    px(ctx, 30, 101, 64, 7, B.armorD);
    px(ctx, 34, 68, 44, 32, B.K);
    px(ctx, 36, 69, 40, 29, B.armorD);
    px(ctx, 38, 70, 36, 24, B.armor);
    px(ctx, 54, 76, 10, 10, B.redD);
    px(ctx, 55, 77, 8, 8, B.red);
    px(ctx, 57, 78, 4, 4, B.redHot);
    drawBossHead(ctx, 48, true, 4);
    // 掉落机枪
    px(ctx, 82, 98, 20, 6, B.K);
    px(ctx, 84, 99, 16, 3, B.metalD);
    px(ctx, 100, 99, 4, 2, B.metalHi);
    glow(ctx, 56, 82, 26, B.red, 0.18);
    return;
  }
  const t = phase - 3;
  // 倒地残骸
  const y = 86 + (t % 2);
  px(ctx, 14, 106, 86, 3, 'rgba(0,0,0,0.5)');
  // 腿
  px(ctx, 12, 88 + (t % 2), 34, 16, B.K);
  px(ctx, 14, 89 + (t % 2), 30, 13, B.armorD);
  px(ctx, 16, 91 + (t % 2), 22, 8, B.armor);
  px(ctx, 8, 99 + (t % 2), 14, 8, B.K);
  px(ctx, 9, 100 + (t % 2), 12, 6, B.armorD);
  // 躯干
  px(ctx, 40, y, 44, 22, B.K);
  px(ctx, 42, y + 1, 40, 19, B.armorD);
  px(ctx, 44, y + 2, 34, 15, B.armor);
  px(ctx, 54, y + 5, 10, 9, B.redD);
  px(ctx, 55, y + 6, 8, 6, B.red);
  px(ctx, 57, y + 7, 4, 3, B.redHot);
  // 头
  px(ctx, 78, y + 2, 18, 14, B.K);
  px(ctx, 80, y + 3, 15, 11, B.armorD);
  px(ctx, 82, y + 5, 11, 4, B.redD);
  px(ctx, 83, y + 5, 9, 3, B.red);
  px(ctx, 85, y + 5, 5, 1, B.redHot);
  // 断裂的机枪臂
  px(ctx, 78, y + 22, 26, 7, B.K);
  px(ctx, 80, y + 23, 22, 4, B.metalD);
  px(ctx, 96, y + 23, 8, 2, B.metal);
  // 碎片 / 火花
  for (let i = 0; i < 9; i++) {
    const sx = 20 + ((i * 13 + t * 7) % 80);
    const sy = 96 + ((i * 5 + t * 3) % 12);
    px(ctx, sx, sy, 2, 1, i % 2 ? B.armorL : B.red);
  }
  if (t >= 2) {
    px(ctx, 46, y - 3, 3, 2, B.orange);
    px(ctx, 50, y - 5, 2, 3, B.orange);
    px(ctx, 55, y - 4, 3, 1, B.redHot);
    glow(ctx, 56, y + 8, 34, B.red, 0.24);
  }
  // 血泊 / 冷却液
  px(ctx, 20, 106, 50 + t * 4, 2, 'rgba(122,13,28,0.55)');
}

// ============================================================
// 角色动作表
// ============================================================
function buildPlayerSpecs() {
  const specs = [];
  const bob = [0, 1, 1, 0, 1, 1];
  const wave = [0, 1, 0, -1, 0, 1];
  for (let i = 0; i < 6; i++) {
    specs.push({ pose: 'idle', bob: bob[i], wave: wave[i] });
  }
  for (let i = 0; i < 8; i++) {
    specs.push({ pose: 'run', legPhase: i, bob: i % 2, wave: [0, 1, 1, 0, -1, -1, 0, 1][i] });
  }
  const recoil = [0, 2, 1];
  for (let i = 0; i < 3; i++) specs.push({ pose: 'shoot', recoil: recoil[i] });
  for (let i = 0; i < 3; i++) specs.push({ pose: 'crouch', bob: i % 2, wave: i, hurt: false });
  for (let i = 0; i < 3; i++) specs.push({ pose: 'jump', phase: i });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'hurt', phase: i });
  for (let i = 0; i < 8; i++) specs.push({ pose: 'death', phase: i });
  for (let i = 0; i < 6; i++) specs.push({ pose: 'melee', poseIndex: i });
  return specs;
}

const PLAYER_TAGS = [
  { name: 'idle', from: 0, to: 5, direction: 'forward' },
  { name: 'run', from: 6, to: 13, direction: 'forward' },
  { name: 'shoot', from: 14, to: 16, direction: 'forward' },
  { name: 'crouch', from: 17, to: 19, direction: 'forward' },
  { name: 'jump', from: 20, to: 22, direction: 'forward' },
  { name: 'hurt', from: 23, to: 24, direction: 'forward' },
  { name: 'death', from: 25, to: 32, direction: 'forward' },
  { name: 'melee', from: 33, to: 38, direction: 'forward' },
];

function drawPlayerFrame(ctx, s) {
  if (s.pose === 'death') return drawPlayerDeath(ctx, s.phase);
  if (s.pose === 'crouch') return drawPlayerCrouch(ctx, s);
  if (s.pose === 'jump') return drawPlayerJump(ctx, s);
  if (s.pose === 'melee') {
    // 33/34 举刀，35/36/37 落刀，38 收势
    const poseIndex = s.poseIndex;
    let meleePose = 2;
    if (poseIndex <= 1) meleePose = 0;
    else if (poseIndex <= 4) meleePose = 2;
    else meleePose = 4;
    return drawPlayerStanding(ctx, {
      oy: 0, legPhase: null, hurt: false, meleePose, wave: poseIndex % 2,
    });
  }
  drawPlayerStanding(ctx, {
    oy: -(s.bob || 0),
    legPhase: s.pose === 'run' ? s.legPhase : null,
    recoil: s.recoil || 0,
    hurt: s.pose === 'hurt',
    wave: s.wave || 0,
    lean: s.pose === 'hurt' ? -2 : 0,
    meleePose: null,
  });
}

function buildThugSpecs() {
  const specs = [];
  const bob = [0, 1, 0, 1];
  for (let i = 0; i < 4; i++) specs.push({ pose: 'idle', bob: bob[i] });
  for (let i = 0; i < 6; i++) specs.push({ pose: 'walk', legPhase: i, bob: i % 2 });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'aim', aim: true, recoil: i });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'shoot', aim: true, recoil: i * 2 });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'crouch', bob: i });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'hurt', phase: i });
  for (let i = 0; i < 6; i++) specs.push({ pose: 'death', phase: i });
  return specs;
}

const THUG_TAGS = [
  { name: 'idle', from: 0, to: 3, direction: 'forward' },
  { name: 'walk', from: 4, to: 9, direction: 'forward' },
  { name: 'aim', from: 10, to: 11, direction: 'forward' },
  { name: 'shoot', from: 12, to: 13, direction: 'forward' },
  { name: 'crouch', from: 14, to: 15, direction: 'forward' },
  { name: 'hurt', from: 16, to: 17, direction: 'forward' },
  { name: 'death', from: 18, to: 23, direction: 'forward' },
];

function drawThugFrame(ctx, s, v) {
  if (s.pose === 'death') return drawThugDeath(ctx, v, s.phase);
  if (s.pose === 'crouch') return drawThugCrouch(ctx, v, s);
  if (s.pose === 'hurt') {
    return drawThugStanding(ctx, v, {
      oy: 1, hurt: true, recoil: 1, aim: true, legPhase: null, lean: -2,
    });
  }
  drawThugStanding(ctx, v, {
    oy: -(s.bob || 0),
    legPhase: s.pose === 'walk' ? s.legPhase : null,
    aim: !!s.aim,
    recoil: s.recoil || 0,
    hurt: false,
  });
}

function buildBossSpecs() {
  const specs = [];
  for (let i = 0; i < 4; i++) specs.push({ pose: 'idle', bob: i % 2 });
  for (let i = 0; i < 4; i++) {
    specs.push({
      pose: 'walk', bob: i % 2,
      legLiftL: i % 2 ? 1 : 0,
      legLiftR: i % 2 ? 0 : 1,
    });
  }
  for (let i = 0; i < 4; i++) specs.push({ pose: 'gatling', gatling: true, spin: i, recoil: i % 2 });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'charge', lean: 4, charge: i });
  for (let i = 0; i < 2; i++) specs.push({ pose: 'hurt', hurt: true, lean: -2 });
  for (let i = 0; i < 6; i++) specs.push({ pose: 'death', phase: i });
  return specs;
}

const BOSS_TAGS = [
  { name: 'idle', from: 0, to: 3, direction: 'forward' },
  { name: 'walk', from: 4, to: 7, direction: 'forward' },
  { name: 'gatling', from: 8, to: 11, direction: 'forward' },
  { name: 'charge', from: 12, to: 13, direction: 'forward' },
  { name: 'hurt', from: 14, to: 15, direction: 'forward' },
  { name: 'death', from: 16, to: 21, direction: 'forward' },
];

function drawBossFrame(ctx, s) {
  if (s.pose === 'death') return drawBossDeath(ctx, s.phase);
  drawBossStanding(ctx, {
    oy: -(s.bob || 0),
    lean: s.lean || 0,
    hurt: s.hurt,
    gatling: s.gatling,
    spin: s.spin || 0,
    legLiftL: s.legLiftL || 0,
    legLiftR: s.legLiftR || 0,
  });
  if (s.charge) {
    // 冲撞蓄力：红色能量溢出
    glow(ctx, 58, 54, 38, B.red, 0.24);
    px(ctx, 24, 48, 3, 2, B.orange);
    px(ctx, 88, 42, 2, 3, B.orange);
    px(ctx, 76, 72, 3, 1, B.redHot);
  }
}

// ============================================================
// 构建
// ============================================================
function buildCharacterSheet(logW, logH, specs, drawFn, tags, name) {
  const frameW = logW;
  const frameH = logH;
  const { c, ctx } = canvas(frameW * specs.length, frameH);
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < specs.length; i++) {
    ctx.save();
    ctx.translate(i * frameW, 0);
    drawFn(ctx, specs[i], i);
    ctx.restore();
  }
  saveSheet(c, makeAsepriteJSON(frameW, frameH, specs.length, tags, name), name);
}

function buildCharacters() {
  console.log('Building characters (1px grid)...');
  const playerSpecs = buildPlayerSpecs();
  buildCharacterSheet(64, 64, playerSpecs, (ctx, s) => drawPlayerFrame(ctx, s), PLAYER_TAGS, 'player');

  for (const key of ['mohawk', 'mask', 'bald']) {
    const v = THUG_VARIANTS[key];
    const specs = buildThugSpecs();
    buildCharacterSheet(64, 64, specs, (ctx, s) => drawThugFrame(ctx, s, v), THUG_TAGS, 'thug_' + key);
  }

  const bossSpecs = buildBossSpecs();
  buildCharacterSheet(112, 112, bossSpecs, (ctx, s) => drawBossFrame(ctx, s), BOSS_TAGS, 'boss');
}

buildCharacters();

module.exports = { buildCharacters };
