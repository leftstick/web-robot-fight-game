import { Game, GameState } from './game/Game.js';
import { LEVEL_META, GameConfig } from './config/gameConfig.js';

// 按键提示文案：按当前设备切换，手柄连接时优先显示手柄按键
const INPUT_HINTS = {
  keyboard: '键盘：← → / A D 移动 · ↑ / W / K 跳 · ↓ / S 蹲 · 空格 / J 射击 · Q / L 切枪 · G 手雷 · X 劈砍',
  pad: '手柄：左摇杆 / 十字键 移动 · A 跳 · X / RT 射击 · B 蹲 · Y / RB 切枪 · LT 瞄准 · LB 手雷 · R3 劈砍 · Start 暂停',
  touch: '触屏：左摇杆 移动，下推蹲 · 右侧按钮 射击 / 跳 / 蹲 / 切枪',
  keyboardMenu: '菜单：方向键 选择 · 空格 / 回车 确认 · Backspace 返回',
  padMenu: '菜单：D-pad / 左摇杆 选择 · A 确认 · B 返回',
  // 游戏内提示分三行，短句更适合快速扫读；键名用 <b> 高亮
  keyboardLines: [
    '<b>A</b>/<b>D</b> 移动 <span class="sep">·</span> <b>W</b> 跳 <span class="sep">·</span> <b>S</b> 蹲',
    '<b>空格</b> 射击 <span class="sep">·</span> <b>Q</b> 切枪 <span class="sep">·</span> <b>X</b> 劈砍',
    '<b>G</b> 手雷 <span class="sep">·</span> <b>Esc</b> 暂停',
  ],
  padLines: [
    '<b>左摇杆</b> 移动 <span class="sep">·</span> <b>A</b> 跳 <span class="sep">·</span> <b>B</b> 蹲',
    '<b>X</b>/<b>RT</b> 射击 <span class="sep">·</span> <b>Y</b>/<b>RB</b> 切枪',
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
    this.weaponName = document.getElementById('weaponName');
    this.weaponAmmo = document.getElementById('weaponAmmo');
    this.weaponSlots = document.getElementById('weaponSlots');
    this.weaponSlotEls = new Map();
    this._weaponIconId = null;
    this._weaponIdsSig = '';
    this._weaponAmmoText = '';
    this._weaponLow = false;
    this._weaponColor = '';
    this._activeSlotId = null;

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
    this.checkGamepadAvailability();
    // 显示加载画面，素材加载完成后显示开始界面
    this.showScreen('start');
    this.game.init();
    this.tryLockLandscape();
  }

  // 强制横屏：尝试调用 Screen Orientation API（需用户手势，失败则静默，
  // CSS 端已有 rotate(90deg) fallback 保证竖屏下仍横屏显示）
  tryLockLandscape() {
    const lock = () => {
      try {
        const so = screen.orientation;
        if (so && typeof so.lock === 'function') {
          so.lock('landscape').catch(() => { /* 浏览器不支持/拒绝，忽略 */ });
        }
      } catch (_) { /* 忽略 */ }
    };
    // 首次用户交互时尝试锁定（浏览器策略要求）
    const handler = () => { lock(); window.removeEventListener('pointerdown', handler); };
    window.addEventListener('pointerdown', handler, { once: true });
  }

  setupDeviceSpecific() {
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
    this.weaponHud.classList.toggle('visible', playing);
    if (!playing) return;

    const w = p.getWeapon();
    if (!w) {
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
      this.menuItems = [
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
    let delta = 0;
    if (input.navRight) delta = 1;
    else if (input.navLeft) delta = -1;
    else if (input.navDown) delta = isGrid ? 2 : 1;
    else if (input.navUp) delta = isGrid ? -2 : -1;

    if (delta !== 0) {
      let next = this.menuIndex + delta;
      if (isGrid) {
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
    this.refreshMenuItems();
    this.updatePadLegend();
  }

  hideAllScreens() {
    for (const key in this.screens) {
      this.screens[key].classList.remove('active');
    }
    document.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
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

  showGameOver(victory) {
    this.hud.container.style.display = 'none';
    this.screens.gameOver.classList.add('active');

    const titleEl = document.getElementById('resultTitle');
    const levelEl = document.getElementById('resultLevel');
    const scoreEl = document.getElementById('resultScore');
    const killsEl = document.getElementById('resultKills');
    const nextBtn = document.getElementById('nextLevelBtn');
    const retryBtn = document.getElementById('retryBtn');
    const menuBtn = document.getElementById('menuBtn');

    if (victory) {
      titleEl.textContent = '胜利!';
      titleEl.className = 'result-title victory';
      const hasNext = this.game.currentLevel < LEVEL_META.length;
      nextBtn.style.display = hasNext ? 'block' : 'none';

      this.gameoverButtons = hasNext ? [nextBtn, retryBtn, menuBtn] : [retryBtn, menuBtn];
    } else {
      titleEl.textContent = '失败...';
      titleEl.className = 'result-title defeat';
      nextBtn.style.display = 'none';

      this.gameoverButtons = [retryBtn, menuBtn];
    }

    this.menuIndex = 0;
    this.refreshMenuItems();

    levelEl.textContent = this.game.currentLevel;
    scoreEl.textContent = this.game.score;
    killsEl.textContent = this.game.totalKills;
  }

  updateScore(score) {
    this.hud.score.textContent = score;
  }

  updateLevel(level) {
    this.hud.level.textContent = level;
  }

  updateLives(lives) {
    this.hud.lives.innerHTML = '';
    for (let i = 0; i < GameConfig.PLAYER.lives; i++) {
      const life = document.createElement('div');
      life.className = 'life-icon' + (i >= lives ? ' empty' : '');
      this.hud.lives.appendChild(life);
    }
  }

  updateEnemyCount(count) {
    this.hud.enemyCount.textContent = count;
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
