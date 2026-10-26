// 轻量音效系统：用 WebAudio 合成音效，不依赖任何外部音频资源。
// 在音频不可用 / 尚未获得用户手势时静默降级，绝不抛错中断游戏。

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  _ensure() {
    if (!this.enabled) return null;
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.enabled = false;
        return null;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
      return null;
    }
    return this.ctx;
  }

  // 在用户手势（开始游戏）后恢复音频上下文
  resume() {
    const ctx = this._ensure();
    if (ctx && ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  }

  _tone({ freq = 440, slideTo = null, type = 'square', dur = 0.1, vol = 0.25, delay = 0 }) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  _noise({ dur = 0.25, vol = 0.4, cutoff = 1200 }) {
    const ctx = this._ensure();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  jump() {
    this._tone({ freq: 320, slideTo: 640, type: 'square', dur: 0.14, vol: 0.2 });
  }

  shoot() {
    this._tone({ freq: 900, slideTo: 300, type: 'square', dur: 0.07, vol: 0.16 });
  }

  enemyShoot() {
    this._tone({ freq: 520, slideTo: 220, type: 'sawtooth', dur: 0.09, vol: 0.11 });
  }

  throwGrenade() {
    this._tone({ freq: 260, slideTo: 170, type: 'triangle', dur: 0.12, vol: 0.16 });
  }

  explosion() {
    this._noise({ dur: 0.34, vol: 0.45, cutoff: 900 });
    this._tone({ freq: 150, slideTo: 40, type: 'sawtooth', dur: 0.3, vol: 0.26 });
  }

  hurt() {
    this._tone({ freq: 220, slideTo: 80, type: 'sawtooth', dur: 0.28, vol: 0.28 });
  }

  click() {
    this._tone({ freq: 520, slideTo: 780, type: 'square', dur: 0.06, vol: 0.14 });
  }

  pickup() {
    this._tone({ freq: 660, slideTo: 990, type: 'square', dur: 0.08, vol: 0.16 });
    this._tone({ freq: 990, slideTo: 1320, type: 'triangle', dur: 0.12, vol: 0.12, delay: 0.07 });
  }

  empty() {
    this._tone({ freq: 190, slideTo: 85, type: 'square', dur: 0.12, vol: 0.13 });
  }
}
