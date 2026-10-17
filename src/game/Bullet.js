// 水平飞行的子弹：bullet.x += vx * dtf，vx 的符号即朝向（facing）。
// 禁止出现 bullet.y -= speed 这种"永远向上飞"的逻辑。

export const BulletOwner = {
  PLAYER: 'player',
  ENEMY: 'enemy',
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class Bullet {
  constructor(x, y, vx, vy, options) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = options.width;
    this.height = options.height;
    this.damage = options.damage;
    this.color = options.color;
    this.owner = options.owner;
    this.active = true;
  }

  update(dtf) {
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dir = this.vx >= 0 ? 1 : -1;
    const len = Math.max(this.width, Math.abs(this.vx) * 1.7);

    ctx.save();

    // 拖尾
    const grd = ctx.createLinearGradient(cx - (dir * len) / 2, 0, cx + (dir * len) / 2, 0);
    grd.addColorStop(0, hexToRgba(this.color, 0));
    grd.addColorStop(0.55, hexToRgba(this.color, 0.75));
    grd.addColorStop(1, this.color);
    ctx.fillStyle = grd;
    ctx.fillRect(cx - (dir * len) / 2, cy - this.height / 2, len, this.height);

    // 弹头
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + dir * (len * 0.2) - (dir < 0 ? len * 0.4 : 0), cy - this.height * 0.35, len * 0.4, this.height * 0.7);

    ctx.restore();
  }
}
