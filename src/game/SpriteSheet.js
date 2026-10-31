// 基于 PNG + Aseprite JSON 的精灵图加载器
// 保留原 ANIM 帧索引接口，Player/Enemy 无需大改。
// 同时提供 AssetLoader：加载全部素材，完成前显示加载画面。

import { ASSETS } from '../config/assets.js';

// ============================================================
// 帧索引映射（与生成脚本中 frameTags 对应）
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
  PLAYER_MELEE: [33, 34, 35, 36, 37, 38],
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
// SpriteSheet：加载 PNG + JSON，支持闪白（受击）版本
// ============================================================
export class SpriteSheet {
  constructor(image, json, frameW, frameH, footOffset = 0) {
    this.image = image;
    this.json = json;
    this.frameW = frameW;
    this.frameH = frameH;
    // 美术脚底在帧内并非正好贴底，绘制时向下补偿，保证踩在地面上。
    this.footOffset = footOffset;
    this.flashCanvas = null;
    this.tintCanvases = null;
  }

  // 生成白色闪版本（受击反馈），按需生成
  _ensureFlash() {
    if (this.flashCanvas) return;
    const c = document.createElement('canvas');
    c.width = this.image.width;
    c.height = this.image.height;
    const fctx = c.getContext('2d');
    fctx.drawImage(this.image, 0, 0);
    fctx.globalCompositeOperation = 'source-atop';
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, c.width, c.height);
    this.flashCanvas = c;
  }

  // 按颜色生成剪影缓存（用于霓虹边缘光）
  _ensureTint(color) {
    if (!this.tintCanvases) this.tintCanvases = new Map();
    const hit = this.tintCanvases.get(color);
    if (hit) return hit;
    this._ensureFlash();
    const c = document.createElement('canvas');
    c.width = this.image.width;
    c.height = this.image.height;
    const tctx = c.getContext('2d');
    tctx.drawImage(this.flashCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, c.width, c.height);
    this.tintCanvases.set(color, c);
    return c;
  }

  // 边缘光：与环境霓虹同向的 1px 彩色轮廓，画在本体之前
  drawTint(ctx, frame, centerX, bottomY, facing, color, alpha = 0.22) {
    const src = this._ensureTint(color);
    const x = Math.round(centerX - this.frameW / 2);
    const y = Math.round(bottomY + this.footOffset - this.frameH);
    const sx = frame * this.frameW;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    if (facing < 0) {
      ctx.translate(x + this.frameW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, 0, this.frameW, this.frameH, 0, 0, this.frameW, this.frameH);
    } else {
      ctx.drawImage(src, sx, 0, this.frameW, this.frameH, x, y, this.frameW, this.frameH);
    }
    ctx.restore();
  }

  // centerX: 水平中心, bottomY: 脚底 y（底部对齐）, facing: ±1, flash: 受击闪白
  draw(ctx, frame, centerX, bottomY, facing, flash) {
    const src = flash ? (this._ensureFlash(), this.flashCanvas) : this.image;
    const x = Math.round(centerX - this.frameW / 2);
    const y = Math.round(bottomY + this.footOffset - this.frameH);
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

  // 按帧索引直接绘制（用于特效等不需要翻转的情况）
  drawFrame(ctx, frame, x, y, w, h) {
    const sx = frame * this.frameW;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, sx, 0, this.frameW, this.frameH, x, y, w, h);
    ctx.restore();
  }

  // 白色剪影版本：只覆盖精灵本身，不会把整块矩形涂白。
  drawFrameFlash(ctx, frame, x, y, w, h, alpha = 0.7) {
    this._ensureFlash();
    const sx = frame * this.frameW;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.flashCanvas, sx, 0, this.frameW, this.frameH, x, y, w, h);
    ctx.restore();
  }
}

// ============================================================
// 特效精灵图（固定帧数序列帧，带叠加混合绘制）
// ============================================================
export class FxSheet extends SpriteSheet {
  constructor(image, json, frameW, frameH) {
    super(image, json, frameW, frameH);
  }

