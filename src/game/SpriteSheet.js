// 程序化生成的像素 sprite sheet（帧动画）。
// 全部角色/敌人都是像素 sprite，禁止用发光矢量圆球直接画角色。

const PLAYER_PAL = {
  skin: '#e0a878', hair: '#243044', eye: '#16161f',
  jacket: '#1f8a9e', trim: '#5fe6ff', belt: '#20222e',
  pants: '#2b3450', boot: '#14141c', gun: '#3a3a48', flash: '#ffe680',
};

const THUG_PAL = {
  skin: '#c98a5e', hair: '#a8243a', eye: '#12100f',
  jacket: '#9c2135', trim: '#ff6b6b', belt: '#1f1a1c',
  pants: '#23252e', boot: '#101010', gun: '#2f2f3a', flash: '#ffd24a',
};

const BOSS_PAL = {
  skin: '#b8794c', hair: '#6f2fa0', eye: '#0d0d12',
  jacket: '#43285f', trim: '#b06bff', belt: '#1a1520',
  pants: '#20202c', boot: '#0d0d12', gun: '#26262f', flash: '#ff9a3a',
};

// 帧索引：idle / walk / shoot / jump / crouch / hurt
export const ANIM = {
  IDLE: [0, 1],
  WALK: [2, 3, 4, 5],
  RUN: [2, 3, 4, 5],
  SHOOT: [6, 7],
  JUMP: [8],
  CROUCH: [9],
  HURT: [10],
};

const HUMAN_SPECS = [
  { pose: 'idle', bob: 0 },
  { pose: 'idle', bob: 1 },
  { pose: 'walk', leg: 1.3, bob: 0 },
  { pose: 'walk', leg: 0, bob: 1 },
  { pose: 'walk', leg: -1.3, bob: 0 },
  { pose: 'walk', leg: 0, bob: 1 },
  { pose: 'shoot', flash: true },
  { pose: 'shoot', flash: false },
  { pose: 'jump' },
  { pose: 'crouch' },
  { pose: 'hurt' },
];

