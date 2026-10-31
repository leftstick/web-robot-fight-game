import { getBackground } from './SpriteSheet.js';
import { PARALLAX } from '../config/assets.js';
import { GameConfig } from '../config/gameConfig.js';

// 图片视差背景：每关 6 层（sky/far/mid/near/fg/ground）
// 滚动系数：sky 0.05, far 0.1, mid 0.3, near 0.6, fg 1.0, ground 1.0
// 背景层 576px 横向平铺。绘制顺序：
//   drawBackdrop() -> 世界（含地面、平台、角色）-> drawForeground()
// 这样雨和前景剪影会盖在角色前面，形成真正的纵深。

const NEON_POOLS = {
  1: [
    { x: 86, y: 196, r: 98, color: '#ff2e88', a: 0.10 },
    { x: 342, y: 188, r: 82, color: '#00e5ff', a: 0.08 },
    { x: 476, y: 202, r: 70, color: '#ffb347', a: 0.06 },
  ],
  2: [
    { x: 120, y: 198, r: 96, color: '#2ee6c8', a: 0.09 },
    { x: 318, y: 190, r: 86, color: '#ffb347', a: 0.08 },
    { x: 508, y: 204, r: 72, color: '#00e5ff', a: 0.06 },
  ],
  3: [
    { x: 74, y: 196, r: 104, color: '#ff2e4a', a: 0.10 },
    { x: 356, y: 190, r: 88, color: '#b14aed', a: 0.08 },
    { x: 500, y: 204, r: 74, color: '#ff8a3d', a: 0.06 },
  ],
  4: [
    { x: 96, y: 198, r: 102, color: '#8dff5a', a: 0.10 },
    { x: 330, y: 192, r: 86, color: '#39e6ff', a: 0.08 },
    { x: 500, y: 204, r: 72, color: '#ffe066', a: 0.05 },
  ],
};

export class SceneRenderer {
  constructor(canvasWidth, canvasHeight) {
    // canvasWidth/Height 为逻辑尺寸（480x270）
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.currentLevelId = 1;
    this.rain = [];
    this.time = 0;
    this.streetCache = { id: 0, width: 0, items: [], vents: [] };
    this.initRain();
  }

  initRain() {
    for (let i = 0; i < 120; i++) {
      const near = i > 76;
      this.rain.push({
        x: Math.random() * (this.w + 100) - 50,
        y: Math.random() * this.h,
        len: near ? 8 + Math.random() * 11 : 4 + Math.random() * 7,
        speed: near ? 7 + Math.random() * 5 : 3.5 + Math.random() * 3,
        alpha: near ? 0.16 + Math.random() * 0.22 : 0.06 + Math.random() * 0.12,
        near,
      });
    }
  }

