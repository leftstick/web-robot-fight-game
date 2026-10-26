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
    this.style = options.style || 'pistol';        // pistol | rifle | plasma
    this.splashRadius = options.splashRadius || 0;
    this.splashDamage = options.splashDamage || 0;
    this.impactShake = options.impactShake ?? 4;
    this.impactShakeIntensity = options.impactShakeIntensity ?? 3;
    this.hitStop = options.hitStop ?? 22;
    this.age = 0;
    this.active = true;
  }

  update(dtf) {
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;
    this.age += dtf;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx) {
    if (this.style === 'plasma') {
      this.drawPlasma(ctx);
      return;
    }
    this.drawTracer(ctx);
  }

  drawTracer(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dir = this.vx >= 0 ? 1 : -1;
    const rifle = this.style === 'rifle';
    const len = Math.max(this.width, Math.abs(this.vx) * (rifle ? 1.9 : 1.7));

    ctx.save();

    // 步枪弹加一层冷色外晕：高射速、细弹道，和手枪的暖色短线区分
    if (rifle) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexToRgba(this.color, 0.28);
      ctx.fillRect(cx - (dir * len) / 2, cy - this.height, len, this.height * 2);
    }

    // 拖尾
    const grd = ctx.createLinearGradient(cx - (dir * len) / 2, 0, cx + (dir * len) / 2, 0);
    grd.addColorStop(0, hexToRgba(this.color, 0));
    grd.addColorStop(0.55, hexToRgba(this.color, 0.75));
    grd.addColorStop(1, this.color);
    ctx.fillStyle = grd;
    ctx.fillRect(cx - (dir * len) / 2, cy - this.height / 2, len, this.height);

    // 弹头：步枪保留青色冷光，手枪用白热弹头
    ctx.fillStyle = rifle ? '#c8f4ff' : '#ffffff';
    ctx.fillRect(cx + dir * (len * 0.2) - (dir < 0 ? len * 0.4 : 0), cy - this.height * 0.35, len * 0.4, this.height * 0.7);

    if (rifle) {
      const coreW = Math.max(2, this.width * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + dir * this.width * 0.1 - coreW / 2, cy - 0.5, coreW, 1);
    }

    ctx.restore();
  }

  // 等离子弹：慢速、大体积、带脉动光晕和尾迹，肉眼就能和实弹区分
  drawPlasma(ctx) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dir = this.vx >= 0 ? 1 : -1;
    const pulse = 0.82 + 0.18 * Math.sin(this.age * 0.9);
    const r = Math.max(4, (this.width * 0.5) * pulse);
    const trail = this.width * 2.8;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const trailGrd = ctx.createLinearGradient(cx - dir * trail, cy, cx, cy);
    trailGrd.addColorStop(0, hexToRgba(this.color, 0));
    trailGrd.addColorStop(1, hexToRgba(this.color, 0.55));
    ctx.fillStyle = trailGrd;
    ctx.fillRect(Math.min(cx, cx - dir * trail), cy - r * 0.45, trail, r * 0.9);

    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 2.1);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.32, hexToRgba(this.color, 0.9));
    glow.addColorStop(1, hexToRgba(this.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    const core = Math.max(2, Math.round(r * 0.8));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(cx - core / 2), Math.round(cy - core / 2), core, core);

    ctx.restore();
  }
}
