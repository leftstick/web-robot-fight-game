import { GameConfig } from '../config/gameConfig.js';

// 手雷：抛物线投掷，落地或引信耗尽后范围伤害。
export class Grenade {
  constructor(x, y, vx, vy) {
    const g = GameConfig.GRENADE;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = g.width;
    this.height = g.height;
    this.fuse = g.fuse;
    this.active = true;
    this.spin = 0;
  }

  update(dtf, deltaTime) {
    const g = GameConfig.GRENADE;
    this.vy += g.gravity * dtf;
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;
    this.spin += 0.25 * dtf;
    this.fuse -= deltaTime;
    if (this.fuse <= 0) this.active = false;
  }

  getCenter() {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  draw(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const blink = this.fuse < 500 && Math.floor(this.fuse / 100) % 2 === 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.spin);

    // 弹体（像素感：深绿方块 + 高光）
    ctx.fillStyle = '#2f5a2a';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = '#4a8a3c';
    ctx.fillRect(-5, -5, 10, 3);
    ctx.fillStyle = '#1c3a1a';
    ctx.fillRect(-5, 3, 10, 2);

    // 引信火光
    if (blink) {
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(-2, -8, 4, 4);
    }

    ctx.restore();
  }
}
