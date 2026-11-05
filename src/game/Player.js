import { GameConfig } from '../config/gameConfig.js';
import { Bullet, BulletOwner } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { getSprites, ANIM } from './SpriteSheet.js';

const P = GameConfig.PLAYER;
const WEAPON_BY_ID = new Map(GameConfig.WEAPONS.map((w) => [w.id, w]));

function aabb(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

// 玩家：有重力 vy / gravity / onGround，y 由重力 + 平台碰撞决定。
export class Player {
  constructor(spawnX, characterId = 'viktor') {
    const chars = GameConfig.CHARACTERS || [];
    this.profile = chars.find((c) => c.id === characterId) || chars[0] || {
      id: 'viktor', name: '维克', sheet: 'player', color: '#3ee6ff',
      lives: P.lives, speed: P.speed, jumpSpeed: P.jumpSpeed,
      dashSpeed: P.dashSpeed, dashDuration: P.dashDuration,
      dashCooldown: P.dashCooldown, dashIFrames: P.dashIFrames,
      meleeMultiplier: 1, startWeapons: [],
    };
    this.characterId = this.profile.id;
    this.sheetKey = this.profile.sheet || 'player';
    this.speed = this.profile.speed ?? P.speed;
    this.jumpSpeed = this.profile.jumpSpeed ?? P.jumpSpeed;
    this.doubleJump = this.profile.doubleJump ?? P.doubleJump;
    this.dashSpeed = this.profile.dashSpeed ?? P.dashSpeed;
    this.dashDuration = this.profile.dashDuration ?? P.dashDuration;
    this.dashCooldown = this.profile.dashCooldown ?? P.dashCooldown;
    this.dashIFrames = this.profile.dashIFrames ?? P.dashIFrames;
    this.meleeMultiplier = this.profile.meleeMultiplier ?? 1;

    this.standHeight = P.height;
    this.crouchHeight = P.crouchHeight;
    this.width = P.width;
    this.height = P.height;

    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;            // +1 朝右 / -1 朝左
    this.crouching = false;
    this.wantsCrouch = false;   // 输入意图；矮空间内会保持蹲伏
    this.jumpsLeft = 0;

    this.moveLeft = false;
    this.moveRight = false;
    this.wantJump = false;
    this.aiming = false;        // LT 举枪瞄准（移动减速）
    this.weaponIndex = 0;       // 当前武器在 weaponIds 中的下标
    this.weaponIds = ['pistol'];
    this.ammo = { pistol: Infinity };

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

    // 冲刺/滑铲 + 下落穿板
    this.dashUntil = 0;
    this.dashCooldownUntil = 0;
    this.dashDir = 1;
    this.dashIFramesUntil = 0;
    this.dashGhostAt = 0;
    this.dropThroughUntil = 0;
    this.prevY = 0;

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
    this.wantsCrouch = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.wantJump = false;
    this.aiming = false;
    this.weaponIndex = 0;
    this.weaponIds = ['pistol'];
    this.ammo = { pistol: Infinity };
    this.lastFire = -9999;
    this.lastGrenade = -9999;
    this.meleeMode = false;
    this.lastMelee = -9999;
    this.meleePhase = 'idle';
    this.meleeAnimUntil = 0;
    this.meleeHitDone = false;
    this.isInvincible = false;
    this.dashUntil = 0;
    this.dashCooldownUntil = 0;
    this.dashDir = 1;
    this.dashIFramesUntil = 0;
    this.dropThroughUntil = 0;
    this.prevY = 0;
    this.animTime = 0;
    this.frame = 0;

    // 角色初始武器：默认只带手枪，专精角色额外携带一把签名武器
    for (const entry of this.profile.startWeapons || []) {
      const cfg = WEAPON_BY_ID.get(entry.id);
      if (!cfg || cfg.infiniteAmmo) continue;
      this.addWeapon(entry.id, entry.ammo ?? cfg.pickupAmmo ?? 30);
    }
    this.weaponIndex = this.weaponIds.length > 1 ? this.weaponIds.length - 1 : 0;
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

  // 站立所需空间是否被平台挡住（用于矮空间内松键后保持蹲姿）
  hasHeadroom(platforms) {
    if (!this.crouching) return true;
    const feet = this.y + this.height;
    const box = {
      x: this.x,
      y: feet - this.standHeight,
      width: this.width,
      height: this.standHeight,
    };
    for (const p of platforms || []) {
      if (aabb(box, { x: p.x, y: p.y, width: p.w, height: p.h })) return false;
    }
    return true;
  }

  updateCrouch(platforms) {
    if (this.wantsCrouch) {
      if (this.onGround && !this.crouching) this.setCrouch(true);
      return;
    }
    // 松开蹲键：头顶没有阻挡才站起，否则继续蹲着挪出去
    if (this.crouching && this.hasHeadroom(platforms)) this.setCrouch(false);
  }

  jump() {
    if (this.onGround) {
      this.vy = this.jumpSpeed;
      this.onGround = false;
      this.jumpsLeft = this.doubleJump ? 1 : 0;
      return true;
    }
    if (this.doubleJump && this.jumpsLeft > 0) {
      this.jumpsLeft--;
      this.vy = this.jumpSpeed * 0.92;
      return true;
    }
    return false;
  }

  // 站在薄平台上「下 + 跳」：短暂忽略单向平台，直接落下去
  tryDropThrough(currentTime) {
    if (!this.onGround) return false;
    const feet = this.y + this.height;
    const onOneWay = (this._platforms || []).some((p) => {
      const oneWay = p.oneWay || p.h <= 12;
      return oneWay && Math.abs(p.y - feet) <= 3 &&
             this.x + this.width > p.x && this.x < p.x + p.w;
    });
    if (!onOneWay) return false;
    this.dropThroughUntil = currentTime + 220;
    this.y += 3;
    this.vy = 1.2;
    this.onGround = false;
    return true;
  }

  tryDash(currentTime) {
    if (currentTime < this.dashCooldownUntil) return false;
    if (currentTime < this.dashUntil) return false;
    const dir = this.moveLeft && !this.moveRight ? -1
      : (this.moveRight && !this.moveLeft ? 1 : this.facing);
    this.dashDir = dir;
    this.facing = dir;
    this.dashUntil = currentTime + this.dashDuration;
    this.dashCooldownUntil = currentTime + this.dashCooldown;
    this.dashIFramesUntil = currentTime + this.dashIFrames;
    this.dashGhostAt = currentTime;
    return true;
  }

  isDashing(currentTime) {
    return currentTime < this.dashUntil;
  }

  update(dtf, world, currentTime) {
    this._t = currentTime || 0;
    this._platforms = world.platforms || [];

    // 先响应蹲伏意图，再移动；移动结束若已走出矮空间则尝试站起
    this.updateCrouch(world.platforms);

    // —— 水平 ——
    let move = 0;
    if (this.moveLeft) move -= 1;
    if (this.moveRight) move += 1;

    let speed = this.speed * (this.onGround ? 1 : P.airControl);
    if (this.aiming) speed *= 0.5;   // 举枪瞄准：移动减速
    if (this.crouching) speed *= 0.45;  // 蹲下移动：大幅减速（蹲走）
    this.vx = move * speed;

    // 冲刺期间锁定方向与速度，忽略普通移动输入
    const dashing = this.isDashing(this._t);
    if (dashing) {
      this.vx = this.dashDir * this.dashSpeed;
      this.facing = this.dashDir;
    } else if (move !== 0) {
      this.facing = move > 0 ? 1 : -1;
    }

    this.x += this.vx * dtf;
    this.resolveHorizontal(world.platforms);

    // —— 垂直 ——
    this.prevY = this.y;
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

    this.updateCrouch(world.platforms);
    this.updateMeleePhase(currentTime || 0);
    this.animTime += dtf;
  }

  resolveHorizontal(platforms) {
    if (this.vx === 0) return;
    const box = this.getBounds();
    for (const p of platforms) {
      if (p.oneWay || p.h <= 12) continue;   // 薄平台只从上方站立，不挡水平移动
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
      const oneWay = p.oneWay || p.h <= 12;
      if (oneWay) {
        if (this._t < this.dropThroughUntil) continue;
        // 单向平台：只在下落且脚底从上方越过平台顶面时接住
        if (this.vy < 0 || this.prevY + this.height > p.y + 2) continue;
      }
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
  // 返回 { weapon, emptied }；无弹药时返回 null。
  tryFire(currentTime) {
    const w = this.getWeapon();
    if (!w) return null;
    if (!w.infiniteAmmo && !((this.ammo[w.id] || 0) > 0)) return null;

    const interval = w.fireInterval || P.fireInterval;
    if (currentTime - this.lastFire < interval) return null;
    this.lastFire = currentTime;
    this.shootAnimUntil = currentTime + 130;

    let emptied = false;
    if (!w.infiniteAmmo) {
      this.ammo[w.id] = Math.max(0, (this.ammo[w.id] || 0) - 1);
      emptied = this.ammo[w.id] === 0;
    }
    return { weapon: w, emptied };
  }

  getGunHeight() {
    // 与精灵枪管中心线对齐：站立 26、蹲伏 14（相对碰撞盒顶部）
    return this.crouching ? 14 : 26;
  }

  getMuzzle() {
    // 紧凑武器枪口固定在帧中心 +24
    return {
      x: this.getCenterX() + this.facing * 24,
      y: this.y + this.getGunHeight(),
    };
  }

  getWeapon() {
    const id = this.weaponIds[this.weaponIndex] || 'pistol';
    return WEAPON_BY_ID.get(id) || GameConfig.WEAPONS[0];
  }

  // 一次扳机可能产生多发弹丸（霰弹枪），统一返回数组。
  createBullets(weapon) {
    const w = weapon || this.getWeapon();
    const count = Math.max(1, w.pellets || 1);
    const bullets = [];
    for (let i = 0; i < count; i++) {
      bullets.push(this.createBullet(w, i, count));
    }
    return bullets;
  }

  createBullet(weapon, index = 0, count = 1) {
    const w = weapon || this.getWeapon();
    const muzzle = this.getMuzzle();
    const width = w.bulletWidth || P.bulletWidth;
    const height = w.bulletHeight || P.bulletHeight;
    const speed = w.bulletSpeed || P.bulletSpeed;

    // 霰弹按扇形均匀铺开；普通武器用随机散布；0 散布保持完全水平
    let angle = 0;
    if (count > 1) {
      const fan = ((w.pelletSpreadDeg || 0) * Math.PI) / 180;
      angle = count === 1 ? 0 : -fan + (fan * 2 * index) / (count - 1);
      angle += (Math.random() * 2 - 1) * 0.015;
    } else {
      const spreadRad = ((w.spreadDeg || 0) * Math.PI) / 180;
      angle = spreadRad ? (Math.random() * 2 - 1) * spreadRad : 0;
    }

    const x = this.facing > 0 ? muzzle.x : muzzle.x - width;
    return new Bullet(x, muzzle.y - height / 2, Math.cos(angle) * speed * this.facing, Math.sin(angle) * speed, {
      width,
      height,
      damage: w.bulletDamage ?? P.bulletDamage,
      color: w.color,
      owner: BulletOwner.PLAYER,
      style: w.bulletStyle || 'pistol',
      splashRadius: w.splashRadius || 0,
      splashDamage: w.splashDamage || 0,
      pierce: w.pierce || 0,
      impactShake: w.impactShake,
      impactShakeIntensity: w.impactShakeIntensity,
      hitStop: w.hitStop,
    });
  }

  // —— 武器背包 ——
  hasWeapon(id) {
    return this.weaponIds.includes(id);
  }

  addWeapon(id, amount) {
    const cfg = WEAPON_BY_ID.get(id);
    if (!cfg || cfg.infiniteAmmo) return null;

    const alreadyOwned = this.weaponIds.includes(id);
    if (!alreadyOwned) this.weaponIds.push(id);

    const before = this.ammo[id] || 0;
    this.ammo[id] = Math.min(cfg.maxAmmo, before + amount);
    this.weaponIndex = this.weaponIds.indexOf(id);
    return {
      weapon: cfg,
      isNew: !alreadyOwned,
      ammo: this.ammo[id],
      added: this.ammo[id] - before,
    };
  }

  addAmmoToFinite() {
    let restored = 0;
    for (const id of this.weaponIds) {
      const cfg = WEAPON_BY_ID.get(id);
      if (!cfg || cfg.infiniteAmmo) continue;
      const add = GameConfig.LOOT.ammoBox[id] || 0;
      if (add <= 0) continue;
      const before = this.ammo[id] || 0;
      this.ammo[id] = Math.min(cfg.maxAmmo, before + add);
      restored += this.ammo[id] - before;
    }
    return restored;
  }

  // 在“仍有弹药”的武器之间循环；只有一把可用武器时返回 null
  cycleWeapon() {
    const usable = [];
    this.weaponIds.forEach((id, i) => {
      const cfg = WEAPON_BY_ID.get(id);
      if (cfg && (cfg.infiniteAmmo || (this.ammo[id] || 0) > 0)) usable.push(i);
    });
    if (usable.length <= 1) return null;

    const pos = usable.indexOf(this.weaponIndex);
    this.weaponIndex = usable[(pos + 1) % usable.length];
    return this.getWeapon();
  }

  // 弹药耗尽：从背包移除，并自动切到下一把有弹药的武器
  removeWeapon(id) {
    const idx = this.weaponIds.indexOf(id);
    if (idx < 0) return this.getWeapon();

    this.weaponIds.splice(idx, 1);
    delete this.ammo[id];

    if (this.weaponIds.length === 0) {
      this.weaponIds.push('pistol');
      this.ammo.pistol = Infinity;
      this.weaponIndex = 0;
    } else if (idx === this.weaponIndex) {
      // 当前枪打空：优先切到背包里的下一把
      this.weaponIndex = Math.min(idx, this.weaponIds.length - 1);
    } else if (idx < this.weaponIndex) {
      this.weaponIndex--;
    }
    return this.getWeapon();
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
    if (currentTime < this.dashIFramesUntil) return true;
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
    // 近战姿态：帧 33/34 举刀，35-37 落刀，38 收势（持刀待机）
    if (this.meleePhase !== 'idle') {
      return ANIM.PLAYER_MELEE[this.getMeleeFrameIndex(currentTime)];
    }
    if (this.meleeMode && !this.crouching) {
      return ANIM.PLAYER_MELEE[5];
    }
    if (this.isDashing(currentTime)) {
      // 冲刺没有独立帧，用跑步帧加速播放 + 残影表现速度
      const f = ANIM.PLAYER_RUN;
      return f[Math.floor(currentTime / 28) % f.length];
    }
    if (!this.onGround) {
      const f = ANIM.PLAYER_JUMP;
      const idx = this.vy < 0 ? 0 : (this.vy > 4 ? 2 : 1);
      return f[idx];
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

  getMeleeFrameIndex(currentTime) {
    const m = GameConfig.MELEE;
    if (this.meleePhase === 'windup') {
      const k = clamp01((currentTime - this.lastMelee) / m.windupTime);
      return k < 0.5 ? 0 : 1;
    }
    if (this.meleePhase === 'swing') {
      const k = clamp01((currentTime - this.lastMelee - m.windupTime) / m.swingTime);
      return 2 + Math.min(2, Math.floor(k * 3));
    }
    return 5;
  }

  // 0/1/2 = 举刀，3/4/5 = 落刀，6 = 持刀待机
  getBladePose(currentTime) {
    const m = GameConfig.MELEE;
    if (this.meleePhase === 'windup') {
      const k = clamp01((currentTime - this.lastMelee) / m.windupTime);
      if (k < 0.45) return 0;
      if (k < 0.8) return 1;
      return 2;
    }
    if (this.meleePhase === 'swing') {
      const k = clamp01((currentTime - this.lastMelee - m.windupTime) / m.swingTime);
      return 3 + Math.min(2, Math.floor(k * 3));
    }
    return 6;
  }

  draw(ctx, currentTime, cameraX) {
    const sprites = getSprites();
    const sheet = sprites[this.sheetKey] || sprites.player;
    const neon = this.profile.color || '#45eeff';
    const frame = this.pickFrame(currentTime);
    const cx = this.getCenterX();
    const feet = this.y + this.height;

    ctx.save();
    if (this.isInvincibleNow(currentTime) &&
        Math.floor(currentTime / 80) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // 像素化落地阴影（不用抗锯齿椭圆）
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(Math.round(cx) - 7, Math.round(feet) - 2, 14, 2);
    ctx.fillRect(Math.round(cx) - 5, Math.round(feet) - 4, 10, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(Math.round(cx) - 3, Math.round(feet) - 5, 6, 1);

    const recoil = currentTime < this.shootAnimUntil ? -this.facing * 2 : 0;

    // 冲刺残影：两帧青色剪影，让短位移在画面上有速度感
    if (this.isDashing(currentTime)) {
      for (let i = 1; i <= 2; i++) {
        ctx.save();
        ctx.globalAlpha = 0.22 / i;
        sheet.drawTint(
          ctx, frame, cx + recoil - this.dashDir * i * 9, feet,
          this.facing, neon, 0.9,
        );
        ctx.restore();
      }
    }

    // 环境霓虹边缘光：角色主色一侧 + 粉色一侧，让角色从暗背景里“剥”出来
    sheet.drawTint(ctx, frame, cx + recoil - 1, feet, this.facing, neon, 0.30);
    sheet.drawTint(ctx, frame, cx + recoil + 1, feet, this.facing, '#ff2e88', 0.15);
    sheet.draw(ctx, frame, cx + recoil, feet, this.facing);

    // —— 绘制刀（持刀模式或劈砍中）——
    if (this.meleeMode || this.meleePhase !== 'idle') {
      this.drawBlade(ctx, currentTime);
    }

    ctx.restore();
  }

  // 1px 像素刀：不用 rotate/arc，避免旋转抗锯齿破坏像素网格
  drawBlade(ctx, currentTime) {
    const m = GameConfig.MELEE;
    const cx = this.getCenterX();
    const feet = this.y + this.height;
    const facing = this.facing;
    const pose = this.getBladePose(currentTime);

    // 本地坐标：x 向前为正，y 相对脚底向上为负
    const POSES = [
      { hand: [6, -48], base: [2, -55], tip: [-10, -70], grip: [10, -43] },
      { hand: [7, -49], base: [8, -57], tip: [10, -78], grip: [6, -42] },
      { hand: [13, -34], base: [8, -41], tip: [-8, -56], grip: [17, -27] },
      { hand: [13, -32], base: [18, -32], tip: [45, -31], grip: [7, -34] },
      { hand: [13, -31], base: [17, -28], tip: [39, -8], grip: [9, -34] },
      { hand: [12, -30], base: [16, -24], tip: [29, 1], grip: [8, -36] },
      { hand: [12, -32], base: [15, -26], tip: [22, -9], grip: [9, -38] },
    ];
    const p = POSES[pose] || POSES[6];

    const screenX = (lx) => Math.round(cx + facing * lx);
    const screenY = (ly) => Math.round(feet + ly);

    const line = (a, b, color, size = 1) => {
      const steps = Math.max(2, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2));
      ctx.fillStyle = color;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lx = a[0] + (b[0] - a[0]) * t;
        const ly = a[1] + (b[1] - a[1]) * t;
        ctx.fillRect(screenX(lx) - (size >> 1), screenY(ly) - (size >> 1), size, size);
      }
    };

    // 落下阶段的像素刀光：三段同心弧，越靠外越淡
    if (this.meleePhase === 'swing') {
      const k = clamp01((currentTime - this.lastMelee - m.windupTime) / m.swingTime);
      const alpha = Math.sin(Math.PI * k);
      if (alpha > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const originY = feet - 34;
        for (let ring = 0; ring < 3; ring++) {
          const r = 25 + ring * 6;
          ctx.globalAlpha = alpha * (0.34 - ring * 0.08);
          ctx.fillStyle = ring === 1 ? '#d9ffff' : '#45eeff';
          const a0 = -1.05;
          const a1 = -1.05 + 1.9 * Math.min(1, k * 1.15);
          for (let i = 0; i <= 22; i++) {
            const a = a0 + (a1 - a0) * (i / 22);
            const lx = Math.cos(a) * r;
            const ly = Math.sin(a) * r;
            ctx.fillRect(Math.round(cx + facing * lx), Math.round(originY + ly), 1, 1);
          }
        }
        ctx.restore();
      }
    }

    // 刀柄（深色描边 + 棕色内芯 + 高光）
    line(p.hand, p.grip, '#07090e', 3);
    line(p.hand, p.grip, '#5a3418', 1);
    line(p.hand, [p.grip[0], p.grip[1] - 1], '#8a5a2a', 1);

    // 护手：沿刀身轴线的垂直方向
    const ax = p.tip[0] - p.base[0];
    const ay = p.tip[1] - p.base[1];
    const len = Math.hypot(ax, ay) || 1;
    const px = -ay / len;
    const py = ax / len;
    line(
      [p.base[0] - px * 3, p.base[1] - py * 3],
      [p.base[0] + px * 3, p.base[1] + py * 3],
      '#8b96a8', 1,
    );
    ctx.fillStyle = '#d6dfeb';
    ctx.fillRect(screenX(p.base[0]) - 1, screenY(p.base[1]) - 1, 2, 2);

    // 刀身：3px 暗描边 + 1px 亮钢 + 1px 白高光
    line(p.base, p.tip, '#07090e', 3);
    line(p.base, p.tip, '#d9e6f2', 1);
    const mid = [p.base[0] + ax * 0.62, p.base[1] + ay * 0.62];
    const hiOff = [px * 0.9, py * 0.9];
    line(
      [p.base[0] + hiOff[0], p.base[1] + hiOff[1]],
      [mid[0] + hiOff[0], mid[1] + hiOff[1]],
      'rgba(255,255,255,0.9)', 1,
    );
    ctx.fillStyle = '#eaffff';
    ctx.fillRect(screenX(p.tip[0]) - 1, screenY(p.tip[1]) - 1, 2, 2);
    ctx.fillStyle = '#45eeff';
    ctx.fillRect(screenX(mid[0]), screenY(mid[1]), 1, 1);
  }
}
