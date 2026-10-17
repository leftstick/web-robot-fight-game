// 统一输入抽象层（InputManager）
// 目标：手机虚拟按键 / PC 键盘 / PC 手柄 三种来源，归一化为同一组逻辑信号。
// 游戏逻辑只读 this.state（Input 对象），绝不直接读硬件。

const DEADZONE = 0.15;            // 摇杆死区阈值
const TRIGGER_THRESHOLD = 0.3;    // 扳机视为按下的阈值

function createState() {
  return {
    moveLeft: false,
    moveRight: false,
    jump: false,          // 脉冲信号：按下那一帧为 true
    shoot: false,         // 持续信号：按住持续 true
    crouch: false,
    switchWeapon: false,  // 脉冲信号
    aim: false,           // LT 举枪瞄准
    // 第一版沿用（不在本轮重点，但保留可用）
    pause: false,         // 脉冲
    grenade: false,       // 脉冲
  };
}

export class InputManager {
  constructor() {
    this.state = createState();

    // 键盘
    this.keys = {};
    this.justPressed = {};

    // 手柄（每帧轮询，支持热插拔：断开时 pad 为 null，不报错）
    this.pad = null;

    // 触屏虚拟按键
    this.touchEnabled = this.detectTouchDevice();
    this.controlsEl = null;
    this.touchHeld = {};   // action -> Set<pointerId>
    this.touchEdge = {};   // action -> bool（本帧刚按下，兼容极快点按）

    // 脉冲信号的上帧状态（跨来源统一做边沿检测）
    this._prev = { jump: false, switchWeapon: false, pause: false, grenade: false };

    this.initKeyboard();
  }

  // 是否启用触屏层（支持 ?touch=1 强制开启，便于桌面调试）
  detectTouchDevice() {
    if (typeof window === 'undefined') return false;
    if (typeof location !== 'undefined' && /[?&]touch=1/.test(location.search)) return true;
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  }

