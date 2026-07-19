import { GameConfig } from '../config/gameConfig.js';

export class Enemy {
  constructor(x, y, width, height, hp, speed, score, color, accentColor) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.score = score;
    this.color = color;
    this.accentColor = accentColor;
    
    this.wobbleOffset = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.003 + Math.random() * 0.002;
    this.wobbleAmplitude = 20 + Math.random() * 30;
    this.baseX = x;
    
    this.hitFlash = 0;
    this.damageFlashDuration = 150;
  }
  
  update(deltaTime, currentTime) {
    this.y += this.speed;
    this.wobbleOffset += this.wobbleSpeed * deltaTime;
    this.x = this.baseX + Math.sin(this.wobbleOffset) * this.wobbleAmplitude;
    
    if (this.hitFlash > 0) {
      this.hitFlash -= deltaTime;
    }
  }
  
  takeDamage(damage) {
    this.hp -= damage;
    this.hitFlash = this.damageFlashDuration;
    return this.hp <= 0;
  }
  
  draw(ctx) {
    ctx.save();
    
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.8;
    }
    
    this.drawBody(ctx, cx, cy);
    
    const hpBarWidth = this.width;
    const hpBarHeight = 6;
    const hpBarY = this.y - 12;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(this.x, hpBarY, hpBarWidth, hpBarHeight);
    
    const hpPercent = this.hp / this.maxHp;
    let hpColor = GameConfig.COLORS.success;
    if (hpPercent < 0.3) {
      hpColor = GameConfig.COLORS.danger;
    } else if (hpPercent < 0.6) {
      hpColor = GameConfig.COLORS.warning;
    }
    ctx.fillStyle = hpColor;
    ctx.fillRect(this.x, hpBarY, hpBarWidth * hpPercent, hpBarHeight);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, hpBarY, hpBarWidth, hpBarHeight);
    
    ctx.restore();
  }
  
  drawBody(ctx, cx, cy) {
  }
  
  isOffScreen(canvasHeight) {
    return this.y > canvasHeight;
  }
}

export class SmallEnemy extends Enemy {
  constructor(x, y) {
    super(
      x, y,
      GameConfig.SMALL_ENEMY_WIDTH,
      GameConfig.SMALL_ENEMY_HEIGHT,
      GameConfig.SMALL_ENEMY_HP,
      GameConfig.SMALL_ENEMY_SPEED,
      GameConfig.SMALL_ENEMY_SCORE,
      GameConfig.COLORS.smallEnemy,
      GameConfig.COLORS.smallEnemyAccent
    );
    this.antennaPhase = Math.random() * Math.PI * 2;
  }
  
  drawBody(ctx, cx, cy) {
    const time = Date.now() * 0.005;
    this.antennaPhase += 0.05;
    
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, this.width * 0.4, this.height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, this.width * 0.3, this.height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 8, 5, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, cy - 8, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 7, 2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, cy - 7, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 16);
    ctx.lineTo(cx - 12, cy - 28 + Math.sin(this.antennaPhase) * 3);
    ctx.moveTo(cx + 8, cy - 16);
    ctx.lineTo(cx + 12, cy - 28 + Math.sin(this.antennaPhase + 1) * 3);
    ctx.stroke();
    
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 28 + Math.sin(this.antennaPhase) * 3, 3, 0, Math.PI * 2);
    ctx.arc(cx + 12, cy - 28 + Math.sin(this.antennaPhase + 1) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = this.accentColor;
    const legOffset = Math.sin(time * 2) * 2;
    for (let i = -2; i <= 2; i++) {
      const legX = cx + i * 8;
      const legY = cy + this.height * 0.3;
      ctx.beginPath();
      ctx.ellipse(legX, legY + (i % 2 === 0 ? legOffset : -legOffset), 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class LargeEnemy extends Enemy {
  constructor(x, y) {
    super(
      x, y,
      GameConfig.LARGE_ENEMY_WIDTH,
      GameConfig.LARGE_ENEMY_HEIGHT,
      GameConfig.LARGE_ENEMY_HP,
      GameConfig.LARGE_ENEMY_SPEED,
      GameConfig.LARGE_ENEMY_SCORE,
      GameConfig.COLORS.largeEnemy,
      GameConfig.COLORS.largeEnemyAccent
    );
    this.roarPhase = 0;
    this.spikeRotation = 0;
  }
  
  drawBody(ctx, cx, cy) {
    const time = Date.now() * 0.003;
    this.roarPhase = Math.sin(time) * 0.2;
    this.spikeRotation = time * 0.5;
    
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, this.width * 0.45, this.height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(cx, cy - 12, this.width * 0.35, this.height * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = this.accentColor;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + this.spikeRotation;
      const spikeX = cx + Math.cos(angle) * (this.width * 0.38);
      const spikeY = cy + 8 + Math.sin(angle) * (this.height * 0.3);
      ctx.beginPath();
      ctx.moveTo(spikeX - 4, spikeY);
      ctx.lineTo(spikeX, spikeY - 10);
      ctx.lineTo(spikeX + 4, spikeY);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 14, 7, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 10, cy - 14, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 13, 3, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 10, cy - 13, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = this.accentColor;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 22);
    ctx.lineTo(cx - 18, cy - 38);
    ctx.lineTo(cx - 6, cy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(cx + 12, cy - 22);
    ctx.lineTo(cx + 18, cy - 38);
    ctx.lineTo(cx + 6, cy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#330000';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3 + this.roarPhase * 5, 10, 6 + this.roarPhase * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    for (let i = -2; i <= 2; i++) {
      const toothX = cx + i * 4;
      ctx.beginPath();
      ctx.moveTo(toothX - 1.5, cy - 5 + this.roarPhase * 3);
      ctx.lineTo(toothX, cy + 2 + this.roarPhase * 5);
      ctx.lineTo(toothX + 1.5, cy - 5 + this.roarPhase * 3);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.fillStyle = this.accentColor;
    const armSwing = Math.sin(time * 1.5) * 5;
    
    ctx.beginPath();
    ctx.ellipse(
      this.x - 5, cy + 5 + armSwing,
      10, 18, -0.3, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.width + 5, cy + 5 - armSwing,
      10, 18, 0.3, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(this.x - 8, cy + 20 + armSwing, 8, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(this.x + this.width + 8, cy + 20 - armSwing, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
