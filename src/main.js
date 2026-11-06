import { Game, GameState } from './game/Game.js';
import { LEVEL_META, GameConfig } from './config/gameConfig.js';
import { getSprites } from './game/SpriteSheet.js';

// 按键提示文案：按当前设备切换，手柄连接时优先显示手柄按键
const INPUT_HINTS = {
  keyboard: '键盘：← → / A D 移动 · ↑ / W / K 跳 · ↓ / S 蹲 · 空格 / J 射击 · C 冲刺 · Q / L 切枪 · G 手雷 · X 劈砍 · 蹲+跳 下板',
  pad: '手柄：左摇杆 / 十字键 移动 · A 跳 · X / RT 射击 · B 蹲 · Y / RB 切枪 · LT 瞄准 · LB 手雷 · R3 劈砍 · L3 冲刺 · Start 暂停',
  touch: '触屏：左半屏浮动摇杆 移动 / 下推蹲 · 右侧 射击 / 跳跃 / 冲刺 / 手雷 / 切枪 / 劈砍 · 摇杆下推+跳跃 下板',
  keyboardMenu: '菜单：方向键 选择 · 空格 / 回车 确认 · Backspace 返回',
  padMenu: '菜单：D-pad / 左摇杆 选择 · A 确认 · B 返回',
  // 游戏内提示分三行，短句更适合快速扫读；键名用 <b> 高亮
  keyboardLines: [
    '<b>A</b>/<b>D</b> 移动 <span class="sep">·</span> <b>W</b> 跳 <span class="sep">·</span> <b>S</b> 蹲',
    '<b>空格</b> 射击 <span class="sep">·</span> <b>C</b> 冲刺 <span class="sep">·</span> <b>Q</b> 切枪',
    '<b>X</b> 劈砍 <span class="sep">·</span> <b>G</b> 手雷 <span class="sep">·</span> <b>Esc</b> 暂停',
  ],
  padLines: [
    '<b>左摇杆</b> 移动 <span class="sep">·</span> <b>A</b> 跳 <span class="sep">·</span> <b>B</b> 蹲',
    '<b>X</b>/<b>RT</b> 射击 <span class="sep">·</span> <b>L3</b> 冲刺 <span class="sep">·</span> <b>Y</b>/<b>RB</b> 切枪',
    '<b>LB</b> 手雷 <span class="sep">·</span> <b>R3</b> 劈砍 <span class="sep">·</span> <b>Start</b> 暂停',
  ],
};

class GameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.game = new Game(this.canvas);

    this.screens = {
      start: document.getElementById('startScreen'),
      levelSelect: document.getElementById('levelSelectScreen'),
      pause: document.getElementById('pauseScreen'),
      gameOver: document.getElementById('gameOverScreen')
    };

    this.hud = {
      container: document.getElementById('gameHUD'),
      level: document.getElementById('levelDisplay'),
      score: document.getElementById('scoreDisplay'),
      lives: document.getElementById('livesDisplay'),
      enemyCount: document.getElementById('enemyCount')
    };

    this.unlockedLevels = this.loadProgress();

    // 干员选择：角色卡片 + 当前选择（本地持久化）
    this.characterId = this.loadCharacter();
    this.characterGrid = document.getElementById('characterGrid');
    this.characterCardEls = new Map();

    // 手柄 UI：连接/断开提示 + 按键图例
    this.gpLegend = document.getElementById('gpLegend');
    this.gpToast = document.getElementById('gpToast');
    this.gpWarn = document.getElementById('gpWarn');     // 非安全上下文警告
    this.gpPending = document.getElementById('gpPending'); // 待激活提示
    this.toastTimer = null;
    this.padConnected = false;
    this.padPromptAllowed = false;

    // 开始 / 暂停 / 结算界面的按键提示，按设备动态切换
    this.controlsHint = document.getElementById('controlsHint');
    this.controlsMenuHint = document.getElementById('controlsMenuHint');
    this.pauseMenuHint = document.getElementById('pauseMenuHint');
    this.gameOverMenuHint = document.getElementById('gameOverMenuHint');
    this.menuHints = document.querySelectorAll('.menu-hint');

    // 游戏内 DOM 提示与武器 HUD
    this.controlHintOverlay = document.getElementById('controlHintOverlay');
    this.controlHintLines = [
      document.getElementById('chLine1'),
      document.getElementById('chLine2'),
      document.getElementById('chLine3'),
    ];
    this.weaponHud = document.getElementById('weaponHud');
    this.weaponMainIcon = document.getElementById('weaponMainIcon');
    this.weaponKicker = document.getElementById('weaponKicker');
    this.weaponName = document.getElementById('weaponName');
    this.weaponAmmo = document.getElementById('weaponAmmo');
    this.weaponSlots = document.getElementById('weaponSlots');
    this.weaponSlotEls = new Map();
    this._weaponIconId = null;
    this._weaponIdsSig = '';
    this._weaponAmmoText = '';
    this._weaponLow = false;
    this._weaponColor = '';
    this._weaponTrait = '';
    this._activeSlotId = null;

    // BOSS 演出覆盖层
    this.bossIntro = document.getElementById('bossIntro');
    this.bossIntroName = document.getElementById('bossIntroName');
    this.bossIntroTitle = document.getElementById('bossIntroTitle');
    this.bossIntroPhase = document.getElementById('bossIntroPhase');
    this.bossIntroHp = document.getElementById('bossIntroHp');
    this.bossPhaseFlash = document.getElementById('bossPhaseFlash');
    this.bossPhaseFlashText = document.getElementById('bossPhaseFlashText');
    this.bossDeathBanner = document.getElementById('bossDeathBanner');
    this.bossDeathName = document.getElementById('bossDeathName');
    this.bossCallout = document.getElementById('bossCallout');
    this.bossCalloutName = document.getElementById('bossCalloutName');
    this.bossCalloutKicker = this.bossCallout?.querySelector('.bc-kicker') || null;
    this.bossCalloutTimer = null;

    // 竖屏门禁：旋转回横屏后自动继续
    this.orientationGate = document.getElementById('orientationGate');
    this.orientationPaused = false;
    this.gameContainer = document.querySelector('.game-container');
    this.immerseBtn = document.getElementById('immerseBtn');
    this.gateRotateBtn = document.getElementById('gateRotateBtn');
    this.gateFallbackBtn = document.getElementById('gateFallbackBtn');
    this.viewportSyncRaf = 0;
    this.lastPortrait = null;
    // 微信等内置浏览器无法全屏/锁定横屏时的兜底：把整个游戏画面旋转 90°
    this.forceLandscape = false;
    this._rotateFallbackTimer = 0;

    this._countRaf = 0;
    this._bossDeathName = '';

    // 菜单导航：当前屏幕的可选项、选中下标（键盘/手柄共用同一套）
    this.menuScreen = null;
    this.menuItems = [];
    this.menuIndex = 0;
    this.gameoverButtons = [];

    this.init();
  }

  init() {
    this.setupGameCallbacks();
    this.setupEventListeners();
    this.setupDeviceSpecific();
    this.renderLevelGrid();
    this.renderCharacterCards();
    this.checkGamepadAvailability();
    // 显示加载画面，素材加载完成后显示开始界面
    this.showScreen('start');
    this.game.setCharacter(this.characterId);
    this.game.init().then(() => this.drawCharacterPortraits());
    this.setupMobileViewport();
    this.setupImmersiveEntry();
  }

  // —— 移动端视口：尺寸/比例同步 + 竖屏门禁 ——
  setupMobileViewport() {
    this.syncViewport();
    const queueSync = () => {
      if (this.viewportSyncRaf) return;
      this.viewportSyncRaf = requestAnimationFrame(() => {
        this.viewportSyncRaf = 0;
        this.syncViewport();
      });
    };
    const laterSync = () => {
      setTimeout(queueSync, 120);
      setTimeout(queueSync, 480);
    };
    window.addEventListener('resize', queueSync);
    window.addEventListener('orientationchange', laterSync);
    document.addEventListener('fullscreenchange', laterSync);
    document.addEventListener('webkitfullscreenchange', laterSync);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', queueSync);
      window.visualViewport.addEventListener('scroll', queueSync);
    }
    queueSync();
  }

  getViewportSize() {
    const vv = window.visualViewport;
    const width = Math.max(1, vv ? vv.width : window.innerWidth);
    const height = Math.max(1, vv ? vv.height : window.innerHeight);
    return { width, height };
  }

  // 让画布容器铺满可视区：宽屏时横向扩展逻辑视野，避免两侧大黑边；
  // 竖屏时交给门禁，容器仍按 16:9 内接，避免 UI 被拉变形。
  syncViewport() {
    const { width: vw, height: vh } = this.getViewportSize();
    const base = GameConfig.LOGICAL_WIDTH / GameConfig.LOGICAL_HEIGHT;
    const touch = this.game.input.isTouchEnabled();
    const portrait = vw < vh;

    // 手动旋转只在竖屏视口下生效；设备真正转回横屏后自动退出
    if (this.forceLandscape && !portrait) {
      this.forceLandscape = false;
      document.documentElement.classList.remove('force-landscape');
    }
    const rotated = this.forceLandscape;

    // 旋转模式下有效视口宽高互换（画面整体转了 90°）
    const effW = rotated ? vh : vw;
    const effH = rotated ? vw : vh;
    // 仅移动端扩展视野；桌面端保持 16:9，避免旧尺寸上限造成拉伸
    const aspect = touch ? Math.max(base, Math.min(effW / effH, 2.35)) : base;

    if (this.game && typeof this.game.setViewportAspect === 'function') {
      this.game.setViewportAspect(aspect);
    }

    if (this.gameContainer) {
      // 桌面端保留原来的 1440×810 上限，移动端则完整铺满
      const maxW = touch ? Infinity : 1440;
      const maxH = touch ? Infinity : 810;
      const avail = document.getElementById('app');
      let availW = vw;
      let availH = vh;
      if (avail) {
        const cs = getComputedStyle(avail);
        availW = Math.max(1, avail.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
        availH = Math.max(1, avail.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0));
      }
      if (rotated) {
        const tmp = availW;
        availW = availH;
        availH = tmp;
      }
      const w = Math.min(availW, availH * aspect, maxW);
      const h = Math.min(availH, availW / aspect, maxH);
      this.gameContainer.style.maxWidth = touch ? 'none' : '1440px';
      this.gameContainer.style.maxHeight = touch ? 'none' : '810px';
      this.gameContainer.style.width = `${Math.round(w)}px`;
      this.gameContainer.style.height = `${Math.round(h)}px`;
    }

    this.applyOrientationGate(portrait);
  }

  // 竖屏时用门禁覆盖并暂停；转回横屏后只在「因竖屏自动暂停」时恢复
  applyOrientationGate(portrait) {
    const touch = this.game.input.isTouchEnabled();
    // 已切到画面旋转模式时不再拦截，游戏可以继续
    const show = portrait && touch && !this.forceLandscape;
    if (show !== this.lastPortrait) {
      this.lastPortrait = show;
      if (this.orientationGate) {
        this.orientationGate.classList.toggle('visible', show);
        this.orientationGate.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
      if (show) {
        if (this.game.state === GameState.PLAYING) {
          this.orientationPaused = true;
          this.game.pause();
        }
      } else if (this.orientationPaused) {
        this.orientationPaused = false;
        if (this.game.state === GameState.PAUSED) this.game.resume();
      }
    }
    if (this.orientationGate) {
      this.orientationGate.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
  }

  // 微信/X5 等不支持横屏锁定时：把横版画面旋转 90° 铺满竖屏视口。
  // 物理上手机仍是竖屏，用户把手机横过来即可正常游玩。
  enterForceLandscape() {
    if (!this.game.input.isTouchEnabled()) return;
    const { width, height } = this.getViewportSize();
    if (width >= height) return;
    this.forceLandscape = true;
    document.documentElement.classList.add('force-landscape');
    this.syncViewport();
    // 地址栏/安全区尺寸可能延后稳定，补两次同步
    setTimeout(() => this.syncViewport(), 80);
    setTimeout(() => this.syncViewport(), 320);
  }

  // 尝试全屏/横屏锁定后，若视口仍是竖屏则自动切到旋转模式
  scheduleRotateFallback() {
    if (!this.game.input.isTouchEnabled()) return;
    clearTimeout(this._rotateFallbackTimer);
    this._rotateFallbackTimer = setTimeout(() => {
      if (this.forceLandscape) return;
      const { width, height } = this.getViewportSize();
      if (width < height) this.enterForceLandscape();
    }, 700);
  }

  // —— 强制横屏：首次交互时请求全屏并锁定横屏 ——
  setupImmersiveEntry() {
    if (this.immerseBtn) {
      this.immerseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.requestImmersive();
      });
    }
    if (this.gateRotateBtn) {
      this.gateRotateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.requestImmersive();
      });
    }
    if (this.gateFallbackBtn) {
      this.gateFallbackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.enterForceLandscape();
      });
    }
    // 移动端首次触摸即进入全屏横屏（浏览器要求必须由用户手势触发）
    const handler = () => {
      window.removeEventListener('pointerdown', handler);
      if (this.game.input.isTouchEnabled()) this.requestImmersive();
    };
    window.addEventListener('pointerdown', handler, { once: true, passive: true });
  }

  requestImmersive() {
    const lockLandscape = () => {
      try {
        const so = screen.orientation;
        if (so && typeof so.lock === 'function') {
          so.lock('landscape').catch(() => { /* 浏览器不支持/拒绝，静默忽略 */ });
        }
      } catch (_) { /* 忽略 */ }
    };

    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const alreadyFull = document.fullscreenElement || document.webkitFullscreenElement;

    if (!request || alreadyFull) {
      lockLandscape();
      setTimeout(() => this.syncViewport(), 120);
      this.scheduleRotateFallback();
      return;
    }

    try {
      const result = request.call(root, { navigationUI: 'hide' });
      if (result && typeof result.then === 'function') {
        result.then(() => {
          lockLandscape();
          setTimeout(() => this.syncViewport(), 120);
        }).catch(() => {
          lockLandscape();
          setTimeout(() => this.syncViewport(), 120);
        });
      } else {
        lockLandscape();
        setTimeout(() => this.syncViewport(), 200);
      }
    } catch (_) {
      lockLandscape();
      setTimeout(() => this.syncViewport(), 120);
    }

    // 微信等环境全屏/锁定可能静默失败，仍在竖屏时切旋转模式
    this.scheduleRotateFallback();
  }

  setupDeviceSpecific() {
    document.documentElement.classList.toggle('touch-mode', this.game.input.isTouchEnabled());
    this.updateInputHints();
  }

  // 按键提示随「触屏 / 键盘 / 手柄」切换；接上手柄后优先显示手柄按键
  updateInputHints() {
    const touch = this.game.input.isTouchEnabled();
    const pad = this.padConnected;
    const menuText = pad ? INPUT_HINTS.padMenu : INPUT_HINTS.keyboardMenu;

    if (this.controlsHint) {
      this.controlsHint.textContent = pad ? INPUT_HINTS.pad
        : (touch ? INPUT_HINTS.touch : INPUT_HINTS.keyboard);
      this.controlsHint.classList.toggle('pad', pad);
    }

    if (this.controlsMenuHint) {
      this.controlsMenuHint.textContent = menuText;
      this.controlsMenuHint.style.display = (touch && !pad) ? 'none' : '';
    }

    if (this.pauseMenuHint) this.pauseMenuHint.textContent = menuText;
    if (this.gameOverMenuHint) this.gameOverMenuHint.textContent = menuText;

    // 触屏且未接手柄时，菜单靠直接点按，不显示键位提示
    this.menuHints.forEach((el) => {
      el.style.display = (touch && !pad) ? 'none' : '';
    });

    // 游戏内控制提示：仅非触屏 / 已接手柄且正在战斗时显示
    const lines = pad ? INPUT_HINTS.padLines : (touch ? null : INPUT_HINTS.keyboardLines);
    if (this.controlHintOverlay) {
      if (lines) {
        this.controlHintLines.forEach((el, i) => {
          if (el) el.innerHTML = lines[i] || '';
        });
        this.controlHintOverlay.classList.toggle('pad', pad);
      }
      const showHint = !!lines && this.game.state === GameState.PLAYING;
      this.controlHintOverlay.classList.toggle('visible', showHint);
    }
  }

  // 武器 HUD：文本与背包槽走 DOM，图标仍用像素绘制，避免 6px 画布文字发虚
  updateWeaponHud() {
    if (!this.weaponHud) return;

    const p = this.game.player;
    const playing = this.game.state === GameState.PLAYING && !!p;
    // 只在可见性变化时写 DOM，避免每帧触发样式失效
    if (playing !== this._weaponHudVisible) {
      this._weaponHudVisible = playing;
      this.weaponHud.classList.toggle('visible', playing);
    }
    if (!playing) return;

    const w = p.getWeapon();
    if (!w) {
      this._weaponHudVisible = false;
      this.weaponHud.classList.remove('visible');
      return;
    }

    if (this._weaponColor !== w.color) {
      this.weaponHud.style.setProperty('--weapon-color', w.color);
      this._weaponColor = w.color;
    }

    if (this.weaponName.textContent !== w.name) {
      this.weaponName.textContent = w.name;
    }

    const trait = w.trait || 'WEAPON';
    if (this.weaponKicker && trait !== this._weaponTrait) {
      this.weaponKicker.textContent = trait;
      this._weaponTrait = trait;
    }

    const ammo = p.ammo[w.id];
    const ammoText = w.infiniteAmmo ? '∞' : String(ammo ?? 0);
    if (ammoText !== this._weaponAmmoText) {
      this.weaponAmmo.textContent = ammoText;
      this._weaponAmmoText = ammoText;
    }

    const low = !w.infiniteAmmo && (ammo ?? 0) <= 10;
    if (low !== this._weaponLow) {
      this.weaponAmmo.classList.toggle('low', low);
      this._weaponLow = low;
    }

    if (this._weaponIconId !== w.id) {
      this.drawWeaponIcon(this.weaponMainIcon, w, 3);
      this._weaponIconId = w.id;
    }

    const idsSig = p.weaponIds.join(',');
    if (idsSig !== this._weaponIdsSig) {
      this.rebuildWeaponSlots(p);
      this._weaponIdsSig = idsSig;
      this._activeSlotId = null;
    }

    for (const id of p.weaponIds) {
      const refs = this.weaponSlotEls.get(id);
      if (!refs) continue;
      const cfg = GameConfig.WEAPONS.find((item) => item.id === id);
      const slotAmmo = cfg && cfg.infiniteAmmo ? '∞' : String(p.ammo[id] ?? 0);
      if (refs.ammo.textContent !== slotAmmo) refs.ammo.textContent = slotAmmo;
    }

    if (this._activeSlotId !== w.id) {
      for (const [id, refs] of this.weaponSlotEls) {
        refs.slot.classList.toggle('active', id === w.id);
      }
      this._activeSlotId = w.id;
    }
  }

  rebuildWeaponSlots(player) {
    if (!this.weaponSlots) return;
    this.weaponSlots.innerHTML = '';
    this.weaponSlotEls.clear();

    for (const id of player.weaponIds) {
      const cfg = GameConfig.WEAPONS.find((item) => item.id === id);
      if (!cfg) continue;

      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      slot.style.setProperty('--slot-color', cfg.color);
      slot.title = cfg.name;
      slot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectWeaponSlot(id);
      });

      const icon = document.createElement('canvas');
      icon.className = 'weapon-slot-icon';
      this.drawWeaponIcon(icon, cfg, 2);

      const ammo = document.createElement('span');
      ammo.className = 'weapon-slot-ammo';

      slot.appendChild(icon);
      slot.appendChild(ammo);
      this.weaponSlots.appendChild(slot);
      this.weaponSlotEls.set(id, { slot, ammo });
    }
  }

  // 触屏/鼠标点武器槽：直接切到该武器（仍受背包与弹药限制）
  selectWeaponSlot(id) {
    const p = this.game.player;
    if (!p || this.game.state !== GameState.PLAYING) return;
    const idx = p.weaponIds.indexOf(id);
    if (idx < 0 || idx === p.weaponIndex) return;
    const cfg = GameConfig.WEAPONS.find((item) => item.id === id);
    if (cfg && !cfg.infiniteAmmo && (p.ammo[id] || 0) <= 0) return;
    p.weaponIndex = idx;
    this.game.sfx.click();
    this.updateWeaponHud();
  }

  drawWeaponIcon(canvas, weapon, scale) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 14 * scale;
    canvas.height = 11 * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    this.game.drawWeaponGlyph(ctx, weapon, 1, 1, weapon.color);
    ctx.restore();
  }

  setupGameCallbacks() {
    this.game.onStateChange = (state) => this.handleStateChange(state);
    this.game.onScoreChange = (score) => this.updateScore(score);
    this.game.onLivesChange = (lives) => this.updateLives(lives);
    this.game.onEnemyCountChange = (count) => this.updateEnemyCount(count);
    this.game.onLevelChange = (level) => this.updateLevel(level);
    // BOSS 演出：入场名牌 / 阶段闪屏 / 击破横幅
    this.game.onBossIntro = (data) => this.showBossIntro(data);
    this.game.onBossIntroEnd = () => this.hideBossIntro();
    this.game.onBossPhase = (phase) => this.flashBossPhase(phase);
    this.game.onBossDeath = (data) => this.showBossDeath(data);
    // Boss 招牌技喊名
    this.game.onBossAttack = (data) => this.showBossCallout(data);
    // 每帧读统一输入信号，驱动菜单选择与武器 HUD 同步
    this.game.onFrame = (input) => {
      this.updateMenuNav(input);
      this.updateWeaponHud();
    };
    // 手柄热插拔：显示/隐藏按键图例并弹出提示
    this.game.input.onPadChange = (connected, id) => this.onPadChange(connected, id);
  }

  onPadChange(connected, id) {
    this.padConnected = connected;
    this.updatePadLegend();
    if (connected) {
      const name = (id || '').split(' ')[0] || '手柄';
      this.showPadToast(`🎮 ${name} 已连接`);
    } else {
      this.showPadToast('手柄已断开');
    }
  }

  // —— BOSS 演出覆盖层 ——
  showBossIntro(data) {
    if (!this.bossIntro || !data) return;
    this.hideBossDeath();
    if (this.bossIntroName) this.bossIntroName.textContent = data.name || '帮派首领';
    if (this.bossIntroTitle) this.bossIntroTitle.textContent = data.title || 'GANG LORD // 帮派首领';
    if (this.bossIntroPhase) this.bossIntroPhase.textContent = `PHASE ${data.phase || 1} / 3`;
    if (this.bossIntroHp) this.bossIntroHp.textContent = `HP ${data.maxHp || data.hp || 0}`;
    this.bossIntro.classList.add('active');
  }

  hideBossIntro() {
    if (this.bossIntro) this.bossIntro.classList.remove('active');
  }

  flashBossPhase(phase) {
    if (!this.bossPhaseFlash) return;
    if (this.bossPhaseFlashText) {
      this.bossPhaseFlashText.textContent = `PHASE ${phase}`;
    }
    this.bossPhaseFlash.classList.remove('show');
    // 强制回流，保证连续阶段切换能重播动画
    void this.bossPhaseFlash.offsetWidth;
    this.bossPhaseFlash.classList.add('show');
  }

  showBossDeath(data) {
    if (!this.bossDeathBanner) return;
    this._bossDeathName = (data && data.name) || this.game.boss?.displayName || '';
    if (this.bossDeathName) this.bossDeathName.textContent = this._bossDeathName;
    this.bossDeathBanner.classList.add('active');
  }

  hideBossDeath() {
    if (this.bossDeathBanner) this.bossDeathBanner.classList.remove('active');
  }

  // 招牌技喊名：短促红色警示条，让玩家在出招前知道该躲什么
  showBossCallout(data) {
    if (!this.bossCallout) return;
    if (this.bossCalloutName) this.bossCalloutName.textContent = data?.name || '危险招式';
    if (this.bossCalloutKicker) this.bossCalloutKicker.textContent = data?.kicker || 'INCOMING';
    this.bossCallout.style.setProperty('--callout-color', data?.color || '#ff2e58');
    this.bossCallout.classList.remove('show');
    void this.bossCallout.offsetWidth;
    this.bossCallout.classList.add('show');
    clearTimeout(this.bossCalloutTimer);
    this.bossCalloutTimer = setTimeout(() => {
      this.bossCallout.classList.remove('show');
    }, 2200);
  }

  hideBossCallout() {
    if (!this.bossCallout) return;
    clearTimeout(this.bossCalloutTimer);
    this.bossCallout.classList.remove('show');
  }

  // 游戏中隐藏按键图例，避免挡住战斗画面；菜单/选关时再显示
  updatePadLegend() {
    const inGame = this.game.state === GameState.PLAYING || this.game.state === GameState.PAUSED;
    const screen = this.activeScreenName();
    if (this.gpLegend) {
      // 开始界面的按键说明会随设备切换，底部图例不再重复显示
      this.gpLegend.style.display = this.padConnected && !inGame && screen !== 'start' ? 'flex' : 'none';
    }
    // 进入战斗后不再提示“按键激活手柄”，避免压住画面；纯触屏设备也不显示
    const touchOnly = this.game.input.isTouchEnabled() && !this.padConnected;
    if (this.gpPending) {
      this.gpPending.style.display = this.padPromptAllowed && !this.padConnected && !inGame && !touchOnly ? 'flex' : 'none';
    }
    this.updateInputHints();
  }

  // 手柄 API 仅在安全上下文（HTTPS / localhost）可用；非安全上下文下提示用户
  checkGamepadAvailability() {
    const input = this.game.input;
    const secure = input.isSecureContext && input.isSecureContext();
    const apiSupported = input.isGamepadApiSupported();

    if (!apiSupported) {
      // 浏览器完全不支持 Gamepad API
      this.padPromptAllowed = false;
      this.showPadToast('⚠ 当前浏览器不支持手柄');
      return;
    }

    if (!secure) {
      // 非安全上下文：Gamepad API 存在但不会返回真实手柄
      this.padPromptAllowed = false;
      if (this.gpWarn) this.gpWarn.style.display = 'block';
      if (this.gpPending) this.gpPending.style.display = 'none';
      return;
    }

    // 安全上下文：API 可用，提示用户按任意键激活手柄
    this.padPromptAllowed = true;
    this.updatePadLegend();
  }

  showPadToast(msg) {
    if (!this.gpToast) return;
    this.gpToast.textContent = msg;
    this.gpToast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.gpToast.classList.remove('show'), 2200);
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startGame(1));
    document.getElementById('levelSelectBtn').addEventListener('click', () => this.showScreen('levelSelect'));
    document.getElementById('backToStartBtn').addEventListener('click', () => this.showScreen('start'));

    document.getElementById('pauseBtn').addEventListener('click', () => this.game.pause());
    document.getElementById('resumeBtn').addEventListener('click', () => this.game.resume());
    document.getElementById('restartBtn').addEventListener('click', () => this.restartLevel());
    document.getElementById('quitBtn').addEventListener('click', () => this.quitToMenu());

    document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
    document.getElementById('retryBtn').addEventListener('click', () => this.restartLevel());
    document.getElementById('menuBtn').addEventListener('click', () => this.quitToMenu());
  }

  // —— 菜单导航：把统一的导航信号翻译成"移动选中/确认" ——
  activeScreenName() {
    for (const key in this.screens) {
      if (this.screens[key].classList.contains('active')) return key;
    }
    return null;
  }

  refreshMenuItems() {
    const name = this.activeScreenName();
    this.menuScreen = name;

    if (name === 'start') {
      // 干员卡片在前，两个主按钮在后；左右选干员，上下进出按钮区
      const cards = Array.from(document.querySelectorAll('#characterGrid .character-card'));
      this.menuItems = [
        ...cards,
        document.getElementById('startBtn'),
        document.getElementById('levelSelectBtn')
      ];
    } else if (name === 'pause') {
      this.menuItems = [
        document.getElementById('resumeBtn'),
        document.getElementById('restartBtn'),
        document.getElementById('quitBtn')
      ];
    } else if (name === 'gameOver') {
      this.menuItems = this.gameoverButtons.filter((b) => b && b.style.display !== 'none');
    } else if (name === 'levelSelect') {
      const cards = Array.from(document.querySelectorAll('#levelGrid .level-card:not(.locked)'));
      this.menuItems = [...cards, document.getElementById('backToStartBtn')];
    } else {
      this.menuItems = [];
    }

    if (this.menuIndex >= this.menuItems.length) this.menuIndex = 0;

    // 鼠标悬停也同步选中，保证手柄/键盘/鼠标三种方式状态一致
    this.menuItems.forEach((el, i) => {
      if (!el || el.dataset.navBound) return;
      el.dataset.navBound = '1';
      el.addEventListener('mouseenter', () => {
        this.menuIndex = i;
        this.applyMenuSelection();
      });
    });

    this.applyMenuSelection();
  }

  applyMenuSelection() {
    document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    this.menuItems.forEach((el, i) => {
      if (el) el.classList.toggle('selected', i === this.menuIndex);
    });
  }

  updateMenuNav(input) {
    const name = this.activeScreenName();
    if (name !== this.menuScreen) this.refreshMenuItems();
    if (this.menuItems.length === 0) return;

    // B 键 / Backspace：返回（取消）
    if (input.navBack) {
      this.handleBack(name);
      return;
    }

    const n = this.menuItems.length;
    // 关卡选择是 2 列网格，用空间导航更直观：左右 ±1（列），上下 ±2（行）；越界夹取不动
    const isGrid = name === 'levelSelect';
    const cardCount = name === 'start' ? this.characterCardEls.size : 0;
    let delta = 0;
    if (input.navRight) delta = 1;
    else if (input.navLeft) delta = -1;
    else if (input.navDown) delta = isGrid ? 2 : 1;
    else if (input.navUp) delta = isGrid ? -2 : -1;

    if (delta !== 0) {
      let next = this.menuIndex + delta;
      if (name === 'start' && cardCount > 0) {
        if (this.menuIndex < cardCount) {
          // 干员行内左右环绕，上下进入按钮区
          if (input.navUp) next = this.menuIndex;
          else if (input.navDown) next = cardCount;
          else next = (this.menuIndex + (input.navRight ? 1 : -1) + cardCount) % cardCount;
        } else {
          const btnCount = n - cardCount;
          if (input.navLeft || input.navRight) {
            next = this.menuIndex;
          } else if (input.navUp && this.menuIndex === cardCount) {
            // 从「开始游戏」回到当前干员卡片，而不是绕到最后一个按钮
            const activeIndex = [...this.characterCardEls.keys()].indexOf(this.characterId);
            next = activeIndex >= 0 ? activeIndex : cardCount - 1;
          } else {
            const pos = (this.menuIndex - cardCount + (input.navDown ? 1 : -1) + btnCount) % btnCount;
            next = cardCount + pos;
          }
        }
      } else if (isGrid) {
        if (next < 0 || next > n - 1) next = this.menuIndex;
      } else {
        next = (next + n) % n;
      }
      if (next !== this.menuIndex) {
        this.menuIndex = next;
        this.applyMenuSelection();
      }
    }

    if (input.confirm) {
      this.game.input.rumble(0.2, 60);
      const el = this.menuItems[this.menuIndex];
      if (el) el.click();
    }
  }

  // B 键 / Backspace：按当前界面执行"返回"
  handleBack(name) {
    this.game.input.rumble(0.15, 50);
    if (name === 'levelSelect') {
      this.showScreen('start');
    } else if (name === 'pause') {
      this.game.resume();
    } else if (name === 'gameOver') {
      this.quitToMenu();
    }
  }

  showScreen(screenName) {
    for (const key in this.screens) {
      this.screens[key].classList.remove('active');
    }

    if (this.screens[screenName]) {
      this.screens[screenName].classList.add('active');
    }

    if (screenName === 'start' || screenName === 'levelSelect') {
      this.hud.container.style.display = 'none';
    }

    this.menuIndex = 0;
    if (screenName === 'start') {
      // 回到主菜单时把焦点放回当前干员，方便直接换人或开始
      const activeIndex = [...this.characterCardEls.keys()].indexOf(this.characterId);
      if (activeIndex >= 0) this.menuIndex = activeIndex;
    }
    this.refreshMenuItems();
    this.updatePadLegend();
  }

  hideAllScreens() {
    for (const key in this.screens) {
      this.screens[key].classList.remove('active');
    }
    document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    this.hideBossIntro();
    this.hideBossDeath();
    this.hideBossCallout();
    this._bossDeathName = '';
    this.menuScreen = null;
    this.menuItems = [];
  }

  startGame(level) {
    this.hideAllScreens();
    this.hud.container.style.display = 'flex';
    this.game.startLevel(level);
  }

  restartLevel() {
    this.hideAllScreens();
    this.hud.container.style.display = 'flex';
    this.game.startLevel(this.game.currentLevel);
  }

  nextLevel() {
    const next = this.game.currentLevel + 1;
    if (next <= LEVEL_META.length) {
      this.hideAllScreens();
      this.hud.container.style.display = 'flex';
      this.game.startLevel(next);
    } else {
      this.quitToMenu();
    }
  }

  quitToMenu() {
    this.game.state = GameState.MENU;
    this.hud.container.style.display = 'none';
    this.hideBossIntro();
    this.hideBossDeath();
    this.hideBossCallout();
    this.updateWeaponHud();
    this.showScreen('start');
  }

  handleStateChange(state) {
    switch (state) {
      case GameState.PLAYING:
        this.hideAllScreens();
        this.hud.container.style.display = 'flex';
        break;
      case GameState.PAUSED:
        this.screens.pause.classList.add('active');
        this.showScreen('pause');
        break;
      case GameState.GAME_OVER:
        this.showGameOver(false);
        break;
      case GameState.VICTORY:
        this.saveProgress(this.game.currentLevel);
        this.showGameOver(true);
        break;
    }
    this.updatePadLegend();
    this.updateWeaponHud();
  }

  // 评级：命中率 / 用时 / 受击三项各 0-2 分，总分决定 S/A/B/C
  computeRank(victory) {
    if (!victory) return { rank: 'D', note: '任务失败' };

    const fired = this.game.shotsFired || 0;
    const acc = fired > 0 ? this.game.shotsHit / fired : 0;
    const time = this.game.clearTime || 0;
    const taken = this.game.damageTaken || 0;

    let pts = 0;
    if (acc >= 0.55) pts += 2;
    else if (acc >= 0.35) pts += 1;
    if (time > 0 && time <= 100) pts += 2;
    else if (time > 0 && time <= 160) pts += 1;
    if (taken <= 3) pts += 2;
    else if (taken <= 8) pts += 1;

    if (pts >= 6) return { rank: 'S', note: '完美压制' };
    if (pts >= 4) return { rank: 'A', note: '干净利落' };
    if (pts >= 2) return { rank: 'B', note: '勉强过关' };
    return { rank: 'C', note: '险象环生' };
  }

  formatTime(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // 结算数字滚动：一帧内统一推进，避免多个 rAF 互相打断
  animateResultNumbers(rows, duration = 720) {
    cancelAnimationFrame(this._countRaf);
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      for (const row of rows) {
        if (!row.el) continue;
        const v = row.from + (row.to - row.from) * eased;
        row.el.textContent = row.format(v);
      }
      if (p < 1) {
        this._countRaf = requestAnimationFrame(tick);
      } else {
        for (const row of rows) {
          if (row.el) row.el.textContent = row.format(row.to);
        }
      }
    };
    this._countRaf = requestAnimationFrame(tick);
  }

  showGameOver(victory) {
    this.hideBossIntro();
    this.hideBossDeath();
    this.hud.container.style.display = 'none';
    this.screens.gameOver.classList.add('active');

    const titleEl = document.getElementById('resultTitle');
    const kickerEl = document.getElementById('resultKicker');
    const subEl = document.getElementById('resultSub');
    const levelEl = document.getElementById('resultLevel');
    const targetEl = document.getElementById('resultTarget');
    const scoreEl = document.getElementById('resultScore');
    const killsEl = document.getElementById('resultKills');
    const timeEl = document.getElementById('resultTime');
    const accEl = document.getElementById('resultAccuracy');
    const dmgEl = document.getElementById('resultDamage');
    const rankBadge = document.getElementById('rankBadge');
    const rankLetter = document.getElementById('rankLetter');
    const rankNote = document.getElementById('rankNote');
    const rewardEl = document.getElementById('resultReward');
    const rewardValueEl = document.getElementById('resultRewardValue');
    const nextBtn = document.getElementById('nextLevelBtn');
    const retryBtn = document.getElementById('retryBtn');
    const menuBtn = document.getElementById('menuBtn');
    const card = document.getElementById('resultCard');

    const level = this.game.currentLevel;
    const hasNext = level < LEVEL_META.length;
    const bossName = this._bossDeathName || this.game.boss?.displayName || '';

    // 评级
    const { rank, note } = this.computeRank(victory);
    if (rankBadge) {
      rankBadge.dataset.rank = rank;
      rankBadge.style.animation = 'none';
      void rankBadge.offsetWidth;
      rankBadge.style.animation = '';
    }
    if (rankLetter) rankLetter.textContent = rank;
    if (rankNote) rankNote.textContent = note;

    if (victory) {
      titleEl.textContent = '任务完成';
      titleEl.className = 'result-title victory';
      if (kickerEl) kickerEl.textContent = 'MISSION CLEAR';
      if (subEl) subEl.textContent = bossName ? `${bossName} 已被清除` : '区域暴徒已被肃清';
      nextBtn.style.display = hasNext ? 'block' : 'none';
      this.gameoverButtons = hasNext ? [nextBtn, retryBtn, menuBtn] : [retryBtn, menuBtn];

      if (rewardEl) {
        rewardEl.classList.remove('hidden');
        rewardValueEl.textContent = hasNext
          ? `LEVEL ${String(level + 1).padStart(2, '0')} · ${LEVEL_META[level].name}`
          : '全关卡通关 · 感谢游玩';
      }
    } else {
      titleEl.textContent = '任务失败';
      titleEl.className = 'result-title defeat';
      if (kickerEl) kickerEl.textContent = 'MISSION FAILED';
      if (subEl) subEl.textContent = '你倒在了暴徒的枪口下';
      nextBtn.style.display = 'none';
      this.gameoverButtons = [retryBtn, menuBtn];
      if (rewardEl) rewardEl.classList.add('hidden');
    }

    this.menuIndex = 0;
    this.refreshMenuItems();

    // 卡片入场动画重播
    if (card) {
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
    }

    if (levelEl) levelEl.textContent = String(level).padStart(2, '0');
    if (targetEl) {
      targetEl.textContent = bossName || LEVEL_META[level - 1]?.name || '未知目标';
    }

    const fired = this.game.shotsFired || 0;
    const acc = fired > 0 ? Math.round((this.game.shotsHit / fired) * 100) : 0;
    const time = victory ? (this.game.clearTime || 0) : 0;

    // 数字滚动：时间按秒进，命中率/消灭/受击/分数取整
    this.animateResultNumbers([
      { el: timeEl, from: 0, to: time, format: (v) => this.formatTime(v) },
      { el: accEl, from: 0, to: acc, format: (v) => `${Math.round(v)}%` },
      { el: killsEl, from: 0, to: this.game.totalKills || 0, format: (v) => String(Math.round(v)) },
      { el: dmgEl, from: 0, to: this.game.damageTaken || 0, format: (v) => String(Math.round(v)) },
      { el: scoreEl, from: 0, to: this.game.score || 0, format: (v) => String(Math.round(v)) },
    ]);
  }

  updateScore(score) {
    this.hud.score.textContent = score;
  }

  updateLevel(level) {
    this.hud.level.textContent = level;
  }

  updateLives(lives) {
    this.hud.lives.innerHTML = '';
    const profile = (GameConfig.CHARACTERS || []).find((c) => c.id === this.game.characterId);
    const color = (profile && profile.color) || '#ff2e58';
    this.hud.lives.style.setProperty('--life-color', color);
    const maxLives = this.game.maxLives || GameConfig.PLAYER.lives;
    for (let i = 0; i < maxLives; i++) {
      const life = document.createElement('div');
      life.className = 'life-icon' + (i >= lives ? ' empty' : '');
      // 内联兜底颜色：部分手机 WebView 对 color-mix()/CSS 变量组合支持不全，
      // 只依赖样式表会导致生命格“占位但不可见”。
      if (i < lives) life.style.background = color;
      this.hud.lives.appendChild(life);
    }
  }

  updateEnemyCount(count) {
    this.hud.enemyCount.textContent = count;
  }

  // —— 干员选择 ——
  renderCharacterCards() {
    if (!this.characterGrid) return;
    const chars = GameConfig.CHARACTERS || [];
    this.characterGrid.innerHTML = '';
    this.characterCardEls.clear();

    for (const c of chars) {
      const card = document.createElement('div');
      card.className = 'character-card';
      card.dataset.charId = c.id;
      card.style.setProperty('--char-color', c.color || '#3ee6ff');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const portrait = document.createElement('div');
      portrait.className = 'char-portrait';
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      portrait.appendChild(canvas);

      const weaponId = c.startWeapons?.[0]?.id;
      const weaponCfg = weaponId
        ? GameConfig.WEAPONS.find((w) => w.id === weaponId)
        : null;

      const nameRow = document.createElement('div');
      nameRow.className = 'char-name-row';
      nameRow.innerHTML = `<span class="char-name">${c.name}</span><span class="char-code">${c.code || ''}</span>`;

      const trait = document.createElement('div');
      trait.className = 'char-trait';
      trait.textContent = c.trait || '';

      const desc = document.createElement('div');
      desc.className = 'char-desc';
      desc.textContent = c.desc || '';

      const stats = document.createElement('div');
      stats.className = 'char-stats';
      stats.innerHTML = `
        <span class="char-stat"><b>${c.lives}</b>生命</span>
        <span class="char-stat"><b>${(c.speed ?? GameConfig.PLAYER.speed).toFixed(2)}</b>移速</span>
        <span class="char-stat"><b>${weaponCfg ? weaponCfg.name : '手枪'}</b>初始</span>
      `;

      card.append(portrait, nameRow, trait, desc, stats);
      card.addEventListener('click', () => this.selectCharacter(c.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectCharacter(c.id);
        }
      });

      this.characterGrid.appendChild(card);
      this.characterCardEls.set(c.id, { card, canvas });
    }

    this.applyCharacterSelection();
  }

  // 素材加载完成后，把待机首帧画进卡片头像
  drawCharacterPortraits() {
    const sprites = getSprites();
    for (const [id, refs] of this.characterCardEls) {
      const profile = (GameConfig.CHARACTERS || []).find((c) => c.id === id);
      const sheet = sprites[(profile && profile.sheet) || 'player'];
      if (!sheet || !refs.canvas) continue;

      const ctx = refs.canvas.getContext('2d');
      ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.scale(2, 2);
      sheet.draw(ctx, 0, 32, 63, 1);
      ctx.restore();
    }
  }

  selectCharacter(id) {
    if (!this.game.setCharacter(id)) return;
    this.characterId = id;
    this.saveCharacter(id);
    this.applyCharacterSelection();
    this.game.sfx.click();
  }

  applyCharacterSelection() {
    for (const [id, refs] of this.characterCardEls) {
      const active = id === this.characterId;
      refs.card.classList.toggle('active', active);
      refs.card.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  loadCharacter() {
    try {
      const saved = localStorage.getItem('mecha_game_character');
      if (saved && (GameConfig.CHARACTERS || []).some((c) => c.id === saved)) {
        return saved;
      }
    } catch (e) {
      console.log('Failed to load character');
    }
    return 'viktor';
  }

  saveCharacter(id) {
    try {
      localStorage.setItem('mecha_game_character', id);
    } catch (e) {
      console.log('Failed to save character');
    }
  }

  renderLevelGrid() {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';

    for (let i = 0; i < LEVEL_META.length; i++) {
      const config = LEVEL_META[i];
      const levelNum = i + 1;
      const unlocked = this.unlockedLevels.includes(levelNum);

      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="level-number">${levelNum}</div>
        <div class="level-name">${config.name}</div>
        ${config.tag ? `<div class="level-tag">${config.tag}</div>` : ''}
      `;

      if (unlocked) {
        card.addEventListener('click', () => this.startGame(levelNum));
      }

      grid.appendChild(card);
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('mecha_game_progress');
      if (saved) {
        const data = JSON.parse(saved);
        return data.unlockedLevels || [1];
      }
    } catch (e) {
      console.log('Failed to load progress');
    }
    return [1];
  }

  saveProgress(level) {
    try {
      if (!this.unlockedLevels.includes(level + 1) && level < LEVEL_META.length) {
        this.unlockedLevels.push(level + 1);
      }
      localStorage.setItem('mecha_game_progress', JSON.stringify({
        unlockedLevels: this.unlockedLevels
      }));
      this.renderLevelGrid();
    } catch (e) {
      console.log('Failed to save progress');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
