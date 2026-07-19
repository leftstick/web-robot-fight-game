export class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    
    this.init();
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
  
  isPauseJustPressed() {
    return this.isKeyJustPressed('Escape') || this.isKeyJustPressed('KeyP');
  }
  
  clearJustPressed() {
    this.justPressed = {};
  }
}
