// 特效系统：基于序列帧精灵图 + 叠加混合
// 枪口火焰、子弹命中火花、血雾、爆炸、烟雾、弹壳、碎石
import { getFx } from './SpriteSheet.js';

export class Effect {
  constructor(type, x, y, opts = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.frame = 0;
    this.frameTime = 0;
    this.frameDuration = opts.frameDuration || 70;
    this.active = true;
    this.scale = opts.scale || 1;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.gravity = opts.gravity || 0;
    this.friction = opts.friction || 1;
    this.additive = opts.additive !== false;
    this.facing = opts.facing || 1;
  }

  update(deltaTime) {
    this.frameTime += deltaTime;
    if (this.frameTime >= this.frameDuration) {
      this.frameTime = 0;
      this.frame++;
      const sheet = getFx(this.type);
      const maxFrames = sheet ? sheet.json.frames.length : 1;
      if (this.frame >= maxFrames) {
        this.active = false;
        return;
      }
    }
    if (this.gravity) this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx) {
    const sheet = getFx(this.type);
    if (!sheet) return;
    if (this.additive) {
      sheet.drawAdditive(ctx, this.frame, this.x, this.y, this.scale);
    } else {
      const w = sheet.frameW * this.scale;
      const h = sheet.frameH * this.scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet.image, this.frame * sheet.frameW, 0, sheet.frameW, sheet.frameH,
        this.x - w / 2, this.y - h / 2, w, h);
      ctx.restore();
    }
  }
}

export class EffectSystem {
  constructor() {
    this.effects = [];
  }

  spawn(type, x, y, opts = {}) {
    this.effects.push(new Effect(type, x, y, opts));
  }

  // 枪口火焰
  muzzleFlash(x, y, facing = 1) {
    this.spawn('muzzle_flash', x, y, {
      scale: 0.5,
      frameDuration: 50,
      facing,
    });
  }

  // 子弹命中火花
  hitSparks(x, y) {
    this.spawn('sparks', x, y, { scale: 0.4, frameDuration: 45 });
  }

  // 血雾
  blood(x, y) {
    this.spawn('blood', x, y, { scale: 0.45, frameDuration: 60, additive: false });
  }

  // 爆炸
  explosion(x, y) {
    this.spawn('explosion', x, y, { scale: 0.6, frameDuration: 55 });
    this.spawn('smoke', x, y, { scale: 0.5, frameDuration: 90, additive: false });
    this.spawn('debris', x, y, { scale: 0.4, frameDuration: 60 });
  }

  // 弹壳抛出
  shell(x, y, vx = 1, vy = -2) {
    this.spawn('shell', x, y, {
      scale: 0.35, frameDuration: 80, additive: false,
      vx, vy, gravity: 0.15, friction: 0.98,
    });
  }

  update(deltaTime) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].update(deltaTime);
      if (!this.effects[i].active) this.effects.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const e of this.effects) e.draw(ctx);
  }

  clear() {
    this.effects = [];
  }
}
