/**
 * CineSync Synchronization Engine
 * Handles real-time playback synchronization, anti-loop guards, drift correction, and heartbeat tracking.
 */

class SyncEngine {
  constructor(socket, player) {
    this.socket = socket;
    this.player = player;
    this.isHost = false;
    this.hostOnlyControls = false;
    this.syncIndicator = document.getElementById('sync-indicator');
    this.syncText = document.getElementById('sync-text');
    this.btnSyncNow = document.getElementById('btn-sync-now');

    this.heartbeatTimer = null;
    this.lastDrift = 0;
    this.isSoftSyncing = false;
    this.currentSoftRate = 1.0;

    this.initSocketListeners();
    this.initPlayerListeners();
    this.initSyncControls();
  }

  setHostStatus(isHost, hostOnlyControls) {
    this.isHost = isHost;
    this.hostOnlyControls = hostOnlyControls;

    if (this.isHost) {
      this.startHostHeartbeat();
    } else {
      this.stopHostHeartbeat();
    }
  }

  updateSyncBadge(status, driftSec = 0) {
    if (!this.syncIndicator || !this.syncText) return;

    if (status === 'synced') {
      this.syncIndicator.className = 'sync-indicator';
      this.syncText.textContent = `In Sync (${driftSec.toFixed(1)}s)`;
    } else if (status === 'syncing') {
      this.syncIndicator.className = 'sync-indicator syncing';
      this.syncText.textContent = `Catching up (${driftSec.toFixed(1)}s)`;
    } else if (status === 'host') {
      this.syncIndicator.className = 'sync-indicator';
      this.syncText.textContent = 'Host (Master Clock)';
    }
  }

