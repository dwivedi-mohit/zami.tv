/**
 * ZAMI Cinema Audio Engine — Web Audio API Volume Booster & Limiter
 * Provides clean gain amplification up to 300% (3.0x) with studio-grade
 * dynamic compressor limiting to prevent distortion and clipping on quiet streams,
 * movies, remote browsers, and participant microphones.
 */
(function() {
  class VolumeBooster {
    constructor() {
      this.audioCtx = null;
      this.attachedElements = new Map(); // HTMLMediaElement -> { sourceNode, gainNode, compressorNode }
      this.attachedStreams = new Map(); // MediaStream -> { sourceNode, gainNode, compressorNode }
      this.stageVolume = parseFloat(localStorage.getItem('zami_stage_volume') || '1.0');
      this.voiceVolume = parseFloat(localStorage.getItem('zami_voice_volume') || '1.0');

      // Auto-unlock AudioContext on first user gesture
      const unlock = () => {
        this.getAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }

    getAudioContext() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    isAttached(mediaEl) {
      return this.attachedElements.has(mediaEl);
    }

    attach(mediaEl) {
      if (!mediaEl || this.attachedElements.has(mediaEl)) return;
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const sourceNode = ctx.createMediaElementSource(mediaEl);
        const gainNode = ctx.createGain();
        const compressor = ctx.createDynamicsCompressor();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;

        // Studio-grade transparent limiter parameters
        compressor.threshold.setValueAtTime(-10, ctx.currentTime);
        compressor.knee.setValueAtTime(24, ctx.currentTime);
        compressor.ratio.setValueAtTime(14, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.2, ctx.currentTime);

        gainNode.gain.setValueAtTime(this.stageVolume || 1.0, ctx.currentTime);

        sourceNode.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(analyser);
        analyser.connect(ctx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.attachedElements.set(mediaEl, { sourceNode, gainNode, compressor, analyser, dataArray });
      } catch (err) {
        // Fallback gracefully for CORS-restricted cross-origin sources
        console.warn('[VolumeBooster] Web Audio attach fallback:', err.message);
      }
    }

    applyToElement(mediaEl, volume) {
      if (!mediaEl) return;
      const safeVol = Math.max(0, Math.min(3, volume));

      if (!this.attachedElements.has(mediaEl)) {
        this.attach(mediaEl);
      }

      const entry = this.attachedElements.get(mediaEl);
      if (entry && entry.gainNode) {
        const ctx = this.getAudioContext();
        if (ctx) {
          entry.gainNode.gain.setValueAtTime(safeVol, ctx.currentTime);
        }
        // Keep media element volume at 1 so Web Audio receives full signal
        mediaEl.volume = Math.min(1, Math.max(0, safeVol));
      } else {
        mediaEl.volume = Math.min(1, Math.max(0, safeVol));
      }

      if (safeVol > 0) {
        mediaEl.muted = false;
      }
    }

    setStageVolume(volume) {
      this.stageVolume = Math.max(0, Math.min(3, volume));
      localStorage.setItem('zami_stage_volume', this.stageVolume.toString());
    }

    setVoiceVolume(volume) {
      this.voiceVolume = Math.max(0, Math.min(3, volume));
      localStorage.setItem('zami_voice_volume', this.voiceVolume.toString());
    }

    getAudioEnergy(mediaEl) {
      if (!mediaEl) return 0;
      const entry = this.attachedElements.get(mediaEl);
      if (!entry || !entry.analyser || !entry.dataArray) return 0;
      try {
        entry.analyser.getByteFrequencyData(entry.dataArray);
        // Average low-frequency bass & mid bins (0 to 8)
        let sum = 0;
        const count = Math.min(8, entry.dataArray.length);
        for (let i = 0; i < count; i++) {
          sum += entry.dataArray[i];
        }
        return (sum / (count * 255.0)); // normalized 0.0 to 1.0
      } catch (e) {
        return 0;
      }
    }

    cycleBoost(currentVol) {
      if (currentVol < 0.95) return 1.0;
      if (currentVol < 1.45) return 1.5;
      if (currentVol < 1.95) return 2.0;
      if (currentVol < 2.95) return 3.0;
      return 1.0;
    }
  }

  window.volumeBooster = new VolumeBooster();
})();
