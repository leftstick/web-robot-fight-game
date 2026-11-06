// 预渲染光晕贴图：shadowBlur 每帧会让 Skia 对每个粒子做一次模糊，
// 粒子多时开销显著；改成缓存径向渐变贴图后只是一次 drawImage。
const GLOW_SIZE = 32;
const glowCache = new Map();

function getGlowSprite(color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  const cached = glowCache.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = GLOW_SIZE;
  canvas.height = GLOW_SIZE;
  const g = canvas.getContext('2d');
  const n = parseInt(color.slice(1), 16);
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  const half = GLOW_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${rgb}, 0.55)`);
  grad.addColorStop(0.45, `rgba(${rgb}, 0.20)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);

  glowCache.set(color, canvas);
  return canvas;
}

export class Particle {
  constructor(x, y, color, speed, size, life) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = speed;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.active = true;
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * speed;
    this.vx = Math.cos(angle) * velocity;
    this.vy = Math.sin(angle) * velocity;
    
    this.gravity = 0.1;
    this.friction = 0.98;
  }
  
  update(deltaTime) {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;
    
    this.life -= deltaTime * 0.06;
    
    if (this.life <= 0) {
      this.active = false;
    }
  }
  
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    const r = this.size * alpha;
    ctx.globalAlpha = alpha;

    const glow = getGlowSprite(this.color);
    if (glow) {
      const gs = r * 3 + 6;
      ctx.drawImage(glow, this.x - gs / 2, this.y - gs / 2, gs, gs);
    }

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }
  
  createExplosion(x, y, color, count = 15) {
    // 低端机保护：粒子总量封顶，Boss 连锁爆炸时不会瞬间堆出数百个光晕
    const room = 240 - this.particles.length;
    if (room <= 0) return;
    const total = Math.min(count, room);
    for (let i = 0; i < total; i++) {
      const size = 2 + Math.random() * 4;
      const speed = 2 + Math.random() * 4;
      const life = 30 + Math.random() * 30;
      this.particles.push(new Particle(x, y, color, speed, size, life));
    }
  }
  
  createHitEffect(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const size = 1 + Math.random() * 2;
      const speed = 1 + Math.random() * 2;
      const life = 15 + Math.random() * 15;
      this.particles.push(new Particle(x, y, color, speed, size, life));
    }
  }
  
  update(deltaTime) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(deltaTime);
      if (!this.particles[i].active) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  draw(ctx) {
    const particles = this.particles;
    if (particles.length === 0) return;
    // 光晕贴图缩小绘制需要插值，核心圆仍走矢量绘制；
    // 每帧只切一次平滑状态，避免逐粒子 save/restore。
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < particles.length; i++) {
      particles[i].draw(ctx);
    }
    ctx.imageSmoothingEnabled = prevSmoothing;
    ctx.globalAlpha = 1;
  }
  
  clear() {
    this.particles = [];
  }
}
