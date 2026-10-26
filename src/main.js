import { Game, GameState } from './game/Game.js';
import { LEVEL_META, GameConfig } from './config/gameConfig.js';

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
    const isTouchDevice = (('ontouchstart' in window) ||
                           (navigator.maxTouchPoints > 0));

    const hint = document.getElementById('controlsHint');
    const menuHint = document.querySelector('.menu-hint');

    if (isTouchDevice) {
      // 移动端：更新操作提示（与虚拟摇杆布局一致）
      if (hint) {
        hint.textContent = '左摇杆：左右移动，上推跳 / 下推蹲 ｜ 右侧按钮：射击 / 跳 / 蹲 / 切枪';
      }
      // 失败界面不显示键盘提示
      if (menuHint) {
        menuHint.style.display = 'none';
      }
    }
  }

  setupGameCallbacks() {
    this.game.onStateChange = (state) => this.handleStateChange(state);
    this.game.onScoreChange = (score) => this.updateScore(score);
    this.game.onLivesChange = (lives) => this.updateLives(lives);
    this.game.onEnemyCountChange = (count) => this.updateEnemyCount(count);
    this.game.onLevelChange = (level) => this.updateLevel(level);
    // 每帧读统一输入信号，驱动菜单选择（键盘方向键 + 手柄 D-pad/摇杆 + A/回车确认）
    this.game.onFrame = (input) => this.updateMenuNav(input);
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
    if (this.gpLegend) {
      this.gpLegend.style.display = this.padConnected && !inGame ? 'flex' : 'none';
    }
    // 进入战斗后不再提示“按键激活手柄”，避免压住画面
    if (this.gpPending) {
      this.gpPending.style.display = this.padPromptAllowed && !this.padConnected && !inGame ? 'flex' : 'none';
    }
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
