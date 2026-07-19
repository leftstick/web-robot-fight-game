export const BulletType = {
  LIGHT: 'light',
  HEAVY: 'heavy'
};

export class Bullet {
  constructor(x, y, type = BulletType.LIGHT, config) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = config.width;
    this.height = config.height;
    this.speed = config.speed;
    this.damage = config.damage;
    this.color = config.color;
    this.active = true;
    this.trail = [];
    this.maxTrailLength = type === BulletType.HEAVY ? 8 : 5;
  }
  
  update(deltaTime) {
    this.trail.unshift({ x: this.x + this.width / 2, y: this.y + this.height });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.pop();
    }
    
    this.y -= this.speed;
    
    if (this.y + this.height < 0) {
      this.active = false;
    }
  }
  
  draw(ctx) {
    ctx.save();
    
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = 1 - (i / this.trail.length);
      const size = this.width * (1 - i / this.trail.length * 0.5);
      ctx.fillStyle = this.hexToRgba(this.color, alpha * 0.4);
      ctx.beginPath();
      ctx.ellipse(
        this.trail[i].x,
        this.trail[i].y,
        size / 2,
        this.height * 0.3 * (1 - i / this.trail.length),
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
    
    const bulletGradient = ctx.createLinearGradient(
      this.x, this.y + this.height,
      this.x, this.y
    );
    bulletGradient.addColorStop(0, this.color);
    bulletGradient.addColorStop(0.5, '#ffffff');
    bulletGradient.addColorStop(1, this.color);
    
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.type === BulletType.HEAVY ? 20 : 10;
    ctx.fillStyle = bulletGradient;
    
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width / 2,
      this.height / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    if (this.type === BulletType.HEAVY) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width / 2,
      this.y + this.height * 0.3,
      this.width / 4,
      this.height / 4,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    ctx.restore();
  }
  
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}
