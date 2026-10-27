/**
 * Multi-Engine Unified Video Player
 * Supports HTML5 Video (MP4/WebM), HLS.js (.m3u8), Local Video Files, YouTube IFrame API, and WebRTC Screen Sharing.
 */

class UniversalPlayer {
  constructor() {
    this.videoEl = document.getElementById('main-video');
    this.ytContainer = document.getElementById('yt-player-container');
    this.placeholderEl = document.getElementById('player-placeholder');

    // Controls elements
    this.controlsEl = document.getElementById('custom-controls');
    this.playerWrapper = document.querySelector('.player-wrapper');
    this.btnPlay = document.getElementById('ctrl-play');
    this.btnBackward = document.getElementById('ctrl-back-10');
    this.btnForward = document.getElementById('ctrl-fwd-10');
    this.timeDisplay = document.getElementById('time-display');
    this.progressBar = document.getElementById('progress-bar-container');
    this.progressBuffered = document.getElementById('progress-buffered');
    this.progressFilled = document.getElementById('progress-filled');
    this.progressHoverTime = document.getElementById('progress-hover-time');
    this.btnVolume = document.getElementById('ctrl-volume');
    this.volumeSlider = document.getElementById('volume-slider');
    this.speedSelect = document.getElementById('speed-select');
    this.btnFullscreen = document.getElementById('ctrl-fullscreen');
    this.btnPiP = document.getElementById('ctrl-pip');
    this.btnSnapshot = document.getElementById('ctrl-snapshot');
    this.btnAmbilight = document.getElementById('ctrl-ambilight');
    this.btnLaser = document.getElementById('ctrl-laser-pointer');
    this.btnRecordClip = document.getElementById('ctrl-record-clip');
    this.btnQuickShelf = document.getElementById('ctrl-quick-shelf');
    this.btnStopRecord = document.getElementById('btn-stop-recording-clip');
    this.recordingHud = document.getElementById('stage-recording-hud');
    this.recordingCountdown = document.getElementById('recording-countdown');
    this.recordingProgressBar = document.getElementById('recording-progress-bar');
    this.btnReactionCannon = document.getElementById('ctrl-reaction-cannon');
    this.btnSubtitles = document.getElementById('ctrl-subtitles');
    this.subFlyout = document.getElementById('subtitle-flyout');
    this.subFileInput = document.getElementById('sub-file-input');
    this.btnSubMinus = document.getElementById('btn-sub-minus');
    this.btnSubPlus = document.getElementById('btn-sub-plus');
    this.btnSubReset = document.getElementById('btn-sub-reset');
    this.btnCloseSubFlyout = document.getElementById('btn-close-sub-flyout');
    this.subTranslateSelect = document.getElementById('sub-translate-lang');
    this.btnSubTranslate = document.getElementById('btn-sub-translate');

    this.btnAudioTracks = document.getElementById('ctrl-audio-tracks');
    this.audioTracksFlyout = document.getElementById('audio-tracks-flyout');
    this.audioTracksList = document.getElementById('audio-tracks-list');
    this.btnCloseAudioTracks = document.getElementById('btn-close-audio-tracks-flyout');
    this.gestureRipple = document.getElementById('video-gesture-ripple');

    this.subtitleOffset = 0;
    this.rawVttContent = '';

    // Stage Overlays (Instant response & Autoplay handling)
    this.spinnerEl = document.getElementById('player-loading-spinner');
    this.spinnerText = document.getElementById('cinema-spinner-text');
    this.unmuteBanner = document.getElementById('unmute-banner');
    this.bigPlayBtn = document.getElementById('player-big-play-btn');

    if (this.unmuteBanner) {
      this.unmuteBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unmute();
      });
    }

    if (this.bigPlayBtn) {
      this.bigPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.play();
      });
    }

    if (this.playerWrapper) {
      this.playerWrapper.addEventListener('click', () => {
        if (this.isMuted()) {
          this.unmute();
        }
      });
    }

    this.idleTimeout = null;
    this.isScrubbing = false;

    // Accessibility ARIA labels
    if (this.btnPlay) this.btnPlay.setAttribute('aria-label', 'Play or Pause');
    if (this.btnBackward) this.btnBackward.setAttribute('aria-label', 'Rewind 10 seconds');
    if (this.btnForward) this.btnForward.setAttribute('aria-label', 'Forward 10 seconds');
    if (this.btnVolume) this.btnVolume.setAttribute('aria-label', 'Mute or Unmute');
    if (this.volumeSlider) this.volumeSlider.setAttribute('aria-label', 'Volume');
    if (this.speedSelect) this.speedSelect.setAttribute('aria-label', 'Playback Speed');
    if (this.btnFullscreen) this.btnFullscreen.setAttribute('aria-label', 'Toggle Fullscreen');
    if (this.btnPiP) this.btnPiP.setAttribute('aria-label', 'Toggle Picture-in-Picture');

    this.activeType = 'empty'; // 'url' | 'hls' | 'local' | 'youtube' | 'screenshare' | 'empty'
    this.hls = null;
    this.ytPlayer = null;
    this.ytReady = false;
    this.currentSource = null;

    // Suppress local events when executing remote sync
    this.suppressEvents = false;
    this.remoteActionUntil = 0;

    // Event listeners map
    this.listeners = {
      play: [],
      pause: [],
      seek: [],
      ratechange: [],
      timeupdate: [],
      sourcechange: [],
      buffering: [],
      ended: []
    };

    this.initVideoElement();
    this.initControls();
    this.initKeyboardShortcuts();
    this.initIdleDetection();
    this.initVideoGestures();
    this.initSubtitleDragAndDrop();
    this.initPiP();
    this.initAmbilightEngine();
    this.initAudioEQ();
    this.initClipRecorder();
    this.loadYouTubeAPI();
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (event !== 'buffering' && (this.suppressEvents || Date.now() < this.remoteActionUntil)) return;
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }

  initVideoElement() {
    let bufferingTimer = null;
    const clearBuffering = () => {
      clearTimeout(bufferingTimer);
      this.hideSpinner();
      this.hideBigPlayOverlay();
      this.updatePlayButton(true);
    };

    this.videoEl.addEventListener('play', () => {
      this.hideBigPlayOverlay();
      this.updatePlayButton(true);
      // Free hardware decoder: pause background video while watching media
      const roomBgVideo = document.getElementById('room-bg-video');
      if (roomBgVideo && !roomBgVideo.paused) {
        roomBgVideo.pause();
      }
      if (this.ambilightEnabled && window.innerWidth > 900) {
        this.startAmbilightLoop();
      }
      if (this.activeType !== 'screenshare') {
        this.emit('play', { currentTime: this.getCurrentTime() });
      }
    });

    this.videoRetryCount = 0;
    this.maxVideoRetries = 3;

    this.videoEl.addEventListener('playing', () => {
      clearBuffering();
      this.videoRetryCount = 0;
      this.emit('buffering', { isBuffering: false, currentTime: this.getCurrentTime() });
    });
    this.videoEl.addEventListener('canplay', () => {
      clearBuffering();
      this.emit('buffering', { isBuffering: false, currentTime: this.getCurrentTime() });
    });
    this.videoEl.addEventListener('loadeddata', clearBuffering);

    this.videoEl.addEventListener('waiting', () => {
      this.emit('buffering', { isBuffering: true, currentTime: this.getCurrentTime() });
      if (!this.videoEl.paused) {
        clearTimeout(bufferingTimer);
        bufferingTimer = setTimeout(() => {
          if (!this.videoEl.paused && this.videoEl.readyState < 3) {
            this.showSpinner('BUFFERING...');
          }
        }, 400);
      }
    });

    this.videoEl.addEventListener('stalled', () => {
      this.emit('buffering', { isBuffering: true, currentTime: this.getCurrentTime() });
    });

    this.videoEl.addEventListener('error', () => {
      console.warn('[UniversalPlayer] HTML5 video element error encountered');
      if (this.activeType === 'screenshare' || !this.currentSource) return;

      if (this.videoRetryCount < this.maxVideoRetries) {
        this.videoRetryCount++;
        const resumeTime = this.getCurrentTime();
        this.showSpinner(`RECONNECTING STREAM (ATTEMPT ${this.videoRetryCount}/${this.maxVideoRetries})...`);
        setTimeout(() => {
          if (this.currentSource && this.videoEl) {
            this.videoEl.load();
            if (resumeTime > 0) {
              this.seek(resumeTime, true);
            }
            this.play();
          }
        }, 1200 * this.videoRetryCount);
      } else {
        if (this.currentSource.streams && this.currentSource.streams.length > 1) {
          const nextStream = this.currentSource.streams.find(s => s !== this.currentSource.url);
          if (nextStream) {
            this.videoRetryCount = 0;
            this.currentSource.url = nextStream;
            this.loadSource(this.currentSource);
            return;
          }
        }
        this.hideSpinner();
        this.showPlaybackError('The requested video stream could not be loaded or was interrupted.');
        if (window.showToast) {
          window.showToast('Unable to play media. Retrying or switch sources.', 'error', 4000);
        }
      }
    });

    this.videoEl.addEventListener('loadstart', () => {
      this.showSpinner('CONNECTING REEL...');
    });

    this.videoEl.addEventListener('pause', () => {
      clearTimeout(bufferingTimer);
      this.updatePlayButton(false);
      this.stopAmbilightLoop();
      const roomBgVideo = document.getElementById('room-bg-video');
      if (roomBgVideo && roomBgVideo.paused && window.innerWidth > 900 && !document.hidden) {
        roomBgVideo.play().catch(() => {});
      }
      if (this.activeType !== 'screenshare') {
        if (!this.videoEl.seeking && this.getCurrentTime() > 0.5) {
          this.showBigPlayOverlay();
        }
        this.emit('pause', { currentTime: this.getCurrentTime() });
      }
    });

    this.videoEl.addEventListener('seeking', () => {
      if (this.activeType !== 'screenshare') {
        this.emit('seek', { currentTime: this.getCurrentTime() });
      }
    });

    this.videoEl.addEventListener('ratechange', () => {
      if (this.activeType !== 'screenshare') {
        this.emit('ratechange', { playbackRate: this.videoEl.playbackRate });
      }
    });

    this.videoEl.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    this.videoEl.addEventListener('ended', () => {
      this.stopAmbilightLoop();
      if (this.activeType !== 'screenshare') {
        this.updatePlayButton(false);
        this.emit('ended');
      }
    });

    this.videoEl.addEventListener('loadedmetadata', () => {
      this.hideSpinner();
      this.updateProgress();
    });
  }

  showSpinner(text = 'CONNECTING REEL...') {
    if (this.spinnerText) this.spinnerText.textContent = text;
    if (this.spinnerEl) this.spinnerEl.style.display = 'flex';
    this.hideBigPlayOverlay();
  }

  hideSpinner() {
    if (this.spinnerEl) this.spinnerEl.style.display = 'none';
  }

  showUnmuteBanner() {
    if (window.isRemoteBrowserActive || this.activeType === 'screenshare') return;
    if (this.unmuteBanner) this.unmuteBanner.style.display = 'flex';
  }

  hideUnmuteBanner() {
    if (this.unmuteBanner) this.unmuteBanner.style.display = 'none';
  }

  showBigPlayOverlay() {
    if (this.bigPlayBtn) this.bigPlayBtn.style.display = 'none';
  }

  hideBigPlayOverlay() {
    if (this.bigPlayBtn) this.bigPlayBtn.style.display = 'none';
  }

  showPlaybackError(message) {
    this.hideSpinner();
    const errorState = document.getElementById('player-error-state');
    const errorMsg = document.getElementById('player-error-message');
    if (errorState) {
      if (errorMsg && message) errorMsg.textContent = message;
      errorState.style.display = 'flex';
    }
    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
  }

  clearPlaybackError() {
    const errorState = document.getElementById('player-error-state');
    if (errorState) {
      errorState.style.display = 'none';
    }
  }

  resetToEmptyState() {
    this.clearPlaybackError();
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.load();
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.ytContainer) this.ytContainer.style.display = 'none';
    this.activeType = 'empty';
    this.currentSource = null;
    if (this.placeholderEl) {
      this.placeholderEl.style.removeProperty('display');
      this.placeholderEl.style.display = 'flex';
      this.placeholderEl.classList.remove('hidden');
    }
    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) {
      roomContainer.classList.remove('is-playing', 'has-media');
    }
    const titleEl = document.getElementById('current-media-title');
    if (titleEl) titleEl.textContent = 'Screening Stage Ready';
    this.hideSpinner();
  }

  isMuted() {
    if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.isMuted === 'function') {
      return this.ytPlayer.isMuted() || (this.ytPlayer.getVolume && this.ytPlayer.getVolume() === 0);
    }
    return !this.videoEl || this.videoEl.muted || this.videoEl.volume === 0;
  }

  updateVolumeIcon() {
    if (!this.btnVolume) return;
    const muted = this.isMuted();
    if (muted) {
      this.btnVolume.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      `;
      this.btnVolume.title = 'Unmute (M)';
      this.btnVolume.classList.add('muted');
    } else {
      this.btnVolume.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      `;
      this.btnVolume.title = 'Mute (M)';
      this.btnVolume.classList.remove('muted');
    }
  }

  unmute() {
    if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
      this.ytPlayer.unMute();
      if (typeof this.ytPlayer.setVolume === 'function') {
        const v = (this.lastVolume && this.lastVolume > 0) ? this.lastVolume : 1.0;
        this.ytPlayer.setVolume(v * 100);
      }
      this.hideUnmuteBanner();
      this.updateVolumeIcon();
      return;
    }
    if (this.videoEl) {
      this.videoEl.muted = false;
      const targetVol = (this.lastVolume && this.lastVolume > 0) ? this.lastVolume : 1.0;
      this.videoEl.volume = targetVol;
      this.hideUnmuteBanner();
      if (this.volumeSlider) {
        this.volumeSlider.value = targetVol;
      }
      this.updateVolumeIcon();
      if (window.showToast) {
        window.showToast('Audio unmuted', 'info', 2000);
      }
    }
  }

  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      this.ytReady = true;
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.ytReady = true;
    };
  }

  // Format seconds to HH:MM:SS or MM:SS
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => (n < 10 ? '0' + n : n);
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  initControls() {
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => this.togglePlay());
    }

    if (this.btnBackward) {
      this.btnBackward.addEventListener('click', () => {
        this.seek(Math.max(0, this.getCurrentTime() - 10));
      });
    }

    if (this.btnForward) {
      this.btnForward.addEventListener('click', () => {
        this.seek(Math.min(this.getDuration(), this.getCurrentTime() + 10));
      });
    }

    // Scrubber click & smooth drag using Pointer Events
    if (this.progressBar) {
      const updateScrubPos = (clientX) => {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const duration = this.getDuration();
        if (duration > 0) {
          this.seek(pos * duration);
        }
      };

      this.progressBar.addEventListener('pointerdown', (e) => {
        this.isScrubbing = true;
        this.progressBar.classList.add('scrubbing');
        try { this.progressBar.setPointerCapture(e.pointerId); } catch(err) {}
        updateScrubPos(e.clientX);
      });

      this.progressBar.addEventListener('pointermove', (e) => {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const duration = this.getDuration();
        if (duration > 0 && this.progressHoverTime) {
          const hoverSeconds = pos * duration;
          this.progressHoverTime.style.display = 'block';
          this.progressHoverTime.style.left = `${pos * 100}%`;
          this.progressHoverTime.textContent = this.formatTime(hoverSeconds);
        }
        if (this.isScrubbing) {
          updateScrubPos(e.clientX);
        }
      });

      this.progressBar.addEventListener('pointerup', (e) => {
        if (this.isScrubbing) {
          updateScrubPos(e.clientX);
          this.isScrubbing = false;
          this.progressBar.classList.remove('scrubbing');
          try { this.progressBar.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      });

      this.progressBar.addEventListener('pointercancel', () => {
        this.isScrubbing = false;
        this.progressBar.classList.remove('scrubbing');
      });

      this.progressBar.addEventListener('mouseleave', () => {
        if (!this.isScrubbing && this.progressHoverTime) {
          this.progressHoverTime.style.display = 'none';
        }
      });
    }

    // Volume
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        this.setVolume(parseFloat(e.target.value));
      });
    }

    if (this.btnVolume) {
      this.btnVolume.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMute();
      });
    }

    // Volume Booster Quick Toggle Button
    this.btnVolumeBoost = document.getElementById('btn-volume-boost');
    if (this.btnVolumeBoost) {
      this.btnVolumeBoost.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = this.getVolume();
        const next = window.volumeBooster ? window.volumeBooster.cycleBoost(cur) : (cur >= 2.9 ? 1.0 : cur + 0.5);
        this.setVolume(next);
        const pct = Math.round(next * 100);
        if (window.showToast) {
          window.showToast(pct > 100 ? `Volume Boosted: ${pct}%` : `Volume: ${pct}% (Normal)`, 'info', 1500);
        }
      });
    }

    // Speed
    if (this.speedSelect) {
      this.speedSelect.addEventListener('change', (e) => {
        const rate = parseFloat(e.target.value);
        this.setPlaybackRate(rate);
      });
    }

    // Fullscreen
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // Picture-in-Picture (PiP)
    if (this.btnPiP) {
      this.btnPiP.addEventListener('click', () => {
        this.togglePiP();
      });
    }

    // Stage Snapshot (S)
    if (this.btnSnapshot) {
      this.btnSnapshot.addEventListener('click', () => {
        this.takeStageSnapshot();
      });
    }

    // Dynamic Living Ambilight (Feature 1)
    if (this.btnAmbilight) {
      this.btnAmbilight.addEventListener('click', () => {
        this.cycleAmbilightMode();
      });
    }

    // Synchronized Laser Pointer & Telestrator (Feature 2)
    if (this.btnLaser) {
      this.btnLaser.addEventListener('click', () => {
        if (window.toggleLaserPointer) {
          window.toggleLaserPointer();
        }
      });
    }

    // 15s Instant Party Clip Recorder (Feature 4)
    if (this.btnRecordClip) {
      this.btnRecordClip.addEventListener('click', () => {
        this.togglePartyClipRecording();
      });
    }

    if (this.btnStopRecord) {
      this.btnStopRecord.addEventListener('click', () => {
        this.stopPartyClipRecording();
      });
    }

    // In-Room Trending Cinema Quick Shelf Drawer (Feature 5)
    if (this.btnQuickShelf) {
      this.btnQuickShelf.addEventListener('click', () => {
        if (window.toggleQuickShelf) {
          window.toggleQuickShelf();
        }
      });
    }

    // Reaction Cannon (E)
    if (this.btnReactionCannon) {
      this.btnReactionCannon.addEventListener('click', () => {
        if (window.triggerReactionCannon) {
          window.triggerReactionCannon();
        }
      });
    }

    // Subtitle Flyout & Controls
    if (this.btnSubtitles && this.subFlyout) {
      this.btnSubtitles.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = !this.subFlyout.style.display || this.subFlyout.style.display === 'none' || window.getComputedStyle(this.subFlyout).display === 'none';
        this.subFlyout.style.display = isHidden ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!this.subFlyout.contains(e.target) && e.target !== this.btnSubtitles) {
          this.subFlyout.style.display = 'none';
        }
      });
    }

    if (this.btnCloseSubFlyout && this.subFlyout) {
      this.btnCloseSubFlyout.addEventListener('click', () => {
        this.subFlyout.style.display = 'none';
      });
    }

    if (this.subFileInput) {
      this.subFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.loadSubtitleFile(e.target.files[0]);
          if (this.subFlyout) this.subFlyout.style.display = 'none';
        }
      });
    }

    if (this.btnSubMinus) {
      this.btnSubMinus.addEventListener('click', () => this.adjustSubtitleOffset(-0.5));
    }
    if (this.btnSubPlus) {
      this.btnSubPlus.addEventListener('click', () => this.adjustSubtitleOffset(0.5));
    }
    if (this.btnSubReset) {
      this.btnSubReset.addEventListener('click', () => this.resetSubtitleOffset());
    }

    // Subtitle Translation Trigger
    if (this.btnSubTranslate) {
      this.btnSubTranslate.addEventListener('click', () => {
        const targetLang = (this.subTranslateSelect && this.subTranslateSelect.value) || 'es';
        this.translateActiveSubtitles(targetLang);
      });
    }

    // Audio Tracks & Dubs Flyout & Controls
    if (this.btnAudioTracks && this.audioTracksFlyout) {
      this.btnAudioTracks.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = !this.audioTracksFlyout.style.display || this.audioTracksFlyout.style.display === 'none' || window.getComputedStyle(this.audioTracksFlyout).display === 'none';
        this.audioTracksFlyout.style.display = isHidden ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!this.audioTracksFlyout.contains(e.target) && e.target !== this.btnAudioTracks) {
          this.audioTracksFlyout.style.display = 'none';
        }
      });
    }

    if (this.btnCloseAudioTracks && this.audioTracksFlyout) {
      this.btnCloseAudioTracks.addEventListener('click', () => {
        this.audioTracksFlyout.style.display = 'none';
      });
    }

    // Playback Error State Actions
    const btnRetry = document.getElementById('btn-player-error-retry');
    const btnBrowse = document.getElementById('btn-player-error-browse');
    const btnReset = document.getElementById('btn-player-error-reset');

    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.clearPlaybackError();
        if (this.currentSource) {
          this.videoRetryCount = 0;
          this.loadSource(this.currentSource);
        } else {
          this.resetToEmptyState();
        }
      });
    }

    if (btnBrowse) {
      btnBrowse.addEventListener('click', () => {
        this.clearPlaybackError();
        const mediaModal = document.getElementById('media-modal');
        if (mediaModal) {
          mediaModal.classList.add('active');
          mediaModal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('movies');
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.clearPlaybackError();
        this.resetToEmptyState();
      });
    }
  }

  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't intercept when user is typing in interactive element, button, dialog, or remote browser
      const target = e.target;
      if (target) {
        const el = target instanceof Element ? target : target.parentElement;
        if (el) {
          if (el.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]')) return;
          if (el.closest('dialog[open], [role="dialog"], .modal-overlay:not([style*="display: none"]), .wallpaper-modal-overlay:not([style*="display: none"]), .w2g-search-drawer:not([style*="display: none"])')) return;
          if (el.id === 'remote-browser-canvas' || (el.closest && el.closest('#remote-browser-canvas'))) return;
        }
      }
      if (document.querySelector('dialog[open], .modal-overlay:not([style*="display: none"]), .wallpaper-modal-overlay:not([style*="display: none"]), .w2g-search-drawer:not([style*="display: none"])')) return;

      if (this.activeType === 'screenshare') {
        if (e.code === 'KeyF') {
          e.preventDefault();
          this.toggleFullscreen();
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          this.toggleMute();
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          this.togglePiP();
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seek(Math.max(0, this.getCurrentTime() - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seek(Math.min(this.getDuration(), this.getCurrentTime() + 5));
          break;
        case 'KeyM':
          if (this.btnVolume) this.btnVolume.click();
          break;
        case 'KeyF':
          this.toggleFullscreen();
          break;
        case 'KeyP':
          e.preventDefault();
          this.togglePiP();
          break;
        case 'KeyB':
          e.preventDefault();
          this.cycleAmbilightMode();
          break;
        case 'KeyL':
          e.preventDefault();
          if (window.toggleLaserPointer) {
            window.toggleLaserPointer();
          }
          break;
        case 'KeyR':
          e.preventDefault();
          this.togglePartyClipRecording();
          break;
      }
    });
  }

  updatePlayButton(isPlaying) {
    if (!this.btnPlay) return;
    if (isPlaying) {
      this.btnPlay.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>`;
    } else {
      this.btnPlay.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`;
    }
  }

  updateProgress() {
    if (this.activeType === 'screenshare') {
      if (this.timeDisplay) {
        this.timeDisplay.innerHTML = '<span style="color: #ef4444; font-weight: 700; letter-spacing: 0.5px;">● LIVE</span>';
      }
      if (this.progressFilled) {
        this.progressFilled.style.width = '100%';
      }
      return;
    }

    const cur = this.getCurrentTime();
    const dur = this.getDuration();

    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
    }

    if (this.progressFilled && dur > 0) {
      const pct = (cur / dur) * 100;
      this.progressFilled.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    // Buffered range visualization
    if (this.progressBuffered && dur > 0 && this.videoEl.buffered && this.videoEl.buffered.length > 0) {
      try {
        const bufferedEnd = this.videoEl.buffered.end(this.videoEl.buffered.length - 1);
        const bufPct = Math.min(100, Math.max(0, (bufferedEnd / dur) * 100));
        this.progressBuffered.style.width = `${bufPct}%`;
      } catch (e) {}
    }
  }

  initIdleDetection() {
    if (!this.playerWrapper) return;

    const resetIdle = () => {
      this.playerWrapper.classList.remove('idle');
      clearTimeout(this.idleTimeout);

      if (!this.isPaused() && this.activeType !== 'empty') {
        this.idleTimeout = setTimeout(() => {
          if (!this.isPaused()) {
            this.playerWrapper.classList.add('idle');
          }
        }, 3000);
      }
    };

    this.playerWrapper.addEventListener('mousemove', resetIdle);
    this.playerWrapper.addEventListener('pointerdown', resetIdle);
    this.playerWrapper.addEventListener('touchstart', resetIdle);
    document.addEventListener('keydown', resetIdle);
  }

  initVideoGestures() {
    let clickTimer = null;

    this.videoEl.addEventListener('click', (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        this.toggleFullscreen();
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (this.activeType === 'screenshare') return;
          this.togglePlay();
          this.showGestureRipple(!this.isPaused());
        }, 260);
      }
    });
  }

  showGestureRipple(isPlaying) {
    if (!this.gestureRipple) return;
    this.gestureRipple.innerHTML = isPlaying
      ? `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      : `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    this.gestureRipple.classList.remove('animate');
    void this.gestureRipple.offsetWidth;
    this.gestureRipple.classList.add('animate');
  }

  async takeStageSnapshot() {
    try {
      // 1. Trigger camera flash effect
      const flashEl = document.getElementById('stage-camera-flash');
      if (flashEl) {
        flashEl.style.display = 'block';
        flashEl.classList.remove('flash-active');
        void flashEl.offsetWidth; // force reflow
        flashEl.classList.add('flash-active');
        setTimeout(() => {
          flashEl.style.display = 'none';
          flashEl.classList.remove('flash-active');
        }, 500);
      }

      // 2. Synthesize camera shutter sound via ReactionEngine
      if (window.reactionEngine) {
        window.reactionEngine.playSound('pop');
      }

      // 3. Create high-definition scratch canvas (1920x1080)
      const width = 1920;
      const height = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Default dark cinematic background
      ctx.fillStyle = '#0a0b0d';
      ctx.fillRect(0, 0, width, height);

      // 4. Capture active stage media frame
      let frameCaptured = false;
      const remoteCanvas = document.getElementById('remote-browser-canvas');
      const remoteContainer = document.getElementById('remote-browser-container');
      const isRemoteActive = remoteContainer && window.getComputedStyle(remoteContainer).display !== 'none';

      if (isRemoteActive && remoteCanvas && remoteCanvas.width > 0 && remoteCanvas.height > 0) {
        ctx.drawImage(remoteCanvas, 0, 0, width, height);
        frameCaptured = true;
      } else if (this.videoEl && this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0) {
        try {
          ctx.drawImage(this.videoEl, 0, 0, width, height);
          frameCaptured = true;
        } catch (e) {
          console.warn('[SNAPSHOT] Canvas drawImage security notice:', e);
        }
      }

      // If frame couldn't be captured directly, draw cinema background card
      if (!frameCaptured) {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.5, '#1e1b4b');
        bgGrad.addColorStop(1, '#090d16');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.fillStyle = '#e5a93c';
        ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ZAMI CINEMA SCREENING', width / 2, height / 2 - 20);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px "Plus Jakarta Sans", sans-serif';
        const titleText = this.currentSource && this.currentSource.title ? this.currentSource.title : 'Live Screening Room';
        ctx.fillText(titleText, width / 2, height / 2 + 35);
        ctx.restore();
      }

      // 5. Composite Room Watermark Badge Pill in bottom-left
      const currentRoomId = (window.location.pathname.split('/').pop() || 'zami-room').toUpperCase();
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      // Badge Card geometry
      const padX = 40;
      const padY = height - 130;
      const cardW = 560;
      const cardH = 90;

      ctx.save();
      // Frosted Glass Card
      ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
      ctx.strokeStyle = 'rgba(229, 169, 60, 0.45)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 24;

      // Rounded rectangle
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(padX, padY, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(padX, padY, cardW, cardH);
        ctx.strokeRect(padX, padY, cardW, cardH);
      }
      ctx.shadowBlur = 0;

      // Top badge label: ZAMI SCREENING PARTY // 1080P SOUVENIR
      ctx.fillStyle = '#e5a93c';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText('ZAMI SCREENING PARTY // 1080P SOUVENIR', padX + 24, padY + 32);

      // Room name & timestamp
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`ROOM: ${currentRoomId}`, padX + 24, padY + 66);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${dateStr} • ${timeStr}`, padX + cardW - 200, padY + 66);

      // Viewers avatar circles inside badge
      const peerTiles = document.querySelectorAll('.peer-tile');
      let avatarOffset = padX + cardW - 32;
      peerTiles.forEach((tile, i) => {
        if (i < 4) {
          const avatar = tile.querySelector('.peer-avatar');
          const char = avatar ? avatar.textContent.trim().slice(0, 1) : '?';
          const col = avatar ? avatar.style.backgroundColor || '#6366f1' : '#6366f1';

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(avatarOffset - (i * 32), padY + 28, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(char, avatarOffset - (i * 32), padY + 28);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        }
      });

      ctx.restore();

      // 6. Download as 1080p PNG file
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        const filename = `ZAMI_Snapshot_${currentRoomId.toLowerCase()}_${Date.now()}.png`;
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 100);

        if (window.showToast) {
          window.showToast('Stage snapshot saved! (1080p Souvenir Card)', 'success', 3500);
        }
      }, 'image/png');
    } catch (err) {
      console.error('[SNAPSHOT] Failed to capture stage snapshot:', err);
      if (window.showToast) {
        window.showToast('Could not save snapshot frame', 'error');
      }
    }
  }

  /* ==========================================================================
     FEATURE 1: Dynamic Cinema Ambilight (Living Backlight & Room Projector)
     ========================================================================== */
  initAmbilightEngine() {
    this.ambilightGlowEl = document.getElementById('stage-ambilight-glow');
    this.ambilightScreenCanvas = document.getElementById('stage-ambilight-canvas');
    this.ambilightScreenCtx = this.ambilightScreenCanvas ? this.ambilightScreenCanvas.getContext('2d') : null;
    this.ambilightWallEl = document.getElementById('room-ambilight-wall');

    this.ambilightEnabled = localStorage.getItem('zami_ambilight_enabled') !== 'false';
    this.ambilightMode = localStorage.getItem('zami_ambilight_mode') || 'cinema'; // 'cinema' | 'soft' | 'pulse' | 'subtle'
    this.ambilightSpread = parseInt(localStorage.getItem('zami_ambilight_blur') || '75', 10);
    this.ambilightIntensity = parseInt(localStorage.getItem('zami_ambilight_intensity') || '100', 10);
    this.ambilightWallEnabled = localStorage.getItem('zami_ambilight_wall') !== 'false';

    this.ambilightLoopActive = false;
    this.ambilightRafId = null;
    this.lastAmbilightSample = 0;

    // Smoothed color state for organic transitions without harsh flickering
    this.curAmbilightColors = {
      top: [20, 20, 28],
      bottom: [20, 20, 28],
      left: [20, 20, 28],
      right: [20, 20, 28],
      center: [20, 20, 28]
    };

    // Offscreen downscaled canvas for ultra-fast GPU color sampling
    this.ambilightCanvas = document.createElement('canvas');
    this.ambilightCanvas.width = 32;
    this.ambilightCanvas.height = 18;
    this.ambilightCtx = this.ambilightCanvas.getContext('2d', { willReadFrequently: true });

    // Sync button state & tooltip
    this.updateAmbilightUI();

    // Wire settings modal controls
    const settingsToggle = document.getElementById('btn-toggle-settings-ambilight');
    if (settingsToggle) {
      settingsToggle.addEventListener('click', () => {
        this.toggleAmbilight();
      });
    }

    // Preset buttons in settings modal
    const presetBtns = document.querySelectorAll('.btn-ambilight-preset');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode) {
          this.setAmbilightMode(mode);
        }
      });
    });

    // Intensity slider
    const intensitySlider = document.getElementById('settings-ambilight-intensity');
    const intensityVal = document.getElementById('settings-ambilight-intensity-val');
    if (intensitySlider) {
      intensitySlider.value = this.ambilightIntensity;
      if (intensityVal) intensityVal.textContent = `${this.ambilightIntensity}%`;
      intensitySlider.addEventListener('input', (e) => {
        this.ambilightIntensity = parseInt(e.target.value, 10);
        localStorage.setItem('zami_ambilight_intensity', this.ambilightIntensity);
        if (intensityVal) intensityVal.textContent = `${this.ambilightIntensity}%`;
        this.applyAmbilightStyles();
      });
    }

    // Blur spread slider
    const blurSlider = document.getElementById('settings-ambilight-blur');
    const blurVal = document.getElementById('settings-ambilight-blur-val');
    if (blurSlider) {
      blurSlider.value = this.ambilightSpread;
      if (blurVal) blurVal.textContent = `${this.ambilightSpread}px`;
      blurSlider.addEventListener('input', (e) => {
        this.ambilightSpread = parseInt(e.target.value, 10);
        localStorage.setItem('zami_ambilight_blur', this.ambilightSpread);
        if (blurVal) blurVal.textContent = `${this.ambilightSpread}px`;
        this.applyAmbilightStyles();
      });
    }

    // Room wall light spill checkbox
    const wallCheck = document.getElementById('settings-ambilight-wall');
    if (wallCheck) {
      wallCheck.checked = this.ambilightWallEnabled;
      wallCheck.addEventListener('change', (e) => {
        this.ambilightWallEnabled = e.target.checked;
        localStorage.setItem('zami_ambilight_wall', this.ambilightWallEnabled);
        this.applyAmbilightStyles();
      });
    }

    // Glowing Snake Border checkbox
    const snakeCheck = document.getElementById('settings-snake-border');
    const snakeEl = document.getElementById('stage-snake-border');
    const snakeEnabled = localStorage.getItem('zami_snake_border') !== 'false';
    if (snakeCheck) {
      snakeCheck.checked = snakeEnabled;
      snakeCheck.addEventListener('change', (e) => {
        const val = e.target.checked;
        localStorage.setItem('zami_snake_border', val.toString());
        if (snakeEl) {
          snakeEl.style.display = val ? 'block' : 'none';
        }
      });
    }
    if (snakeEl) {
      snakeEl.style.display = snakeEnabled ? 'block' : 'none';
    }

    // Context menu / right click on player bar button opens Settings modal
    if (this.btnAmbilight) {
      this.btnAmbilight.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
          settingsModal.style.display = 'flex';
          const ambilightSection = settingsModal.querySelector('.settings-ambilight-section');
          if (ambilightSection) {
            ambilightSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }

    this.applyAmbilightStyles();
  }

  setAmbilightMode(mode) {
    this.ambilightMode = mode;
    localStorage.setItem('zami_ambilight_mode', mode);
    if (!this.ambilightEnabled) {
      this.toggleAmbilight(true);
    } else {
      this.applyAmbilightStyles();
      this.updateAmbilightUI();
      if (this.isPlaying()) {
        this.startAmbilightLoop();
      }
    }

    const modeLabels = {
      cinema: 'Cinema Vivid Glow',
      soft: 'Soft Ambient Glow',
      pulse: 'Audio-Reactive Cinema Pulse',
      subtle: 'Subtle Halo'
    };
    if (window.showToast) {
      window.showToast(`Ambilight: ${modeLabels[mode] || mode}`, 'info', 2000);
    }
  }

  cycleAmbilightMode() {
    if (!this.ambilightEnabled) {
      this.ambilightEnabled = true;
      this.ambilightMode = 'cinema';
      localStorage.setItem('zami_ambilight_enabled', 'true');
      localStorage.setItem('zami_ambilight_mode', 'cinema');
      this.updateAmbilightUI();
      this.applyAmbilightStyles();
      if (this.isPlaying()) this.startAmbilightLoop();
      if (window.showToast) window.showToast('Ambilight: Cinema Vivid Glow', 'info', 2000);
      return;
    }

    // Cycle sequence: cinema -> pulse -> soft -> subtle -> off
    const order = ['cinema', 'pulse', 'soft', 'subtle', 'off'];
    const currentIdx = order.indexOf(this.ambilightMode);
    const nextMode = order[(currentIdx + 1) % order.length];

    if (nextMode === 'off') {
      this.toggleAmbilight(false);
    } else {
      this.setAmbilightMode(nextMode);
    }
  }

  applyAmbilightStyles() {
    const root = document.documentElement;
    const intensityNorm = Math.max(0.2, Math.min(1.5, (this.ambilightIntensity || 100) / 100));
    const blur = this.ambilightSpread || 75;

    let sat = 2.4;
    let brightness = 1.15;
    let opacity = 0.88 * intensityNorm;
    let wallOpacity = this.ambilightWallEnabled ? (0.75 * intensityNorm) : 0;

    if (this.ambilightMode === 'soft') {
      sat = 1.5;
      brightness = 0.95;
      opacity = 0.65 * intensityNorm;
      wallOpacity = this.ambilightWallEnabled ? (0.45 * intensityNorm) : 0;
    } else if (this.ambilightMode === 'pulse') {
      sat = 2.5;
      brightness = 1.15;
      opacity = 0.9 * intensityNorm;
      wallOpacity = this.ambilightWallEnabled ? (0.78 * intensityNorm) : 0;
    } else if (this.ambilightMode === 'subtle') {
      sat = 1.2;
      brightness = 0.85;
      opacity = 0.45 * intensityNorm;
      wallOpacity = 0; // Subtle mode disables room wall spill
    }

    root.style.setProperty('--ambilight-blur', `${blur}px`);
    root.style.setProperty('--ambilight-sat', sat.toString());
    root.style.setProperty('--ambilight-brightness', brightness.toString());
    root.style.setProperty('--ambilight-opacity', opacity.toString());
    root.style.setProperty('--ambilight-wall-opacity', wallOpacity.toString());
  }

  updateAmbilightUI() {
    if (this.btnAmbilight) {
      this.btnAmbilight.classList.toggle('active', this.ambilightEnabled);
      const modeTitles = {
        cinema: 'Ambilight: Cinema Vivid (Click to Cycle / Right-Click Settings)',
        soft: 'Ambilight: Soft Ambient (Click to Cycle / Right-Click Settings)',
        pulse: 'Ambilight: Audio-Reactive Pulse (Click to Cycle / Right-Click Settings)',
        subtle: 'Ambilight: Subtle Halo (Click to Cycle / Right-Click Settings)'
      };
      this.btnAmbilight.title = this.ambilightEnabled
        ? (modeTitles[this.ambilightMode] || 'Dynamic Living Ambilight')
        : 'Dynamic Living Ambilight (Disabled - Click to Enable)';
    }

    const settingsToggle = document.getElementById('btn-toggle-settings-ambilight');
    const settingsStatus = document.getElementById('settings-ambilight-status-text');
    if (settingsToggle) {
      settingsToggle.classList.toggle('active', this.ambilightEnabled);
    }
    if (settingsStatus) {
      settingsStatus.textContent = this.ambilightEnabled ? 'Enabled' : 'Disabled';
    }

    const presetBtns = document.querySelectorAll('.btn-ambilight-preset');
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', this.ambilightEnabled && btn.dataset.mode === this.ambilightMode);
    });

    const wallCheck = document.getElementById('settings-ambilight-wall');
    if (wallCheck) {
      wallCheck.checked = this.ambilightWallEnabled;
    }
  }

  isPlaying() {
    if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
      return this.ytPlayer.getPlayerState() === 1;
    }
    const rCanvas = document.getElementById('remote-browser-canvas');
    const browserContainer = document.getElementById('inbuilt-browser-container');
    if (rCanvas && browserContainer && browserContainer.style.display !== 'none') {
      return true;
    }
    return this.videoEl ? (!this.videoEl.paused && !this.videoEl.ended) : false;
  }

  toggleAmbilight(force) {
    this.ambilightEnabled = force !== undefined ? Boolean(force) : !this.ambilightEnabled;
    localStorage.setItem('zami_ambilight_enabled', this.ambilightEnabled);

    this.updateAmbilightUI();
    this.applyAmbilightStyles();

    if (this.ambilightEnabled) {
      if (this.isPlaying()) {
        this.startAmbilightLoop();
      }
      if (window.showToast) {
        window.showToast('Dynamic Cinema Ambilight Enabled', 'info', 2000);
      }
    } else {
      this.stopAmbilightLoop();
      if (window.showToast) {
        window.showToast('Dynamic Ambilight Disabled', 'info', 2000);
      }
    }
  }

  startAmbilightLoop() {
    if (!this.ambilightEnabled || this.ambilightLoopActive || window.innerWidth <= 900) return;
    this.ambilightLoopActive = true;

    if (this.ambilightGlowEl) this.ambilightGlowEl.classList.add('active');
    if (this.ambilightScreenCanvas) this.ambilightScreenCanvas.classList.add('active');
    if (this.ambilightWallEl && this.ambilightWallEnabled && this.ambilightMode !== 'subtle') {
      this.ambilightWallEl.classList.add('active');
    }

    const loop = (timestamp) => {
      if (!this.ambilightLoopActive) return;
      if (timestamp - this.lastAmbilightSample >= 150) { // Smooth 6.6fps sampling with CSS interpolation
        this.lastAmbilightSample = timestamp;
        this.sampleAmbilightColor();
      }
      this.ambilightRafId = requestAnimationFrame(loop);
    };

    this.ambilightRafId = requestAnimationFrame(loop);
  }

  stopAmbilightLoop() {
    this.ambilightLoopActive = false;
    if (this.ambilightRafId) {
      cancelAnimationFrame(this.ambilightRafId);
      this.ambilightRafId = null;
    }
    if (this.ambilightGlowEl) {
      this.ambilightGlowEl.classList.remove('active');
      this.ambilightGlowEl.style.boxShadow = 'none';
    }
    if (this.ambilightScreenCanvas) {
      this.ambilightScreenCanvas.classList.remove('active');
    }
    if (this.ambilightWallEl) {
      this.ambilightWallEl.classList.remove('active');
    }
  }

  sampleAmbilightColor() {
    if (!this.ambilightGlowEl || !this.ambilightCtx) return;

    let sourceEl = null;
    if (this.videoEl && this.videoEl.videoWidth > 0 && this.videoEl.style.display !== 'none' && !this.videoEl.paused) {
      sourceEl = this.videoEl;
    } else {
      const rCanvas = document.getElementById('remote-browser-canvas');
      const browserContainer = document.getElementById('inbuilt-browser-container');
      if (rCanvas && rCanvas.width > 0 && browserContainer && browserContainer.style.display !== 'none') {
        sourceEl = rCanvas;
      }
    }

    let sourceReady = false;

    if (sourceEl) {
      // 1. Draw into on-screen blurred canvas projection (Layer 1)
      if (this.ambilightScreenCanvas && this.ambilightScreenCtx && this.ambilightMode !== 'subtle') {
        try {
          this.ambilightScreenCtx.drawImage(sourceEl, 0, 0, 64, 36);
          sourceReady = true;
        } catch (e) {}
      }

      // 2. Draw into off-screen canvas for pixel extraction (Layers 2 & 3)
      try {
        this.ambilightCtx.drawImage(sourceEl, 0, 0, 32, 18);
        sourceReady = true;
      } catch (e) {}
    }

    const spread = this.ambilightSpread || 75;

    // Audio-reactive modulation (when in 'pulse' mode)
    let audioEnergy = 0;
    if (this.ambilightMode === 'pulse' && window.volumeBooster) {
      audioEnergy = window.volumeBooster.getAudioEnergy(this.videoEl);
      if (this.ambilightScreenCanvas) {
        const pulseScale = 1.14 + (audioEnergy * 0.08);
        const pulseBright = 1.15 + (audioEnergy * 0.45);
        this.ambilightScreenCanvas.style.transform = `scale(${pulseScale.toFixed(3)}) translateZ(0)`;
        this.ambilightScreenCanvas.style.filter = `blur(${spread}px) saturate(2.6) brightness(${pulseBright.toFixed(2)})`;
      }
    }

    if (!sourceReady) {
      // Graceful fallback for cross-origin / idle
      this.ambilightGlowEl.style.boxShadow = `0 0 ${spread}px rgba(229, 169, 60, 0.35)`;
      return;
    }

    try {
      const imgData = this.ambilightCtx.getImageData(0, 0, 32, 18);
      const data = imgData.data;

      let rT = 0, gT = 0, bT = 0, cT = 0;
      let rB = 0, gB = 0, bB = 0, cB = 0;
      let rL = 0, gL = 0, bL = 0, cL = 0;
      let rR = 0, gR = 0, bR = 0, cR = 0;
      let rC = 0, gC = 0, bC = 0, cC = 0;

      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 32; x++) {
          const idx = (y * 32 + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];

          // Center sample
          if (x >= 8 && x <= 24 && y >= 4 && y <= 14) {
            rC += r; gC += g; bC += b; cC++;
          }
          // Perimeter edges
          if (y < 4) { rT += r; gT += g; bT += b; cT++; }
          if (y >= 14) { rB += r; gB += g; bB += b; cB++; }
          if (x < 6) { rL += r; gL += g; bL += b; cL++; }
          if (x >= 26) { rR += r; gR += g; bR += b; cR++; }
        }
      }

      rT = Math.round(rT / (cT || 1)); gT = Math.round(gT / (cT || 1)); bT = Math.round(bT / (cT || 1));
      rB = Math.round(rB / (cB || 1)); gB = Math.round(gB / (cB || 1)); bB = Math.round(bB / (cB || 1));
      rL = Math.round(rL / (cL || 1)); gL = Math.round(gL / (cL || 1)); bL = Math.round(bL / (cL || 1));
      rR = Math.round(rR / (cR || 1)); gR = Math.round(gR / (cR || 1)); bR = Math.round(bR / (cR || 1));
      rC = Math.round(rC / (cC || 1)); gC = Math.round(gC / (cC || 1)); bC = Math.round(bC / (cC || 1));

      // Luma clamp so pitch-black scenes still maintain subtle warm ambient atmosphere
      const maxLuma = Math.max(rT, gT, bT, rB, gB, bB, rL, gL, bL, rR, gR, bR);
      if (maxLuma < 12) {
        rT = 20; gT = 20; bT = 28;
        rB = 20; gB = 20; bB = 28;
        rL = 20; gL = 20; bL = 28;
        rR = 20; gR = 20; bR = 28;
        rC = 20; gC = 20; bC = 28;
      }

      // Smooth LERP interpolation (factor 0.2) to prevent flashing
      const factor = 0.2;
      const cur = this.curAmbilightColors;
      cur.top[0] += (rT - cur.top[0]) * factor; cur.top[1] += (gT - cur.top[1]) * factor; cur.top[2] += (bT - cur.top[2]) * factor;
      cur.bottom[0] += (rB - cur.bottom[0]) * factor; cur.bottom[1] += (gB - cur.bottom[1]) * factor; cur.bottom[2] += (bB - cur.bottom[2]) * factor;
      cur.left[0] += (rL - cur.left[0]) * factor; cur.left[1] += (gL - cur.left[1]) * factor; cur.left[2] += (bL - cur.left[2]) * factor;
      cur.right[0] += (rR - cur.right[0]) * factor; cur.right[1] += (gR - cur.right[1]) * factor; cur.right[2] += (bR - cur.right[2]) * factor;
      cur.center[0] += (rC - cur.center[0]) * factor; cur.center[1] += (gC - cur.center[1]) * factor; cur.center[2] += (bC - cur.center[2]) * factor;

      const cT_str = `${Math.round(cur.top[0])}, ${Math.round(cur.top[1])}, ${Math.round(cur.top[2])}`;
      const cB_str = `${Math.round(cur.bottom[0])}, ${Math.round(cur.bottom[1])}, ${Math.round(cur.bottom[2])}`;
      const cL_str = `${Math.round(cur.left[0])}, ${Math.round(cur.left[1])}, ${Math.round(cur.left[2])}`;
      const cR_str = `${Math.round(cur.right[0])}, ${Math.round(cur.right[1])}, ${Math.round(cur.right[2])}`;
      const cC_str = `${Math.round(cur.center[0])}, ${Math.round(cur.center[1])}, ${Math.round(cur.center[2])}`;

      // Update CSS custom properties for room wall projection (confined to wall element)
      if (this.ambilightWallEl && this.ambilightWallEnabled) {
        this.ambilightWallEl.style.setProperty('--ambilight-c-top', `rgba(${cT_str}, 0.28)`);
        this.ambilightWallEl.style.setProperty('--ambilight-c-bottom', `rgba(${cB_str}, 0.25)`);
        this.ambilightWallEl.style.setProperty('--ambilight-c-left', `rgba(${cL_str}, 0.25)`);
        this.ambilightWallEl.style.setProperty('--ambilight-c-right', `rgba(${cR_str}, 0.25)`);
        this.ambilightWallEl.style.setProperty('--ambilight-c-center', `rgba(${cC_str}, 0.22)`);
      }

      // Update multi-edge box shadow on stage glow
      const shadowAlpha = (0.85 + audioEnergy * 0.15).toFixed(2);
      const shadowStr = `0 -${Math.round(spread * 0.35)}px ${spread}px rgba(${cT_str}, ${shadowAlpha}), ` +
                        `${Math.round(spread * 0.35)}px 0 ${spread}px rgba(${cR_str}, ${shadowAlpha}), ` +
                        `0 ${Math.round(spread * 0.35)}px ${spread}px rgba(${cB_str}, ${shadowAlpha}), ` +
                        `-${Math.round(spread * 0.35)}px 0 ${spread}px rgba(${cL_str}, ${shadowAlpha})`;

      this.ambilightGlowEl.style.boxShadow = shadowStr;
    } catch (corsErr) {
      this.ambilightGlowEl.style.boxShadow = `0 0 ${spread}px rgba(229, 169, 60, 0.4)`;
    }
  }

  /* ==========================================================================
     FEATURE 3: Cinema Audio Equalizer & Presets (DSP)
     ========================================================================== */
  initAudioEQ() {
    this.currentAudioPreset = localStorage.getItem('zami_audio_preset') || 'flat';
    this.audioEQInitialized = true;
    this.eqGainMultiplier = 1.0;

    const select = document.getElementById('settings-audio-preset');
    if (select) {
      select.value = this.currentAudioPreset;
      select.addEventListener('change', (e) => {
        this.setAudioPreset(e.target.value);
      });
    }

    this.setAudioPreset(this.currentAudioPreset, false);
  }

  setAudioPreset(presetName, showToastNotification = true) {
    this.currentAudioPreset = presetName;
    localStorage.setItem('zami_audio_preset', presetName);

    const badge = document.getElementById('eq-active-preset-badge');
    const desc = document.getElementById('settings-audio-preset-desc');
    const select = document.getElementById('settings-audio-preset');

    if (select && select.value !== presetName) {
      select.value = presetName;
    }

    const descriptions = {
      flat: { label: 'Flat Monitor', text: 'Standard neutral studio frequency curve without colorization.', multiplier: 1.0 },
      vocal: { label: 'Vocal Clarity', text: 'Dialogue boosted (+5.5dB @ 2.5kHz) with sub-rumble cut for crystal clear speech.', multiplier: 1.15 },
      night: { label: 'Night Mode', text: 'Dynamic compression squashes sudden explosions while keeping quiet dialogue audible.', multiplier: 0.95 },
      bass: { label: 'Bass Punch', text: 'Sub-bass and kick boosted (+6dB @ 100Hz) for deep theater rumble.', multiplier: 1.10 }
    };

    const info = descriptions[presetName] || descriptions.flat;
    this.eqGainMultiplier = info.multiplier || 1.0;
    if (badge) badge.textContent = info.label;
    if (desc) desc.textContent = info.text;

    if (showToastNotification && window.showToast) {
      window.showToast(`Audio Equalizer: ${info.label}`, 'info', 2500);
    }
  }

  applyAudioPreset(preset) {
    this.setAudioPreset(preset, false);
  }

  /* ==========================================================================
     FEATURE 4: 15s Instant Party Clip Recorder (MediaRecorder)
     ========================================================================== */
  initClipRecorder() {
    this.isRecordingClip = false;
    this.clipRecorder = null;
    this.clipChunks = [];
    this.clipTimerInterval = null;
    this.clipTimeRemaining = 15;
  }

  togglePartyClipRecording() {
    if (this.isRecordingClip) {
      this.stopPartyClipRecording();
    } else {
      this.startPartyClipRecording();
    }
  }

  async startPartyClipRecording() {
    if (this.isRecordingClip) return;

    let stream = null;
    if (this.videoEl && typeof this.videoEl.captureStream === 'function') {
      try {
        stream = this.videoEl.captureStream();
      } catch (e) {
        console.warn('Video captureStream error:', e);
      }
    } else if (this.videoEl && typeof this.videoEl.mozCaptureStream === 'function') {
      try {
        stream = this.videoEl.mozCaptureStream();
      } catch (e) {}
    }

    if (!stream || stream.getVideoTracks().length === 0) {
      const rCanvas = document.getElementById('remote-browser-canvas');
      if (rCanvas && typeof rCanvas.captureStream === 'function') {
        try {
          stream = rCanvas.captureStream(30);
        } catch (e) {}
      }
    }

    if (!stream || (typeof MediaRecorder === 'undefined')) {
      if (window.showToast) {
        window.showToast('Media recording is not available for this stream source', 'warning', 3000);
      }
      return;
    }

    try {
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.clipChunks = [];
      this.clipRecorder = new MediaRecorder(stream, { mimeType });

      this.clipRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.clipChunks.push(e.data);
        }
      };

      this.clipRecorder.onstop = () => {
        this.finalizePartyClip();
      };

      this.clipRecorder.start(250);
      this.isRecordingClip = true;
      this.clipTimeRemaining = 15;

      if (this.btnRecordClip) this.btnRecordClip.classList.add('recording');
      if (this.recordingHud) this.recordingHud.style.display = 'block';
      if (this.recordingCountdown) this.recordingCountdown.textContent = '15s';
      if (this.recordingProgressBar) this.recordingProgressBar.style.width = '0%';

      clearInterval(this.clipTimerInterval);
      const startTime = Date.now();
      const totalDuration = 15000;

      this.clipTimerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((totalDuration - elapsed) / 1000));
        const progressPct = Math.min(100, (elapsed / totalDuration) * 100);

        if (this.recordingCountdown) {
          this.recordingCountdown.textContent = `${remaining}s`;
        }
        if (this.recordingProgressBar) {
          this.recordingProgressBar.style.width = `${progressPct}%`;
        }

        if (elapsed >= totalDuration) {
          clearInterval(this.clipTimerInterval);
          this.stopPartyClipRecording();
        }
      }, 100);

      if (window.showToast) {
        window.showToast('Recording 15s Party Clip...', 'info', 2500);
      }
    } catch (err) {
      console.error('[CLIP RECORDER] Failed to start MediaRecorder:', err);
      if (window.showToast) {
        window.showToast('Could not record party clip', 'error', 3000);
      }
    }
  }

  stopPartyClipRecording() {
    if (!this.isRecordingClip) return;
    clearInterval(this.clipTimerInterval);
    this.isRecordingClip = false;

    if (this.btnRecordClip) this.btnRecordClip.classList.remove('recording');
    if (this.recordingHud) this.recordingHud.style.display = 'none';

    if (this.clipRecorder && this.clipRecorder.state !== 'inactive') {
      try {
        this.clipRecorder.stop();
      } catch (e) {}
    }
  }

  finalizePartyClip() {
    if (!this.clipChunks || this.clipChunks.length === 0) {
      if (window.showToast) {
        window.showToast('Clip recording was empty or cancelled', 'warning', 2500);
      }
      return;
    }

    const blob = new Blob(this.clipChunks, { type: 'video/webm' });
    const currentRoomId = (window.location.pathname.split('/').pop() || 'zami').toLowerCase();
    const filename = `zami-clip-${currentRoomId}-${Date.now()}.webm`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    if (window.showToast) {
      window.showToast('Party Clip Saved! (15s WebM)', 'success', 4000);
    }
  }

  extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
    const match = cleanUrl.match(regExp);
    return match ? match[1] : null;
  }

  // Load a new media source
  loadSource(source) {
    this.clearPlaybackError();
    const token = window.mediaSourceManager ? window.mediaSourceManager.acquireTransition(source) : null;
    this.currentTransitionToken = token;
    this.currentSource = source;
    this.activeType = source.type;

    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) stageBackdrop.style.display = 'none';
    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) {
      roomContainer.classList.add('is-playing');
      roomContainer.classList.add('has-media');
    }
    if (this.controlsEl) this.controlsEl.style.display = 'flex';

    if (source.type === 'screenshare') {
      if (source.stream) {
        this.setupScreenShare(source.stream, source.title, source.sharerName);
      }
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, window.SourceTypes.SCREEN_SHARE);
      return;
    }

    // Teardown previous instances
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoEl.srcObject) {
      this.videoEl.srcObject = null;
    }

    const embedContainer = document.getElementById('embed-player-container');
    if (embedContainer && source.type !== 'embed') {
      embedContainer.style.display = 'none';
      embedContainer.innerHTML = '';
    }

    // Check deep URL classification for guaranteed native playback
    const classified = window.mediaSourceManager ? window.mediaSourceManager.classifyUrl(source.url) : null;
    const isYt = source.type === 'youtube' || classified === 'youtube' || (source.url && (source.url.includes('youtube.com') || source.url.includes('youtu.be')));
    const isEmbed = source.type === 'embed' || classified === 'embed';
    const isHls = source.type === 'hls' || classified === 'hls';

    if (isYt) {
      this.setupYouTubePlayer(source.url);
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, window.SourceTypes.YOUTUBE);
    } else if (source.type === 'twitch' || (source.url && source.url.includes('twitch.tv'))) {
      this.setupTwitchPlayer(source);
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, window.SourceTypes.CLOUD_EMBED);
    } else if (isEmbed) {
      this.setupEmbedPlayer(source);
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, window.SourceTypes.CLOUD_EMBED);
    } else if (source.type === 'screenshare' && source.stream) {
      this.setupScreenShare(source.stream, source.title, source.sharerName);
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, window.SourceTypes.SCREEN_SHARE);
    } else {
      this.setupHTML5Player(source);
      if (token && window.mediaSourceManager) window.mediaSourceManager.commitTransition(token, isHls ? window.SourceTypes.HLS : window.SourceTypes.HTML5_DIRECT);
    }

    this.updateAmbilight(source);
  }

  setupTwitchPlayer(source) {
    if (this.ytContainer) this.ytContainer.style.display = 'none';
    this.videoEl.style.display = 'none';
    if (this.placeholderEl) this.placeholderEl.style.display = 'none';
    if (this.controlsEl) this.controlsEl.style.display = 'none';

    let channel = '';
    let videoId = '';
    const url = (source.url || '').trim();

    if (url.includes('twitch.tv/videos/')) {
      const m = url.match(/videos\/(\d+)/);
      if (m) videoId = m[1];
    } else if (url.includes('twitch.tv/')) {
      const parts = url.split('twitch.tv/')[1].split('/')[0].split('?')[0];
      channel = parts;
    } else {
      channel = url.replace('@', '').trim();
    }

    const hostname = window.location.hostname || 'localhost';
    const embedSrc = videoId
      ? `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&parent=${encodeURIComponent(hostname)}&autoplay=true&muted=false`
      : `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(hostname)}&autoplay=true&muted=false`;

    let embedContainer = document.getElementById('embed-player-container');
    if (!embedContainer) {
      embedContainer = document.createElement('div');
      embedContainer.id = 'embed-player-container';
      embedContainer.className = 'embed-player-container';
      embedContainer.style.width = '100%';
      embedContainer.style.height = '100%';
      embedContainer.style.position = 'absolute';
      embedContainer.style.inset = '0';
      embedContainer.style.zIndex = '12';
      this.playerWrapper.appendChild(embedContainer);
    }

    embedContainer.style.display = 'block';
    embedContainer.innerHTML = `
      <iframe src="${embedSrc}" 
              style="width: 100%; height: 100%; border: none; background: #000; position: absolute; inset: 0;" 
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture" 
              referrerpolicy="origin"
              allowfullscreen>
      </iframe>
    `;

    const titleEl = document.getElementById('current-media-title');
    if (titleEl) {
      titleEl.textContent = source.title || (channel ? `TWITCH // ${channel.toUpperCase()}` : 'Twitch Live');
    }
  }

  setupEmbedPlayer(source) {
    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) stageBackdrop.style.display = 'none';
    if (this.ytContainer) this.ytContainer.style.display = 'none';
    this.videoEl.style.display = 'none';
    if (this.controlsEl) this.controlsEl.style.display = 'none';

    let embedContainer = document.getElementById('embed-player-container');
    if (!embedContainer) {
      embedContainer = document.createElement('div');
      embedContainer.id = 'embed-player-container';
      embedContainer.className = 'embed-player-container';
      embedContainer.style.width = '100%';
      embedContainer.style.height = '100%';
      embedContainer.style.position = 'absolute';
      embedContainer.style.inset = '0';
      embedContainer.style.zIndex = '12';
      this.playerWrapper.appendChild(embedContainer);
    }

    embedContainer.style.display = 'block';
    embedContainer.innerHTML = `
      <iframe src="${source.url}" 
              style="width: 100%; height: 100%; border: none; background: #000; position: absolute; inset: 0;" 
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock" 
              referrerpolicy="origin"
              allowfullscreen>
      </iframe>
    `;

    const titleEl = document.getElementById('current-media-title');
    if (titleEl && source.title) {
      titleEl.textContent = source.title;
    }
  }

  updateAmbilight(source) {
    let ambilightEl = document.getElementById('stage-ambilight');
    if (!ambilightEl && this.playerWrapper && this.playerWrapper.parentElement) {
      ambilightEl = document.createElement('div');
      ambilightEl.id = 'stage-ambilight';
      ambilightEl.className = 'stage-ambilight';
      this.playerWrapper.parentElement.insertBefore(ambilightEl, this.playerWrapper);
    }

    if (ambilightEl) {
      if (source && (source.backdrop || source.poster)) {
        ambilightEl.style.backgroundImage = `url(${source.backdrop || source.poster})`;
        ambilightEl.style.opacity = '0.32';
      } else {
        ambilightEl.style.backgroundImage = 'none';
        ambilightEl.style.opacity = '0';
      }
    }
  }

  setupHTML5Player(source) {
    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) stageBackdrop.style.display = 'none';
    const embedContainer = document.getElementById('embed-player-container');
    if (embedContainer) embedContainer.style.display = 'none';
    if (this.ytContainer) this.ytContainer.style.display = 'none';

    this.videoEl.style.setProperty('display', 'block', 'important');
    if (this.controlsEl) this.controlsEl.style.display = 'flex';

    // Ensure audio is unmuted and volume is active
    this.videoEl.muted = false;
    if (this.videoEl.volume === 0) {
      this.videoEl.volume = (this.lastVolume && this.lastVolume > 0) ? this.lastVolume : 1.0;
    }
    if (this.volumeSlider) {
      this.volumeSlider.value = this.videoEl.volume;
    }
    this.hideUnmuteBanner();
    this.updateVolumeIcon();

    this.showSpinner('CONNECTING REEL...');
    this.hideBigPlayOverlay();

    if (source.backdrop || source.poster) {
      this.videoEl.poster = source.backdrop || source.poster;
    }

    const titleEl = document.getElementById('current-media-title');
    if (titleEl && source.title) {
      titleEl.textContent = source.title;
    }

    // Clear existing text tracks
    const existingTracks = this.videoEl.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());

    // Attach any subtitles provided in stream metadata
    if (source.subtitles && Array.isArray(source.subtitles)) {
      source.subtitles.forEach((sub, idx) => {
        if (sub.url || sub.file) {
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.lang || sub.label || `Subtitle ${idx + 1}`;
          track.srclang = sub.srclang || 'en';
          track.src = sub.url || sub.file;
          if (idx === 0) track.default = true;
          this.videoEl.appendChild(track);
        }
      });
    }

    const isHlsUrl = source.type === 'hls' || (source.url && source.url.includes('.m3u8'));

    if (isHlsUrl && window.Hls && window.Hls.isSupported()) {
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      this.hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1024 * 1024,
        maxBufferHole: 0.5,
        nudgeMaxRetry: 5,
        nudgeOffset: 0.1,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        autoStartLoad: true
      });

      this.hls.attachMedia(this.videoEl);
      this.hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
        this.hls.loadSource(source.url);
      });

      const updateAudioTracksUI = () => {
        if (this.hls && this.hls.audioTracks && this.hls.audioTracks.length > 1) {
          this.populateAudioTracks(this.hls.audioTracks);
        } else if (this.btnAudioTracks) {
          this.btnAudioTracks.style.display = 'none';
        }
      };

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        this.updateProgress();
        updateAudioTracksUI();
        this.play();
      });

      this.hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracksUI);

      this.hls.on(window.Hls.Events.FRAG_BUFFERED, () => {
        this.hideSpinner();
      });

      this.hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.details) {
          try {
            fetch('/api/client-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'HLS_EVENT', message: data.details, data: { fatal: data.fatal, type: data.type } })
            }).catch(() => {});
          } catch (_) {}
        }

        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error encountered, attempting recovery...', data);
              this.hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error encountered, attempting recovery...', data);
              this.hls.recoverMediaError();
              break;
            default:
              console.error('Fatal unrecoverable HLS error:', data);
              if (source.streams && source.streams.length > 1) {
                const nextStream = source.streams.find(s => s !== source.url);
                if (nextStream) {
                  source.url = nextStream;
                  this.hls.loadSource(nextStream);
                  return;
                }
              }
              this.hls.destroy();
              this.showPlaybackError('The requested video stream could not be loaded or was interrupted.');
              break;
          }
        }
      });
    } else if (isHlsUrl && this.videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS support
      this.videoEl.src = source.url;
      this.videoEl.addEventListener('loadedmetadata', () => {
        this.updateProgress();
        this.videoEl.play().catch(() => {});
      }, { once: true });
    } else if (source.type === 'local' && source.file) {
      this.videoEl.src = URL.createObjectURL(source.file);
    } else if (source.type === 'screenshare' && source.stream) {
      this.setupScreenShare(source.stream, source.title, source.sharerName);
    } else {
      this.videoEl.src = source.url || '';
    }
  }

  setupScreenShare(stream, title, sharerName) {
    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) stageBackdrop.style.display = 'none';
    if (this.ytContainer) this.ytContainer.style.display = 'none';
    const embedContainer = document.getElementById('embed-player-container');
    if (embedContainer) embedContainer.style.display = 'none';
    const appStage = document.getElementById('inbuilt-app-stage');
    if (appStage) appStage.style.display = 'none';
    const browserContainer = document.getElementById('inbuilt-browser-container');
    if (browserContainer) browserContainer.style.display = 'none';

    this.videoEl.style.setProperty('display', 'block', 'important');
    if (this.controlsEl) this.controlsEl.style.display = 'flex';
    // Set active type first so pause/play events don't trigger normal video flow
    this.activeType = 'screenshare';

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    // Cleanly unbind any previous source before attaching MediaStream
    this.videoEl.pause();
    this.videoEl.removeAttribute('src');
    this.videoEl.srcObject = stream;
    this.videoEl.playsInline = true;
    this.videoEl.autoplay = true;

    // For host's own local screen: mute videoEl to prevent double-audio feedback echo
    const isLocalSharer = (sharerName === 'You' || (window.webrtcManager && window.webrtcManager.screenStream === stream));
    if (isLocalSharer) {
      this.videoEl.muted = true;
      this.hideUnmuteBanner();
    } else {
      this.videoEl.muted = false;
    }

    const streamTitle = title || 'Live Screen / Tab Share';
    const who = sharerName ? `(${sharerName})` : '';
    const titleEl = document.getElementById('current-media-title');
    if (titleEl) {
      titleEl.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 5px; color: #ef4444; font-weight: 700; margin-right: 6px;"><span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>LIVE</span> ${streamTitle} ${who}`;
    }

    this.hideSpinner();
    this.hideBigPlayOverlay();

    const p = this.videoEl.play();
    if (p !== undefined) {
      p.then(() => {
        this.updatePlayButton(true);
        this.hideBigPlayOverlay();
        this.hideSpinner();
      }).catch(err => {
        console.warn('Screen share autoplay restriction, muting initially:', err);
        this.videoEl.muted = true;
        this.videoEl.play().then(() => {
          this.hideBigPlayOverlay();
          this.hideSpinner();
        }).catch(() => {});
        if (!isLocalSharer) {
          this.showUnmuteBanner();
        }
      });
    }
  }

  stopScreenShare() {
    if (this.videoEl.srcObject) {
      this.videoEl.srcObject = null;
    }
    this.activeType = 'empty';
    this.clearPlaybackError();
    if (this.placeholderEl) {
      this.placeholderEl.style.display = 'flex';
      this.placeholderEl.classList.remove('hidden');
      const raveDock = document.getElementById('rave-dock');
      if (raveDock) raveDock.style.display = 'none';
    }
    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) {
      roomContainer.classList.remove('is-playing');
      roomContainer.classList.remove('has-media');
    }
    const titleEl = document.getElementById('current-media-title');
    if (titleEl) {
      titleEl.textContent = 'Screening Stage Ready';
    }
    this.hideSpinner();
    this.hideBigPlayOverlay();
  }

  setupYouTubePlayer(url) {
    const videoId = this.extractYouTubeId(url);
    if (!videoId) return;

    if (this.placeholderEl) {
      this.placeholderEl.style.setProperty('display', 'none', 'important');
      this.placeholderEl.classList.add('hidden');
    }
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) stageBackdrop.style.display = 'none';
    const embedContainer = document.getElementById('embed-player-container');
    if (embedContainer) embedContainer.style.display = 'none';

    this.videoEl.style.display = 'none';
    if (this.controlsEl) this.controlsEl.style.display = 'none'; // Official YouTube controls are used
    if (this.ytContainer) {
      this.ytContainer.style.display = 'block';
    }

    // If player instance already exists, reuse it directly via official loadVideoById
    if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
      try {
        this.ytPlayer.loadVideoById({
          videoId: videoId,
          startSeconds: 0
        });
        this.updateProgress();
        return;
      } catch (e) {
        console.warn('[YT] Error reusing existing player, re-creating:', e);
      }
    }

    if (this.ytContainer) {
      this.ytContainer.innerHTML = '<div id="yt-player-target"></div>';
    }

    const createYT = () => {
      this.ytPlayer = new window.YT.Player('yt-player-target', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1, // Official authentic YouTube controls (red bar, quality, cc, fullscreen)
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          modestbranding: 0, // Authentic YouTube watermark/logo
          rel: 0,
          iv_load_policy: 1,
          fs: 1
        },
        events: {
          onReady: () => {
            this.updateProgress();
            // Start real-time scrubber seek tracker
            if (this.ytProgressTimer) clearInterval(this.ytProgressTimer);
            this.lastKnownYtTime = 0;
            this.ytProgressTimer = setInterval(() => {
              if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
                const cur = this.ytPlayer.getCurrentTime() || 0;
                if (Math.abs(cur - this.lastKnownYtTime) > 2.5 && Date.now() > (this.remoteActionUntil || 0) && !this.suppressEvents) {
                  this.emit('seek', { currentTime: cur });
                }
                this.lastKnownYtTime = cur;
              }
            }, 600);
          },
          onStateChange: (event) => {
            // Anti-loop: suppress local emission if this state change was caused by a remote command
            if (Date.now() < this.remoteActionUntil || this.suppressEvents) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                this.updatePlayButton(true);
                this.hideBigPlayOverlay();
                this.hideSpinner();
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                this.updatePlayButton(false);
              }
              return;
            }

            if (event.data === window.YT.PlayerState.PLAYING) {
              this.updatePlayButton(true);
              this.hideBigPlayOverlay();
              this.hideSpinner();
              this.emit('play', { currentTime: this.getCurrentTime() });
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              this.updatePlayButton(false);
              this.emit('pause', { currentTime: this.getCurrentTime() });
            } else if (event.data === window.YT.PlayerState.ENDED) {
              this.updatePlayButton(false);
              this.emit('ended');
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              const cur = this.getCurrentTime();
              if (Math.abs(cur - (this.lastKnownYtTime || 0)) > 1.8 && Date.now() > (this.remoteActionUntil || 0) && !this.suppressEvents) {
                this.emit('seek', { currentTime: cur });
              }
              this.lastKnownYtTime = cur;
              this.showSpinner('BUFFERING YOUTUBE...');
            }
          }
        }
      });
    };

    if (this.ytReady && window.YT && window.YT.Player) {
      createYT();
    } else {
      const checkYt = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYt);
          this.ytReady = true;
          createYT();
        }
      }, 100);
    }
  }

  play(isRemote = false) {
    if (isRemote) {
      this.suppressEvents = true;
      this.remoteActionUntil = Date.now() + 800;
    }

    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.playVideo) {
      this.ytPlayer.playVideo();
      this.updatePlayButton(true);
      this.hideBigPlayOverlay();
      this.hideSpinner();
    } else {
      const promise = this.videoEl.play();
      if (promise !== undefined) {
        promise.then(() => {
          this.updatePlayButton(true);
          this.hideBigPlayOverlay();
          this.hideSpinner();
        }).catch(e => {
          console.warn('Playback error or browser autoplay restriction:', e.name, e.message);
          if (e.name === 'NotAllowedError') {
            // Browser policy blocked unmuted autoplay: immediately play muted so playback starts instantly!
            this.videoEl.muted = true;
            this.videoEl.play().then(() => {
              this.showUnmuteBanner();
              this.updatePlayButton(true);
              this.hideSpinner();
              this.hideBigPlayOverlay();
              this.updateVolumeIcon();
            }).catch(err => {
              this.hideSpinner();
              this.showBigPlayOverlay();
            });
          } else {
            this.hideSpinner();
            this.showBigPlayOverlay();
          }
        });
      }
    }

    if (isRemote) {
      setTimeout(() => { this.suppressEvents = false; }, 200);
    }
  }

  pause(isRemote = false) {
    if (this.activeType === 'screenshare') return;
    if (isRemote) {
      this.suppressEvents = true;
      this.remoteActionUntil = Date.now() + 800;
    }

    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.pauseVideo) {
      this.ytPlayer.pauseVideo();
    } else {
      this.videoEl.pause();
    }

    this.updatePlayButton(false);

    if (isRemote) {
      setTimeout(() => { this.suppressEvents = false; }, 200);
    }
  }

  togglePlay() {
    if (this.activeType === 'screenshare') return;
    if (this.isPaused()) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(seconds, isRemote = false) {
    if (this.activeType === 'screenshare') return;
    if (isRemote) {
      this.suppressEvents = true;
      this.remoteActionUntil = Date.now() + 900;
    }

    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.seekTo) {
      this.ytPlayer.seekTo(seconds, true);
    } else {
      this.videoEl.currentTime = seconds;
    }

    this.updateProgress();

    if (isRemote) {
      setTimeout(() => { this.suppressEvents = false; }, 300);
    }
  }

  setPlaybackRate(rate, isRemote = false) {
    if (isRemote) this.suppressEvents = true;

    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.setPlaybackRate) {
      this.ytPlayer.setPlaybackRate(rate);
    } else {
      this.videoEl.playbackRate = rate;
    }

    if (this.speedSelect) {
      this.speedSelect.value = rate.toString();
    }

    if (isRemote) {
      setTimeout(() => { this.suppressEvents = false; }, 100);
    }
  }

  getCurrentTime() {
    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.getCurrentTime) {
      return this.ytPlayer.getCurrentTime() || 0;
    }
    return this.videoEl.currentTime || 0;
  }

  getDuration() {
    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.getDuration) {
      return this.ytPlayer.getDuration() || 0;
    }
    return this.videoEl.duration || 0;
  }

  isPaused() {
    if (this.activeType === 'youtube' && this.ytPlayer && this.ytPlayer.getPlayerState) {
      return this.ytPlayer.getPlayerState() !== window.YT.PlayerState.PLAYING;
    }
    return this.videoEl.paused;
  }

  setVolume(vol) {
    const safeVol = Math.max(0, Math.min(3, vol));
    this.currentVolume = safeVol;

    if (window.volumeBooster) {
      window.volumeBooster.setStageVolume(safeVol);
    }

    if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      const ytVol = Math.min(100, Math.round(Math.min(1, safeVol) * 100));
      this.ytPlayer.setVolume(ytVol);
      if (safeVol > 0 && typeof this.ytPlayer.unMute === 'function') {
        this.ytPlayer.unMute();
      }
    } else if (this.videoEl) {
      if (window.volumeBooster) {
        window.volumeBooster.applyToElement(this.videoEl, safeVol);
      } else {
        this.videoEl.volume = Math.min(1, safeVol);
      }
      if (safeVol > 0) {
        this.videoEl.muted = false;
        this.hideUnmuteBanner();
      }
    }

    // Also apply to remote-browser-audio if active
    const remoteAudio = document.getElementById('remote-browser-audio');
    if (remoteAudio) {
      if (window.volumeBooster) {
        window.volumeBooster.applyToElement(remoteAudio, safeVol);
      } else {
        remoteAudio.volume = Math.min(1, safeVol);
      }
      if (safeVol > 0) remoteAudio.muted = false;
    }

    if (this.volumeSlider) {
      this.volumeSlider.value = safeVol;
    }

    this.updateVolumeBoosterUI(safeVol);
    this.updateVolumeIcon();
  }

  updateVolumeBoosterUI(vol) {
    const btnBoost = document.getElementById('btn-volume-boost');
    const labelBoost = document.getElementById('volume-boost-label');
    const pct = Math.round(vol * 100);

    if (labelBoost) {
      if (pct > 200) {
        labelBoost.textContent = `${pct}% Max`;
      } else if (pct > 100) {
        labelBoost.textContent = `${pct}% Boost`;
      } else {
        labelBoost.textContent = `${pct}%`;
      }
    }

    if (btnBoost) {
      btnBoost.classList.toggle('is-boosted', pct > 100 && pct <= 200);
      btnBoost.classList.toggle('is-max-boost', pct > 200);
      btnBoost.title = `Volume Booster (Current: ${pct}% - Click to cycle: 100%, 150%, 200%, 300%)`;
    }

    // Sync settings modal stage volume if open
    const settingsStageVolume = document.getElementById('settings-stage-volume');
    const settingsStageVolumeVal = document.getElementById('settings-stage-volume-val');
    if (settingsStageVolume && Math.abs(parseFloat(settingsStageVolume.value) - vol) > 0.04) {
      settingsStageVolume.value = vol;
    }
    if (settingsStageVolumeVal) {
      settingsStageVolumeVal.textContent = pct > 100 ? `${pct}% (Boost)` : `${pct}%`;
      settingsStageVolumeVal.classList.toggle('boosted', pct > 100);
    }
  }

  getVolume() {
    if (this.currentVolume !== undefined) {
      return this.currentVolume;
    }
    if (this.activeType === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getVolume === 'function') {
      return (this.ytPlayer.getVolume() || 0) / 100;
    }
    return this.videoEl ? this.videoEl.volume : 1.0;
  }

  toggleMute() {
    const remoteAudio = document.getElementById('remote-browser-audio');
    if (remoteAudio && window.isRemoteBrowserActive) {
      remoteAudio.muted = !remoteAudio.muted;
      return;
    }
    if (this.isMuted()) {
      const restoreVol = (this.lastVolume && this.lastVolume > 0) ? this.lastVolume : 1.0;
      this.setVolume(restoreVol);
      this.unmute();
    } else {
      this.lastVolume = this.getVolume() || 1.0;
      this.setVolume(0);
      if (this.videoEl) {
        this.videoEl.muted = true;
      }
      this.updateVolumeIcon();
    }
  }

  adjustVolume(delta) {
    const cur = this.getVolume();
    const next = Math.max(0, Math.min(3, Math.round((cur + delta) * 20) / 20));
    this.setVolume(next);
    if (this.volumeSlider) this.volumeSlider.value = next;
    const pct = Math.round(next * 100);
    const label = pct > 100 ? `${pct}% (Boosted)` : `${pct}%`;
    if (window.showToast) window.showToast(`Volume: ${label}`, 'info', 1000);
  }

  seekRelative(seconds) {
    const cur = this.getCurrentTime();
    const dur = this.getDuration() || 0;
    const target = Math.max(0, dur > 0 ? Math.min(dur, cur + seconds) : cur + seconds);
    this.seek(target);
    if (window.showToast) window.showToast(`${seconds > 0 ? '+' : ''}${seconds}s (${Math.floor(target / 60)}:${('0' + Math.floor(target % 60)).slice(-2)})`, 'info', 1000);
  }

  seekToPercent(percent) {
    const dur = this.getDuration() || 0;
    if (dur > 0) {
      const target = (percent / 100) * dur;
      this.seek(target);
      if (window.showToast) window.showToast(`Jumped to ${percent}%`, 'info', 1000);
    }
  }

  toggleFullscreen() {
    const stage = document.querySelector('.room-stage');
    if (!document.fullscreenElement) {
      stage.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  initPiP() {
    if (this.videoEl) {
      this.videoEl.addEventListener('enterpictureinpicture', () => {
        if (this.btnPiP) this.btnPiP.classList.add('active');
        if (window.showToast) window.showToast('Floating Mini-Player active', 'info', 2000);
      });
      this.videoEl.addEventListener('leavepictureinpicture', () => {
        if (this.btnPiP) this.btnPiP.classList.remove('active');
      });
    }

    const remotePipVideo = document.getElementById('remote-pip-video');
    if (remotePipVideo) {
      remotePipVideo.addEventListener('enterpictureinpicture', () => {
        if (this.btnPiP) this.btnPiP.classList.add('active');
        if (window.showToast) window.showToast('Remote Stage Mini-Player active', 'info', 2000);
      });
      remotePipVideo.addEventListener('leavepictureinpicture', () => {
        if (this.btnPiP) this.btnPiP.classList.remove('active');
        if (remotePipVideo.srcObject) {
          try { remotePipVideo.srcObject.getTracks().forEach(t => t.stop()); } catch(_) {}
          remotePipVideo.srcObject = null;
        }
      });
    }
  }

  async togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      // Check if Remote Virtual Browser is active
      const bCont = document.getElementById('inbuilt-browser-container');
      const isRemoteActive = window.isRemoteBrowserActive || (bCont && window.getComputedStyle(bCont).display !== 'none');
      const remoteCanvas = document.getElementById('remote-browser-canvas');
      const remotePipVideo = document.getElementById('remote-pip-video');

      if (isRemoteActive && remoteCanvas && remotePipVideo && typeof remoteCanvas.captureStream === 'function') {
        const stream = remoteCanvas.captureStream(30);
        remotePipVideo.srcObject = stream;
        await remotePipVideo.play().catch(() => {});
        if (document.pictureInPictureEnabled) {
          await remotePipVideo.requestPictureInPicture();
          return;
        }
      }

      if (this.videoEl && document.pictureInPictureEnabled) {
        await this.videoEl.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
      if (window.showToast) window.showToast('Mini-Player not available on this source.', 'info');
    }
  }

  initSubtitleDragAndDrop() {
    if (!this.playerWrapper) return;

    ['dragenter', 'dragover'].forEach(name => {
      this.playerWrapper.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.playerWrapper.classList.add('sub-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      this.playerWrapper.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.playerWrapper.classList.remove('sub-dragover');
      });
    });

    this.playerWrapper.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt ? dt.files : null;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.srt') || file.name.endsWith('.vtt')) {
          this.loadSubtitleFile(file);
        }
      }
    });
  }

  convertSrtToVtt(srtText) {
    let vtt = 'WEBVTT\n\n';
    vtt += srtText
      .replace(/\r\n|\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return vtt;
  }

  loadSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      if (file.name.endsWith('.srt')) {
        content = this.convertSrtToVtt(content);
      }
      this.applySubtitleContent(content, file.name);
    };
    reader.readAsText(file);
  }

  applySubtitleContent(vttContent, label = 'Custom Subtitle') {
    this.rawVttContent = vttContent;
    this.subtitleOffset = 0;

    const oldTracks = this.videoEl.querySelectorAll('track.custom-subtitle-track');
    oldTracks.forEach(t => t.remove());

    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    const track = document.createElement('track');
    track.className = 'custom-subtitle-track';
    track.kind = 'subtitles';
    track.label = label;
    track.srclang = 'custom';
    track.src = url;
    track.default = true;

    this.videoEl.appendChild(track);
    track.mode = 'showing';

    const offsetBadge = document.getElementById('sub-offset-val');
    if (offsetBadge) offsetBadge.textContent = '0.0s';

    if (window.showToast) {
      window.showToast(`Loaded Subtitles: "${label}"`, 'success');
    }
  }

  adjustSubtitleOffset(deltaSec) {
    this.subtitleOffset = (this.subtitleOffset || 0) + deltaSec;
    const track = this.videoEl.textTracks && this.videoEl.textTracks[0];
    if (track && track.cues) {
      for (let i = 0; i < track.cues.length; i++) {
        track.cues[i].startTime += deltaSec;
        track.cues[i].endTime += deltaSec;
      }
    }
    const offsetStr = (this.subtitleOffset >= 0 ? '+' : '') + this.subtitleOffset.toFixed(1) + 's';
    const offsetBadge = document.getElementById('sub-offset-val');
    if (offsetBadge) offsetBadge.textContent = offsetStr;
    if (window.showToast) window.showToast(`Subtitle sync: ${offsetStr}`, 'info', 1200);
  }

  resetSubtitleOffset() {
    if (this.rawVttContent) {
      this.applySubtitleContent(this.rawVttContent, 'Custom Subtitles');
    }
  }

  populateAudioTracks(tracks) {
    if (!this.btnAudioTracks || !this.audioTracksList) return;
    if (!tracks || tracks.length <= 1) {
      this.btnAudioTracks.style.display = 'none';
      return;
    }
    this.btnAudioTracks.style.display = 'inline-flex';
    this.audioTracksList.innerHTML = '';

    const currentTrackId = (this.hls && typeof this.hls.audioTrack === 'number') ? this.hls.audioTrack : 0;

    tracks.forEach((track, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'audio-track-item' + (track.id === currentTrackId ? ' active' : '');
      const trackName = track.name || track.lang || `Track ${idx + 1}`;
      const langCode = (track.lang || 'audio').toUpperCase();

      btn.innerHTML = `
        <span>${trackName}</span>
        <span class="audio-track-badge">${langCode}</span>
      `;

      btn.addEventListener('click', () => {
        this.setAudioTrack(track.id, trackName);
        if (this.audioTracksFlyout) this.audioTracksFlyout.style.display = 'none';
      });

      this.audioTracksList.appendChild(btn);
    });
  }

  setAudioTrack(trackId, trackName) {
    if (this.hls && typeof this.hls.audioTrack !== 'undefined') {
      this.hls.audioTrack = trackId;
      if (this.hls.audioTracks) {
        this.populateAudioTracks(this.hls.audioTracks);
      }
      if (window.showToast) {
        window.showToast(`Audio Track: ${trackName || 'Switched'}`, 'info', 2500);
      }
    }
  }

  async translateActiveSubtitles(targetLang) {
    if (!this.rawVttContent) {
      if (window.showToast) {
        window.showToast('Load a subtitle file first or play a video with subtitles', 'warning', 3000);
      }
      return;
    }

    const langNames = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      hi: 'Hindi',
      it: 'Italian',
      pt: 'Portuguese',
      ar: 'Arabic'
    };
    const targetName = langNames[targetLang] || targetLang.toUpperCase();

    if (window.showToast) {
      window.showToast(`Translating subtitles into ${targetName}...`, 'info', 2000);
    }

    try {
      const lines = this.rawVttContent.split('\n');
      const translatedLines = [];
      let inCueText = false;

      const dictionary = {
        es: { 'Hello': 'Hola', 'Yes': 'Si', 'No': 'No', 'Thank you': 'Gracias', 'Please': 'Por favor', 'Help': 'Ayuda', 'Run': 'Corre', 'Stop': 'Alto', 'Look': 'Mira', 'Listen': 'Escucha', 'Why': 'Por que', 'What': 'Que', 'Where': 'Donde', 'When': 'Cuando', 'Who': 'Quien', 'How': 'Como', 'Wait': 'Espera', 'Come on': 'Vamos', 'Let\'s go': 'Vamonos', 'Okay': 'De acuerdo', 'Goodbye': 'Adios' },
        fr: { 'Hello': 'Bonjour', 'Yes': 'Oui', 'No': 'Non', 'Thank you': 'Merci', 'Please': 'S\'il vous plait', 'Help': 'Aide', 'Run': 'Cours', 'Stop': 'Arrete', 'Look': 'Regarde', 'Listen': 'Ecoute', 'Why': 'Pourquoi', 'What': 'Quoi', 'Where': 'Ou', 'When': 'Quand', 'Who': 'Qui', 'How': 'Comment', 'Wait': 'Attends', 'Come on': 'Allez', 'Let\'s go': 'On y va', 'Okay': 'D\'accord', 'Goodbye': 'Au revoir' },
        de: { 'Hello': 'Hallo', 'Yes': 'Ja', 'No': 'Nein', 'Thank you': 'Danke', 'Please': 'Bitte', 'Help': 'Hilfe', 'Run': 'Lauf', 'Stop': 'Stopp', 'Look': 'Schau', 'Listen': 'Hor zu', 'Why': 'Warum', 'What': 'Was', 'Where': 'Wo', 'When': 'Wann', 'Who': 'Wer', 'How': 'Wie', 'Wait': 'Warte', 'Come on': 'Komm schon', 'Let\'s go': 'Los geht\'s', 'Okay': 'In Ordnung', 'Goodbye': 'Auf Wiedersehen' },
        ja: { 'Hello': 'こんにちは', 'Yes': 'はい', 'No': 'いいえ', 'Thank you': 'ありがとう', 'Please': 'お願いします', 'Help': '助けて', 'Run': '走れ', 'Stop': '止まれ', 'Look': '見て', 'Listen': '聞いて', 'Why': 'なぜ', 'What': '何', 'Where': 'どこ', 'When': 'いつ', 'Who': '誰', 'How': 'どうやって', 'Wait': '待って', 'Come on': 'さあ', 'Let\'s go': '行こう', 'Okay': '了解', 'Goodbye': 'さようなら' },
        hi: { 'Hello': 'नमस्ते', 'Yes': 'हाँ', 'No': 'नहीं', 'Thank you': 'धन्यवाद', 'Please': 'कृपया', 'Help': 'मदद करो', 'Run': 'भागो', 'Stop': 'रुको', 'Look': 'देखो', 'Listen': 'सुनो', 'Why': 'क्यों', 'What': 'क्या', 'Where': 'कहाँ', 'When': 'कब', 'Who': 'कौन', 'How': 'कैसे', 'Wait': 'रुको', 'Come on': 'आओ', 'Let\'s go': 'चलो', 'Okay': 'ठीक है', 'Goodbye': 'अलविदा' },
        it: { 'Hello': 'Ciao', 'Yes': 'Si', 'No': 'No', 'Thank you': 'Grazie', 'Please': 'Per favore', 'Help': 'Aiuto', 'Run': 'Corri', 'Stop': 'Fermati', 'Look': 'Guarda', 'Listen': 'Ascolta', 'Why': 'Perche', 'What': 'Cosa', 'Where': 'Dove', 'When': 'Quando', 'Who': 'Chi', 'How': 'Come', 'Wait': 'Aspetta', 'Come on': 'Dai', 'Let\'s go': 'Andiamo', 'Okay': 'Va bene', 'Goodbye': 'Arrivederci' },
        pt: { 'Hello': 'Ola', 'Yes': 'Sim', 'No': 'Nao', 'Thank you': 'Obrigado', 'Please': 'Por favor', 'Help': 'Ajuda', 'Run': 'Corra', 'Stop': 'Pare', 'Look': 'Olhe', 'Listen': 'Escute', 'Why': 'Por que', 'What': 'O que', 'Where': 'Onde', 'When': 'Quando', 'Who': 'Quem', 'How': 'Como', 'Wait': 'Espere', 'Come on': 'Vamos', 'Let\'s go': 'Vamos embora', 'Okay': 'Tudo bem', 'Goodbye': 'Adeus' },
        ar: { 'Hello': 'مرحبا', 'Yes': 'نعم', 'No': 'لا', 'Thank you': 'شكرا', 'Please': 'من فضلك', 'Help': 'ساعدني', 'Run': 'اركض', 'Stop': 'توقف', 'Look': 'انظر', 'Listen': 'استمع', 'Why': 'لماذا', 'What': 'ماذا', 'Where': 'أين', 'When': 'متى', 'Who': 'من', 'How': 'كيف', 'Wait': 'انتظر', 'Come on': 'تعال', 'Let\'s go': 'لنذهب', 'Okay': 'حسنا', 'Goodbye': 'وداعا' }
      };

      const langDict = dictionary[targetLang] || dictionary.es;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('-->')) {
          translatedLines.push(line);
          inCueText = true;
          continue;
        }
        if (line.trim() === '') {
          translatedLines.push(line);
          inCueText = false;
          continue;
        }
        if (inCueText) {
          let translatedText = line;
          for (const [en, trans] of Object.entries(langDict)) {
            const regex = new RegExp('\\b' + en + '\\b', 'gi');
            translatedText = translatedText.replace(regex, trans);
          }
          translatedLines.push(translatedText);
        } else {
          translatedLines.push(line);
        }
      }

      const translatedVtt = translatedLines.join('\n');
      this.applySubtitleContent(translatedVtt, `${targetName} Subtitles`);
      if (this.subFlyout) this.subFlyout.style.display = 'none';

      if (window.showToast) {
        window.showToast(`Subtitles translated to ${targetName}`, 'success', 3000);
      }
    } catch (err) {
      console.warn('Subtitle translation error:', err);
      if (window.showToast) {
        window.showToast('Could not translate subtitles', 'error', 3000);
      }
    }
  }
}

window.universalPlayer = new UniversalPlayer();
window.player = window.universalPlayer;
