import { GameConfig } from '../config/gameConfig.js';
import { COVER_TYPES, COVER_INFO } from '../config/assets.js';
import { Cover } from './Cover.js';

// 关卡数据外置为 JSON（便于后续换成 Tiled 导出格式）。
// JSON 数据以 960x540 基准编写，加载时按 0.5 缩放到 480x270 逻辑空间。
const SCALE = 0.5;

// 每关的掩体轮廓组合：按关卡 id 循环取用，避免四关都是同一套道具轮播。
// 街区=纸箱/路障/垃圾/售货机；码头=货箱/油桶/沙袋；老巢=售货机/轿车/路障；高架=护栏/轿车/油桶。
const COVER_PALETTES = {
  1: ['crate', 'barrier', 'trash', 'vending', 'crate', 'barrier', 'trash', 'crate'],
  2: ['crate', 'oildrum', 'sandbags', 'crate', 'oildrum', 'barrier', 'sandbags', 'oildrum'],
  3: ['vending', 'car', 'barrier', 'crate', 'vending', 'sandbags', 'car', 'crate'],
  4: ['barrier', 'car', 'oildrum', 'barrier', 'crate', 'car', 'barrier', 'oildrum'],
};

function pickCoverType(levelId, index) {
  const palette = COVER_PALETTES[levelId] || COVER_TYPES;
  return palette[index % palette.length];
}

// 掩体使用画好的原生尺寸，位置按关卡里的中心点重新贴地摆放。
function normalizeCovers(covers, posScale, levelId) {
  return (covers || []).map((c, i) => {
    const type = COVER_INFO[c.type]
      ? c.type
      : (!c.destructible ? 'car' : pickCoverType(levelId, i));
    const info = COVER_INFO[type];
    const sourceW = c.w || info.w;
    const centerX = (c.x + sourceW / 2) * posScale;
    return {
      x: Math.round(centerX - info.w / 2),
      y: GameConfig.GROUND_Y - info.h,
      w: info.w,
      h: info.h,
      hp: c.hp,
      destructible: c.destructible,
      type,
      loot: c.loot || null,
      secret: !!c.secret,
    };
  });
}

const FALLBACK_LEVEL = {
  id: 1,
  name: '霓虹街区（内置）',
  worldWidth: 2400,
  playerSpawn: { x: 60 },
  platforms: [
    { x: 0, y: 235, w: 2400, h: 35 },
    { x: 260, y: 186, w: 100, h: 9 },
    { x: 425, y: 150, w: 85, h: 9 },
    { x: 620, y: 189, w: 120, h: 9 },
    { x: 810, y: 159, w: 95, h: 9 },
    { x: 990, y: 199, w: 105, h: 9 },
    { x: 1170, y: 163, w: 110, h: 9 },
    { x: 1380, y: 196, w: 90, h: 9 },
    { x: 1540, y: 153, w: 100, h: 9 },
    { x: 1740, y: 188, w: 120, h: 9 },
    { x: 1940, y: 160, w: 100, h: 9 },
    { x: 2120, y: 196, w: 110, h: 9 },
  ],
  covers: [
    { x: 320, y: 220, w: 28, h: 15, hp: 6, destructible: true },
    { x: 550, y: 222, w: 32, h: 13, hp: 8, destructible: true },
    { x: 780, y: 220, w: 28, h: 15, hp: 6, destructible: true },
    { x: 950, y: 222, w: 40, h: 13, hp: 10, destructible: true },
    { x: 1150, y: 220, w: 28, h: 15, hp: 6, destructible: true },
    { x: 1340, y: 222, w: 32, h: 13, hp: 8, destructible: true },
    { x: 1520, y: 220, w: 28, h: 15, hp: 6, destructible: true },
    { x: 1725, y: 222, w: 40, h: 13, hp: 10, destructible: true },
    { x: 1910, y: 220, w: 28, h: 15, hp: 6, destructible: true },
    { x: 2075, y: 222, w: 32, h: 13, hp: 8, destructible: true },
    { x: 2200, y: 220, w: 75, h: 15, hp: 24, destructible: false },
  ],
  enemies: [
    { x: 450 }, { x: 650 }, { x: 890 }, { x: 1025 }, { x: 1080 },
    { x: 1250 }, { x: 1310 }, { x: 1450 }, { x: 1575 }, { x: 1660 },
    { x: 1975 }, { x: 2100 }, { x: 2175 },
  ],
  boss: { x: 2300, hp: 42 },
};

