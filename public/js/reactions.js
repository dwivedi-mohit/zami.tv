/**
 * Reactions & Sound Synthesizer Engine
 * Provides vector particle burst animations and zero-dependency Web Audio sound effects.
 * 100% vector SVG paths rendered on canvas - zero emojis.
 */

const VECTOR_PATHS = {
  heart: new Path2D('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'),
  star: new Path2D('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'),
  flame: new Path2D('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'),
  zap: new Path2D('M13 2L3 14h9l-1 8 10-12h-9l1-8z'),
  clap: new Path2D('M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3'),
  laugh: new Path2D('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-3 8a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 9 10zm6 0a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 15 10zm-3 7a5 5 0 0 1-4.24-2.34.75.75 0 1 1 1.28-.78 3.5 3.5 0 0 0 5.92 0 .75.75 0 0 1 1.28.78A5 5 0 0 1 12 17z'),
  shock: new Path2D('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-3 7a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 9 9zm6 0a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 15 9zm-3 8a2.5 2.5 0 1 1 2.5-2.5A2.5 2.5 0 0 1 12 17z')
};

const VECTOR_COLORS = {
  heart: '#ef4444',
  star: '#f59e0b',
  flame: '#f97316',
  zap: '#10b981',
  clap: '#eab308',
  laugh: '#6366f1',
  shock: '#06b6d4'
};

class ReactionEngine {
  constructor() {
    this.canvas = document.getElementById('reaction-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.audioCtx = null;
    const storedSound = localStorage.getItem('cinesync_sound_enabled');
    this.soundEnabled = storedSound !== null ? storedSound === 'true' : true;

    if (this.canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.loop();
    }
  }

  setSoundEnabled(val) {
    this.soundEnabled = !!val;
    localStorage.setItem('cinesync_sound_enabled', this.soundEnabled);
  }

  toggleSound() {
    this.setSoundEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playNoiseBuffer(duration = 1.2, filterFreq = 1200) {
    if (!this.audioCtx) return;
    const bufferSize = Math.floor(this.audioCtx.sampleRate * duration);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);
    noise.start(now);
  }

  // Play synthetic pleasant sound (Zero external audio file dependencies)
  playSound(type = 'pop') {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'message') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.07); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'join') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'airhorn') {
        const freqs = [587.33, 739.99, 880];
        [0, 0.11, 0.22].forEach(offset => {
          freqs.forEach(f => {
            const o = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, now + offset);
            g.gain.setValueAtTime(0.09, now + offset);
            g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
            o.connect(g);
            g.connect(this.audioCtx.destination);
            o.start(now + offset);
            o.stop(now + offset + 0.09);
          });
        });
      } else if (type === 'applause') {
        this.playNoiseBuffer(1.6, 1100);
      } else if (type === 'laugh') {
        [0, 0.1, 0.2, 0.32, 0.44].forEach((delay, idx) => {
          const o = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          o.type = 'triangle';
          const f = idx % 2 === 0 ? 523.25 : 659.25;
          o.frequency.setValueAtTime(f, now + delay);
          g.gain.setValueAtTime(0.12, now + delay);
          g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
          o.connect(g);
          g.connect(this.audioCtx.destination);
          o.start(now + delay);
          o.stop(now + delay + 0.08);
        });
      } else if (type === 'boom') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.85);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.start(now);
        osc.stop(now + 0.85);
      } else if (type === 'gasp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.35);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'crickets') {
        [0, 0.08, 0.2, 0.28, 0.5, 0.58].forEach(offset => {
          const o = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(4500, now + offset);
          g.gain.setValueAtTime(0.08, now + offset);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
          o.connect(g);
          g.connect(this.audioCtx.destination);
          o.start(now + offset);
          o.stop(now + offset + 0.05);
        });
      }
    } catch (e) {
      // Audio autoplay policy or error
    }
  }

  triggerSoundboard(soundId, senderName = 'Someone') {
    this.playSound(soundId);

    const soundTypeMap = {
      applause: 'clap',
      laugh: 'laugh',
      airhorn: 'zap',
      boom: 'flame',
      gasp: 'shock',
      crickets: 'star'
    };
    const reactionType = soundTypeMap[soundId] || 'star';
    this.triggerReaction(reactionType);

    const soundSvgIcons = {
      applause: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
      laugh: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
      airhorn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
      boom: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      gasp: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      crickets: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    };

    const iconSvg = soundSvgIcons[soundId] || '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>';

    // Floating reaction pill
    const container = document.getElementById('toast-container');
    if (container) {
      const pill = document.createElement('div');
      pill.className = 'soundboard-bubble-pill';
      const safeName = typeof escapeHtml !== 'undefined' ? escapeHtml(senderName) : senderName;
      pill.innerHTML = `<span class="soundboard-pill-svg" style="display: inline-flex; align-items: center;">${iconSvg}</span> <span><strong>${safeName}</strong> played ${soundId.toUpperCase()}</span>`;
      container.appendChild(pill);
      setTimeout(() => {
        pill.classList.add('fade-out');
        setTimeout(() => pill.remove(), 400);
      }, 2500);
    }
  }

  triggerReaction(reactionType = 'star', fromSelf = false) {
    if (!this.ctx || !this.canvas) return;

    this.playSound('pop');

    // Normalize input (in case legacy emoji string was passed)
    const type = VECTOR_PATHS[reactionType] ? reactionType : 'star';

    // Spawn 8-12 floating vector particles
    const count = fromSelf ? 8 : 6;
    const startX = this.canvas.width / 2 + (Math.random() - 0.5) * (this.canvas.width * 0.4);
    const startY = this.canvas.height - 40;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        type,
        x: startX + (Math.random() - 0.5) * 60,
        y: startY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -(4 + Math.random() * 5),
        scale: 0.8 + Math.random() * 0.8,
        alpha: 1,
        rotation: (Math.random() - 0.5) * 0.4,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        gravity: -0.05
      });
    }
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.y < -50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.scale(p.scale, p.scale);
      this.ctx.translate(-12, -12); // Center 24x24 vector path

      const col = VECTOR_COLORS[p.type] || '#f59e0b';
      this.ctx.fillStyle = col;
      this.ctx.shadowColor = col;
      this.ctx.shadowBlur = 8;
      this.ctx.fill(VECTOR_PATHS[p.type] || VECTOR_PATHS.star);
      this.ctx.restore();
    }
  }
}

window.reactionEngine = new ReactionEngine();
