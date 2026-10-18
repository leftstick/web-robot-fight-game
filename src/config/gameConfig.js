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

  BOSS: {                   // 关底帮派 BOSS
    width: 30,
    height: 80,
    crouchHeight: 50,
    speed: 0.45,
    hp: 42,
    score: 2000,
    fireInterval: 850,
    bulletSpeed: 3.75,
    bulletDamage: 2,
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
    cooldown: 340,          // 劈砍冷却(ms)
    range: 42,              // 前方攻击距离
    height: 50,             // 攻击垂直范围
    windupTime: 150,        // 举起阶段时长(ms)
    swingTime: 150,         // 落下阶段时长(ms)
    autoSwitchDist: 68,     // 距离敌人多近时自动切刀
  },

  COLORS: {
    playerBullet: '#ffe066',
    neon: ['#ff2e88', '#00e5ff', '#b14aed', '#39ff88', '#ff8a3d'],
  },

  // 武器槽接口
  WEAPONS: [
    { id: 'pistol', name: '手枪', color: '#ffe066', fireInterval: 110, bulletSpeed: 6.5, bulletDamage: 1 },
    { id: 'rifle', name: '步枪', color: '#5fe6ff', fireInterval: 75, bulletSpeed: 7.5, bulletDamage: 1 },
    { id: 'plasma', name: '线光线弹枪', color: '#39ff88', fireInterval: 160, bulletSpeed: 5.5, bulletDamage: 2 },
  ],
};

// 关卡元信息（用于选关界面），真正的关卡布局在 src/data/levels.json
export const LEVEL_META = [
  { id: 1, name: '霓虹街区', worldWidth: 2400 },
  { id: 2, name: '雨夜码头', worldWidth: 2300 },
  { id: 3, name: '帮派老巢', worldWidth: 2700 },
];
