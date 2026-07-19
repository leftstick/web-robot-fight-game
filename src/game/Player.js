import { GameConfig } from '../config/gameConfig.js';
import { Bullet, BulletType } from './Bullet.js';

export const DodgeDirection = {
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down'
};

export class Player {
  constructor(canvasWidth, canvasHeight) {
    this.width = GameConfig.PLAYER_WIDTH;
    this.height = GameConfig.PLAYER_HEIGHT;
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = canvasHeight - GameConfig.PLAYER_Y_OFFSET - this.height;
    this.baseY = this.y;
    this.speed = GameConfig.PLAYER_SPEED;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    
    this.moveLeft = false;
    this.moveRight = false;
    
    this.lastLightFireTime = 0;
    this.lastHeavyFireTime = 0;
    this.lastUltimateTime = -GameConfig.ULTIMATE_COOLDOWN;
    
    this.engineFlicker = 0;
    
    this.isDodging = false;
    this.dodgeDirection = null;
    this.dodgeStartTime = 0;
    this.dodgeStartX = 0;
    this.dodgeStartY = 0;
    this.lastDodgeTime = -GameConfig.DODGE_COOLDOWN;
    this.isInvincible = false;
    this.invincibleEndTime = 0;
    
    this.ultimateActive = false;
    this.ultimateProgress = 0;
    
    this.targetX = null;
  }
  
  update(deltaTime, currentTime) {
    if (!this.isDodging) {
      if (this.moveLeft) {
        this.x -= this.speed;
      }
      if (this.moveRight) {
        this.x += this.speed;
      }
      // 触控：直接设置目标位置（平滑跟随手指）
      if (this.targetX !== null) {
        const dx = this.targetX - (this.x + this.width / 2);
        if (Math.abs(dx) > 1) {
          this.x += dx * 0.3;
        } else {
          this.x = this.targetX - this.width / 2;
        }
      }
    } else {
      this.updateDodge(currentTime);
    }
    
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > this.canvasWidth) {
      this.x = this.canvasWidth - this.width;
    }
    
    if (this.y < 100) this.y = 100;
    if (this.y + this.height > this.canvasHeight - 20) {
      this.y = this.canvasHeight - 20 - this.height;
    }
    
    if (this.isInvincible && currentTime > this.invincibleEndTime) {
      this.isInvincible = false;
    }
    