  setLevel(levelId) {
    if (this.currentLevelId !== levelId) {
      this.currentLevelId = levelId;
      this.streetCache = { id: 0, width: 0, items: [], vents: [] };
    }
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

  // 平铺绘制背景层（屏幕空间）
  drawLayer(ctx, img, cameraX, parallax) {
    if (!img) return;
    const tileW = img.width; // 576 = 480 * 1.2
    const offset = -(cameraX * parallax);
    let startX = offset % tileW;
    if (startX > 0) startX -= tileW;
    for (let x = startX; x < this.w; x += tileW) {
      ctx.drawImage(img, x, 0);
    }
  }

  // 天空 + 远/中/近景 + 背景雾气
  drawBackdrop(ctx, cameraX, level) {
    this.setLevel(level.id);
    const lv = this.currentLevelId;

    this.drawLayer(ctx, getBackground(lv, 'sky'), cameraX, PARALLAX.sky);
    this.drawLayer(ctx, getBackground(lv, 'far'), cameraX, PARALLAX.far);
    this.drawLayer(ctx, getBackground(lv, 'mid'), cameraX, PARALLAX.mid);
    this.drawLayer(ctx, getBackground(lv, 'near'), cameraX, PARALLAX.near);

    this.drawAirTraffic(ctx, cameraX);
    this.drawAmbientLight(ctx, cameraX, lv);
    this.drawBackFog(ctx);
  }

  // 远处飞行车流：只给 2-3px 的灯点与拖尾，增加城市活气
  drawAirTraffic(ctx, cameraX) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const speed = 5 + i * 3.5;
      const x = ((this.time * speed * 0.06 + i * 240 - cameraX * 0.30) % 760 + 760) % 760 - 140;
      const y = 76 + i * 24 + Math.sin(this.time / 1300 + i * 2.1) * 3;
      const dir = i === 1 ? -1 : 1;
      // 拖尾
      ctx.fillStyle = i === 1 ? 'rgba(255,90,120,0.25)' : 'rgba(110,230,255,0.22)';
      ctx.fillRect(Math.round(x - dir * 10), Math.round(y), 10, 1);
      ctx.fillStyle = i === 1 ? 'rgba(255,46,74,0.55)' : 'rgba(0,229,255,0.55)';
      ctx.fillRect(Math.round(x), Math.round(y - 1), 3, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(Math.round(x + dir), Math.round(y - 1), 1, 1);
    }
    ctx.restore();
  }

  // 霓虹在潮湿空气里的散射：沿背景层平铺的低透明度光池
  drawAmbientLight(ctx, cameraX, lv) {
    const pools = NEON_POOLS[lv] || NEON_POOLS[1];
    const tileW = 576;
    const parallax = PARALLAX.near;
    const offset = -(cameraX * parallax);
    let startX = offset % tileW;
    if (startX > 0) startX -= tileW;
    const pulse = 0.85 + 0.15 * Math.sin(this.time / 640);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let origin = startX; origin < this.w + tileW; origin += tileW) {
      for (let pi = 0; pi < pools.length; pi++) {
        const p = pools[pi];
        const sx = origin + p.x;
        if (sx + p.r < 0 || sx - p.r > this.w) continue;
        // 每块招牌有独立相位的轻微闪烁，避免整屏一起呼吸
        const flick = 0.92 + 0.08 * Math.sin(this.time / (380 + pi * 170) + pi * 2.4);
        const a = p.a * pulse * flick;
        const g = ctx.createRadialGradient(sx, p.y, 0, sx, p.y, p.r);
        g.addColorStop(0, hexToRgba(p.color, a));
        g.addColorStop(0.5, hexToRgba(p.color, a * 0.35));
        g.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sx - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }
    ctx.restore();
  }

