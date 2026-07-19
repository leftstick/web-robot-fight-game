import { GameConfig, LevelConfigs } from '../config/gameConfig.js';

export class SceneRenderer {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.currentScene = 'space';
    this.bgCache = null;
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = canvasWidth;
    this.bgCanvas.height = canvasHeight;
    this.bgCtx = this.bgCanvas.getContext('2d');
    
    this.stars = [];
    this.bubbles = [];
    this.sandParticles = [];
    this.leaves = [];
    this.clouds = [];
    
    this.animationTime = 0;
    this.initBackgroundElements();
  }
  
  initBackgroundElements() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    
    for (let i = 0; i < 20; i++) {
      this.bubbles.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: Math.random() * 15 + 5,
        speed: Math.random() * 1 + 0.5,
        wobble: Math.random() * Math.PI * 2
      });
    }
    
    for (let i = 0; i < 30; i++) {
      this.sandParticles.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    
    for (let i = 0; i < 15; i++) {
      this.leaves.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: Math.random() * 10 + 5,
        speed: Math.random() * 1.5 + 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1
      });
    }
    
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight * 0.6,
        width: Math.random() * 150 + 100,
        height: Math.random() * 40 + 30,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.3 + 0.2
      });
    }
  }
  
  setScene(sceneType) {
    this.currentScene = sceneType;
    this.renderCachedBackground();
  }
  
  renderCachedBackground() {
    const config = LevelConfigs.find(c => c.scene === this.currentScene);
    if (!config) return;
    
    const ctx = this.bgCtx;
    const colors = config.bgColors;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    if (config.craters) {
      this.drawStaticCraters(ctx);
    }
    
    if (config.sandDunes) {
      this.drawSandDunes(ctx);
    }
    
    if (config.grass) {
      this.drawGrass(ctx);
    }
  }
  
  drawStaticCraters(ctx) {
    const craters = [
      { x: 150, y: 200, r: 60 },
      { x: 600, y: 350, r: 80 },
      { x: 350, y: 150, r: 40 },
      { x: 700, y: 100, r: 30 },
      { x: 100, y: 450, r: 50 },
    ];
    
    for (const crater of craters) {
      const gradient = ctx.createRadialGradient(
        crater.x - crater.r * 0.3, crater.y - crater.r * 0.3, 0,
        crater.x, crater.y, crater.r
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(crater.x, crater.y, crater.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawSandDunes(ctx) {
    ctx.fillStyle = 'rgba(139, 105, 20, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, 450);
    ctx.quadraticCurveTo(200, 380, 400, 420);
    ctx.quadraticCurveTo(600, 460, 800, 400);
    ctx.lineTo(800, 600);
    ctx.lineTo(0, 600);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = 'rgba(196, 163, 90, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.quadraticCurveTo(250, 460, 500, 490);
    ctx.quadraticCurveTo(700, 520, 800, 480);
    ctx.lineTo(800, 600);
    ctx.lineTo(0, 600);
    ctx.closePath();
    ctx.fill();
  }
  
  drawGrass(ctx) {
    ctx.fillStyle = 'rgba(34, 139, 34, 0.3)';
    for (let i = 0; i < 50; i++) {
      const x = i * 20 + Math.random() * 10;
      const height = 20 + Math.random() * 30;
      const y = this.canvasHeight - height;
      
      ctx.beginPath();
      ctx.moveTo(x, this.canvasHeight);
      ctx.quadraticCurveTo(x - 5, y + height / 2, x - 3, y);
      ctx.quadraticCurveTo(x + 3, y + 5, x + 5, this.canvasHeight);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  update(deltaTime) {
    this.animationTime += deltaTime;
    
    for (const star of this.stars) {
      star.twinkle += 0.02;
    }
    
    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed;
      bubble.wobble += 0.05;
      if (bubble.y < -20) {
        bubble.y = this.canvasHeight + 20;
        bubble.x = Math.random() * this.canvasWidth;
      }
    }
    
    for (const sand of this.sandParticles) {
      sand.x += sand.speed;
      sand.y += sand.speed * 0.3;
      if (sand.x > this.canvasWidth + 10) {
        sand.x = -10;
        sand.y = Math.random() * this.canvasHeight;
      }
    }
    
    for (const leaf of this.leaves) {
      leaf.y += leaf.speed;
      leaf.x += Math.sin(this.animationTime * 0.01 + leaf.x) * 0.5;
      leaf.rotation += leaf.rotSpeed;
      if (leaf.y > this.canvasHeight + 20) {
        leaf.y = -20;
        leaf.x = Math.random() * this.canvasWidth;
      }
    }
    
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed;
      if (cloud.x - cloud.width > this.canvasWidth) {
        cloud.x = -cloud.width;
        cloud.y = Math.random() * this.canvasHeight * 0.6;
      }
    }
  }
  
  draw(ctx, config) {
    ctx.drawImage(this.bgCanvas, 0, 0);
    
    if (config.stars) {
      this.drawStars(ctx);
    }
    
    if (config.bubbles) {
      this.drawBubbles(ctx);
    }
    
    if (config.sandDunes) {
      this.drawSandParticles(ctx);
    }
    
    if (config.leaves) {
      this.drawLeaves(ctx);
    }
    
    if (config.clouds) {
      this.drawClouds(ctx);
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }
  
  drawStars(ctx) {
    for (const star of this.stars) {
      const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawBubbles(ctx) {
    for (const bubble of this.bubbles) {
      const wobbleX = Math.sin(bubble.wobble) * 10;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bubble.x + wobbleX, bubble.y, bubble.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(
        bubble.x + wobbleX - bubble.size * 0.3,
        bubble.y - bubble.size * 0.3,
        bubble.size * 0.2,
        0, Math.PI * 2
      );
      ctx.fill();
    }
  }
  
  drawSandParticles(ctx) {
    for (const sand of this.sandParticles) {
      ctx.fillStyle = `rgba(196, 163, 90, ${sand.opacity})`;
      ctx.beginPath();
      ctx.arc(sand.x, sand.y, sand.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawLeaves(ctx) {
    for (const leaf of this.leaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      
      ctx.fillStyle = 'rgba(34, 139, 34, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(0, 100, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-leaf.size, 0);
      ctx.lineTo(leaf.size, 0);
      ctx.stroke();
      
      ctx.restore();
    }
  }
  
  drawClouds(ctx) {
    for (const cloud of this.clouds) {
      const gradient = ctx.createRadialGradient(
        cloud.x + cloud.width * 0.3, cloud.y, 0,
        cloud.x + cloud.width * 0.3, cloud.y, cloud.width * 0.6
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${cloud.opacity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(
        cloud.x + cloud.width * 0.3, cloud.y,
        cloud.width * 0.5, cloud.height * 0.5,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(
        cloud.x + cloud.width * 0.6, cloud.y + 10,
        cloud.width * 0.4, cloud.height * 0.4,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}
