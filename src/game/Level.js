import { GameConfig } from '../config/gameConfig.js';
import { Cover } from './Cover.js';

// 关卡数据外置为 JSON（便于后续换成 Tiled 导出格式）。
// 若 fetch 失败（例如直接以 file:// 打开），退回内置关卡，保证游戏仍可运行。
const FALLBACK_LEVEL = {
  id: 1,
  name: '霓虹街区（内置）',
  worldWidth: 4800,
  playerSpawn: { x: 120 },
  platforms: [
    { x: 0, y: 470, w: 4800, h: 70 },
    { x: 520, y: 372, w: 200, h: 18 },
    { x: 850, y: 300, w: 170, h: 18 },
    { x: 1240, y: 378, w: 240, h: 18 },
    { x: 1620, y: 318, w: 190, h: 18 },
    { x: 1980, y: 398, w: 210, h: 18 },
    { x: 2340, y: 326, w: 220, h: 18 },
    { x: 2760, y: 392, w: 180, h: 18 },
    { x: 3080, y: 306, w: 200, h: 18 },
    { x: 3480, y: 376, w: 240, h: 18 },
    { x: 3880, y: 320, w: 200, h: 18 },
    { x: 4240, y: 392, w: 220, h: 18 },
  ],
  covers: [
    { x: 640, y: 440, w: 56, h: 30, hp: 6, destructible: true },
    { x: 1100, y: 444, w: 64, h: 26, hp: 8, destructible: true },
    { x: 1560, y: 440, w: 56, h: 30, hp: 6, destructible: true },
    { x: 1900, y: 444, w: 80, h: 26, hp: 10, destructible: true },
    { x: 2300, y: 440, w: 56, h: 30, hp: 6, destructible: true },
    { x: 2680, y: 444, w: 64, h: 26, hp: 8, destructible: true },
    { x: 3040, y: 440, w: 56, h: 30, hp: 6, destructible: true },
    { x: 3450, y: 444, w: 80, h: 26, hp: 10, destructible: true },
    { x: 3820, y: 440, w: 56, h: 30, hp: 6, destructible: true },
    { x: 4150, y: 444, w: 64, h: 26, hp: 8, destructible: true },
    { x: 4400, y: 440, w: 150, h: 30, hp: 24, destructible: false },
  ],
  enemies: [
    { x: 900 }, { x: 1300 }, { x: 1780 }, { x: 2050 }, { x: 2160 },
    { x: 2500 }, { x: 2620 }, { x: 2900 }, { x: 3150 }, { x: 3320 },
    { x: 3950 }, { x: 4200 }, { x: 4350 },
  ],
  boss: { x: 4600, hp: 42 },
};

export async function loadLevels() {
  try {
    const res = await fetch('src/data/levels.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('数据为空');
    return data;
  } catch (err) {
    console.warn('关卡 JSON 加载失败，使用内置回退关卡：', err.message);
    return [FALLBACK_LEVEL];
  }
}

export class Level {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.worldWidth = data.worldWidth || GameConfig.WORLD_WIDTH;

    // 平台碰撞盒
    this.platforms = (data.platforms || []).map((p) => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
    }));

    // 掩体实例
    this.covers = (data.covers || []).map(
      (c) => new Cover(c.x, c.y, c.w, c.h, c.hp, c.destructible),
    );

    // 敌人出生点（y 为脚底，默认站在地面）
    this.enemySpawns = (data.enemies || []).map((e) => ({
      x: e.x,
      y: e.y != null ? e.y : GameConfig.GROUND_Y,
    }));

    // BOSS
    this.boss = data.boss ? { x: data.boss.x, hp: data.boss.hp || GameConfig.BOSS.hp } : null;

    this.playerSpawn = {
      x: data.playerSpawn ? data.playerSpawn.x : 120,
      y: GameConfig.GROUND_Y,
    };
  }

  resetCovers() {
    for (const c of this.covers) {
      c.hp = c.maxHp;
      c.hitFlash = 0;
    }
  }
}
