import { GameConfig, LevelConfigs } from '../config/gameConfig.js';
import { Player, DodgeDirection } from './Player.js';
import { SmallEnemy, LargeEnemy } from './Enemy.js';
import { ParticleSystem } from './Particle.js';
import { SceneRenderer } from './SceneRenderer.js';
import { checkCollision, getCenter } from '../utils/collision.js';
import { InputManager } from '../utils/input.js';

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
  VICTORY: 'victory'
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = GameConfig.CANVAS_WIDTH;
    this.height = GameConfig.CANVAS_HEIGHT;
    
    this.state = GameState.MENU;
    this.currentLevel = 1;
    this.score = 0;
    this.lives = GameConfig.PLAYER_LIVES;
    this.totalKills = 0;
    
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.particleSystem = new ParticleSystem();
    this.sceneRenderer = new SceneRenderer(this.width, this.height);
    this.input = new InputManager();
    
    this.lastTime = 0;
    this.deltaTime = 0;
    this.animationId = null;
    this.currentTime = 0;
    
    this.enemiesSpawned = 0;
    this.lastSpawnTime = 0;
    this.spawnInterval = GameConfig.ENEMY_SPAWN_INTERVAL;
    this.largeEnemyQueue = 0;
    this.smallEnemyQueue = 0;
    
    this.screenShake = 0;
    this.screenShakeIntensity = 0;
    
    this.ultimateWave = null;
    
    this.onStateChange = null;
    this.onScoreChange = null;
    this.onLivesChange = null;
    this.onEnemyCountChange = null;
    this.onLevelChange = null;
    this.onUltimateCooldownChange = null;
    this.onDodgeCooldownChange = null;
  }
  
  init() {
    this.player = new Player(this.width, this.height);
    this.input.setCanvas(this.canvas);
    this.gameLoop(0);
  }
  
  startLevel(levelNumber) {
    this.currentLevel = levelNumber;
    const config = LevelConfigs[levelNumber - 1];
    
    this.state = GameState.PLAYING;
    this.score = 0;
    this.lives = GameConfig.PLAYER_LIVES;
    this.totalKills = 0;
    this.enemies = [];
    this.bullets = [];
    this.particleSystem.clear();
    this.ultimateWave = null;
    
    this.enemiesSpawned = 0;
    this.lastSpawnTime = this.currentTime;
    this.largeEnemyQueue = config.largeEnemyCount;
    this.smallEnemyQueue = config.smallEnemyCount;
    
    this.player.reset();
    this.sceneRenderer.setScene(config.scene);
    
    if (this.onStateChange) this.onStateChange(this.state);
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.onLivesChange) this.onLivesChange(this.lives);
    if (this.onEnemyCountChange) this.onEnemyCountChange(this.getRemainingEnemies());
    if (this.onLevelChange) this.onLevelChange(this.currentLevel);
  }
  
  getRemainingEnemies() {
    const total = LevelConfigs[this.currentLevel - 1].largeEnemyCount + 
                  LevelConfigs[this.currentLevel - 1].smallEnemyCount;
    return total - this.totalKills;
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
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }
  
  gameLoop(currentTime) {
    this.currentTime = currentTime;
    this.deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    if (this.deltaTime > 50) {
      this.deltaTime = 16;
    }
    
    this.update(currentTime);
    this.render();
    
    this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
  }
  
  update(currentTime) {
    this.sceneRenderer.update(this.deltaTime);
    
    if (this.state === GameState.PLAYING) {
      this.updatePlaying(currentTime);
    }
    
    this.particleSystem.update(this.deltaTime);
    
    if (this.ultimateWave) {
      this.updateUltimateWave();
    }
    
    if (this.screenShake > 0) {
      this.screenShake -= this.deltaTime;
    }
  }
  
  updatePlaying(currentTime) {
    if (this.input.isPauseJustPressed()) {
      this.pause();
      return;
    }
    
    if (this.input.isTouchDevice && this.input.isTouchActive()) {
      // 移动端：触控控制
      this.player.setTargetX(this.input.getTouchX());
      
      // 按住屏幕自动发射轻攻击
      if (this.player.tryLightFire(currentTime)) {
        this.fireLightBullet();
      }
    } else {
      // 桌面端：键盘控制
      this.player.clearTargetX();
      this.player.moveLeft = this.input.isLeft();
      this.player.moveRight = this.input.isRight();
      
      this.handleDodgeInput(currentTime);
      this.handleFireInput(currentTime);
    }
    
    this.player.update(this.deltaTime, currentTime);
    
    this.updateBullets();
    this.updateEnemies(currentTime);
    this.spawnEnemies(currentTime);
    this.checkCollisions();
    this.checkGameState();
    
    if (this.onUltimateCooldownChange) {
      this.onUltimateCooldownChange(this.player.getUltimateCooldownPercent(currentTime));
    }
    if (this.onDodgeCooldownChange) {
      this.onDodgeCooldownChange(this.player.getDodgeCooldownPercent(currentTime));
    }
    
    this.input.clearJustPressed();
  }
  
  handleDodgeInput(currentTime) {
    if (this.input.isKeyJustPressed('ArrowUp') || this.input.isKeyJustPressed('KeyW')) {
      this.player.dodge(DodgeDirection.UP, currentTime);
    }
    if (this.input.isKeyJustPressed('ArrowDown') || this.input.isKeyJustPressed('KeyS')) {
      this.player.dodge(DodgeDirection.DOWN, currentTime);
    }
    if (this.input.isKeyJustPressed('ArrowLeft') && !this.input.isKeyDown('ArrowLeft')) {
    }
    if (this.input.isKeyJustPressed('ArrowRight') && !this.input.isKeyDown('ArrowRight')) {
    }
  }
  
  handleFireInput(currentTime) {
    if (this.input.isKeyDown('KeyA') && this.player.tryHeavyFire(currentTime)) {
      this.fireHeavyBullet();
    }
    
    if (this.input.isKeyDown('KeyB') && this.player.tryLightFire(currentTime)) {
      this.fireLightBullet();
    }
    
    if (this.input.isKeyJustPressed('KeyC') && this.player.tryUltimate(currentTime)) {
      this.fireUltimate();
    }
    
    if (this.input.isKeyDown('Space') && this.player.tryLightFire(currentTime)) {
      this.fireLightBullet();
    }
  }
  
  fireLightBullet() {
    const bullet = this.player.createLightBullet();
    this.bullets.push(bullet);
  }
  
  fireHeavyBullet() {
    const bullet = this.player.createHeavyBullet();
    this.bullets.push(bullet);
    this.addScreenShake(5, 3);
  }
  
  fireUltimate() {
    this.ultimateWave = {
      y: this.player.y,
      speed: 15,
      damage: GameConfig.ULTIMATE_DAMAGE,
      active: true
    };
    this.addScreenShake(30, 15);
    
    for (let i = 0; i < 30; i++) {
      this.particleSystem.createExplosion(
        this.player.x + this.player.width / 2 + (Math.random() - 0.5) * 200,
        this.player.y,
        GameConfig.ULTIMATE_COLOR,
        3
      );
    }
  }
  
  updateUltimateWave() {
    if (!this.ultimateWave || !this.ultimateWave.active) return;
    
    this.ultimateWave.y -= this.ultimateWave.speed;
    
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.y + enemy.height > this.ultimateWave.y && enemy.y < this.ultimateWave.y + 50) {
        if (!enemy.hitByUltimate) {
          enemy.hitByUltimate = true;
          const isDead = enemy.takeDamage(this.ultimateWave.damage);
          
          const enemyCenter = getCenter({
            x: enemy.x, y: enemy.y,
            width: enemy.width, height: enemy.height
          });
          this.particleSystem.createHitEffect(enemyCenter.x, enemyCenter.y, GameConfig.ULTIMATE_COLOR);
          
          if (isDead) {
            this.particleSystem.createExplosion(enemyCenter.x, enemyCenter.y, enemy.color, 25);
            this.score += enemy.score;
            this.totalKills++;
            this.enemies.splice(i, 1);
            
            this.addScreenShake(10, 5);
            
            if (this.onScoreChange) this.onScoreChange(this.score);
            if (this.onEnemyCountChange) this.onEnemyCountChange(this.getRemainingEnemies());
          }
        }
      } else if (enemy.y + enemy.height < this.ultimateWave.y - 100) {
        enemy.hitByUltimate = false;
      }
    }
    
    if (this.ultimateWave.y < -100) {
      this.ultimateWave.active = false;
      this.ultimateWave = null;
    }
  }
  
  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].update(this.deltaTime);
      if (!this.bullets[i].active) {
        this.bullets.splice(i, 1);
      }
    }
  }
  
  updateEnemies(currentTime) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(this.deltaTime, currentTime);
      
      if (enemy.isOffScreen(this.height)) {
        this.enemies.splice(i, 1);
        this.loseLife();
      }
    }
  }
  
  spawnEnemies(currentTime) {
    const totalQueued = this.largeEnemyQueue + this.smallEnemyQueue;
    if (totalQueued <= 0) return;
    
    if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
      this.lastSpawnTime = currentTime;
      
      let isLarge = false;
      if (this.largeEnemyQueue > 0 && this.smallEnemyQueue > 0) {
        isLarge = Math.random() < (this.largeEnemyQueue / totalQueued);
      } else if (this.largeEnemyQueue > 0) {
        isLarge = true;
      }
      
      const spawnX = GameConfig.ENEMY_SPAWN_X_MIN + 
        Math.random() * (GameConfig.ENEMY_SPAWN_X_MAX - GameConfig.ENEMY_SPAWN_X_MIN);
      const spawnY = GameConfig.ENEMY_SPAWN_Y;
      
      if (isLarge) {
        this.enemies.push(new LargeEnemy(spawnX - GameConfig.LARGE_ENEMY_WIDTH / 2, spawnY));
        this.largeEnemyQueue--;
      } else {
        this.enemies.push(new SmallEnemy(spawnX - GameConfig.SMALL_ENEMY_WIDTH / 2, spawnY));
        this.smallEnemyQueue--;
      }
      
      this.enemiesSpawned++;
    }
  }
  
  checkCollisions() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const bulletBounds = bullet.getBounds();
      
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const enemyBounds = {
          x: enemy.x,
          y: enemy.y,
          width: enemy.width,
          height: enemy.height
        };
        
        if (checkCollision(bulletBounds, enemyBounds)) {
          bullet.active = false;
          
          const hitCenter = getCenter(bulletBounds);
          this.particleSystem.createHitEffect(hitCenter.x, hitCenter.y, enemy.color);
          
          const isDead = enemy.takeDamage(bullet.damage);
          
          if (isDead) {
            const enemyCenter = getCenter(enemyBounds);
            this.particleSystem.createExplosion(enemyCenter.x, enemyCenter.y, enemy.color, 25);
            this.score += enemy.score;
            this.totalKills++;
            this.enemies.splice(j, 1);
            
            this.addScreenShake(10, 5);
            
            if (this.onScoreChange) this.onScoreChange(this.score);
            if (this.onEnemyCountChange) this.onEnemyCountChange(this.getRemainingEnemies());
          }
          
          break;
        }
      }
    }
  }
  
  loseLife() {
    if (this.player.isInvincible) return;
    
    this.lives--;
    this.addScreenShake(20, 10);
    
    this.player.isInvincible = true;
    this.player.invincibleEndTime = this.currentTime + 1000;
    
    if (this.onLivesChange) this.onLivesChange(this.lives);
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
    
    const totalQueued = this.largeEnemyQueue + this.smallEnemyQueue;
    const noMoreEnemies = totalQueued <= 0 && this.enemies.length === 0;
    
    if (noMoreEnemies) {
      if (this.totalKills > 6) {
        this.state = GameState.VICTORY;
      } else {
        this.state = GameState.GAME_OVER;
      }
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }
  
  render() {
    this.ctx.save();
    
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      this.ctx.translate(shakeX, shakeY);
    }
    
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    const config = LevelConfigs[this.currentLevel - 1] || LevelConfigs[0];
    this.sceneRenderer.draw(this.ctx, config);
    
    if (this.state === GameState.PLAYING || 
        this.state === GameState.PAUSED || 
        this.state === GameState.GAME_OVER ||
        this.state === GameState.VICTORY) {
      
      if (this.ultimateWave && this.ultimateWave.active) {
        this.drawUltimateWave();
      }
      
      for (const bullet of this.bullets) {
        bullet.draw(this.ctx);
      }
      
      for (const enemy of this.enemies) {
        enemy.draw(this.ctx);
      }
      
      if (this.player) {
        this.player.draw(this.ctx, this.currentTime);
      }
      
      this.particleSystem.draw(this.ctx);
    }
    
    this.ctx.restore();
  }
  
  drawUltimateWave() {
    const ctx = this.ctx;
    const y = this.ultimateWave.y;
    
    const gradient = ctx.createLinearGradient(0, y - 50, 0, y + 50);
    gradient.addColorStop(0, 'rgba(255, 71, 87, 0)');
    gradient.addColorStop(0.4, 'rgba(255, 71, 87, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 71, 87, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 71, 87, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y - 50, this.width, 100);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = GameConfig.ULTIMATE_COLOR;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }
  
  getGameData() {
    return {
      level: this.currentLevel,
      score: this.score,
      lives: this.lives,
      kills: this.totalKills,
      state: this.state
    };
  }
  
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}
