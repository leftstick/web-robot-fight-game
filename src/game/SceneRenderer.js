import { GameConfig } from '../config/gameConfig.js';
import { getBackground } from './SpriteSheet.js';
import { PARALLAX, BG_TILE } from '../config/assets.js';

// 图片视差背景：每关 6 层（sky/far/mid/near/fg/ground）
// 滚动系数：sky 0.05, far 0.1, mid 0.3, near 0.6, fg 1.0, ground 1.0
// 背景层 1.2 横向平铺。

export class SceneRenderer {
  constructor(canvasWidth, canvasHeight) {
    // canvasWidth/Height 为逻辑尺寸（480x270）
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.currentLevelId = 1;
    this.rain = [];
    this.time = 0;
    this.initRain();
  }

  initRain() {
    for (let i = 0; i < 90; i++) {
      this.rain.push({
        x: Math.random() * (this.w + 100) - 50,
        y: Math.random() * this.h,
        len: 5 + Math.random() * 9,
        speed: 5 + Math.random() * 5,
        alpha: 0.10 + Math.random() * 0.20,
      });
    }
  }

  setLevel(levelId, worldWidth) {
    this.currentLevelId = levelId;
  }

  update(deltaTime) {
    this.time += deltaTime;
    for (const d of this.rain) {
      d.y += d.speed;
      d.x -= d.speed * 0.18;
      if (d.y > this.h) {
        d.y = -10;
        d.x = Math.random() * (this.w + 100) - 50;
      }
    }
  }

  // 平铺绘制背景层
  drawLayer(ctx, img, cameraX, parallax) {
    if (!img) return;
    const tileW = img.width; // 576 = 480 * 1.2
    const offset = -(cameraX * parallax);
    // 计算起始 x，保证覆盖整个屏幕
    let startX = offset % tileW;
    if (startX > 0) startX -= tileW;
    for (let x = startX; x < this.w; x += tileW) {
      ctx.drawImage(img, x, 0);
    }
  }

  draw(ctx, cameraX, level) {
    this.setLevel(level.id, level.worldWidth);
    const lv = this.currentLevelId;

    // 各层背景图（从底到顶）
    this.drawLayer(ctx, getBackground(lv, 'sky'), cameraX, PARALLAX.sky);
    this.drawLayer(ctx, getBackground(lv, 'far'), cameraX, PARALLAX.far);
    this.drawLayer(ctx, getBackground(lv, 'mid'), cameraX, PARALLAX.mid);
    this.drawLayer(ctx, getBackground(lv, 'near'), cameraX, PARALLAX.near);

    // 雨
    this.drawRain(ctx);

    // 前景剪影
    this.drawLayer(ctx, getBackground(lv, 'fg'), cameraX, PARALLAX.fg);
  }

  // 地面层（在 world 绘制后调用，作为地面）
  drawGround(ctx, cameraX, level) {
    const lv = this.currentLevelId;
    this.drawLayer(ctx, getBackground(lv, 'ground'), cameraX, PARALLAX.ground);
  }

  drawRain(ctx) {
    ctx.strokeStyle = 'rgba(180,210,255,0.45)';
    ctx.lineWidth = 1;
    for (const d of this.rain) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
