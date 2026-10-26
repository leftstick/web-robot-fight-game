import { GameConfig } from '../config/gameConfig.js';
import { Player } from './Player.js';
import { Thug, Boss } from './Enemy.js';
import { ParticleSystem } from './Particle.js';
import { EffectSystem } from './Effects.js';
import { SceneRenderer } from './SceneRenderer.js';
import { Level, loadLevels } from './Level.js';
import { Pickup } from './Pickup.js';
import { BulletOwner } from './Bullet.js';
import { InputManager } from '../utils/input.js';
import { Sfx } from '../utils/sfx.js';
import { AssetLoader, assetsReady, getUi } from './SpriteSheet.js';

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
  VICTORY: 'victory',
};

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

function aabb(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // 逻辑尺寸（离屏画布）
    this.logicalW = GameConfig.LOGICAL_WIDTH;
    this.logicalH = GameConfig.LOGICAL_HEIGHT;
    this.scale = GameConfig.RENDER_SCALE;

    // 离屏画布：480x270
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.logicalW;
    this.offscreen.height = this.logicalH;
    this.lctx = this.offscreen.getContext('2d');
    this.lctx.imageSmoothingEnabled = false;

    this.state = GameState.MENU;
    this.currentLevel = 1;
    this.score = 0;
    this.lives = GameConfig.PLAYER.lives;
    this.totalKills = 0;

    this.level = null;
    this.world = null;
    this.levels = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.grenades = [];
    this.pickups = [];
    this.killsSinceDrop = 0;
    this.pickupToast = null;
    this.boss = null;
    this.bossSpawned = false;

    this.cameraX = 0;
    this.particleSystem = new ParticleSystem();
    this.effectSystem = new EffectSystem();
    this.sceneRenderer = new SceneRenderer(this.logicalW, this.logicalH);
    this.input = new InputManager();
    this.sfx = new Sfx();
    this.assetLoader = new AssetLoader();

    this.lastTime = 0;
    this.deltaTime = 16;
    this.currentTime = 0;
    this.animationId = null;

    this.screenShake = 0;
    this.screenShakeIntensity = 0;
    this.hitStop = 0;
    this.damageFlash = 0;

    // 加载进度
    this.loadProgress = 0;
    this.loadingDone = false;

    // CRT 扫描线贴图 + 暗角
    this.crtCanvas = null;
    this.vignetteCanvas = this.createVignette();

    this.onStateChange = null;
    this.onScoreChange = null;
    this.onLivesChange = null;
    this.onEnemyCountChange = null;
    this.onLevelChange = null;

    this._lastRemaining = -1;
  }

  async init() {
    this.input.bindTouchControls(document.getElementById('touchControls'));

    // 加载素材
    this.assetLoader.onProgress = (p) => {
      this.loadProgress = p;
    };
    await this.assetLoader.loadAll();
    this.loadingDone = true;

    // CRT 贴图
    this.crtCanvas = getUi('crt');

    // 加载关卡
    this.loadPromise = loadLevels();
    this.loadPromise.then((data) => {
      this.levels = data;
      if (!this.level) {
        this.level = new Level(data[0]);
        this.world = this.buildWorld(this.level);
        this.sceneRenderer.setLevel(this.level.id, this.level.worldWidth);
      }
    });

    this.gameLoop(0);
  }

  buildWorld(level) {
    return {
      platforms: level.platforms,
      covers: level.covers,
      worldWidth: level.worldWidth,
    };
  }

  async startLevel(levelNumber) {
    if (!this.levels) this.levels = await this.loadPromise;
    const raw = this.levels[Math.min(levelNumber, this.levels.length) - 1] || this.levels[0];

    this.level = new Level(raw);
    this.level.resetCovers();
    this.world = this.buildWorld(this.level);
    this.sceneRenderer.setLevel(this.level.id, this.level.worldWidth);
    this.currentLevel = levelNumber;

    this.state = GameState.PLAYING;
    this.score = 0;
    this.lives = GameConfig.PLAYER.lives;
    this.totalKills = 0;
    this.bullets = [];
    this.grenades = [];
    this.pickups = [];
    this.killsSinceDrop = 0;
    this.pickupToast = null;
    this.enemies = [];
    this.boss = null;
    this.bossSpawned = false;
    this.particleSystem.clear();
    this.effectSystem.clear();
    this.screenShake = 0;
    this.hitStop = 0;
    this.damageFlash = 0;
    this.cameraX = clamp(this.level.playerSpawn.x - this.logicalW * 0.4, 0, this.level.worldWidth - this.logicalW);

    this.player = new Player(this.level.playerSpawn.x);
    this.enemies = this.level.enemySpawns.map((sp) => new Thug(sp.x, sp.y));

    this.input.clearJustPressed();
    this.sfx.resume();

    if (this.onStateChange) this.onStateChange(this.state);
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.onLivesChange) this.onLivesChange(this.lives);
    if (this.onLevelChange) this.onLevelChange(this.currentLevel);
    this.emitRemaining(true);
  }

  emitRemaining(force) {
    if (!this.level) return;
    const total = this.level.enemySpawns.length;
    const remaining = Math.max(0, total - this.totalKills);
    if (force || remaining !== this._lastRemaining) {
      this._lastRemaining = remaining;
      if (this.onEnemyCountChange) this.onEnemyCountChange(remaining);
    }
  }

  pause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  resume() {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.input.clearJustPressed();
      this.sfx.resume();
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  gameLoop(currentTime) {
    this.currentTime = currentTime;
    this.deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    if (this.deltaTime > 50) this.deltaTime = 16;

    const dtf = Math.min(this.deltaTime / 16.667, 2);

    this.update(dtf);
    this.render();

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dtf) {
    // 命中停顿：整个世界短暂冻结，粒子和雨以慢动作继续，制造打击感。
    const frozen = this.hitStop > 0;
    if (frozen) {
      this.hitStop = Math.max(0, this.hitStop - this.deltaTime);
      this.sceneRenderer.update(this.deltaTime * 0.35);
    } else {
      this.sceneRenderer.update(this.deltaTime);
    }

    // 每帧读取统一输入信号（所有状态均轮询，菜单导航需要它）
    const input = this.input.poll();
    if (this.onFrame) this.onFrame(input);

    if (this.state === GameState.PLAYING && !frozen) {
      this.updatePlaying(dtf, input);
    }

    const fxDelta = frozen ? this.deltaTime * 0.25 : this.deltaTime;
    this.particleSystem.update(fxDelta);
    this.effectSystem.update(fxDelta);

    for (const c of (this.level ? this.level.covers : [])) c.update(this.deltaTime);

    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - this.deltaTime / 420);
    }

    if (this.screenShake > 0) {
      this.screenShake -= this.deltaTime;
      if (this.screenShake < 0) this.screenShake = 0;
    }
  }

  updatePlaying(dtf, input) {
    if (input.pause) {
      this.pause();
      return;
    }

    const p = this.player;

    p.moveLeft = input.moveLeft;
    p.moveRight = input.moveRight;
    p.aiming = input.aim;
    // 只记录意图；是否真的站起由头顶净空决定
    p.wantsCrouch = input.crouch;

    if (input.jump && p.jump()) this.sfx.jump();

    if (input.shoot && !p.meleeMode) {
      const fire = p.tryFire(this.currentTime);
      if (fire) {
        const b = p.createBullet(fire.weapon);
        this.bullets.push(b);
        // 枪口特效对准精灵里的实际枪管位置
        const muzzle = p.getMuzzle();
        this.effectSystem.muzzleFlash(muzzle.x, muzzle.y, p.facing);
        this.effectSystem.shell(muzzle.x - p.facing * 4, muzzle.y, p.facing * 1.5, -1.5);
        this.sfx.shoot();
        if (fire.emptied) this.onWeaponEmpty(fire.weapon);
      }
    }

    if (input.grenade && p.tryGrenade(this.currentTime)) {
      this.grenades.push(p.createGrenade());
      this.sfx.throwGrenade();
    }

    if (input.switchWeapon) this.switchWeapon();

    // —— 自动切刀：靠近敌人时切换为刀，远离时切回枪 ——
    this.updateMeleeMode();

    // —— 近战劈砍（X 键；持刀时射击键也直接挥砍，避免近身后无法攻击）——
    if ((input.melee || (p.meleeMode && input.shoot)) && p.tryMelee(this.currentTime)) {
      this.sfx.shoot(); // 复用挥砍音效
    }

    p.update(dtf, this.world, this.currentTime);

    this.updateCamera();
    this.updateBullets(dtf);
    this.updateEnemies(dtf);
    this.updatePickups(dtf);
    this.updateGrenades(dtf);
    this.spawnBoss();

    // 劈砍碰撞检测（在敌人更新后）
    this.resolveMelee();

    this.checkGameState();
  }

  // 自动切刀：检测玩家附近是否有敌人
  updateMeleeMode() {
    const p = this.player;
    const m = GameConfig.MELEE;
    const pcx = p.getCenterX();
    let nearEnemy = false;
    for (const e of this.enemies) {
      if (e.dead || !e.awake) continue;
      const dist = Math.abs(e.getCenterX() - pcx);
      if (dist < m.autoSwitchDist) {
        nearEnemy = true;
        break;
      }
    }
    p.setMeleeMode(nearEnemy);
  }

  // 劈砍碰撞与伤害
  resolveMelee() {
    const p = this.player;
    const hitbox = p.getMeleeHitbox();
    if (!hitbox) return;

    for (const e of this.enemies) {
      if (e.dead || !e.awake) continue;
      if (aabb(hitbox, e.getBounds())) {
        const died = e.takeDamage(GameConfig.MELEE.damage);
        // 血溅 + 白色冲击闪光 + 短促顿帧
        const hx = e.getCenterX();
        const hy = e.y + e.height * 0.4;
        this.effectSystem.blood(hx, hy);
        this.effectSystem.hitSparks(hx, hy);
        this.particleSystem.createExplosion(hx, hy, '#ff5a5a', 8);
        this.addScreenShake(5, 4);
        this.addHitStop(died ? 95 : 65);
        if (died) this.killEnemy(e);
        p.markMeleeHit();
        break; // 一次劈砍只命中一个敌人
      }
    }
  }

  switchWeapon() {
    if (!this.player) return;
    // 只在仍有弹药的武器之间循环；只有一把可用时不响不切
    const next = this.player.cycleWeapon();
    if (next) this.sfx.click();
  }

  updateCamera() {
    const target = this.player.x + this.player.width / 2 - this.logicalW * 0.4;
    const clamped = clamp(target, 0, this.level.worldWidth - this.logicalW);
    this.cameraX += (clamped - this.cameraX) * 0.16;
    this.cameraX = clamp(this.cameraX, 0, this.level.worldWidth - this.logicalW);
  }

  updateBullets(dtf) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dtf);
      this.resolveBullet(b);

      const offScreen = b.x < this.cameraX - 130 ||
                        b.x > this.cameraX + this.logicalW + 130 ||
                        b.y < -130 || b.y > this.logicalH + 130;
      if (offScreen) b.active = false;

      if (!b.active) this.bullets.splice(i, 1);
    }
  }

  resolveBullet(b) {
    const bb = b.getBounds();

    for (const c of this.level.covers) {
      if (c.hp <= 0) continue;
      if (b.ignoreCover === c) continue;
      if (aabb(bb, c.getBounds())) {
        b.active = false;
        this.effectSystem.hitSparks(b.x + b.width / 2, b.y + b.height / 2);
        this.addHitStop(18);
        if (c.takeDamage(b.damage)) {
          const cc = c.getCenter();
          this.effectSystem.explosion(cc.x, cc.y);
          this.particleSystem.createExplosion(cc.x, cc.y, '#ffb347', 10);
          this.addScreenShake(12, 6);
          this.addHitStop(55);
          this.sfx.explosion();
          this.releaseCoverClaims(c);
        }
        return;
      }
    }

    if (b.owner === BulletOwner.PLAYER) {
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        if (e.dead) continue;
        if (aabb(bb, e.getBounds())) {
          b.active = false;
          this.effectSystem.blood(b.x + b.width / 2, b.y + b.height / 2);
          this.effectSystem.hitSparks(b.x + b.width / 2, b.y + b.height / 2);
          const died = e.takeDamage(b.damage);
          this.addScreenShake(4, 3);
          this.addHitStop(died ? 85 : 22);
          if (died) this.killEnemy(e);
          return;
        }
      }
    } else {
      const p = this.player;
      if (!p.isInvincibleNow(this.currentTime) && aabb(bb, p.getBounds())) {
        b.active = false;
        this.damagePlayer();
      }
    }
  }

  releaseCoverClaims(cover) {
    for (const e of this.enemies) {
      if (e.cover === cover) e.cover = null;
    }
  }

  updateEnemies(dtf) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.deathTime += this.deltaTime;
        if (e.deathTime > 600) {
          this.enemies.splice(i, 1);
        }
        continue;
      }
      if (!e.awake) {
        if (e.x < this.cameraX + this.logicalW + 70) e.awake = true;
        else continue;
      }
      if (e.cover && e.cover.hp <= 0) e.cover = null;

      const bullet = e.update(dtf, this.deltaTime, this.currentTime, this.world, this.player);
      if (bullet) {
        this.bullets.push(bullet);
        // 敌人枪口火焰（与精灵枪管对齐）
        const muzzle = e.getMuzzle();
        this.effectSystem.muzzleFlash(muzzle.x, muzzle.y, e.facing);
        this.sfx.enemyShoot();
      }
      if (e.hitFlash > 0) e.hitFlash -= this.deltaTime;

      // Boss 冲撞接触伤害
      if (e.tryChargeHit && e.tryChargeHit(this.player, this.currentTime)) {
        if (!this.player.isInvincibleNow(this.currentTime)) {
          this.damagePlayer();
          this.addScreenShake(14, 8);
        }
      }
    }
  }

  updateGrenades(dtf) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(dtf, this.deltaTime);

      let hitGround = false;
      if (g.vy > 0) {
        for (const p of this.level.platforms) {
          if (aabb({ x: g.x, y: g.y, width: g.width, height: g.height },
                   { x: p.x, y: p.y, width: p.w, height: p.h })) {
            hitGround = true;
            break;
          }
        }
      }

      if (hitGround || !g.active) {
        this.explodeGrenade(g);
        this.grenades.splice(i, 1);
      }
    }
  }

  explodeGrenade(g) {
    const c = g.getCenter();
    const radius = GameConfig.GRENADE.radius;
    this.effectSystem.explosion(c.x, c.y);
    this.particleSystem.createExplosion(c.x, c.y, '#ffb347', 18);
    this.addScreenShake(20, 11);
    this.addHitStop(70);
    this.sfx.explosion();

    for (const e of this.enemies) {
      if (e.dead) continue;
      const ec = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
      const d = Math.hypot(ec.x - c.x, ec.y - c.y);
      if (d < radius) {
        const died = e.takeDamage(GameConfig.GRENADE.damage);
        if (died) this.killEnemy(e);
      }
    }

    for (const cov of this.level.covers) {
      if (cov.hp <= 0) continue;
      const cc = cov.getCenter();
      const d = Math.hypot(cc.x - c.x, cc.y - c.y);
      if (d < radius && cov.takeDamage(GameConfig.GRENADE.damage)) {
        this.releaseCoverClaims(cov);
      }
    }
  }

  killEnemy(e) {
    e.dead = true;
    const c = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    this.effectSystem.blood(c.x, c.y);
    this.effectSystem.spawn('debris', c.x, c.y + 6, { scale: 0.4, frameDuration: 60, additive: false });
    this.particleSystem.createExplosion(c.x, c.y, '#ff5a5a', 16);
    this.addScreenShake(11, 6);
    this.addHitStop(85);
    this.sfx.explosion();

    this.addScore(e.score);
    this.totalKills++;
    this.emitRemaining(false);
    this.spawnLoot(e);

    if (e === this.boss) {
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  addScore(points) {
    this.score += points;
    if (this.onScoreChange) this.onScoreChange(this.score);
  }

  // —— 掉落 ——
  spawnLoot(enemy) {
    if (!enemy || enemy === this.boss) return;

    this.killsSinceDrop++;
    if (this.pickups.length >= GameConfig.LOOT.maxPickups) return;

    const forced = this.killsSinceDrop >= GameConfig.LOOT.pityKills;
    if (!forced && Math.random() >= GameConfig.LOOT.dropChance) return;

    const type = this.rollLootType();
    this.killsSinceDrop = 0;
    this.spawnPickup(type, enemy.getCenterX(), enemy.y + enemy.height);
  }

  rollLootType() {
    const drops = GameConfig.LOOT.drops;
    const total = drops.reduce((sum, d) => sum + d.weight, 0);
    let roll = Math.random() * total;
    for (const drop of drops) {
      roll -= drop.weight;
      if (roll <= 0) return drop.type;
    }
    return 'health';
  }

  spawnPickup(type, centerX, bottomY) {
    if (this.pickups.length >= GameConfig.LOOT.maxPickups) return null;
    const pickup = new Pickup(type, centerX, bottomY, this.currentTime);
    this.pickups.push(pickup);
    return pickup;
  }

  updatePickups(dtf) {
    const p = this.player;
    const pcx = p.getCenterX();
    const pcy = p.y + p.height * 0.5;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.update(dtf, this.world);

      if (!pickup.isCollectable(this.currentTime)) continue;

      // 已落地的掉落物在近身时轻微吸附，避免高速跑动时擦边漏捡
      const pkx = pickup.x + pickup.w / 2;
      const pky = pickup.y + pickup.h / 2;
      const dx = pcx - pkx;
      const dy = pcy - pky;
      if (pickup.settled && Math.abs(dx) < 44 && Math.abs(dy) < 36 && Math.abs(dx) > 0.5) {
        pickup.x += Math.sign(dx) * 1.1 * dtf;
      }

      if (!aabb(p.getBounds(), pickup.getCollectBounds())) continue;

      this.pickups.splice(i, 1);
      pickup.collected = true;
      this.collectPickup(pickup);
    }
  }

  collectPickup(pickup) {
    const p = this.player;
    const cx = pickup.x + pickup.w / 2;
    const cy = pickup.y + pickup.h / 2;
    this.effectSystem.hitSparks(cx, cy);
    this.particleSystem.createExplosion(cx, cy, pickup.color, 7);
    this.sfx.pickup();

    if (pickup.type === 'health') {
      if (this.lives < GameConfig.PLAYER.lives) {
        this.lives++;
        if (this.onLivesChange) this.onLivesChange(this.lives);
        this.showPickupToast('医疗包 +1 生命', '#ff5a6e');
      } else {
        this.addScore(GameConfig.LOOT.healthScore);
        this.showPickupToast(`生命已满 +${GameConfig.LOOT.healthScore} 分`, '#ff5a6e');
      }
      return;
    }

    if (pickup.type === 'ammo') {
      const restored = p.addAmmoToFinite();
      if (restored > 0) {
        this.showPickupToast(`弹药补给 +${restored} 发`, '#ffe066');
      } else {
        this.addScore(GameConfig.LOOT.ammoScore);
        this.showPickupToast(`弹药箱 +${GameConfig.LOOT.ammoScore} 分`, '#ffe066');
      }
      return;
    }

    const weaponId = pickup.def.weapon || pickup.type;
    const amount = GameConfig.LOOT.weaponAmmo[weaponId] || 30;
    const result = p.addWeapon(weaponId, amount);
    if (!result) return;

    if (result.added > 0) {
      const action = result.isNew ? '入包' : '补弹';
      this.showPickupToast(`${result.weapon.name} ${action} +${result.added} 发`, result.weapon.color);
    } else {
      this.showPickupToast(`${result.weapon.name} 弹药已满`, result.weapon.color);
    }
  }

  onWeaponEmpty(weapon) {
    const next = this.player.removeWeapon(weapon.id);
    const suffix = next && next.id !== weapon.id ? ` · 切换 ${next.name}` : '';
    this.showPickupToast(`${weapon.name} 弹药耗尽${suffix}`, '#ff8a93');
    this.sfx.empty();
  }

  showPickupToast(text, color) {
    this.pickupToast = {
      text,
      color: color || '#dfe9f5',
      until: this.currentTime + 1600,
    };
  }

  damagePlayer() {
    this.lives--;
    this.addScreenShake(20, 10);
    this.addHitStop(65);
    this.damageFlash = 1;
    this.sfx.hurt();
    this.player.hurt(this.currentTime);
    if (this.onLivesChange) this.onLivesChange(this.lives);
  }

  spawnBoss() {
    if (!this.level.boss || this.bossSpawned) return;
    if (this.player.x > this.level.boss.x - 380) {
      this.bossSpawned = true;
      this.boss = new Boss(this.level.boss.x, GameConfig.GROUND_Y, this.level.boss.hp);
      this.boss.awake = true;
      this.enemies.push(this.boss);
    }
  }

  addScreenShake(duration, intensity) {
    this.screenShake = Math.max(this.screenShake, duration);
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
  }

  addHitStop(ms) {
    this.hitStop = Math.max(this.hitStop, ms);
  }

  checkGameState() {
    if (this.lives <= 0) {
      this.state = GameState.GAME_OVER;
      if (this.onStateChange) this.onStateChange(this.state);
      return;
    }
    if (!this.level.boss && this.enemies.length === 0 &&
        this.player.x >= this.level.worldWidth - this.logicalW * 0.5) {
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  // ============================================================
  // 渲染：逻辑画布 480x270 → 整数 3x 放大 → 主画布 1440x810
  // 顺序：远景 → 世界（地面/平台/角色/特效）→ 前景+雨 → 后期 → HUD
  // ============================================================
  render() {
    const ctx = this.lctx; // 逻辑画布上下文
    ctx.imageSmoothingEnabled = false;

    // 屏幕震动（逻辑空间内，只作用于世界层）
    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShakeIntensity;
      shakeY = (Math.random() - 0.5) * this.screenShakeIntensity;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.logicalW, this.logicalH);

    if (!this.loadingDone) {
      this.drawLoadingScreen(ctx);
      this.compositeToScreen();
      return;
    }

    // 背景视差（关卡加载后）
    if (this.level) {
      this.sceneRenderer.drawBackdrop(ctx, this.cameraX, this.level);
    } else {
      ctx.fillStyle = '#0a0a1e';
      ctx.fillRect(0, 0, this.logicalW, this.logicalH);
    }

    const showWorld = this.state === GameState.PLAYING ||
                      this.state === GameState.PAUSED ||
                      this.state === GameState.GAME_OVER ||
                      this.state === GameState.VICTORY;

    if (showWorld && this.player && this.level) {
      ctx.save();
      ctx.translate(-Math.round(this.cameraX) + shakeX, shakeY);

      // 地面层：与世界共用 -cameraX 平移，避免视差被扣两次
      this.sceneRenderer.drawGround(ctx, this.cameraX);
      // 湿地霓虹光池 + 街道小物（都在地面之后、角色之前）
      this.sceneRenderer.drawWetGlow(ctx, this.cameraX);
      this.sceneRenderer.drawStreetProps(ctx, this.cameraX, this.level);

      // 平台（浮空平台）
      this.drawPlatforms(ctx);

      // 掩体
      for (const c of this.level.covers) {
        if (this.isVisible(c.x, c.w)) c.draw(ctx);
      }

      // 掉落物：在角色之后、敌人之前，避免遮住战斗主体
      for (const pk of this.pickups) {
        if (this.isVisible(pk.x, pk.w)) pk.draw(ctx, this.currentTime);
      }

      for (const g of this.grenades) g.draw(ctx);
      for (const b of this.bullets) b.draw(ctx);
      for (const e of this.enemies) {
        if (e.awake && this.isVisible(e.x, e.width)) e.draw(ctx, this.currentTime);
      }
      this.player.draw(ctx, this.currentTime, this.cameraX);

      // 粒子 & 特效（特效最后绘制，叠加混合发光）
      this.particleSystem.draw(ctx);
      this.effectSystem.draw(ctx);

      ctx.restore();
    }

    // 前景剪影、雨、贴地雾：盖在世界和角色之上
    if (this.level) {
      this.sceneRenderer.drawForeground(ctx, this.cameraX, this.level);
    }

    if (showWorld && this.player) {
      this.drawCanvasHud(ctx);
    }

    // MENU 状态：绘制霓虹标题字
    if (this.state === GameState.MENU) {
      this.drawTitle(ctx);
    }

    // GAME_OVER / VICTORY：绘制霓虹结算面板背景
    if (this.state === GameState.GAME_OVER || this.state === GameState.VICTORY) {
      this.drawResultPanel(ctx);
    }

    // 暗角、受伤红闪、CRT 扫描线统一在这一步叠加
    this.drawPostFx(ctx);

    this.compositeToScreen();
  }

  drawPostFx(ctx) {
    if (this.damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 24, 64, ${0.20 * this.damageFlash})`;
      ctx.fillRect(0, 0, this.logicalW, this.logicalH);
      ctx.strokeStyle = `rgba(255, 60, 80, ${0.55 * this.damageFlash})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, this.logicalW - 2, this.logicalH - 2);
    }

    if (this.vignetteCanvas) {
      ctx.drawImage(this.vignetteCanvas, 0, 0);
    }

    // CRT 扫描线：低调一点，避免糊掉 1px 像素细节
    if (this.crtCanvas) {
      ctx.globalAlpha = 0.055;
      const pattern = ctx.createPattern(this.crtCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, this.logicalW, this.logicalH);
      }
      ctx.globalAlpha = 1;
    }
  }

  createVignette() {
    const c = document.createElement('canvas');
    c.width = this.logicalW;
    c.height = this.logicalH;
    const v = c.getContext('2d');
    const g = v.createRadialGradient(
      this.logicalW / 2, this.logicalH / 2, this.logicalH * 0.30,
      this.logicalW / 2, this.logicalH / 2, this.logicalH * 0.82,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.62, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.52)');
    v.fillStyle = g;
    v.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // 霓虹标题字（ui_title 精灵 + 脉冲光晕）
  drawTitle(ctx) {
    const titleImg = getUi('title');
    if (!titleImg) return;
    const tw = 256, th = 51;
    const tx = (this.logicalW - tw) / 2;
    const ty = 70;
    // 脉冲光晕
    const pulse = 0.5 + 0.5 * Math.sin(this.currentTime / 300);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.drawImage(titleImg, tx - 4, ty - 2, tw + 8, th + 4);
    ctx.globalAlpha = 0.15;
    ctx.drawImage(titleImg, tx - 8, ty - 4, tw + 16, th + 8);
    ctx.restore();
    ctx.drawImage(titleImg, tx, ty, tw, th);
  }

  // 霓虹结算面板（ui_panel 精灵）
  drawResultPanel(ctx) {
    const panelImg = getUi('panel');
    if (!panelImg) return;
    const pw = 256, ph = 160;
    const px = (this.logicalW - pw) / 2;
    const py = (this.logicalH - ph) / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(panelImg, px, py, pw, ph);
    ctx.restore();
    // 面板内标题
    const victory = this.state === GameState.VICTORY;
    ctx.fillStyle = victory ? '#39ff88' : '#ff4757';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(victory ? 'VICTORY' : 'GAME OVER', this.logicalW / 2, py + 40);
    ctx.fillStyle = '#00e5ff';
    ctx.font = '9px monospace';
    ctx.fillText(`关卡 ${this.currentLevel}`, this.logicalW / 2, py + 64);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`得分 ${this.score}`, this.logicalW / 2, py + 82);
    ctx.fillStyle = '#ff8ac4';
    ctx.fillText(`消灭暴徒 ${this.totalKills}`, this.logicalW / 2, py + 100);
    ctx.textAlign = 'left';
  }

  // 合成到主画布：整数 3x 放大，保持 1px 网格锐利
  compositeToScreen() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.logicalW * this.scale, this.logicalH * this.scale);
  }

  drawLoadingScreen(ctx) {
    ctx.fillStyle = '#06071a';
    ctx.fillRect(0, 0, this.logicalW, this.logicalH);
    // 标题
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('霓虹猎杀', this.logicalW / 2, this.logicalH / 2 - 30);
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px monospace';
    ctx.fillText('NEON HUNTDOWN', this.logicalW / 2, this.logicalH / 2 - 14);
    // 进度条
    const bw = 200, bh = 8;
    const bx = (this.logicalW - bw) / 2;
    const by = this.logicalH / 2 + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(bx, by, bw * this.loadProgress, bh);
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#8a9bb5';
    ctx.font = '8px monospace';
    ctx.fillText(`LOADING... ${Math.floor(this.loadProgress * 100)}%`, this.logicalW / 2, by + 22);
    ctx.textAlign = 'left';
  }

  isVisible(x, w) {
    return x + w > this.cameraX - 40 && x < this.cameraX + this.logicalW + 40;
  }

  drawPlatforms(ctx) {
    const neon = this.level.id === 2 ? '#2ee6c8' : (this.level.id === 3 ? '#ff2e4a' : '#00e5ff');
    for (const p of this.level.platforms) {
      if (!this.isVisible(p.x, p.w)) continue;
      if (p.y >= GameConfig.GROUND_Y) continue; // 地面由背景 ground 层绘制

      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const w = Math.round(p.w);
      const h = Math.max(7, Math.round(p.h));

      // 平台落在背景上的投影
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x + 5, y + h + 5, w - 10, 3);

      // 主体钢板
      ctx.fillStyle = '#080a10';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#232a38';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(x + 1, y + h - 2, w - 2, 1);

      // 顶面高光 / 走道边
      ctx.fillStyle = '#7b8ca3';
      ctx.fillRect(x + 1, y, w - 2, 1);
      ctx.fillStyle = '#465368';
      ctx.fillRect(x + 1, y + 1, w - 2, 1);
      ctx.fillStyle = '#0e121b';
      ctx.fillRect(x + 1, y + 2, w - 2, 1);

      // 防滑纹：交错短横线
      for (let sx = x + 4; sx < x + w - 4; sx += 7) {
        ctx.fillStyle = ((sx - x) / 7 | 0) % 2 ? '#344054' : '#2b3446';
        ctx.fillRect(sx, y + 4 + (((sx - x) / 7 | 0) % 2), 3, 1);
      }

      // 侧梁 + 铆钉
      ctx.fillStyle = '#394456';
      ctx.fillRect(x, y + 2, 2, h - 3);
      ctx.fillRect(x + w - 2, y + 2, 2, h - 3);
      ctx.fillStyle = '#6b7c94';
      for (let sx = x + 8; sx < x + w - 6; sx += 18) {
        ctx.fillRect(sx, y + 3, 1, 1);
      }

      // 底部霓虹灯带（关卡配色）
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x + 3, y + h - 2, w - 6, 2);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = neon;
      ctx.fillRect(x + 5, y + h - 1, w - 10, 1);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x + 5, y + h, w - 10, 2);
      ctx.globalAlpha = 1;

      // 下方桁架支撑
      const bottom = y + h;
      for (let sx = x + 9; sx < x + w - 8; sx += 26) {
        ctx.fillStyle = '#080a10';
        ctx.fillRect(sx, bottom, 3, 8);
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(sx + 1, bottom, 1, 7);
        ctx.fillRect(sx - 2, bottom + 7, 7, 1);
        // 斜撑
        ctx.fillStyle = '#1d2432';
        ctx.fillRect(sx + 3, bottom, 1, 3);
        ctx.fillRect(sx + 4, bottom + 3, 1, 2);
        ctx.fillRect(sx + 5, bottom + 5, 1, 2);
      }

      // 两端吊索
      ctx.fillStyle = 'rgba(10,14,22,0.85)';
      ctx.fillRect(x + 2, y - 5, 1, 5);
      ctx.fillRect(x + w - 3, y - 5, 1, 5);
      ctx.fillStyle = 'rgba(120,140,165,0.45)';
      ctx.fillRect(x + 2, y - 4, 1, 1);
      ctx.fillRect(x + w - 3, y - 4, 1, 1);
    }
  }

  drawCanvasHud(ctx) {
    // 顶部推进线：只留 1px 霓虹，不遮挡视野
    const prog = clamp(this.player.x / this.level.worldWidth, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.logicalW, 3);
    ctx.fillStyle = '#0c121a';
    ctx.fillRect(0, 1, this.logicalW, 1);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(0, 1, this.logicalW * prog, 1);
    ctx.fillStyle = '#ffb0d2';
    ctx.fillRect(Math.max(0, this.logicalW * prog - 2), 1, 2, 1);

    // BOSS 血条：切角金属框 + 分段刻度，取代原来头顶小血条
    if (this.boss && !this.boss.dead && this.boss.awake) {
      const bw = 190;
      const bh = 7;
      const bx = Math.round((this.logicalW - bw) / 2);
      const by = 19;
      const ratio = clamp(this.boss.hp / this.boss.maxHp, 0, 1);

      ctx.save();
      // 标题
      ctx.fillStyle = 'rgba(4, 4, 10, 0.78)';
      ctx.fillRect(this.logicalW / 2 - 52, by - 11, 104, 9);
      ctx.fillStyle = 'rgba(255, 186, 216, 0.98)';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GANG LORD // 帮派首领', this.logicalW / 2, by - 4);
      ctx.textAlign = 'left';

      // 切角底板
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(bx - 4, by - 2, bw + 8, bh + 4);
      ctx.fillRect(bx - 2, by - 3, bw + 4, bh + 6);
      ctx.fillStyle = '#2a3444';
      ctx.fillRect(bx - 3, by - 1, bw + 6, 1);
      ctx.fillRect(bx - 3, by + bh, bw + 6, 1);

      // 槽
      ctx.fillStyle = '#180a14';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#3a1630';
      ctx.fillRect(bx, by, bw, 1);

      // 血量
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(bx, by + 1, Math.round(bw * ratio), bh - 2);
      ctx.fillStyle = '#ff7d5c';
      ctx.fillRect(bx, by + 2, Math.round(bw * ratio), 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(bx, by + 1, Math.round(bw * ratio), 1);

      // 分段刻度
      ctx.fillStyle = 'rgba(8, 6, 12, 0.7)';
      for (let i = 1; i < 4; i++) {
        ctx.fillRect(bx + Math.round(bw * i / 4), by, 1, bh);
      }
      if (ratio > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + Math.round(bw * ratio) - 1, by, 1, bh);
      }
      ctx.restore();
    }

    this.drawWeaponHud(ctx);
    this.drawControlHints(ctx);
    this.drawPickupToast(ctx);
  }

  // 左下角：非触屏设备显示按键提示；接入手柄后自动换成手柄按键
  drawControlHints(ctx) {
    if (this.state !== GameState.PLAYING) return;
    const pad = this.input.isPadConnected();
    if (!pad && this.input.isTouchEnabled()) return;

    const lines = pad
      ? ['摇杆 移动 · A 跳 · B 蹲',
         'X/RT 射击 · Y/RB 切枪',
         'LB 手雷 · R3 劈砍 · Start 暂停']
      : ['A/D 移动 · W 跳 · S 蹲',
         '空格 射击 · Q 切枪 · X 劈砍',
         'G 手雷 · Esc 暂停'];

    ctx.save();
    ctx.font = '6px monospace';
    ctx.textAlign = 'left';
    let maxW = 0;
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);

    const lineH = 8;
    const panelW = Math.ceil(maxW) + 11;
    const panelH = lines.length * lineH + 5;
    const px = 5;
    const py = this.logicalH - panelH - 4;

    ctx.fillStyle = 'rgba(3,7,12,0.78)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.fillStyle = pad ? '#39ff88' : '#5fe6ff';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(px, py, 1, panelH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px + 1, py, panelW - 1, 1);

    ctx.fillStyle = pad ? '#b6ffcf' : '#b5e1ff';
    lines.forEach((line, i) => {
      ctx.fillText(line, px + 5, py + 9 + i * lineH);
    });
    ctx.restore();
  }

  // 底部中央：当前武器 + 余弹 + 背包槽（只在有弹药的武器之间切换）
  drawWeaponHud(ctx) {
    const p = this.player;
    if (!p) return;
    const w = p.getWeapon();
    if (!w) return;
    const ammo = p.ammo[w.id];
    const panelW = 154;
    const panelH = 22;
    const px = Math.round((this.logicalW - panelW) / 2);
    const py = this.logicalH - panelH - 4;

    ctx.save();
    // 切角面板
    ctx.fillStyle = 'rgba(2,5,9,0.80)';
    ctx.fillRect(px + 2, py, panelW - 4, panelH);
    ctx.fillRect(px, py + 2, panelW, panelH - 4);
    ctx.fillStyle = 'rgba(8,15,23,0.92)';
    ctx.fillRect(px + 2, py + 2, panelW - 4, panelH - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px + 2, py, panelW - 4, 1);
    ctx.fillRect(px + 2, py + panelH - 1, panelW - 4, 1);
    ctx.fillStyle = w.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(px, py + 2, 1, panelH - 4);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(px + 2, py + panelH - 2, panelW - 4, 1);
    ctx.globalAlpha = 1;

    // 武器小图标
    this.drawWeaponGlyph(ctx, w, px + 7, py + 7, w.color);

    // 名称
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '6px monospace';
    ctx.fillText(w.name, px + 24, py + 10);

    // 弹药
    const low = !w.infiniteAmmo && ammo <= 10;
    const ammoText = w.infiniteAmmo ? '∞' : String(ammo);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5b6b7e';
    ctx.font = '5px monospace';
    ctx.fillText('AMMO', px + 100, py + 7);
    ctx.fillStyle = low ? '#ff5a5a' : w.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(ammoText, px + 100, py + 18);

    // 分隔线
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px + 104, py + 4, 1, panelH - 8);

    // 背包槽
    let sx = px + 109;
    const sy = py + 4;
    for (const id of p.weaponIds) {
      const cfg = GameConfig.WEAPONS.find((item) => item.id === id);
      if (!cfg) continue;
      const active = id === w.id;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.035)';
      ctx.fillRect(sx, sy, 12, 14);

      ctx.globalAlpha = active ? 1 : 0.55;
      ctx.fillStyle = cfg.color;
      ctx.fillRect(sx, sy, 12, 2);
      ctx.fillRect(sx + 2, sy + 6, 8, 1);
      ctx.fillRect(sx + 4, sy + 7, 3, 2);
      ctx.globalAlpha = 1;

      const cellAmmo = cfg.infiniteAmmo ? '∞' : String(p.ammo[id] ?? 0);
      ctx.textAlign = 'right';
      ctx.font = '5px monospace';
      ctx.fillStyle = active ? '#ffffff' : '#7c8fa3';
      ctx.fillText(cellAmmo, sx + 11, sy + 13);

      if (active) {
        ctx.fillStyle = '#e9f7ff';
        ctx.fillRect(sx, sy, 12, 1);
        ctx.fillRect(sx, sy + 13, 12, 1);
        ctx.fillRect(sx, sy, 1, 14);
        ctx.fillRect(sx + 11, sy, 1, 14);
      }
      sx += 14;
    }
    ctx.restore();
  }

  drawWeaponGlyph(ctx, weapon, x, y, color) {
    ctx.save();
    ctx.fillStyle = '#05090e';
    ctx.fillRect(x - 1, y - 1, 13, 10);
    ctx.fillStyle = color;
    if (weapon.id === 'rifle') {
      ctx.fillRect(x, y + 2, 10, 2);
      ctx.fillRect(x + 8, y + 3, 4, 1);
      ctx.fillRect(x + 1, y + 4, 3, 3);
      ctx.fillRect(x + 5, y + 4, 2, 3);
      ctx.fillStyle = '#dff8ff';
      ctx.fillRect(x, y + 2, 9, 1);
    } else if (weapon.id === 'plasma') {
      ctx.fillRect(x, y + 2, 11, 4);
      ctx.fillStyle = '#1a5c39';
      ctx.fillRect(x + 3, y + 3, 5, 3);
      ctx.fillStyle = '#d9ffe8';
      ctx.fillRect(x + 5, y + 4, 2, 1);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + 1, 2, 1);
      ctx.fillRect(x + 9, y + 1, 2, 1);
    } else {
      ctx.fillRect(x, y + 1, 8, 2);
      ctx.fillRect(x + 1, y + 3, 3, 4);
      ctx.fillRect(x + 5, y + 3, 2, 1);
      ctx.fillStyle = '#fff6c2';
      ctx.fillRect(x, y + 1, 7, 1);
    }
    ctx.restore();
  }

  drawPickupToast(ctx) {
    if (!this.pickupToast) return;
    const remain = this.pickupToast.until - this.currentTime;
    if (remain <= 0) {
      this.pickupToast = null;
      return;
    }
    const alpha = Math.min(1, remain / 260);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    const tw = Math.ceil(ctx.measureText(this.pickupToast.text).width);
    const cx = this.logicalW / 2;
    const ty = 39;
    ctx.fillStyle = 'rgba(2,5,9,0.82)';
    ctx.fillRect(cx - tw / 2 - 6, ty - 8, tw + 12, 11);
    ctx.fillStyle = this.pickupToast.color;
    ctx.fillRect(cx - tw / 2 - 6, ty - 8, 1, 11);
    ctx.fillRect(cx + tw / 2 + 5, ty - 8, 1, 11);
    ctx.fillStyle = this.pickupToast.color;
    ctx.fillText(this.pickupToast.text, cx, ty);
    ctx.restore();
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}