function r(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// 人形角色（面朝右），身体中心线在逻辑 x = BC
const BC = 13;
const LOG_W = 26;
const LOG_H = 24;

function drawHumanoid(ctx, pal, spec) {
  const bob = spec.bob ? 1 : 0;
  const oy = -bob;

  if (spec.pose === 'crouch') {
    r(ctx, BC - 3, 6 + oy, 6, 5, pal.skin);
    r(ctx, BC - 3, 5 + oy, 6, 2, pal.hair);
    r(ctx, BC + 1, 8 + oy, 1, 1, pal.eye);
    r(ctx, BC - 4, 12 + oy, 8, 5, pal.jacket);
    r(ctx, BC - 4, 12 + oy, 8, 1, pal.trim);
    r(ctx, BC - 4, 17 + oy, 8, 1, pal.belt);
    r(ctx, BC - 5, 18 + oy, 10, 3, pal.pants);
    r(ctx, BC - 6, 20 + oy, 4, 3, pal.boot);
    r(ctx, BC + 2, 20 + oy, 4, 3, pal.boot);
    r(ctx, BC + 1, 13 + oy, 4, 2, pal.jacket);
    r(ctx, BC + 3, 13 + oy, 7, 2, pal.gun);
    if (spec.flash) r(ctx, BC + 9, 12 + oy, 3, 4, pal.flash);
    return;
  }

  // 头 / 头发 / 眼
  r(ctx, BC - 3, 2 + oy, 6, 5, pal.skin);
  r(ctx, BC - 3, 1 + oy, 6, 2, pal.hair);
  r(ctx, BC + 1, 4 + oy, 1, 1, pal.eye);
  r(ctx, BC - 1, 7 + oy, 2, 1, pal.skin);

  // 躯干
  r(ctx, BC - 4, 8 + oy, 8, 6, pal.jacket);
  r(ctx, BC - 4, 8 + oy, 8, 1, pal.trim);
  r(ctx, BC - 4, 14 + oy, 8, 1, pal.belt);

  const legY = 15 + oy;

  if (spec.pose === 'jump') {
    r(ctx, BC - 3, legY - 1, 3, 5, pal.pants);
    r(ctx, BC + 1, legY - 1, 3, 5, pal.pants);
    r(ctx, BC - 3, legY + 4, 3, 2, pal.boot);
    r(ctx, BC + 1, legY + 4, 3, 2, pal.boot);
    r(ctx, BC - 5, 7 + oy, 2, 5, pal.jacket);
    r(ctx, BC + 3, 7 + oy, 2, 5, pal.jacket);
    return;
  }

  // 腿（走路摆动）
  const s = spec.leg || 0;
  r(ctx, BC - 3 + s, legY, 2, 7, pal.pants);
  r(ctx, BC + 1 - s, legY, 2, 7, pal.pants);
  r(ctx, BC - 4 + s, legY + 7, 3, 2, pal.boot);
  r(ctx, BC + 1 - s, legY + 7, 3, 2, pal.boot);

  // 手臂 + 枪
  const lean = spec.pose === 'hurt' ? -1 : 0;
  if (spec.pose === 'shoot') {
    r(ctx, BC + 1 + lean, 9 + oy, 4, 2, pal.jacket);
    r(ctx, BC + 3 + lean, 9 + oy, 7, 2, pal.gun);
    if (spec.flash) r(ctx, BC + 9 + lean, 8 + oy, 3, 4, pal.flash);
  } else {
    r(ctx, BC - 5 + lean, 9 + oy, 2, 5, pal.jacket);
    r(ctx, BC + 3 + lean, 9 + oy, 2, 5, pal.jacket);
    r(ctx, BC + 3 + lean, 11 + oy, 4, 2, pal.gun);
  }
}

// BOSS：更壮，肩甲、大枪，逻辑尺寸 24x28
const BBC = 12;
const BLOG_W = 24;
const BLOG_H = 28;

function drawBoss(ctx, pal, spec) {
  if (spec.pose === 'crouch') {
    r(ctx, BBC - 4, 8, 8, 6, pal.skin);
    r(ctx, BBC - 4, 6, 8, 3, pal.hair);
    r(ctx, BBC + 2, 11, 2, 2, pal.eye);
    r(ctx, BBC - 6, 15, 12, 6, pal.jacket);
    r(ctx, BBC - 6, 15, 12, 1, pal.trim);
    r(ctx, BBC - 6, 21, 12, 1, pal.belt);
    r(ctx, BBC - 7, 22, 14, 3, pal.pants);
    r(ctx, BBC - 8, 24, 5, 3, pal.boot);
    r(ctx, BBC + 3, 24, 5, 3, pal.boot);
    r(ctx, BBC + 2, 16, 5, 3, pal.jacket);
    r(ctx, BBC + 5, 16, 8, 3, pal.gun);
    if (spec.flash) r(ctx, BBC + 12, 15, 3, 5, pal.flash);
    return;
  }

  const bob = spec.bob ? 1 : 0;
  const oy = -bob;

  r(ctx, BBC - 4, 2 + oy, 8, 7, pal.skin);
  r(ctx, BBC - 4, 0 + oy, 8, 3, pal.hair);
  r(ctx, BBC + 2, 5 + oy, 2, 2, pal.eye);
  r(ctx, BBC - 2, 9 + oy, 4, 1, pal.skin);

  // 肩甲
  r(ctx, BBC - 7, 10 + oy, 14, 3, pal.trim);
  // 躯干
  r(ctx, BBC - 5, 13 + oy, 10, 8, pal.jacket);
  r(ctx, BBC - 5, 13 + oy, 10, 1, pal.trim);
  r(ctx, BBC - 5, 20 + oy, 10, 2, pal.belt);

  const legY = 22 + oy;
  const s = spec.leg || 0;
  r(ctx, BBC - 4 + s, legY, 3, 4, pal.pants);
  r(ctx, BBC + 1 - s, legY, 3, 4, pal.pants);
  r(ctx, BBC - 6 + s, legY + 4, 5, 2, pal.boot);
  r(ctx, BBC + 1 - s, legY + 4, 5, 2, pal.boot);

  if (spec.pose === 'shoot') {
    r(ctx, BBC + 3 + oy * 0, 14 + oy, 5, 3, pal.jacket);
    r(ctx, BBC + 6, 14 + oy, 8, 3, pal.gun);
    if (spec.flash) r(ctx, BBC + 13, 13 + oy, 3, 5, pal.flash);
  } else {
    r(ctx, BBC - 7, 14 + oy, 3, 6, pal.jacket);
    r(ctx, BBC + 4, 14 + oy, 3, 6, pal.jacket);
    r(ctx, BBC + 5, 17 + oy, 6, 3, pal.gun);
  }
}

export class SpriteSheet {
  constructor(canvas, flashCanvas, frameW, frameH, pixel) {
    this.canvas = canvas;
    this.flashCanvas = flashCanvas;
    this.frameW = frameW;
    this.frameH = frameH;
    this.pixel = pixel;
  }

  // 以 feet 底边 + 中心线对齐绘制；facing < 0 时水平翻转；flash 为受击白闪
  draw(ctx, frame, centerX, bottomY, facing, flash) {
    const src = flash ? this.flashCanvas : this.canvas;
    const x = Math.round(centerX - this.frameW / 2);
    const y = Math.round(bottomY - this.frameH);
    const sx = frame * this.frameW;
    ctx.save();
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

function buildSheet(pixel, logW, logH, specs, pal, drawFn) {
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
    drawFn(ctx, pal, specs[i]);
    ctx.restore();
  }

  // 白闪版本：用于受击反馈
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = canvas.width;
  flashCanvas.height = canvas.height;
  const fctx = flashCanvas.getContext('2d');
  fctx.drawImage(canvas, 0, 0);
  fctx.globalCompositeOperation = 'source-atop';
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, flashCanvas.width, flashCanvas.height);

  return new SpriteSheet(canvas, flashCanvas, frameW, frameH, pixel);
}

let cache = null;

export function getSprites() {
  if (cache) return cache;
  cache = {
    player: buildSheet(2, LOG_W, LOG_H, HUMAN_SPECS, PLAYER_PAL, drawHumanoid),
    thug: buildSheet(2, LOG_W, LOG_H, HUMAN_SPECS, THUG_PAL, drawHumanoid),
    boss: buildSheet(3, BLOG_W, BLOG_H, HUMAN_SPECS, BOSS_PAL, drawBoss),
  };
  return cache;
}
