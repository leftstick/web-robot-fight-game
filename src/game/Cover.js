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
  constructor(x, y, w, h, hp, destructible, type, loot = null, secret = false) {
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
    this.loot = loot;
    this.secret = !!secret;
    this.hitFlash = 0;
    this.claimedBy = null;
    this.destroyed = false;
    // 油桶被击碎时会殉爆，是本作唯一的场景连锁伤害来源
    this.explosive = this.type === 'oildrum';
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

    // 爆炸油桶：桶顶红色警示灯 + 呼吸式光晕，提示"打它会炸"
    if (this.explosive && this.hp > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 230);
      const mx = Math.round(this.x + this.w / 2);
      const my = Math.round(this.y) - 5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 9);
      g.addColorStop(0, `rgba(255, 120, 60, ${0.5 + pulse * 0.4})`);
      g.addColorStop(1, 'rgba(255, 60, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 9, my - 9, 18, 18);
      ctx.fillStyle = `rgba(255, 196, 90, ${0.65 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(mx, my - 4);
      ctx.lineTo(mx + 3, my + 1);
      ctx.lineTo(mx - 3, my + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(40, 20, 10, ${0.55 + pulse * 0.3})`;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
      ctx.restore();
    }

    // 隐藏补给：四角金色描边 + 上方闪烁信号点，提示这里可以打
    if (this.secret && this.hp > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      const bx = Math.round(this.x) - 1;
      const by = Math.round(this.y) - 1;
      const bw = this.w + 2;
      const bh = this.h + 2;
      const arm = Math.max(3, Math.round(Math.min(bw, bh) * 0.28));
      ctx.save();
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by + arm); ctx.lineTo(bx, by); ctx.lineTo(bx + arm, by);
      ctx.moveTo(bx + bw - arm, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + arm);
      ctx.moveTo(bx, by + bh - arm); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + arm, by + bh);
      ctx.moveTo(bx + bw - arm, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - arm);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 232, 150, ${0.45 + pulse * 0.5})`;
      ctx.fillRect(bx + bw / 2 - 1, by - 5 - Math.round(pulse * 2), 2, 2);
      ctx.restore();
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
