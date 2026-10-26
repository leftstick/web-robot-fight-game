import { COVER_TYPES, COVER_INFO } from '../config/assets.js';
import { getSprites } from './SpriteSheet.js';

// 掩体：7 种道具，每种 3 个破坏阶段（完好/受损/破碎）。
// 精灵帧固定 96x64，美术底部中心锚定；物理尺寸用 COVER_INFO 的原生尺寸，
// 不再把 96x64 的帧按碰撞盒拉伸，避免油桶变扁、汽车拉长。
const COVER_COLS = COVER_TYPES.length;

function inferType(w, h) {
  if (h >= 32) return 'car';
  if (w >= 40) return 'sandbags';
  if (h >= 28) return 'vending';
  return 'crate';
}

export class Cover {
  constructor(x, y, w, h, hp, destructible, type) {
    this.type = COVER_INFO[type] ? type : inferType(w, h);
    this.typeIndex = COVER_TYPES.indexOf(this.type);
    if (this.typeIndex < 0) this.typeIndex = 0;

    const info = COVER_INFO[this.type];
    this.w = w || info.w;
    this.h = h || info.h;
    this.x = x;
    // 统一贴地：不管关卡数据怎么写 y，掩体底部都落在地面。
    this.y = y != null ? y : (235 - this.h);

    this.maxHp = hp;
    this.hp = hp;
    this.destructible = destructible !== false;
    this.hitFlash = 0;
    this.claimedBy = null;
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
    const sheet = getSprites().covers;
    if (!sheet) {
      this._drawFallback(ctx);
      return;
    }

    const stage = this.getStage();
    const frame = stage * COVER_COLS + this.typeIndex;
    const fw = sheet.frameW;
    const fh = sheet.frameH;
    // 1:1 原生像素绘制，底部中心锚定。96x64 帧四周是透明留白。
    const dx = Math.round(this.x + this.w / 2 - fw / 2);
    const dy = Math.round(this.y + this.h - fh);

    sheet.drawFrame(ctx, frame, dx, dy, fw, fh);
    if (this.hitFlash > 0 && stage < 2) {
      sheet.drawFrameFlash(ctx, frame, dx, dy, fw, fh, 0.65);
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
