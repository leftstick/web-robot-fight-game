import { GameConfig } from '../config/gameConfig.js';

// 掩体：箱子 / 汽车 / 矮墙。可破坏的能被打碎，且会挡住飞向玩家的子弹。
export class Cover {
  constructor(x, y, w, h, hp, destructible) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.maxHp = hp;
    this.hp = hp;
    this.destructible = destructible !== false;
    this.hitFlash = 0;
    // 依据尺寸决定外观
    if (h >= 30 && w >= 100) this.type = 'car';
    else if (h >= 28) this.type = 'crate';
    else this.type = 'wall';
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.w, height: this.h };
  }

  getCenter() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
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
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const w = this.w;
    const h = this.h;
    const flash = this.hitFlash > 0;

    ctx.save();

    if (this.type === 'car') {
      // 车身
      ctx.fillStyle = flash ? '#ffffff' : '#3a2f55';
      ctx.fillRect(x, y + h * 0.34, w, h * 0.62);
      // 车顶
      ctx.fillStyle = '#2a2240';
      ctx.fillRect(x + w * 0.18, y, w * 0.64, h * 0.4);
      // 车窗（霓虹反光）
      ctx.fillStyle = 'rgba(0,229,255,0.55)';
      ctx.fillRect(x + w * 0.24, y + h * 0.1, w * 0.2, h * 0.2);
      ctx.fillRect(x + w * 0.56, y + h * 0.1, w * 0.2, h * 0.2);
      // 高光边
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y + h * 0.34, w, 3);
      // 轮子
      ctx.fillStyle = '#12101a';
      for (const wx of [x + w * 0.2, x + w * 0.8]) {
        ctx.beginPath();
        ctx.ellipse(wx, y + h * 0.96, w * 0.11, h * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 底部霓虹
      ctx.fillStyle = 'rgba(255,46,136,0.35)';
      ctx.fillRect(x + 4, y + h - 3, w - 8, 3);
    } else if (this.type === 'crate') {
      ctx.fillStyle = flash ? '#ffffff' : '#58616e';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, w, 4);
      ctx.strokeStyle = '#2c333c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      // 交叉支撑
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + w - 3, y + h - 3);
      ctx.moveTo(x + w - 3, y + 3);
      ctx.lineTo(x + 3, y + h - 3);
      ctx.stroke();
    } else {
      // 混凝土矮墙
      ctx.fillStyle = flash ? '#ffffff' : '#3b4048';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, w, 3);
      ctx.strokeStyle = '#2a2e35';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      for (let by = y + h * 0.5; by < y + h; by += h * 0.5) {
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x + w, by);
        ctx.stroke();
      }
    }

    // 破损裂纹
    if (this.destructible && this.hp < this.maxHp) {
      const ratio = this.hp / this.maxHp;
      ctx.strokeStyle = `rgba(0,0,0,${0.35 + (1 - ratio) * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 2);
      ctx.lineTo(x + w * 0.42, y + h * 0.5);
      ctx.lineTo(x + w * 0.3, y + h - 2);
      ctx.moveTo(x + w * 0.68, y + 2);
      ctx.lineTo(x + w * 0.6, y + h * 0.45);
      ctx.lineTo(x + w * 0.74, y + h - 2);
      ctx.stroke();
    }

    // 血条（受损时显示）
    if (this.destructible && this.hp < this.maxHp) {
      const bw = w;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y - 7, bw, 4);
      ctx.fillStyle = '#39ff88';
      ctx.fillRect(x, y - 7, bw * (this.hp / this.maxHp), 4);
    }

    ctx.restore();
  }
}
