import { GameConfig } from '../config/gameConfig.js';
import { Bullet, BulletOwner } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { getSprites, ANIM } from './SpriteSheet.js';

const P = GameConfig.PLAYER;

function aabb(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// 玩家：有重力 vy / gravity / onGround，y 由重力 + 平台碰撞决定。
export class Player {
  constructor(spawnX) {
    this.standHeight = P.height;
    this.crouchHeight = P.crouchHeight;
    this.width = P.width;
    this.height = P.height;

    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;            // +1 朝右 / -1 朝左
    this.crouching = false;
    this.jumpsLeft = 0;

    this.moveLeft = false;
    this.moveRight = false;
    this.wantJump = false;
    this.aiming = false;        // LT 举枪瞄准（移动减速）
    this.weaponIndex = 0;       // 当前武器槽（切枪占位）

    this.lastFire = -9999;
    this.lastGrenade = -9999;
    this.shootAnimUntil = 0;

    // 近战（刀）
    this.meleeMode = false;          // 是否处于持刀模式
    this.lastMelee = -9999;
    this.meleePhase = 'idle';        // idle | windup(举起) | swing(落下)
    this.meleeAnimUntil = 0;
    this.meleeHitDone = false;       // 本次劈砍是否已造成伤害

    this.isInvincible = false;
    this.invincibleEnd = 0;

    this.animTime = 0;
    this.frame = 0;

    this.reset(spawnX);
  }

  reset(spawnX) {
    this.x = spawnX;
    this.y = GameConfig.GROUND_Y - this.standHeight;
    this.height = this.standHeight;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.crouching = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.wantJump = false;
    this.aiming = false;
    this.weaponIndex = 0;
    this.lastFire = -9999;
    this.lastGrenade = -9999;
    this.meleeMode = false;
    this.lastMelee = -9999;
    this.meleePhase = 'idle';
    this.meleeAnimUntil = 0;
    this.meleeHitDone = false;
    this.isInvincible = false;
    this.animTime = 0;
    this.frame = 0;
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

  jump() {
    if (this.onGround) {
      this.vy = P.jumpSpeed;
      this.onGround = false;
      this.jumpsLeft = P.doubleJump ? 1 : 0;
      return true;
    }
    if (P.doubleJump && this.jumpsLeft > 0) {
      this.jumpsLeft--;
      this.vy = P.jumpSpeed * 0.92;
      return true;
    }
    return false;
  }

  update(dtf, world, currentTime) {
    this._t = currentTime || 0;
    // —— 水平 ——
    let move = 0;
    if (this.moveLeft) move -= 1;
    if (this.moveRight) move += 1;

    let speed = P.speed * (this.onGround ? 1 : P.airControl);
    if (this.aiming) speed *= 0.5;   // 举枪瞄准：移动减速
    if (this.crouching) speed *= 0.45;  // 蹲下移动：大幅减速（蹲走）
    this.vx = move * speed;

    if (move !== 0) this.facing = move > 0 ? 1 : -1;

    this.x += this.vx * dtf;
    this.resolveHorizontal(world.platforms);

    // —— 垂直 ——
    this.vy += GameConfig.GRAVITY * dtf;
    if (this.vy > GameConfig.MAX_FALL_SPEED) this.vy = GameConfig.MAX_FALL_SPEED;
    this.y += this.vy * dtf;

    this.onGround = false;
    this.resolveVertical(world.platforms);

    // 世界边界
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > world.worldWidth) {
      this.x = world.worldWidth - this.width;
    }

    // 掉出世界底部 -> 视为坠落
    if (this.y > GameConfig.CANVAS_HEIGHT + 200) {
      this.fellOut = true;
    }

    this.updateMeleePhase(currentTime || 0);
    this.animTime += dtf;
  }

  resolveHorizontal(platforms) {
    if (this.vx === 0) return;
    const box = this.getBounds();
    for (const p of platforms) {
      const pb = { x: p.x, y: p.y, width: p.w, height: p.h };
      if (!aabb(box, pb)) continue;
      if (this.vx > 0) this.x = p.x - this.width;
      else this.x = p.x + p.w;
      box.x = this.x;
    }
  }

  resolveVertical(platforms) {
    const box = this.getBounds();
    for (const p of platforms) {
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
  }

  // —— 开火（水平）——
  tryFire(currentTime) {
    const interval = this.getWeapon().fireInterval || P.fireInterval;
    if (currentTime - this.lastFire < interval) return false;
    this.lastFire = currentTime;
    this.shootAnimUntil = currentTime + 130;
    return true;
  }

  getGunHeight() {
    // 精灵 64px，碰撞盒 56px，枪口位于 sprite 内约 y+28 处
    return 20;
  }

  getWeapon() {
    const list = GameConfig.WEAPONS;
    return list[this.weaponIndex % list.length];
  }

  createBullet() {
    const w = this.getWeapon();
    const gy = this.y + this.getGunHeight();
    const x = this.facing > 0
      ? this.x + this.width
      : this.x - P.bulletWidth;
    return new Bullet(x, gy - P.bulletHeight / 2, (w.bulletSpeed || P.bulletSpeed) * this.facing, 0, {
      width: P.bulletWidth,
      height: P.bulletHeight,
      damage: w.bulletDamage || P.bulletDamage,
      color: w.color,
      owner: BulletOwner.PLAYER,
    });
  }

  // —— 手雷 ——
  tryGrenade(currentTime) {
    if (currentTime - this.lastGrenade < P.grenadeCooldown) return false;
    this.lastGrenade = currentTime;
    return true;
  }

  createGrenade() {
    const g = GameConfig.GRENADE;
    const x = this.facing > 0 ? this.x + this.width - 4 : this.x - g.width + 4;
    const y = this.y + 6;
    return new Grenade(x, y, g.throwVX * this.facing, g.throwVY);
  }

  // —— 近战（刀）——
  setMeleeMode(on) {
    this.meleeMode = on;
  }

  tryMelee(currentTime) {
    const m = GameConfig.MELEE;
    if (currentTime - this.lastMelee < m.cooldown) return false;
    if (this.meleePhase !== 'idle') return false;
    this.lastMelee = currentTime;
    this.meleePhase = 'windup';
    this.meleeAnimUntil = currentTime + m.windupTime + m.swingTime;
    this.meleeHitDone = false;
    return true;
  }

  // 更新劈砍阶段（每帧调用）
  updateMeleePhase(currentTime) {
    const m = GameConfig.MELEE;
    if (this.meleePhase === 'windup' && currentTime >= this.lastMelee + m.windupTime) {
      this.meleePhase = 'swing';
    } else if (this.meleePhase === 'swing' && currentTime >= this.meleeAnimUntil) {
      this.meleePhase = 'idle';
    }
  }

  // 劈砍碰撞盒：仅在 swing 阶段有效
  getMeleeHitbox() {
    if (this.meleePhase !== 'swing' || this.meleeHitDone) return null;
    const m = GameConfig.MELEE;
    const cx = this.getCenterX();
    const x = this.facing > 0 ? cx : cx - m.range;
    const y = this.y + (this.height - m.height) / 2;
    return { x, y, width: m.range, height: m.height };
  }

  markMeleeHit() {
    this.meleeHitDone = true;
  }

  hurt(currentTime) {
    this.isInvincible = true;
    this.invincibleEnd = currentTime + P.invincibleTime;
  }

  isInvincibleNow(currentTime) {
    if (this.isInvincible && currentTime > this.invincibleEnd) {
      this.isInvincible = false;
    }
    return this.isInvincible;
  }

  pickFrame(currentTime) {
    if (this.fellOut || this.dead) {
      const f = ANIM.PLAYER_DEATH;
      const idx = Math.min(f.length - 1, Math.floor(this.deathTime / 70));
      return f[idx];
    }
    if (!this.onGround) {
      const f = ANIM.PLAYER_JUMP;
      const idx = this.vy < 0 ? 0 : (this.vy > 4 ? 2 : 1);
      return f[idx];
    }
    if (this.meleePhase !== 'idle') {
      // 劈砍中：用 idle 第一帧作为身体基础，刀由 draw 单独绘制
      return ANIM.PLAYER_IDLE[0];
    }
    if (this.crouching) {
      if (currentTime < this.shootAnimUntil) {
        const f = ANIM.PLAYER_SHOOT_CROUCH;
        return f[Math.floor(currentTime / 70) % f.length];
      }
      const crouchMoving = this.moveLeft || this.moveRight;
      if (crouchMoving) {
        // 蹲走：循环蹲下帧，节奏比跑步慢
        const f = ANIM.PLAYER_SHOOT_CROUCH;
        return f[Math.floor(this.animTime / 8) % f.length];
      }
      return ANIM.PLAYER_SHOOT_CROUCH[1];
    }
    if (currentTime < this.shootAnimUntil) {
      const f = ANIM.PLAYER_SHOOT;
      return f[Math.floor(currentTime / 70) % f.length];
    }
    const moving = this.moveLeft || this.moveRight;
    if (moving) {
      const f = ANIM.PLAYER_RUN;
      return f[Math.floor(this.animTime / 5) % f.length];
    }
    const f = ANIM.PLAYER_IDLE;
    return f[Math.floor(this.animTime / 20) % f.length];
  }

  draw(ctx, currentTime, cameraX) {
    const sprites = getSprites();
    const frame = this.pickFrame(currentTime);
    const cx = this.getCenterX();

    ctx.save();
    if (this.isInvincibleNow(currentTime) &&
        Math.floor(currentTime / 80) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // 落地/行走扬起的微弱影子（不画发光圆球角色）
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, this.y + this.height - 2, this.width * 0.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const recoil = currentTime < this.shootAnimUntil ? -this.facing * 2 : 0;
    sprites.player.draw(ctx, frame, cx + recoil, this.y + this.height, this.facing);

    // —— 绘制刀（持刀模式或劈砍中）——
    if (this.meleeMode || this.meleePhase !== 'idle') {
      this.drawBlade(ctx, currentTime);
    }

    ctx.restore();
  }

  // 绘制刀和劈砍效果
  drawBlade(ctx, currentTime) {
    const m = GameConfig.MELEE;
    const cx = this.getCenterX();
    const handX = cx + this.facing * 5;
    const handY = this.y + this.height * 0.38;

    // 计算刀的角度（弧度，0 = 水平朝前）
    let angle;
    let showSlash = false;
    if (this.meleePhase === 'windup') {
      // 举起阶段：刀从身侧举到头顶
      const t = (currentTime - this.lastMelee) / m.windupTime;
      angle = -20 + (-120 - (-20)) * Math.min(1, t);  // -20° -> -120°
    } else if (this.meleePhase === 'swing') {
      // 落下阶段：刀从头顶划到下方
      const t = (currentTime - this.lastMelee - m.windupTime) / m.swingTime;
      angle = -120 + (50 - (-120)) * Math.min(1, t);  // -120° -> 50°
      showSlash = t > 0.15 && t < 0.85;
    } else {
      // 持刀待机：刀收在身侧
      angle = this.facing > 0 ? -20 : 200;
    }

    const rad = (angle * Math.PI) / 180;
    const bladeLen = 30;
    const bladeW = 3;
    const handleLen = 7;
    const handleW = 4;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(rad * (this.facing > 0 ? 1 : -1));

    // 刀柄
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(0, -handleW / 2, handleLen, handleW);
    // 护手
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(handleLen - 1, -handleW, 3, handleW * 2);
    // 刀身
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(handleLen + 2, -bladeW / 2, bladeLen, bladeW);
    // 刀身高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(handleLen + 2, -bladeW / 2, bladeLen, 1);
    // 刀尖
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.moveTo(handleLen + 2 + bladeLen, -bladeW / 2);
    ctx.lineTo(handleLen + 2 + bladeLen + 4, 0);
    ctx.lineTo(handleLen + 2 + bladeLen, bladeW / 2);
    ctx.fill();

    // 劈砍刀光（落下阶段）
    if (showSlash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      const grad = ctx.createLinearGradient(0, 0, bladeLen + 12, 0);
      grad.addColorStop(0, 'rgba(0,229,255,0)');
      grad.addColorStop(0.5, 'rgba(0,229,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, bladeLen + 6, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
