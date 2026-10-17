import { GameConfig } from '../config/gameConfig.js';
import { Player } from './Player.js';
import { Thug, Boss } from './Enemy.js';
import { ParticleSystem } from './Particle.js';
import { SceneRenderer } from './SceneRenderer.js';
import { Level, loadLevels } from './Level.js';
import { BulletOwner } from './Bullet.js';
import { InputManager } from '../utils/input.js';
import { Sfx } from '../utils/sfx.js';

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
    this.width = GameConfig.CANVAS_WIDTH;
    this.height = GameConfig.CANVAS_HEIGHT;

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
    this.sceneRenderer = new SceneRenderer(this.width, this.height);
    this.input = new InputManager();
    this.sfx = new Sfx();

    this.lastTime = 0;
    this.deltaTime = 16;
    this.currentTime = 0;
    this.animationId = null;

    this.screenShake = 0;
    this.screenShakeIntensity = 0;

    this.onStateChange = null;
    this.onScoreChange = null;
    this.onLivesChange = null;
    this.onEnemyCountChange = null;
    this.onLevelChange = null;

    this._lastRemaining = -1;
  }

  init() {
    this.input.bindTouchControls(document.getElementById('touchControls'));
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
    this.screenShake = 0;
    this.cameraX = clamp(this.level.playerSpawn.x - this.width * 0.4, 0, this.level.worldWidth - this.width);

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

    if (this.state === GameState.PLAYING) {
      this.updatePlaying(dtf);
    }

    this.particleSystem.update(this.deltaTime);

    for (const c of (this.level ? this.level.covers : [])) c.update(this.deltaTime);

    if (this.screenShake > 0) {
      this.screenShake -= this.deltaTime;
      if (this.screenShake < 0) this.screenShake = 0;
    }
  }

  updatePlaying(dtf) {
    // 统一输入：每帧轮询，游戏逻辑只读抽象信号（不区分键盘/触屏/手柄）
    const input = this.input.poll();

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
      this.bullets.push(p.createBullet());
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

  // 切换武器槽（本轮仅占位：切换弹丸颜色与 HUD 名称；射速/弹速差异留到阶段四）
  switchWeapon() {
    if (!this.player) return;
    const total = GameConfig.WEAPONS.length;
    this.player.weaponIndex = (this.player.weaponIndex + 1) % total;
    this.sfx.click();
  }

  updateCamera() {
    const target = this.player.x + this.player.width / 2 - this.width * 0.4;
    const clamped = clamp(target, 0, this.level.worldWidth - this.width);
    // 镜头跟随玩家水平推进
    this.cameraX += (clamped - this.cameraX) * 0.16;
    this.cameraX = clamp(this.cameraX, 0, this.level.worldWidth - this.width);
  }

  updateBullets(dtf) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dtf);
      this.resolveBullet(b);

      const offScreen = b.x < this.cameraX - 260 ||
                        b.x > this.cameraX + this.width + 260 ||
                        b.y < -260 || b.y > this.height + 260;
      if (offScreen) b.active = false;

      if (!b.active) this.bullets.splice(i, 1);
    }
  }

  resolveBullet(b) {
    const bb = b.getBounds();

    // 掩体优先：挡住飞向玩家的子弹，并可以被打碎
    for (const c of this.level.covers) {
      if (c.hp <= 0) continue;
      if (b.ignoreCover === c) continue;
      if (aabb(bb, c.getBounds())) {
        b.active = false;
        this.particleSystem.createHitEffect(b.x + b.width / 2, b.y + b.height / 2, '#ffb347');
        if (c.takeDamage(b.damage)) {
          const cc = c.getCenter();
          this.particleSystem.createExplosion(cc.x, cc.y, '#ffa502', 22);
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
          this.particleSystem.createHitEffect(b.x + b.width / 2, b.y + b.height / 2, '#ff5a5a');
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
        this.enemies.splice(i, 1);
        continue;
      }
      if (!e.awake) {
        if (e.x < this.cameraX + this.width + 140) e.awake = true;
        else continue;
      }
      // 掩护体被摧毁后释放占用
      if (e.cover && e.cover.hp <= 0) e.cover = null;

      const bullet = e.update(dtf, this.deltaTime, this.currentTime, this.world, this.player);
      if (bullet) {
        this.bullets.push(bullet);
        this.sfx.enemyShoot();
      }
      if (e.hitFlash > 0) e.hitFlash -= this.deltaTime;
    }
  }

  updateGrenades(dtf) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(dtf, this.deltaTime);

      // 落地爆炸
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
    this.particleSystem.createExplosion(c.x, c.y, '#ffa502', 32);
    this.particleSystem.createExplosion(c.x, c.y, '#ffffff', 12);
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
    this.particleSystem.createExplosion(c.x, c.y, '#ff5a5a', 26);
    this.particleSystem.createExplosion(c.x, c.y, '#ffd24a', 10);
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
    if (this.player.x > this.level.boss.x - 760) {
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
    // 无 BOSS 的关卡：清空敌人并推进到终点即胜利
    if (!this.level.boss && this.enemies.length === 0 &&
        this.player.x >= this.level.worldWidth - this.width * 0.5) {
      this.state = GameState.VICTORY;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.level) {
      ctx.restore();
      return;
    }

    // 背景视差层（自带 camera 偏移）
    this.sceneRenderer.draw(ctx, this.cameraX, this.level);

    const showWorld = this.state === GameState.PLAYING ||
                      this.state === GameState.PAUSED ||
                      this.state === GameState.GAME_OVER ||
                      this.state === GameState.VICTORY;

    if (showWorld && this.player) {
      ctx.save();
      ctx.translate(-Math.round(this.cameraX) + shakeX, shakeY);

      this.drawPlatforms();
      for (const c of this.level.covers) {
        if (this.isVisible(c.x, c.w)) c.draw(ctx);
      }
      for (const g of this.grenades) g.draw(ctx);
      for (const b of this.bullets) b.draw(ctx);
      for (const e of this.enemies) {
        if (e.awake && this.isVisible(e.x, e.width)) e.draw(ctx, this.currentTime);
      }
      this.player.draw(ctx, this.currentTime, this.cameraX);
      this.particleSystem.draw(ctx);

      ctx.restore();

      this.drawCanvasHud(ctx);
    }

    ctx.restore();
  }

  isVisible(x, w) {
    return x + w > this.cameraX - 80 && x < this.cameraX + this.width + 80;
  }

  drawPlatforms() {
    const ctx = this.ctx;
    for (const p of this.level.platforms) {
      if (!this.isVisible(p.x, p.w)) continue;

      if (p.y >= GameConfig.GROUND_Y) {
        // 地面：沥青 + 人行道 + 霓虹反光
        ctx.fillStyle = '#12121c';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#1e2130';
        ctx.fillRect(p.x, p.y, p.w, 9);
        ctx.fillStyle = 'rgba(255,46,136,0.20)';
        ctx.fillRect(p.x, p.y + 9, p.w, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        const start = Math.floor(p.x / 220) * 220;
        for (let x = start; x < p.x + p.w; x += 220) {
          ctx.fillRect(Math.max(x, p.x), p.y + 16, 70, 46);
        }
      } else {
        // 浮空平台
        ctx.fillStyle = '#39425a';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.40)';
        ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
        ctx.fillStyle = 'rgba(0,229,255,0.28)';
        ctx.fillRect(p.x, p.y + p.h, p.w, 2);
      }
    }
  }

  drawCanvasHud(ctx) {
    // 推进进度条
    const prog = clamp(this.player.x / this.level.worldWidth, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.width, 4);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(0, 0, this.width * prog, 4);

    // BOSS 血条
    if (this.boss && !this.boss.dead && this.boss.awake) {
      const bw = 420;
      const bx = (this.width - bw) / 2;
      const by = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 3, by - 3, bw + 6, 20);
      ctx.fillStyle = '#2a1030';
      ctx.fillRect(bx, by, bw, 14);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(bx, by, bw * Math.max(0, this.boss.hp / this.boss.maxHp), 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('帮派首领', this.width / 2, by + 11);
      ctx.textAlign = 'left';
    }

    // 手雷冷却
    const ratio = clamp((this.currentTime - this.player.lastGrenade) / GameConfig.PLAYER.grenadeCooldown, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, this.height - 30, 120, 12);
    ctx.fillStyle = ratio >= 1 ? '#39ff88' : '#ffa502';
    ctx.fillRect(16, this.height - 30, 120 * ratio, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.fillText('手雷 [G]', 16, this.height - 34);

    // 当前武器槽
    ctx.fillStyle = this.player.getWeapon().color;
    ctx.font = '12px monospace';
    ctx.fillText(`武器 [L] ${this.player.getWeapon().name}`, 16, this.height - 50);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}
