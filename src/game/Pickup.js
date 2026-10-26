import { GameConfig } from '../config/gameConfig.js';

// 掉落物外观 / 尺寸 / 对应武器
export const PICKUP_DEFS = {
  health: { label: '医疗包', color: '#ff5a6e', w: 13, h: 10 },
  ammo: { label: '弹药箱', color: '#ffe066', w: 14, h: 9 },
  rifle: { label: '突击步枪', color: '#5fe6ff', w: 16, h: 9, weapon: 'rifle' },
  plasma: { label: '等离子枪', color: '#39ff88', w: 15, h: 10, weapon: 'plasma' },
};

const WEAPON_BY_ID = new Map(GameConfig.WEAPONS.map((w) => [w.id, w]));

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

// 敌人掉落物：抛出 → 落地弹跳 → 悬浮发光 → 玩家接触拾取。
export class Pickup {
  constructor(type, centerX, bottomY, currentTime = 0) {
    const def = PICKUP_DEFS[type] || PICKUP_DEFS.health;
    this.type = type;
    this.def = def;
    this.weapon = def.weapon ? WEAPON_BY_ID.get(def.weapon) : null;
    this.label = this.weapon ? this.weapon.name : def.label;
    this.color = this.weapon ? this.weapon.color : def.color;
    this.w = def.w;
    this.h = def.h;

    this.x = centerX - this.w / 2;
    this.y = bottomY - this.h;
    this.baseY = this.y;
    this.vx = (Math.random() * 2 - 1) * 0.95;
    this.vy = -3.1 - Math.random() * 0.8;
    this.settled = false;
    this.bounces = 0;
    this.spawnAt = currentTime;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2;
    this.bobTime = this.phase;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.w, height: this.h };
  }

  // 拾取判定比视觉盒稍大，手感更宽容
  getCollectBounds() {
    return { x: this.x - 3, y: this.y - 4, width: this.w + 6, height: this.h + 8 };
  }

  isCollectable(currentTime) {
    return currentTime - this.spawnAt >= GameConfig.LOOT.pickupArmDelay;
  }

  update(dtf, world) {
    if (this.settled) {
      this.bobTime += dtf * 0.10;
      return;
    }

    this.vy += GameConfig.GRAVITY * 0.72 * dtf;
    if (this.vy > 7) this.vy = 7;
    this.vx *= 0.985;

    this.x += this.vx * dtf;
    this.y += this.vy * dtf;

    if (this.x < 2) {
      this.x = 2;
      this.vx = Math.abs(this.vx) * 0.5;
    } else if (this.x + this.w > world.worldWidth - 2) {
      this.x = world.worldWidth - 2 - this.w;
      this.vx = -Math.abs(this.vx) * 0.5;
    }

    // 只在下落时检测平台顶面，避免向上抛出时被吸住
    if (this.vy > 0) {
      const bottom = this.y + this.h;
      for (const p of world.platforms) {
        if (this.x + this.w <= p.x || this.x >= p.x + p.w) continue;
        const top = p.y;
        if (bottom >= top && bottom - this.vy * dtf <= top + 1) {
          this.y = top - this.h;
          if (this.bounces < 1 && this.vy > 1.8) {
            this.bounces++;
            this.vy = -this.vy * 0.26;
            this.vx *= 0.55;
          } else {
            this.vy = 0;
            this.vx = 0;
            this.settled = true;
            this.baseY = this.y;
          }
          break;
        }
      }
    }

    // 掉出世界兜底
    if (this.y > GameConfig.LOGICAL_HEIGHT + 80) {
      this.x = clamp(this.x, 2, world.worldWidth - this.w - 2);
      this.y = GameConfig.GROUND_Y - this.h;
      this.baseY = this.y;
      this.vy = 0;
      this.vx = 0;
      this.settled = true;
    }
  }

  getDrawY() {
    if (!this.settled) return this.y;
    return this.baseY + Math.sin(this.bobTime) * 1.6;
  }

  draw(ctx, currentTime) {
    const x = Math.round(this.x);
    const y = Math.round(this.getDrawY());
    const cx = Math.round(this.x + this.w / 2);
    const bottom = Math.round((this.settled ? this.baseY : this.y) + this.h);
    const pulse = 0.5 + 0.5 * Math.sin(currentTime / 210 + this.phase);

    // —— 地面光池 + 光柱 + 悬浮光点 ——
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 3; i >= 0; i--) {
      const rw = 10 + i * 5;
      ctx.globalAlpha = 0.035 + (3 - i) * 0.025 + pulse * 0.035;
      ctx.fillStyle = this.color;
      ctx.fillRect(Math.round(cx - rw / 2), bottom - 2 + (i % 2), rw, 1);
    }
    ctx.globalAlpha = 0.05 + pulse * 0.04;
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - 1, y - 7, 2, Math.max(2, bottom - y + 5));
    ctx.globalAlpha = 0.25 + pulse * 0.25;
    ctx.fillRect(cx - 1, y - 7 - Math.round(pulse * 2), 1, 1);
    ctx.fillRect(cx + 1, y - 10 + Math.round(pulse * 2), 1, 1);
    ctx.restore();

    // —— 落地阴影（像素横条）——
    if (this.settled) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(cx - Math.round(this.w / 2), bottom - 1, this.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(cx - Math.round(this.w / 3), bottom - 2, Math.round(this.w * 0.66), 1);
    }

    // —— 本体 ——
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2);
    if (this.type === 'health') this.drawHealth(ctx, x, y);
    else if (this.type === 'ammo') this.drawAmmo(ctx, x, y);
    else if (this.type === 'rifle') this.drawRifle(ctx, x, y);
    else this.drawPlasma(ctx, x, y);

    // —— 名称牌 ——
    ctx.font = '6px monospace';
    const tw = Math.ceil(ctx.measureText(this.label).width);
    const lx = Math.round(cx - tw / 2) - 3;
    const ly = y - 7;
    ctx.fillStyle = 'rgba(2,5,9,0.80)';
    ctx.fillRect(lx, ly - 6, tw + 6, 9);
    ctx.fillStyle = this.color;
    ctx.fillRect(lx, ly - 6, 1, 9);
    ctx.fillStyle = '#dfe9f5';
    ctx.textAlign = 'left';
    ctx.fillText(this.label, lx + 4, ly + 1);

    // 物品顶部高光，强化可拾取感
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 1, y, this.w - 2, 1);
  }

  drawHealth(ctx, x, y) {
    const w = this.w;
    const h = this.h;
    ctx.fillStyle = '#e6edf5';
    ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
    ctx.fillStyle = '#aebccb';
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + 2, 1, h - 3);
    ctx.fillRect(x + w - 2, y + 2, 1, h - 3);

    const cxc = x + Math.floor(w / 2);
    ctx.fillStyle = '#ff2e58';
    ctx.fillRect(cxc - 1, y + 3, 2, h - 5);
    ctx.fillRect(cxc - 3, y + 5, 6, 2);
    ctx.fillStyle = '#ff8a9a';
    ctx.fillRect(cxc - 1, y + 3, 1, 1);
  }

  drawAmmo(ctx, x, y) {
    const w = this.w;
    const h = this.h;
    // 箱体
    ctx.fillStyle = '#2b2b1b';
    ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
    ctx.fillStyle = '#d8b62c';
    ctx.fillRect(x + 1, y + 2, w - 2, 2);
    ctx.fillStyle = '#6b5a20';
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillStyle = '#1a1a10';
    ctx.fillRect(x + 3, y + 5, w - 6, 1);

    // 顶部三发子弹
    ctx.fillStyle = '#fff2b0';
    for (let i = 0; i < 3; i++) {
      const bx = x + 3 + i * 4;
      ctx.fillRect(bx, y, 1, 3);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(bx, y + 2, 1, 1);
      ctx.fillStyle = '#fff2b0';
    }
    // 黄色锁扣
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(x + 1, y + h - 3, 2, 1);
    ctx.fillRect(x + w - 3, y + h - 3, 2, 1);
  }

  drawRifle(ctx, x, y) {
    const w = this.w;
    const h = this.h;
    // 枪箱
    ctx.fillStyle = '#17222e';
    ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
    ctx.fillStyle = '#24394b';
    ctx.fillRect(x + 1, y + 2, w - 2, 1);
    ctx.fillStyle = '#5fe6ff';
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);

    // 枪身剪影
    ctx.fillStyle = '#050a10';
    ctx.fillRect(x + 2, y + 3, 9, 3);
    ctx.fillRect(x + 10, y + 4, 4, 1);
    ctx.fillRect(x + 4, y + 3, 2, 4);
    ctx.fillStyle = '#dff8ff';
    ctx.fillRect(x + 2, y + 3, 8, 1);
    ctx.fillRect(x + 11, y + 4, 3, 1);
    ctx.fillStyle = '#5fe6ff';
    ctx.fillRect(x + 5, y + 5, 3, 1);
  }

  drawPlasma(ctx, x, y) {
    const w = this.w;
    const h = this.h;
    // 密封罐
    ctx.fillStyle = '#12251b';
    ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
    ctx.fillStyle = '#2a4d38';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillStyle = '#7f94a3';
    ctx.fillRect(x + 2, y, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 1, w - 4, 1);

    // 绿色核心
    const cxc = x + Math.floor(w / 2);
    ctx.fillStyle = '#1a5c39';
    ctx.fillRect(cxc - 3, y + 3, 6, 5);
    ctx.fillStyle = '#39ff88';
    ctx.fillRect(cxc - 2, y + 4, 4, 3);
    ctx.fillStyle = '#d9ffe8';
    ctx.fillRect(cxc - 1, y + 5, 2, 1);
    ctx.fillStyle = '#39ff88';
    ctx.fillRect(x + 2, y + 3, 1, 4);
    ctx.fillRect(x + w - 3, y + 3, 1, 4);
  }
}