  startHostHeartbeat() {
    this.stopHostHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isHost && this.player.activeType !== 'empty' && this.player.activeType !== 'screenshare') {
        this.socket.emit('host-heartbeat', {
          currentTime: this.player.getCurrentTime(),
          isPlaying: !this.player.isPaused()
        });
      }
    }, 2500);
    this.updateSyncBadge('host');
  }

  stopHostHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  initSyncControls() {
    if (this.btnSyncNow) {
      this.btnSyncNow.addEventListener('click', () => {
        this.requestSync();
        if (window.showToast) window.showToast('Re-synchronizing with host...', 'info');
      });
    }
  }

  requestSync() {
    this.socket.emit('request-sync');
  }

  initPlayerListeners() {
    // Local player actions -> emit to server
    this.player.on('play', ({ currentTime }) => {
      if (this.player.activeType === 'screenshare') return;
      this.socket.emit('media-play', { currentTime });
    });

    this.player.on('pause', ({ currentTime }) => {
      if (this.player.activeType === 'screenshare') return;
      this.socket.emit('media-pause', { currentTime });
    });

    this.player.on('seek', ({ currentTime }) => {
      if (this.player.activeType === 'screenshare') return;
      this.socket.emit('media-seek', { currentTime });
    });

    this.player.on('ratechange', ({ playbackRate }) => {
      if (this.player.activeType === 'screenshare') return;
      this.socket.emit('media-ratechange', { playbackRate });
    });

    this.player.on('ended', () => {
      console.log('[SYNC] Media ended, checking queue for autoplay countdown');
      if (window.roomQueueManager && window.roomQueueManager.playlist && window.roomQueueManager.playlist.length > 0) {
        window.roomQueueManager.startAutoplayCountdown(5);
      } else if (this.isHost) {
        this.socket.emit('playlist-next');
      }
    });

    this.player.on('buffering', ({ isBuffering, currentTime }) => {
      if (this.player.activeType === 'screenshare') return;
      if (isBuffering) {
        this.updateSyncBadge('syncing', this.lastDrift || 0);
      }
      this.socket.emit('media-buffering', { isBuffering, currentTime });
    });
  }

  initSocketListeners() {
    // Immediate Auto-Sync on Connection / Reconnection
    this.socket.on('connect', () => {
      console.log('[SYNC] Socket connected, fetching room sync state...');
      this.requestSync();
    });

    this.socket.on('reconnect', () => {
      console.log('[SYNC] Socket reconnected, re-aligning master clock...');
      this.requestSync();
    });

    // Shared Room Queue / Playlist updates
    this.socket.on('playlist-updated', ({ playlist, action, item }) => {
      if (window.roomQueueManager) {
        window.roomQueueManager.updatePlaylist(playlist);
      }
    });

    // Soundboard party reactions
    this.socket.on('soundboard-triggered', ({ soundId, senderName }) => {
      if (window.reactionEngine) {
        window.reactionEngine.triggerSoundboard(soundId, senderName);
      }
    });

    // Media Source Change
    this.socket.on('media-changed', ({ mediaSource, changedBy }) => {
      const placeholder = document.getElementById('player-placeholder');
      if (placeholder) {
        placeholder.style.setProperty('display', 'none', 'important');
        placeholder.classList.add('hidden');
      }
      const stageBackdrop = document.getElementById('playing-stage-backdrop');
      if (stageBackdrop) stageBackdrop.style.display = 'none';
      const roomContainer = document.querySelector('.room-container');
      if (roomContainer) {
        roomContainer.classList.add('is-playing');
        roomContainer.classList.add('has-media');
      }

      if (window.showToast) {
        window.showToast(`${changedBy} changed video to: "${mediaSource.title}"`, 'info');
      }

      const titleEl = document.getElementById('current-media-title');
      if (titleEl) {
        titleEl.textContent = mediaSource.title;
      }

      // If mediaSource is a live screenshare, preserve existing screen stream!
      if (mediaSource.type === 'screenshare') {
        // If THIS user is the one sharing, DO NOT touch our own screen stream!
        if (window.webrtcManager && window.webrtcManager.isSharingScreen && window.webrtcManager.screenStream) {
          console.log('[SYNC] Preserving local screen stream for host');
          return;
        }

        // For viewers: if remote screen stream is already available, attach it now
        if (window.universalPlayer) {
          window.universalPlayer.activeType = 'screenshare';
          if (window.webrtcManager && window.webrtcManager.remoteScreenStream) {
            window.universalPlayer.setupScreenShare(
              window.webrtcManager.remoteScreenStream,
              mediaSource.title,
              changedBy
            );
          } else {
            window.universalPlayer.showSpinner(`CONNECTING TO ${changedBy.toUpperCase()}'S LIVE CAST...`);
          }
        }
        return;
      }

      this.player.loadSource(mediaSource);

      if (mediaSource.currentTime > 0) {
        this.player.seek(mediaSource.currentTime, true);
      }
      if (mediaSource.isPlaying !== false && mediaSource.type !== 'hls') {
        this.player.play(true);
      }
    });

    // Remote Play
    this.socket.on('media-play', ({ currentTime, senderName }) => {
      if (this.player.activeType === 'screenshare') return;
      const diff = Math.abs(this.player.getCurrentTime() - currentTime);
      if (diff > 1.0) {
        this.player.seek(currentTime, true);
      }
      this.player.play(true);
      this.updateSyncBadge('synced', diff);
    });

    // Remote Pause
    this.socket.on('media-pause', ({ currentTime, senderName }) => {
      if (this.player.activeType === 'screenshare') return;
      this.player.seek(currentTime, true);
      this.player.pause(true);
      this.updateSyncBadge('synced', 0);
    });

    // Remote Seek
    this.socket.on('media-seek', ({ currentTime, senderName }) => {
      if (this.player.activeType === 'screenshare') return;
      this.player.seek(currentTime, true);
      this.updateSyncBadge('synced', 0);
    });

    // Remote Playback Rate
    this.socket.on('media-ratechange', ({ playbackRate }) => {
      if (this.player.activeType === 'screenshare') return;
      this.player.setPlaybackRate(playbackRate, true);
    });

    // Heartbeat from Host
    this.socket.on('room-heartbeat', ({ currentTime, isPlaying, timestamp }) => {
      if (this.isHost || this.player.activeType === 'screenshare') return;

      const myTime = this.player.getCurrentTime();
      const myPaused = this.player.isPaused();
      const drift = Math.abs(myTime - currentTime);
      this.lastDrift = drift;

      // Correct play state if mismatched
      if (isPlaying && myPaused) {
        this.player.play(true);
      } else if (!isPlaying && !myPaused) {
        this.player.pause(true);
      }

      // Rave-Style Dual-Threshold Drift Correction Engine:
      // 1. Deadband (< 80ms): Perfectly aligned, do not disturb playback
      // 2. Soft Sync (80ms - 1500ms): Smoothly nudge playback rate by ±5% to close drift without audio clicks
      // 3. Hard Sync (> 1500ms): Direct seek jump to snap into sync
      if (drift > 1.5) {
        // Hard sync required
        this.updateSyncBadge('syncing', drift);
        this.player.seek(currentTime, true);
        if (this.isSoftSyncing) {
          this.player.setPlaybackRate(1.0, true);
          this.isSoftSyncing = false;
        }
      } else if (drift > 0.08 && isPlaying) {
        // Soft sync: micro-nudge playback rate (1.05x if behind, 0.95x if ahead)
        this.updateSyncBadge('syncing', drift);
        const targetRate = myTime < currentTime ? 1.05 : 0.95;
        if (!this.isSoftSyncing || this.currentSoftRate !== targetRate) {
          this.isSoftSyncing = true;
          this.currentSoftRate = targetRate;
          this.player.setPlaybackRate(targetRate, true);
        }
      } else {
        // Aligned within human perceptual deadband (< 80ms)
        if (this.isSoftSyncing) {
          this.player.setPlaybackRate(1.0, true);
          this.isSoftSyncing = false;
          this.currentSoftRate = 1.0;
        }
        this.updateSyncBadge('synced', drift);
      }
    });

    // Sync Response from server
    this.socket.on('sync-response', ({ currentTime, isPlaying, playbackRate, mediaSource }) => {
      if (this.player.activeType === 'screenshare') return;
      if (mediaSource && this.player.activeType === 'empty') {
        this.player.loadSource(mediaSource);
      }

      if (currentTime !== undefined) {
        this.player.seek(currentTime, true);
      }

      if (playbackRate) {
        this.player.setPlaybackRate(playbackRate, true);
      }

      if (isPlaying) {
        this.player.play(true);
      } else {
        this.player.pause(true);
      }

      this.updateSyncBadge('synced', 0);
    });

    // Server-enforced command (e.g. when viewer pressed play during host-only mode)
    this.socket.on('sync-command', ({ action, currentTime }) => {
      if (action === 'pause') {
        this.player.seek(currentTime, true);
        this.player.pause(true);
      } else if (action === 'play') {
        this.player.seek(currentTime, true);
        this.player.play(true);
      }
    });
  }
}

window.SyncEngine = SyncEngine;