  // 湿地面霓虹光池：必须在 ground 之后绘制，否则会被地面层盖掉。
  drawWetGlow(ctx, cameraX) {
    const pools = NEON_POOLS[this.currentLevelId] || NEON_POOLS[1];
    const tileW = 576;
    const offset = -(cameraX * PARALLAX.near);
    let startX = offset % tileW;
    if (startX > 0) startX -= tileW;
    const pulse = 0.9 + 0.1 * Math.sin(this.time / 520);

    ctx.save();
    // 调用方在世界坐标里，这里换回屏幕坐标
    ctx.translate(Math.round(cameraX), 0);
    ctx.globalCompositeOperation = 'lighter';
    for (let origin = startX; origin < this.w + tileW; origin += tileW) {
      for (const p of pools) {
        const sx = origin + p.x;
        if (sx + p.r < 0 || sx - p.r > this.w) continue;
        ctx.save();
        ctx.translate(sx, 239);
        ctx.scale(1, 0.20);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 0.95);
        g.addColorStop(0, hexToRgba(p.color, p.a * 1.15 * pulse));
        g.addColorStop(0.5, hexToRgba(p.color, p.a * 0.38 * pulse));
        g.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 生成不会每帧变化的街道小物与蒸汽口（按关卡缓存）
  ensureStreetProps(level) {
    const cache = this.streetCache;
    if (cache.id === level.id && cache.width === level.worldWidth && cache.items.length) return cache;
    const rnd = seeded(7000 + level.id * 911);
    const items = [];
    const types = ['trash', 'box', 'cone', 'hydrant', 'bottle', 'paper', 'coil', 'bag', 'cone', 'trash'];
    let x = 48 + Math.floor(rnd() * 70);
    while (x < level.worldWidth - 30) {
      items.push({ x, type: types[Math.floor(rnd() * types.length)], v: Math.floor(rnd() * 3) });
      x += 90 + Math.floor(rnd() * 150);
    }
    let px = 120 + rnd() * 70;
    while (px < level.worldWidth - 40) {
      items.push({ x: px, type: 'puddle', v: Math.floor(rnd() * 3) });
      px += 170 + rnd() * 180;
    }
    const vents = [];
    let vx = 180 + rnd() * 90;
    while (vx < level.worldWidth - 80) {
      const vent = { x: vx, phase: rnd() * Math.PI * 2, size: 0.8 + rnd() * 0.5 };
      vents.push(vent);
      items.push({ x: vx, type: 'vent', v: 0 });
      vx += 300 + rnd() * 230;
    }
    items.sort((a, b) => a.x - b.x);
    this.streetCache = { id: level.id, width: level.worldWidth, items, vents };
    return this.streetCache;
  }

  // 贴地小物：只画剪影和 1px 反光，不参与碰撞
  drawStreetProps(ctx, cameraX, level) {
    const cache = this.ensureStreetProps(level);
    const accent = level.id === 2 ? '#2ee6c8' : (level.id === 3 ? '#ff2e4a' : (level.id === 4 ? '#8dff5a' : '#00e5ff'));
    const accent2 = level.id === 2 ? '#ffb347' : (level.id === 3 ? '#b14aed' : (level.id === 4 ? '#39e6ff' : '#ff2e88'));
    const ground = GameConfig.GROUND_Y;
    for (const it of cache.items) {
      if (it.x < cameraX - 30 || it.x > cameraX + this.w + 30) continue;
      const x = Math.round(it.x);
      const v = it.v || 0;
      ctx.save();
      switch (it.type) {
        case 'trash': {
          ctx.fillStyle = '#05050a';
          ctx.fillRect(x - 7, ground - 6, 11, 6);
          ctx.fillRect(x - 5, ground - 9, 7, 4);
          ctx.fillRect(x + 2, ground - 5, 7, 5);
          ctx.fillStyle = '#0b0a12';
          ctx.fillRect(x - 6, ground - 7, 5, 1);
          ctx.fillRect(x - 3, ground - 10, 4, 1);
          ctx.fillStyle = 'rgba(255,46,136,0.10)';
          ctx.fillRect(x - 4, ground - 8, 2, 1);
          break;
        }
        case 'box': {
          ctx.fillStyle = '#100c0b';
          ctx.fillRect(x - 6, ground - 7, 12, 7);
          ctx.fillStyle = '#1b1410';
          ctx.fillRect(x - 5, ground - 6, 10, 2);
          ctx.fillStyle = '#2a1d14';
          ctx.fillRect(x - 5, ground - 5, 10, 1);
          ctx.fillStyle = 'rgba(255,179,71,0.18)';
          ctx.fillRect(x - 1, ground - 6, 2, 2);
          break;
        }
        case 'cone': {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x - 4, ground, 9, 1);
          ctx.fillStyle = '#6b2a10';
          ctx.fillRect(x - 3, ground - 8, 6, 8);
          ctx.fillStyle = '#d1601e';
          ctx.fillRect(x - 2, ground - 7, 4, 6);
          ctx.fillStyle = '#ffd9a0';
          ctx.fillRect(x - 2, ground - 6, 4, 1);
          ctx.fillStyle = '#2a1208';
          ctx.fillRect(x - 4, ground - 1, 8, 1);
          break;
        }
        case 'hydrant': {
          ctx.fillStyle = '#05050a';
          ctx.fillRect(x - 3, ground - 10, 7, 10);
          ctx.fillStyle = '#4a1218';
          ctx.fillRect(x - 2, ground - 9, 5, 8);
          ctx.fillStyle = '#7a2530';
          ctx.fillRect(x - 1, ground - 8, 2, 4);
          ctx.fillStyle = '#2a0a0e';
          ctx.fillRect(x - 4, ground - 7, 2, 3);
          ctx.fillRect(x + 3, ground - 7, 2, 3);
          ctx.fillStyle = 'rgba(255,46,74,0.20)';
          ctx.fillRect(x, ground - 9, 1, 3);
          break;
        }
        case 'bottle': {
          ctx.fillStyle = 'rgba(45,120,80,0.55)';
          ctx.fillRect(x, ground - 4, 2, 4);
          ctx.fillStyle = 'rgba(200,255,220,0.20)';
          ctx.fillRect(x, ground - 4, 1, 1);
          break;
        }
        case 'paper': {
          ctx.fillStyle = 'rgba(195,205,220,0.22)';
          ctx.fillRect(x - 2, ground - 1, 4, 1);
          ctx.fillRect(x, ground - 2, 2, 1);
          break;
        }
        case 'coil': {
          ctx.strokeStyle = '#06050a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, ground - 2, 5, 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,229,255,0.12)';
          ctx.fillRect(x + 2, ground - 3, 2, 1);
          break;
        }
        case 'bag': {
          ctx.fillStyle = '#08070d';
          ctx.fillRect(x - 3, ground - 4, 7, 4);
          ctx.fillRect(x - 1, ground - 6, 4, 2);
          ctx.fillStyle = 'rgba(255,46,136,0.08)';
          ctx.fillRect(x - 2, ground - 4, 2, 1);
          break;
        }
        case 'puddle': {
          const w = 11 + v * 5;
          ctx.fillStyle = 'rgba(4,7,13,0.55)';
          ctx.fillRect(x - w / 2, ground + 2 + v, w, 3);
          ctx.fillStyle = 'rgba(10,22,38,0.55)';
          ctx.fillRect(x - w / 2 + 2, ground + 3 + v, w - 4, 1);
          ctx.fillStyle = v % 2 ? hexToRgba(accent, 0.28) : hexToRgba(accent2, 0.24);
          ctx.fillRect(x - w / 2 + 3, ground + 2 + v, Math.max(2, w - 8), 1);
          ctx.fillStyle = hexToRgba(accent, 0.12);
          ctx.fillRect(x - 2, ground + 4 + v, Math.max(2, w - 7), 1);
          break;
        }
        case 'vent': {
          ctx.fillStyle = '#08080e';
          ctx.fillRect(x - 7, ground + 2, 14, 3);
          ctx.fillStyle = '#20222c';
          ctx.fillRect(x - 6, ground + 2, 12, 1);
          for (let gx = -5; gx <= 5; gx += 2) {
            ctx.fillStyle = '#11121a';
            ctx.fillRect(x + gx, ground + 3, 1, 2);
          }
          ctx.fillStyle = hexToRgba(accent, 0.14);
          ctx.fillRect(x - 6, ground + 5, 12, 1);
          break;
        }
        default: break;
      }
      ctx.restore();
    }
  }

  // 地面蒸汽：画在角色之后，形成前景层次
  drawSteam(ctx, cameraX, level) {
    const cache = this.ensureStreetProps(level);
    const tint = level.id === 2 ? '130,240,220' : (level.id === 3 ? '255,150,150' : (level.id === 4 ? '160,235,140' : '165,205,235'));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const vent of cache.vents) {
      const sx = Math.round(vent.x - cameraX);
      if (sx < -60 || sx > this.w + 60) continue;
      for (let i = 0; i < 12; i++) {
        const t = ((this.time / 2600 + i / 12 + vent.phase) % 1);
        const py = 234 - t * (48 + vent.size * 18);
        const px = sx + Math.sin(t * 5.2 + i * 1.7 + this.time / 760) * (2 + t * 7);
        const pw = 1 + Math.floor(t * 3);
        const a = (1 - t) * 0.085;
        ctx.fillStyle = `rgba(${tint},${a})`;
        ctx.fillRect(Math.round(px), Math.round(py), pw, 1 + Math.floor(t * 2));
        if (i % 3 === 0) {
          ctx.fillStyle = `rgba(${tint},${a * 0.5})`;
          ctx.fillRect(Math.round(px) - 1, Math.round(py) + 1, pw + 2, 1);
        }
      }
      ctx.fillStyle = `rgba(${tint},0.06)`;
      ctx.fillRect(sx - 8, 234, 16, 1);
    }
    ctx.restore();
  }

