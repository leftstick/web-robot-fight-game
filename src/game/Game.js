import { GameConfig } from '../config/gameConfig.js';
import { Player } from './Player.js';
import { Thug, Boss, createEnemy } from './Enemy.js';
import { ParticleSystem } from './Particle.js';
import { EffectSystem } from './Effects.js';
import { SceneRenderer } from './SceneRenderer.js';
import { Level, loadLevels } from './Level.js';
import { Cover } from './Cover.js';
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
    this.bossArena = null;
    this.bossIntroUntil = 0;
    this.bossDeath = null;
    this.cinematic = null;          // null | bossIntro | bossDeath
    this.shockwaves = [];
    this.arenaPlatformsAdded = false;

    // 关卡节奏：分区遭遇、检查点、场景机关
    this.encounterIndex = 0;
    this.activeEncounter = null;
    this.totalEnemyCount = 0;
    this.encounterGateFlash = 0;
    this.encounterGateFlashX = null;

    // 结算统计
    this.levelStartedAt = 0;
    this.clearTime = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.damageTaken = 0;

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
    this.whiteFlash = 0;

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
    this.onBossIntro = null;
    this.onBossIntroEnd = null;
    this.onBossPhase = null;
    this.onBossDeath = null;

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
    this.bossArena = null;
    this.bossIntroUntil = 0;
    this.bossDeath = null;
    this.cinematic = null;
    this.shockwaves = [];
    this.arenaPlatformsAdded = false;
    this.encounterIndex = 0;
    this.activeEncounter = null;
    this.totalEnemyCount = this.level.totalEnemies || 0;
    this.encounterGateFlash = 0;
    this.encounterGateFlashX = null;
    this.levelStartedAt = performance.now();
    this.clearTime = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.damageTaken = 0;
    this.particleSystem.clear();
    this.effectSystem.clear();
    this.screenShake = 0;
    this.hitStop = 0;
    this.damageFlash = 0;
    this.whiteFlash = 0;
    this.cameraX = clamp(this.level.playerSpawn.x - this.logicalW * 0.4, 0, this.level.worldWidth - this.logicalW);

    this.player = new Player(this.level.playerSpawn.x);
    // 敌人按遭遇波次生成，不再开场全量铺满
    this.enemies = [];

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
    const remaining = Math.max(0, this.totalEnemyCount - this.totalKills);
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

    // Boss 演出与阶段计时不受命中停顿影响，保证死亡/入场流程完整播完
    if (this.state === GameState.PLAYING) this.updateCinematic();

    if (this.whiteFlash > 0) {
      this.whiteFlash = Math.max(0, this.whiteFlash - this.deltaTime / 240);
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - this.deltaTime / 420);
    }

    const fxDelta = frozen ? this.deltaTime * 0.25 : this.deltaTime;
    this.particleSystem.update(fxDelta);
    this.effectSystem.update(fxDelta);

    for (const c of (this.level ? this.level.covers : [])) c.update(this.deltaTime);

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

    // Boss 入场 / 死亡演出期间锁住战斗输入，但世界继续更新
    if (this.cinematic) input = this.neutralInput(input);

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
        const w = fire.weapon;
        const b = p.createBullet(w);
        this.bullets.push(b);
        this.shotsFired++;
        // 枪口特效对准精灵里的实际枪管位置
        const muzzle = p.getMuzzle();
        this.effectSystem.muzzleFlash(muzzle.x, muzzle.y, p.facing, w.muzzleScale || 0.5, w.muzzleTint || null);
        if (w.bulletStyle === 'plasma') {
          // 等离子不抛壳，改喷一圈绿色粒子
          this.particleSystem.createExplosion(muzzle.x, muzzle.y, w.color, 5);
        } else {
          this.effectSystem.shell(muzzle.x - p.facing * 4, muzzle.y, p.facing * 1.5, -1.5);
        }
        if (w.fireShake) this.addScreenShake(w.fireShake, w.fireShake);
        this.sfx.shoot(w.sfx || w.id);
        if (fire.emptied) this.onWeaponEmpty(w);
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

    // 分区遭遇：触发刷怪、清空开闸，未清场时玩家被挡在闸门前
    this.updateEncounters();
    if (this.activeEncounter && this.activeEncounter.gateX != null) {
      p.x = Math.min(p.x, this.activeEncounter.gateX - p.width - 2);
    }

    // Boss 竞技场封锁：玩家不能越过两侧能量闸门
    if (this.bossArena) {
      p.x = clamp(p.x, this.bossArena.x1 + 2, this.bossArena.x2 - p.width - 2);
    }

    if (this.encounterGateFlash > 0) {
      this.encounterGateFlash = Math.max(0, this.encounterGateFlash - this.deltaTime);
    }

    this.updateCamera();
    this.updateBullets(dtf);
    this.updateEnemies(dtf);
    this.updateShockwaves(dtf);
    this.updateHazards();
    this.updateCheckpoints();
    this.updatePickups(dtf);
    this.updateGrenades(dtf);
    this.spawnBoss();

    // 劈砍碰撞检测（在敌人更新后）
    this.resolveMelee();

    this.checkGameState();
  }

  neutralInput(input) {
    return {
      ...input,
      moveLeft: false,
      moveRight: false,
      aim: false,
      crouch: false,
      jump: false,
      shoot: false,
      grenade: false,
      switchWeapon: false,
      melee: false,
    };
  }

  // —— 分区遭遇：踩到 triggerX 刷出整波敌人，清空后闸门放行 ——
  updateEncounters() {
    if (!this.level || !this.level.encounters) return;
    if (this.bossArena || this.bossSpawned) return;

    const enc = this.activeEncounter;
    if (!enc) {
      const next = this.level.encounters[this.encounterIndex];
      if (next && this.player.x >= next.triggerX) this.beginEncounter(next);
      return;
    }

    const alive = this.enemies.some((e) => !e.dead && e.encounterId === enc.id);
    if (!alive) this.clearEncounter(enc);
  }

  beginEncounter(enc) {
    this.activeEncounter = enc;
    for (const s of enc.spawns) {
      const y = s.y != null ? s.y : GameConfig.GROUND_Y;
      const enemy = createEnemy(s.type, s.x, y, s.elite);
      enemy.awake = true;
      enemy.encounterId = enc.id;
      this.enemies.push(enemy);
      this.effectSystem.explosion(s.x, y - 16);
      this.particleSystem.createExplosion(s.x, y - 16, '#ff2e88', 8);
    }
    const zone = this.encounterIndex + 1;
    const label = enc.label ? ` · ${enc.label}` : '';
    this.showPickupToast(`ZONE ${zone}${label}`, '#ff2e88');
    this.addScreenShake(8, 4);
    this.sfx.gate();
  }

  clearEncounter(enc) {
    this.activeEncounter = null;
    this.encounterIndex++;
    this.encounterGateFlash = 650;
    this.encounterGateFlashX = enc.gateX;
    this.addScore(100);
    this.showPickupToast('区域清空 · 闸门开启', '#39ff88');
    this.sfx.gate();
  }

  // —— 蒸汽口：周期性预警 → 喷发，站上去会掉血 ——
  hazardPhase(index, t) {
    return ((t + index * 900) % 4200) / 4200;
  }

  updateHazards() {
    if (!this.level || !this.level.hazards) return;
    const p = this.player;
    for (let i = 0; i < this.level.hazards.length; i++) {
      const h = this.level.hazards[i];
      const phase = this.hazardPhase(i, this.currentTime);
      const active = phase >= 0.5 && phase < 0.72;
      if (active && !h.wasActive) this.sfx.steam();

      if (active && !p.isInvincibleNow(this.currentTime)) {
        const rect = { x: h.x, y: GameConfig.GROUND_Y - 26, width: h.w, height: 26 };
        if (aabb(rect, p.getBounds())) {
          this.damagePlayer();
          this.addScreenShake(6, 4);
        }
      }
      h.wasActive = active;
    }
  }

  // —— 检查点：首次经过恢复 1 点生命 ——
  updateCheckpoints() {
    if (!this.level || !this.level.checkpoints) return;
    const p = this.player;
    const pb = p.getBounds();
    for (const cp of this.level.checkpoints) {
      if (cp.used) continue;
      const rect = { x: cp.x - 10, y: GameConfig.GROUND_Y - 44, width: 20, height: 44 };
      if (!aabb(pb, rect)) continue;
      cp.used = true;
      cp.usedAt = this.currentTime;
      if (this.lives < GameConfig.PLAYER.lives) {
        this.lives++;
        if (this.onLivesChange) this.onLivesChange(this.lives);
        this.showPickupToast('检查点 · 生命 +1', '#39ff88');
      } else {
        this.addScore(50);
        this.showPickupToast('检查点 · 安全区', '#39ff88');
      }
      this.sfx.pickup();
    }
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
    // Boss 竞技场：镜头锁死在闸门范围内，不再跟随玩家
    if (this.bossArena) {
      const target = this.bossArena.x1;
      this.cameraX += (target - this.cameraX) * 0.16;
      this.cameraX = clamp(this.cameraX, 0, this.level.worldWidth - this.logicalW);
      return;
    }
    const target = this.player.x + this.player.width / 2 - this.logicalW * 0.4;
    const clamped = clamp(target, 0, this.level.worldWidth - this.logicalW);
    this.cameraX += (clamped - this.cameraX) * 0.16;
    this.cameraX = clamp(this.cameraX, 0, this.level.worldWidth - this.logicalW);
  }

  updateBullets(dtf) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b) continue;
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
        const hx = b.x + b.width / 2;
        const hy = b.y + b.height / 2;
        this.bulletImpactFx(b, hx, hy);
        this.addHitStop(b.hitStop);
        if (c.takeDamage(b.damage)) this.destroyCover(c);
        return;
      }
    }

    if (b.owner === BulletOwner.PLAYER) {
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        if (e.dead) continue;
        if (aabb(bb, e.getBounds())) {
          b.active = false;
          const hx = b.x + b.width / 2;
          const hy = b.y + b.height / 2;
          this.shotsHit++;
          const prevPhase = e === this.boss ? e.phase : 0;
          const multiplier = e.damageMultiplierAt ? e.damageMultiplierAt(hx, hy) : 1;
          this.bulletImpactFx(b, hx, hy);
          if (multiplier > 1) {
            // 弱点命中：金色爆点 + 额外顿帧，让玩家知道打对了地方
            this.effectSystem.explosion(hx, hy);
            this.particleSystem.createExplosion(hx, hy, '#ffe066', 14);
            this.addHitStop(45);
            this.addScreenShake(7, 5);
          } else {
            this.effectSystem.blood(hx, hy);
          }
          const died = e.takeDamage(b.damage * multiplier, this.currentTime);
          this.addScreenShake(b.impactShake, b.impactShakeIntensity);
          this.addHitStop(died ? 85 : b.hitStop);
          if (!died && e === this.boss && e.phase !== prevPhase) {
            this.handleBossPhase(e.phase);
          }
          if (died) this.killEnemy(e);
          if (b.splashRadius > 0) this.applySplash(b, hx, hy, e);
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

  // 命中特效按弹种区分：等离子带绿色爆炸，实弹只有火花
  bulletImpactFx(b, x, y) {
    this.effectSystem.hitSparks(x, y);
    this.particleSystem.createHitEffect(x, y, b.color);
    if (b.splashRadius > 0) {
      this.effectSystem.explosion(x, y);
      this.particleSystem.createExplosion(x, y, b.color, 12);
    }
  }

  // 等离子溅射：只伤及直接命中目标之外的敌人，避免同一发吃两次伤害
  applySplash(b, cx, cy, primary) {
    for (const e of this.enemies) {
      if (e.dead || e === primary) continue;
      const ex = e.x + e.width / 2;
      const ey = e.y + e.height / 2;
      if (Math.hypot(ex - cx, ey - cy) > b.splashRadius + e.width * 0.5) continue;
      const died = e.takeDamage(b.splashDamage);
      this.particleSystem.createHitEffect(ex, ey, b.color);
      if (died) this.killEnemy(e);
    }
  }

  releaseCoverClaims(cover) {
    for (const e of this.enemies) {
      if (e.cover === cover) e.cover = null;
    }
  }

  // 掩体破碎统一入口：特效 + 释放掩体占用 + 隐藏补给掉落
  destroyCover(cover) {
    const cc = cover.getCenter();
    this.effectSystem.explosion(cc.x, cc.y);
    this.particleSystem.createExplosion(cc.x, cc.y, '#ffb347', 10);
    this.addScreenShake(12, 6);
    this.addHitStop(55);
    this.sfx.explosion();
    this.releaseCoverClaims(cover);

    if (cover.loot) {
      const pk = this.spawnPickup(cover.loot, cc.x, GameConfig.GROUND_Y);
      if (pk) {
        this.showPickupToast('发现隐藏补给', '#ffe066');
        this.sfx.pickup();
      }
    }
  }

  updateEnemies(dtf) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        if (e === this.boss) {
          // Boss 死亡演出期间保留尸体，按慢动作推进死亡帧
          if (this.bossDeath) {
            e.deathTime += this.deltaTime * 0.42;
            continue;
          }
          continue;
        }
        e.deathTime += this.deltaTime;
        if (e.deathTime > 600) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // 死亡演出期间冻结其他敌人，避免抢戏或补刀
      if (this.bossDeath) continue;

      if (!e.awake) {
        if (e.x < this.cameraX + this.logicalW + 70) e.awake = true;
        else continue;
      }
      if (e.cover && e.cover.hp <= 0) e.cover = null;

      const result = e.update(dtf, this.deltaTime, this.currentTime, this.world, this.player);
      if (Array.isArray(result)) {
        for (const b of result) this.bullets.push(b);
        const c = e.corePoint || e.getMuzzle();
        this.effectSystem.muzzleFlash(c.x, c.y, e.facing, 0.85, '#ff2e88');
        this.sfx.enemyShoot();
      } else if (result) {
        this.bullets.push(result);
        // 敌人枪口火焰（与精灵枪管对齐）
        const muzzle = e.getMuzzle();
        this.effectSystem.muzzleFlash(muzzle.x, muzzle.y, e.facing);
        this.playEnemyShotSfx(result);
      }
      if (e.hitFlash > 0) e.hitFlash -= this.deltaTime;

      // Boss 震地 / 二阶段召唤 / 点射预警
      if (e === this.boss) {
        if (e.consumeAimSfx && e.consumeAimSfx()) this.sfx.bossAim();
        if (e.consumeShockwave && e.consumeShockwave()) this.triggerBossShockwave(e);
        const summonCount = e.consumeSummon ? e.consumeSummon() : 0;
        if (summonCount > 0) this.summonBossAdds(summonCount);
      }

      // Boss 冲撞接触伤害
      if (e.tryChargeHit && e.tryChargeHit(this.player, this.currentTime)) {
        if (!this.player.isInvincibleNow(this.currentTime)) {
          this.damagePlayer();
          this.addScreenShake(14, 8);
        }
      }
    }
  }

  // 敌人子弹可携带专属枪声（狙击弹），其余沿用通用敌方枪声
  playEnemyShotSfx(bullet) {
    if (bullet.sfx && typeof this.sfx[bullet.sfx] === 'function') {
      this.sfx[bullet.sfx]();
    } else {
      this.sfx.enemyShoot();
    }
  }

  triggerBossShockwave(boss) {
    const cx = boss.getCenterX();
    for (const dir of [-1, 1]) {
      this.shockwaves.push({
        x: cx, dir, speed: 2.3, age: 0, life: 1700, hit: false,
      });
    }
    this.effectSystem.explosion(cx, GameConfig.GROUND_Y - 8);
    this.particleSystem.createExplosion(cx, GameConfig.GROUND_Y - 8, '#ff8a3d', 18);
    this.addScreenShake(18, 9);
    this.addHitStop(60);
    this.sfx.slam();
  }

  updateShockwaves(dtf) {
    const p = this.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.age += this.deltaTime;
      w.x += w.dir * w.speed * dtf;

      if (!w.hit) {
        const rect = { x: w.x - 5, y: GameConfig.GROUND_Y - 18, width: 10, height: 18 };
        if (aabb(rect, p.getBounds())) {
          w.hit = true;
          if (!p.isInvincibleNow(this.currentTime)) {
            this.damagePlayer();
            this.addHitStop(45);
          }
        }
      }

      if (w.age > w.life || w.x < this.bossArena?.x1 - 10 || w.x > this.bossArena?.x2 + 10) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  summonBossAdds(count) {
    if (!this.bossArena) return;
    const arena = this.bossArena;
    const spots = [arena.x1 + 48, arena.x2 - 48, arena.x1 + 120, arena.x2 - 120];
    for (let i = 0; i < count; i++) {
      if (this.enemies.length > 8) break;
      const x = spots[i % spots.length];
      const thug = new Thug(x, GameConfig.GROUND_Y);
      thug.awake = true;
      this.enemies.push(thug);
      this.effectSystem.explosion(x, GameConfig.GROUND_Y - 18);
      this.particleSystem.createExplosion(x, GameConfig.GROUND_Y - 18, '#ff2e88', 10);
    }
    this.showPickupToast('增援抵达', '#ff8a93');
    this.sfx.enemyShoot();
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
        this.destroyCover(cov);
      }
    }
  }

  killEnemy(e) {
    e.dead = true;
    this.addScore(e.score);
    this.totalKills++;
    this.emitRemaining(false);

    if (e === this.boss) {
      this.beginBossDeath(e);
      return;
    }

    const c = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    this.effectSystem.blood(c.x, c.y);
    this.effectSystem.spawn('debris', c.x, c.y + 6, { scale: 0.4, frameDuration: 60, additive: false });
    this.particleSystem.createExplosion(c.x, c.y, '#ff5a5a', 16);
    this.addScreenShake(11, 6);
    this.addHitStop(85);
    this.sfx.explosion();
    this.spawnLoot(e);
  }

  beginBossDeath(boss) {
    boss.deathTime = 0;
    this.bossDeath = {
      elapsed: 0,
      duration: 3200,
      nextExplosion: 0,
      count: 0,
      bigBoom: false,
    };
    this.cinematic = 'bossDeath';
    this.shockwaves = [];
    // 不能重建数组：这里可能在 updateBullets 的循环中被调用，
    // 替换 this.bullets 会让循环索引越界，导致整帧抛错卡死。
    for (const b of this.bullets) {
      if (b.owner === BulletOwner.ENEMY) b.active = false;
    }
    this.addScreenShake(26, 13);
    this.addHitStop(180);
    this.whiteFlash = 0.75;
    this.sfx.explosion();
    if (this.onBossDeath) this.onBossDeath({ name: boss.displayName, title: boss.title });
  }

  updateCinematic() {
    if (this.cinematic === 'bossIntro') {
      if (this.currentTime >= this.bossIntroUntil) {
        this.cinematic = null;
        if (this.boss) this.boss.controlLocked = false;
        this.showPickupToast('红色弹道按 S 蹲下 · 橙色弹道按 W 起跳', '#ffe066');
        if (this.onBossIntroEnd) this.onBossIntroEnd();
      }
    }
    if (this.bossDeath) this.updateBossDeath();
  }

  updateBossDeath() {
    const bd = this.bossDeath;
    const boss = this.boss;
    if (!bd || !boss) return;
    bd.elapsed += this.deltaTime;

    if (bd.elapsed >= bd.nextExplosion && bd.count < 8) {
      bd.count++;
      bd.nextExplosion = bd.elapsed + 320;
      const x = boss.x + Math.random() * boss.width;
      const y = boss.y + 12 + Math.random() * (boss.height - 24);
      this.effectSystem.explosion(x, y);
      this.effectSystem.spawn('debris', x, y, { scale: 0.5, frameDuration: 60, additive: false });
      this.particleSystem.createExplosion(x, y, '#ffb347', 10);
      this.addScreenShake(9, 5);
      this.sfx.explosion();
    }

    if (!bd.bigBoom && bd.elapsed >= 1500) {
      bd.bigBoom = true;
      const c = boss.corePoint;
      this.effectSystem.explosion(c.x, c.y);
      this.particleSystem.createExplosion(c.x, c.y, '#ffffff', 36);
      this.particleSystem.createExplosion(c.x, c.y, '#ff8a3d', 24);
      this.whiteFlash = 1;
      this.addScreenShake(30, 15);
      this.addHitStop(90);
      this.sfx.explosion();
      this.sfx.explosion();
    }

    if (bd.elapsed >= bd.duration) {
      this.bossDeath = null;
      this.cinematic = null;
      this.clearTime = Math.max(1, (performance.now() - this.levelStartedAt) / 1000);
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  handleBossPhase(phase) {
    const boss = this.boss;
    if (!boss) return;
    const c = boss.corePoint;
    this.effectSystem.explosion(c.x, c.y);
    this.particleSystem.createExplosion(c.x, c.y, '#ffe066', 24);
    this.addScreenShake(22, 12);
    this.addHitStop(150);
    this.whiteFlash = Math.max(this.whiteFlash, 0.45);
    this.sfx.bossPhase();
    this.showPickupToast(
      phase === 2 ? 'BOSS 暴走 · 注意震地' : '核心暴露 · 攻击胸口弱点',
      phase === 2 ? '#ff8a3d' : '#ffe066',
    );
    if (this.onBossPhase) this.onBossPhase(phase, boss);
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
    this.damageTaken++;
    this.addScreenShake(20, 10);
    this.addHitStop(65);
    this.damageFlash = 1;
    this.sfx.hurt();
    this.player.hurt(this.currentTime);
    if (this.onLivesChange) this.onLivesChange(this.lives);
  }

  spawnBoss() {
    if (!this.level.boss || this.bossSpawned) return;

    // 竞技场以 Boss 为基准向左取一屏，触发点放在左闸门内侧，
    // 这样玩家进入时已经在画面里，不会贴边。
    const worldW = this.level.worldWidth;
    const x1 = clamp(this.level.boss.x - 420, 0, worldW - this.logicalW);
    const triggerX = x1 + 60;
    if (this.player.x < triggerX) return;

    this.bossSpawned = true;
    const x2 = Math.min(worldW, x1 + this.logicalW);
    this.bossArena = { x1, x2, locked: true };
    this.world.arena = this.bossArena;
    // 入场瞬间把镜头钉在左闸门，保证 Boss 名牌和本体同框
    this.cameraX = x1;

    // 竞技场高台：一层换位、二层躲震波
    if (!this.arenaPlatformsAdded) {
      this.arenaPlatformsAdded = true;
      this.level.platforms.push(
        { x: Math.round(x1 + 64), y: 188, w: 92, h: 9 },
        { x: Math.round(x1 + 302), y: 158, w: 96, h: 9 },
      );
    }

    // 清掉场地内原有掩体，换成两个可破坏掩体，保证 Boss 不被堵住
    this.level.covers = this.level.covers.filter(
      (c) => c.x + c.w < x1 || c.x > x2,
    );
    this.level.covers.push(
      new Cover(x1 + 96, GameConfig.GROUND_Y - 26, 30, 26, 8, true, 'crate'),
      new Cover(x1 + 288, GameConfig.GROUND_Y - 20, 46, 20, 12, true, 'sandbags'),
    );
    this.world.covers = this.level.covers;

    // 普通杂兵不参与 Boss 战，二阶段由 Boss 召唤增援
    this.enemies = this.enemies.filter(
      (e) => e.x + e.width < x1 || e.x > x2,
    );

    this.boss = new Boss(
      this.level.boss.x,
      GameConfig.GROUND_Y,
      this.level.boss.hp,
      { name: this.level.boss.name, title: this.level.boss.title },
    );
    this.boss.awake = true;
    this.boss.controlLocked = true;
    this.enemies.push(this.boss);

    // 场地补给：血量 + 保底步枪，避免只有手枪时打长血条
    this.spawnPickup('health', x1 + 140, GameConfig.GROUND_Y);
    this.spawnPickup('rifle', x1 + 330, GameConfig.GROUND_Y);

    // 入场演出：锁输入 1.8 秒，镜头拉进竞技场
    this.cinematic = 'bossIntro';
    this.bossIntroUntil = this.currentTime + 1800;
    this.sfx.bossRoar();
    if (this.onBossIntro) {
      this.onBossIntro({
        name: this.boss.displayName,
        title: this.boss.title,
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        phase: 1,
      });
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
    if (this.bossDeath) return;
    if (this.lives <= 0) {
      this.state = GameState.GAME_OVER;
      if (this.onStateChange) this.onStateChange(this.state);
      return;
    }
    if (!this.level.boss && this.enemies.length === 0 &&
        this.player.x >= this.level.worldWidth - this.logicalW * 0.5) {
      this.clearTime = Math.max(1, (performance.now() - this.levelStartedAt) / 1000);
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  // ============================================================
  // 渲染：逻辑画布 480x270 → 整数 3x 放大 → 主画布 1440x810
  // 顺序：远景 → 世界（地面/平台/角色/特效）→ 前景+雨 → 后期
  // 控制提示与武器 HUD 由 DOM 覆盖层绘制，保证文字清晰
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

      // 贴地机关与检查点信标（在掩体和角色之下）
      this.drawHazards(ctx);
      this.drawCheckpoints(ctx);

      // 掩体
      for (const c of this.level.covers) {
        if (this.isVisible(c.x, c.w)) c.draw(ctx);
      }

      // Boss 竞技场能量闸门 + 遭遇闸门 + 震地冲击波
      this.drawArenaGates(ctx);
      this.drawEncounterGate(ctx);
      this.drawShockwaves(ctx);

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

  drawArenaGates(ctx) {
    if (!this.bossArena) return;
    const { x1, x2 } = this.bossArena;
    const top = GameConfig.GROUND_Y - 110;
    const t = this.currentTime;
    for (const x of [x1, x2]) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createLinearGradient(0, top, 0, GameConfig.GROUND_Y);
      grd.addColorStop(0, 'rgba(0, 229, 255, 0)');
      grd.addColorStop(0.45, 'rgba(0, 229, 255, 0.12)');
      grd.addColorStop(1, 'rgba(0, 229, 255, 0.42)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - 3, top, 6, GameConfig.GROUND_Y - top);

      // 向上扫的光点
      const scanY = GameConfig.GROUND_Y - ((t * 0.055) % 110);
      ctx.fillStyle = 'rgba(170, 250, 255, 0.65)';
      ctx.fillRect(x - 3, scanY, 6, 2);

      // 顶部危险箭头
      ctx.fillStyle = 'rgba(255, 46, 136, 0.9)';
      for (let i = 0; i < 3; i++) {
        const ay = top + 10 + i * 10;
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x + 5, ay + 6);
        ctx.lineTo(x - 5, ay + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 遭遇闸门：锁定时红橙能量墙，清场后绿色脉冲开闸
  drawEncounterGate(ctx) {
    const enc = this.activeEncounter;
    const flashing = this.encounterGateFlash > 0 && this.encounterGateFlashX != null;
    if ((!enc || enc.gateX == null) && !flashing) return;

    const locked = !!(enc && enc.gateX != null);
    const x = Math.round(locked ? enc.gateX : this.encounterGateFlashX);
    const ground = GameConfig.GROUND_Y;
    const top = ground - 132;
    const t = this.currentTime;

    if (!locked) {
      // 开闸：绿色光柱向外扩散并淡出
      const k = clamp(this.encounterGateFlash / 650, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const off = (1 - k) * 10;
      ctx.fillStyle = `rgba(57, 255, 136, ${0.55 * k})`;
      ctx.fillRect(Math.round(x - off) - 1, top, 2, ground - top);
      ctx.fillRect(Math.round(x + off) - 1, top, 2, ground - top);
      ctx.fillStyle = `rgba(210, 255, 230, ${0.8 * k})`;
      ctx.fillRect(x - 1, ground - 8, 2, 8);
      ctx.restore();
      return;
    }

    const flicker = 0.82 + 0.18 * Math.sin(t / 70);

    // 上下发射器
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(x - 7, top - 5, 14, 7);
    ctx.fillRect(x - 7, ground - 6, 14, 6);
    ctx.fillStyle = '#2a3444';
    ctx.fillRect(x - 5, top - 3, 10, 2);
    ctx.fillRect(x - 5, ground - 5, 10, 2);
    ctx.fillStyle = `rgba(255, 90, 60, ${0.85 * flicker})`;
    ctx.fillRect(x - 2, top, 4, 2);
    ctx.fillRect(x - 2, ground - 8, 4, 2);

    // 能量场
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grd = ctx.createLinearGradient(0, top, 0, ground);
    grd.addColorStop(0, 'rgba(255, 90, 60, 0)');
    grd.addColorStop(0.32, `rgba(255, 90, 60, ${0.40 * flicker})`);
    grd.addColorStop(0.72, `rgba(255, 120, 70, ${0.26 * flicker})`);
    grd.addColorStop(1, `rgba(255, 190, 110, ${0.64 * flicker})`);
    ctx.fillStyle = grd;
    ctx.fillRect(x - 4, top, 8, ground - top);

    // 两侧导轨：让封锁线在霓虹背景里也能一眼看清
    ctx.fillStyle = `rgba(255, 150, 90, ${0.85 * flicker})`;
    ctx.fillRect(x - 4, top, 1, ground - top);
    ctx.fillRect(x + 3, top, 1, ground - top);

    const span = ground - top;
    for (let i = 0; i < 5; i++) {
      const yy = top + ((t * 0.06 + i * span / 5) % span);
      ctx.fillStyle = `rgba(255, 233, 210, ${0.45 * flicker})`;
      ctx.fillRect(x - 4, Math.round(yy), 8, 1);
    }
    ctx.restore();

    // 顶部锁定菱形 + 剩余敌人刻度
    ctx.save();
    ctx.translate(x, top - 12);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.92)';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();

    const remaining = this.enemies.filter((e) => !e.dead && e.encounterId === enc.id).length;
    const pips = Math.min(8, remaining);
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = 'rgba(255, 138, 61, 0.9)';
      ctx.fillRect(x - pips * 2 + i * 4, top - 26, 2, 4);
    }
  }

  // 检查点信标：未激活为青色脉冲，使用后转绿色常亮
  drawCheckpoints(ctx) {
    if (!this.level || !this.level.checkpoints) return;
    const ground = GameConfig.GROUND_Y;
    const t = this.currentTime;
    for (const cp of this.level.checkpoints) {
      if (!this.isVisible(cp.x - 12, 24)) continue;
      const x = Math.round(cp.x);
      const pulse = 0.5 + 0.5 * Math.sin(t / 260);
      const col = cp.used ? '57, 255, 136' : '0, 229, 255';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${col}, ${cp.used ? 0.18 : 0.10 + pulse * 0.08})`;
      ctx.fillRect(x - 12, ground - 2, 24, 2);
      ctx.restore();

      // 底座
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(x - 6, ground - 5, 12, 5);
      ctx.fillStyle = '#2a3444';
      ctx.fillRect(x - 5, ground - 4, 10, 3);
      ctx.fillStyle = `rgba(${col}, 0.9)`;
      ctx.fillRect(x - 4, ground - 4, 8, 1);

      // 立杆 + 信标
      ctx.fillStyle = '#141b24';
      ctx.fillRect(x - 1, ground - 22, 2, 17);
      ctx.fillStyle = '#3a4658';
      ctx.fillRect(x, ground - 21, 1, 15);

      const glow = cp.used ? 0.35 : 0.55 + pulse * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${col}, ${0.22 * glow})`;
      ctx.fillRect(x - 6, ground - 34, 12, 12);
      ctx.fillStyle = `rgba(${col}, ${0.9 * glow})`;
      ctx.fillRect(x - 2, ground - 30, 4, 4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * glow})`;
      ctx.fillRect(x - 1, ground - 29, 2, 2);

      if (!cp.used) {
        const g = ctx.createLinearGradient(0, ground - 70, 0, ground - 22);
        g.addColorStop(0, 'rgba(0, 229, 255, 0)');
        g.addColorStop(1, `rgba(0, 229, 255, ${0.12 + pulse * 0.08})`);
        ctx.fillStyle = g;
        ctx.fillRect(x - 2, ground - 70, 4, 48);
      }
      ctx.restore();
    }
  }

  // 蒸汽口：地面格栅 + 预警闪烁 + 喷发气团
  drawHazards(ctx) {
    if (!this.level || !this.level.hazards) return;
    const ground = GameConfig.GROUND_Y;
    const t = this.currentTime;
    for (let i = 0; i < this.level.hazards.length; i++) {
      const h = this.level.hazards[i];
      if (!this.isVisible(h.x, h.w)) continue;
      const x = Math.round(h.x);
      const w = Math.round(h.w);
      const phase = this.hazardPhase(i, t);
      const warning = phase >= 0.38 && phase < 0.5;
      const active = phase >= 0.5 && phase < 0.72;

      // 地面格栅
      ctx.fillStyle = '#080b10';
      ctx.fillRect(x - 2, ground - 6, w + 4, 6);
      ctx.fillStyle = '#2a3444';
      ctx.fillRect(x - 1, ground - 5, w + 2, 3);
      ctx.fillStyle = '#0e141c';
      for (let sx = x; sx < x + w; sx += 4) ctx.fillRect(sx, ground - 5, 2, 3);

      // 警示灯
      const blink = 0.5 + 0.5 * Math.sin(t / (warning ? 55 : 140));
      ctx.fillStyle = active
        ? '#ff8a3d'
        : (warning ? `rgba(255, 138, 61, ${0.35 + blink * 0.6})` : '#5a2a16');
      ctx.fillRect(x + 2, ground - 8, 3, 2);
      ctx.fillRect(x + w - 5, ground - 8, 3, 2);

      if (!warning && !active) continue;

      // 蒸汽气团
      const power = active ? 1 : 0.35;
      const puffs = active ? 9 : 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < puffs; j++) {
        const life = ((t * 0.0011 + j / puffs + i * 0.17) % 1);
        const px = x + w / 2 + Math.sin(j * 2.7 + t * 0.0035) * (w * 0.34) * life;
        const py = ground - 6 - life * (active ? 46 : 16);
        const size = 3 + life * (active ? 7 : 3);
        const alpha = (1 - life) * power * 0.42;
        ctx.fillStyle = `rgba(205, 232, 245, ${alpha})`;
        ctx.fillRect(
          Math.round(px - size / 2), Math.round(py - size / 2),
          Math.round(size), Math.round(size),
        );
        if (active && j % 2 === 0) {
          ctx.fillStyle = `rgba(255, 220, 190, ${alpha * 0.5})`;
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
      ctx.restore();
    }
  }

  drawShockwaves(ctx) {
    for (const w of this.shockwaves) {
      const fade = Math.max(0, 1 - w.age / w.life);
      const h = 8 + fade * 8;
      const x = Math.round(w.x);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createLinearGradient(0, GameConfig.GROUND_Y - h, 0, GameConfig.GROUND_Y);
      grd.addColorStop(0, 'rgba(255, 138, 61, 0)');
      grd.addColorStop(0.45, `rgba(255, 138, 61, ${0.7 * fade})`);
      grd.addColorStop(1, `rgba(255, 230, 160, ${0.95 * fade})`);
      ctx.fillStyle = grd;
      ctx.fillRect(x - 4, GameConfig.GROUND_Y - h, 8, h);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
      ctx.fillRect(x - 1, GameConfig.GROUND_Y - h * 0.55, 2, h * 0.55);
      ctx.restore();
    }
  }

  drawPostFx(ctx) {
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.92, this.whiteFlash)})`;
      ctx.fillRect(0, 0, this.logicalW, this.logicalH);
    }

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

    // BOSS 血条：三阶段分段 + 当前阶段标识
    if (this.boss && !this.boss.dead && this.boss.awake) {
      const bw = 190;
      const bh = 7;
      const bx = Math.round((this.logicalW - bw) / 2);
      const by = 19;
      const ratio = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      const phase = this.boss.phase || 1;
      const barColor = phase >= 3 ? '#ffe066' : (phase === 2 ? '#ff8a3d' : '#ff2e88');
      const title = this.boss.title || 'GANG LORD // 帮派首领';

      ctx.save();
      // 标题底板按文字宽度自适应
      ctx.font = 'bold 7px monospace';
      const titleW = Math.max(120, Math.ceil(ctx.measureText(title).width) + 12);
      ctx.fillStyle = 'rgba(4, 4, 10, 0.78)';
      ctx.fillRect(this.logicalW / 2 - titleW / 2, by - 11, titleW, 9);
      ctx.fillStyle = 'rgba(255, 186, 216, 0.98)';
      ctx.textAlign = 'center';
      ctx.fillText(title, this.logicalW / 2, by - 4);
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
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by + 1, Math.round(bw * ratio), bh - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(bx, by + 2, Math.round(bw * ratio), 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(bx, by + 1, Math.round(bw * ratio), 1);

      // 阶段分界刻度：66% / 33%
      ctx.fillStyle = 'rgba(8, 6, 12, 0.85)';
      for (const th of GameConfig.BOSS.phaseThresholds) {
        ctx.fillRect(bx + Math.round(bw * th), by, 1, bh);
      }
      if (ratio > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + Math.round(bw * ratio) - 1, by, 1, bh);
      }

      // 当前阶段
      ctx.font = 'bold 6px monospace';
      ctx.fillStyle = barColor;
      ctx.fillText(`PHASE ${phase}/3`, bx + bw + 7, by + 6);
      if (phase >= 3) {
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(bx + bw + 2, by - 1, 2, 2);
      }
      ctx.restore();
    }

    this.drawPickupToast(ctx);
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
