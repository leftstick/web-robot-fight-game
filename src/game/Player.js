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

  update(dtf, world) {
    // —— 水平 ——
    let move = 0;
    if (this.moveLeft) move -= 1;
    if (this.moveRight) move += 1;

    let speed = P.speed * (this.onGround ? 1 : P.airControl);
    if (this.aiming) speed *= 0.5;   // 举枪瞄准：移动减速
    this.vx = move * speed;

    if (move !== 0) this.facing = move > 0 ? 1 : -1;
    // 蹲下时不能移动
    if (this.crouching) this.vx = 0;

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
    if (currentTime - this.lastFire < P.fireInterval) return false;
    this.lastFire = currentTime;
    this.shootAnimUntil = currentTime + 130;
    return true;
  }

  getGunHeight() {
    // 相对碰撞盒顶部的枪口高度：站立时枪口高于掩体（探头射击），
    // 蹲下时枪口低于掩体顶部（被自己面前的掩体挡住 / 藏好）。
    return 12;
  }

  getWeapon() {
    const list = GameConfig.WEAPONS;
    return list[this.weaponIndex % list.length];
  }

  createBullet() {
    const gy = this.y + this.getGunHeight();
    const x = this.facing > 0
      ? this.x + this.width
      : this.x - P.bulletWidth;
    return new Bullet(x, gy - P.bulletHeight / 2, P.bulletSpeed * this.facing, 0, {
      width: P.bulletWidth,
      height: P.bulletHeight,
      damage: P.bulletDamage,
      color: this.getWeapon().color,
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
    if (!this.onGround) return ANIM.JUMP[0];
    if (this.crouching) return ANIM.CROUCH[0];
    if (currentTime < this.shootAnimUntil) {
      const f = ANIM.SHOOT;
      return f[Math.floor(currentTime / 70) % f.length];
    }
    const moving = this.moveLeft || this.moveRight;
    if (moving) {
      const f = ANIM.WALK;
      return f[Math.floor(this.animTime / 7) % f.length];
    }
    const f = ANIM.IDLE;
    return f[Math.floor(this.animTime / 22) % f.length];
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
    ctx.restore();
  }
}
