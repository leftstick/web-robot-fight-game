import { GameConfig } from '../config/gameConfig.js';

// 横版视差背景：80 年代赛博朋克霓虹雨夜城市。
// 远/近两层视差 + 中景霓虹招牌 + 雨。所有元素横向滚动，强化"向右推进"。

function makeRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const NEON = ['#ff2e88', '#00e5ff', '#b14aed', '#39ff88', '#ff8a3d', '#ffe066'];

export class SceneRenderer {
  constructor(canvasWidth, canvasHeight) {
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.currentLevelId = 1;
    this.rain = [];
    this.time = 0;
    this.layers = null;
    this.initRain();
  }

  initRain() {
    for (let i = 0; i < 170; i++) {
      this.rain.push({
        x: Math.random() * (this.w + 200) - 100,
        y: Math.random() * this.h,
        len: 8 + Math.random() * 16,
        speed: 9 + Math.random() * 9,
        alpha: 0.12 + Math.random() * 0.22,
      });
    }
  }

  setLevel(levelId, worldWidth) {
    if (this.currentLevelId === levelId && this.layers) return;
    this.currentLevelId = levelId;
    this.layers = this.buildLayers(levelId, worldWidth);
  }

  buildLayers(levelId, worldWidth) {
    const rng = makeRng(levelId * 7919 + 13);
    const far = [];
    const mid = [];
    const near = [];

    // 远景天际线
    let x = -200;
    while (x < worldWidth * 0.2 + this.w + 200) {
      const bw = 60 + rng() * 110;
      const bh = 90 + rng() * 200;
      far.push({ x, w: bw, h: bh, tint: 0.35 + rng() * 0.25 });
      x += bw + 6;
    }

    // 中景建筑（带霓虹招牌）
    x = -200;
    while (x < worldWidth * 0.45 + this.w + 200) {
      const bw = 90 + rng() * 150;
      const bh = 150 + rng() * 220;
      const wins = [];
      const cols = Math.max(2, Math.floor(bw / 26));
      const rows = Math.max(3, Math.floor(bh / 34));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rng() < 0.55) {
            wins.push({
              x: 8 + c * ((bw - 16) / cols),
              y: 12 + r * ((bh - 24) / rows),
              w: Math.max(3, (bw - 16) / cols - 8),
              h: Math.max(3, (bh - 24) / rows - 10),
              lit: rng() < 0.6 ? NEON[Math.floor(rng() * NEON.length)] : '#ffd27a',
            });
          }
        }
      }
      const sign = rng() < 0.7
        ? { color: NEON[Math.floor(rng() * NEON.length)], h: 6 + rng() * 10, w: bw * (0.4 + rng() * 0.4), y: 10 + rng() * (bh * 0.5) }
        : null;
      mid.push({ x, w: bw, h: bh, wins, sign });
      x += bw + 14;
    }

    // 近景剪影（栏杆/招牌/树）
    x = -200;
    while (x < worldWidth * 0.85 + this.w + 200) {
      near.push({ x, w: 40 + rng() * 90, h: 40 + rng() * 90, kind: rng() < 0.5 ? 'fence' : 'sign' });
      x += 120 + rng() * 180;
    }

    return { far, mid, near };
  }

  update(deltaTime) {
    this.time += deltaTime;
    for (const d of this.rain) {
      d.y += d.speed;
      d.x -= d.speed * 0.18;
      if (d.y > this.h) {
        d.y = -20;
        d.x = Math.random() * (this.w + 200) - 100;
      }
    }
  }

  draw(ctx, cameraX, level) {
    this.setLevel(level.id, level.worldWidth);
    const horizon = GameConfig.GROUND_Y;

    // 夜空
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#08091a');
    sky.addColorStop(0.55, '#160f2e');
    sky.addColorStop(1, '#2a1038');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    // 地平线霓虹辉光
    const glow = ctx.createRadialGradient(this.w * 0.7, horizon - 40, 0, this.w * 0.7, horizon - 40, 420);
    glow.addColorStop(0, 'rgba(255,46,136,0.22)');
    glow.addColorStop(1, 'rgba(255,46,136,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawFar(ctx, cameraX);
    this.drawMid(ctx, cameraX);
    this.drawNear(ctx, cameraX);
    this.drawRain(ctx);

    // 暗角
    const vig = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.35, this.w / 2, this.h / 2, this.h * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawFar(ctx, cameraX) {
    const off = -cameraX * 0.15;
    const base = GameConfig.GROUND_Y + 4;
    for (const b of this.layers.far) {
      const sx = b.x + off;
      if (sx > this.w + 40 || sx + b.w < -40) continue;
      ctx.fillStyle = `rgba(20,26,52,${b.tint})`;
      ctx.fillRect(sx, base - b.h, b.w, b.h);
      // 楼顶航标灯
      ctx.fillStyle = 'rgba(255,70,90,0.7)';
      ctx.fillRect(sx + b.w * 0.5 - 1, base - b.h + 4, 2, 2);
    }
  }

  drawMid(ctx, cameraX) {
    const off = -cameraX * 0.4;
    const base = GameConfig.GROUND_Y + 10;
    const t = this.time;
    for (const b of this.layers.mid) {
      const sx = b.x + off;
      if (sx > this.w + 60 || sx + b.w < -60) continue;

      ctx.fillStyle = '#1b2138';
      ctx.fillRect(sx, base - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx, base - b.h, 6, b.h);

      for (const win of b.wins) {
        ctx.fillStyle = win.lit;
        ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(t * 0.001 + win.y * 0.1));
        ctx.fillRect(sx + win.x, base - b.h + win.y, win.w, win.h);
      }
      ctx.globalAlpha = 1;

      if (b.sign) {
        const flick = 0.65 + 0.35 * Math.abs(Math.sin(t * 0.004 + b.x));
        ctx.fillStyle = b.sign.color;
        ctx.globalAlpha = flick;
        ctx.fillRect(sx + b.w * 0.2, base - b.h + b.sign.y, b.sign.w, b.sign.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + b.w * 0.2, base - b.h + b.sign.y, b.sign.w, b.sign.h);
      }
    }
  }

  drawNear(ctx, cameraX) {
    const off = -cameraX * 0.82;
    const base = GameConfig.GROUND_Y + 24;
    for (const b of this.layers.near) {
      const sx = b.x + off;
      if (sx > this.w + 60 || sx + b.w < -60) continue;
      ctx.fillStyle = 'rgba(8,10,20,0.85)';
      if (b.kind === 'fence') {
        ctx.fillRect(sx, base - 26, b.w, 26);
        ctx.fillStyle = 'rgba(120,140,180,0.25)';
        for (let i = 0; i < b.w; i += 12) {
          ctx.fillRect(sx + i, base - 26, 2, 26);
        }
      } else {
        ctx.fillRect(sx, base - b.h, 8, b.h);
        ctx.fillStyle = 'rgba(255,46,136,0.35)';
        ctx.fillRect(sx - 6, base - b.h, 20, 4);
      }
    }
  }

  drawRain(ctx) {
    ctx.strokeStyle = 'rgba(180,210,255,0.5)';
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
