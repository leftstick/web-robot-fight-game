export class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    
    // 触控状态
    this.isTouchDevice = this.detectTouchDevice();
    this.touchActive = false;
    this.touchX = 0;
    this.touchY = 0;
    this.canvas = null;
    
    this.init();
  }
  
  detectTouchDevice() {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  }
  
  setCanvas(canvas) {
    this.canvas = canvas;
    if (this.isTouchDevice) {
      this.initTouch();
    }
  }
  
  init() {
    window.addEventListener('keydown', (e) => {
      const key = e.code;
      if (!this.keys[key]) {
        this.justPressed[key] = true;
      }
      this.keys[key] = true;
      
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }
  
  initTouch() {
    if (!this.canvas) return;
    
    const canvas = this.canvas;
    
    const getTouchPos = (touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    };
    
    const handleStart = (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getTouchPos(e.touches[0]);
        this.touchActive = true;
        this.touchX = pos.x;
        this.touchY = pos.y;
      }
    };
    
    const handleMove = (e) => {
      e.preventDefault();
      if (this.touchActive && e.touches.length > 0) {
        const pos = getTouchPos(e.touches[0]);
        this.touchX = pos.x;
        this.touchY = pos.y;
      }
    };
    
    const handleEnd = (e) => {
      e.preventDefault();
      this.touchActive = false;
    };
    
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleEnd, { passive: false });
  }
  
  isKeyDown(keyCode) {
    return this.keys[keyCode] || false;
  }
  
  isKeyJustPressed(keyCode) {
    if (this.justPressed[keyCode]) {
      this.justPressed[keyCode] = false;
      return true;
    }
    return false;
  }
  
  isLeft() {
    return this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA');
  }
  
  isRight() {
    return this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD');
  }
  
  isFire() {
    return this.isKeyDown('Space');
  }
  
  isFireJustPressed() {
    return this.isKeyJustPressed('Space');
  }

  // 下蹲 / 贴掩体藏好：按下方向下键或 S
  isCrouch() {
    return this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS');
  }

  // 跳跃：一次性触发（上键 / W / 空格之外的独立跳键）
  consumeJump() {
    return this.isKeyJustPressed('ArrowUp') ||
           this.isKeyJustPressed('KeyW') ||
           this.isKeyJustPressed('KeyK');
  }

  // 手雷：一次性触发
  consumeGrenade() {
    return this.isKeyJustPressed('KeyG') ||
           this.isKeyJustPressed('KeyE') ||
           this.isKeyJustPressed('KeyJ');
  }

  isPauseJustPressed() {
    return this.isKeyJustPressed('Escape') || this.isKeyJustPressed('KeyP');
  }
  
  // 触控相关方法
  isTouchActive() {
    return this.touchActive;
  }
  
  getTouchX() {
    return this.touchX;
  }
  
  getTouchY() {
    return this.touchY;
  }
  
  clearJustPressed() {
    this.justPressed = {};
  }
}
