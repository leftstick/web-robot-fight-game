import { GameConfig } from '../config/gameConfig.js';
import { getSprites } from './SpriteSheet.js';

// 掩体：7 种道具，每种 3 个破坏阶段（完好/受损/破碎）。
// 视觉使用 covers.png 精灵图，底部对齐。
const COVER_TYPES = ['barrier', 'oildrum', 'crate', 'trash', 'car', 'vending', 'sandbags'];
const COVER_COLS = 7;
const STAGE_FRAMES = 3;

// 根据尺寸推断类型（兼容未指定 type 的旧关卡数据）
function inferType(w, h) {
  if (h >= 28 && w >= 60) return 'car';
  if (h >= 26) return 'crate';
  if (w >= 50) return 'sandbags';
  return 'barrier';
}

export class Cover {
  constructor(x, y, w, h, hp, destructible, type) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.maxHp = hp;
    this.hp = hp;
    this.destructible = destructible !== false;
    this.hitFlash = 0;
    this.type = type || inferType(w, h);
    this.typeIndex = COVER_TYPES.indexOf(this.type);
    if (this.typeIndex < 0) this.typeIndex = 0;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.w, height: this.h };
  }

  getCenter() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  // 当前破坏阶段：0=完好, 1=受损, 2=破碎
  getStage() {
    if (!this.destructible) return 0;
    const ratio = this.hp / this.maxHp;
    if (ratio <= 0) return 2;
    if (ratio < 0.5) return 1;
    return 0;
  }

  takeDamage(damage) {
    if (!this.destructible) {
      this.hitFlash = 140;
      return false;
    }
    this.hp -= damage;
    this.hitFlash = 140;
    return this.hp <= 0;
  }

  update(deltaTime) {
    if (this.hitFlash > 0) this.hitFlash -= deltaTime;
  }

  draw(ctx) {
    const sprites = getSprites();
    const sheet = sprites.covers;
    const stage = this.getStage();

    // 破碎后不绘制（或绘制残块）
    if (stage >= 2) {
      // 绘制破碎残块帧
      if (sheet) {
        const frame = 2 * COVER_COLS + this.typeIndex;
        sheet.drawFrame(ctx, frame, this.x, this.y, this.w, this.h);
      }
      return;
    }

    if (sheet) {
      const frame = stage * COVER_COLS + this.typeIndex;
      const fw = sheet.frameW;
      const fh = sheet.frameH;
      // 宽型掩体（车/路障/沙袋）按宽度缩放，高型（油桶/垃圾桶/售货机）按高度缩放
      const wideTypes = ['car', 'barrier', 'sandbags'];
      const isWide = wideTypes.includes(this.type);
      let scale;
      if (isWide) {
        scale = this.w / fw;
      } else {
        scale = this.h / fh;
      }
      const drawW = fw * scale;
      const drawH = fh * scale;
      const drawX = this.x + (this.w - drawW) / 2;
      const drawY = this.y + this.h - drawH; // 底部对齐
      ctx.save();
      if (this.hitFlash > 0) {
        ctx.globalAlpha = 0.85;
      }
      sheet.drawFrame(ctx, frame, drawX, drawY, drawW, drawH);
      if (this.hitFlash > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }
      ctx.restore();
    } else {
      // 回退：程序化绘制
      this._drawFallback(ctx);
    }
  }

  _drawFallback(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const w = this.w;
    const h = this.h;
    const flash = this.hitFlash > 0;
    ctx.save();
    ctx.fillStyle = flash ? '#ffffff' : '#3b4048';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, y, w, 2);
    ctx.restore();
  }
}