export async function loadLevels() {
  try {
    const res = await fetch('src/data/levels.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('数据为空');
    return data.map(scaleLevel);
  } catch (err) {
    console.warn('关卡 JSON 加载失败，使用内置回退关卡：', err.message);
    return [FALLBACK_LEVEL];
  }
}

// 将 960x540 基准的关卡数据缩放到 480x270 逻辑空间
function scaleLevel(d) {
  // 隐藏补给作为可破坏掩体参与物理与绘制，击碎后掉落对应拾取物
  const secretCovers = (d.secrets || []).map((s) => ({
    x: s.x,
    y: s.y,
    w: 0,
    h: 0,
    hp: s.hp || 8,
    destructible: true,
    type: s.type || 'vending',
    loot: s.loot || 'ammo',
    secret: true,
  }));

  // 新关卡用 encounters 描述波次；老数据只有 enemies 时退化为开场全量刷怪
  const rawEncounters = (d.encounters && d.encounters.length)
    ? d.encounters
    : ((d.enemies || []).length
      ? [{ id: 'legacy', label: '', triggerX: 0, gateX: null, spawns: d.enemies }]
      : []);

  return {
    id: d.id,
    name: d.name,
    worldWidth: Math.round(d.worldWidth * SCALE),
    playerSpawn: { x: Math.round((d.playerSpawn?.x ?? 120) * SCALE) },
    platforms: (d.platforms || []).map(p => ({
      x: Math.round(p.x * SCALE), y: Math.round(p.y * SCALE),
      w: Math.round(p.w * SCALE), h: Math.round(p.h * SCALE),
    })),
    covers: normalizeCovers([...(d.covers || []), ...secretCovers], SCALE, d.id),
    encounters: rawEncounters.map((enc, i) => ({
      id: enc.id || `enc-${i}`,
      label: enc.label || '',
      triggerX: Math.round((enc.triggerX ?? 0) * SCALE),
      gateX: enc.gateX != null ? Math.round(enc.gateX * SCALE) : null,
      spawns: (enc.spawns || []).map(e => ({
        x: Math.round(e.x * SCALE),
        y: e.y != null ? Math.round(e.y * SCALE) : undefined,
        type: e.type || 'thug',
        elite: !!e.elite,
      })),
    })),
    checkpoints: (d.checkpoints || []).map(c => ({ x: Math.round(c.x * SCALE) })),
    hazards: (d.hazards || []).map(h => ({
      x: Math.round(h.x * SCALE),
      w: Math.round((h.w || 74) * SCALE),
      type: h.type || 'steam',
      beam: h.beam || null,
    })),
    boss: d.boss ? {
      x: Math.round(d.boss.x * SCALE),
      hp: d.boss.hp,
      name: d.boss.name || '帮派首领',
      title: d.boss.title || 'GANG LORD // 帮派首领',
    } : null,
  };
}

export class Level {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.worldWidth = data.worldWidth || GameConfig.WORLD_WIDTH;

    this.platforms = (data.platforms || []).map((p) => ({
      x: p.x, y: p.y, w: p.w, h: p.h,
    }));

    this.covers = normalizeCovers(data.covers, 1, data.id).map(
      (c) => new Cover(c.x, c.y, c.w, c.h, c.hp, c.destructible, c.type, c.loot, c.secret),
    );

    // 分区遭遇：玩家进入 triggerX 后刷出该波敌人，清空后 gateX 放行
    // 兼容旧数据：只有 enemies 时退化为开局一波，不设闸门
    const rawEncounters = (data.encounters && data.encounters.length)
      ? data.encounters
      : ((data.enemies && data.enemies.length)
        ? [{ id: 'legacy', label: '', triggerX: 0, gateX: null, spawns: data.enemies }]
        : []);
    this.encounters = rawEncounters.map((enc) => ({
      ...enc,
      spawns: (enc.spawns || []).map((e) => ({
        x: e.x,
        y: e.y != null ? e.y : GameConfig.GROUND_Y,
        type: e.type || 'thug',
        elite: !!e.elite,
      })),
    }));
    this.totalEnemies = this.encounters.reduce(
      (n, enc) => n + (enc.spawns || []).length, 0,
    );

    // 中途补给与场景机关
    this.checkpoints = (data.checkpoints || []).map((c) => ({ x: c.x, used: false }));
    this.hazards = (data.hazards || []).map((h, i) => ({
      x: h.x,
      w: h.w || 37,
      type: h.type || 'steam',
      // 激光绊线默认高低交替：偶数高位（蹲下躲），奇数低位（起跳躲）
      beam: h.type === 'laser' ? (h.beam || (i % 2 === 0 ? 'high' : 'low')) : null,
      wasActive: false,
    }));

    this.boss = data.boss ? {
      x: data.boss.x,
      hp: data.boss.hp || GameConfig.BOSS.hp,
      name: data.boss.name || '帮派首领',
      title: data.boss.title || 'GANG LORD // 帮派首领',
    } : null;

    this.playerSpawn = {
      x: data.playerSpawn ? data.playerSpawn.x : 60,
      y: GameConfig.GROUND_Y,
    };
  }

  resetCovers() {
    for (const c of this.covers) {
      c.hp = c.maxHp;
      c.hitFlash = 0;
      c.destroyed = false;
      c.claimedBy = null;
    }
  }
}