  // 雨点落地：按世界坐标重复，随镜头滚动
  drawSplashes(ctx, cameraX) {
    const ground = GameConfig.GROUND_Y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      const base = (i * 173 + 41) % 576;
      const sx = ((base - cameraX) % 576 + 576) % 576;
      const sy = ground + 1 + ((i * 7) % 25);
      const phase = (this.time / (480 + i * 17) + i * 0.37) % 1;
      if (phase > 0.32) continue;
      const a = (1 - phase / 0.32) * 0.30;
      const splashRgb = this.currentLevelId === 4 ? '190,255,175' : '190,220,255';
      ctx.fillStyle = `rgba(${splashRgb},${a})`;
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 1);
      ctx.fillStyle = `rgba(${splashRgb},${a * 0.45})`;
      ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 1, 1);
      ctx.fillRect(Math.round(sx) + 2, Math.round(sy) - 1, 1, 1);
    }
    ctx.restore();
  }

  // 贴地层雾气，压住远景底部，把角色衬出来
  drawBackFog(ctx) {
    const g = ctx.createLinearGradient(0, 168, 0, 238);
    g.addColorStop(0, 'rgba(28, 40, 66, 0)');
    g.addColorStop(0.65, 'rgba(28, 40, 66, 0.12)');
    g.addColorStop(1, 'rgba(18, 28, 48, 0.40)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 168, this.w, 70);
  }

  // 地面层：必须在 world 平移后的坐标里绘制，否则会被相机偏移两次。
  drawGround(ctx, cameraX) {
    const img = getBackground(this.currentLevelId, 'ground');
    if (!img) return;
    const tileW = img.width;
    const start = Math.floor(cameraX / tileW) * tileW;
    for (let x = start; x < cameraX + this.w + tileW; x += tileW) {
      ctx.drawImage(img, x, 0);
    }
  }

  // 前景剪影 + 雨 + 贴地雾，绘制在世界之后
  drawForeground(ctx, cameraX, level) {
    this.setLevel(level.id);
    const lv = this.currentLevelId;

    this.drawLayer(ctx, getBackground(lv, 'fg'), cameraX, PARALLAX.fg);
    this.drawSteam(ctx, cameraX, level);
    this.drawRain(ctx);
    this.drawSplashes(ctx, cameraX);
    this.drawFrontFog(ctx);
  }

  drawFrontFog(ctx) {
    const g = ctx.createLinearGradient(0, 218, 0, this.h);
    g.addColorStop(0, 'rgba(10, 18, 30, 0)');
    g.addColorStop(0.55, 'rgba(10, 18, 30, 0.10)');
    g.addColorStop(1, 'rgba(10, 18, 30, 0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 218, this.w, this.h - 218);
  }

  drawRain(ctx) {
    // 第 4 关是酸雨，雨丝偏黄绿，和冷色霓虹区分开
    ctx.strokeStyle = this.currentLevelId === 4
      ? 'rgba(180,255,150,0.42)'
      : 'rgba(180,210,255,0.45)';
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

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