  isTouchEnabled() {
    return this.touchEnabled;
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.code;
      if (!this.keys[key]) this.justPressed[key] = true;
      this.keys[key] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(key)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    // 失焦时清空键盘状态，避免"卡键"
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  // 绑定 canvas 上方的虚拟按键层（多点触控）
  bindTouchControls(container) {
    this.controlsEl = container;
    if (!container) return;
    if (this.touchEnabled) container.classList.add('enabled');

    const buttons = container.querySelectorAll('[data-action]');
    buttons.forEach((el) => {
      const action = el.dataset.action;

      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (el.setPointerCapture) {
          try { el.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
        }
        this._touchDown(action, e.pointerId);
        el.classList.add('active');
      });

      const release = (e) => {
        this._touchUp(action, e.pointerId);
        const set = this.touchHeld[action];
        if (!set || set.size === 0) el.classList.remove('active');
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  _touchDown(action, id) {
    if (!this.touchHeld[action]) this.touchHeld[action] = new Set();
    this.touchHeld[action].add(id);
    this.touchEdge[action] = true;
  }

  _touchUp(action, id) {
    const set = this.touchHeld[action];
    if (set) set.delete(id);
  }

  _touchIsDown(action) {
    const set = this.touchHeld[action];
    return (set && set.size > 0) || !!this.touchEdge[action];
  }

  // —— 每帧轮询：读取手柄 + 汇总所有来源，产出统一逻辑信号 ——
  poll() {
    const s = this.state;
    const kb = this.keys;
    const jp = this.justPressed;

    // —— 键盘 ——
    const kbLeft = !!kb['ArrowLeft'] || !!kb['KeyA'];
    const kbRight = !!kb['ArrowRight'] || !!kb['KeyD'];
    const kbCrouch = !!kb['ArrowDown'] || !!kb['KeyS'];
    const kbShoot = !!kb['Space'] || !!kb['KeyJ'];
    const kbAim = !!kb['ShiftLeft'] || !!kb['ShiftRight'];
    const kbJump = !!kb['ArrowUp'] || !!kb['KeyW'] || !!kb['KeyK'] ||
                   !!jp['ArrowUp'] || !!jp['KeyW'] || !!jp['KeyK'];
    const kbSwitch = !!kb['KeyL'] || !!kb['KeyQ'] || !!kb['KeyE'] || !!kb['Tab'] ||
                     !!jp['KeyL'] || !!jp['KeyQ'] || !!jp['KeyE'] || !!jp['Tab'];
    const kbPause = !!kb['Escape'] || !!kb['KeyP'] || !!jp['Escape'] || !!jp['KeyP'];
    const kbGrenade = !!kb['KeyG'] || !!jp['KeyG'];

    // —— 触屏虚拟按键 ——
    const touchLeft = this._touchIsDown('left');
    const touchRight = this._touchIsDown('right');
    const touchJump = this._touchIsDown('jump');
    const touchShoot = this._touchIsDown('shoot');
    const touchCrouch = this._touchIsDown('crouch');
    const touchSwitch = this._touchIsDown('switch');
    const touchAim = this._touchIsDown('aim');

    // —— 手柄：每帧轮询 navigator.getGamepads() ——
    this.pad = this.findPad();
    let padLeft = false, padRight = false, padCrouch = false, padJump = false,
        padShoot = false, padSwitch = false, padAim = false;
    const pad = this.pad;
    if (pad) {
      const ax = pad.axes || [];
      const bt = pad.buttons || [];
      const sx = ax[0] || 0;
      const sy = ax[1] || 0;
      const btn = (i) => { const b = bt[i]; return !!b && (b.pressed || b.value > 0.5); };
      const rt = Math.max(ax[5] != null ? ax[5] : -1, bt[7] ? (bt[7].value || 0) : 0);
      const lt = Math.max(ax[2] != null ? ax[2] : -1, bt[6] ? (bt[6].value || 0) : 0);

      padLeft = sx < -DEADZONE || btn(14);                    // 左摇杆左 / D-pad 左
      padRight = sx > DEADZONE || btn(15);                    // 左摇杆右 / D-pad 右
      padCrouch = sy > DEADZONE || btn(13) || btn(1) || btn(4); // 摇杆下 / D-pad 下 / B / LB
      padJump = btn(0);                                        // A
      padShoot = btn(2) || rt > TRIGGER_THRESHOLD;             // X / RT
      padSwitch = btn(3) || btn(5);                            // Y / RB
      padAim = lt > TRIGGER_THRESHOLD;                         // LT
    }

    // —— 汇总为逻辑信号 ——
    s.moveLeft = kbLeft || touchLeft || padLeft;
    s.moveRight = kbRight || touchRight || padRight;
    s.crouch = kbCrouch || touchCrouch || padCrouch;
    s.shoot = kbShoot || touchShoot || padShoot;
    s.aim = kbAim || touchAim || padAim;

    // 脉冲信号：跨来源统一边沿检测
    const heldJump = kbJump || touchJump || padJump;
    s.jump = heldJump && !this._prev.jump;
    this._prev.jump = heldJump;

    const heldSwitch = kbSwitch || touchSwitch || padSwitch;
    s.switchWeapon = heldSwitch && !this._prev.switchWeapon;
    this._prev.switchWeapon = heldSwitch;

    const heldPause = kbPause;
    s.pause = heldPause && !this._prev.pause;
    this._prev.pause = heldPause;

    const heldGrenade = kbGrenade;
    s.grenade = heldGrenade && !this._prev.grenade;
    this._prev.grenade = heldGrenade;

    // 清理本帧脉冲缓存
    this.justPressed = {};
    this.touchEdge = {};

    return s;
  }

  findPad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) return p;
    }
    return null;
  }

  clearJustPressed() {
    this.justPressed = {};
    this.touchEdge = {};
  }
}
