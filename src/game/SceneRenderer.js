import { GameConfig } from '../config/gameConfig.js';

// 4 层视差背景：80 年代赛博朋克霓虹雨夜城市。
// 远景 / 中景 / 近景 / 前景，横向无缝平铺，深蓝紫基调，洋红+青色霓虹点缀，
// 下雨潮湿氛围，地面积水反光。

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
    for (let i = 0; i < 180; i++) {
      this.rain.push({
        x: Math.random() * (this.w + 200) - 100,
        y: Math.random() * this.h,
        len: 10 + Math.random() * 18,
        speed: 10 + Math.random() * 10,
        alpha: 0.10 + Math.random() * 0.20,
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
    const fg = [];

    // —— 远景层：夜空天际线 + 全息广告牌 + 飞行器灯光 ——
    let x = -200;
    while (x < worldWidth * 0.2 + this.w + 200) {
      const bw = 70 + rng() * 120;
      const bh = 100 + rng() * 220;
      far.push({
        x, w: bw, h: bh,
        tint: 0.30 + rng() * 0.25,
        holo: rng() < 0.3 ? { color: NEON[Math.floor(rng() * NEON.length)], y: 20 + rng() * 60 } : null,
      });
      x += bw + 8;
    }
    // 飞行器灯光（远景小点）
    for (let i = 0; i < 12; i++) {
      far.push({
        x: rng() * worldWidth * 0.25,
        y: 30 + rng() * 120,
        aircraft: true,
        color: rng() < 0.5 ? '#ff4757' : '#39ff88',
      });
    }

    // —— 中景层：老式公寓楼 + 霓虹招牌 + 空调外机 + 消防梯 + 晾衣绳 ——
    x = -200;
    while (x < worldWidth * 0.5 + this.w + 200) {
      const bw = 100 + rng() * 160;
      const bh = 170 + rng() * 240;
      const wins = [];
      const cols = Math.max(3, Math.floor(bw / 24));
      const rows = Math.max(4, Math.floor(bh / 30));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rng() < 0.6) {
            wins.push({
              x: 8 + c * ((bw - 16) / cols),
              y: 14 + r * ((bh - 28) / rows),
              w: Math.max(4, (bw - 16) / cols - 10),
              h: Math.max(4, (bh - 28) / rows - 12),
              lit: rng() < 0.65 ? NEON[Math.floor(rng() * NEON.length)] : '#ffd27a',
            });
          }
        }
      }
      const sign = rng() < 0.75
        ? { color: NEON[Math.floor(rng() * NEON.length)], h: 6 + rng() * 12, w: bw * (0.35 + rng() * 0.4), y: 12 + rng() * (bh * 0.5) }
        : null;
      // 消防梯
      const fireEscape = rng() < 0.5;
      // 晾衣绳
      const laundry = rng() < 0.4;
      mid.push({ x, w: bw, h: bh, wins, sign, fireEscape, laundry });
      x += bw + 18;
    }

    // —— 近景层：街边店铺门面 + 卷帘门 + 涂鸦 + 霓虹灯箱 + 电话亭 + 垃圾袋 ——
    x = -200;
    while (x < worldWidth * 0.85 + this.w + 200) {
      const w = 80 + rng() * 140;
      const kind = rng();
      let type;
      if (kind < 0.3) type = 'shop';
      else if (kind < 0.55) type = 'shutter';
      else if (kind < 0.75) type = 'graffiti';
      else if (kind < 0.88) type = 'phonebooth';
      else type = 'trash';
      near.push({ x, w, type, color: NEON[Math.floor(rng() * NEON.length)] });
      x += w + 30 + rng() * 80;
    }

    // —— 前景层：路灯柱 + 电线杆 + 铁丝网剪影 + 半透明雨雾 ——
    x = -100;
    while (x < worldWidth + this.w + 100) {
      const kind = rng() < 0.6 ? 'lamp' : 'pole';
      fg.push({ x, kind });
      x += 180 + rng() * 220;
    }

    return { far, mid, near, fg };
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

    // —— 夜空：深蓝紫渐变 ——
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#06071a');
    sky.addColorStop(0.4, '#0f0a28');
    sky.addColorStop(0.75, '#1e0f30');
    sky.addColorStop(1, '#2a1038');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    // 月亮 / 霓虹光晕
    const moon = ctx.createRadialGradient(this.w * 0.78, 60, 0, this.w * 0.78, 60, 80);
    moon.addColorStop(0, 'rgba(180,160,255,0.25)');
    moon.addColorStop(1, 'rgba(180,160,255,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, this.w, this.h);

    // 地平线霓虹辉光（洋红）
    const glow = ctx.createRadialGradient(this.w * 0.6, horizon - 50, 0, this.w * 0.6, horizon - 50, 480);
    glow.addColorStop(0, 'rgba(255,46,136,0.20)');
    glow.addColorStop(1, 'rgba(255,46,136,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawFar(ctx, cameraX);
    this.drawMid(ctx, cameraX);
    this.drawNear(ctx, cameraX);
    this.drawRain(ctx);

    // 地面积水反光（地面上方的淡色水平条）
    ctx.fillStyle = 'rgba(0,229,255,0.04)';
    ctx.fillRect(0, horizon - 2, this.w, 6);
    ctx.fillStyle = 'rgba(255,46,136,0.03)';
    ctx.fillRect(0, horizon + 2, this.w, 4);

    // 暗角（收轻）
    const vig = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.4, this.w / 2, this.h / 2, this.h * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawForeground(ctx, cameraX);
  }

  drawFar(ctx, cameraX) {
    const off = -cameraX * 0.12;
    const base = GameConfig.GROUND_Y + 6;
    const t = this.time;
    for (const b of this.layers.far) {
      if (b.aircraft) {
        const sx = (b.x + off) % (this.w + 100);
        const blink = Math.sin(t * 0.005 + b.x) > 0 ? 1 : 0.2;
        ctx.globalAlpha = blink;
        ctx.fillStyle = b.color;
        ctx.fillRect(sx, b.y, 2, 2);
        ctx.globalAlpha = 1;
        continue;
      }
      const sx = b.x + off;
      if (sx > this.w + 50 || sx + b.w < -50) continue;
      ctx.fillStyle = `rgba(16,20,44,${b.tint})`;
      ctx.fillRect(sx, base - b.h, b.w, b.h);
      // 楼顶航标灯
      const blink = Math.sin(t * 0.003 + b.x * 0.1) > 0 ? 1 : 0.3;
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ff465a';
      ctx.fillRect(sx + b.w * 0.5 - 1, base - b.h + 3, 2, 2);
      ctx.globalAlpha = 1;
      // 全息广告牌
      if (b.holo) {
        const flick = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.004 + b.x));
        ctx.globalAlpha = flick * 0.7;
        ctx.fillStyle = b.holo.color;
        ctx.fillRect(sx + b.w * 0.2, base - b.h + b.holo.y, b.w * 0.6, 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawMid(ctx, cameraX) {
    const off = -cameraX * 0.38;
    const base = GameConfig.GROUND_Y + 12;
    const t = this.time;
    for (const b of this.layers.mid) {
      const sx = b.x + off;
      if (sx > this.w + 70 || sx + b.w < -70) continue;

      // 楼体
      ctx.fillStyle = '#171c30';
      ctx.fillRect(sx, base - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx, base - b.h, 7, b.h); // 左侧阴影
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(sx + b.w - 4, base - b.h, 4, b.h); // 右侧高光

      // 窗户
      for (const win of b.wins) {
        ctx.fillStyle = win.lit;
        ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(t * 0.001 + win.y * 0.1));
        ctx.fillRect(sx + win.x, base - b.h + win.y, win.w, win.h);
      }
      ctx.globalAlpha = 1;

      // 霓虹招牌
      if (b.sign) {
        const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.005 + b.x));
        ctx.fillStyle = b.sign.color;
        ctx.globalAlpha = flick;
        ctx.fillRect(sx + b.w * 0.18, base - b.h + b.sign.y, b.sign.w, b.sign.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + b.w * 0.18, base - b.h + b.sign.y, b.sign.w, b.sign.h);
      }

      // 消防梯（金属架）
      if (b.fireEscape) {
        ctx.fillStyle = 'rgba(90,90,120,0.6)';
        const fx = sx + b.w - 14;
        ctx.fillRect(fx, base - b.h + 20, 3, b.h - 40);
        for (let fy = base - b.h + 30; fy < base - 20; fy += 24) {
          ctx.fillRect(fx - 6, fy, 15, 2);
        }
      }

      // 晾衣绳
      if (b.laundry) {
        ctx.strokeStyle = 'rgba(120,120,140,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + 10, base - b.h + b.h * 0.4);
        ctx.lineTo(sx + b.w - 10, base - b.h + b.h * 0.4 + 4);
        ctx.stroke();
        // 几件衣服
        const colors = ['#ff2e88', '#00e5ff', '#39ff88', '#ffe066'];
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.globalAlpha = 0.7;
          ctx.fillRect(sx + 20 + i * 22, base - b.h + b.h * 0.4 + 2, 10, 8);
        }
        ctx.globalAlpha = 1;
      }

      // 空调外机（底部）
      ctx.fillStyle = 'rgba(60,60,80,0.7)';
      ctx.fillRect(sx + 8, base - 16, 14, 10);
      ctx.fillStyle = 'rgba(0,229,255,0.2)';
      ctx.fillRect(sx + 10, base - 14, 10, 2);
    }
  }

  drawNear(ctx, cameraX) {
    const off = -cameraX * 0.78;
    const base = GameConfig.GROUND_Y + 20;
    const t = this.time;
    for (const b of this.layers.near) {
      const sx = b.x + off;
      if (sx > this.w + 80 || sx + b.w < -80) continue;

      if (b.type === 'shop') {
        // 店铺门面
        ctx.fillStyle = '#1a1428';
        ctx.fillRect(sx, base - 70, b.w, 70);
        // 霓虹灯箱
        const flick = 0.7 + 0.3 * Math.abs(Math.sin(t * 0.006 + b.x));
        ctx.globalAlpha = flick;
        ctx.fillStyle = b.color;
        ctx.fillRect(sx + 6, base - 66, b.w - 12, 10);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.strokeRect(sx + 6, base - 66, b.w - 12, 10);
        // 橱窗
        ctx.fillStyle = 'rgba(40,30,60,0.9)';
        ctx.fillRect(sx + 8, base - 50, b.w * 0.5, 40);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(sx + 8, base - 50, b.w * 0.5, 40);
        ctx.globalAlpha = 1;
        // 门
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(sx + b.w * 0.6, base - 40, b.w * 0.3, 40);
      } else if (b.type === 'shutter') {
        // 卷帘门
        ctx.fillStyle = '#2a2438';
        ctx.fillRect(sx, base - 60, b.w, 60);
        // 卷帘条纹
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let sy = base - 58; sy < base; sy += 6) {
          ctx.fillRect(sx, sy, b.w, 2);
        }
        // 锁
        ctx.fillStyle = '#5a5a7a';
        ctx.fillRect(sx + b.w / 2 - 3, base - 30, 6, 8);
      } else if (b.type === 'graffiti') {
        // 涂鸦墙
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(sx, base - 50, b.w, 50);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.6;
        // 喷溅图案
        ctx.fillRect(sx + 10, base - 40, 20, 4);
        ctx.fillRect(sx + 14, base - 44, 12, 8);
        ctx.fillRect(sx + 30, base - 30, 16, 3);
        ctx.globalAlpha = 1;
      } else if (b.type === 'phonebooth') {
        // 电话亭
        ctx.fillStyle = '#7a1a2a';
        ctx.fillRect(sx, base - 64, 22, 64);
        ctx.fillStyle = 'rgba(0,229,255,0.3)';
        ctx.fillRect(sx + 2, base - 60, 18, 40);
        ctx.fillStyle = '#ff2e88';
        ctx.fillRect(sx + 4, base - 62, 14, 3); // 顶部灯
      } else {
        // 垃圾袋
        ctx.fillStyle = '#1a1a26';
        ctx.beginPath();
        ctx.ellipse(sx + 12, base - 8, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(60,60,80,0.5)';
        ctx.fillRect(sx + 4, base - 16, 16, 6);
      }
    }
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

  drawForeground(ctx, cameraX) {
    const off = -cameraX * 1.0;
    const base = GameConfig.GROUND_Y + 24;
    for (const b of this.layers.fg) {
      const sx = b.x + off;
      if (sx > this.w + 60 || sx < -60) continue;

      if (b.kind === 'lamp') {
        // 路灯柱剪影
        ctx.fillStyle = 'rgba(6,6,14,0.9)';
        ctx.fillRect(sx, base - 120, 4, 120);
        ctx.fillRect(sx - 8, base - 120, 20, 4);
        // 灯泡光晕
        const lampGlow = ctx.createRadialGradient(sx + 2, base - 116, 0, sx + 2, base - 116, 40);
        lampGlow.addColorStop(0, 'rgba(255,224,102,0.35)');
        lampGlow.addColorStop(1, 'rgba(255,224,102,0)');
        ctx.fillStyle = lampGlow;
        ctx.fillRect(sx - 40, base - 160, 84, 80);
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(sx, base - 120, 4, 3);
      } else {
        // 电线杆 + 电线
        ctx.fillStyle = 'rgba(6,6,14,0.85)';
        ctx.fillRect(sx, base - 140, 4, 140);
        // 横担
        ctx.fillRect(sx - 12, base - 130, 28, 3);
        // 电线
        ctx.strokeStyle = 'rgba(40,40,60,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - 10, base - 128);
        ctx.quadraticCurveTo(sx + 60, base - 110, sx + 130, base - 128);
        ctx.stroke();
      }
    }

    // 铁丝网剪影（底部前景）
    ctx.fillStyle = 'rgba(6,6,14,0.7)';
    for (let x = 0; x < this.w; x += 16) {
      ctx.fillRect(x, base - 4, 1, 8);
    }
    ctx.fillRect(0, base, this.w, 1);

    // 半透明雨雾（前景）
    ctx.fillStyle = 'rgba(120,140,180,0.04)';
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
