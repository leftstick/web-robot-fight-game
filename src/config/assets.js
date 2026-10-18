// 素材清单：集中管理所有 PNG + JSON 路径
// 加载器（AssetLoader）读取此清单，全部加载完成前显示加载画面。

export const ASSETS = {
  // 角色精灵图（PNG + Aseprite JSON）
  player: { png: 'assets/player.png', json: 'assets/player.json' },
  thug_mohawk: { png: 'assets/thug_mohawk.png', json: 'assets/thug_mohawk.json' },
  thug_mask: { png: 'assets/thug_mask.png', json: 'assets/thug_mask.json' },
  thug_bald: { png: 'assets/thug_bald.png', json: 'assets/thug_bald.json' },
  boss: { png: 'assets/boss.png', json: 'assets/boss.json' },

  // 掩体道具（7 种 × 3 阶段）
  covers: { png: 'assets/covers.png', json: 'assets/covers.json' },

  // 特效序列帧
  fx_muzzle_flash: { png: 'assets/fx_muzzle_flash.png', json: 'assets/fx_muzzle_flash.json' },
  fx_sparks: { png: 'assets/fx_sparks.png', json: 'assets/fx_sparks.json' },
  fx_blood: { png: 'assets/fx_blood.png', json: 'assets/fx_blood.json' },
  fx_explosion: { png: 'assets/fx_explosion.png', json: 'assets/fx_explosion.json' },
  fx_smoke: { png: 'assets/fx_smoke.png', json: 'assets/fx_smoke.json' },
  fx_shell: { png: 'assets/fx_shell.png', json: 'assets/fx_shell.json' },
  fx_debris: { png: 'assets/fx_debris.png', json: 'assets/fx_debris.json' },

  // UI
  ui_hud: { png: 'assets/ui_hud.png', json: 'assets/ui_hud.json' },
  ui_title: { png: 'assets/ui_title.png', json: 'assets/ui_title.json' },
  ui_panel: { png: 'assets/ui_panel.png', json: 'assets/ui_panel.json' },
  ui_crt: { png: 'assets/ui_crt.png', json: 'assets/ui_crt.json' },

  // 背景层（每关 6 层：sky/far/mid/near/fg/ground）
  backgrounds: {
    1: {
      sky: 'assets/bg_level1_sky.png',
      far: 'assets/bg_level1_far.png',
      mid: 'assets/bg_level1_mid.png',
      near: 'assets/bg_level1_near.png',
      fg: 'assets/bg_level1_fg.png',
      ground: 'assets/bg_level1_ground.png',
    },
    2: {
      sky: 'assets/bg_level2_sky.png',
      far: 'assets/bg_level2_far.png',
      mid: 'assets/bg_level2_mid.png',
      near: 'assets/bg_level2_near.png',
      fg: 'assets/bg_level2_fg.png',
      ground: 'assets/bg_level2_ground.png',
    },
    3: {
      sky: 'assets/bg_level3_sky.png',
      far: 'assets/bg_level3_far.png',
      mid: 'assets/bg_level3_mid.png',
      near: 'assets/bg_level3_near.png',
      fg: 'assets/bg_level3_fg.png',
      ground: 'assets/bg_level3_ground.png',
    },
  },
};

// 视差滚动系数（对应各层）
export const PARALLAX = {
  sky: 0.05,
  far: 0.1,
  mid: 0.3,
  near: 0.6,
  fg: 1.0,
  ground: 1.0,
};

// 背景横向平铺系数
export const BG_TILE = 1.2;
