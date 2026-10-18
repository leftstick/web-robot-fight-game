import { GameConfig } from '../config/gameConfig.js';
import { Player } from './Player.js';
import { Thug, Boss } from './Enemy.js';
import { ParticleSystem } from './Particle.js';
import { EffectSystem } from './Effects.js';
import { SceneRenderer } from './SceneRenderer.js';
import { Level, loadLevels } from './Level.js';
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

    // 加载进度
    this.loadProgress = 0;
    this.loadingDone = false;

    // CRT 扫描线贴图
    this.crtCanvas = null;

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
    this.enemies = [];
    this.boss = null;
    this.bossSpawned = false;
    this.particleSystem.clear();
    this.effectSystem.clear();
    this.screenShake = 0;
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
    this.sceneRenderer.update(this.deltaTime);

    // 每帧读取统一输入信号（所有状态均轮询，菜单导航需要它）
    const input = this.input.poll();
    if (this.onFrame) this.onFrame(input);

    if (this.state === GameState.PLAYING) {
      this.updatePlaying(dtf, input);
    }

    this.particleSystem.update(this.deltaTime);
    this.effectSystem.update(this.deltaTime);

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

    const p = this.player;

    p.moveLeft = input.moveLeft;
    p.moveRight = input.moveRight;
    p.aiming = input.aim;
    p.setCrouch(input.crouch && p.onGround);

    if (input.jump && p.jump()) this.sfx.jump();

    if (input.shoot && p.tryFire(this.currentTime)) {
      const b = p.createBullet();
      this.bullets.push(b);
      // 枪口火焰特效
      const gunY = p.y + p.getGunHeight();
      const fx = p.facing > 0 ? p.x + p.width : p.x;
      this.effectSystem.muzzleFlash(fx, gunY, p.facing);
      this.effectSystem.shell(fx, gunY, p.facing * 1.5, -1.5);
      this.sfx.shoot();
    }

    if (input.grenade && p.tryGrenade(this.currentTime)) {
      this.grenades.push(p.createGrenade());
      this.sfx.throwGrenade();
    }

    if (input.switchWeapon) this.switchWeapon();

    p.update(dtf, this.world);

    this.updateCamera();
    this.updateBullets(dtf);
    this.updateEnemies(dtf);
    this.updateGrenades(dtf);
    this.spawnBoss();
    this.checkGameState();
  }

  switchWeapon() {
    if (!this.player) return;
    const total = GameConfig.WEAPONS.length;
    this.player.weaponIndex = (this.player.weaponIndex + 1) % total;
    this.sfx.click();
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
        if (c.takeDamage(b.damage)) {
          const cc = c.getCenter();
          this.effectSystem.explosion(cc.x, cc.y);
          this.addScreenShake(12, 6);
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
          const died = e.takeDamage(b.damage);
          this.addScreenShake(3, 2);
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
        // 敌人枪口火焰
        const gunY = e.y + Math.round(e.height * 0.36);
        const fx = e.facing > 0 ? e.x + e.width : e.x;
        this.effectSystem.muzzleFlash(fx, gunY, e.facing);
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
    this.addScreenShake(20, 11);
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
    this.particleSystem.createExplosion(c.x, c.y, '#ff5a5a', 16);
    this.addScreenShake(10, 5);
    this.sfx.explosion();

    this.score += e.score;
    this.totalKills++;
    if (this.onScoreChange) this.onScoreChange(this.score);
    this.emitRemaining(false);

    if (e === this.boss) {
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  damagePlayer() {
    this.lives--;
    this.addScreenShake(20, 10);
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
  // 渲染：逻辑画布 480x270 → 2x 放大 → 主画布 960x540
  // ============================================================
  render() {
    const ctx = this.lctx; // 逻辑画布上下文
    ctx.imageSmoothingEnabled = false;

    // 屏幕震动（逻辑空间内）
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
      this.sceneRenderer.draw(ctx, this.cameraX, this.level);
    } else {
      // 关卡未加载时的深色背景
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

      // 地面层
      this.sceneRenderer.drawGround(ctx, this.cameraX, this.level);

      // 平台（浮空平台）
      this.drawPlatforms(ctx);

      // 掩体
      for (const c of this.level.covers) {
        if (this.isVisible(c.x, c.w)) c.draw(ctx);
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

    // CRT 扫描线
    if (this.crtCanvas) {
      ctx.globalAlpha = 0.08;
      const pattern = ctx.createPattern(this.crtCanvas, 'repeat');
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, this.logicalW, this.logicalH);
      ctx.globalAlpha = 1;
    }

    // 合成到主画布（2x 放大 + 色差）
    this.compositeToScreen();
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

  // 合成到主画布：整数 2x 放大 + 轻微色差
  compositeToScreen() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    // 轻微色差：R 通道偏移
    if (this.loadingDone) {
      // 绘制青色偏移版（整体向左 1px）
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.offscreen, -1, 0, this.logicalW * this.scale, this.logicalH * this.scale);
      // 绘制洋红偏移版（整体向右 1px）
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.offscreen, 1, 0, this.logicalW * this.scale, this.logicalH * this.scale);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // 主画面（2x 整数放大）
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
    for (const p of this.level.platforms) {
      if (!this.isVisible(p.x, p.w)) continue;
      if (p.y >= GameConfig.GROUND_Y) continue; // 地面由背景 ground 层绘制
      // 浮空平台
      ctx.fillStyle = '#39425a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(p.x, p.y, p.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1);
      ctx.fillStyle = 'rgba(0,229,255,0.28)';
      ctx.fillRect(p.x, p.y + p.h, p.w, 1);
    }
  }

  drawCanvasHud(ctx) {
    const hudImg = getUi('hud');
    const weaponIcons = [
      { sx: 130, sy: 0, sw: 18, sh: 12 }, // 手枪
      { sx: 160, sy: 0, sw: 22, sh: 11 }, // 步枪
      { sx: 190, sy: 0, sw: 20, sh: 11 }, // 线光线弹枪
    ];

    // 推进进度条（顶部）
    const prog = clamp(this.player.x / this.level.worldWidth, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.logicalW, 2);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(0, 0, this.logicalW * prog, 2);

    // BOSS 血条
    if (this.boss && !this.boss.dead && this.boss.awake) {
      const bw = 210;
      const bx = (this.logicalW - bw) / 2;
      const by = 22;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 10);
      ctx.fillStyle = '#2a1030';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(bx, by, bw * Math.max(0, this.boss.hp / this.boss.maxHp), 7);
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('帮派首领', this.logicalW / 2, by + 6);
      ctx.textAlign = 'left';
    }

    if (!hudImg) return;

    // —— 左下角：霓虹血条 + 弹药条 + 武器图标 ——
    const baseX = 6;
    const baseY = this.logicalH - 44;

    // 血条（霓虹粉描边）
    const hbW = 100, hbH = 10;
    const livesRatio = clamp(this.lives / GameConfig.PLAYER.lives, 0, 1);
    ctx.drawImage(hudImg, 0, 0, 120, 14, baseX, baseY, hbW + 4, hbH + 4);
    ctx.drawImage(hudImg, 2, 2, 100 * livesRatio, 10,
      baseX + 2, baseY + 2, hbW * livesRatio, hbH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '6px monospace';
    ctx.fillText(`HP ${this.lives}/${GameConfig.PLAYER.lives}`, baseX + 4, baseY + 9);

    // 弹药条（霓虹青描边）—— 用射击冷却表示
    const abY = baseY + 16;
    const fireCd = this.player.lastFire > 0
      ? clamp((this.currentTime - this.player.lastFire) / (this.player.getWeapon().fireInterval || 110), 0, 1)
      : 1;
    ctx.drawImage(hudImg, 0, 20, 120, 10, baseX, abY, hbW + 4, 10);
    ctx.drawImage(hudImg, 2, 22, 80 * fireCd, 6,
      baseX + 2, abY + 2, hbW * fireCd, 6);
    ctx.fillStyle = '#aaf0ff';
    ctx.fillText('AMMO', baseX + 4, abY + 8);

    // 武器图标行
    const iconY = abY + 16;
    const curIdx = this.player.weaponIndex % weaponIcons.length;
    for (let i = 0; i < weaponIcons.length; i++) {
      const ic = weaponIcons[i];
      const ix = baseX + i * 26;
      // 选中高亮框
      if (i === curIdx) {
        ctx.fillStyle = 'rgba(0,229,255,0.25)';
        ctx.fillRect(ix - 2, iconY - 2, ic.sw + 6, ic.sh + 6);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(ix - 2.5, iconY - 2.5, ic.sw + 7, ic.sh + 7);
      }
      ctx.drawImage(hudImg, ic.sx, ic.sy, ic.sw, ic.sh, ix, iconY, ic.sw, ic.sh);
    }

    // 手雷图标 + 冷却条
    const gx = baseX + weaponIcons.length * 26 + 6;
    const gratio = clamp((this.currentTime - this.player.lastGrenade) / GameConfig.PLAYER.grenadeCooldown, 0, 1);
    ctx.drawImage(hudImg, 218, 0, 14, 13, gx, iconY, 14, 13);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(gx, iconY + 14, 14, 3);
    ctx.fillStyle = gratio >= 1 ? '#39ff88' : '#ffa502';
    ctx.fillRect(gx, iconY + 14, 14 * gratio, 3);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}
