// 横版卷轴平台射击（run-and-gun）全局配置
// 品类锁定：横屏平台射击，不是纵向弹幕飞机打怪。

export const GameConfig = {
  // 横屏 16:9 基准分辨率
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,

  // world / camera 坐标系
  WORLD_WIDTH: 4800,      // 关卡世界宽度（默认，可被关卡数据覆盖）
  GROUND_Y: 470,          // 地面顶面 y（世界坐标）
  GROUND_THICKNESS: 70,   // 地面厚度

  GRAVITY: 0.7,           // 重力加速度（像素/帧，按 dt 归一化）
  MAX_FALL_SPEED: 16,     // 最大下落速度

  PLAYER: {
    width: 32,
    height: 48,
    crouchHeight: 28,       // 蹲下/贴掩体时的高度
    speed: 4.6,             // 水平移动速度
    airControl: 0.85,       // 空中横移系数
    jumpSpeed: -13.2,       // 起跳初速度
    doubleJump: false,      // 预留二段跳开关
    lives: 5,
    invincibleTime: 1200,
    fireInterval: 110,      // 水平射击间隔(ms)
    bulletSpeed: 13,
    bulletDamage: 1,
    bulletWidth: 16,
    bulletHeight: 4,
    grenadeCooldown: 1400,
  },

  THUG: {                   // 人形暴徒
    width: 32,
    height: 48,
    crouchHeight: 28,
    speed: 1.5,
    hp: 3,
    score: 120,
    fireInterval: 1150,
    bulletSpeed: 6.5,
    bulletDamage: 1,
    engageRange: 430,       // 进入该距离后停下对射
    coverHideTime: 900,     // 掩体后隐蔽时长
    coverPeekTime: 700,     // 探头射击时长
  },

  BOSS: {                   // 关底帮派 BOSS
    width: 56,
    height: 84,
    crouchHeight: 56,
    speed: 0.9,
    hp: 42,
    score: 2000,
    fireInterval: 850,
    bulletSpeed: 7.5,
    bulletDamage: 2,
  },

  GRENADE: {
    width: 10,
    height: 10,
    throwVX: 8.5,
    throwVY: -10.5,
    gravity: 0.5,
    fuse: 1300,
    radius: 95,             // 爆炸范围
    damage: 6,
  },

  ENEMY_BULLET: {
    width: 14,
    height: 4,
    color: '#ff5a5a',
  },

  COLORS: {
    playerBullet: '#ffe066',
    neon: ['#ff2e88', '#00e5ff', '#b14aed', '#39ff88', '#ff8a3d'],
  },
};

// 关卡元信息（用于选关界面），真正的关卡布局在 src/data/levels.json
export const LEVEL_META = [
  { id: 1, name: '霓虹街区', worldWidth: 4800 },
  { id: 2, name: '雨夜码头', worldWidth: 4600 },
  { id: 3, name: '帮派老巢', worldWidth: 5400 },
];
