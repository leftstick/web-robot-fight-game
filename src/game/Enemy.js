import { GameConfig } from '../config/gameConfig.js';
import { Bullet, BulletOwner } from './Bullet.js';
import { getSprites, ANIM } from './SpriteSheet.js';

function aabb(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// 兵种色标：头顶菱形，让玩家一眼分清优先处理谁
const ARCHETYPE_COLORS = {
  rusher: '#ff2e4a',
  gunner: '#ffa23d',
  sniper: '#5fe6ff',
};

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

    this.archetype = null;   // rusher | gunner | sniper，普通暴徒为 null
    this.elite = false;
  }

  // 精英化：更硬、分更高，外观由 draw 里的金色光环体现
  applyElite() {
    this.elite = true;
    this.hp = Math.round(this.hp * 1.8);
    this.maxHp = this.hp;
    this.score = Math.round(this.score * 2);
    return this;
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

  getGunHeight() {
    if (this.sheetKey === 'boss') return 31;
    return this.crouching ? 15 : 28;
  }

  // 与精灵中的枪管对齐；贴掩体时从掩体前沿伸出。
  getMuzzle() {
    const cx = this.getCenterX();
    const y = this.y + this.getGunHeight();
    let offset;
    if (this.sheetKey === 'boss') offset = 56;
    else offset = this.crouching ? 20 : (this.sheetKey === 'thug_mask' ? 24 : 22);

    let x = cx + this.facing * offset;
    if (this.cover && this.cover.hp > 0) {
      x = this.facing > 0 ? this.cover.x + this.cover.w : this.cover.x;
    }
    return { x, y };
  }

  tryShoot(t, player, force = false, spreadDeg = 0) {
    if (!force && t - this.lastShot < this.cfg.fireInterval) return null;
    this.lastShot = t;
    this.shootAnimUntil = t + 130;

    const muzzle = this.getMuzzle();
    const gunY = muzzle.y;
    const facing = this.facing;
    const eb = GameConfig.ENEMY_BULLET;
    const x = facing > 0 ? muzzle.x : muzzle.x - eb.width;

    // 子弹以水平为主（vx 决定朝向），只做浅角度瞄准玩家躯干
    const speed = this.cfg.bulletSpeed || 6.5;
    const targetY = player.y + player.height * 0.5;
    const dy = targetY - gunY;
    const dx = Math.max(120, Math.abs(player.x - this.x));
    let vy = (dy / dx) * speed;
    vy = Math.max(-3.2, Math.min(3.2, vy));

    // 扫射兵让弹道绕枪口做小幅旋转，形成扇形压制
    let vx = speed * facing;
    if (spreadDeg) {
      const a = ((Math.random() * 2 - 1) * spreadDeg * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const nx = vx * cos - vy * sin;
      vy = vx * sin + vy * cos;
      vx = nx;
    }

    const bullet = new Bullet(x, gunY - eb.height / 2, vx, vy, {
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
    if (!sheet) return;
    const frame = this.pickFrame(t);
    const cx = this.getCenterX();
    const feet = this.y + this.height;
    // 尸体不再闪白：死亡后 hitFlash 不再参与绘制，否则会留下永久白色剪影
    const flash = !this.dead && this.hitFlash > 0;

    // Boss 冲撞蓄力：平滑的红色光池 + 像素电弧
    if (this.chargeState === 'windup') {
      const pulse = 0.5 + 0.5 * Math.sin(t / 55);
      const gx = cx;
      const gy = feet - this.height * 0.55;
      const radius = this.width * 2.0 + pulse * 10;
      const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, radius);
      g.addColorStop(0, `rgba(255, 46, 74, ${0.22 + pulse * 0.12})`);
      g.addColorStop(0.55, `rgba(255, 46, 74, ${0.08 + pulse * 0.04})`);
      g.addColorStop(1, 'rgba(255, 46, 74, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
      ctx.fillStyle = '#ff8a9a';
      for (let i = 0; i < 5; i++) {
        const a = t / 140 + i * 1.7;
        const rr = this.width * (0.7 + (i % 3) * 0.3);
        ctx.fillRect(
          Math.round(gx + Math.cos(a) * rr),
          Math.round(gy + Math.sin(a * 1.3) * this.height * 0.35),
          1, 2,
        );
      }
      ctx.restore();
    }

    // Boss 冲撞残影：用精灵白色剪影做两层拖尾
    if (this.chargeState === 'charging') {
      for (let i = 1; i <= 2; i++) {
        ctx.save();
        ctx.globalAlpha = 0.10 / i;
        ctx.globalCompositeOperation = 'lighter';
        sheet.draw(ctx, frame, cx - this.vx * i * 1.4, feet, this.facing, true);
        ctx.restore();
      }
    }

    ctx.save();
    // 像素落地阴影
    const sw = Math.max(10, Math.round(this.width * 0.8));
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(Math.round(cx) - Math.round(sw / 2), Math.round(feet) - 2, sw, 2);
    ctx.fillRect(Math.round(cx) - Math.round(sw / 3), Math.round(feet) - 4, Math.round(sw * 0.66), 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(Math.round(cx) - 3, Math.round(feet) - 5, 6, 1);

    // 暖色边缘光（霓虹街灯/店面漏光），尸体不再加光
    if (!this.dead) {
      sheet.drawTint(ctx, frame, cx - 1, feet, this.facing, '#ff8a3d', 0.23);
      sheet.drawTint(ctx, frame, cx + 1, feet, this.facing, '#ff2e4a', 0.13);
    }
    sheet.draw(ctx, frame, cx, feet, this.facing, flash);
    ctx.restore();

    if (this.dead) return;

    // 精英光环：脚下金色光池 + 环绕椭圆，和普通兵一眼区分
    if (this.elite) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 180);
      const r = Math.max(16, this.width * 1.15);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, feet - 3, 1, cx, feet - 3, r);
      g.addColorStop(0, `rgba(255, 209, 102, ${0.22 + pulse * 0.12})`);
      g.addColorStop(1, 'rgba(255, 209, 102, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, feet - r, r * 2, r * 2);
      ctx.strokeStyle = `rgba(255, 226, 150, ${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, feet - 2, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 兵种色标：头顶菱形
    const markerColor = ARCHETYPE_COLORS[this.archetype];
    if (markerColor) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 150);
      const mx = Math.round(cx);
      const my = Math.round(this.y) - 7;
      ctx.save();
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.moveTo(mx, my - 3);
      ctx.lineTo(mx + 3, my + 1);
      ctx.lineTo(mx, my + 3);
      ctx.lineTo(mx - 3, my + 1);
      ctx.closePath();
      ctx.fill();
      if (this.elite) {
        ctx.strokeStyle = 'rgba(255, 226, 150, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,255,255,${0.4 + pulse * 0.4})`;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
      ctx.restore();
    }
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

// 疾行者：不找掩体，贴脸后蓄力冲撞。冲撞可被跳跃或走位躲开。
export class Rusher extends EnemyBase {
  constructor(feetX, feetY) {
    super(GameConfig.RUSHER, 'thug_mohawk', feetX, feetY);
    this.archetype = 'rusher';
    this.chargeState = 'idle';   // idle | windup | charging | recover
    this.chargeEnd = 0;
    this.nextChargeAt = 0;
    this.chargeDir = 1;
    this.chargeDamageDealt = false;
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.updateFacing(player);

    const cfg = GameConfig.RUSHER;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    if (this.chargeState === 'windup') {
      this.vx = 0;
      this.animTime += dtf * 0.6;
      this.phys(dtf, world);
      if (t >= this.chargeEnd) {
        this.chargeState = 'charging';
        this.chargeDir = this.facing;
        this.chargeEnd = t + cfg.chargeDuration;
        this.chargeDamageDealt = false;
      }
      return null;
    }

    if (this.chargeState === 'charging') {
      this.vx = this.chargeDir * cfg.chargeSpeed;
      this.animTime += dtf * 1.8;
      this.phys(dtf, world);
      if (t >= this.chargeEnd) {
        this.chargeState = 'recover';
        this.chargeEnd = t + 380;
        this.nextChargeAt = t + cfg.chargeCooldown;
      }
      return null;
    }

    if (this.chargeState === 'recover') {
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
      this.animTime += dtf;
      this.phys(dtf, world);
      if (t >= this.chargeEnd) this.chargeState = 'idle';
      return null;
    }

    // idle：持续逼近，进入冲撞距离就起手
    const side = Math.sign(mycx - pcx) || 1;
    const dxTarget = (pcx + side * 52) - this.x;
    this.vx = Math.abs(dxTarget) > 6 ? Math.sign(dxTarget) * cfg.speed : 0;
    this.animTime += dtf * (this.vx !== 0 ? 1.5 : 1);
    this.phys(dtf, world);

    if (t > this.nextChargeAt && dist < cfg.chargeRange && dist > 20) {
      this.chargeState = 'windup';
      this.chargeEnd = t + cfg.chargeWindup;
      this.vx = 0;
      this.chargeDir = this.facing;
    }
    return null;
  }

  // 冲撞接触伤害，由 Game 每帧调用；一次冲撞只结算一次
  tryChargeHit(player, currentTime) {
    if (this.chargeState !== 'charging' || this.chargeDamageDealt) return false;
    if (aabb(player.getBounds(), this.getBounds())) {
      this.chargeDamageDealt = true;
      return true;
    }
    return false;
  }

  draw(ctx, t) {
    super.draw(ctx, t);
    if (this.dead || this.chargeState !== 'windup') return;

    // 蓄力时在地面画一条朝向前方的红色冲刺指示
    const feet = this.y + this.height;
    const cx = this.getCenterX();
    const dir = this.facing;
    const pulse = 0.5 + 0.5 * Math.sin(t / 50);
    const len = 26 + pulse * 8;
    const startX = cx + dir * 10;
    const tip = startX + dir * len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 46, 74, ${0.28 + pulse * 0.25})`;
    ctx.fillRect(Math.min(startX, tip), feet - 3, len, 3);
    ctx.beginPath();
    ctx.moveTo(tip + dir * 7, feet - 5);
    ctx.lineTo(tip, feet - 10);
    ctx.lineTo(tip, feet);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// 扫射兵：保持中距离，三连发点射，弹道带轻微散布
export class Gunner extends EnemyBase {
  constructor(feetX, feetY) {
    super(GameConfig.GUNNER, 'thug_mask', feetX, feetY);
    this.archetype = 'gunner';
    this.burstLeft = 0;
    this.nextBurstAt = 0;
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.updateFacing(player);

    const cfg = GameConfig.GUNNER;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    const side = Math.sign(mycx - pcx) || 1;
    const dxTarget = (pcx + side * cfg.engageRange) - this.x;
    this.vx = Math.abs(dxTarget) > 10 ? Math.sign(dxTarget) * cfg.speed : 0;
    this.animTime += dtf * (this.vx !== 0 ? 1 : 0.5);
    this.phys(dtf, world);

    if (dist > cfg.engageRange + 150) return null;

    if (this.burstLeft > 0) {
      if (t >= this.nextBurstAt) {
        this.burstLeft--;
        this.nextBurstAt = t + cfg.burstGap;
        return this.tryShoot(t, player, true, cfg.spread);
      }
      return null;
    }

    if (t - this.lastShot >= cfg.fireInterval) {
      this.burstLeft = cfg.burst - 1;
      this.nextBurstAt = t + cfg.burstGap;
      return this.tryShoot(t, player, true, cfg.spread);
    }
    return null;
  }
}

// 狙击手：远距离蓄力瞄准，锁定后发射高速重弹；红线提示玩家躲闪
export class Sniper extends EnemyBase {
  constructor(feetX, feetY) {
    super(GameConfig.SNIPER, 'thug_bald', feetX, feetY);
    this.archetype = 'sniper';
    this.aiming = false;
    this.aimUntil = 0;
    this.aimTarget = null;
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.updateFacing(player);

    const cfg = GameConfig.SNIPER;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    if (this.aiming) {
      this.vx = 0;
      this.animTime += dtf * 0.35;
      this.phys(dtf, world);
      if (t >= this.aimUntil) {
        this.aiming = false;
        this.lastShot = t;
        const target = this.aimTarget;
        this.aimTarget = null;
        return this.fireAt(target);
      }
      return null;
    }

    const side = Math.sign(mycx - pcx) || 1;
    const dxTarget = (pcx + side * cfg.engageRange) - this.x;
    this.vx = Math.abs(dxTarget) > 12 ? Math.sign(dxTarget) * cfg.speed : 0;
    this.animTime += dtf;
    this.phys(dtf, world);

    if (dist < cfg.engageRange + 80 && t - this.lastShot >= cfg.fireInterval) {
      this.aiming = true;
      this.aimUntil = t + cfg.aimTime;
      this.aimTarget = { x: pcx, y: player.y + player.height * 0.5 };
      this.vx = 0;
    }
    return null;
  }

  fireAt(target) {
    const muzzle = this.getMuzzle();
    const dx = target.x - muzzle.x;
    const dy = target.y - muzzle.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const speed = this.cfg.bulletSpeed;
    return new Bullet(muzzle.x, muzzle.y - 1.5, (dx / len) * speed, (dy / len) * speed, {
      width: 16,
      height: 3,
      damage: this.cfg.bulletDamage,
      color: '#5fe6ff',
      owner: BulletOwner.ENEMY,
      style: 'rifle',
      sfx: 'sniperShot',
      impactShake: 8,
      impactShakeIntensity: 5,
      hitStop: 30,
    });
  }

  draw(ctx, t) {
    super.draw(ctx, t);
    if (this.dead || !this.aiming || !this.aimTarget) return;

    // 瞄准线：从枪口指向锁定的躯干位置，闪烁提示开枪时机
    const muzzle = this.getMuzzle();
    const target = this.aimTarget;
    const pulse = 0.5 + 0.5 * Math.sin(t / 70);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(95, 230, 255, ${0.22 + pulse * 0.38})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(muzzle.x), Math.round(muzzle.y));
    ctx.lineTo(Math.round(target.x), Math.round(target.y));
    ctx.stroke();

    const r = 5 + pulse * 2;
    ctx.strokeStyle = `rgba(95, 230, 255, ${0.55 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220, 248, 255, 0.9)';
    ctx.fillRect(Math.round(target.x) - 1, Math.round(target.y) - 1, 2, 2);
    ctx.restore();
  }
}

// 兵种工厂：关卡数据只写 type/elite，这里统一实例化
export function createEnemy(type, feetX, feetY, elite = false) {
  let enemy;
  switch (type) {
    case 'rusher': enemy = new Rusher(feetX, feetY); break;
    case 'gunner': enemy = new Gunner(feetX, feetY); break;
    case 'sniper': enemy = new Sniper(feetX, feetY); break;
    default: enemy = new Thug(feetX, feetY);
  }
  if (elite) enemy.applyElite();
  return enemy;
}

export class Boss extends EnemyBase {
  constructor(feetX, feetY, hp, opts = {}) {
    super(GameConfig.BOSS, 'boss', feetX, feetY);
    if (hp) {
      this.hp = hp;
      this.maxHp = hp;
    }
    this.displayName = opts.name || '帮派首领';
    this.title = opts.title || 'GANG LORD // 帮派首领';

    // 三阶段状态
    this.phase = 1;
    this.phaseTransitionUntil = 0;
    this.phaseFlashUntil = 0;
    this.coreOpen = false;
    this.controlLocked = false;
    this.lastUpdateTime = 0;

    // 点射状态机：idle -> telegraph(亮弹道) -> firing(按锁定方向连发)
    this.aimState = 'idle';
    this.aimUntil = 0;
    this.nextAimAt = 0;
    this.aimLow = true;        // 首次 beginAim 切换为胸口平射
    this.aimDirX = 1;
    this.aimDirY = 0;
    this.aimBurstLeft = 0;
    this.nextBurstAt = 0;
    this.aimInit = false;
    this.pendingAimSfx = false;

    // 冲撞攻击状态
    this.chargeState = 'idle';   // idle | windup | charging | recover
    this.chargeEnd = 0;
    this.chargeDir = 1;
    this.chargeDamageDealt = false;
    this.nextActionAt = 0;

    // 震地攻击状态
    this.slamState = 'idle';     // idle | windup | recover
    this.slamEnd = 0;
    this.nextSlamAt = 0;
    this.pendingShockwave = false;

    // 三阶段环形弹幕 / 召唤
    this.nextRadialAt = 0;
    this.pendingSummon = 0;
  }

  get corePoint() {
    return {
      x: this.getCenterX(),
      y: this.y + this.height * 0.52,
    };
  }

  // 核心暴露时，命中核心的子弹吃双倍伤害
  damageMultiplierAt(x, y) {
    if (!this.coreOpen || this.dead) return 1;
    const c = this.corePoint;
    return Math.hypot(x - c.x, y - c.y) <= GameConfig.BOSS.coreRadius
      ? GameConfig.BOSS.coreMultiplier
      : 1;
  }

  takeDamage(damage, t = 0) {
    if (this.dead) return false;
    if (t && t < this.phaseTransitionUntil) return false;

    // 血量跨过阶段阈值时，先锁血并进入阶段转换，不让 Boss 被一发跳阶段秒掉
    if (this.phase < 3) {
      const cfg = GameConfig.BOSS;
      const nextThreshold = this.phase === 1 ? cfg.phaseThresholds[0] : cfg.phaseThresholds[1];
      const floor = Math.max(1, Math.floor(this.maxHp * nextThreshold));
      if (this.hp - damage <= floor) {
        this.hp = floor;
        this.hitFlash = 130;
        this.advancePhase(t);
        return false;
      }
    }

    return super.takeDamage(damage);
  }

  advancePhase(t) {
    const cfg = GameConfig.BOSS;
    if (this.phase === 1) {
      this.phase = 2;
      this.phaseTransitionUntil = t + cfg.phaseInvuln;
      this.phaseFlashUntil = this.phaseTransitionUntil;
      this.pendingSummon = 2;
      this.nextSlamAt = t + 900;
    } else if (this.phase === 2) {
      this.phase = 3;
      this.phaseTransitionUntil = t + cfg.phaseInvuln;
      this.phaseFlashUntil = this.phaseTransitionUntil;
      this.coreOpen = true;
      this.nextRadialAt = t + 900;
      this.nextSlamAt = t + 500;
    } else {
      return;
    }
    this.vx = 0;
    this.aimState = 'idle';
    this.aimBurstLeft = 0;
    this.nextAimAt = t + cfg.phaseInvuln + 400;
    this.chargeState = 'idle';
    this.slamState = 'idle';
  }

  consumeShockwave() {
    if (!this.pendingShockwave) return false;
    this.pendingShockwave = false;
    return true;
  }

  consumeSummon() {
    const n = this.pendingSummon;
    this.pendingSummon = 0;
    return n;
  }

  phys(dtf, world) {
    super.phys(dtf, world);
    const arena = world.arena;
    if (!arena) return;
    const minX = arena.x1 + 14;
    const maxX = arena.x2 - this.width - 14;
    if (this.x < minX) {
      this.x = minX;
      this.vx = Math.max(0, this.vx);
    } else if (this.x > maxX) {
      this.x = maxX;
      this.vx = Math.min(0, this.vx);
    }
  }

  update(dtf, deltaTime, t, world, player) {
    if (this.dead) return null;
    this.lastUpdateTime = t;
    this.updateFacing(player);

    // 入场演出 / 阶段转换期间：站桩不攻击
    if (this.phaseTransitionUntil > t || this.controlLocked) {
      this.vx = 0;
      this.animTime += dtf * (this.controlLocked ? 0.35 : 1);
      this.phys(dtf, world);
      return null;
    }

    const cfg = GameConfig.BOSS;
    const pcx = player.x + player.width / 2;
    const mycx = this.getCenterX();
    const dist = Math.abs(pcx - mycx);

    if (!this.aimInit) {
      this.aimInit = true;
      this.nextAimAt = t + 600;
    }

    // —— 点射：先亮弹道，再按锁定方向连发 ——
    if (this.aimState === 'telegraph') {
      this.vx = 0;
      this.animTime += dtf;
      this.phys(dtf, world);
      if (t >= this.aimUntil) {
        this.aimState = 'firing';
        this.aimBurstLeft = cfg.aimBurst[this.phase - 1];
        this.nextBurstAt = t;
      }
      return null;
    }

    if (this.aimState === 'firing') {
      this.vx = 0;
      this.animTime += dtf;
      this.phys(dtf, world);
      if (this.aimBurstLeft > 0 && t >= this.nextBurstAt) {
        this.aimBurstLeft--;
        this.nextBurstAt = t + cfg.aimBurstGap;
        return this.fireLockedShot();
      }
      if (this.aimBurstLeft <= 0) {
        this.aimState = 'idle';
        this.lastShot = t;
        this.nextAimAt = t + cfg.aimCooldown[this.phase - 1];
      }
      return null;
    }

    // —— 震地：蓄力结束的同一帧交给 Game 生成左右冲击波 ——
    if (this.slamState === 'windup') {
      this.vx = 0;
      this.animTime += dtf;
      this.phys(dtf, world);
      if (t >= this.slamEnd) {
        this.slamState = 'recover';
        this.slamEnd = t + 450;
        this.nextSlamAt = t + cfg.slamCooldown;
        this.pendingShockwave = true;
      }
      return null;
    }

    if (this.slamState === 'recover') {
      this.vx *= 0.82;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
      if (t >= this.slamEnd) this.slamState = 'idle';
      this.animTime += dtf;
      this.phys(dtf, world);
      return null;
    }

    // —— 冲撞状态机 ——
    if (this.chargeState === 'windup') {
      this.vx = 0;
      if (t >= this.chargeEnd) {
        this.chargeState = 'charging';
        this.chargeEnd = t + (this.phase >= 3 ? 720 : 650);
        this.chargeDir = this.facing;
        this.chargeDamageDealt = false;
      }
      this.animTime += dtf;
      this.phys(dtf, world);
      return null;
    }

    if (this.chargeState === 'charging') {
      const rush = this.phase >= 2 ? 7.0 : 6.5;
      this.vx = this.chargeDir * cfg.speed * rush;
      if (t >= this.chargeEnd) {
        this.chargeState = 'recover';
        this.chargeEnd = t + 500;
        this.nextActionAt = t + (this.phase >= 3 ? 1100 : 1500);
      }
      this.animTime += dtf;
      this.phys(dtf, world);
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

    // —— 三阶段：核心暴露后周期性环形弹幕 ——
    if (this.phase >= 3 && t >= this.nextRadialAt) {
      this.nextRadialAt = t + cfg.radialCooldown;
      this.nextActionAt = Math.max(this.nextActionAt, t + 550);
      return this.radialBurst(t);
    }

    // —— idle：保持距离 + 点射 + 伺机震地/冲撞 ——
    const targetX = pcx - this.facing * 220;
    const dxTarget = targetX - this.x;
    const moveSpeed = cfg.speed * (this.phase >= 2 ? 1.3 : 1);

    if (Math.abs(dxTarget) > 14) {
      this.vx = Math.sign(dxTarget) * moveSpeed;
    } else {
      this.vx = 0;
    }

    this.animTime += dtf;
    this.phys(dtf, world);

    // 二阶段开始：近身时先震地，逼玩家跳起来
    if (this.phase >= 2 && t > this.nextSlamAt && dist < cfg.nearRange && dist > 34) {
      this.slamState = 'windup';
      this.slamEnd = t + 520;
      this.vx = 0;
      return null;
    }

    // 距离较近且冷却就绪时发起冲撞
    if (t > this.nextActionAt && dist < 260 && dist > 40) {
      this.chargeState = 'windup';
      this.chargeEnd = t + (this.phase >= 3 ? 360 : 450);
      this.vx = 0;
      return null;
    }

    // 远程点射：摇枪预警，弹道在预警瞬间锁定，之后不再追踪玩家
    if (t >= this.nextAimAt) {
      this.beginAim(t, player);
    }

    return null;
  }

  // 锁定一条弹道：红色平射（蹲下躲）与橙色压地（起跳躲）交替
  beginAim(t, player) {
    const cfg = GameConfig.BOSS;
    const muzzle = this.getMuzzle();
    this.aimState = 'telegraph';
    this.aimUntil = t + cfg.aimWindup[this.phase - 1];
    this.aimLow = !this.aimLow;
    this.vx = 0;

    let dx = (player.x + player.width / 2) - muzzle.x;
    if (Math.sign(dx) !== this.facing) dx = this.facing * 220;
    const targetY = this.aimLow ? GameConfig.GROUND_Y : muzzle.y;
    const dy = targetY - muzzle.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    this.aimDirX = dx / len;
    this.aimDirY = dy / len;

    this.shootAnimUntil = this.aimUntil + 240;
    this.pendingAimSfx = true;
  }

  consumeAimSfx() {
    if (!this.pendingAimSfx) return false;
    this.pendingAimSfx = false;
    return true;
  }

  fireLockedShot() {
    const cfg = GameConfig.BOSS;
    const muzzle = this.getMuzzle();
    const eb = GameConfig.ENEMY_BULLET;
    const low = this.aimLow;
    this.shootAnimUntil = Math.max(this.shootAnimUntil, this.nextBurstAt + 120);
    return new Bullet(
      muzzle.x + (this.aimDirX < 0 ? -eb.width : 0),
      muzzle.y - eb.height / 2,
      this.aimDirX * cfg.bulletSpeed,
      this.aimDirY * cfg.bulletSpeed,
      {
        width: eb.width,
        height: eb.height,
        damage: cfg.bulletDamage,
        color: low ? '#ffa23d' : '#ff5a5a',
        owner: BulletOwner.ENEMY,
        sfx: 'bossShoot',
      },
    );
  }

  // 三阶段环形弹幕：10 发放射状能量球
  radialBurst(t) {
    const c = this.corePoint;
    const count = 10;
    const bullets = [];
    const spin = this.animTime * 0.02;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + spin;
      bullets.push(new Bullet(c.x - 4, c.y - 4, Math.cos(a) * 2.9, Math.sin(a) * 2.9, {
        width: 8,
        height: 8,
        damage: 1,
        color: '#ff2e88',
        owner: BulletOwner.ENEMY,
        style: 'orb',
        hitStop: 0,
      }));
    }
    this.lastShot = t;
    return bullets;
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

  draw(ctx, t) {
    super.draw(ctx, t);
    if (this.dead) return;

    const c = this.corePoint;

    // 点射预警：枪口充能 + 锁定弹道。红色平射蹲下躲，橙色压地起跳躲。
    if (this.aimState === 'telegraph') {
      const muzzle = this.getMuzzle();
      const pulse = 0.5 + 0.5 * Math.sin(t / 45);
      const rgb = this.aimLow ? '255, 162, 61' : '255, 90, 90';
      const len = 760;
      const ex = muzzle.x + this.aimDirX * len;
      const ey = muzzle.y + this.aimDirY * len;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const r = 8 + pulse * 7;
      const glow = ctx.createRadialGradient(muzzle.x, muzzle.y, 1, muzzle.x, muzzle.y, r * 2.2);
      glow.addColorStop(0, 'rgba(255,255,255,0.9)');
      glow.addColorStop(0.35, `rgba(${rgb}, ${0.55 + pulse * 0.3})`);
      glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(muzzle.x, muzzle.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 外发光层 + 实线层：保证在亮平台和夜空背景上都看得见
      ctx.strokeStyle = `rgba(${rgb}, ${0.14 + pulse * 0.12})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(muzzle.x, muzzle.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${rgb}, ${0.5 + pulse * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(muzzle.x, muzzle.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const step = 24;
      const travel = (t * 0.12) % step;
      ctx.fillStyle = `rgba(${rgb}, ${0.65 + pulse * 0.3})`;
      for (let d = travel; d < 320; d += step) {
        const px = muzzle.x + this.aimDirX * d;
        const py = muzzle.y + this.aimDirY * d;
        ctx.fillRect(Math.round(px), Math.round(py), 3, 2);
      }
      ctx.restore();
    }

    // 三阶段核心：脉动光环 + 十字准星，提示这里吃双倍伤害
    if (this.coreOpen) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 90);
      const r = GameConfig.BOSS.coreRadius + 4 + pulse * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r * 2.2);
      glow.addColorStop(0, 'rgba(255,255,255,0.9)');
      glow.addColorStop(0.35, `rgba(255, 46, 136, ${0.55 + pulse * 0.25})`);
      glow.addColorStop(1, 'rgba(255, 46, 136, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 220, 240, ${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd7e8';
      ctx.fillRect(Math.round(c.x) - 7, Math.round(c.y), 4, 1);
      ctx.fillRect(Math.round(c.x) + 4, Math.round(c.y), 4, 1);
      ctx.fillRect(Math.round(c.x), Math.round(c.y) - 7, 1, 4);
      ctx.fillRect(Math.round(c.x), Math.round(c.y) + 4, 1, 4);
      ctx.restore();
    }

    // 震地蓄力：脚下红色预警条 + 两侧箭头，告诉玩家该起跳了
    if (this.slamState === 'windup') {
      const feet = this.y + this.height;
      const pulse = 0.5 + 0.5 * Math.sin(t / 55);
      const span = 54 + pulse * 10;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 46, 74, ${0.30 + pulse * 0.25})`;
      ctx.fillRect(Math.round(c.x - span), Math.round(feet) - 3, Math.round(span * 2), 3);
      ctx.fillStyle = '#ff8a9a';
      for (let i = -1; i <= 1; i++) {
        const ax = Math.round(c.x + i * 18);
        ctx.beginPath();
        ctx.moveTo(ax, Math.round(feet) - 9);
        ctx.lineTo(ax + 5, Math.round(feet) - 15);
        ctx.lineTo(ax - 5, Math.round(feet) - 15);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 阶段转换：扩散冲击环
    if (this.phaseTransitionUntil > t) {
      const p = 1 - (this.phaseTransitionUntil - t) / GameConfig.BOSS.phaseInvuln;
      const radius = 10 + p * 46;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.85 * (1 - p)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
