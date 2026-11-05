// 横版卷轴平台射击（run-and-gun）全局配置
// 渲染管线：逻辑 480x270 离屏画布 → 整数 3x 放大 → 1440x810 主画布
// 所有坐标均为 480x270 逻辑空间。

export const GameConfig = {
  // 主画布（显示）尺寸
  CANVAS_WIDTH: 1440,
  CANVAS_HEIGHT: 810,

  // 逻辑渲染尺寸（离屏画布）
  LOGICAL_WIDTH: 480,
  LOGICAL_HEIGHT: 270,
  RENDER_SCALE: 3,

  // world / camera 坐标系（逻辑空间）
  WORLD_WIDTH: 2400,      // 关卡世界宽度（默认，可被关卡数据覆盖）
  GROUND_Y: 235,          // 地面顶面 y（世界坐标）
  GROUND_THICKNESS: 35,   // 地面厚度

  GRAVITY: 0.35,           // 重力加速度（像素/帧，按 dt 归一化）
  MAX_FALL_SPEED: 8,       // 最大下落速度

  PLAYER: {
    width: 18,             // 碰撞盒宽（480x270 下约 18x56）
    height: 56,            // 碰撞盒高（精灵 64，身体约 56）
    crouchHeight: 32,      // 蹲下/贴掩体时的高度
    speed: 2.3,            // 水平移动速度
    airControl: 0.85,      // 空中横移系数
    jumpSpeed: -6.6,       // 起跳初速度
    doubleJump: true,      // 二段跳开关
    lives: 5,
    invincibleTime: 1200,
    fireInterval: 110,      // 水平射击间隔(ms)
    bulletSpeed: 6.5,
    bulletDamage: 1,
    bulletWidth: 12,
    bulletHeight: 3,
    grenadeCooldown: 1400,
    // 冲刺/滑铲：短距离位移 + 无敌帧，用来穿过弹道或拉开距离
    dashSpeed: 7.4,
    dashDuration: 170,
    dashCooldown: 820,
    dashIFrames: 150,
  },

  THUG: {                   // 人形暴徒
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 0.75,
    hp: 3,
    score: 120,
    fireInterval: 1150,
    bulletSpeed: 3.25,
    bulletDamage: 1,
    engageRange: 215,       // 进入该距离后停下对射
    coverHideTime: 900,     // 掩体后隐蔽时长
    coverPeekTime: 700,     // 探头射击时长
  },

  // —— 敌人谱系：在暴徒基础上拉出三种战术定位 ——
  RUSHER: {                 // 疾行者：贴脸冲撞，逼玩家走位
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 1.65,
    hp: 2,
    score: 150,
    fireInterval: 0,
    bulletSpeed: 0,
    bulletDamage: 0,
    engageRange: 0,
    chargeRange: 170,       // 进入该距离后起手冲撞
    chargeWindup: 420,      // 冲撞前摇(ms)
    chargeDuration: 520,    // 冲撞持续(ms)
    chargeSpeed: 3.8,
    chargeCooldown: 1500,
    contactDamage: 1,
  },

  GUNNER: {                 // 扫射兵：保持中距离，三连发压制
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 0.85,
    hp: 3,
    score: 150,
    fireInterval: 1500,
    bulletSpeed: 3.6,
    bulletDamage: 1,
    engageRange: 210,
    burst: 3,               // 每轮连发数
    burstGap: 105,          // 连发间隔(ms)
    spread: 0.6,            // 单发散布(deg)
  },

  SNIPER: {                 // 狙击手：远程蓄力，锁定后打重弹
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 0.55,
    hp: 2,
    score: 200,
    fireInterval: 2200,
    bulletSpeed: 6.2,
    bulletDamage: 2,
    engageRange: 300,
    aimTime: 750,           // 瞄准红线持续(ms)
  },

  SHIELD: {                 // 盾卫：正面减伤，逼玩家绕后 / 近战 / 爆炸
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 0.5,
    hp: 8,
    score: 260,
    fireInterval: 1700,
    bulletSpeed: 3.1,
    bulletDamage: 1,
    engageRange: 150,
    frontMultiplier: 0.2,   // 从正面命中只吃 20% 伤害
    breakAt: 0.5,           // 血量低于该比例时盾牌破碎
    turnTime: 420,          // 转身迟滞(ms)，留出绕后输出窗口
  },

  HEAVY: {                  // 重装喷子：近距扇形弹，逼迫拉开距离
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 0.6,
    hp: 5,
    score: 220,
    fireInterval: 2100,
    bulletSpeed: 3.0,
    bulletDamage: 1,
    engageRange: 150,
    pellets: 5,             // 每轮扇形弹数
    pelletGap: 55,          // 单发间隔(ms)
    spread: 9,              // 单发散布(deg)
  },

  BIKER: {                  // 暴走族：疾行者的高速变体，冲撞更快更远
    width: 18,
    height: 56,
    crouchHeight: 32,
    speed: 1.95,
    hp: 2,
    score: 170,
    fireInterval: 0,
    bulletSpeed: 0,
    bulletDamage: 0,
    engageRange: 0,
    chargeRange: 200,
    chargeWindup: 320,
    chargeDuration: 560,
    chargeSpeed: 4.6,
    chargeCooldown: 1200,
    contactDamage: 1,
  },

  BOSS: {                   // 关底帮派 BOSS
    width: 30,
    height: 80,
    crouchHeight: 50,
    speed: 0.45,
    hp: 120,
    score: 5000,
    fireInterval: 850,
    bulletSpeed: 3.2,        // 慢到能看清、躲开
    bulletDamage: 2,
    // 点射预警与节奏：先亮弹道，再按锁定方向连发
    aimWindup: [650, 520, 440],   // 前摇(ms)，按阶段
    aimBurst: [3, 3, 4],          // 每轮弹数
    aimBurstGap: 110,             // 连发间隔(ms)
    aimCooldown: [1300, 1100, 950], // 一轮结束后的输出窗口(ms)
    // 三阶段：66% 进入暴走，33% 核心暴露
    phaseThresholds: [0.66, 0.33],
    phaseInvuln: 1000,       // 阶段切换无敌时长(ms)
    coreRadius: 12,          // 三阶段弱点判定半径
    coreMultiplier: 2,       // 打核心的伤害倍率
    slamCooldown: 3200,      // 震地冷却(ms)
    radialCooldown: 2600,    // 环形弹幕冷却(ms)
    nearRange: 150,          // 触发震地的距离
  },

  // 关卡专属 Boss 覆盖参数：未列出的字段沿用 BOSS 默认值
  // sheet / signature 决定独立建模与招牌机制
  BOSS_PROFILES: {
    1: {
      sheet: 'boss_steam',
      signature: 'steam',
      summonType: 'thug',
      summonCount: 2,
    },
    2: {
      sheet: 'boss_crane',
      signature: 'crane',
      summonType: 'heavy',
      summonCount: 1,
    },
    3: {
      sheet: 'boss_warden',
      signature: 'warden',
      summonType: 'shield',
      summonCount: 1,
    },
    4: {
      sheet: 'boss_rail',
      signature: 'rail',
      bulletSpeed: 3.4,
      aimWindup: [620, 500, 420],
      aimBurst: [3, 4, 4],
      aimBurstGap: 105,
      aimCooldown: [1250, 1050, 900],
      dualLane: true,          // 三阶段：一轮打完立刻锁另一条弹道追击
      followWindup: 430,       // 追击弹道的前摇(ms)
      summonType: 'rusher',    // 二阶段召唤疾行者
      summonCount: 1,          // 高架空间窄，召唤量减半
      slamCooldown: 3000,
    },
  },

  // 四个 Boss 的招牌机制：前摇喊名 -> 场地机关 -> 收招后核心暴露（反击窗口）
  BOSS_SIGNATURES: {
    steam: {
      callout: '蒸汽爆裂', kicker: 'STEAM BURST', color: '#7fe9ff',
      windup: 820, active: 1300, recover: 320, punish: 1800, cooldown: 7200,
    },
    crane: {
      callout: '磁吊落箱', kicker: 'MAGNET DROP', color: '#ffb347',
      windup: 900, active: 1700, recover: 320, punish: 2000, cooldown: 7600,
    },
    warden: {
      callout: '盾墙激光', kicker: 'WARDEN GRID', color: '#ff5a8a',
      windup: 900, active: 2200, recover: 360, punish: 2200, cooldown: 8000,
    },
    rail: {
      callout: '轨道电涌', kicker: 'RAIL SURGE', color: '#c77dff',
      windup: 860, active: 1800, recover: 340, punish: 2000, cooldown: 7000,
    },
  },

  GRENADE: {
    width: 8,
    height: 8,
    throwVX: 4.25,
    throwVY: -5.25,
    gravity: 0.25,
    fuse: 1300,
    radius: 48,             // 爆炸范围
    damage: 6,
  },

  ENEMY_BULLET: {
    width: 10,
    height: 3,
    color: '#ff5a5a',
  },

  // 近战武器（刀）
  MELEE: {
    damage: 3,              // 劈砍伤害
    cooldown: 250,          // 劈砍冷却(ms)
    range: 42,              // 前方攻击距离
    height: 50,             // 攻击垂直范围
    windupTime: 125,        // 举起阶段时长(ms)
    swingTime: 125,         // 落下阶段时长(ms)
    autoSwitchDist: 68,     // 距离敌人多近时自动切刀
  },

  // 可选角色：共享同一套动作与武器系统，用速度、生命、冲刺和初始武器区分手感。
  CHARACTERS: [
    {
      id: 'viktor', name: '维克', code: 'VICTOR',
      trait: '均衡 · 标准装备', desc: '移动、生命与冲刺都居中，适合第一次通关。',
      color: '#3ee6ff', sheet: 'player',
      lives: 5, speed: 2.3, jumpSpeed: -6.6,
      dashSpeed: 7.4, dashDuration: 170, dashCooldown: 820, dashIFrames: 150,
      meleeMultiplier: 1,
      startWeapons: [],
    },
    {
      id: 'mira', name: '米拉', code: 'MIRA',
      trait: '疾行 · 冲锋枪', desc: '跑得更快、冲刺更频繁，但生命少 1 点，靠走位换生存。',
      color: '#c77dff', sheet: 'player_mira',
      lives: 4, speed: 2.72, jumpSpeed: -7.0,
      dashSpeed: 8.1, dashDuration: 180, dashCooldown: 560, dashIFrames: 165,
      meleeMultiplier: 0.8,
      startWeapons: [{ id: 'smg', ammo: 90 }],
    },
    {
      id: 'tetsu', name: '铁山', code: 'TETSU',
      trait: '重装 · 霰弹枪', desc: '7 点生命与更重的劈砍，代价是移速和冲刺冷却。',
      color: '#ff8a3d', sheet: 'player_tetsu',
      lives: 7, speed: 2.05, jumpSpeed: -6.3,
      dashSpeed: 6.8, dashDuration: 155, dashCooldown: 1000, dashIFrames: 130,
      meleeMultiplier: 1.5,
      startWeapons: [{ id: 'shotgun', ammo: 18 }],
    },
  ],

  COLORS: {
    playerBullet: '#ffe066',
    neon: ['#ff2e88', '#00e5ff', '#b14aed', '#39ff88', '#ff8a3d'],
  },

  // 武器槽接口：手枪为无限弹药的保底武器，拾取武器有独立弹量。
  // 三把枪刻意做成三种节奏：
  //   手枪  —— 精准、无限，节奏沉稳，单发 1 伤，稳定三枪放倒暴徒；
  //   步枪  —— 全自动高射速 + 小幅散布，压制成群目标但吃弹药；
  //   等离子 —— 慢速重弹，单发 3 伤并溅射，一发清暴徒，打 Boss 也最省弹。
  WEAPONS: [
    {
      id: 'pistol', name: '手枪', color: '#ffe066',
      trait: '精准 · 无限',
      fireInterval: 240, bulletSpeed: 7.4, bulletDamage: 1,
      bulletWidth: 12, bulletHeight: 3,
      spreadDeg: 0,
      bulletStyle: 'pistol', sfx: 'pistol', muzzleScale: 0.5,
      impactShake: 4, impactShakeIntensity: 3, hitStop: 18,
      infiniteAmmo: true,
    },
    {
      id: 'rifle', name: '突击步枪', color: '#5fe6ff',
      trait: '全自动 · 高射速',
      fireInterval: 65, bulletSpeed: 8.2, bulletDamage: 1,
      bulletWidth: 10, bulletHeight: 2,
      spreadDeg: 3.2,
      bulletStyle: 'rifle', sfx: 'rifle', muzzleScale: 0.42, muzzleTint: '#5fe6ff',
      fireShake: 1.5,
      impactShake: 3, impactShakeIntensity: 2, hitStop: 12,
      pickupAmmo: 60, maxAmmo: 180,
    },
    {
      id: 'plasma', name: '等离子枪', color: '#39ff88',
      trait: '重击 · 溅射',
      fireInterval: 340, bulletSpeed: 4.8, bulletDamage: 3,
      bulletWidth: 14, bulletHeight: 14,
      spreadDeg: 0,
      splashRadius: 26, splashDamage: 2,
      bulletStyle: 'plasma', sfx: 'plasma', muzzleScale: 0.8, muzzleTint: '#39ff88',
      fireShake: 5,
      impactShake: 9, impactShakeIntensity: 6, hitStop: 42,
      pickupAmmo: 24, maxAmmo: 60,
    },
    {
      id: 'shotgun', name: '霰弹枪', color: '#ff8a3d',
      trait: '近距 · 六连扇',
      fireInterval: 620, bulletSpeed: 6.8, bulletDamage: 1,
      bulletWidth: 7, bulletHeight: 3,
      spreadDeg: 0, pellets: 6, pelletSpreadDeg: 12,
      bulletStyle: 'pellet', sfx: 'shotgun', muzzleScale: 0.9, muzzleTint: '#ffb347',
      fireShake: 4,
      impactShake: 5, impactShakeIntensity: 3, hitStop: 16,
      pickupAmmo: 18, maxAmmo: 54,
    },
    {
      id: 'smg', name: '冲锋枪', color: '#c77dff',
      trait: '极速 · 压制',
      fireInterval: 46, bulletSpeed: 8.8, bulletDamage: 1,
      bulletWidth: 9, bulletHeight: 2,
      spreadDeg: 5.5,
      bulletStyle: 'smg', sfx: 'smg', muzzleScale: 0.38, muzzleTint: '#c77dff',
      fireShake: 1,
      impactShake: 3, impactShakeIntensity: 2, hitStop: 12,
      pickupAmmo: 90, maxAmmo: 270,
    },
    {
      id: 'rail', name: '磁轨炮', color: '#b14aed',
      trait: '穿透 · 重击',
      fireInterval: 720, bulletSpeed: 12, bulletDamage: 5,
      bulletWidth: 26, bulletHeight: 4,
      spreadDeg: 0, pierce: 3,
      bulletStyle: 'rail', sfx: 'rail', muzzleScale: 1.1, muzzleTint: '#d9a6ff',
      fireShake: 7,
      impactShake: 10, impactShakeIntensity: 7, hitStop: 48,
      pickupAmmo: 8, maxAmmo: 24,
    },
  ],

  // 掉落与拾取
  LOOT: {
    dropChance: 0.34,       // 普通暴徒掉落概率
    pityKills: 4,           // 连续 4 次未掉落，下一次必掉（防止整关无补给）
    maxPickups: 6,          // 场上同时存在的拾取物上限
    pickupArmDelay: 320,    // 掉落物落地前不吸附，避免贴脸击杀瞬间被吞
    healthScore: 150,       // 满血时医疗包折算分数
    ammoScore: 120,         // 无有限弹武器时弹药箱折算分数
    drops: [
      { type: 'health', weight: 36 },
      { type: 'ammo', weight: 28 },
      { type: 'rifle', weight: 18 },
      { type: 'plasma', weight: 10 },
      { type: 'shotgun', weight: 12 },
      { type: 'smg', weight: 12 },
      { type: 'rail', weight: 6 },
    ],
    weaponAmmo: { rifle: 60, plasma: 24, shotgun: 18, smg: 90, rail: 8 },
    ammoBox: { rifle: 30, plasma: 12, shotgun: 12, smg: 45, rail: 4 },
  },
};

// 关卡元信息（用于选关界面），真正的关卡布局在 src/data/levels.json
// tag 概括该关的独有玩法，让选关界面先说明"这关不一样在哪"
export const LEVEL_META = [
  { id: 1, name: '霓虹街区', worldWidth: 2400, tag: '蒸汽喷口 · 街区杂兵' },
  { id: 2, name: '雨夜码头', worldWidth: 2300, tag: '吊机重锤 · 重装喷子' },
  { id: 3, name: '帮派老巢', worldWidth: 2700, tag: '激光绊线 · 盾卫' },
  { id: 4, name: '酸雨高架', worldWidth: 2800, tag: '轨道电击 · 暴走族' },
];
