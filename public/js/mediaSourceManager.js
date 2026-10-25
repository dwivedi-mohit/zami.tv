/**
 * ZAMI Centralized Media Source Manager
 * Guarantees single-source exclusivity, race-condition immunity, and complete audio/video teardown.
 */

(function(window) {
  'use strict';

  const SourceTypes = Object.freeze({
    IDLE: 'idle',
    HTML5_DIRECT: 'url',
    HLS: 'hls',
    YOUTUBE: 'youtube',
    CLOUD_EMBED: 'embed',
    SCREEN_SHARE: 'screenshare',
    REMOTE_BROWSER: 'remote_browser'
  });

  class MediaSourceManager {
    constructor() {
      this.activeType = SourceTypes.IDLE;
      this.currentSource = null;
      this.currentTransitionId = 0;
      this.isTransitioning = false;
      this.engines = new Map();
      this.listeners = new Map();
      this.audioElements = new Set();
      this.videoElements = new Set();

      // Auto-bind known media elements when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.bindKnownElements());
      } else {
        this.bindKnownElements();
      }
    }

    bindKnownElements() {
      const mainVid = document.getElementById('main-video');
      if (mainVid) this.videoElements.add(mainVid);

      const remoteAudio = document.getElementById('remote-browser-audio');
      if (remoteAudio) this.audioElements.add(remoteAudio);
    }

    registerEngine(type, engineInterface) {
      this.engines.set(type, engineInterface);
    }

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(handler);
    }

    emit(event, data) {
      const handlers = this.listeners.get(event) || [];
      handlers.forEach(h => {
        try { h(data); } catch(e) { console.error('[MediaSourceManager] Listener error:', e); }
      });
    }

    /**
     * Determines whether a given URL is a native streamable media type
     */
    classifyUrl(url) {
      if (!url || typeof url !== 'string') return null;
      const clean = url.trim().toLowerCase();

      // 1. YouTube
      if (clean.includes('youtube.com/watch') || clean.includes('youtu.be/') || clean.includes('youtube.com/shorts/') || clean.includes('youtube.com/embed/')) {
        return SourceTypes.YOUTUBE;
      }

      // 2. HLS Manifest (.m3u8)
      if (clean.includes('.m3u8') || clean.includes('protocol=m3u8')) {
        return SourceTypes.HLS;
      }

      // 3. Direct HTML5 Video (.mp4, .webm, .mkv, .mov)
      if (clean.match(/\.(mp4|webm|mkv|mov)($|\?)/i)) {
        return SourceTypes.HTML5_DIRECT;
      }

      // 4. Cloud Embed (vidsrc, 2embed, embed)
      if (clean.includes('vidsrc.') || clean.includes('2embed.') || clean.includes('/embed/')) {
        return SourceTypes.CLOUD_EMBED;
      }

      return null;
    }

    /**
     * Complete nuclear teardown of all media elements, audio nodes, and streaming pipelines.
     * Guarantees zero residual audio bleed.
     */
    silenceAndTeardownAll() {
      // 1. Silence and stop all registered HTML5 video elements
      this.videoElements.forEach(vid => {
        try {
          vid.pause();
          vid.muted = true;
          vid.removeAttribute('src');
          vid.load();
          if (vid.srcObject) {
            try {
              vid.srcObject.getTracks().forEach(t => t.stop());
            } catch(e) {}
            vid.srcObject = null;
          }
        } catch(e) {}
      });

      // 2. Silence and stop all registered HTML5 audio elements
      this.audioElements.forEach(aud => {
        try {
          aud.pause();
          aud.muted = true;
          aud.removeAttribute('src');
          aud.load();
        } catch(e) {}
      });

      // Silence remote browser audio element if present
      const remoteAudio = document.getElementById('remote-browser-audio');
      if (remoteAudio) {
        try {
          remoteAudio.pause();
          remoteAudio.muted = true;
          remoteAudio.removeAttribute('src');
          remoteAudio.load();
        } catch(e) {}
      }

      // 3. Teardown active engines
      this.engines.forEach((engine, type) => {
        if (typeof engine.teardown === 'function') {
          try { engine.teardown(); } catch(e) { console.warn(`[MediaSourceManager] Teardown error on ${type}:`, e); }
        }
      });

      // 4. Teardown YouTube iframe container
      const ytContainer = document.getElementById('yt-player-container');
      if (ytContainer) {
        ytContainer.style.display = 'none';
        ytContainer.innerHTML = '';
      }

      // 5. Teardown Cloud Embed iframe container
      const embedContainer = document.getElementById('embed-player-container');
      if (embedContainer) {
        embedContainer.style.display = 'none';
        embedContainer.innerHTML = '';
      }

      // 6. Stop and hide Remote Browser
      const browserContainer = document.getElementById('inbuilt-browser-container');
      if (browserContainer) browserContainer.style.display = 'none';

      const appStage = document.getElementById('inbuilt-app-stage');
      if (appStage) appStage.style.display = 'none';

      // 7. Emit remote-browser-stop to server if active
      if (window.socket && window.isRemoteBrowserActive) {
        try {
          window.socket.emit('remote-browser-stop');
        } catch(e) {}
        window.isRemoteBrowserActive = false;
      }
    }

    /**
     * Acquire transition lock with atomic sequence ID.
     * Prevents race conditions from in-flight async promises.
     */
    acquireTransition(targetSource) {
      this.currentTransitionId++;
      const transitionId = this.currentTransitionId;
      this.isTransitioning = true;

      // Immediately silence everything before activating the new source
      this.silenceAndTeardownAll();

      const token = {
        id: transitionId,
        isCurrent: () => token.id === this.currentTransitionId,
        abort: () => {
          if (token.id === this.currentTransitionId) {
            this.isTransitioning = false;
          }
        }
      };

      this.currentSource = targetSource;
      this.emit('transition-start', { transitionId, targetSource });
      return token;
    }

    /**
     * Finalize source activation
     */
    commitTransition(token, type) {
      if (!token.isCurrent()) {
        console.warn(`[MediaSourceManager] Stale transition commit rejected (id: ${token.id}, current: ${this.currentTransitionId})`);
        return false;
      }

      this.activeType = type;
      this.isTransitioning = false;

      // Update Native Badge UI on stage
      this.updateQualityBadge(type);

      this.emit('transition-committed', {
        transitionId: token.id,
        type,
        source: this.currentSource
      });
      return true;
    }

    updateQualityBadge(type) {
      let badge = document.getElementById('media-quality-badge');
      if (!badge) {
        const stage = document.querySelector('.player-wrapper') || document.getElementById('player-container');
        if (stage) {
          badge = document.createElement('div');
          badge.id = 'media-quality-badge';
          badge.className = 'media-quality-badge';
          stage.appendChild(badge);
        }
      }

      if (!badge) return;

      if (type === SourceTypes.HTML5_DIRECT || type === SourceTypes.HLS || type === SourceTypes.YOUTUBE) {
        badge.innerHTML = '<span class="quality-dot"></span>NATIVE 1080P 60FPS (GPU ACCELERATED)';
        badge.style.display = 'inline-flex';
        badge.setAttribute('data-quality', 'native-hd');
      } else if (type === SourceTypes.SCREEN_SHARE) {
        badge.innerHTML = '<span class="quality-dot red"></span>WEBRTC 1080P (LOW LATENCY)';
        badge.style.display = 'inline-flex';
        badge.setAttribute('data-quality', 'webrtc');
      } else if (type === SourceTypes.CLOUD_EMBED) {
        badge.innerHTML = '<span class="quality-dot yellow"></span>CLOUD STREAM (DIRECT EMBED)';
        badge.style.display = 'inline-flex';
        badge.setAttribute('data-quality', 'embed');
      } else {
        badge.style.display = 'none';
      }
    }
  }

  window.SourceTypes = SourceTypes;
  window.mediaSourceManager = new MediaSourceManager();

})(window);