    this.engineFlicker += deltaTime * 0.02;
  }
  
  setTargetX(x) {
    this.targetX = x;
  }
  
  clearTargetX() {
    this.targetX = null;
  }
  
  tryLightFire(currentTime) {
    if (currentTime - this.lastLightFireTime >= GameConfig.LIGHT_FIRE_RATE) {
      this.lastLightFireTime = currentTime;
      return true;
    }
    return false;
  }
  
  tryHeavyFire(currentTime) {
    if (currentTime - this.lastHeavyFireTime >= GameConfig.HEAVY_FIRE_RATE) {
      this.lastHeavyFireTime = currentTime;
      return true;
    }
    return false;
  }
  
  tryUltimate(currentTime) {
    if (currentTime - this.lastUltimateTime >= GameConfig.ULTIMATE_COOLDOWN) {
      this.lastUltimateTime = currentTime;
      this.ultimateActive = true;
      this.ultimateProgress = 0;
      return true;
    }
    return false;
  }
  
  getUltimateCooldownPercent(currentTime) {
    const elapsed = currentTime - this.lastUltimateTime;
    return Math.min(1, elapsed / GameConfig.ULTIMATE_COOLDOWN);
  }
  
  getDodgeCooldownPercent(currentTime) {
    const elapsed = currentTime - this.lastDodgeTime;
    return Math.min(1, elapsed / GameConfig.DODGE_COOLDOWN);
  }
  
  dodge(direction, currentTime) {
    if (this.isDodging) return false;
    if (currentTime - this.lastDodgeTime < GameConfig.DODGE_COOLDOWN) return false;
    
    this.isDodging = true;
    this.dodgeDirection = direction;
    this.dodgeStartTime = currentTime;
    this.dodgeStartX = this.x;
    this.dodgeStartY = this.y;
    this.lastDodgeTime = currentTime;
    this.isInvincible = true;
    this.invincibleEndTime = currentTime + GameConfig.DODGE_INVINCIBLE_DURATION;
    
    return true;
  }
  
  updateDodge(currentTime) {
    const elapsed = currentTime - this.dodgeStartTime;
    const progress = Math.min(1, elapsed / GameConfig.DODGE_DURATION);
    
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    let targetX = this.dodgeStartX;
    let targetY = this.dodgeStartY;
    
    switch (this.dodgeDirection) {
      case DodgeDirection.LEFT:
        targetX -= GameConfig.DODGE_DISTANCE;
        break;
      case DodgeDirection.RIGHT:
        targetX += GameConfig.DODGE_DISTANCE;
        break;
      case DodgeDirection.UP:
        targetY -= GameConfig.DODGE_DISTANCE * 0.6;
        break;
      case DodgeDirection.DOWN:
        targetY += GameConfig.DODGE_DISTANCE * 0.6;
        break;
    }
    
    this.x = this.dodgeStartX + (targetX - this.dodgeStartX) * easeProgress;
    this.y = this.dodgeStartY + (targetY - this.dodgeStartY) * easeProgress;
    
    if (progress >= 1) {
      this.isDodging = false;
      this.dodgeDirection = null;
    }
  }
  
  getLightBulletSpawnPosition() {
    return {
      x: this.x + this.width / 2 - GameConfig.LIGHT_BULLET_WIDTH / 2,
      y: this.y - GameConfig.LIGHT_BULLET_HEIGHT
    };
  }
  
  getHeavyBulletSpawnPosition() {
    return {
      x: this.x + this.width / 2 - GameConfig.HEAVY_BULLET_WIDTH / 2,
      y: this.y - GameConfig.HEAVY_BULLET_HEIGHT
    };
  }
  
  createLightBullet() {
    const pos = this.getLightBulletSpawnPosition();
    return new Bullet(pos.x, pos.y, BulletType.LIGHT, {
      width: GameConfig.LIGHT_BULLET_WIDTH,
      height: GameConfig.LIGHT_BULLET_HEIGHT,
      speed: GameConfig.LIGHT_BULLET_SPEED,
      damage: GameConfig.LIGHT_BULLET_DAMAGE,
      color: GameConfig.LIGHT_BULLET_COLOR
    });
  }
  
  createHeavyBullet() {
    const pos = this.getHeavyBulletSpawnPosition();
    return new Bullet(pos.x, pos.y, BulletType.HEAVY, {
      width: GameConfig.HEAVY_BULLET_WIDTH,
      height: GameConfig.HEAVY_BULLET_HEIGHT,
      speed: GameConfig.HEAVY_BULLET_SPEED,
      damage: GameConfig.HEAVY_BULLET_DAMAGE,
      color: GameConfig.HEAVY_BULLET_COLOR
    });
  }
  
  draw(ctx, currentTime) {
    ctx.save();
    
    if (this.isInvincible) {
      ctx.globalAlpha = 0.5 + Math.sin(currentTime * 0.03) * 0.3;
    }
    
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    const flickerIntensity = (Math.sin(this.engineFlicker) + 1) / 2;
    
    const engineGlow = ctx.createRadialGradient(
      cx, this.y + this.height + 10, 0,
      cx, this.y + this.height + 10, 30
    );
    engineGlow.addColorStop(0, `rgba(0, 212, 255, ${0.6 + flickerIntensity * 0.4})`);
    engineGlow.addColorStop(0.5, `rgba(0, 212, 255, ${0.2 + flickerIntensity * 0.2})`);
    engineGlow.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = engineGlow;
    ctx.fillRect(this.x - 20, this.y + this.height - 5, this.width + 40, 40);
    
    ctx.fillStyle = GameConfig.COLORS.playerBody;
    ctx.strokeStyle = GameConfig.COLORS.playerAccent;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(cx, this.y);
    ctx.lineTo(this.x + this.width - 5, this.y + this.height * 0.4);
    ctx.lineTo(this.x + this.width - 8, this.y + this.height * 0.7);
    ctx.lineTo(this.x + this.width - 3, this.y + this.height);
    ctx.lineTo(this.x + 3, this.y + this.height);
    ctx.lineTo(this.x + 8, this.y + this.height * 0.7);
    ctx.lineTo(this.x + 5, this.y + this.height * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, this.y + this.height * 0.35, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 2, this.y + this.height * 0.32, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = GameConfig.COLORS.playerAccent;
    ctx.fillRect(this.x + 8, this.y + this.height * 0.5, 8, this.height * 0.35);
    ctx.fillRect(this.x + this.width - 16, this.y + this.height * 0.5, 8, this.height * 0.35);
    
    const flameHeight = 12 + flickerIntensity * 8;
    const flameGradient = ctx.createLinearGradient(
      cx, this.y + this.height,
      cx, this.y + this.height + flameHeight
    );
    flameGradient.addColorStop(0, '#ffffff');
    flameGradient.addColorStop(0.3, GameConfig.COLORS.primary);
    flameGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = flameGradient;
    ctx.beginPath();
    ctx.moveTo(cx - 8, this.y + this.height);
    ctx.lineTo(cx, this.y + this.height + flameHeight);
    ctx.lineTo(cx + 8, this.y + this.height);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowColor = GameConfig.COLORS.primary;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = GameConfig.COLORS.primary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, this.y);
    ctx.lineTo(this.x + this.width - 5, this.y + this.height * 0.4);
    ctx.stroke();
    
    if (this.isDodging) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = GameConfig.COLORS.primary;
      ctx.fillRect(this.x - 5, this.y, this.width + 10, this.height);
    }
    
    ctx.restore();
  }
  
  reset() {
    this.x = this.canvasWidth / 2 - this.width / 2;
    this.y = this.baseY;
    this.moveLeft = false;
    this.moveRight = false;
    this.lastLightFireTime = 0;
    this.lastHeavyFireTime = 0;
    this.lastUltimateTime = -GameConfig.ULTIMATE_COOLDOWN;
    this.isDodging = false;
    this.isInvincible = false;
    this.ultimateActive = false;
    this.targetX = null;
  }
}
