import { Game, GameState } from './game/Game.js';
import { LevelConfigs, GameConfig } from './config/gameConfig.js';

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
    
    this.gameoverSelection = 0;
    this.gameoverButtons = [];
    
    this.init();
  }
  
  init() {
    this.setupGameCallbacks();
    this.setupEventListeners();
    this.renderLevelGrid();
    this.showScreen('start');
    this.game.init();
  }
  
  setupGameCallbacks() {
    this.game.onStateChange = (state) => this.handleStateChange(state);
    this.game.onScoreChange = (score) => this.updateScore(score);
    this.game.onLivesChange = (lives) => this.updateLives(lives);
    this.game.onEnemyCountChange = (count) => this.updateEnemyCount(count);
    this.game.onLevelChange = (level) => this.updateLevel(level);
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
    
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }
  
  handleKeyDown(e) {
    if (!this.screens.gameOver.classList.contains('active')) return;
    
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      this.moveGameoverSelection(e.code === 'ArrowDown' ? 1 : -1);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this.confirmGameoverSelection();
    }
  }
  
  moveGameoverSelection(direction) {
    if (this.gameoverButtons.length === 0) return;
    
    this.gameoverSelection = (this.gameoverSelection + direction + this.gameoverButtons.length) % this.gameoverButtons.length;
    this.updateGameoverSelectionUI();
  }
  
  updateGameoverSelectionUI() {
    this.gameoverButtons.forEach((btn, index) => {
      if (index === this.gameoverSelection) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }
  
  confirmGameoverSelection() {
    if (this.gameoverButtons.length > 0 && this.gameoverButtons[this.gameoverSelection]) {
      this.gameoverButtons[this.gameoverSelection].click();
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
  }
  
  hideAllScreens() {
    for (const key in this.screens) {
      this.screens[key].classList.remove('active');
    }
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
    if (next <= LevelConfigs.length) {
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
        break;
      case GameState.GAME_OVER:
        this.showGameOver(false);
        break;
      case GameState.VICTORY:
        this.saveProgress(this.game.currentLevel);
        this.showGameOver(true);
        break;
    }
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
      const hasNext = this.game.currentLevel < LevelConfigs.length;
      nextBtn.style.display = hasNext ? 'block' : 'none';
      
      this.gameoverButtons = hasNext ? [nextBtn, retryBtn, menuBtn] : [retryBtn, menuBtn];
    } else {
      titleEl.textContent = '失败...';
      titleEl.className = 'result-title defeat';
      nextBtn.style.display = 'none';
      
      this.gameoverButtons = [retryBtn, menuBtn];
    }
    
    this.gameoverSelection = 0;
    this.updateGameoverSelectionUI();
    
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
    for (let i = 0; i < GameConfig.PLAYER_LIVES; i++) {
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
    
    for (let i = 0; i < LevelConfigs.length; i++) {
      const config = LevelConfigs[i];
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
      if (!this.unlockedLevels.includes(level + 1) && level < LevelConfigs.length) {
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
