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
    ctx.save();
    
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 5;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }
  
  createExplosion(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
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
    for (const particle of this.particles) {
      particle.draw(ctx);
    }
  }
  
  clear() {
    this.particles = [];
  }
}
