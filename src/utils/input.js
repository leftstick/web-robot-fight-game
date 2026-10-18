// 统一输入抽象层（InputManager）
// 目标：手机虚拟摇杆 / PC 键盘 / PC 手柄 三种来源，归一化为同一组逻辑信号。
// 游戏逻辑只读 this.state（Input 对象），绝不直接读硬件。

const DEADZONE = 0.15;            // 手柄摇杆死区阈值
const TRIGGER_THRESHOLD = 0.3;    // 扳机视为按下的阈值
const STICK_DEADZONE_X = 0.28;    // 虚拟摇杆水平死区（移动）
const STICK_DEADZONE_Y = 0.45;    // 虚拟摇杆垂直死区（跳/蹲，阈值更高避免误触）

function createState() {
  return {
    moveLeft: false,
    moveRight: false,
    jump: false,          // 脉冲信号：按下那一帧为 true
    shoot: false,         // 持续信号：按住持续 true
    crouch: false,
    switchWeapon: false,  // 脉冲信号
    aim: false,           // LT 举枪瞄准
    melee: false,         // 脉冲信号：X 键近战劈砍
    // 菜单导航（脉冲信号）：键盘/手柄共用，UI 层只读这些信号做菜单选择
    navUp: false,
    navDown: false,
    navLeft: false,
    navRight: false,
    confirm: false,       // A 键 / 回车 / 空格 确认
    navBack: false,       // B 键 / Backspace 返回（取消）
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
    this.padConnected = false;
    this._padWasConnected = false;
    this.onPadChange = null;   // (connected, id) => void，供 UI 显示连接提示/按键图例

    // 触屏虚拟按键
    this.touchEnabled = this.detectTouchDevice();
    this.lastDevice = this.touchEnabled ? 'touch' : 'keyboard';  // 最近使用的输入设备，HUD 提示据此切换
    this.controlsEl = null;
    this.touchHeld = {};   // action -> Set<pointerId>
    this.touchEdge = {};   // action -> bool（本帧刚按下，兼容极快点按）

    // 触屏虚拟摇杆（左下角）：模拟量 -1~1，x 左右移动，y 上跳下蹲
    this.stickEl = null;
    this.stickKnob = null;
    this.stickPointerId = null;
    this.stickVec = { x: 0, y: 0 };
    this.stickCenter = { x: 0, y: 0 };
    this.stickRadius = 1;

    // 脉冲信号的上帧状态（跨来源统一做边沿检测）
    this._prev = {
      jump: false, switchWeapon: false, pause: false, grenade: false, melee: false,
      navUp: false, navDown: false, navLeft: false, navRight: false, confirm: false,
    };

    this.initKeyboard();
    this.initGamepadEvents();
  }

  // —— 手柄连接/断开事件（比纯轮询更可靠：浏览器在按键后才会触发 gamepadconnected）——
  initGamepadEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', (e) => {
      this._padWasConnected = false;   // 强制下次 poll 触发 onPadChange
      this.padConnected = true;
      if (this.onPadChange) this.onPadChange(true, (e.gamepad && e.gamepad.id) || '');
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this._padWasConnected = false;
      this.padConnected = false;
      if (this.onPadChange) this.onPadChange(false, (e.gamepad && e.gamepad.id) || '');
    });
  }

  // 当前页面是否满足手柄 API 的安全上下文要求
  isSecureContext() {
    return typeof window !== 'undefined' && window.isSecureContext === true;
  }

  // 浏览器是否支持 Gamepad API
  isGamepadApiSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
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
      this.resetStick();
    });
  }

  // 绑定 canvas 上方的虚拟按键层（多点触控）
  bindTouchControls(container) {
    this.controlsEl = container;
    if (!container) return;
    if (this.touchEnabled) container.classList.add('enabled');

    this.bindTouchStick(container.querySelector('.tc-stick'));

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

  // —— 虚拟摇杆：按下抓取，拖动产生模拟量，抬起归中 ——
  bindTouchStick(el) {
    if (!el) return;
    this.stickEl = el;
    this.stickKnob = el.querySelector('.tc-stick-knob');

    el.addEventListener('pointerdown', (e) => {
      if (this.stickPointerId !== null) return;   // 已在拖动
      e.preventDefault();
      this.stickPointerId = e.pointerId;
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      }
      const r = el.getBoundingClientRect();
      this.stickCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.stickRadius = Math.max(1, r.width * 0.34);
      el.classList.add('active');
      this._stickMove(e.clientX, e.clientY);
    });

    const move = (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      this._stickMove(e.clientX, e.clientY);
    };
    const release = (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.resetStick();
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _stickMove(clientX, clientY) {
    const c = this.stickCenter;
    const R = this.stickRadius;
    let dx = clientX - c.x;
    let dy = clientY - c.y;

    // 竖屏模式下 .game-container 被 CSS rotate(90deg) 旋转，
    // 屏幕坐标与容器本地坐标不一致，需做逆旋转换算，否则方向全反。
    // rotate(90deg) 为顺时针90°，逆变换（屏幕→本地）：localX=dy, localY=-dx
    if (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(orientation: portrait)').matches) {
      const localDx = dy;
      const localDy = -dx;
      dx = localDx;
      dy = localDy;
    }

    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, R);
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;

    this.stickVec.x = (ux * clamped) / R;   // -1 ~ 1
    this.stickVec.y = (uy * clamped) / R;

    if (this.stickKnob) {
      const kx = (ux * clamped).toFixed(1);
      const ky = (uy * clamped).toFixed(1);
      this.stickKnob.style.transform = `translate(-50%, -50%) translate(${kx}px, ${ky}px)`;
    }
  }

  resetStick() {
    this.stickPointerId = null;
    this.stickVec.x = 0;
    this.stickVec.y = 0;
    if (this.stickEl) this.stickEl.classList.remove('active');
    if (this.stickKnob) this.stickKnob.style.transform = 'translate(-50%, -50%)';
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
    const kbMelee = !!kb['KeyX'] || !!jp['KeyX'];

    // —— 触屏虚拟按键 ——
    const touchLeft = this._touchIsDown('left');
    const touchRight = this._touchIsDown('right');
    const touchJump = this._touchIsDown('jump');
    const touchShoot = this._touchIsDown('shoot');
    const touchCrouch = this._touchIsDown('crouch');
    const touchSwitch = this._touchIsDown('switch');
    const touchAim = this._touchIsDown('aim');

    // —— 触屏虚拟摇杆（左下角模拟摇杆）——
    const sv = this.stickVec;
    const stickLeft = sv.x < -STICK_DEADZONE_X;
    const stickRight = sv.x > STICK_DEADZONE_X;
    const stickUp = sv.y < -STICK_DEADZONE_Y;
    const stickDown = sv.y > STICK_DEADZONE_Y;

    // —— 手柄：每帧轮询 navigator.getGamepads() ——
    this.pad = this.findPad();
    const padNow = !!this.pad;
    if (padNow !== this._padWasConnected) {
      this._padWasConnected = padNow;
      this.padConnected = padNow;
      this.lastDevice = padNow ? 'pad' : this.lastDevice;
      if (this.onPadChange) this.onPadChange(padNow, padNow ? (this.pad.id || '') : '');
    }
    let padLeft = false, padRight = false, padCrouch = false, padJump = false,
        padShoot = false, padSwitch = false, padAim = false, padMelee = false,
        padNavUp = false, padNavDown = false, padNavLeft = false, padNavRight = false,
        padConfirm = false, padBack = false, padGrenade = false, padPause = false;
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
      padCrouch = sy > DEADZONE || btn(13) || btn(1);           // 摇杆下 / D-pad 下 / B
      padJump = btn(0);                                        // A
      padShoot = btn(2) || rt > TRIGGER_THRESHOLD;             // X / RT
      padSwitch = btn(3) || btn(5);                            // Y / RB
      padAim = lt > TRIGGER_THRESHOLD;                         // LT
      padGrenade = btn(4);                                     // LB 手雷
      padMelee = btn(11);                                      // R3 近战劈砍
      padPause = btn(9);                                       // Start 暂停

      // 菜单导航：D-pad(12/13/14/15) 或左摇杆（>0.5 视为方向），A(0) 确认
      const navDirX = sx > 0.5 ? 1 : (sx < -0.5 ? -1 : 0);
      const navDirY = sy > 0.5 ? 1 : (sy < -0.5 ? -1 : 0);
      padNavUp = btn(12) || navDirY < 0;
      padNavDown = btn(13) || navDirY > 0;
      padNavLeft = btn(14) || navDirX < 0;
      padNavRight = btn(15) || navDirX > 0;
      padConfirm = btn(0);
      padBack = btn(1);                                        // B 键：返回/取消
    }

    // —— 汇总为逻辑信号 ——
    s.moveLeft = kbLeft || touchLeft || stickLeft || padLeft;
    s.moveRight = kbRight || touchRight || stickRight || padRight;
    // 摇杆也支持"上推=跳、下推=蹲"，与方向键功能完全等价
    s.crouch = kbCrouch || touchCrouch || stickDown || padCrouch;
    s.shoot = kbShoot || touchShoot || padShoot;
    s.aim = kbAim || touchAim || padAim;

    // 脉冲信号：跨来源统一边沿检测
    const heldJump = kbJump || touchJump || stickUp || padJump;
    s.jump = heldJump && !this._prev.jump;
    this._prev.jump = heldJump;

    const heldSwitch = kbSwitch || touchSwitch || padSwitch;
    s.switchWeapon = heldSwitch && !this._prev.switchWeapon;
    this._prev.switchWeapon = heldSwitch;

    const heldPause = kbPause || padPause;
    s.pause = heldPause && !this._prev.pause;
    this._prev.pause = heldPause;

    const heldGrenade = kbGrenade || padGrenade;
    s.grenade = heldGrenade && !this._prev.grenade;
    this._prev.grenade = heldGrenade;

    // 近战劈砍：键盘 X / 手柄 R3，脉冲信号
    const heldMelee = kbMelee || padMelee;
    s.melee = heldMelee && !this._prev.melee;
    this._prev.melee = heldMelee;

    // —— 菜单导航（键盘方向键/回车/空格 + 手柄 D-pad/左摇杆/A），脉冲信号 ——
    const kbNavUp = !!kb['ArrowUp'] || !!jp['ArrowUp'];
    const kbNavDown = !!kb['ArrowDown'] || !!jp['ArrowDown'];
    const kbNavLeft = !!kb['ArrowLeft'] || !!jp['ArrowLeft'];
    const kbNavRight = !!kb['ArrowRight'] || !!jp['ArrowRight'];
    const kbConfirm = !!kb['Enter'] || !!kb['NumpadEnter'] || !!kb['Space'] || !!kb['KeyJ'] ||
                      !!jp['Enter'] || !!jp['NumpadEnter'] || !!jp['Space'] || !!jp['KeyJ'];
    // 返回键只用「取消」语义（B 键 / Backspace）；Esc 留给暂停切换，避免同帧冲突
    const kbBack = !!kb['Backspace'] || !!jp['Backspace'];

    s.navUp = (kbNavUp || padNavUp) && !this._prev.navUp;
    this._prev.navUp = kbNavUp || padNavUp;

    s.navDown = (kbNavDown || padNavDown) && !this._prev.navDown;
    this._prev.navDown = kbNavDown || padNavDown;

    s.navLeft = (kbNavLeft || padNavLeft) && !this._prev.navLeft;
    this._prev.navLeft = kbNavLeft || padNavLeft;

    s.navRight = (kbNavRight || padNavRight) && !this._prev.navRight;
    this._prev.navRight = kbNavRight || padNavRight;

    s.confirm = (kbConfirm || padConfirm) && !this._prev.confirm;
    this._prev.confirm = kbConfirm || padConfirm;

    s.navBack = (kbBack || padBack) && !this._prev.navBack;
    this._prev.navBack = kbBack || padBack;

    // —— 记录最近使用的输入设备，HUD 按键提示据此切换 ——
    const padActive = padLeft || padRight || padCrouch || padJump || padShoot ||
                      padSwitch || padAim || padConfirm || padBack || padGrenade ||
                      padNavUp || padNavDown || padNavLeft || padNavRight || padPause;
    const touchActive = touchLeft || touchRight || touchJump || touchShoot ||
                        touchCrouch || touchSwitch || touchAim ||
                        stickLeft || stickRight || stickUp || stickDown;
    const kbActive = kbLeft || kbRight || kbCrouch || kbShoot || kbAim || kbJump ||
                     kbSwitch || kbPause || kbGrenade || kbNavUp || kbNavDown ||
                     kbNavLeft || kbNavRight || kbConfirm || kbBack;
    if (padActive) this.lastDevice = 'pad';
    else if (touchActive) this.lastDevice = 'touch';
    else if (kbActive) this.lastDevice = 'keyboard';

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

  // 最近使用的输入设备：'pad' | 'touch' | 'keyboard'（HUD 按键提示据此显示）
  getActiveDevice() {
    return this.lastDevice;
  }

  isPadConnected() {
    return !!this.pad;
  }

  // 手柄震动反馈（不支持则静默忽略）
  rumble(strength = 0.3, duration = 100) {
    if (!this.pad || !this.pad.vibrationActuator) return;
    try {
      this.pad.vibrationActuator.playEffect('dual-rumble', {
        duration,
        strongMagnitude: strength,
        weakMagnitude: strength * 0.6,
      });
    } catch (_) { /* 忽略 */ }
  }
}