  // 叠加混合绘制：用于枪口火焰、爆炸等发光特效
  drawAdditive(ctx, frame, cx, cy, scale = 1) {
    const w = this.frameW * scale;
    const h = this.frameH * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, frame * this.frameW, 0, this.frameW, this.frameH, x, y, w, h);
    ctx.restore();
  }

  // 染色版叠加绘制：让枪口火焰跟随武器颜色（等离子绿 / 步枪青）
  drawAdditiveTint(ctx, frame, cx, cy, scale, color) {
    const src = this._ensureTint(color);
    const w = this.frameW * scale;
    const h = this.frameH * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, frame * this.frameW, 0, this.frameW, this.frameH, x, y, w, h);
    ctx.restore();
  }
}

// ============================================================
// 全局缓存
// ============================================================
const cache = {
  sprites: {},     // 角色 & 掩体 SpriteSheet
  fx: {},          // 特效 FxSheet
  ui: {},          // UI 元素
  backgrounds: {}, // 背景图片
  ready: false,
};

// 加载单张图片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败: ' + src));
    img.src = src;
  });
}

// 加载单个 JSON
function loadJSON(src) {
  return fetch(src, { cache: 'no-cache' }).then(r => {
    if (!r.ok) throw new Error('JSON 加载失败: ' + src);
    return r.json();
  });
}

// ============================================================
// AssetLoader：加载全部素材，回调进度
// ============================================================
export class AssetLoader {
  constructor() {
    this.progress = 0;
    this.onProgress = null;
  }

  async loadAll() {
    const entries = [];
    // 角色 & 掩体 & 特效 & UI
    for (const key of ['player', 'thug_mohawk', 'thug_mask', 'thug_bald', 'boss', 'covers',
      'fx_muzzle_flash', 'fx_sparks', 'fx_blood', 'fx_explosion', 'fx_smoke', 'fx_shell', 'fx_debris',
      'ui_hud', 'ui_title', 'ui_panel', 'ui_crt']) {
      entries.push({ key, ...ASSETS[key] });
    }
    // 背景层
    const bgKeys = [];
    for (const lv of Object.keys(ASSETS.backgrounds)) {
      for (const layer of ['sky', 'far', 'mid', 'near', 'fg', 'ground']) {
        entries.push({ key: `bg_${lv}_${layer}`, png: ASSETS.backgrounds[lv][layer], json: null });
      }
    }

    const total = entries.length;
    let done = 0;

    const results = await Promise.all(entries.map(async (e) => {
      const img = await loadImage(e.png);
      let json = null;
      if (e.json) json = await loadJSON(e.json);
      done++;
      this.progress = done / total;
      if (this.onProgress) this.onProgress(this.progress, e.key);
      return { key: e.key, img, json };
    }));

    // 填充缓存
    for (const r of results) {
      if (r.key.startsWith('fx_')) {
        const fw = r.json ? r.json.frames[0].frame.w : 96;
        const fh = r.json ? r.json.frames[0].frame.h : 96;
        cache.fx[r.key] = new FxSheet(r.img, r.json, fw, fh);
      } else if (r.key.startsWith('ui_')) {
        cache.ui[r.key] = r.img;
      } else if (r.key.startsWith('bg_')) {
        cache.backgrounds[r.key] = r.img;
      } else {
        const fw = r.json.frames[0].frame.w;
        const fh = r.json.frames[0].frame.h;
        const footOffsets = { player: 3, thug_mohawk: 4, thug_mask: 4, thug_bald: 4, boss: 1 };
        cache.sprites[r.key] = new SpriteSheet(r.img, r.json, fw, fh, footOffsets[r.key] || 0);
      }
    }

    cache.ready = true;
    return cache;
  }
}

// 获取已加载的角色/掩体精灵
export function getSprites() {
  return cache.sprites;
}

// 获取特效精灵
export function getFx(key) {
  return cache.fx['fx_' + key];
}

// 获取 UI 图片
export function getUi(key) {
  return cache.ui['ui_' + key];
}

// 获取背景图片
export function getBackground(level, layer) {
  return cache.backgrounds[`bg_${level}_${layer}`];
}

export function assetsReady() {
  return cache.ready;
}
