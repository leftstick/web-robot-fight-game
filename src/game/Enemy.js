import { GameConfig } from '../config/gameConfig.js';
import { Bullet, BulletOwner } from './Bullet.js';
import { getSprites, ANIM } from './SpriteSheet.js';

function aabb(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// 人形暴徒：从屏幕右侧进入、向左推进、会站立/走动/开枪、利用掩体。
class EnemyBase {
  constructor(cfg, sheetKey, feetX, feetY) {
    this.cfg = cfg;
    this.sheetKey = sheetKey;
    this.width = cfg.width;
    this.standHeight = cfg.height;
    this.crouchHeight = cfg.crouchHeight;
    this.height = this.standHeight;

    this.x = feetX - this.width / 2;
    this.y = feetY - this.height;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = -1;

    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.score = cfg.score;
    this.crouching = false;

    this.hitFlash = 0;
    this.dead = false;
    this.awake = false;
    this.animTime = Math.random() * 100;
    this.shootAnimUntil = 0;
    this.lastShot = -9999;
      this.cover = null;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  getCenterX() {
    return this.x + this.width / 2;
  }

  setCrouch(on) {
    if (on === this.crouching) return;
    const feet = this.y + this.height;
    this.crouching = on;
    this.height = on ? this.crouchHeight : this.standHeight;
    this.y = feet - this.height;
  }

  phys(dtf, world) {
    this.vy += GameConfig.GRAVITY * dtf;
    if (this.vy > GameConfig.MAX_FALL_SPEED) this.vy = GameConfig.MAX_FALL_SPEED;

    this.x += this.vx * dtf;
    let box = this.getBounds();
    for (const p of world.platforms) {
      const pb = { x: p.x, y: p.y, width: p.w, height: p.h };
      if (!aabb(box, pb)) continue;
      if (this.vx > 0) this.x = p.x - this.width;
      else if (this.vx < 0) this.x = p.x + p.w;
      box.x = this.x;
    }

    this.y += this.vy * dtf;
    this.onGround = false;
    box = this.getBounds();
    for (const p of world.platforms) {
      const pb = { x: p.x, y: p.y, width: p.w, height: p.h };
      if (!aabb(box, pb)) continue;
      if (this.vy >= 0) {
        this.y = p.y - this.height;
        this.vy = 0;
        this.onGround = true;
      } else {
        this.y = p.y + p.h;
        this.vy = 0;
      }
      box.y = this.y;
    }

    if (this.x < 0) this.x = 0;
    if (this.x + this.width > world.worldWidth) this.x = world.worldWidth - this.width;
  }

  updateFacing(player) {
    const pcx = player.x + player.width / 2;
    this.facing = pcx >= this.getCenterX() ? 1 : -1;
  }

  tryShoot(t, player, force = false) {
    if (!force && t - this.lastShot < this.cfg.fireInterval) return null;
    this.lastShot = t;
    this.shootAnimUntil = t + 130;

    // 枪口：贴掩体时从掩体前沿射出，避免被自己身后的掩体挡住
    const gunY = this.y + Math.round(this.height * 0.36);
    const facing = this.facing;
    const eb = GameConfig.ENEMY_BULLET;
    let x;
    if (this.cover && this.cover.hp > 0) {
      x = facing > 0 ? this.cover.x + this.cover.w : this.cover.x - eb.width;
    } else {
      x = facing > 0 ? this.x + this.width : this.x - eb.width;
    }

    // 子弹以水平为主（vx 决定朝向），只做浅角度瞄准玩家躯干
    const speed = this.cfg.bulletSpeed || 6.5;
    const targetY = player.y + player.height * 0.5;
    const dy = targetY - gunY;
    const dx = Math.max(120, Math.abs(player.x - this.x));
    let vy = (dy / dx) * speed;
    vy = Math.max(-3.2, Math.min(3.2, vy));

    const bullet = new Bullet(x, gunY - eb.height / 2, speed * facing, vy, {
      width: eb.width,
      height: eb.height,
      damage: this.cfg.bulletDamage,
      color: eb.color,
      owner: BulletOwner.ENEMY,
    });
    bullet.ignoreCover = this.cover;
    return bullet;
  }

  takeDamage(damage) {
    this.hp -= damage;
    this.hitFlash = 130;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.deathTime = 0;
      return true;
    }
    return false;
  }

  pickFrame(t) {
    if (this.dead) {
      const f = this.sheetKey === 'boss' ? ANIM.BOSS_DEATH : ANIM.THUG_DEATH;
      const idx = Math.min(f.length - 1, Math.floor(this.deathTime / 80));
      return f[idx];
    }
    if (this.crouching) {
      return this.sheetKey === 'boss' ? ANIM.BOSS_IDLE[0] : ANIM.THUG_CROUCH[0];
    }
    if (t < this.shootAnimUntil) {
      const f = this.sheetKey === 'boss' ? ANIM.BOSS_GATLING : ANIM.THUG_SHOOT;
      return f[Math.floor(t / 70) % f.length];
    }
    if (!this.onGround) return this.sheetKey === 'boss' ? ANIM.BOSS_IDLE[0] : ANIM.THUG_IDLE[0];
    if (this.vx !== 0) {
      const f = this.sheetKey === 'boss' ? ANIM.BOSS_WALK : ANIM.THUG_WALK;
      return f[Math.floor(this.animTime / 8) % f.length];
    }
    const f = this.sheetKey === 'boss' ? ANIM.BOSS_IDLE : ANIM.THUG_IDLE;
    return f[Math.floor(this.animTime / 24) % f.length];
  }

  draw(ctx, t) {
    const sprites = getSprites();
    const sheet = sprites[this.sheetKey];
    const frame = this.pickFrame(t);
    const cx = this.getCenterX();
    const feet = this.y + this.height;
    const flash = this.hitFlash > 0;

    // Boss 冲撞蓄力：红色脉冲光晕
    if (this.chargeState === 'windup') {
      const pulse = 0.4 + 0.3 * Math.sin(t / 60);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff2e4a';
      ctx.beginPath();
      ctx.ellipse(cx, feet - this.height / 2, this.width * 1.2, this.height * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Boss 冲撞中：拖尾残影
    if (this.chargeState === 'charging') {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ff2e4a';
      ctx.fillRect(this.x - this.vx * 3, this.y, this.width, this.height);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, feet - 2, this.width * 0.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    sheet.draw(ctx, frame, cx, feet, this.facing, flash);

    // 血条（死亡时不显示）
    if (this.dead) {
      ctx.restore();
      return;
    }
    const bw = this.standHeight > 60 ? 70 : this.width + 8;
    const bx = cx - bw / 2;
    const by = this.y - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, bw, 5);
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = ratio < 0.35 ? '#ff4757' : (ratio < 0.7 ? '#ffa502' : '#39ff88');
    ctx.fillRect(bx, by, bw * ratio, 5);

    ctx.restore();
  }
}

export class Thug extends EnemyBase {
  constructor(feetX, feetY) {
    // 随机选择三种帮派暴徒外观变体
    const variants = ['thug_mohawk', 'thug_mask', 'thug_bald'];
    const variant = variants[Math.floor(Math.random() * variants.length)];
    super(GameConfig.THUG, variant, feetX, feetY);
    this.state = 'advance';
    this.stateEnd = 0;
    this.claimedCover = null;
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.updateFacing(player);

    const cfg = GameConfig.THUG;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    // 前进时寻找可用的掩体
    if (!this.cover && this.state === 'advance') {
      this.tryClaimCover(world, player);
    }

    let targetX;
    if (this.cover && this.cover.hp > 0) {
      // 站在掩体靠玩家的一侧（掩体朝向玩家，挡住飞来的子弹）
      targetX = this.facing > 0
        ? this.cover.x + this.cover.w
        : this.cover.x - this.width;
    } else {
      if (this.cover) this.cover.claimedBy = null;
      this.cover = null;
      targetX = pcx + this.facing * cfg.engageRange;
    }

    const dxTarget = targetX - this.x;
    const atPost = Math.abs(dxTarget) < 8;

    if (!atPost) {
      this.vx = Math.sign(dxTarget) * cfg.speed;
      this.state = 'advance';
      this.setCrouch(false);
      this.animTime += dtf;
      this.phys(dtf, world);
      return null;
    }

    this.vx = 0;
    this.animTime += dtf;

    if (this.cover) {
      // 掩体战术：隐蔽 <-> 探头开枪
      if (this.state !== 'hide' && this.state !== 'peek') {
        this.state = 'hide';
        this.stateEnd = t + cfg.coverHideTime;
        this.setCrouch(true);
      }
      if (t > this.stateEnd) {
        if (this.state === 'hide') {
          this.state = 'peek';
          this.stateEnd = t + cfg.coverPeekTime;
          this.setCrouch(false);
        } else {
          this.state = 'hide';
          this.stateEnd = t + cfg.coverHideTime;
          this.setCrouch(true);
        }
      }
    } else {
      this.state = 'combat';
      this.setCrouch(false);
    }

    this.phys(dtf, world);

    if (this.state !== 'hide' && dist < cfg.engageRange + 160) {
      return this.tryShoot(t, player);
    }
    return null;
  }

  tryClaimCover(world, player) {
    const pcx = player.x + player.width / 2;
    let best = null;
    let bestDist = 240;
    for (const c of world.covers) {
      if (c.hp <= 0 || c.claimedBy) continue;
      // 掩体要位于敌人与玩家之间
      const isBetween = (c.x + c.w <= this.getCenterX()) && (c.x > pcx);
      if (!isBetween) continue;
      const d = this.getCenterX() - (c.x + c.w);
      if (d >= 0 && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) {
      this.cover = best;
      best.claimedBy = this;
    }
  }
}

export class Boss extends EnemyBase {
  constructor(feetX, feetY, hp) {
    super(GameConfig.BOSS, 'boss', feetX, feetY);
    if (hp) {
      this.hp = hp;
      this.maxHp = hp;
    }
    this.burstLeft = 0;
    this.nextBurstAt = 0;
    // 冲撞攻击状态
    this.chargeState = 'idle';   // idle | windup | charging | recover
    this.chargeEnd = 0;
    this.chargeDir = 1;
    this.chargeDamageDealt = false;
    this.nextActionAt = 0;
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.updateFacing(player);

    const cfg = GameConfig.BOSS;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    // —— 冲撞状态机 ——
    if (this.chargeState === 'windup') {
      this.vx = 0;
      if (t >= this.chargeEnd) {
        this.chargeState = 'charging';
        this.chargeEnd = t + 650;          // 冲撞持续 650ms
        this.chargeDir = this.facing;
        this.chargeDamageDealt = false;
      }
      this.animTime += dtf;
      this.phys(dtf, world);
      return null;
    }

    if (this.chargeState === 'charging') {
      // 高速冲向玩家方向
      this.vx = this.chargeDir * cfg.speed * 6.5;
      if (t >= this.chargeEnd) {
        this.chargeState = 'recover';
        this.chargeEnd = t + 500;
        this.nextActionAt = t + 1500;
      }
      this.animTime += dtf;
      this.phys(dtf, world);
      // 冲撞中不射击
      return null;
    }

    if (this.chargeState === 'recover') {
      this.vx *= 0.85;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
      if (t >= this.chargeEnd) {
        this.chargeState = 'idle';
      }
      this.animTime += dtf;
      this.phys(dtf, world);
      return null;
    }

    // —— idle：保持距离 + 点射 + 伺机冲撞 ——
    // 修正：boss 应停在玩家一侧的 engage 距离外（与玩家同侧方向）
    const targetX = pcx - this.facing * 220;
    const dxTarget = targetX - this.x;

    if (Math.abs(dxTarget) > 14) {
      this.vx = Math.sign(dxTarget) * cfg.speed;
    } else {
      this.vx = 0;
    }

    this.animTime += dtf;
    this.phys(dtf, world);

    // 点射：一次连发 3~5 发，与是否移动无关
    if (this.burstLeft > 0) {
      if (t >= this.nextBurstAt) {
        this.burstLeft--;
        this.nextBurstAt = t + 130;
        return this.tryShoot(t, player, true);
      }
      return null;
    }

    if (t - this.lastShot > cfg.fireInterval) {
      this.burstLeft = 3 + Math.floor(Math.random() * 3);  // 3~5 发
      this.nextBurstAt = t + 130;
      this.burstLeft--;
      return this.tryShoot(t, player, true);
    }

    // 距离较近且冷却就绪时发起冲撞
    if (t > this.nextActionAt && dist < 260 && dist > 40) {
      this.chargeState = 'windup';
      this.chargeEnd = t + 450;   // 蓄力 450ms（给玩家反应时间）
      this.vx = 0;
    }

    return null;
  }

  // 冲撞中对玩家造成接触伤害（由 Game 每帧调用）
  tryChargeHit(player, currentTime) {
    if (this.chargeState !== 'charging') return false;
    if (this.chargeDamageDealt) return false;
    const pb = player.getBounds();
    const bb = this.getBounds();
    if (aabb(pb, bb)) {
      this.chargeDamageDealt = true;
      return true;
    }
    return false;
  }
}
