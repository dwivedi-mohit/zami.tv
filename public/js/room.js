/**
 * CineSync Room Controller
 * Coordinates socket connection, UI views, chat, participant management, modals, and notifications.
 */

// Vector SVG Icon Definitions (Lucide-style, zero emojis)
const MIC_ON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const MIC_OFF_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const BELL_ON_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const BELL_OFF_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const STAR_ICON_SVG = '<svg class="icon-star-inline" width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

// Toast notification helper (Sonner / Linear style)
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (container) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const dot = document.createElement('span');
    dot.className = 'toast-dot';

    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close-btn';
    closeBtn.setAttribute('aria-label', 'Close toast');
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px) scale(0.96)';
      setTimeout(() => toast.remove(), 220);
    };

    closeBtn.addEventListener('click', dismiss);

    toast.appendChild(dot);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    setTimeout(dismiss, duration);
  }

  // Screen reader announcement
  const announcer = document.getElementById('a11y-announcer');
  if (announcer) {
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = message; }, 50);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Extract roomId from URL path /room/:id or query param ?room=
  const pathParts = window.location.pathname.split('/');
  let roomId = pathParts[2];
  if (!roomId || roomId === 'room') {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room') || 'party-' + Math.random().toString(36).substr(2, 6);
  }
  window.currentRoomId = roomId;

  // Display room ID
  const roomIdDisplay = document.getElementById('room-id-display');
  if (roomIdDisplay) roomIdDisplay.textContent = roomId;
  const emptyStageRoomName = document.getElementById('empty-stage-room-name');
  if (emptyStageRoomName) emptyStageRoomName.textContent = roomId;

  // Retrieve or create User profile
  const storedName = localStorage.getItem('zami_username') || localStorage.getItem('cinesync_username');
  const storedColor = localStorage.getItem('zami_color') || localStorage.getItem('cinesync_color');

  const randomColors = ['#d4a359', '#ffffff', '#34d399', '#60a5fa', '#f43f5e', '#a78bfa'];
  const userColor = storedColor || randomColors[Math.floor(Math.random() * randomColors.length)];
  const username = storedName || `Viewer-${Math.floor(100 + Math.random() * 900)}`;

  localStorage.setItem('zami_username', username);
  localStorage.setItem('cinesync_username', username);
  localStorage.setItem('zami_color', userColor);
  localStorage.setItem('cinesync_color', userColor);

  // Initialize Socket.io
  const socket = io();
  window.socket = socket;
  let syncEngine = null;
  let webrtcManager = null;
  let currentUser = null;
  let currentUsersList = [];
  let activeSidebarTab = 'chat';
  let unreadChatCount = 0;
  const ROOM_TABS = ['chat', 'voice', 'queue'];

  // --------------------------------------------------------------------------
  // Stage Wallpaper Management & Room Defaults
  // --------------------------------------------------------------------------
  const STAGE_WALLPAPER_PRESETS = [
    { id: 'summer-outfit', name: 'Summer Outfit Inspiration (Video)', url: '/video/summer-outfit-bg.mp4', poster: '/img/summer_outfit_poster.jpg', isVideo: true },
    { id: 'tv-static', name: 'Television Static (Video)', url: '/video/tv-static.mp4', poster: '/img/tv_static_poster.jpg', isVideo: true },
    { id: 'astronaut', name: 'Cosmic Astronaut', url: '/img/backdrop_astronaut.jpg' },
    { id: 'sunset', name: 'Sunset Silhouettes', url: '/img/backdrop_sunset.jpg' },
    { id: 'neon', name: 'Neon Cyberpunk', url: '/img/backdrop_neon.jpg' },
    { id: 'mountain', name: 'Moody Mountains', url: '/img/cinematic-stage-bg.jpg' },
    { id: 'interstellar', name: 'Interstellar Horizon', url: '/img/interstellar-still.jpg' }
  ];

  function isVideoBackdrop(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.toLowerCase().split('?')[0];
    return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') || clean.includes('/video/');
  }

  function getRoomDefaultBackdrop(rId) {
    try {
      const localSaved = localStorage.getItem('zami_room_backdrop_' + rId);
      if (localSaved && localSaved !== '/video/tv-static.mp4' && localSaved !== '/img/backdrop_astronaut.jpg' && localSaved !== '/img/backdrop_sunset.jpg' && localSaved !== '/img/backdrop_neon.jpg') {
        return localSaved;
      }
    } catch (e) {}
    return '/video/summer-outfit-bg.mp4';
  }

  let currentStageBackdrop = getRoomDefaultBackdrop(roomId);

  function setStageBackdrop(url, saveLocally = true) {
    if (!url) return;
    currentStageBackdrop = url;
    if (saveLocally && roomId) {
      try {
        localStorage.setItem('zami_room_backdrop_' + roomId, url);
      } catch (e) {}
    }

    const bgLayer = document.getElementById('room-bg-layer');
    const bgVideo = document.getElementById('room-bg-video');
    const isVid = isVideoBackdrop(url);

    if (isVid) {
      if (bgVideo) {
        const cur = bgVideo.currentSrc || bgVideo.src || '';
        if (!cur.includes(url)) {
          bgVideo.src = url;
          bgVideo.load();
        }
        bgVideo.style.display = 'block';
        bgVideo.style.opacity = '1';
        bgVideo.muted = true;
        const playPromise = bgVideo.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
      if (bgLayer) {
        bgLayer.style.backgroundImage = 'none';
      }
      document.documentElement.style.setProperty('--stage-backdrop-url', 'none');
    } else {
      if (bgVideo) {
        bgVideo.pause();
        bgVideo.style.display = 'none';
        bgVideo.style.opacity = '0';
      }
      if (bgLayer) {
        bgLayer.style.backgroundImage = `url('${url}')`;
      }
      document.documentElement.style.setProperty('--stage-backdrop-url', `url('${url}')`);
    }

    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) {
      roomContainer.style.backgroundImage = isVid ? 'none' : `url('${url}')`;
    }
    const placeholderEl = document.getElementById('player-placeholder');
    if (placeholderEl) {
      placeholderEl.style.backgroundImage = 'none';
    }
    updateWallpaperModalActiveState(url);
  }
  window.setStageBackdrop = setStageBackdrop;

  function broadcastStageBackdrop(url) {
    setStageBackdrop(url, true);
    if (socket && socket.connected) {
      socket.emit('change-stage-backdrop', { backdrop: url });
    }
  }
  window.broadcastStageBackdrop = broadcastStageBackdrop;

  function updateWallpaperModalActiveState(activeUrl) {
    document.querySelectorAll('#wallpaper-presets-grid .wallpaper-card').forEach(card => {
      const isAct = card.getAttribute('data-url') === activeUrl;
      if (isAct) {
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function initWallpaperManager() {
    const wallpaperModal = document.getElementById('wallpaper-modal');
    const btnClose = document.getElementById('btn-close-wallpaper-modal');
    const btnStage = document.getElementById('btn-stage-wallpaper');
    const btnNav = document.getElementById('btn-nav-wallpaper');
    const btnApplyCustom = document.getElementById('btn-apply-custom-wallpaper');
    const inputCustom = document.getElementById('wallpaper-custom-url');
    const presetsGrid = document.getElementById('wallpaper-presets-grid');
    let lastActiveElementBeforeWallpaper = null;

    function openWallpaperModal() {
      if (wallpaperModal) {
        lastActiveElementBeforeWallpaper = document.activeElement;
        wallpaperModal.style.display = 'flex';
        wallpaperModal.setAttribute('aria-hidden', 'false');
        updateWallpaperModalActiveState(currentStageBackdrop);
        const focusable = wallpaperModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
          setTimeout(() => focusable[0].focus(), 50);
        }
      }
    }
    window.openWallpaperModal = openWallpaperModal;

    function closeWallpaperModal() {
      if (wallpaperModal) {
        wallpaperModal.style.display = 'none';
        wallpaperModal.setAttribute('aria-hidden', 'true');
        if (lastActiveElementBeforeWallpaper && typeof lastActiveElementBeforeWallpaper.focus === 'function') {
          lastActiveElementBeforeWallpaper.focus();
        }
      }
    }
    window.closeWallpaperModal = closeWallpaperModal;

    if (btnClose) btnClose.addEventListener('click', closeWallpaperModal);
    if (btnStage) btnStage.addEventListener('click', openWallpaperModal);
    if (btnNav) btnNav.addEventListener('click', openWallpaperModal);

    if (wallpaperModal) {
      wallpaperModal.addEventListener('click', (e) => {
        if (e.target === wallpaperModal) closeWallpaperModal();
      });
      wallpaperModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeWallpaperModal();
          return;
        }
        if (e.key === 'Tab') {
          const focusable = Array.from(wallpaperModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }

    if (presetsGrid) {
      presetsGrid.innerHTML = '';
      STAGE_WALLPAPER_PRESETS.forEach(preset => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wallpaper-card' + (preset.url === currentStageBackdrop ? ' active' : '');
        card.setAttribute('data-url', preset.url);
        card.setAttribute('aria-label', `${preset.name} wallpaper`);
        card.setAttribute('aria-pressed', preset.url === currentStageBackdrop ? 'true' : 'false');
        const thumb = preset.poster || preset.url;
        card.style.backgroundImage = `url('${thumb}')`;
        card.innerHTML = `
          <div class="wallpaper-card-scrim">
            <span class="wallpaper-card-name">${preset.name}</span>
          </div>
          <div class="wallpaper-card-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        `;
        card.addEventListener('click', () => {
          broadcastStageBackdrop(preset.url);
          closeWallpaperModal();
        });
        presetsGrid.appendChild(card);
      });
    }

    if (btnApplyCustom && inputCustom) {
      btnApplyCustom.addEventListener('click', () => {
        const url = inputCustom.value.trim();
        if (!url) return;
        broadcastStageBackdrop(url);
        inputCustom.value = '';
        closeWallpaperModal();
      });
      inputCustom.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          btnApplyCustom.click();
        }
      });
    }
  }

  // Ensure background video plays smoothly upon user interaction if browser blocked it
  const initBgVideoAutoplay = () => {
    const bgVideo = document.getElementById('room-bg-video');
    // On mobile screens, disable background video decoding to eliminate CPU/GPU lag
    if (window.innerWidth <= 900) {
      if (bgVideo) {
        bgVideo.pause();
        bgVideo.style.display = 'none';
      }
      return;
    }

    if (bgVideo && isVideoBackdrop(currentStageBackdrop)) {
      bgVideo.muted = true;
      const p = bgVideo.play();
      if (p !== undefined) {
        p.catch(() => {
          const resume = () => {
            if (window.innerWidth > 900 && !document.querySelector('.room-container.is-playing')) {
              bgVideo.play().catch(() => {});
            }
            window.removeEventListener('click', resume);
            window.removeEventListener('keydown', resume);
            window.removeEventListener('touchstart', resume);
          };
          window.addEventListener('click', resume, { once: true });
          window.addEventListener('keydown', resume, { once: true });
          window.addEventListener('touchstart', resume, { once: true });
        });
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    const bgVideo = document.getElementById('room-bg-video');
    if (!bgVideo) return;
    if (document.hidden) {
      if (!bgVideo.paused) bgVideo.pause();
    } else if (window.innerWidth > 900 && !document.querySelector('.room-container.is-playing')) {
      bgVideo.play().catch(() => {});
    }
  });

  // Immediately apply initial backdrop & initialize wallpaper manager
  setStageBackdrop(currentStageBackdrop, false);
  initWallpaperManager();
  initBgVideoAutoplay();

  function updateUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    const mobBadge = document.getElementById('mob-chat-badge');
    const countStr = unreadChatCount > 99 ? '99+' : String(unreadChatCount);

    if (badge) {
      if (unreadChatCount > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = countStr;
      } else {
        badge.style.display = 'none';
        badge.textContent = '0';
      }
    }

    if (mobBadge) {
      if (unreadChatCount > 0) {
        mobBadge.style.display = 'flex';
        mobBadge.textContent = countStr;
      } else {
        mobBadge.style.display = 'none';
        mobBadge.textContent = '0';
      }
    }
  }

  function updateUsersView(users) {
    renderUsers(users, webrtcManager, currentUser ? currentUser.id : null);
  }

  // Connect / Reconnect & Join Room
  socket.on('connect', () => {
    console.log('[SOCKET] Connected to room signaling server:', socket.id);
    socket.emit('join-room', {
      roomId,
      username,
      avatarColor: userColor
    });
    socket.emit('remote-browser-get-status');
    if (syncEngine) {
      syncEngine.requestSync();
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('[SOCKET] Disconnected from signaling server:', reason);
    if (window.showToast) {
      window.showToast('Connection interrupted. Auto-reconnecting to party...', 'warning', 4000);
    }
    if (syncEngine) {
      syncEngine.updateSyncBadge('syncing', 0);
    }
  });

  // Handle room joined welcome event
  socket.on('room-joined', (data) => {
    currentUser = {
      id: data.userId,
      username,
      avatarColor: userColor,
      isHost: data.isHost
    };
    window.currentUser = currentUser;

    currentUsersList = data.users;

    // Synchronize stage wallpaper from room state
    if (data.backdrop) {
      setStageBackdrop(data.backdrop, false);
    }

    // Synchronize active poll and cinema theme
    if (data.activePoll && typeof handlePollUpdate === 'function') {
      handlePollUpdate(data.activePoll);
    }
    const savedTheme = localStorage.getItem('zami_cinema_theme') || data.activeTheme || 'default';
    if (typeof setCinemaTheme === 'function') {
      setCinemaTheme(savedTheme, false);
    }

    // Initialize Sync Engine if not already initialized
    if (!syncEngine) {
      syncEngine = new window.SyncEngine(socket, window.universalPlayer);
    }
    window.syncEngine = syncEngine;
    syncEngine.setHostStatus(data.isHost, data.hostOnlyControls);

    // Initialize WebRTC Manager if not already initialized
    if (!webrtcManager) {
      webrtcManager = new window.WebRTCManager(socket);
      window.webrtcManager = webrtcManager;
    }
    if (webrtcManager && typeof webrtcManager.autoJoinOnRoomEntry === 'function') {
      webrtcManager.autoJoinOnRoomEntry();
    }

    if (data.screenShare && data.screenShare.active) {
      webrtcManager.activeScreenSharerId = data.screenShare.sharerId;
      webrtcManager.activeScreenSharerName = data.screenShare.sharerName;
      webrtcManager.activeScreenShareTitle = data.screenShare.title;
      webrtcManager.updateScreenshareUI();
    }

    // Initialize Shared Room Queue Manager
    if (window.RoomQueueManager) {
      if (!window.roomQueueManager) {
        window.roomQueueManager = new window.RoomQueueManager(socket);
      }
      if (data.playlist) {
        window.roomQueueManager.updatePlaylist(data.playlist);
      }
    }

    // Update UI elements
    updateHostControlsUI(data.isHost, data.hostOnlyControls);
    updateUsersView(data.users);

    // Load existing media if room has active video
    if (data.mediaSource && data.mediaSource.type !== 'empty') {
      if (data.mediaSource.type === 'screenshare') {
        const titleEl = document.getElementById('current-media-title');
        if (titleEl) titleEl.textContent = data.mediaSource.title || 'Live Screen / Tab Share';
        if (window.universalPlayer) {
          window.universalPlayer.activeType = 'screenshare';
          window.universalPlayer.showSpinner('CONNECTING TO LIVE CAST...');
        }
      } else {
        window.universalPlayer.loadSource(data.mediaSource);
        if (data.mediaSource.currentTime > 0) {
          window.universalPlayer.seek(data.mediaSource.currentTime, true);
        }
        if (data.mediaSource.isPlaying && data.mediaSource.type !== 'hls') {
          window.universalPlayer.play(true);
        }
        const titleEl = document.getElementById('current-media-title');
        if (titleEl) titleEl.textContent = data.mediaSource.title;
      }
    }

    // Populate chat history
    if (data.chatHistory && data.chatHistory.length) {
      data.chatHistory.forEach(msg => appendChatMessage(msg));
    }

    window.showToast(`Joined room "${roomId}" as ${username}!`, 'success');
  });

  // Handle live stage backdrop change from host/peer
  socket.on('stage-backdrop-changed', (data) => {
    if (data && data.backdrop) {
      setStageBackdrop(data.backdrop, true);
      if (data.changedBy && currentUser && data.changedBy !== currentUser.username) {
        if (window.showToast) {
          window.showToast(`${data.changedBy} updated stage wallpaper`, 'info', 3000);
        }
      }
    }
  });

  // Handle user joined
  socket.on('user-joined', ({ user, users }) => {
    currentUsersList = users;
    updateUsersView(users);
  });

  // Handle user left
  socket.on('user-left', ({ userId, username: leftName, users }) => {
    currentUsersList = users;
    updateUsersView(users);
  });

  // Handle peer AV status changes (mic mute/unmute, camera)
  socket.on('user-av-updated', ({ userId, isMuted, isCameraOn }) => {
    if (currentUsersList) {
      const u = currentUsersList.find(x => x.id === userId);
      if (u) {
        u.isMuted = isMuted;
        u.isCameraOn = isCameraOn;
      }
    }
    const tile = document.querySelector(`.peer-tile[data-peer-id="${userId}"]`);
    if (tile) {
      const micBadge = tile.querySelector('.peer-mic-status');
      if (micBadge) {
        micBadge.innerHTML = isMuted ? MIC_OFF_SVG : MIC_ON_SVG;
        micBadge.classList.toggle('muted', !!isMuted);
      }
      const videoEl = tile.querySelector('.peer-video');
      const avatarEl = tile.querySelector('.peer-avatar');
      if (isCameraOn) {
        if (videoEl && webrtcManager) {
          const isMe = currentUser && currentUser.id === userId;
          const stream = isMe ? webrtcManager.localStream : (webrtcManager.peers?.get(userId)?.videoStream);
          if (stream) {
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            if (avatarEl) avatarEl.style.display = 'none';
            videoEl.play().catch(() => {});
          }
        }
      } else {
        if (videoEl) {
          videoEl.style.display = 'none';
          videoEl.srcObject = null;
        }
        if (avatarEl) avatarEl.style.display = 'flex';
      }
    }
  });

  // Handle host transfer
  socket.on('host-transferred', ({ newHostId, newHostName, users }) => {
    currentUsersList = users;
    const isMeNewHost = currentUser && currentUser.id === newHostId;
    if (currentUser) currentUser.isHost = isMeNewHost;

    if (syncEngine) {
      syncEngine.setHostStatus(isMeNewHost, false);
    }
    updateHostControlsUI(isMeNewHost, false);
    updateUsersView(users);
    window.showToast(`[HOST] ${newHostName} is now the screening host.`, 'info');
  });

  // Handle host controls lock updated
  socket.on('host-controls-updated', ({ hostOnlyControls, updatedBy }) => {
    if (syncEngine) {
      syncEngine.hostOnlyControls = hostOnlyControls;
    }
    const isHost = currentUser && currentUser.isHost;
    updateHostControlsUI(isHost, hostOnlyControls);
  });

  // Chat receive
  socket.on('chat-message', (msg) => {
    appendChatMessage(msg);
    if (msg.type === 'user' && msg.userId !== socket.id) {
      if (activeSidebarTab !== 'chat') {
        unreadChatCount++;
        updateUnreadBadge();
      }
      if (window.reactionEngine) {
        window.reactionEngine.playSound('message');
      }
    }
  });

  // Emoji & Vector reaction receive
  socket.on('new-reaction', ({ emoji, sender }) => {
    if (window.reactionEngine) {
      window.reactionEngine.triggerReaction(emoji, currentUser && currentUser.username === sender);
    }
  });

  socket.on('room-reaction', ({ reactionType, sender }) => {
    if (window.reactionEngine) {
      window.reactionEngine.triggerReaction(reactionType, currentUser && currentUser.username === sender);
    }
  });

  // Watch Party Live Polls & Film Trivia
  socket.on('room-poll-update', (pollData) => {
    if (typeof handlePollUpdate === 'function') {
      handlePollUpdate(pollData);
    }
  });

  // Cinema Stage Theme
  socket.on('stage-theme-changed', ({ theme }) => {
    if (typeof setCinemaTheme === 'function') {
      setCinemaTheme(theme, false);
    }
  });

  // Rave-Style Synchronized Countdown (3... 2... 1... PLAY!)
  socket.on('sync-countdown-started', ({ seconds, startTime, initiator }) => {
    const overlay = document.getElementById('party-countdown-overlay');
    const numEl = document.getElementById('countdown-number');
    const labelEl = document.getElementById('countdown-label');
    if (!overlay || !numEl || !labelEl) return;

    overlay.style.display = 'flex';
    numEl.textContent = seconds;
    labelEl.textContent = `Sync initiated by ${initiator || 'Host'}...`;

    if (window.reactionEngine && window.reactionEngine.playSound) {
      window.reactionEngine.playSound('pop');
    }

    const timer = setInterval(() => {
      const remainingMs = startTime - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec > 0) {
        numEl.textContent = remainingSec;
        labelEl.textContent = remainingSec === 1 ? 'Get Ready!' : 'Starting Soon...';
        if (window.reactionEngine && window.reactionEngine.playSound) {
          window.reactionEngine.playSound('pop');
        }
      } else {
        clearInterval(timer);
        numEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> PLAY!</span>';
        labelEl.textContent = 'Synchronous Co-Watching Started!';
        if (window.reactionEngine && window.reactionEngine.playSound) {
          window.reactionEngine.playSound('cheer');
        }
        if (window.universalPlayer) {
          window.universalPlayer.play(true);
        }
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 1200);
      }
    }, 250);
  });

  // Error notifications
  socket.on('error-notice', (msg) => {
    window.showToast(msg, 'error');
  });

  // Chat message submission with IME-Safe Enter and Duplicate Prevention
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  let isChatSubmitting = false;

  if (chatForm && chatInput) {
    // IME-Safe Enter-to-Submit (modern-web-guidance)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        chatForm.requestSubmit();
      }
    });

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (isChatSubmitting) return;

      const text = chatInput.value.trim();
      if (!text) return;

      isChatSubmitting = true;
      socket.emit('send-chat', { text });
      chatInput.value = '';
      setTimeout(() => { isChatSubmitting = false; }, 200);
    });
  }

  // Party Soundboard Collapsible Tray Toggle
  const btnToggleSoundboard = document.getElementById('btn-toggle-soundboard');
  const soundboardTray = document.getElementById('soundboard-tray');
  if (btnToggleSoundboard && soundboardTray) {
    btnToggleSoundboard.addEventListener('click', (e) => {
      e.preventDefault();
      soundboardTray.classList.toggle('open');
      btnToggleSoundboard.classList.toggle('active', soundboardTray.classList.contains('open'));
    });
  }

  // Mobile Native Share Sheet Invite Button
  const btnMobileInvite = document.getElementById('btn-mobile-invite');
  if (btnMobileInvite) {
    btnMobileInvite.addEventListener('click', async (e) => {
      e.preventDefault();
      const shareData = {
        title: 'ZAMI Watch Party',
        text: 'Join my watch party on ZAMI!',
        url: window.location.href
      };
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.warn('Share error:', err);
        }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        if (window.showToast) window.showToast('Room link copied to clipboard!', 'success');
      }
    });
  }

  // Mobile Quick Mic Toggle in Subplayer Bar
  const btnMobileMicQuick = document.getElementById('btn-mobile-mic-quick');
  if (btnMobileMicQuick) {
    btnMobileMicQuick.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLocalMic();
      if (window.webrtcManager) {
        const isMuted = window.webrtcManager.isAudioMuted;
        btnMobileMicQuick.classList.toggle('mic-muted', isMuted);
        btnMobileMicQuick.classList.toggle('mic-live', !isMuted);
      }
    });
  }

  // Mobile Picture-in-Picture Toggle
  const btnMobilePip = document.getElementById('btn-mobile-pip');
  if (btnMobilePip) {
    btnMobilePip.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const video = document.querySelector('#player-container video, video');
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          if (window.showToast) window.showToast('Exited Picture-in-Picture', 'info');
        } else if (video && video.requestPictureInPicture) {
          await video.requestPictureInPicture();
          if (window.showToast) window.showToast('Entered Picture-in-Picture', 'success');
        } else if (video && video.webkitSetPresentationMode) {
          const mode = video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
          video.webkitSetPresentationMode(mode);
          if (window.showToast) window.showToast('Picture-in-Picture toggled', 'success');
        } else {
          if (window.showToast) window.showToast('Picture-in-Picture not supported on this browser', 'info');
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
    });
  }

  // Mobile Double-Tap to Seek (±10s) with clean vector ripple
  const playerWrapper = document.querySelector('.player-wrapper') || document.getElementById('player-container');
  if (playerWrapper) {
    let lastTapTime = 0;
    let lastTapX = 0;
    let tapTimeout = null;

    playerWrapper.addEventListener('touchend', (e) => {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (!isMobile) return;

      // Ignore touches on interactive controls
      if (e.target.closest('#custom-controls') || e.target.closest('button') || e.target.closest('input') || e.target.closest('.w2g-subplayer-bar')) return;

      const currentTime = Date.now();
      const tapLength = currentTime - lastTapTime;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = playerWrapper.getBoundingClientRect();
      const tapX = touch.clientX - rect.left;
      const relativeX = tapX / rect.width;

      if (tapLength < 320 && tapLength > 0 && Math.abs(tapX - lastTapX) < 80) {
        clearTimeout(tapTimeout);
        if (relativeX < 0.45) {
          // Left side -> Rewind 10s
          if (window.universalPlayer && typeof window.universalPlayer.seekRelative === 'function') {
            window.universalPlayer.seekRelative(-10);
          }
          showSeekRipple('left', '-10s');
        } else if (relativeX > 0.55) {
          // Right side -> Forward 10s
          if (window.universalPlayer && typeof window.universalPlayer.seekRelative === 'function') {
            window.universalPlayer.seekRelative(10);
          }
          showSeekRipple('right', '+10s');
        }
        lastTapTime = 0;
      } else {
        lastTapTime = currentTime;
        lastTapX = tapX;
        tapTimeout = setTimeout(() => {
          const controls = document.getElementById('custom-controls');
          if (controls && controls.style.display !== 'none') {
            controls.classList.toggle('active');
          }
        }, 330);
      }
    }, { passive: true });

    function showSeekRipple(side, text) {
      const ripple = document.createElement('div');
      ripple.className = `mobile-seek-ripple seek-ripple-${side}`;
      ripple.innerHTML = `
        <div class="seek-ripple-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${side === 'left' 
              ? '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>'
              : '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>'
            }
          </svg>
          <span>${text}</span>
        </div>
      `;
      playerWrapper.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    }
  }

  // Mobile Virtual Keyboard Viewport Anchoring (iOS Safari & Android Chrome)
  if (window.visualViewport) {
    let isKeyboardOpen = false;
    const onViewportChange = () => {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (!isMobile) return;

      const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
      const chatBar = document.getElementById('chat-form');
      const chatMessages = document.getElementById('chat-messages');

      if (keyboardHeight > 100) {
        isKeyboardOpen = true;
        if (chatBar) {
          chatBar.style.transform = `translateY(-${keyboardHeight}px)`;
        }
        if (chatMessages) {
          chatMessages.style.paddingBottom = `${keyboardHeight + 48}px`;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      } else if (isKeyboardOpen) {
        isKeyboardOpen = false;
        if (chatBar) chatBar.style.transform = '';
        if (chatMessages) chatMessages.style.paddingBottom = '';
      }
    };

    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }

  // Mobile Bottom Sheet Swipe-Down to Dismiss
  document.querySelectorAll('.w2g-modal-card, .wallpaper-modal-container, .cinema-hub-container').forEach(sheet => {
    let startY = 0;
    sheet.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });
    sheet.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 70) {
        const dialog = sheet.closest('dialog');
        if (dialog && typeof dialog.close === 'function') {
          dialog.close();
        } else {
          const overlay = sheet.closest('.modal-overlay, .wallpaper-modal-overlay');
          if (overlay) overlay.style.display = 'none';
        }
      }
    }, { passive: true });
  });

  // Quick Vector Reaction Cannon (Hotkey E / Quick Launcher)
  const reactionTypes = ['star', 'heart', 'flame', 'zap', 'clap', 'laugh', 'shock'];
  let currentReactionIdx = 0;

  window.triggerReactionCannon = function(type) {
    const reaction = type || reactionTypes[currentReactionIdx % reactionTypes.length];
    currentReactionIdx++;
    socket.emit('room-reaction', { reactionType: reaction });
    socket.emit('send-reaction', { emoji: reaction, reaction });
    if (window.reactionEngine) {
      window.reactionEngine.triggerReaction(reaction, true);
    }
  };

  const reactionButtons = document.querySelectorAll('.reaction-btn');
  reactionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reaction = btn.dataset.reaction || btn.dataset.emoji || 'star';
      window.triggerReactionCannon(reaction);
    });
  });

  // Party Soundboard Reactions
  const soundboardButtons = document.querySelectorAll('.btn-soundboard');
  soundboardButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const soundId = btn.dataset.sound;
      if (soundId && socket) {
        socket.emit('soundboard-play', { soundId });
        if (window.reactionEngine) {
          window.reactionEngine.playSound(soundId);
        }
      }
    });
  });

  // Unified Room Tab Switcher (Desktop Tabs + Mobile Icon Dock + Gesture Navigation)
  function switchRoomTab(targetTab, direction = null) {
    if (!ROOM_TABS.includes(targetTab)) return;
    activeSidebarTab = targetTab;

    if (activeSidebarTab === 'chat') {
      unreadChatCount = 0;
      updateUnreadBadge();
    }

    // Update Desktop Tabs
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });

    // Update Mobile Bottom Dock Buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      if (btn.dataset.tab) {
        btn.classList.toggle('active', btn.dataset.tab === targetTab);
      }
    });

    // Switch Panes with Directional Animations
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active', 'slide-from-left', 'slide-from-right');
    });

    const activePane = document.getElementById(`tab-pane-${targetTab}`);
    if (activePane) {
      activePane.classList.add('active');
      if (direction === 'next') {
        activePane.classList.add('slide-from-right');
      } else if (direction === 'prev') {
        activePane.classList.add('slide-from-left');
      }
    }

    // Scroll chat to bottom when switching to chat
    if (targetTab === 'chat') {
      const chatMsgs = document.getElementById('chat-messages');
      if (chatMsgs) {
        requestAnimationFrame(() => {
          chatMsgs.scrollTop = chatMsgs.scrollHeight;
        });
      }
    }

    // Modern micro-haptic feedback
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch (e) {}
    }
  }
  window.switchRoomTab = switchRoomTab;
  window.getActiveSidebarTab = () => activeSidebarTab;

  // Sidebar Tab Click Listeners (Desktop)
  document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchRoomTab(btn.dataset.tab);
    });
  });

  // Mobile Icon-Only Bottom Navigation Dock
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      const action = btn.dataset.action;

      if (tab) {
        switchRoomTab(tab);
      } else if (action === 'media') {
        const modal = document.getElementById('media-modal');
        if (modal) {
          modal.classList.add('active');
          modal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('menu');
        }
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try { navigator.vibrate(12); } catch (e) {}
        }
      }
    });
  });

  // Native Gesture Navigation: Smooth horizontal swipe between Chat ↔ People ↔ Queue
  (function initMobileGestureNav() {
    const swipeSurface = document.getElementById('room-sidebar') || document.getElementById('room-body-container');
    if (!swipeSurface) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isSwiping = false;

    swipeSurface.addEventListener('touchstart', (e) => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;
      // Do not intercept taps on video stage, form controls, or horizontal soundboard
      if (e.target.closest('#room-stage, input, textarea, select, button, .soundboard-buttons, .modal-overlay')) {
        return;
      }
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      touchStartTime = Date.now();
      isSwiping = true;
    }, { passive: true });

    swipeSurface.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      if (!touch) return;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      const diffX = lastTouchX - touchStartX;
      const diffY = lastTouchY - touchStartY;

      // Only cancel if vertical scrolling is significant and clearly dominant
      if (Math.abs(diffY) > 20 && Math.abs(diffY) > Math.abs(diffX) * 1.3) {
        isSwiping = false;
      }
    }, { passive: true });

    function handleTouchEnd(e) {
      if (!isSwiping) return;
      isSwiping = false;

      const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      const endX = touch ? touch.clientX : lastTouchX;
      const endY = touch ? touch.clientY : lastTouchY;

      const diffX = endX - touchStartX;
      const diffY = endY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      // Minimum swipe distance: 35px, predominantly horizontal, completed within 600ms
      if (Math.abs(diffX) >= 35 && Math.abs(diffX) > Math.abs(diffY) * 1.15 && elapsed < 600) {
        const curIdx = ROOM_TABS.indexOf(activeSidebarTab);
        if (diffX < 0) {
          // Swipe Left -> next tab
          if (curIdx >= 0 && curIdx < ROOM_TABS.length - 1) {
            switchRoomTab(ROOM_TABS[curIdx + 1], 'next');
          }
        } else {
          // Swipe Right -> previous tab
          if (curIdx > 0) {
            switchRoomTab(ROOM_TABS[curIdx - 1], 'prev');
          }
        }
      }
    }

    swipeSurface.addEventListener('touchend', handleTouchEnd, { passive: true });
    swipeSurface.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  })();

  // Sound effects toggle button
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  if (btnToggleSound && window.reactionEngine) {
    const updateSoundBtn = () => {
      btnToggleSound.innerHTML = window.reactionEngine.soundEnabled ? BELL_ON_SVG : BELL_OFF_SVG;
      btnToggleSound.title = window.reactionEngine.soundEnabled
        ? 'Sound Effects Enabled (Click to Mute)'
        : 'Sound Effects Muted (Click to Unmute)';
    };
    updateSoundBtn();
    btnToggleSound.addEventListener('click', () => {
      const enabled = window.reactionEngine.toggleSound();
      updateSoundBtn();
      window.showToast(enabled ? 'Sound effects enabled' : 'Sound effects muted', 'info', 1500);
    });
  }

  // Social Lounge Sidebar (Always Visible on Screen)
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const roomSidebar = document.getElementById('room-sidebar');
  if (roomSidebar) {
    roomSidebar.classList.remove('collapsed');
  }
  if (btnToggleSidebar && roomSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      const chatTab = document.querySelector('.sidebar-tab-btn[data-tab="chat"]');
      if (chatTab) chatTab.click();
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.focus();
    });
  }

  // Left Navigation Rail handlers
  const railBtnVault = document.getElementById('rail-btn-vault');
  if (railBtnVault) {
    railBtnVault.addEventListener('click', () => {
      const modal = document.getElementById('media-modal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        if (typeof window.showVaultView === 'function') {
          window.showVaultView('trending');
        }
      }
    });
  }

  const railBtnQueue = document.getElementById('rail-btn-queue');
  if (railBtnQueue) {
    railBtnQueue.addEventListener('click', () => {
      if (roomSidebar && roomSidebar.classList.contains('collapsed')) {
        roomSidebar.classList.remove('collapsed');
      }
      const queueTabBtn = document.querySelector('.sidebar-tab-btn[data-tab="queue"]');
      if (queueTabBtn) queueTabBtn.click();
    });
  }

  const railBtnHistory = document.getElementById('rail-btn-history');
  if (railBtnHistory) {
    railBtnHistory.addEventListener('click', () => {
      window.showToast('Screening Room History: Session active and synchronizing live with peers.', 'info');
    });
  }

  const railBtnStage = document.querySelector('.rail-btn[data-rail="stage"]');
  if (railBtnStage) {
    railBtnStage.addEventListener('click', () => {
      const modal = document.getElementById('media-modal');
      const btnClose = document.getElementById('btn-close-modal');
      if (modal && modal.classList.contains('active') && btnClose) {
        btnClose.click();
      }
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
      railBtnStage.classList.add('active');
    });
  }

  // Theme toggle button on rail
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.themeManager) {
        const nextTheme = window.themeManager.toggleTheme();
        window.showToast(`Theme switched to ${nextTheme === 'noir' ? 'Cinematic Noir' : 'Warm Lounge'}`, 'info', 1500);
      }
    });
  });

  // Stage Hero Featured Buttons
  const btnHeroPlay = document.getElementById('btn-hero-play-featured');
  if (btnHeroPlay) {
    btnHeroPlay.addEventListener('click', () => {
      const btnOpenModal = document.getElementById('btn-change-media');
      if (btnOpenModal) btnOpenModal.click();
      const curatedTab = document.querySelector('.hub-nav-tab[data-tab="curated"]');
      if (curatedTab) curatedTab.click();
    });
  }

  const btnHeroVault = document.getElementById('btn-hero-open-vault');
  if (btnHeroVault) {
    btnHeroVault.addEventListener('click', () => {
      const btnOpenModal = document.getElementById('btn-change-media');
      if (btnOpenModal) btnOpenModal.click();
    });
  }

  // Stage Direct Video Stream quick bar
  const stageQuickForm = document.getElementById('stage-url-quick-form');
  const stageQuickInput = document.getElementById('stage-url-quick-input');
  if (stageQuickForm && stageQuickInput) {
    stageQuickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = stageQuickInput.value.trim();
      if (!raw) return;
      handleLoadDirectStream(raw, 'Direct Video Stream');
    });
  }

  // Invite Share Helper (Native Mobile Share or Clipboard)
  const triggerInviteShare = () => {
    const fullUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Join my ZAMI Watch Party',
        text: 'Join my synchronized watch party room on ZAMI!',
        url: fullUrl
      }).catch(() => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(fullUrl).then(() => {
            window.showToast('Room link copied to clipboard! Share it with friends.', 'success');
          });
        }
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        window.showToast('Room link copied to clipboard! Share it with friends.', 'success');
      }).catch(() => {
        prompt('Copy room link:', fullUrl);
      });
    } else {
      prompt('Copy room link:', fullUrl);
    }
  };

  // Wire Invite Buttons (Header, Empty Stage, Mobile Header)
  const btnCopyLink = document.getElementById('btn-copy-link');
  if (btnCopyLink) btnCopyLink.addEventListener('click', triggerInviteShare);

  const btnEmptyStageInvite = document.getElementById('btn-empty-stage-invite');
  if (btnEmptyStageInvite) btnEmptyStageInvite.addEventListener('click', triggerInviteShare);

  if (btnMobileInvite) btnMobileInvite.addEventListener('click', triggerInviteShare);

  // Wire First Watch Hub Direct Choices
  const btnStageMovies = document.getElementById('btn-stage-choice-movies');
  if (btnStageMovies) {
    btnStageMovies.addEventListener('click', () => {
      if (typeof window.openModal === 'function') window.openModal(btnStageMovies);
      if (typeof window.showVaultView === 'function') window.showVaultView('movies');
    });
  }

  const btnStageLink = document.getElementById('btn-stage-choice-link');
  if (btnStageLink) {
    btnStageLink.addEventListener('click', () => {
      if (typeof window.openModal === 'function') window.openModal(btnStageLink);
      if (typeof window.showVaultView === 'function') window.showVaultView('url');
      const inputUrl = document.getElementById('input-direct-url');
      if (inputUrl) setTimeout(() => inputUrl.focus(), 100);
    });
  }

  const btnStageMore = document.getElementById('btn-stage-choice-more');
  if (btnStageMore) {
    btnStageMore.addEventListener('click', () => {
      if (typeof window.openModal === 'function') window.openModal(btnStageMore);
      if (typeof window.showVaultView === 'function') window.showVaultView('menu');
    });
  }

  const btnStageBrowserChoice = document.getElementById('btn-stage-choice-browser');
  if (btnStageBrowserChoice) {
    btnStageBrowserChoice.addEventListener('click', () => {
      if (typeof window.openInbuiltBrowser === 'function') {
        window.openInbuiltBrowser('https://www.google.com');
      }
    });
  }

  const btnMobileBrowserQuickBar = document.getElementById('btn-mobile-browser-quick');
  if (btnMobileBrowserQuickBar) {
    btnMobileBrowserQuickBar.addEventListener('click', () => {
      if (typeof window.openInbuiltBrowser === 'function') {
        window.openInbuiltBrowser('https://www.google.com');
      }
    });
  }

  // Room Settings Modal Controller
  const btnNavSettings = document.getElementById('btn-nav-settings');
  const btnMobileSettings = document.getElementById('btn-mobile-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings-modal');
  const settingsRoomUrl = document.getElementById('settings-room-url');
  const btnCopySettingsLink = document.getElementById('btn-copy-settings-link');
  const btnToggleHostControls = document.getElementById('btn-toggle-host-controls');
  const hostControlsStatusText = document.getElementById('host-controls-status-text');
  const roomSettingsNickname = document.getElementById('room-settings-nickname');
  const currentDisplayNamePill = document.getElementById('current-display-name-pill');
  const btnSaveRoomNickname = document.getElementById('btn-save-room-nickname');
  let lastActiveElementBeforeSettings = null;

  function openSettingsModal(opener) {
    if (settingsModal) {
      lastActiveElementBeforeSettings = (opener instanceof Element) ? opener : (document.activeElement instanceof Element ? document.activeElement : null);
      if (settingsRoomUrl) settingsRoomUrl.value = window.location.href;
      if (hostControlsStatusText) {
        const isHostLock = syncEngine && syncEngine.hostOnlyControls;
        hostControlsStatusText.textContent = isHostLock ? 'Enabled (Host Only)' : 'Disabled (Everyone)';
      }
      const curName = (currentUser && currentUser.name) || localStorage.getItem('zami_username') || 'Viewer';
      if (roomSettingsNickname) roomSettingsNickname.value = curName;
      if (currentDisplayNamePill) currentDisplayNamePill.textContent = curName;

      settingsModal.style.display = 'flex';
      settingsModal.setAttribute('aria-hidden', 'false');
      const focusable = settingsModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }
    }
  }
  window.openSettingsModal = openSettingsModal;

  function closeSettingsModal() {
    if (settingsModal) {
      settingsModal.style.display = 'none';
      settingsModal.setAttribute('aria-hidden', 'true');
      if (lastActiveElementBeforeSettings && typeof lastActiveElementBeforeSettings.focus === 'function') {
        lastActiveElementBeforeSettings.focus();
        lastActiveElementBeforeSettings = null;
      }
    }
  }
  window.closeSettingsModal = closeSettingsModal;

  function saveRoomNickname() {
    if (!roomSettingsNickname) return;
    const newName = roomSettingsNickname.value.trim();
    if (!newName) {
      window.showToast('Please enter a valid display name', 'warning');
      return;
    }
    localStorage.setItem('zami_username', newName);
    localStorage.setItem('cinesync_username', newName);
    if (currentUser) currentUser.name = newName;
    if (currentDisplayNamePill) currentDisplayNamePill.textContent = newName;
    if (socket && socket.connected) {
      socket.emit('update-profile', { name: newName });
    }
    window.showToast(`Display name updated to "${newName}"`, 'success');
  }

  if (btnSaveRoomNickname) btnSaveRoomNickname.addEventListener('click', saveRoomNickname);
  if (roomSettingsNickname) {
    roomSettingsNickname.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveRoomNickname();
    });
  }

  if (btnNavSettings) btnNavSettings.addEventListener('click', () => openSettingsModal(btnNavSettings));
  if (btnMobileSettings) btnMobileSettings.addEventListener('click', () => openSettingsModal(btnMobileSettings));
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
    settingsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSettingsModal();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(settingsModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  if (btnCopySettingsLink) {
    btnCopySettingsLink.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        window.showToast('Invite link copied!', 'success');
      });
    });
  }

  if (btnToggleHostControls) {
    btnToggleHostControls.addEventListener('click', () => {
      if (!currentUser || !currentUser.isHost) {
        window.showToast('Only the room host can change control permissions.', 'warning');
        return;
      }
      if (socket) {
        socket.emit('toggle-host-controls');
      }
    });
  }

  // Stage Chat HUD Settings
  let isStageChatEnabled = localStorage.getItem('zami_stage_chat_enabled') !== 'false';
  let stageChatOpacity = parseFloat(localStorage.getItem('zami_stage_chat_opacity')) || 0.85;

  const btnToggleStageChat = document.getElementById('btn-toggle-stage-chat');
  const stageChatStatusText = document.getElementById('stage-chat-status-text');
  const settingsStageChatOpacity = document.getElementById('settings-stage-chat-opacity');
  const settingsStageChatOpacityVal = document.getElementById('settings-stage-chat-opacity-val');

  function applyStageChatSettings() {
    window.isStageChatDisabled = !isStageChatEnabled;
    const stageChatContainer = document.getElementById('stage-floating-chat');
    if (stageChatContainer) {
      stageChatContainer.classList.toggle('hud-disabled', !isStageChatEnabled);
    }
    document.documentElement.style.setProperty('--stage-chat-opacity', stageChatOpacity);

    if (btnToggleStageChat && stageChatStatusText) {
      btnToggleStageChat.classList.toggle('active', isStageChatEnabled);
      stageChatStatusText.textContent = isStageChatEnabled ? 'Enabled' : 'Disabled';
    }

    if (settingsStageChatOpacity) settingsStageChatOpacity.value = stageChatOpacity;
    if (settingsStageChatOpacityVal) settingsStageChatOpacityVal.textContent = `${Math.round(stageChatOpacity * 100)}%`;
  }

  window.toggleStageChatHUD = function(force) {
    isStageChatEnabled = force !== undefined ? !!force : !isStageChatEnabled;
    localStorage.setItem('zami_stage_chat_enabled', isStageChatEnabled);
    applyStageChatSettings();
    if (window.showToast) {
      window.showToast(`Stage Chat HUD: ${isStageChatEnabled ? 'Enabled' : 'Disabled'}`, 'info', 2000);
    }
    return isStageChatEnabled;
  };

  if (btnToggleStageChat) {
    btnToggleStageChat.addEventListener('click', () => {
      window.toggleStageChatHUD();
    });
  }

  if (settingsStageChatOpacity) {
    settingsStageChatOpacity.addEventListener('input', (e) => {
      stageChatOpacity = parseFloat(e.target.value) || 0.85;
      localStorage.setItem('zami_stage_chat_opacity', stageChatOpacity);
      applyStageChatSettings();
    });
  }

  applyStageChatSettings();

  // Host Lock Controls Button
  const btnHostLock = document.getElementById('btn-toggle-host-controls') || document.getElementById('btn-toggle-host-lock');
  if (btnHostLock) {
    btnHostLock.addEventListener('click', () => {
      if (!currentUser || !currentUser.isHost) {
        window.showToast('Only the host can toggle playback control restrictions.', 'error');
        return;
      }
      socket.emit('toggle-host-controls');
    });
  }

  // Full-Screen Cinema Discovery Hub
  setupCinemaDiscoveryHub(socket);

  // Rave Inbuilt Streaming Suite
  initRaveSuite(socket, roomId);

  // 1. Cinema / Theater Mode State & Toggles
  function initTheaterMode() {
    const roomContainer = document.querySelector('.room-container');
    const btnTheaterStage = document.getElementById('ctrl-theater');
    const btnTheaterNav = document.getElementById('btn-theater-mode');

    function setTheaterMode(enabled) {
      if (!roomContainer) return;
      if (enabled) {
        roomContainer.classList.add('theater-mode');
        if (btnTheaterStage) {
          btnTheaterStage.classList.add('active');
          btnTheaterStage.setAttribute('aria-pressed', 'true');
        }
        if (btnTheaterNav) {
          btnTheaterNav.classList.add('active');
          btnTheaterNav.setAttribute('aria-pressed', 'true');
        }
        localStorage.setItem('zami_theater_mode', 'true');
        if (window.showToast) window.showToast('Cinema Stage Focus active', 'info', 2000);
      } else {
        roomContainer.classList.remove('theater-mode');
        if (btnTheaterStage) {
          btnTheaterStage.classList.remove('active');
          btnTheaterStage.setAttribute('aria-pressed', 'false');
        }
        if (btnTheaterNav) {
          btnTheaterNav.classList.remove('active');
          btnTheaterNav.setAttribute('aria-pressed', 'false');
        }
        localStorage.setItem('zami_theater_mode', 'false');
        if (window.showToast) window.showToast('Standard View active', 'info', 1500);
      }
    }

    function toggleTheaterMode() {
      if (!roomContainer) return;
      const isCurrentlyTheater = roomContainer.classList.contains('theater-mode');
      setTheaterMode(!isCurrentlyTheater);
    }
    window.toggleTheaterMode = toggleTheaterMode;

    if (btnTheaterStage) {
      btnTheaterStage.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTheaterMode();
      });
    }
    if (btnTheaterNav) {
      btnTheaterNav.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTheaterMode();
      });
    }

    // Default to clean standard view with chat docked and visible
    localStorage.removeItem('zami_theater_mode');
    setTheaterMode(false);
  }
  initTheaterMode();

  // 2. Live Stream Telemetry & Latency HUD
  function initTelemetryHUD(sock) {
    const telemetryPill = document.getElementById('stage-telemetry-pill');
    const pingText = document.getElementById('telemetry-ping-text');
    const qualityText = document.getElementById('telemetry-quality-text');
    const dot = document.getElementById('telemetry-dot');

    if (!telemetryPill || !pingText || !dot) return;

    function updatePingDisplay(rtt) {
      pingText.textContent = `${rtt}ms`;
      dot.className = 'telemetry-dot';
      if (rtt <= 60) {
        dot.classList.add('live-dot-green');
      } else if (rtt <= 150) {
        dot.classList.add('live-dot-amber');
      } else {
        dot.classList.add('live-dot-red');
      }
    }

    function syncQualityDisplay(label) {
      if (qualityText && label) {
        qualityText.textContent = label;
      }
    }
    window.syncTelemetryQuality = syncQualityDisplay;

    function ping() {
      if (!sock || !sock.connected) {
        dot.className = 'telemetry-dot live-dot-red';
        pingText.textContent = '--';
        return;
      }
      const clientStart = Date.now();
      sock.emit('client-ping', clientStart, (serverEcho) => {
        const rtt = Math.max(1, Date.now() - (serverEcho || clientStart));
        updatePingDisplay(rtt);
      });
    }

    setInterval(ping, 4000);
    setTimeout(ping, 800);

    // Sync quality on select change
    const qualitySelect = document.getElementById('ctrl-quality-toggle');
    if (qualitySelect) {
      qualitySelect.addEventListener('change', () => {
        const val = qualitySelect.value;
        syncQualityDisplay(val === '1080p' ? '1080p HD' : (val ? val.toUpperCase() : '1080p HD'));
      });
    }
    const bQualityToggle = document.getElementById('btn-remote-quality-toggle') || document.getElementById('btn-browser-quality-toggle');
    if (bQualityToggle) {
      bQualityToggle.addEventListener('click', () => {
        setTimeout(() => {
          const txt = bQualityToggle.textContent.trim();
          syncQualityDisplay(txt.includes('1080') ? '1080p HD' : txt);
        }, 150);
      });
    }
  }
  initTelemetryHUD(socket);

  // 3. Interactive Keyboard Shortcuts Modal
  function initShortcutsModal() {
    const dialog = document.getElementById('shortcuts-modal');
    const btnOpen = document.getElementById('btn-nav-shortcuts');
    const btnClose = document.getElementById('btn-close-shortcuts-modal');
    let lastActiveOpenerShortcuts = null;

    if (!dialog) return;

    function openModal(opener) {
      lastActiveOpenerShortcuts = (opener instanceof Element) ? opener : (document.activeElement instanceof Element ? document.activeElement : null);
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      const focusable = dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 40);
      }
    }

    function closeModal() {
      if (typeof dialog.close === 'function') {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      if (lastActiveOpenerShortcuts && typeof lastActiveOpenerShortcuts.focus === 'function') {
        lastActiveOpenerShortcuts.focus();
        lastActiveOpenerShortcuts = null;
      }
    }

    function toggleModal(opener) {
      if (dialog.open) {
        closeModal();
      } else {
        openModal(opener);
      }
    }
    window.toggleShortcutsModal = toggleModal;
    window.openShortcutsModal = openModal;
    window.closeShortcutsModal = closeModal;

    if (btnOpen) {
      btnOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModal(btnOpen);
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    }

    // Tab trap and Escape handling inside shortcuts dialog
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Light-dismiss click outside dialog content box
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!inDialog) {
        closeModal();
      }
    });
  }
  initShortcutsModal();

  // 4. Comprehensive Global Keyboard Shortcuts Handler
  function initGlobalShortcuts() {
    function isInteractiveOrInDialog(target) {
      if (!target) return false;
      const el = target instanceof Element ? target : target.parentElement;
      if (!el) return false;
      if (el.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]')) {
        return true;
      }
      if (el.closest('dialog[open], [role="dialog"], .modal-overlay:not([style*="display: none"]), .wallpaper-modal-overlay:not([style*="display: none"]), .w2g-search-drawer:not([style*="display: none"])')) {
        return true;
      }
      if (document.querySelector('dialog[open], .modal-overlay:not([style*="display: none"]), .wallpaper-modal-overlay:not([style*="display: none"]), .w2g-search-drawer:not([style*="display: none"])')) {
        return true;
      }
      const remoteCanvas = document.getElementById('remote-browser-canvas');
      if (remoteCanvas && (document.activeElement === remoteCanvas || remoteCanvas.contains(el))) {
        return true;
      }
      return false;
    }

    document.addEventListener('keydown', (e) => {
      // If typing in an interactive form input, button, or dialog, ignore shortcuts except Escape
      if (isInteractiveOrInDialog(e.target)) {
        if (e.key === 'Escape') {
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            e.target.blur();
          }
          const openSearch = document.getElementById('w2g-search-drawer');
          if (openSearch && openSearch.style.display !== 'none' && window.closeSearchDrawer) {
            window.closeSearchDrawer();
          }
          const shortcutsDialog = document.getElementById('shortcuts-modal');
          if (shortcutsDialog && shortcutsDialog.open && window.closeShortcutsModal) {
            window.closeShortcutsModal();
          }
          const settingsModal = document.getElementById('settings-modal');
          if (settingsModal && settingsModal.style.display !== 'none' && window.closeSettingsModal) {
            window.closeSettingsModal();
          }
          const wallpaperModal = document.getElementById('wallpaper-modal');
          if (wallpaperModal && wallpaperModal.style.display !== 'none' && window.closeWallpaperModal) {
            window.closeWallpaperModal();
          }
          const inviteDialog = document.getElementById('w2g-invite-dialog');
          if (inviteDialog && (inviteDialog.open || inviteDialog.hasAttribute('open')) && window.closeInviteDialog) {
            window.closeInviteDialog();
          }
          const mediaModal = document.getElementById('media-modal');
          if (mediaModal && mediaModal.classList.contains('active') && window.closeModal) {
            window.closeModal();
          }
        }
        return;
      }

      // Check for modifier keys (allow browser reload, inspector, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key;

      // ? or Shift + / -> Shortcuts Cheat Sheet
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        if (window.toggleShortcutsModal) window.toggleShortcutsModal();
        return;
      }

      // T / t -> Cinema Theater Mode
      if (key === 't' || key === 'T') {
        e.preventDefault();
        if (window.toggleTheaterMode) window.toggleTheaterMode();
        return;
      }

      // P / p -> Universal Picture-in-Picture
      if (key === 'p' || key === 'P') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.togglePiP === 'function') {
          window.universalPlayer.togglePiP();
        }
        return;
      }

      // F / f -> Fullscreen
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.toggleFullscreen === 'function') {
          window.universalPlayer.toggleFullscreen();
        }
        return;
      }

      // M / m -> Mute / Unmute
      if (key === 'm' || key === 'M') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.toggleMute === 'function') {
          window.universalPlayer.toggleMute();
        }
        return;
      }

      // A / a -> App Switcher Popover
      if (key === 'a' || key === 'A') {
        e.preventDefault();
        if (window.toggleBrowserAppsMenu) {
          window.toggleBrowserAppsMenu();
        } else {
          const btn = document.getElementById('btn-browser-apps-toggle');
          if (btn) btn.click();
        }
        return;
      }

      // C / c -> Toggle Stage Chat HUD Overlay
      if (key === 'c' || key === 'C') {
        e.preventDefault();
        if (window.toggleStageChatHUD) window.toggleStageChatHUD();
        return;
      }

      // S / s -> 1-Click Stage Snapshot
      if (key === 's' || key === 'S') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.takeStageSnapshot === 'function') {
          window.universalPlayer.takeStageSnapshot();
        }
        return;
      }

      // B / b -> Dynamic Cinema Ambilight Cycle
      if (key === 'b' || key === 'B') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.cycleAmbilightMode === 'function') {
          window.universalPlayer.cycleAmbilightMode();
        }
        return;
      }

      // E / e -> Reaction Cannon Burst
      if (key === 'e' || key === 'E') {
        e.preventDefault();
        if (window.triggerReactionCannon) {
          window.triggerReactionCannon();
        }
        return;
      }

      // K / k or Space -> Play / Pause
      if (key === 'k' || key === 'K' || key === ' ') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.togglePlay === 'function') {
          window.universalPlayer.togglePlay();
        }
        return;
      }

      // ArrowLeft -> Rewind 10s
      if (key === 'ArrowLeft') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.seekRelative === 'function') {
          window.universalPlayer.seekRelative(-10);
        }
        return;
      }

      // ArrowRight -> Forward 10s
      if (key === 'ArrowRight') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.seekRelative === 'function') {
          window.universalPlayer.seekRelative(10);
        }
        return;
      }

      // ArrowUp -> Volume +5%
      if (key === 'ArrowUp') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.adjustVolume === 'function') {
          window.universalPlayer.adjustVolume(0.05);
        }
        return;
      }

      // ArrowDown -> Volume -5%
      if (key === 'ArrowDown') {
        e.preventDefault();
        if (window.universalPlayer && typeof window.universalPlayer.adjustVolume === 'function') {
          window.universalPlayer.adjustVolume(-0.05);
        }
        return;
      }

      // 0 - 9 -> Seek percentage (0% to 90%)
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        const percent = parseInt(key, 10) * 10;
        if (window.universalPlayer && typeof window.universalPlayer.seekToPercent === 'function') {
          window.universalPlayer.seekToPercent(percent);
        }
        return;
      }

      // Escape -> Close shortcuts modal or app popover if open
      if (key === 'Escape') {
        const dialog = document.getElementById('shortcuts-modal');
        if (dialog && dialog.open) {
          e.preventDefault();
          if (window.closeShortcutsModal) window.closeShortcutsModal();
        }
        if (window.closeBrowserAppsMenu) {
          window.closeBrowserAppsMenu();
        }
      }
    });
  }
  initGlobalShortcuts();

  // Vault Category Filter Toggles
  document.querySelectorAll('.vault-filter-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.vault-view');
      const pills = parent ? parent.querySelector('.vault-pills-row') : null;
      if (pills) {
        const isHidden = window.getComputedStyle(pills).display === 'none';
        pills.style.display = isHidden ? 'flex' : 'none';
      }
    });
  });
});

/**
 * Setup Full-Screen Cinema Discovery Hub
 */
function setupCinemaDiscoveryHub(socket) {
  const modal = document.getElementById('media-modal');
  const btnOpenModal = document.getElementById('btn-change-media') || document.getElementById('btn-empty-stage-load');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const drawer = document.getElementById('film-detail-drawer');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');

  if (!modal) return;

  let curatedLoaded = false;
  let activeTab = 'curated';
  let activeSearchFilter = 'all';
  let searchTimer = null;
  let currentDrawerDetails = null;
  let currentDrawerServers = [];
  let selectedServerIndex = 0;
  let currentSelectedSeason = 1;
  let currentSelectedEpisode = 1;

  let lastActiveElementBeforeModal = null;

  const openModal = (opener) => {
    lastActiveElementBeforeModal = opener || document.activeElement;
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    const focusable = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }
  };

  const closeModal = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    const hubContainer = document.getElementById('cinema-hub-container');
    if (hubContainer) hubContainer.classList.remove('youtube-sheet-mode');
    closeDrawer();
    if (lastActiveElementBeforeModal && typeof lastActiveElementBeforeModal.focus === 'function') {
      lastActiveElementBeforeModal.focus();
    }
  };

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.openModal = openModal;
  window.closeModal = closeModal;

  const openDrawer = () => {
    if (drawer) drawer.classList.add('open');
  };

  const closeDrawer = () => {
    if (drawer) drawer.classList.remove('open');
  };

  // Exact Reference Popular Movies Catalog
  const REFERENCE_POPULAR_MOVIES = [
    { tmdbId: 693134, title: 'Dune Part Two', year: '2024', rating: '8.6', poster: '/img/posters/dune2.jpg' },
    { tmdbId: 533535, title: 'Deadpool & Wolverine', year: '2024', rating: '8.1', poster: '/img/posters/deadpool.jpg' },
    { tmdbId: 1022789, title: 'Inside Out 2', year: '2024', rating: '8.0', poster: '/img/posters/insideout2.jpg' },
    { tmdbId: 801688, title: 'Kalki 2898 AD', year: '2024', rating: '7.9', poster: '/img/posters/kalki.jpg' },
    { tmdbId: 414906, title: 'The Batman', year: '2022', rating: '7.8', poster: '/img/posters/batman.jpg' },
    { tmdbId: 157336, title: 'Interstellar', year: '2014', rating: '8.7', poster: '/img/posters/interstellar.jpg' }
  ];

  function renderMovieGrid(items) {
    const grid = document.getElementById('movies-catalog-grid');
    if (!grid) return;
    grid.innerHTML = items.map(m => `
      <article class="movie-poster-card" data-tmdb-id="${m.tmdbId || m.id}" data-title="${escapeHtml(m.title)}" data-year="${m.year || ''}" data-rating="${m.rating || '8.0'}" data-poster="${m.poster || ''}">
        <div class="movie-poster-wrap">
          <img src="${m.poster || 'https://via.placeholder.com/300x450?text=No+Poster'}" alt="${escapeHtml(m.title)}" class="movie-poster-img" loading="lazy">
        </div>
        <div class="movie-poster-info">
          <h4 class="movie-poster-title">${escapeHtml(m.title)}</h4>
          <div class="movie-poster-meta">
            <span class="movie-year">${m.year || ''}</span>
            <span class="movie-rating"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${m.rating || '8.0'}</span>
          </div>
        </div>
      </article>
    `).join('');
  }

  async function streamMovieFromCard(tmdbId, title, poster, year) {
    closeModal();
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
    if (window.universalPlayer) {
      window.universalPlayer.showSpinner(`CONNECTING: ${title.toUpperCase()}...`);
    }
    window.showToast(`Connecting stream for "${title}"...`, 'info', 3000);
    try {
      const res = await fetch(`/api/stream/resolve?id=${tmdbId}&type=movie`);
      const data = await res.json();
      if (data.success && data.streamUrl) {
        socket.emit('change-media', {
          type: 'hls',
          url: data.streamUrl,
          streams: data.streams,
          title: title,
          poster: poster,
          year: year,
          isPlaying: true
        });
        window.showToast(`Now screening: ${title}`, 'success');
        return;
      }
      socket.emit('change-media', {
        type: 'embed',
        url: `https://vidsrc.sh/embed/movie?tmdb=${tmdbId}`,
        title: title,
        poster: poster,
        year: year,
        isPlaying: true
      });
      window.showToast(`Now screening: ${title} (Cloud Embed)`, 'info');
    } catch (err) {
      if (window.universalPlayer) window.universalPlayer.hideSpinner();
      window.showToast(`Failed to connect "${title}". Try another server.`, 'error');
    }
  }

  const RAVE_SHEET_SOURCES = ['youtube', 'netflix', 'prime', 'hotstar', 'mx', 'twitch', 'crunchyroll', 'movies', 'url', 'local'];

  function openRaveSourceSheet(sourceName) {
    const clean = (sourceName || 'youtube').toLowerCase();
    const iframe = document.getElementById('yt-official-iframe');
    const container = document.getElementById('cinema-hub-container');

    if (iframe) {
      if (clean === 'youtube') {
        iframe.src = '/app/youtube';
      } else {
        iframe.src = `/app/source?app=${encodeURIComponent(clean)}`;
      }
    }

    const views = document.querySelectorAll('.vault-view');
    views.forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById('hub-view-youtube');
    if (targetView) targetView.classList.add('active');

    if (container) {
      container.classList.add('youtube-sheet-mode');
      container.classList.remove('menu-mode');
    }
    openModal();
    closeDrawer();
  }
  window.openRaveSourceSheet = openRaveSourceSheet;

  function showVaultView(viewName) {
    if (viewName === 'screenshare') {
      closeModal();
      if (window.webrtcManager) {
        window.webrtcManager.startScreenShare();
      }
      return;
    }

    if (viewName === 'wallpaper') {
      closeModal();
      if (window.openWallpaperModal) {
        window.openWallpaperModal();
      }
      return;
    }

    if (RAVE_SHEET_SOURCES.includes(viewName)) {
      openRaveSourceSheet(viewName);
      return;
    }

    const container = document.getElementById('cinema-hub-container');
    const views = document.querySelectorAll('.vault-view');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`hub-view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    const btnBack = document.getElementById('btn-vault-back');
    const modalTitle = document.getElementById('vault-modal-title');

    if (viewName === 'menu') {
      if (container) {
        container.classList.add('menu-mode');
        container.classList.remove('content-mode');
        container.classList.remove('youtube-sheet-mode');
      }
      if (btnBack) btnBack.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Load Media';
    } else {
      if (container) {
        container.classList.remove('menu-mode');
        container.classList.add('content-mode');
        container.classList.remove('youtube-sheet-mode');
      }
      if (btnBack) btnBack.style.display = 'inline-flex';

      const titles = {
        movies: 'Movies',
        apps: 'Apps',
        youtube: 'YouTube',
        url: 'Direct URL',
        local: 'Local Video'
      };
      if (modalTitle) modalTitle.textContent = titles[viewName] || 'Load Media';
    }

    closeDrawer();
  }

  function switchHubTab(tabName) {
    const map = {
      curated: 'movies',
      movies: 'movies',
      apps: 'apps',
      youtube: 'youtube',
      url: 'url',
      local: 'local',
      screenshare: 'screenshare'
    };
    showVaultView(map[tabName] || 'movies');
  }
  window.switchHubTab = switchHubTab;
  window.showVaultView = showVaultView;

  // Bind Open Buttons
  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      openModal();
      showVaultView('menu');
    });
  }

  const btnEmptyStage = document.getElementById('btn-empty-stage-load');
  if (btnEmptyStage) {
    btnEmptyStage.addEventListener('click', () => {
      openModal();
      showVaultView('menu');
    });
  }

  const railBtnVault = document.getElementById('rail-btn-vault');
  if (railBtnVault) {
    railBtnVault.addEventListener('click', () => {
      openModal();
      showVaultView('movies');
    });
  }

  const railBtnStage = document.getElementById('rail-btn-stage');
  if (railBtnStage) {
    railBtnStage.addEventListener('click', () => {
      closeModal();
    });
  }

  // Bind Back Button
  const btnVaultBack = document.getElementById('btn-vault-back');
  if (btnVaultBack) {
    btnVaultBack.addEventListener('click', () => {
      showVaultView('menu');
    });
  }

  // Bind 6-Card Menu Action Buttons
  document.querySelectorAll('.load-media-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      if (action) showVaultView(action);
    });
  });

  // Movie Card Click Handler
  const moviesGrid = document.getElementById('movies-catalog-grid');
  if (moviesGrid) {
    moviesGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.movie-poster-card');
      if (!card) return;
      const tmdbId = card.dataset.tmdbId;
      const title = card.dataset.title || 'Feature Movie';
      const year = card.dataset.year || '2024';
      const img = card.querySelector('.movie-poster-img');
      const poster = card.dataset.poster || (img ? img.src : '');
      if (tmdbId) {
        streamMovieFromCard(tmdbId, title, poster, year);
      }
    });
  }

  // Movie Category Pills
  const moviePills = document.querySelectorAll('#movies-category-pills .vault-pill');
  moviePills.forEach(pill => {
    pill.addEventListener('click', async () => {
      moviePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;
      if (filter === 'popular') {
        renderMovieGrid(REFERENCE_POPULAR_MOVIES);
      } else if (filter === 'bollywood') {
        try {
          const res = await fetch('/api/tmdb/search?q=Bollywood');
          const data = await res.json();
          if (data.results && data.results.length) {
            renderMovieGrid(data.results.slice(0, 6));
          }
        } catch (e) {
          renderMovieGrid(REFERENCE_POPULAR_MOVIES);
        }
      } else if (filter === 'hollywood') {
        renderMovieGrid(REFERENCE_POPULAR_MOVIES);
      } else if (filter === 'anime') {
        try {
          const res = await fetch('/api/tmdb/search?q=Anime');
          const data = await res.json();
          if (data.results && data.results.length) {
            renderMovieGrid(data.results.slice(0, 6));
          }
        } catch (e) {
          renderMovieGrid(REFERENCE_POPULAR_MOVIES);
        }
      } else if (filter === 'trending') {
        try {
          const res = await fetch('/api/tmdb/curated');
          const data = await res.json();
          const items = data.rows?.[0]?.items || REFERENCE_POPULAR_MOVIES;
          renderMovieGrid(items.slice(0, 6));
        } catch (e) {
          renderMovieGrid(REFERENCE_POPULAR_MOVIES);
        }
      }
    });
  });

  // Movie Catalog Search
  const movieSearchInput = document.getElementById('input-catalog-search');
  const movieSearchClear = document.getElementById('btn-catalog-search-clear');
  let searchDebounceTimer = null;
  if (movieSearchInput) {
    movieSearchInput.addEventListener('input', () => {
      const q = movieSearchInput.value.trim();
      if (movieSearchClear) movieSearchClear.style.display = q ? 'flex' : 'none';
      clearTimeout(searchDebounceTimer);
      if (!q) {
        renderMovieGrid(REFERENCE_POPULAR_MOVIES);
        return;
      }
      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data.results && data.results.length) {
            renderMovieGrid(data.results.slice(0, 12));
          }
        } catch (e) {
          console.warn('Movie search failed:', e);
        }
      }, 250);
    });
  }
  if (movieSearchClear) {
    movieSearchClear.addEventListener('click', () => {
      movieSearchInput.value = '';
      movieSearchClear.style.display = 'none';
      renderMovieGrid(REFERENCE_POPULAR_MOVIES);
    });
  }

  // Apps URLs & Launch Handlers
  const APP_URLS = {
    netflix: 'https://www.netflix.com',
    prime: 'https://www.primevideo.com',
    jiohotstar: 'https://www.hotstar.com',
    youtube: 'https://www.youtube.com',
    mxplayer: 'https://www.mxplayer.in',
    sonyliv: 'https://www.sonyliv.com',
    zee5: 'https://www.zee5.com',
    crunchyroll: 'https://www.crunchyroll.com',
    hulu: 'https://www.hulu.com',
    appletv: 'https://tv.apple.com',
    twitch: 'https://www.twitch.tv',
    more: 'https://www.youtube.com'
  };

  const appsGrid = document.getElementById('apps-squircles-grid');
  if (appsGrid) {
    appsGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.app-item');
      if (!item) return;
      const appKey = item.dataset.app;
      const appName = item.querySelector('.app-label')?.textContent || appKey;
      closeModal();
      if (window.openRaveSourceSheet) {
        window.openRaveSourceSheet(appKey);
      } else {
        showVaultView(appKey);
      }
    });
  }

  // Apps Category Pills
  const appPills = document.querySelectorAll('#apps-category-pills .vault-pill');
  appPills.forEach(pill => {
    pill.addEventListener('click', () => {
      appPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.filter;
      const items = document.querySelectorAll('#apps-squircles-grid .app-item');
      items.forEach(it => {
        if (cat === 'all') {
          it.style.display = 'flex';
        } else {
          const itemCats = it.dataset.cat || '';
          it.style.display = itemCats.includes(cat) ? 'flex' : 'none';
        }
      });
    });
  });

  // Apps Search
  const appsSearchInput = document.getElementById('input-apps-search');
  if (appsSearchInput) {
    appsSearchInput.addEventListener('input', () => {
      const q = appsSearchInput.value.trim().toLowerCase();
      const items = document.querySelectorAll('#apps-squircles-grid .app-item');
      items.forEach(it => {
        const name = (it.querySelector('.app-label')?.textContent || '').toLowerCase();
        it.style.display = (!q || name.includes(q)) ? 'flex' : 'none';
      });
    });
  }



  // Mobile Playing Stage Controls
  const btnPlayingBack = document.getElementById('btn-mobile-playing-back');
  if (btnPlayingBack) {
    btnPlayingBack.addEventListener('click', () => {
      exitDemoPlaying();
    });
  }

  const btnPlayingMore = document.getElementById('btn-mobile-playing-more');
  if (btnPlayingMore) {
    btnPlayingMore.addEventListener('click', () => {
      openModal();
      showVaultView('menu');
    });
  }

  const exitDemoPlaying = () => {
    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) roomContainer.classList.remove('is-playing');
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) {
      stageBackdrop.style.display = 'none';
    }
    const placeholder = document.getElementById('player-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    const mobHeader = document.getElementById('mobile-playing-header');
    if (mobHeader) mobHeader.style.display = 'none';
  };
  window.exitDemoPlaying = exitDemoPlaying;

  const setDemoPlaying = (title = 'Interstellar', bgImage = '/img/interstellar-still.jpg') => {
    const roomContainer = document.querySelector('.room-container');
    if (roomContainer) roomContainer.classList.add('is-playing');
    const stageBackdrop = document.getElementById('playing-stage-backdrop');
    if (stageBackdrop) {
      stageBackdrop.style.backgroundImage = `url(${bgImage})`;
      stageBackdrop.style.backgroundSize = 'cover';
      stageBackdrop.style.backgroundPosition = 'center';
      stageBackdrop.style.display = 'block';
    }
    const placeholder = document.getElementById('player-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    const mobHeader = document.getElementById('mobile-playing-header');
    if (mobHeader) mobHeader.style.display = 'none';
    const mobTitle = document.getElementById('mobile-playing-title');
    if (mobTitle) mobTitle.textContent = title;
    const customControls = document.getElementById('custom-controls');
    if (customControls) {
      customControls.style.display = 'flex';
      customControls.classList.add('active');
    }
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) timeDisplay.textContent = '1:12:35 / 2:49:04';
    const progFilled = document.getElementById('progress-filled');
    if (progFilled) progFilled.style.width = '42.8%';
    const ctrlPlay = document.getElementById('ctrl-play');
    if (ctrlPlay) {
      ctrlPlay.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      `;
    }
    closeModal();
  };
  window.setDemoPlaying = setDemoPlaying;



  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const browserAppsMenu = document.getElementById('browser-apps-menu');
      if (browserAppsMenu && browserAppsMenu.style.display !== 'none') {
        browserAppsMenu.style.display = 'none';
        const toggle = document.getElementById('btn-browser-apps-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        return;
      }
      const wallpaperModal = document.getElementById('wallpaper-modal');
      const settingsModal = document.getElementById('settings-modal');
      if (wallpaperModal && window.getComputedStyle(wallpaperModal).display !== 'none') {
        wallpaperModal.style.display = 'none';
        return;
      }
      if (settingsModal && window.getComputedStyle(settingsModal).display !== 'none') {
        settingsModal.style.display = 'none';
        return;
      }
      if (modal && (modal.classList.contains('active') || window.getComputedStyle(modal).display !== 'none')) {
        if (drawer && drawer.classList.contains('open')) {
          closeDrawer();
        } else {
          closeModal();
        }
      }
    }
  });

  // Support deep link ?vault=true&tab=apps or ?vault=true&tab=curated
  const hubParams = new URLSearchParams(window.location.search);
  if (hubParams.get('vault') === 'true' || hubParams.get('discover') === 'true') {
    openModal();
    const reqTab = hubParams.get('tab');
    if (reqTab) {
      setTimeout(() => switchHubTab(reqTab), 60);
    }
  }

  // Shelf Arrow Navigation
  document.querySelectorAll('.shelf-arrow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const track = document.getElementById(targetId);
      if (!track) return;
      const direction = btn.classList.contains('prev') ? -1 : 1;
      track.scrollBy({ left: direction * 560, behavior: 'smooth' });
    });
  });

  // Curated Catalog Loader
  async function loadCuratedCatalog() {
    try {
      const resp = await fetch('/api/tmdb/curated');
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Catalog error');

      curatedLoaded = true;

      // Spotlight Billboard
      if (data.spotlight) {
        renderSpotlight(data.spotlight);
        renderStageHero(data.spotlight);
      }

      // Shelves
      (data.rows || []).forEach(row => {
        const track = document.getElementById(`shelf-track-${row.id}`);
        if (track && row.items) {
          track.innerHTML = '';
          row.items.forEach(item => {
            track.appendChild(createFilmCard(item));
          });
        }
      });
    } catch (err) {
      console.warn('Failed to load curated catalog:', err);
    }
  }

  // Render Hero Spotlight Billboard
  function renderSpotlight(spotlight) {
    const bg = document.getElementById('spotlight-bg');
    const title = document.getElementById('spotlight-title');
    const year = document.getElementById('spotlight-year');
    const rating = document.getElementById('spotlight-rating');
    const type = document.getElementById('spotlight-type');
    const overview = document.getElementById('spotlight-overview');

    if (bg && spotlight.backdrop) bg.style.backgroundImage = `url(${spotlight.backdrop})`;
    if (title) title.textContent = spotlight.title;
    if (year) year.textContent = spotlight.year || '2026';
    if (rating) rating.innerHTML = spotlight.rating ? `${STAR_ICON_SVG} <span>${spotlight.rating}</span>` : `${STAR_ICON_SVG} <span>8.2</span>`;
    if (type) type.textContent = spotlight.mediaType === 'tv' ? 'SERIES' : 'FEATURE FILM';
    if (overview) overview.textContent = spotlight.overview || 'Premiere release available for immediate room synchronization.';

    const btnScreen = document.getElementById('btn-spotlight-screen');
    const btnDetails = document.getElementById('btn-spotlight-details');

    if (btnScreen) {
      const isTv = spotlight.mediaType === 'tv';
      const screenLabel = document.getElementById('spotlight-screen-text');
      if (screenLabel) screenLabel.textContent = isTv ? 'Play Full Series' : 'Play Full Movie';

      btnScreen.onclick = async () => {
        closeModal();
        if (window.universalPlayer) {
          window.universalPlayer.showSpinner(`CONNECTING: ${spotlight.title.toUpperCase()}...`);
        }
        window.showToast(`Connecting direct 1080p stream for "${spotlight.title}"...`, 'info', 3000);
        try {
          const res = await fetch(`/api/stream/resolve?id=${spotlight.id}&type=${spotlight.mediaType}`);
          const data = await res.json();
          if (data.success && data.streamUrl) {
            socket.emit('change-media', {
              type: 'hls',
              url: data.streamUrl,
              streams: data.streams,
              title: spotlight.title,
              poster: spotlight.poster,
              backdrop: spotlight.backdrop,
              subtitles: data.subtitles,
              isPlaying: true
            });
            window.showToast(`Now screening: ${spotlight.title} (Pure Native HLS)`, 'success');
            return;
          }

          // Fallback to embed if direct stream is not yet indexed
          const sResp = await fetch(`/api/stream/servers?id=${spotlight.id}&type=${spotlight.mediaType}`);
          const sData = await sResp.json();
          const fallbackServer = sData.servers?.find(s => !s.isNative) || sData.servers?.[1] || sData.servers?.[0];
          const serverUrl = fallbackServer?.url || (isTv
            ? `https://vidsrc.sh/embed/tv?tmdb=${spotlight.id}&season=1&episode=1`
            : `https://vidsrc.sh/embed/movie?tmdb=${spotlight.id}`);

          socket.emit('change-media', {
            type: 'embed',
            url: serverUrl,
            title: spotlight.title,
            poster: spotlight.poster,
            backdrop: spotlight.backdrop,
            isPlaying: true
          });
          window.showToast(`Now screening: ${spotlight.title} (Cloud Embed)`, 'info');
        } catch (e) {
          if (window.universalPlayer) window.universalPlayer.hideSpinner();
          window.showToast('Failed to start spotlight reel.', 'error');
        }
      };
    }

    if (btnDetails) {
      btnDetails.onclick = () => {
        openFilmDrawer(spotlight.id, spotlight.mediaType, spotlight);
      };
    }
  }

  // Render Home Stage Featured Hero Billboard with Genuine Metadata
  function renderStageHero(spotlight) {
    if (!spotlight) return;
    const titleEl = document.getElementById('stage-hero-title');
    const bgEl = document.getElementById('stage-hero-backdrop');
    const yearEl = document.getElementById('stage-hero-year');
    const ratingEl = document.getElementById('stage-hero-rating');
    const synopsisEl = document.getElementById('stage-hero-synopsis');

    if (titleEl && spotlight.title) titleEl.textContent = spotlight.title;
    if (bgEl && spotlight.backdrop) bgEl.style.backgroundImage = `url(${spotlight.backdrop})`;
    if (yearEl && spotlight.year) yearEl.textContent = spotlight.year;
    if (ratingEl && spotlight.rating) ratingEl.innerHTML = `${STAR_ICON_SVG} <span>${spotlight.rating}</span>`;
    if (synopsisEl && spotlight.overview) synopsisEl.textContent = spotlight.overview;

    const btnHeroPlay = document.getElementById('btn-hero-play-featured');
    if (btnHeroPlay) {
      btnHeroPlay.onclick = () => {
        const btnScreen = document.getElementById('btn-spotlight-screen');
        if (btnScreen && btnScreen.onclick) {
          btnScreen.onclick();
        } else {
          openModal();
          const curatedTab = document.querySelector('.hub-nav-tab[data-tab="curated"]');
          if (curatedTab) curatedTab.click();
        }
      };
    }
  }

  // Create 2:3 Film Card Element
  function createFilmCard(film) {
    const card = document.createElement('article');
    card.className = 'film-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const posterUrl = film.poster || 'https://via.placeholder.com/300x450?text=No+Poster';
    const ratingText = film.rating ? `${STAR_ICON_SVG} <span>${film.rating}</span>` : `${STAR_ICON_SVG} <span>8.0</span>`;
    const isTv = film.mediaType === 'tv';
    const typeLabel = isTv ? 'TV' : 'FILM';
    const yearText = film.year ? film.year : '';
    card.setAttribute('aria-label', `Select ${film.title} (${isTv ? 'TV Series' : 'Movie'}${yearText ? ', ' + yearText : ''})`);

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target === card) {
          e.preventDefault();
          card.click();
        }
      }
    });

    card.innerHTML = `
      <div class="film-poster-wrap">
        <img src="${posterUrl}" alt="${escapeHtml(film.title)}" class="film-poster" loading="lazy">
        <span class="film-rating-badge">${ratingText}</span>
        <span class="film-type-badge">${typeLabel}</span>
        <div class="film-quick-actions">
          <button type="button" class="btn btn-primary btn-sm btn-quick-screen">
            ${isTv ? 'EPISODES' : 'PLAY'}
          </button>
          <button type="button" class="btn btn-outline btn-sm btn-quick-queue" title="Add to Shared Room Queue">+ QUEUE</button>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-details">SERVERS</button>
        </div>
      </div>
      <div class="film-card-info">
        <h4 class="film-title" title="${escapeHtml(film.title)}">${escapeHtml(film.title)}</h4>
        <div class="film-meta-sub">
          <span>${yearText}</span>
          <span>·</span>
          <span>${isTv ? 'Series' : 'Cinema'}</span>
        </div>
      </div>
    `;

    // Click handler on card: clicking the card or Play button starts the actual film!
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-quick-queue')) {
        e.stopPropagation();
        window.showToast(`Queuing "${film.title}"...`, 'info', 2000);
        fetch(`/api/stream/resolve?id=${film.id}&type=${film.mediaType}`)
          .then(r => r.json())
          .then(res => {
            if (res.success && res.streamUrl) {
              socket.emit('playlist-add', {
                item: {
                  type: 'hls',
                  url: res.streamUrl,
                  title: film.title,
                  poster: film.poster,
                  backdrop: film.backdrop
                }
              });
              window.showToast(`Queued: "${film.title}"`, 'success');
            } else {
              socket.emit('playlist-add', {
                item: {
                  type: 'embed',
                  url: `https://vidsrc.sh/embed/movie?tmdb=${film.id}`,
                  title: film.title,
                  poster: film.poster,
                  backdrop: film.backdrop
                }
              });
              window.showToast(`Queued: "${film.title}"`, 'success');
            }
          }).catch(() => {
            window.showToast('Failed to queue film.', 'error');
          });
      } else if (e.target.closest('.btn-quick-details')) {
        e.stopPropagation();
        openFilmDrawer(film.id, film.mediaType, film);
      } else if (isTv) {
        openFilmDrawer(film.id, film.mediaType, film);
      } else {
        quickScreenFilm(film);
      }
    });

    return card;
  }

  // Quick Screen helper
  async function quickScreenFilm(film) {
    closeModal();
    if (window.universalPlayer) {
      window.universalPlayer.showSpinner(`CONNECTING: ${film.title.toUpperCase()}...`);
    }
    window.showToast(`Connecting direct 1080p stream for "${film.title}"...`, 'info', 3000);
    try {
      const resp = await fetch(`/api/stream/resolve?id=${film.id}&type=${film.mediaType}`);
      const result = await resp.json();

      if (result.success && result.streamUrl) {
        socket.emit('change-media', {
          type: 'hls',
          url: result.streamUrl,
          streams: result.streams,
          title: film.title,
          poster: film.poster,
          backdrop: film.backdrop,
          subtitles: result.subtitles,
          isPlaying: true
        });
        window.showToast(`Now playing: ${film.title} (Pure Native HLS)`, 'success');
        return;
      }

      // Fallback if not yet indexed in direct HLS vault
      const sResp = await fetch(`/api/stream/servers?id=${film.id}&type=${film.mediaType}`);
      const sData = await sResp.json();
      const fallbackServer = sData.servers?.find(s => !s.isNative) || sData.servers?.[1] || sData.servers?.[0];
      const serverUrl = fallbackServer?.url || (film.mediaType === 'tv'
        ? `https://vidsrc.sh/embed/tv?tmdb=${film.id}&season=1&episode=1`
        : `https://vidsrc.sh/embed/movie?tmdb=${film.id}`);

      socket.emit('change-media', {
        type: 'embed',
        url: serverUrl,
        title: film.title,
        poster: film.poster,
        backdrop: film.backdrop,
        isPlaying: true
      });
      window.showToast(`Now playing: ${film.title} (Cloud Embed)`, 'info');
    } catch (e) {
      if (window.universalPlayer) window.universalPlayer.hideSpinner();
      window.showToast('Failed to load stream.', 'error');
    }
  }

  // Universal Live Search
  const searchInput = document.getElementById('input-catalog-search');
  const searchClearBtn = document.getElementById('btn-catalog-search-clear');
  const searchFilters = document.querySelectorAll('.hub-filter-pill');
  const searchResultsGrid = document.getElementById('search-results-grid');
  const searchResultsCount = document.getElementById('search-results-count');
  const searchResultsHeading = document.getElementById('search-results-heading');

  searchFilters.forEach(pill => {
    pill.addEventListener('click', () => {
      searchFilters.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeSearchFilter = pill.dataset.filter;
      if (searchInput && searchInput.value.trim()) {
        executeSearch(searchInput.value.trim());
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const query = e.target.value.trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = query ? 'block' : 'none';
      }

      if (!query) {
        if (searchSection) searchSection.style.display = 'none';
        const targetPane = document.getElementById(`hub-pane-${activeTab}`);
        if (targetPane) targetPane.classList.add('active');
        return;
      }

      searchTimer = setTimeout(() => {
        executeSearch(query);
      }, 350);
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClearBtn.style.display = 'none';
      if (searchSection) searchSection.style.display = 'none';
      const targetPane = document.getElementById(`hub-pane-${activeTab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  }

  async function executeSearch(query) {
    if (!searchResultsGrid || !searchSection) return;

    hubPanes.forEach(p => p.classList.remove('active'));
    searchSection.style.display = 'block';
    searchResultsHeading.textContent = `Search Vault: "${query}"`;
    searchResultsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-dim);">
        Searching international &amp; archival vaults...
      </div>
    `;

    try {
      const promises = [];

      if (activeSearchFilter !== 'mx') {
        promises.push(fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] })));
      } else {
        promises.push(Promise.resolve({ results: [] }));
      }

      if (activeSearchFilter === 'all' || activeSearchFilter === 'mx') {
        promises.push(fetch(`/api/mx/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] })));
      } else {
        promises.push(Promise.resolve({ results: [] }));
      }

      const [tmdbData, mxData] = await Promise.all(promises);

      let combined = [];

      (tmdbData.results || []).forEach(item => {
        if (activeSearchFilter === 'movie' && item.mediaType !== 'movie') return;
        if (activeSearchFilter === 'tv' && item.mediaType !== 'tv') return;
        combined.push(item);
      });

      if (mxData.results && mxData.results.length) {
        mxData.results.forEach(m => {
          combined.push({
            id: m.id,
            title: m.title,
            mediaType: m.type === 'tvshow' ? 'tv' : 'movie',
            isMx: true,
            fullUrl: m.fullUrl,
            poster: m.image,
            rating: '7.8',
            year: 'MX Archive'
          });
        });
      }

      searchResultsCount.textContent = `${combined.length} RELEASES`;

      if (combined.length === 0) {
        searchResultsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-dim);">
            No screening titles found matching "${escapeHtml(query)}".
          </div>
        `;
        return;
      }

      searchResultsGrid.innerHTML = '';
      combined.forEach(item => {
        if (item.isMx) {
          const mxCard = createMxFilmCard(item);
          searchResultsGrid.appendChild(mxCard);
        } else {
          const filmCard = createFilmCard(item);
          searchResultsGrid.appendChild(filmCard);
        }
      });
    } catch (e) {
      searchResultsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--accent-red);">
          Failed to retrieve search results.
        </div>
      `;
    }
  }

  function createMxFilmCard(item) {
    const card = document.createElement('article');
    card.className = 'film-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Select ${item.title} (Bollywood Archive)`);

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target === card) {
          e.preventDefault();
          card.click();
        }
      }
    });

    const posterUrl = item.poster || 'https://via.placeholder.com/300x450?text=MX';

    card.innerHTML = `
      <div class="film-poster-wrap">
        <img src="${posterUrl}" alt="${escapeHtml(item.title)}" class="film-poster" loading="lazy">
        <span class="film-rating-badge">MX ARCHIVE</span>
        <span class="film-type-badge">BOLLYWOOD</span>
        <div class="film-quick-actions">
          <button type="button" class="btn btn-primary btn-sm">RESOLVE &amp; PLAY</button>
        </div>
      </div>
      <div class="film-card-info">
        <h4 class="film-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
        <div class="film-meta-sub">
          <span>Direct Stream</span>
        </div>
      </div>
    `;

    card.addEventListener('click', async () => {
      window.showToast(`Resolving 1080p stream for "${item.title}"...`, 'info', 4000);
      try {
        const resp = await fetch('/api/mx/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.fullUrl, title: item.title })
        });
        const result = await resp.json();
        if (result.success && result.streamUrl) {
          socket.emit('change-media', {
            type: 'hls',
            url: result.streamUrl,
            title: item.title,
            poster: item.poster
          });
          window.showToast(`Now playing: ${item.title}`, 'success');
          closeModal();
        } else {
          window.showToast(`"${item.title}" direct stream is DRM protected or unavailable. Try another selection or use Tab Cast.`, 'warning', 5000);
          closeModal();
        }
      } catch (err) {
        window.showToast('Stream resolve failed.', 'error');
      }
    });

    return card;
  }

  // Open Slide-over Film Detail Drawer
  async function openFilmDrawer(id, type = 'movie', initialData = null) {
    if (!drawer) return;
    openDrawer();

    const drawerBody = document.getElementById('drawer-body');
    const btnDrawerTrailer = document.getElementById('btn-drawer-trailer');
    const btnDrawerScreen = document.getElementById('btn-drawer-screen');

    currentDrawerDetails = null;
    currentDrawerServers = [];
    selectedServerIndex = 0;
    currentSelectedSeason = 1;
    currentSelectedEpisode = 1;

    drawerBody.innerHTML = `
      <div class="drawer-loading">
        <div class="skeleton-box" style="width: 100%; aspect-ratio: 16/9; margin-bottom: 16px; border-radius: 4px;"></div>
        <div class="skeleton-box" style="width: 80%; height: 26px; margin-bottom: 12px;"></div>
        <div class="skeleton-box" style="width: 50%; height: 16px; margin-bottom: 16px;"></div>
        <div class="skeleton-box" style="width: 100%; height: 70px;"></div>
      </div>
    `;

    try {
      const [detailResp, serverResp] = await Promise.all([
        fetch(`/api/tmdb/details?id=${id}&type=${type}`).then(r => r.json()),
        fetch(`/api/stream/servers?id=${id}&type=${type}&season=1&episode=1`).then(r => r.json())
      ]);

      if (!detailResp.success || !detailResp.details) {
        throw new Error('Details not found');
      }

      const details = detailResp.details;
      currentDrawerDetails = details;
      currentDrawerServers = serverResp.servers || [];

      // Render Drawer Content
      renderDrawerContent(details, currentDrawerServers);

      if (btnDrawerScreen) {
        const isTv = type === 'tv';
        btnDrawerScreen.textContent = isTv ? 'PLAY SELECTED EPISODE' : 'PLAY FULL MOVIE';
        btnDrawerScreen.onclick = async () => {
          const activeServer = currentDrawerServers[selectedServerIndex] || currentDrawerServers[0];
          const isNative = activeServer?.isNative || selectedServerIndex === 0;
          const episodeSuffix = isTv ? ` · S${currentSelectedSeason}:E${currentSelectedEpisode}` : '';
          const fullTitle = `${details.title}${episodeSuffix}`;

          closeModal();
          if (window.universalPlayer) {
            window.universalPlayer.showSpinner(`CONNECTING: ${fullTitle.toUpperCase()}...`);
          }

          if (isNative) {
            window.showToast(`Connecting direct 1080p stream for "${fullTitle}"...`, 'info', 3000);
            try {
              const res = await fetch(`/api/stream/resolve?id=${id}&type=${type}&season=${currentSelectedSeason}&episode=${currentSelectedEpisode}`);
              const data = await res.json();
              if (data.success && data.streamUrl) {
                socket.emit('change-media', {
                  type: 'hls',
                  url: data.streamUrl,
                  streams: data.streams,
                  title: fullTitle,
                  poster: details.poster,
                  backdrop: details.backdrop,
                  subtitles: data.subtitles,
                  isPlaying: true
                });
                window.showToast(`Now screening: ${fullTitle} (Pure Native HLS)`, 'success');
                return;
              }
              window.showToast(`Direct stream not available. Connecting via high-speed mirror...`, 'info', 3000);
            } catch (err) {
              console.warn('Native resolve fallback:', err);
            }
          }

          const defaultUrl = isTv
            ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${currentSelectedSeason}&episode=${currentSelectedEpisode}`
            : `https://vidsrc.sh/embed/movie?tmdb=${id}`;
          const streamUrl = (activeServer && !activeServer.isNative) ? activeServer.url : defaultUrl;

          socket.emit('change-media', {
            type: 'embed',
            url: streamUrl,
            title: fullTitle,
            poster: details.poster,
            backdrop: details.backdrop,
            isPlaying: true
          });
          window.showToast(`Now screening: ${fullTitle} (Cloud Embed)`, 'info');
        };
      }
    } catch (err) {
      drawerBody.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--accent-red); font-family: var(--font-mono); font-size: 0.85rem;">
          Could not load specifications for this title: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function renderDrawerContent(details, servers) {
    const drawerBody = document.getElementById('drawer-body');
    if (!drawerBody) return;

    const backdropSrc = details.backdrop || details.poster || '';
    const posterSrc = details.poster || 'https://via.placeholder.com/300x450';
    const genrePills = (details.genres || []).map(g => `<span class="meta-badge">${escapeHtml(g)}</span>`).join('');
    const directorHtml = details.director ? `<span class="meta-badge">DIR // ${escapeHtml(details.director)}</span>` : '';
    const runtimeHtml = details.runtime ? `<span class="meta-badge">${escapeHtml(details.runtime)}</span>` : '';

    const castChips = (details.cast || []).map(c => `
      <div class="drawer-cast-chip">
        <img src="${c.profile || 'https://via.placeholder.com/60?text=?'}" alt="${escapeHtml(c.name)}" class="drawer-cast-img" loading="lazy">
        <div class="drawer-cast-info">
          <strong style="color: var(--text-main);">${escapeHtml(c.name)}</strong>
          <span style="color: var(--text-dim);">${escapeHtml(c.character || '')}</span>
        </div>
      </div>
    `).join('');

    const serverPillsHtml = servers.map((s, idx) => `
      <button type="button" class="server-pill ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        ${escapeHtml(s.name)}
      </button>
    `).join('');

    const isTv = details.mediaType === 'tv';
    let tvSeasonsHtml = '';

    if (isTv && details.numberOfSeasons) {
      const seasonPills = Array.from({ length: details.numberOfSeasons }, (_, i) => i + 1).map(sn => `
        <button type="button" class="drawer-season-pill ${sn === 1 ? 'active' : ''}" data-season="${sn}">
          Season ${sn}
        </button>
      `).join('');

      tvSeasonsHtml = `
        <div class="drawer-tv-section">
          <span class="hub-eyebrow" style="margin-bottom: 6px; display: block;">SEASONS &amp; EPISODES</span>
          <div class="drawer-seasons-tabs" id="drawer-seasons-tabs">
            ${seasonPills}
          </div>
          <div class="drawer-episodes-list" id="drawer-episodes-list">
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); padding: 12px;">
              Loading episodes...
            </div>
          </div>
        </div>
      `;
    }

    drawerBody.innerHTML = `
      ${backdropSrc ? `<img src="${backdropSrc}" alt="${escapeHtml(details.title)}" class="drawer-backdrop">` : ''}
      <div class="drawer-hero">
        <img src="${posterSrc}" alt="${escapeHtml(details.title)}" class="drawer-poster">
        <div class="drawer-headline">
          <h2 class="drawer-title">${escapeHtml(details.title)}</h2>
          ${details.tagline ? `<div class="drawer-tagline">“${escapeHtml(details.tagline)}”</div>` : ''}
          <div class="drawer-meta-badges">
            <span class="meta-badge rating">${STAR_ICON_SVG} <span>${details.rating || 'N/A'}</span></span>
            <span class="meta-badge">${details.releaseYear || '2026'}</span>
            ${runtimeHtml}
            ${directorHtml}
            ${genrePills}
          </div>
        </div>
      </div>

      <div>
        <span class="hub-eyebrow" style="margin-bottom: 6px; display: block;">SYNOPSIS</span>
        <p class="drawer-synopsis">${escapeHtml(details.overview || 'No synopsis recorded in the vault archive.')}</p>
      </div>

      ${castChips ? `
        <div>
          <span class="hub-eyebrow" style="margin-bottom: 6px; display: block;">FEATURED CAST</span>
          <div class="drawer-cast-list">${castChips}</div>
        </div>
      ` : ''}

      <div class="drawer-servers">
        <span class="hub-eyebrow" style="margin-bottom: 2px; display: block;">SELECT CLOUD STREAM SERVER</span>
        <div class="server-pills" id="drawer-server-pills">
          ${serverPillsHtml}
        </div>
      </div>

      ${tvSeasonsHtml}
    `;

    // Hook up server pills
    const serverButtons = drawerBody.querySelectorAll('.server-pill');
    serverButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        serverButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedServerIndex = parseInt(btn.dataset.idx, 10);
      });
    });

    // If TV, load season 1 episodes
    if (isTv) {
      loadSeasonEpisodes(details.id, 1);

      const seasonButtons = drawerBody.querySelectorAll('.drawer-season-pill');
      seasonButtons.forEach(sBtn => {
        sBtn.addEventListener('click', () => {
          seasonButtons.forEach(b => b.classList.remove('active'));
          sBtn.classList.add('active');
          const sNum = parseInt(sBtn.dataset.season, 10);
          currentSelectedSeason = sNum;
          currentSelectedEpisode = 1;
          loadSeasonEpisodes(details.id, sNum);
        });
      });
    }
  }

  async function loadSeasonEpisodes(seriesId, seasonNum) {
    const listEl = document.getElementById('drawer-episodes-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); padding: 12px;">
        Retrieving Season ${seasonNum} episode manifest...
      </div>
    `;

    try {
      const resp = await fetch(`/api/tmdb/season?id=${seriesId}&season=${seasonNum}`);
      const data = await resp.json();
      if (!data.success || !data.episodes) throw new Error('Could not fetch season');

      listEl.innerHTML = '';
      data.episodes.forEach(ep => {
        const epCard = document.createElement('div');
        epCard.className = `episode-card ${ep.episodeNumber === currentSelectedEpisode ? 'active' : ''}`;
        const stillSrc = ep.still || 'https://via.placeholder.com/160x90?text=Episode';

        epCard.innerHTML = `
          <img src="${stillSrc}" alt="EP ${ep.episodeNumber}" class="episode-still" loading="lazy">
          <div class="episode-info">
            <span style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--accent-primary); font-weight: 600;">
              EPISODE ${ep.episodeNumber}
            </span>
            <div class="episode-title">${escapeHtml(ep.name || `Episode ${ep.episodeNumber}`)}</div>
            <div class="episode-overview">${escapeHtml(ep.overview || 'No episode synopsis.')}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm btn-play-ep-direct" style="align-self: center; white-space: nowrap; font-size: 0.72rem; padding: 6px 12px; margin-left: auto;">
            PLAY
          </button>
        `;

        epCard.addEventListener('click', async () => {
          listEl.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active'));
          epCard.classList.add('active');
          currentSelectedEpisode = ep.episodeNumber;
          const fullTitle = `${currentDrawerDetails?.title || 'Series'} · S${seasonNum}:E${ep.episodeNumber} "${ep.name}"`;

          closeModal();
          if (window.universalPlayer) {
            window.universalPlayer.showSpinner(`CONNECTING: S${seasonNum}:E${ep.episodeNumber}...`);
          }
          window.showToast(`Connecting direct 1080p stream for S${seasonNum}:E${ep.episodeNumber}...`, 'info', 3000);

          try {
            // First attempt direct native HLS resolution
            const res = await fetch(`/api/stream/resolve?id=${seriesId}&type=tv&season=${seasonNum}&episode=${ep.episodeNumber}`);
            const data = await res.json();
            if (data.success && data.streamUrl) {
              socket.emit('change-media', {
                type: 'hls',
                url: data.streamUrl,
                streams: data.streams,
                title: fullTitle,
                poster: currentDrawerDetails?.poster,
                backdrop: currentDrawerDetails?.backdrop,
                subtitles: data.subtitles,
                isPlaying: true
              });
              window.showToast(`Now playing: ${fullTitle} (Pure Native HLS)`, 'success');
              return;
            }

            // Fallback to embed
            const sResp = await fetch(`/api/stream/servers?id=${seriesId}&type=tv&season=${seasonNum}&episode=${ep.episodeNumber}`);
            const sData = await sResp.json();
            const activeServer = (sData.servers && sData.servers[selectedServerIndex]) || sData.servers?.[0];
            const fallbackServer = (activeServer && !activeServer.isNative) ? activeServer : (sData.servers?.find(s => !s.isNative) || sData.servers?.[1]);
            const streamUrl = fallbackServer?.url || `https://vidsrc.sh/embed/tv?tmdb=${seriesId}&season=${seasonNum}&episode=${ep.episodeNumber}`;

            socket.emit('change-media', {
              type: 'embed',
              url: streamUrl,
              title: fullTitle,
              poster: currentDrawerDetails?.poster,
              backdrop: currentDrawerDetails?.backdrop,
              isPlaying: true
            });
            window.showToast(`Now playing: ${fullTitle} (Cloud Embed)`, 'info');
          } catch (e) {
            if (window.universalPlayer) window.universalPlayer.hideSpinner();
            window.showToast('Failed to start episode stream.', 'error');
          }
        });

        listEl.appendChild(epCard);
      });
    } catch (e) {
      listEl.innerHTML = `
        <div style="color: var(--accent-red); font-family: var(--font-mono); font-size: 0.75rem; padding: 12px;">
          Failed to load episode index for Season ${seasonNum}.
        </div>
      `;
    }
  }

  // MX Player Catalog integration
  const mxGrid = document.getElementById('mx-movie-grid');
  const mxSearchInput = document.getElementById('input-mx-search');
  const mxFilterPills = document.querySelectorAll('.mx-filter-pill');
  let mxSearchTimer = null;

  async function loadMxCatalog(query = 'movie') {
    if (!mxGrid) return;
    mxGrid.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="mx-movie-card" style="pointer-events: none;">
        <div class="mx-movie-poster-box">
          <div class="skeleton-box" style="width: 100%; height: 100%;"></div>
        </div>
        <div class="mx-movie-info">
          <div class="skeleton-box" style="width: 85%; height: 14px; margin-bottom: 8px;"></div>
          <div class="skeleton-box" style="width: 50%; height: 12px; margin-bottom: 12px;"></div>
          <div class="skeleton-box" style="width: 100%; height: 26px; border-radius: 4px;"></div>
        </div>
      </div>
    `).join('');

    try {
      const res = await fetch(`/api/mx/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        mxGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-dim); font-family: var(--font-mono); font-size: 0.8rem;">
            No releases found for "${escapeHtml(query)}". Try another search term.
          </div>
        `;
        return;
      }

      mxGrid.innerHTML = '';
      data.results.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'mx-movie-card';

        const posterSrc = movie.image || 'https://via.placeholder.com/320x180?text=Movie';
        const typeLabel = movie.type === 'tvshow' ? 'Series' : 'Movie';

        card.innerHTML = `
          <div class="mx-movie-poster-box">
            <img src="${posterSrc}" alt="${escapeHtml(movie.title)}" class="mx-movie-poster" loading="lazy">
            <span class="mx-movie-badge">${typeLabel}</span>
          </div>
          <div class="mx-movie-info">
            <div class="mx-movie-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</div>
            <button class="mx-movie-play-btn">
              <span>PLAY REEL →</span>
            </button>
          </div>
        `;

        card.addEventListener('click', async () => {
          window.showToast(`Extracting 1080p stream for "${movie.title}"...`, 'info', 5000);
          try {
            const resp = await fetch('/api/mx/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: movie.fullUrl, title: movie.title })
            });
            const result = await resp.json();

            if (result.success && result.streamUrl) {
              socket.emit('change-media', {
                type: 'hls',
                url: result.streamUrl,
                title: movie.title,
                poster: movie.image
              });
              window.showToast(`Now playing: ${movie.title}`, 'success');
              closeModal();
            } else {
              window.showToast(`"${movie.title}" direct stream is DRM protected or unavailable. Try another selection or use Tab Cast.`, 'warning', 5000);
              closeModal();
            }
          } catch (e) {
            window.showToast('Failed to resolve stream.', 'error');
          }
        });

        mxGrid.appendChild(card);
      });
    } catch (e) {
      mxGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--accent-red);">
          Failed to load MX Player movies.
        </div>
      `;
    }
  }

  mxFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      mxFilterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadMxCatalog(pill.dataset.q);
    });
  });

  if (mxSearchInput) {
    mxSearchInput.addEventListener('input', (e) => {
      clearTimeout(mxSearchTimer);
      const val = e.target.value.trim();
      mxSearchTimer = setTimeout(() => {
        loadMxCatalog(val || 'movie');
      }, 400);
    });
  }

  // Demo presets
  const presetButtons = document.querySelectorAll('.btn-preset');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const urlInput = document.getElementById('input-media-url');
      const titleInput = document.getElementById('input-media-title');
      if (urlInput) urlInput.value = btn.dataset.url || '';
      if (titleInput) titleInput.value = btn.dataset.title || '';
    });
  });

  // Universal Direct Stream Handler
  async function handleLoadDirectStream(url, customTitle = '') {
    if (!url) {
      window.showToast('Please enter a valid stream manifest (.m3u8, .mp4, .webm)', 'error');
      return;
    }

    window.showToast('Resolving stream manifest...', 'info', 2000);

    try {
      const resp = await fetch('/api/resolve-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const result = await resp.json();

      if (result.success && result.streamUrl) {
        socket.emit('change-media', {
          type: result.type,
          url: result.streamUrl,
          title: customTitle || result.title || 'Online Video'
        });
        window.showToast(`Loaded: ${result.title}`, 'success');
        closeModal();
        return;
      }
    } catch (e) {
      console.warn('Resolver fallback to direct URL:', e);
    }

    const isHls = url.includes('.m3u8');
    socket.emit('change-media', {
      type: isHls ? 'hls' : 'url',
      url,
      title: customTitle || 'Online Video'
    });
    closeModal();
  }
  window.handleLoadDirectStream = handleLoadDirectStream;

  // Direct Stream button in Screening Vault
  const btnLoadDirect = document.getElementById('btn-load-direct-stream');
  if (btnLoadDirect) {
    btnLoadDirect.addEventListener('click', () => {
      const url = (document.getElementById('input-media-url')?.value || '').trim();
      const customTitle = (document.getElementById('input-media-title')?.value || '').trim();
      handleLoadDirectStream(url, customTitle);
    });
  }

  // Queue Direct Stream button
  const btnQueueDirect = document.getElementById('btn-queue-direct-stream');
  if (btnQueueDirect) {
    btnQueueDirect.addEventListener('click', () => {
      const url = (document.getElementById('input-media-url')?.value || '').trim();
      const customTitle = (document.getElementById('input-media-title')?.value || '').trim();
      if (!url) {
        window.showToast('Please enter a stream URL to queue', 'error');
        return;
      }
      const isHls = url.includes('.m3u8');
      socket.emit('playlist-add', {
        item: {
          type: isHls ? 'hls' : 'url',
          url,
          title: customTitle || 'Queued Stream'
        }
      });
      window.showToast(`Added to queue: "${customTitle || url}"`, 'success');
      closeModal();
    });
  }

  // Local File Reel button
  const btnLoadLocal = document.getElementById('btn-load-local-reel');
  if (btnLoadLocal) {
    btnLoadLocal.addEventListener('click', () => {
      const fileInput = document.getElementById('input-local-file');
      const file = fileInput?.files?.[0];
      if (!file) {
        window.showToast('Please select a video file from your filesystem', 'error');
        return;
      }

      window.universalPlayer.loadSource({
        type: 'local',
        file: file,
        title: `LOCAL // ${file.name}`
      });

      socket.emit('change-media', {
        type: 'local',
        url: '',
        title: `LOCAL // ${file.name}`
      });

      window.showToast(`Loaded "${file.name}". Room members can pick their copy of this file.`, 'success');
      closeModal();
    });
  }

  // Screenshare trigger button in Hub
  const btnTriggerScreenshare = document.getElementById('btn-trigger-screenshare-hub');
  if (btnTriggerScreenshare) {
    btnTriggerScreenshare.addEventListener('click', () => {
      closeModal();
      if (window.webrtcManager) {
        window.webrtcManager.toggleScreenShare();
      }
    });
  }

  // YouTube Reel button
  const btnLoadYoutube = document.getElementById('btn-load-youtube-hub');
  if (btnLoadYoutube) {
    btnLoadYoutube.addEventListener('click', async () => {
      const ytUrl = (document.getElementById('input-yt-url')?.value || '').trim();
      if (!ytUrl) {
        window.showToast('Please enter a YouTube video URL', 'error');
        return;
      }
      window.showToast('Fetching YouTube metadata...', 'info', 3000);
      let title = 'YouTube Video';
      let poster = null;
      try {
        const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(ytUrl)}`);
        const data = await res.json();
        if (data && data.success) {
          if (data.title) title = data.title;
          if (data.poster) poster = data.poster;
        }
      } catch (e) {}

      socket.emit('change-media', {
        type: 'youtube',
        url: ytUrl,
        title,
        poster
      });
      closeModal();
    });
  }

  // Queue YouTube Reel button
  const btnQueueYoutube = document.getElementById('btn-queue-youtube-hub');
  if (btnQueueYoutube) {
    btnQueueYoutube.addEventListener('click', async () => {
      const ytUrl = (document.getElementById('input-yt-url')?.value || '').trim();
      if (!ytUrl) {
        window.showToast('Please enter a YouTube video URL to queue', 'error');
        return;
      }
      if (window.roomQueueManager) {
        window.roomQueueManager.addItemFromUrl(ytUrl);
      } else {
        socket.emit('playlist-add', {
          item: {
            type: 'youtube',
            url: ytUrl,
            title: 'YouTube Video'
          }
        });
      }
      closeModal();
    });
  }

  // Initialize YouTube Inbuilt Explorer & Embedded Webview
  initYouTubeExplorer(socket);

  // Initialize Extensible Streaming Provider Catalog
  if (typeof initProviderCatalog === 'function') {
    initProviderCatalog(socket);
  }

  // Streaming Apps Hub Card Interactivity
  document.querySelectorAll('.btn-app-cast').forEach(btn => {
    btn.addEventListener('click', () => {
      const appName = btn.dataset.app || 'App';
      closeModal();
      const appMap = {
        'Netflix': 'https://www.netflix.com',
        'Prime Video': 'https://www.primevideo.com',
        'Hotstar': 'https://www.hotstar.com',
        'MX Player': 'https://www.mxplayer.in',
        'Crunchyroll': 'https://www.crunchyroll.com',
        'YouTube': 'https://www.youtube.com'
      };
      if (appName === 'YouTube') {
        switchHubTab('youtube');
        if (modalVault) modalVault.classList.add('active');
        return;
      }
      const targetUrl = appMap[appName];
      if (targetUrl) {
        window.showToast(`Loading inbuilt ${appName} on stage...`, 'info', 3000);
        openInbuiltBrowser(targetUrl);
      } else {
        window.showToast(`Starting 1080p stream for ${appName}...`, 'info', 4000);
        if (window.webrtcManager) window.webrtcManager.toggleScreenShare();
      }
    });
  });

  // App cards quick navigation inside Vault
  document.querySelectorAll('.btn-app-goto-mx').forEach(btn => {
    btn.addEventListener('click', () => switchHubTab('mx'));
  });
  document.querySelectorAll('.btn-app-goto-twitch').forEach(btn => {
    btn.addEventListener('click', () => switchHubTab('twitch'));
  });
  document.querySelectorAll('.btn-app-goto-youtube').forEach(btn => {
    btn.addEventListener('click', () => switchHubTab('youtube'));
  });
  document.querySelectorAll('.btn-app-goto-url').forEach(btn => {
    btn.addEventListener('click', () => switchHubTab('url'));
  });

  // Twitch Channel Presets
  document.querySelectorAll('.btn-twitch-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('input-twitch-channel');
      if (input) input.value = btn.dataset.channel || '';
    });
  });

  // Screen Twitch Live button
  const btnLoadTwitch = document.getElementById('btn-load-twitch-hub');
  if (btnLoadTwitch) {
    btnLoadTwitch.addEventListener('click', () => {
      const input = document.getElementById('input-twitch-channel');
      const channel = (input?.value || '').trim();
      if (!channel) {
        window.showToast('Please enter a Twitch channel name or URL', 'error');
        return;
      }
      socket.emit('change-media', {
        type: 'twitch',
        url: channel,
        title: `TWITCH // ${channel.toUpperCase()}`
      });
      window.showToast(`Screening Twitch: ${channel}`, 'success');
      closeModal();
    });
  }

  // Queue Twitch Live button
  const btnQueueTwitch = document.getElementById('btn-queue-twitch-hub');
  if (btnQueueTwitch) {
    btnQueueTwitch.addEventListener('click', () => {
      const input = document.getElementById('input-twitch-channel');
      const channel = (input?.value || '').trim();
      if (!channel) {
        window.showToast('Please enter a Twitch channel name or URL to queue', 'error');
        return;
      }
      socket.emit('playlist-add', {
        item: {
          type: 'twitch',
          url: channel,
          title: `TWITCH // ${channel.toUpperCase()}`
        }
      });
      window.showToast(`Added Twitch channel "${channel}" to room queue`, 'success');
      closeModal();
    });
  }
}

/**
 * Render Room Participants in UI
 */
function renderUsers(users, webrtcMgr, currentUserId) {
  const countEl = document.getElementById('user-count-badge');
  if (countEl) countEl.textContent = `${users.length}`;
  const mobPeopleBadge = document.getElementById('mob-people-badge');
  if (mobPeopleBadge) mobPeopleBadge.textContent = `${users.length}`;

  // Update Top Masthead Presence Stack & Live Counter
  const navCircles = document.getElementById('nav-avatar-circles');
  const navCount = document.getElementById('nav-presence-count');
  if (navCircles) {
    navCircles.innerHTML = '';
    const displayUsers = users.slice(0, 4);
    displayUsers.forEach(u => {
      const circle = document.createElement('div');
      circle.className = 'nav-mini-avatar';
      circle.style.backgroundColor = u.avatarColor || '#d4a359';
      circle.textContent = (u.username || '?').charAt(0).toUpperCase();
      circle.title = u.username;
      navCircles.appendChild(circle);
    });
    if (users.length > 4) {
      const moreCircle = document.createElement('div');
      moreCircle.className = 'nav-mini-avatar';
      moreCircle.style.backgroundColor = '#1e2129';
      moreCircle.textContent = `+${users.length - 4}`;
      moreCircle.title = `${users.length - 4} more viewers`;
      navCircles.appendChild(moreCircle);
    }
  }
  if (navCount) {
    navCount.innerHTML = `<span class="presence-pulse-dot"></span>${users.length} ${users.length === 1 ? 'Watching' : 'Watching'}`;
  }

  const peerGrid = document.getElementById('peer-tiles-grid');
  if (!peerGrid) return;

  const gmeetCountBadge = document.getElementById('gmeet-participants-badge');
  if (gmeetCountBadge) gmeetCountBadge.textContent = users.length;

  peerGrid.innerHTML = '';

  const GMEET_COLORS = ['#1a73e8', '#1e8e3e', '#d93025', '#f9ab00', '#9334e6', '#00897b', '#e8710a', '#d81b60'];
  function getGmeetColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return GMEET_COLORS[Math.abs(hash) % GMEET_COLORS.length];
  }

  const currentSearchTerm = (document.getElementById('gmeet-people-search')?.value || '').toLowerCase().trim();

  users.forEach(user => {
    const tile = document.createElement('div');
    tile.className = 'peer-tile';
    tile.dataset.peerId = user.id;

    const isMe = currentUserId && currentUserId === user.id;
    const volControlHtml = !isMe ? `
      <div class="peer-volume-row" title="Volume & Mute for ${escapeHtml(user.username)}">
        <button type="button" class="peer-mute-btn" data-peer-id="${user.id}" title="Mute for Me" aria-label="Mute for Me">
          <svg class="speaker-on-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <svg class="speaker-off-icon" style="display: none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        </button>
        <input type="range" class="peer-vol-slider" min="0" max="1.5" step="0.05" value="1" title="Volume slider (up to 150%)">
      </div>
    ` : '';

    const isMuted = user.isMuted !== false;
    const avatarColor = user.avatarColor || getGmeetColor(user.username || 'User');
    const initial = (user.username || 'U').charAt(0).toUpperCase();

    tile.innerHTML = `
      <video class="peer-video" autoplay playsinline ${isMe ? 'muted' : ''} style="display: none;"></video>
      <div class="peer-avatar" style="background-color: ${avatarColor}">
        ${initial}
      </div>
      <div class="peer-label">
        <span class="gmeet-peer-name">
          ${escapeHtml(user.username)}
          ${isMe ? '<span class="gmeet-tag-you">(You)</span>' : ''}
        </span>
        ${user.isHost ? '<span class="gmeet-tag-host">Host</span>' : ''}
      </div>
      <div class="gmeet-peer-trailing">
        ${volControlHtml}
        <span class="peer-mic-status ${isMuted ? 'muted' : ''}" title="${isMuted ? 'Microphone Off' : 'Microphone On'}">
          ${isMuted ? MIC_OFF_SVG : MIC_ON_SVG}
        </span>
        <button type="button" class="gmeet-peer-menu-btn" title="More options" aria-label="More options">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>
      <div class="peer-vu-meter-container" title="Live Voice Meter"><div class="peer-vu-bar"></div></div>
    `;

    // Attach active camera video stream if camera is on
    const videoEl = tile.querySelector('.peer-video');
    const avatarEl = tile.querySelector('.peer-avatar');
    if (isMe) {
      tile.dataset.isMe = 'true';
      if (webrtcMgr && webrtcMgr.isCameraOn && webrtcMgr.localStream && videoEl) {
        videoEl.srcObject = webrtcMgr.localStream;
        videoEl.style.display = 'block';
        if (avatarEl) avatarEl.style.display = 'none';
        videoEl.play().catch(() => {});
      }
    } else if (webrtcMgr && videoEl) {
      const peerObj = webrtcMgr.peers ? webrtcMgr.peers.get(user.id) : null;
      if (peerObj && peerObj.videoStream) {
        videoEl.srcObject = peerObj.videoStream;
        videoEl.style.display = 'block';
        if (avatarEl) avatarEl.style.display = 'none';
        videoEl.play().catch(() => {});
      }
    }

    if (currentSearchTerm && !user.username.toLowerCase().includes(currentSearchTerm)) {
      tile.style.display = 'none';
    }

    const volSlider = tile.querySelector('.peer-vol-slider');
    const muteBtn = tile.querySelector('.peer-mute-btn');
    if (volSlider && webrtcMgr) {
      volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseFloat(e.target.value);
        webrtcMgr.setPeerVolume(user.id, val);
        if (muteBtn) {
          const onIcon = muteBtn.querySelector('.speaker-on-icon');
          const offIcon = muteBtn.querySelector('.speaker-off-icon');
          if (val <= 0) {
            muteBtn.classList.add('is-muted');
            if (onIcon) onIcon.style.display = 'none';
            if (offIcon) offIcon.style.display = 'inline-block';
          } else {
            muteBtn.classList.remove('is-muted');
            if (onIcon) onIcon.style.display = 'inline-block';
            if (offIcon) offIcon.style.display = 'none';
          }
        }
      });
      volSlider.addEventListener('click', (e) => e.stopPropagation());
      volSlider.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    if (muteBtn && volSlider && webrtcMgr) {
      let isLocalMuted = false;
      let prevVol = 1;
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isLocalMuted = !isLocalMuted;
        const onIcon = muteBtn.querySelector('.speaker-on-icon');
        const offIcon = muteBtn.querySelector('.speaker-off-icon');

        if (isLocalMuted) {
          prevVol = parseFloat(volSlider.value) || 1;
          volSlider.value = 0;
          webrtcMgr.setPeerVolume(user.id, 0);
          muteBtn.classList.add('is-muted');
          if (onIcon) onIcon.style.display = 'none';
          if (offIcon) offIcon.style.display = 'inline-block';
        } else {
          const restore = prevVol > 0 ? prevVol : 1;
          volSlider.value = restore;
          webrtcMgr.setPeerVolume(user.id, restore);
          muteBtn.classList.remove('is-muted');
          if (onIcon) onIcon.style.display = 'inline-block';
          if (offIcon) offIcon.style.display = 'none';
        }
      });
    }

    peerGrid.appendChild(tile);
  });

  // Initialize Google Meet People actions
  const gmeetSearch = document.getElementById('gmeet-people-search');
  if (gmeetSearch && !gmeetSearch.dataset.bound) {
    gmeetSearch.dataset.bound = 'true';
    gmeetSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#peer-tiles-grid .peer-tile').forEach(tile => {
        const name = tile.querySelector('.gmeet-peer-name')?.textContent?.toLowerCase() || '';
        tile.style.display = (!q || name.includes(q)) ? 'flex' : 'none';
      });
    });
  }

  const btnAddPeople = document.getElementById('btn-gmeet-add-people');
  if (btnAddPeople && !btnAddPeople.dataset.bound) {
    btnAddPeople.dataset.bound = 'true';
    btnAddPeople.addEventListener('click', () => {
      const inviteBtn = document.getElementById('btn-header-invite') || document.getElementById('btn-dock-invite');
      if (inviteBtn) inviteBtn.click();
    });
  }

  const btnTabShortcut = document.getElementById('btn-gmeet-tab-shortcut');
  if (btnTabShortcut && !btnTabShortcut.dataset.bound) {
    btnTabShortcut.dataset.bound = 'true';
    btnTabShortcut.addEventListener('click', () => {
      const screenBtn = document.getElementById('btn-screenshare-trigger');
      if (screenBtn) screenBtn.click();
    });
  }

  // View toggle: Grid vs List (default to Grid view)
  const btnGrid = document.getElementById('btn-gmeet-grid');
  const btnList = document.getElementById('btn-gmeet-list');
  if (btnGrid && !btnGrid.dataset.bound) {
    btnGrid.dataset.bound = 'true';
    btnGrid.addEventListener('click', () => {
      btnGrid.classList.add('active');
      if (btnList) btnList.classList.remove('active');
      const grid = document.getElementById('peer-tiles-grid');
      if (grid) grid.classList.remove('view-list');
      localStorage.setItem('zami_gmeet_view', 'grid');
    });
  }
  if (btnList && !btnList.dataset.bound) {
    btnList.dataset.bound = 'true';
    btnList.addEventListener('click', () => {
      btnList.classList.add('active');
      if (btnGrid) btnGrid.classList.remove('active');
      const grid = document.getElementById('peer-tiles-grid');
      if (grid) grid.classList.add('view-list');
      localStorage.setItem('zami_gmeet_view', 'list');
    });
  }

  const savedView = localStorage.getItem('zami_gmeet_view') || 'grid';
  if (savedView === 'list') {
    if (btnList) btnList.classList.add('active');
    if (btnGrid) btnGrid.classList.remove('active');
    peerGrid.classList.add('view-list');
  } else {
    if (btnGrid) btnGrid.classList.add('active');
    if (btnList) btnList.classList.remove('active');
    peerGrid.classList.remove('view-list');
  }
}

/**
 * Update Host control lock button styling
 */
function updateHostControlsUI(isHost, hostOnlyControls) {
  const btnLock = document.getElementById('btn-toggle-host-controls') || document.getElementById('btn-toggle-host-lock');
  if (!btnLock) return;

  if (!isHost) {
    btnLock.style.display = hostOnlyControls ? 'inline-flex' : 'none';
    btnLock.disabled = true;
    btnLock.innerHTML = `RESTRICTED`;
    btnLock.title = 'Host has restricted playback controls';
  } else {
    btnLock.style.display = 'inline-flex';
    btnLock.disabled = false;
    btnLock.innerHTML = hostOnlyControls
      ? `RESTRICTED (HOST)`
      : `OPEN CONTROLS`;
    btnLock.title = 'Toggle host-only playback control';
  }
  const hostStatusText = document.getElementById('host-controls-status-text');
  if (hostStatusText) {
    hostStatusText.textContent = hostOnlyControls ? 'Enabled (Host Only)' : 'Disabled (Everyone)';
  }
}

let lastChatSender = null;
let lastChatTimestamp = 0;
const recentSystemEvents = new Map();

/**
 * Render Chat Messages with Conversation Grouping & Subtle System Events
 */
function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 75;
  const currentUsername = localStorage.getItem('zami_username') || localStorage.getItem('cinesync_username') || window.currentUsername;
  const isOwn = Boolean(msg.userId && window.universalPlayer?.socketId && msg.userId === window.universalPlayer.socketId) ||
                Boolean(msg.sender && currentUsername && msg.sender === currentUsername);

  if (msg.type === 'system') {
    const text = (msg.text || '').trim();
    const now = Date.now();
    // Deduplicate identical system events (join/leave/sync notices within 25s)
    if (recentSystemEvents.has(text) && (now - recentSystemEvents.get(text) < 25000)) {
      return;
    }
    recentSystemEvents.set(text, now);
    if (recentSystemEvents.size > 40) {
      for (const [k, t] of recentSystemEvents.entries()) {
        if (now - t > 30000) recentSystemEvents.delete(k);
      }
    }

    lastChatSender = null;
    const sysEl = document.createElement('div');
    sysEl.className = 'system-chat-msg';
    sysEl.innerHTML = `<span class="system-bullet">•</span> <span class="system-text">${escapeHtml(msg.text)}</span>`;
    container.appendChild(sysEl);
  } else {
    // Remove empty state if present
    const emptyState = document.getElementById('chat-empty-state');
    if (emptyState) emptyState.remove();

    const now = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();
    const isGrouped = lastChatSender === msg.sender && (now - lastChatTimestamp < 90000);
    lastChatSender = msg.sender;
    lastChatTimestamp = now;

    const timeStr = new Date(msg.timestamp || now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isOwn ? 'own' : 'other'} ${isGrouped ? 'grouped' : ''}`;

    if (isOwn) {
      // Current user's message: sleek gold bubble, no redundant self-name
      bubble.innerHTML = `
        <div class="chat-bubble-text">${escapeHtml(msg.text)}</div>
      `;
    } else if (!isGrouped) {
      // Peer message: show sender name & subtle time
      bubble.innerHTML = `
        <div class="chat-bubble-author" style="color: ${msg.color || 'var(--accent-gold)'}">
          <span class="chat-author-name">${escapeHtml(msg.sender)}</span>
          <span class="chat-timestamp">${timeStr}</span>
        </div>
        <div class="chat-bubble-text">${escapeHtml(msg.text)}</div>
      `;
    } else {
      bubble.innerHTML = `
        <div class="chat-bubble-text">${escapeHtml(msg.text)}</div>
      `;
    }

    container.appendChild(bubble);
  }

  // Rave-Style In-Stage Floating Live Chat Bubble: ONLY show when media is active/playing and placeholder is not visible!
  const placeholderEl = document.getElementById('player-placeholder');
  const isStagePlaceholderVisible = placeholderEl && placeholderEl.style.display !== 'none' && !placeholderEl.classList.contains('hidden');
  const hasActiveMedia = !isStagePlaceholderVisible && window.universalPlayer && (window.universalPlayer.currentSource || window.universalPlayer.isPlaying);
  if (msg.type === 'user' && !window.isStageChatDisabled && hasActiveMedia) {
    const stageChatContainer = document.getElementById('stage-floating-chat');
    if (stageChatContainer && !stageChatContainer.classList.contains('hud-disabled')) {
      const stageBubble = document.createElement('div');
      stageBubble.className = 'stage-chat-bubble';
      stageBubble.innerHTML = `
        <span class="stage-chat-bubble-author" style="color: ${msg.color || 'var(--accent-cyan)'}">${escapeHtml(msg.sender)}:</span>
        <span class="stage-chat-bubble-text">${escapeHtml(msg.text)}</span>
      `;
      stageChatContainer.appendChild(stageBubble);

      // Keep at most 4 bubbles on screen
      while (stageChatContainer.children.length > 4) {
        stageChatContainer.removeChild(stageChatContainer.children[0]);
      }

      // Auto-fade after 6.0 seconds
      setTimeout(() => {
        stageBubble.classList.add('fade-out');
        setTimeout(() => {
          if (stageBubble.parentNode) stageBubble.parentNode.removeChild(stageBubble);
        }, 500);
      }, 6000);
    }
  }

  // Smart auto-scroll: only scroll if user was already at the bottom or sent the message
  if (isNearBottom || isOwn) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Official YouTube Inbuilt Player Suite
 * Embeds official YouTube player directly into CineSync without external tabs or generic search cards.
 * Supports direct official search, curated category feeds, direct ID/URL screening, and room stage sync.
 */
function initYouTubeExplorer(socket) {
  const searchForm = document.getElementById('yt-official-search-form');
  const searchInput = document.getElementById('yt-official-search-input');
  const officialIframe = document.getElementById('yt-official-iframe');
  const directInput = document.getElementById('yt-official-direct-input');
  const btnLoadDirect = document.getElementById('btn-yt-official-load-direct');
  const btnScreenStage = document.getElementById('btn-yt-screen-room-stage');
  const btnQueueRoom = document.getElementById('btn-yt-queue-room');
  const modalVault = document.getElementById('media-modal');

  let currentYtVideoId = 'dQw4w9WgXcQ';
  let currentYtQuery = 'trending';
  let currentYtTitle = 'Official YouTube Stream';

  function extractId(val) {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
    const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
    return match ? match[1] : null;
  }

  function loadEmbed(queryOrId, isDirectId = false) {
    if (!officialIframe) return;
    if (isDirectId) {
      currentYtVideoId = queryOrId;
      currentYtTitle = `YouTube Reel (${queryOrId})`;
      officialIframe.src = `/app/youtube?v=${encodeURIComponent(queryOrId)}`;
    } else {
      currentYtQuery = queryOrId;
      currentYtTitle = `YouTube (${queryOrId})`;
      officialIframe.src = `/app/youtube?q=${encodeURIComponent(queryOrId)}`;
    }
  }

  // Search form submit
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (!q) return;
      const maybeId = extractId(q);
      if (maybeId) {
        loadEmbed(maybeId, true);
        if (directInput) directInput.value = q;
      } else {
        loadEmbed(q, false);
      }
    });
  }

  // Category Pills
  document.querySelectorAll('.btn-yt-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-yt-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = btn.dataset.q;
      if (searchInput) searchInput.value = q;
      loadEmbed(q, false);
    });
  });

  // Direct load button
  if (btnLoadDirect && directInput) {
    btnLoadDirect.addEventListener('click', () => {
      const val = directInput.value.trim();
      if (!val) return;
      const id = extractId(val);
      if (id) {
        loadEmbed(id, true);
        window.showToast(`Loaded YouTube video [${id}] in player`, 'success', 2500);
      } else {
        loadEmbed(val, false);
      }
    });
    directInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnLoadDirect.click();
      }
    });
  }

  // Screen to Main Watch Party Stage
  if (btnScreenStage) {
    btnScreenStage.addEventListener('click', () => {
      let targetUrl = '';
      let title = currentYtTitle || 'Official YouTube Stream';

      const directVal = directInput ? directInput.value.trim() : '';
      const inputId = extractId(directVal);
      if (inputId) {
        targetUrl = `https://www.youtube.com/watch?v=${inputId}`;
        title = `YouTube Video [${inputId}]`;
      } else if (currentYtVideoId && currentYtVideoId !== 'dQw4w9WgXcQ') {
        targetUrl = `https://www.youtube.com/watch?v=${currentYtVideoId}`;
      } else if (currentYtQuery) {
        targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(currentYtQuery)}`;
        title = `YouTube: ${currentYtQuery}`;
      }

      if (!targetUrl) {
        targetUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      }

      if (modalVault) modalVault.classList.remove('active');
      window.showToast(`Screening Official YouTube on Watch Party Stage...`, 'success', 3000);

      socket.emit('change-media', {
        type: 'youtube',
        url: targetUrl,
        title: title,
        poster: inputId ? `https://i.ytimg.com/vi/${inputId}/hqdefault.jpg` : ''
      });
    });
  }

  // Add to party queue
  if (btnQueueRoom) {
    btnQueueRoom.addEventListener('click', () => {
      const directVal = directInput ? directInput.value.trim() : '';
      const id = extractId(directVal) || currentYtVideoId;
      const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(currentYtQuery)}`;
      const title = id ? `YouTube Video [${id}]` : `YouTube (${currentYtQuery})`;
      const poster = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';

      if (window.roomQueueManager) {
        window.roomQueueManager.addItemFromUrl(url, title, poster);
      } else {
        socket.emit('playlist-add', {
          item: { type: 'youtube', url: url, title: title, poster: poster }
        });
        window.showToast(`Queued YouTube: "${title}"`, 'success');
      }
    });
  }

  window.loadOfficialYouTube = loadEmbed;
}

/**
 * Rave Inbuilt Streaming Suite
 * Provides 1-click app switching, Inbuilt Stage App Slates (Netflix, Prime, Hotstar),
 * and Inbuilt Virtual Browser with room broadcast on stage.
 */
function initRaveSuite(socket, roomId) {
  const appStage = document.getElementById('inbuilt-app-stage');
  const appIcon = document.getElementById('inbuilt-app-icon');
  const appBadge = document.getElementById('inbuilt-app-badge');
  const appTitle = document.getElementById('inbuilt-app-title');
  const appDesc = document.getElementById('inbuilt-app-desc');
  const btnStartStream = document.getElementById('btn-inbuilt-start-stream');
  const btnStartCountdown = document.getElementById('btn-inbuilt-start-countdown');
  const btnOpenWebview = document.getElementById('btn-inbuilt-open-site') || document.getElementById('btn-inbuilt-open-webview');
  const btnCloseAppStage = document.getElementById('btn-inbuilt-close');

  const browserContainer = document.getElementById('inbuilt-browser-container');
  const browserIframe = document.getElementById('browser-iframe');
  const browserUrlForm = document.getElementById('browser-url-form');
  const browserUrlInput = document.getElementById('browser-url-input');
  const btnBrowserClose = document.getElementById('btn-browser-close');
  const btnBrowserCast = document.getElementById('btn-browser-cast-stage');
  const btnBrowserBack = document.getElementById('browser-btn-back');
  const btnBrowserForward = document.getElementById('browser-btn-forward');
  const btnBrowserReload = document.getElementById('browser-btn-reload');
  const browserLoading = document.getElementById('browser-loading-bar');
  const modalVault = document.getElementById('media-modal');
  const raveDock = document.getElementById('rave-dock');

  // Remote Browser Canvas, Audio & Status Overlay Elements
  const remoteContainer = document.getElementById('remote-browser-container');
  const remoteCanvas = document.getElementById('remote-browser-canvas');
  const remoteAudio = document.getElementById('remote-browser-audio');
  const remoteOverlay = document.getElementById('remote-browser-status-overlay');
  const remoteStatusText = document.getElementById('remote-status-text');
  const remoteSessionBadge = document.getElementById('remote-session-badge');
  const canvasCtx = remoteCanvas ? remoteCanvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
  if (canvasCtx) {
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = 'high';
  }
  let isRemoteBrowserActive = false;

  const stageQuickForm = document.getElementById('stage-url-quick-form');
  const stageQuickInput = document.getElementById('stage-url-quick-input');

  let currentInbuiltApp = 'netflix';

  const appConfigs = {
    netflix: {
      name: 'Netflix',
      badge: 'RAVE INBUILT // NETFLIX THEATER',
      iconSvg: `<svg class="inbuilt-svg-logo" viewBox="0 0 111 200" width="40" height="72" fill="none">
        <path d="M0 0h37v200H0z" fill="#B1060F"/>
        <path d="M74 0h37v200H74z" fill="#B1060F"/>
        <path d="M0 0h37l74 200h-37L0 0z" fill="#E50914"/>
      </svg>`,
      title: 'Netflix Inbuilt Cinema Stage',
      desc: 'Screen Stranger Things, Squid Game, or your personal watchlist directly inside this ZAMI room with synchronized 1080p 60fps stereo audio.',
      btnText: 'STREAM NETFLIX ON STAGE (1080p STEREO)',
      url: 'https://www.netflix.com'
    },
    prime: {
      name: 'Prime Video',
      badge: 'RAVE INBUILT // PRIME VIDEO',
      iconSvg: `<svg class="inbuilt-svg-logo" viewBox="0 0 130 46" width="110" height="38" fill="none">
        <text x="6" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" letter-spacing="-0.5px">prime</text>
        <text x="76" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#00A8E1" letter-spacing="1px">VIDEO</text>
        <path d="M10 36c18 7 42 7 60-1" fill="none" stroke="#00A8E1" stroke-width="3" stroke-linecap="round"/>
        <path d="M68 32l6 3.5-6 3.5z" fill="#00A8E1"/>
      </svg>`,
      title: 'Prime Video Inbuilt Cinema Stage',
      desc: 'Watch The Boys, Rings of Power, Fallout, and Prime Video blockbusters with synchronized room playback and stereo sound.',
      btnText: 'STREAM PRIME ON STAGE (1080p STEREO)',
      url: 'https://www.primevideo.com'
    },
    hotstar: {
      name: 'Disney+ Hotstar',
      badge: 'RAVE INBUILT // HOTSTAR',
      iconSvg: `<svg class="inbuilt-svg-logo" viewBox="0 0 130 46" width="115" height="38" fill="none">
        <defs>
          <linearGradient id="inbuilt-hs-swoop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00D2FF"/>
            <stop offset="100%" stop-color="#0063E5"/>
          </linearGradient>
          <linearGradient id="inbuilt-hs-star" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFDD00"/>
            <stop offset="100%" stop-color="#FF8800"/>
          </linearGradient>
        </defs>
        <path d="M6 30 C 14 6, 44 2, 64 12" fill="none" stroke="url(#inbuilt-hs-swoop)" stroke-width="2.5" stroke-linecap="round"/>
        <text x="8" y="29" font-family="sans-serif" font-size="17" font-weight="900" fill="#FFFFFF" font-style="italic">Disney+</text>
        <polygon points="78,14 79.5,17.5 83,18 80.5,20.5 81,24 78,22 75,24 75.5,20.5 73,18 76.5,17.5" fill="url(#inbuilt-hs-star)"/>
        <text x="85" y="23" font-family="sans-serif" font-size="8" font-weight="800" fill="#FFB703" letter-spacing="0.5px">HOTSTAR</text>
      </svg>`,
      title: 'Disney+ Hotstar Inbuilt Cinema Stage',
      desc: 'Stream live IPL cricket matches, Marvel Cinematic Universe movies, and Hotstar Specials with real-time soundboard reactions.',
      btnText: 'STREAM HOTSTAR ON STAGE (1080p STEREO)',
      url: 'https://www.hotstar.com'
    },
    crunchyroll: {
      name: 'Crunchyroll',
      badge: 'RAVE INBUILT // CRUNCHYROLL',
      iconSvg: `<svg class="inbuilt-svg-logo" viewBox="0 0 100 46" width="110" height="40" fill="none">
        <g transform="translate(6, 6) scale(0.7)">
          <circle cx="24" cy="24" r="22" fill="#F47521"/>
          <path d="M29 13.5 C22.6 13.5 17.5 18.6 17.5 25 C17.5 31.4 22.6 36.5 29 36.5 C31.1 36.5 33.1 35.9 34.8 34.9 C32.7 33.1 31.4 30.2 31.4 27 C31.4 22.8 33.7 19.2 36.8 17.5 C34.6 15 31.9 13.5 29 13.5 Z" fill="#FFFFFF"/>
          <circle cx="27" cy="25" r="4.5" fill="#F47521"/>
        </g>
        <text x="44" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF">crunchyroll</text>
        <text x="45" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="800" fill="#F47521" letter-spacing="1px">SIMULCAST</text>
      </svg>`,
      title: 'Crunchyroll Anime Inbuilt Stage',
      desc: 'Watch Demon Slayer, Jujutsu Kaisen, One Piece, and the newest anime simulcasts with your room in synchronized 1080p.',
      btnText: 'STREAM CRUNCHYROLL ON STAGE (1080p)',
      url: 'https://www.crunchyroll.com'
    },
    mx: {
      name: 'Amazon MX Player',
      badge: 'RAVE INBUILT // MX PLAYER',
      iconSvg: `<svg class="inbuilt-svg-logo" viewBox="0 0 100 46" width="105" height="38" fill="none">
        <rect x="6" y="5" width="36" height="36" rx="9" fill="#0066FF"/>
        <polygon points="20,15 32,23 20,31" fill="#FFFFFF"/>
        <text x="48" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="900" fill="#FFFFFF">MX</text>
        <text x="49" y="37" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="800" fill="#3B82F6" letter-spacing="1px">PLAYER</text>
      </svg>`,
      title: 'Amazon MX Player Inbuilt Cinema Stage',
      desc: 'Watch thousands of free Bollywood blockbusters, web series, and regional cinema directly on this stage with synchronized 1080p stereo audio.',
      btnText: 'STREAM MX PLAYER ON STAGE (1080p STEREO)',
      url: 'https://www.mxplayer.in'
    }
  };

  function showInbuiltAppStage(appKey) {
    const config = appConfigs[appKey];
    if (!config || !appStage) return;
    currentInbuiltApp = appKey;

    if (browserContainer) browserContainer.style.display = 'none';
    const placeholderEl = document.getElementById('player-placeholder');
    if (placeholderEl) placeholderEl.style.display = 'none';
    if (raveDock) raveDock.style.display = 'none';

    if (appBadge) appBadge.textContent = config.badge;
    if (appIcon) {
      appIcon.innerHTML = config.iconSvg;
      appIcon.style.background = 'transparent';
      appIcon.style.border = 'none';
    }
    if (appTitle) appTitle.textContent = config.title;
    if (appDesc) appDesc.textContent = config.desc;
    if (btnStartStream) btnStartStream.textContent = config.btnText;

    appStage.style.display = 'flex';
  }

  function hideInbuiltAppStage() {
    if (appStage) appStage.style.display = 'none';
    const placeholderEl = document.getElementById('player-placeholder');
    if (placeholderEl && window.universalPlayer && window.universalPlayer.activeType === 'empty') {
      placeholderEl.style.display = 'flex';
      if (raveDock) raveDock.style.display = 'none';
    }
  }

  function openInbuiltBrowser(url = 'https://www.youtube.com') {
    hideInbuiltAppStage();
    const placeholderEl = document.getElementById('player-placeholder');
    if (placeholderEl) placeholderEl.style.display = 'none';
    if (raveDock) raveDock.style.display = 'none';
    if (!browserContainer) return;

    // Pause background media
    const mainVideo = document.getElementById('main-video');
    if (mainVideo && !mainVideo.paused) {
      try { mainVideo.pause(); } catch(e) {}
    }
    if (window.universalPlayer && typeof window.universalPlayer.pause === 'function') {
      try { window.universalPlayer.pause(); } catch(e) {}
    }
    const embedContainer = document.getElementById('embed-player-container');
    if (embedContainer) embedContainer.style.display = 'none';

    // Show stage container with canvas visible, hide fallback iframe
    browserContainer.style.display = 'flex';
    const playerWrapper = document.querySelector('.player-wrapper');
    if (playerWrapper) playerWrapper.classList.add('browser-active');
    if (remoteContainer) remoteContainer.style.display = 'block';
    if (browserIframe) browserIframe.style.display = 'none';

    let target = (url || '').trim();
    if (!target) target = 'https://www.youtube.com';
    if (!target.includes('.') || target.includes(' ')) {
      target = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(target);
    } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    if (browserUrlInput) browserUrlInput.value = target;

    // Native Playback Interception Engine (Guaranteed zero-lag 1080p 60fps GPU decode)
    const classified = window.mediaSourceManager ? window.mediaSourceManager.classifyUrl(target) : null;
    if (classified) {
      if (browserContainer) browserContainer.style.display = 'none';
      if (window.mediaSourceManager) window.mediaSourceManager.silenceAndTeardownAll();

      const title = classified === 'youtube'
        ? 'YouTube Official Stream'
        : (target.toLowerCase().includes('.m3u8') ? 'HLS Adaptive Stream' : 'Direct Video Stream');

      if (window.universalPlayer) {
        window.universalPlayer.loadSource({
          type: classified,
          url: target,
          title: title
        });
      }
      socket.emit('change-media', {
        type: classified,
        url: target,
        title: title
      });
      if (window.showToast) {
        window.showToast('Routing to Native 1080p 60fps Player (Zero Server Lag)', 'success');
      }
      return;
    }

    // Silence all native HTML5 player or YouTube player media elements before remote browser starts
    if (window.mediaSourceManager) {
      window.mediaSourceManager.silenceAndTeardownAll();
      const token = window.mediaSourceManager.acquireTransition('remote_browser');
      window.mediaSourceManager.commitTransition(token);
    } else if (window.universalPlayer) {
      try { window.universalPlayer.pause(); } catch(e) {}
    }

    // Show status overlay
    if (remoteOverlay) {
      remoteOverlay.style.display = 'flex';
      if (remoteStatusText) remoteStatusText.textContent = `Connecting to genuine remote browser for ${target}...`;
    }

    connectRemoteAudio();

    if (isRemoteBrowserActive) {
      socket.emit('remote-browser-navigate', { url: target });
    } else {
      socket.emit('remote-browser-start', { url: target });
    }
  }

  // High-performance canvas frame decoding with decoupled rAF render loop
  let frameImg = new Image();
  let isDrawingFrame = false;
  let pendingFrame = null;
  let rafPending = false;

  function scheduleFrameDraw() {
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      if (!pendingFrame || isDrawingFrame || !canvasCtx || !remoteCanvas) return;
      isDrawingFrame = true;
      const frameData = pendingFrame;
      pendingFrame = null;

      frameImg.onload = () => {
        if (frameImg.naturalWidth && (remoteCanvas.width !== frameImg.naturalWidth || remoteCanvas.height !== frameImg.naturalHeight)) {
          remoteCanvas.width = frameImg.naturalWidth;
          remoteCanvas.height = frameImg.naturalHeight;
          if (canvasCtx) {
            canvasCtx.imageSmoothingEnabled = true;
            canvasCtx.imageSmoothingQuality = 'high';
          }
        }
        canvasCtx.drawImage(frameImg, 0, 0, remoteCanvas.width, remoteCanvas.height);
        isDrawingFrame = false;
        if (remoteOverlay && remoteOverlay.style.display !== 'none') {
          remoteOverlay.style.display = 'none';
        }
        if (pendingFrame) {
          scheduleFrameDraw();
        }
      };
      frameImg.onerror = () => {
        isDrawingFrame = false;
      };
      frameImg.src = 'data:image/jpeg;base64,' + frameData;
    });
  }

  socket.on('remote-browser-frame', (payload) => {
    if (!payload || !payload.data) return;
    pendingFrame = payload.data;
    scheduleFrameDraw();
    isRemoteBrowserActive = true;
    if (browserContainer && browserContainer.style.display !== 'flex') {
      hideInbuiltAppStage();
      const placeholderEl = document.getElementById('player-placeholder');
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (raveDock) raveDock.style.display = 'none';
      browserContainer.style.display = 'flex';
      if (remoteContainer) remoteContainer.style.display = 'block';
      if (browserIframe) browserIframe.style.display = 'none';
    }
    if (remoteAudio && (!remoteAudio.src || remoteAudio.src === '' || remoteAudio.src.endsWith('/undefined'))) {
      connectRemoteAudio();
    }
  });

  // Audio capture management (PulseAudio monitor -> HTTP MP3 stream)
  const unmuteBanner = document.getElementById('unmute-banner');
  const remoteStageUnmutePill = document.getElementById('remote-stage-unmute-pill');
  const btnRemoteAudioToggle = document.getElementById('btn-remote-audio-toggle');
  const remoteAudioToggleText = document.getElementById('remote-audio-toggle-text');

  let currentAudioRoom = null;
  let audioRetryTimer = null;

  function updateAudioToggleUI() {
    if (!remoteAudioToggleText) return;
    if (!remoteAudio || remoteAudio.muted || remoteAudio.paused) {
      remoteAudioToggleText.textContent = 'MUTED';
      if (btnRemoteAudioToggle) {
        btnRemoteAudioToggle.classList.remove('active');
        btnRemoteAudioToggle.title = 'Click to Unmute Stage Audio';
      }
    } else {
      remoteAudioToggleText.textContent = 'AUDIO ON';
      if (btnRemoteAudioToggle) {
        btnRemoteAudioToggle.classList.add('active');
        btnRemoteAudioToggle.title = 'Click to Mute Stage Audio';
      }
    }
  }

  function showUnmutePrompts() {
    // Prevent double-banner collision: generic video unmute banner is suppressed in remote browser
    if (unmuteBanner) unmuteBanner.style.display = 'none';
    if (remoteStageUnmutePill) remoteStageUnmutePill.style.display = 'flex';
    updateAudioToggleUI();
  }

  function hideUnmutePrompts() {
    if (remoteStageUnmutePill) remoteStageUnmutePill.style.display = 'none';
    if (unmuteBanner && isRemoteBrowserActive) unmuteBanner.style.display = 'none';
    updateAudioToggleUI();
  }

  function attemptPlayRemoteAudio() {
    if (!remoteAudio) return;
    const room = roomId || window.currentRoomId;
    if (!remoteAudio.src || remoteAudio.src === '' || remoteAudio.src.endsWith('/undefined')) {
      if (room) {
        currentAudioRoom = room;
        remoteAudio.src = `/api/remote-browser/audio/${room}?t=${Date.now()}`;
        remoteAudio.load();
      } else {
        return;
      }
    }
    remoteAudio.muted = false;
    remoteAudio.volume = 1;
    const playPromise = remoteAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        hideUnmutePrompts();
      }).catch(err => {
        console.log('[RemoteBrowser] Waiting for user interaction to unlock audio:', err.message);
        showUnmutePrompts();
      });
    }
  }

  function connectRemoteAudio() {
    if (!remoteAudio) return;
    const room = roomId || window.currentRoomId;
    if (!room) return;

    // If already connected and playing for this room, do not reset stream
    if (currentAudioRoom === room && !remoteAudio.paused && !remoteAudio.error && remoteAudio.src) {
      return;
    }

    currentAudioRoom = room;
    const audioSrc = `/api/remote-browser/audio/${room}?t=${Date.now()}`;
    remoteAudio.src = audioSrc;
    remoteAudio.load();
    attemptPlayRemoteAudio();
  }

  function disconnectRemoteAudio() {
    currentAudioRoom = null;
    if (audioRetryTimer) {
      clearTimeout(audioRetryTimer);
      audioRetryTimer = null;
    }
    if (!remoteAudio) return;
    remoteAudio.pause();
    remoteAudio.removeAttribute('src');
    remoteAudio.load();
    hideUnmutePrompts();
  }

  if (remoteAudio) {
    remoteAudio.addEventListener('error', (e) => {
      console.warn('[RemoteAudio] Audio element stream error, scheduling reconnection in 2s...', e);
      if (audioRetryTimer) clearTimeout(audioRetryTimer);
      audioRetryTimer = setTimeout(() => {
        if (isRemoteBrowserActive) {
          currentAudioRoom = null;
          connectRemoteAudio();
        }
      }, 2000);
    });

    remoteAudio.addEventListener('pause', () => {
      updateAudioToggleUI();
    });

    remoteAudio.addEventListener('playing', () => {
      hideUnmutePrompts();
    });
  }

  if (btnRemoteAudioToggle) {
    btnRemoteAudioToggle.addEventListener('click', () => {
      if (!remoteAudio) return;
      if (!remoteAudio.src || remoteAudio.paused) {
        connectRemoteAudio();
        attemptPlayRemoteAudio();
      } else {
        remoteAudio.muted = !remoteAudio.muted;
      }
      updateAudioToggleUI();
    });
  }

  if (remoteStageUnmutePill) {
    remoteStageUnmutePill.addEventListener('click', (e) => {
      e.stopPropagation();
      attemptPlayRemoteAudio();
    });
  }

  if (unmuteBanner) {
    unmuteBanner.addEventListener('click', () => {
      attemptPlayRemoteAudio();
    });
  }

  // Seamless Audio Auto-Unlock on ANY user gesture (click, pointerdown, keydown, touchstart)
  const gestureUnlockEvents = ['click', 'pointerdown', 'keydown', 'touchstart'];
  function handleUserAudioGestureUnlock() {
    if (remoteAudio && isRemoteBrowserActive) {
      if (remoteAudio.paused || remoteAudio.muted || !remoteAudio.src) {
        attemptPlayRemoteAudio();
      }
    }
    if (window.universalPlayer) {
      if (typeof window.universalPlayer.isMuted === 'function' && window.universalPlayer.isMuted()) {
        if (typeof window.universalPlayer.unmute === 'function') {
          window.universalPlayer.unmute();
        }
      } else if (window.universalPlayer.videoEl && window.universalPlayer.videoEl.muted) {
        if (typeof window.universalPlayer.unmute === 'function') {
          window.universalPlayer.unmute();
        }
      }
    }
  }

  gestureUnlockEvents.forEach(evtName => {
    document.addEventListener(evtName, handleUserAudioGestureUnlock, { passive: true });
  });

  // Remote browser status updates
  socket.on('remote-browser-status', ({ status, message, url, title, qualityMode, width, height }) => {
    const customControls = document.getElementById('custom-controls');
    if (status === 'starting') {
      isRemoteBrowserActive = false;
      if (browserContainer) browserContainer.style.display = 'flex';
      if (remoteContainer) remoteContainer.style.display = 'block';
      if (browserIframe) browserIframe.style.display = 'none';
      if (remoteOverlay) {
        remoteOverlay.style.display = 'flex';
        if (remoteStatusText) remoteStatusText.textContent = message || 'Starting remote browser session...';
      }
      if (remoteSessionBadge) remoteSessionBadge.textContent = 'STARTING...';
    } else if (status === 'ready') {
      isRemoteBrowserActive = true;
      window.isRemoteBrowserActive = true;
      window.socket = socket;
      // Pause any existing native player playback to prevent double audio
      if (window.universalPlayer && typeof window.universalPlayer.pause === 'function') {
        try { window.universalPlayer.pause(); } catch(e) {}
      }
      hideInbuiltAppStage();
      const placeholderEl = document.getElementById('player-placeholder');
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (raveDock) raveDock.style.display = 'none';
      if (browserContainer) browserContainer.style.display = 'flex';
      if (remoteContainer) remoteContainer.style.display = 'block';
      if (browserIframe) browserIframe.style.display = 'none';
      if (remoteOverlay) remoteOverlay.style.display = 'none';
      if (remoteSessionBadge) remoteSessionBadge.innerHTML = '<span class="live-dot-teal"></span>REMOTE // LIVE';
      if (url && browserUrlInput) browserUrlInput.value = url;
      if (customControls) customControls.style.display = 'none'; // Hide duplicate media scrubber
      const qText = document.getElementById('remote-quality-toggle-text');
      if (qualityMode && qText) {
        qText.textContent = qualityMode === 'ultra' ? '1080p Ultra' : qualityMode === '720p' ? '720p Fast' : '1080p HD';
      }
      connectRemoteAudio();
    } else if (status === 'closed') {
      isRemoteBrowserActive = false;
      window.isRemoteBrowserActive = false;
      disconnectRemoteAudio();
      if (customControls) customControls.style.display = '';
      if (remoteOverlay) {
        remoteOverlay.style.display = 'flex';
        if (remoteStatusText) remoteStatusText.textContent = 'Remote browser session ended.';
      }
      if (remoteSessionBadge) remoteSessionBadge.textContent = 'OFFLINE';
    } else if (status === 'error') {
      isRemoteBrowserActive = false;
      window.isRemoteBrowserActive = false;
      disconnectRemoteAudio();
      if (customControls) customControls.style.display = '';
      if (remoteOverlay) {
        remoteOverlay.style.display = 'flex';
        if (remoteStatusText) remoteStatusText.textContent = `Error: ${message || 'Failed to start browser'}`;
      }
      if (remoteSessionBadge) remoteSessionBadge.textContent = 'ERROR';
      if (window.showToast) window.showToast(`Remote Browser: ${message}`, 'error', 5000);
    }
  });

  socket.on('remote-browser-navigated', ({ url, title }) => {
    if (url && browserUrlInput) {
      browserUrlInput.value = url;
    }
    if (remoteSessionBadge && title) {
      remoteSessionBadge.title = title;
    }
  });

  // Query existing remote browser status when entering room
  socket.emit('remote-browser-get-status');

  // Interactive Mouse & Keyboard forwarders on Canvas (1280x720)
  if (remoteCanvas) {
    function getCanvasCoords(e) {
      const rect = remoteCanvas.getBoundingClientRect();
      const scaleX = remoteCanvas.width / (rect.width || 1);
      const scaleY = remoteCanvas.height / (rect.height || 1);
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY)
      };
    }

    let lastMove = 0;
    remoteCanvas.addEventListener('mousemove', (e) => {
      if (!isRemoteBrowserActive) return;
      const now = Date.now();
      if (now - lastMove < 30) return; // ~33 fps mouse sampling
      lastMove = now;
      const coords = getCanvasCoords(e);
      socket.emit('remote-browser-mouse', {
        type: 'mouseMoved',
        x: coords.x,
        y: coords.y,
        button: 'none'
      });
    });

    remoteCanvas.addEventListener('mousedown', (e) => {
      if (!isRemoteBrowserActive) return;
      remoteCanvas.focus();
      // Unlock audio playback on first click
      attemptPlayRemoteAudio();
      const coords = getCanvasCoords(e);
      const btn = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : e.button === 2 ? 'right' : 'left';
      socket.emit('remote-browser-mouse', {
        type: 'mousePressed',
        x: coords.x,
        y: coords.y,
        button: btn,
        clickCount: 1
      });
    });

    remoteCanvas.addEventListener('mouseup', (e) => {
      if (!isRemoteBrowserActive) return;
      const coords = getCanvasCoords(e);
      const btn = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : e.button === 2 ? 'right' : 'left';
      socket.emit('remote-browser-mouse', {
        type: 'mouseReleased',
        x: coords.x,
        y: coords.y,
        button: btn,
        clickCount: 1
      });
    });

    remoteCanvas.addEventListener('wheel', (e) => {
      if (!isRemoteBrowserActive) return;
      e.preventDefault();
      const coords = getCanvasCoords(e);
      socket.emit('remote-browser-mouse', {
        type: 'mouseWheel',
        x: coords.x,
        y: coords.y,
        deltaX: e.deltaX,
        deltaY: e.deltaY
      });
    }, { passive: false });

    remoteCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    remoteCanvas.addEventListener('keydown', (e) => {
      if (!isRemoteBrowserActive) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(e.code)) {
        e.preventDefault();
      }
      let modifiers = 0;
      if (e.altKey) modifiers |= 1;
      if (e.ctrlKey) modifiers |= 2;
      if (e.metaKey) modifiers |= 4;
      if (e.shiftKey) modifiers |= 8;

      const text = e.key === 'Enter' ? '\r' : (e.key.length === 1 && !e.ctrlKey && !e.metaKey ? e.key : '');

      socket.emit('remote-browser-key', {
        type: 'keyDown',
        key: e.key,
        code: e.code,
        text,
        windowsVirtualKeyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        modifiers
      });
    });

    remoteCanvas.addEventListener('keyup', (e) => {
      if (!isRemoteBrowserActive) return;
      let modifiers = 0;
      if (e.altKey) modifiers |= 1;
      if (e.ctrlKey) modifiers |= 2;
      if (e.metaKey) modifiers |= 4;
      if (e.shiftKey) modifiers |= 8;

      socket.emit('remote-browser-key', {
        type: 'keyUp',
        key: e.key,
        code: e.code,
        windowsVirtualKeyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        modifiers
      });
    });

    // Full Mobile Touch & Gesture Forwarding (Tap-to-click, Swipe-to-scroll, Audio auto-unlock)
    let activeTouch = null;
    function getTouchCanvasCoords(touch) {
      const rect = remoteCanvas.getBoundingClientRect();
      const canvasW = remoteCanvas.width || 1920;
      const canvasH = remoteCanvas.height || 1080;
      const canvasAspect = canvasW / (canvasH || 1);
      const rectAspect = (rect.width || 1) / (rect.height || 1);

      let renderWidth = rect.width;
      let renderHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (rectAspect > canvasAspect) {
        // Letterboxed on left and right (pillarbox)
        renderWidth = rect.height * canvasAspect;
        offsetX = (rect.width - renderWidth) / 2;
      } else {
        // Letterboxed on top and bottom
        renderHeight = rect.width / canvasAspect;
        offsetY = (rect.height - renderHeight) / 2;
      }

      const clientX = touch.clientX - rect.left - offsetX;
      const clientY = touch.clientY - rect.top - offsetY;

      const scaleX = canvasW / (renderWidth || 1);
      const scaleY = canvasH / (renderHeight || 1);

      return {
        x: Math.round(Math.max(0, Math.min(canvasW, clientX * scaleX))),
        y: Math.round(Math.max(0, Math.min(canvasH, clientY * scaleY)))
      };
    }

    remoteCanvas.addEventListener('touchstart', (e) => {
      if (!isRemoteBrowserActive || e.touches.length === 0) return;
      const t = e.touches[0];
      const coords = getTouchCanvasCoords(t);
      activeTouch = {
        id: t.identifier,
        startX: coords.x,
        startY: coords.y,
        lastClientX: t.clientX,
        lastClientY: t.clientY,
        startTime: Date.now(),
        moved: false
      };
      remoteCanvas.focus();
      attemptPlayRemoteAudio();
    }, { passive: false });

    remoteCanvas.addEventListener('touchmove', (e) => {
      if (!isRemoteBrowserActive || !activeTouch) return;
      const t = Array.from(e.touches).find(touch => touch.identifier === activeTouch.id);
      if (!t) return;
      e.preventDefault(); // Stop mobile pull-to-refresh and window scrolling

      const deltaClientX = t.clientX - activeTouch.lastClientX;
      const deltaClientY = t.clientY - activeTouch.lastClientY;
      activeTouch.lastClientX = t.clientX;
      activeTouch.lastClientY = t.clientY;

      if (Math.abs(deltaClientX) > 2 || Math.abs(deltaClientY) > 2) {
        activeTouch.moved = true;
        const coords = getTouchCanvasCoords(t);
        // Emits mouseWheel with natural momentum
        socket.emit('remote-browser-mouse', {
          type: 'mouseWheel',
          x: coords.x,
          y: coords.y,
          deltaX: Math.round(-deltaClientX * 2.2),
          deltaY: Math.round(-deltaClientY * 2.2)
        });
      }
    }, { passive: false });

    remoteCanvas.addEventListener('touchend', (e) => {
      if (!isRemoteBrowserActive || !activeTouch) return;
      const duration = Date.now() - activeTouch.startTime;
      if (!activeTouch.moved && duration < 400) {
        // Crisp Tap -> Click!
        socket.emit('remote-browser-mouse', {
          type: 'mousePressed',
          x: activeTouch.startX,
          y: activeTouch.startY,
          button: 'left',
          clickCount: 1
        });
        setTimeout(() => {
          socket.emit('remote-browser-mouse', {
            type: 'mouseReleased',
            x: activeTouch.startX,
            y: activeTouch.startY,
            button: 'left',
            clickCount: 1
          });
        }, 30);
      }
      activeTouch = null;
    }, { passive: false });

    remoteCanvas.addEventListener('touchcancel', () => {
      activeTouch = null;
    });
  }

  // Dual-Fader Audio Controls & Smart Auto-Ducking
  let masterStageVolume = 1.0;
  let masterVoiceVolume = 1.0;
  let isVoiceDuckingEnabled = false; // Disabled by default so stream volume never dips or sounds quiet
  let isStageCurrentlyDucked = false;
  let duckingReleaseTimer = null;

  const volumeSlider = document.getElementById('volume-slider');
  const ctrlVolume = document.getElementById('ctrl-volume');
  const settingsStageVolume = document.getElementById('settings-stage-volume');
  const settingsStageVolumeVal = document.getElementById('settings-stage-volume-val');
  const settingsVoiceVolume = document.getElementById('settings-voice-volume');
  const settingsVoiceVolumeVal = document.getElementById('settings-voice-volume-val');
  const btnToggleVoiceDucking = document.getElementById('btn-toggle-voice-ducking');
  const voiceDuckingText = document.getElementById('voice-ducking-text');
  const audioDuckingBadge = document.getElementById('audio-ducking-status-badge');

  function applyStageVolume(effectiveVol) {
    if (remoteAudio) {
      if (window.volumeBooster) {
        window.volumeBooster.applyToElement(remoteAudio, effectiveVol);
      } else {
        remoteAudio.volume = Math.min(1, effectiveVol);
      }
      if (effectiveVol > 0) {
        remoteAudio.muted = false;
      }
    }
    if (window.universalPlayer && typeof window.universalPlayer.setVolume === 'function') {
      window.universalPlayer.setVolume(effectiveVol);
    }
    if (window.universalPlayer && window.universalPlayer.videoEl && effectiveVol > 0) {
      window.universalPlayer.videoEl.muted = false;
    }
  }

  function setStageVolume(vol) {
    masterStageVolume = Math.max(0, Math.min(3, vol));
    if (settingsStageVolume) settingsStageVolume.value = masterStageVolume;
    if (volumeSlider) volumeSlider.value = masterStageVolume;

    const pct = Math.round(masterStageVolume * 100);
    if (settingsStageVolumeVal) {
      settingsStageVolumeVal.textContent = pct > 100 ? `${pct}% (⚡ Boost)` : `${pct}%`;
      settingsStageVolumeVal.classList.toggle('boosted', pct > 100);
    }

    document.querySelectorAll('.btn-quick-boost[data-target="stage"]').forEach(btn => {
      const bVal = parseFloat(btn.dataset.boost);
      btn.classList.toggle('active', Math.abs(bVal - masterStageVolume) < 0.05);
    });

    const effective = isStageCurrentlyDucked ? (masterStageVolume * 0.75) : masterStageVolume;
    applyStageVolume(effective);
  }

  function setVoiceVolume(vol) {
    masterVoiceVolume = Math.max(0, Math.min(3, vol));
    if (settingsVoiceVolume) settingsVoiceVolume.value = masterVoiceVolume;

    const pct = Math.round(masterVoiceVolume * 100);
    if (settingsVoiceVolumeVal) {
      settingsVoiceVolumeVal.textContent = pct > 100 ? `${pct}% (⚡ Boost)` : `${pct}%`;
      settingsVoiceVolumeVal.classList.toggle('boosted', pct > 100);
    }

    document.querySelectorAll('.btn-quick-boost[data-target="voice"]').forEach(btn => {
      const bVal = parseFloat(btn.dataset.boost);
      btn.classList.toggle('active', Math.abs(bVal - masterVoiceVolume) < 0.05);
    });

    if (window.volumeBooster) {
      window.volumeBooster.setVoiceVolume(masterVoiceVolume);
    }

    if (window.webrtcManager && typeof window.webrtcManager.setAllPeersVolume === 'function') {
      window.webrtcManager.setAllPeersVolume(masterVoiceVolume);
    }
  }

  if (settingsStageVolume) {
    settingsStageVolume.addEventListener('input', (e) => {
      setStageVolume(parseFloat(e.target.value));
    });
  }

  if (settingsVoiceVolume) {
    settingsVoiceVolume.addEventListener('input', (e) => {
      setVoiceVolume(parseFloat(e.target.value));
    });
  }

  // Quick Boost Buttons in Settings Modal
  document.querySelectorAll('.btn-quick-boost').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const boostVal = parseFloat(btn.dataset.boost);
      if (target === 'stage') {
        setStageVolume(boostVal);
        if (window.showToast) {
          const pct = Math.round(boostVal * 100);
          window.showToast(pct > 100 ? `⚡ Stage Volume Boosted to ${pct}%` : `Stage Volume: ${pct}%`, 'info', 1500);
        }
      } else if (target === 'voice') {
        setVoiceVolume(boostVal);
        if (window.showToast) {
          const pct = Math.round(boostVal * 100);
          window.showToast(pct > 100 ? `⚡ Friends Voice Boosted to ${pct}%` : `Friends Voice Volume: ${pct}%`, 'info', 1500);
        }
      }
    });
  });

  if (btnToggleVoiceDucking) {
    btnToggleVoiceDucking.addEventListener('click', () => {
      isVoiceDuckingEnabled = !isVoiceDuckingEnabled;
      if (isVoiceDuckingEnabled) {
        btnToggleVoiceDucking.classList.add('active');
        if (voiceDuckingText) voiceDuckingText.textContent = 'Enabled';
        if (audioDuckingBadge) {
          audioDuckingBadge.textContent = 'Auto-Ducking Ready';
          audioDuckingBadge.className = 'badge-mini-gold';
        }
      } else {
        btnToggleVoiceDucking.classList.remove('active');
        if (voiceDuckingText) voiceDuckingText.textContent = 'Disabled';
        if (audioDuckingBadge) {
          audioDuckingBadge.textContent = 'Ducking Off';
          audioDuckingBadge.className = 'badge-mini-gray';
        }
        if (isStageCurrentlyDucked) {
          isStageCurrentlyDucked = false;
          applyStageVolume(masterStageVolume);
        }
      }
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      setStageVolume(parseFloat(volumeSlider.value));
    });
  }

  if (ctrlVolume) {
    // ctrlVolume click is cleanly managed by UniversalPlayer.toggleMute() to eliminate double-toggle state inversion
  }

  window.onRemotePeerSpeakingChange = function(anyPeerSpeaking) {
    if (!isVoiceDuckingEnabled) return;

    if (anyPeerSpeaking) {
      if (duckingReleaseTimer) {
        clearTimeout(duckingReleaseTimer);
        duckingReleaseTimer = null;
      }
      if (!isStageCurrentlyDucked) {
        isStageCurrentlyDucked = true;
        applyStageVolume(masterStageVolume * 0.75);
        if (audioDuckingBadge) {
          audioDuckingBadge.textContent = 'Ducking Active (-25%)';
          audioDuckingBadge.className = 'badge-mini-gold pulse-gold';
        }
      }
    } else {
      if (isStageCurrentlyDucked && !duckingReleaseTimer) {
        duckingReleaseTimer = setTimeout(() => {
          isStageCurrentlyDucked = false;
          duckingReleaseTimer = null;
          applyStageVolume(masterStageVolume);
          if (audioDuckingBadge) {
            audioDuckingBadge.textContent = 'Auto-Ducking Ready';
            audioDuckingBadge.className = 'badge-mini-gold';
          }
        }, 850);
      }
    }
  };

  const appTargetUrls = {
    netflix: 'https://www.netflix.com',
    prime: 'https://www.primevideo.com',
    hotstar: 'https://www.hotstar.com',
    mx: 'https://www.mxplayer.in',
    youtube: 'https://www.youtube.com',
    twitch: 'https://www.twitch.tv',
    crunchyroll: 'https://www.crunchyroll.com'
  };

  // Rave App Buttons (Stage Grid + Dock) - Opens matching Rave sheet for all sources
  document.querySelectorAll('.rave-btn-app').forEach(btn => {
    btn.addEventListener('click', () => {
      const app = btn.dataset.app;
      document.querySelectorAll('.rave-btn-app').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (app === 'vault') {
        openRaveSourceSheet('movies');
        return;
      }
      if (app === 'browser') {
        openInbuiltBrowser('https://www.google.com');
        return;
      }
      openRaveSourceSheet(app);
    });
  });

  // Start Inbuilt Stream
  if (btnStartStream) {
    btnStartStream.addEventListener('click', () => {
      const config = appConfigs[currentInbuiltApp] || { name: 'App' };
      if (config.url) {
        openInbuiltBrowser(config.url);
      } else {
        hideInbuiltAppStage();
        if (window.webrtcManager) {
          window.webrtcManager.toggleScreenShare();
        }
      }
    });
  }

  // Open Official Website directly embedded on stage (zero external tabs)
  const btnInbuiltOpenSite = document.getElementById('btn-inbuilt-open-site');
  if (btnInbuiltOpenSite) {
    btnInbuiltOpenSite.addEventListener('click', () => {
      const config = appConfigs[currentInbuiltApp];
      if (config && config.url) {
        openInbuiltBrowser(config.url);
      }
    });
  }

  // Synchronized Party Countdown (3... 2... 1... PLAY!) for Co-Watching
  if (btnStartCountdown) {
    btnStartCountdown.addEventListener('click', () => {
      socket.emit('sync-countdown', { seconds: 3, message: 'Co-Watching Countdown' });
      window.showToast('Initiated 3-2-1 synchronized countdown for room!', 'info', 4000);
    });
  }

  // Open Inbuilt Webview on Stage (Zero External Tabs!)
  if (btnOpenWebview) {
    btnOpenWebview.addEventListener('click', () => {
      const config = appConfigs[currentInbuiltApp];
      if (config && config.url) {
        openInbuiltBrowser(config.url);
      }
    });
  }

  if (btnCloseAppStage) {
    btnCloseAppStage.addEventListener('click', hideInbuiltAppStage);
  }

  // Quick URL Stream Bar on Stage Grid
  if (stageQuickForm && stageQuickInput) {
    stageQuickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let url = stageQuickInput.value.trim();
      if (!url) return;
      openInbuiltBrowser(url);
    });
  }

  // Inbuilt Remote Browser navbar controls
  if (browserUrlForm && browserUrlInput) {
    browserUrlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = browserUrlInput.value.trim();
      if (!val) return;
      const classified = window.mediaSourceManager ? window.mediaSourceManager.classifyUrl(val) : null;
      if (classified) {
        openInbuiltBrowser(val);
        return;
      }
      if (isRemoteBrowserActive) {
        socket.emit('remote-browser-navigate', { url: val });
      } else {
        openInbuiltBrowser(val);
      }
    });
  }

  if (btnBrowserClose && browserContainer) {
    btnBrowserClose.addEventListener('click', () => {
      browserContainer.style.display = 'none';
      const playerWrapper = document.querySelector('.player-wrapper');
      if (playerWrapper) playerWrapper.classList.remove('browser-active');
      socket.emit('remote-browser-stop');
      disconnectRemoteAudio();
      isRemoteBrowserActive = false;
      const placeholderEl = document.getElementById('player-placeholder');
      if (placeholderEl) {
        if (!window.universalPlayer || !window.universalPlayer.activeType || window.universalPlayer.activeType === 'empty') {
          placeholderEl.style.display = 'flex';
        }
      }
    });
  }

  // Broadcast Remote Browser Stage to Room via WebRTC (1080p 30fps with audio)
  if (btnBrowserCast) {
    btnBrowserCast.addEventListener('click', async () => {
      if (!remoteCanvas) return;
      try {
        window.showToast('Broadcasting remote browser stage to room via WebRTC...', 'info', 4000);
        const stream = remoteCanvas.captureStream(30);
        if (remoteAudio && typeof remoteAudio.captureStream === 'function') {
          try {
            const aStream = remoteAudio.captureStream();
            const aTrack = aStream.getAudioTracks()[0];
            if (aTrack) stream.addTrack(aTrack);
          } catch(e) {}
        }
        if (window.webrtcManager) {
          window.webrtcManager.screenStream = stream;
          window.webrtcManager.isSharingScreen = true;
          window.webrtcManager.updateScreenshareUI();
          socket.emit('screenshare-start', { title: 'REMOTE BROWSER // LIVE STAGE' });
          await window.webrtcManager.broadcastScreenTracks();
          window.showToast('Remote browser stage stream broadcasted to room guests!', 'success', 4000);
        }
      } catch (err) {
        console.warn('Canvas captureStream fallback to getDisplayMedia:', err);
        if (window.webrtcManager) window.webrtcManager.toggleScreenShare();
      }
    });
  }

  if (btnBrowserBack) {
    btnBrowserBack.addEventListener('click', () => {
      socket.emit('remote-browser-back');
    });
  }

  if (btnBrowserForward) {
    btnBrowserForward.addEventListener('click', () => {
      socket.emit('remote-browser-forward');
    });
  }

  if (btnBrowserReload) {
    btnBrowserReload.addEventListener('click', () => {
      socket.emit('remote-browser-reload');
    });
  }

  // Remote Browser Quality Switcher (1080p HD <-> 1080p Ultra <-> 720p Fast)
  const btnRemoteQuality = document.getElementById('btn-remote-quality-toggle');
  const remoteQualityText = document.getElementById('remote-quality-toggle-text');
  let currentRemoteQualityMode = '1080p';
  const qualityModes = ['1080p', 'ultra', '720p'];

  if (btnRemoteQuality) {
    btnRemoteQuality.addEventListener('click', () => {
      const nextIdx = (qualityModes.indexOf(currentRemoteQualityMode) + 1) % qualityModes.length;
      currentRemoteQualityMode = qualityModes[nextIdx];
      const label = currentRemoteQualityMode === 'ultra' ? '1080p Ultra' : currentRemoteQualityMode === '720p' ? '720p Fast' : '1080p HD';
      if (remoteQualityText) remoteQualityText.textContent = label;
      socket.emit('remote-browser-set-quality', { quality: currentRemoteQualityMode });
      if (window.showToast) window.showToast(`Remote Browser: Switched to ${label}`, 'info', 3000);
    });
  }

  // 3-2-1 Co-Watching Countdown from Virtual Browser navbar
  const btnBrowserSync = document.getElementById('btn-browser-sync-countdown');
  if (btnBrowserSync) {
    btnBrowserSync.addEventListener('click', () => {
      if (socket) {
        socket.emit('sync-countdown', { seconds: 3, message: 'Co-Watching Countdown' });
        if (window.showToast) window.showToast('Initiated 3-2-1 co-watching countdown for room!', 'info', 4000);
      }
    });
  }

  // Streamlined App Switcher Popover Controller
  const btnBrowserAppsToggle = document.getElementById('btn-browser-apps-toggle');
  const browserAppsMenu = document.getElementById('browser-apps-menu');
  const browserAppsWrapper = document.getElementById('browser-apps-dropdown-wrapper');

  function closeBrowserAppsMenu() {
    if (browserAppsMenu) {
      browserAppsMenu.style.display = 'none';
      if (btnBrowserAppsToggle) {
        btnBrowserAppsToggle.setAttribute('aria-expanded', 'false');
      }
    }
  }
  window.closeBrowserAppsMenu = closeBrowserAppsMenu;

  function toggleBrowserAppsMenu() {
    if (!browserAppsMenu) return;
    const isHidden = browserAppsMenu.style.display === 'none' || !browserAppsMenu.style.display;
    if (isHidden) {
      browserAppsMenu.style.display = 'block';
      if (btnBrowserAppsToggle) {
        btnBrowserAppsToggle.setAttribute('aria-expanded', 'true');
      }
    } else {
      closeBrowserAppsMenu();
    }
  }
  window.toggleBrowserAppsMenu = toggleBrowserAppsMenu;

  if (btnBrowserAppsToggle) {
    btnBrowserAppsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBrowserAppsMenu();
    });
  }

  // Close apps menu on outside click
  document.addEventListener('click', (e) => {
    if (browserAppsWrapper && !browserAppsWrapper.contains(e.target)) {
      closeBrowserAppsMenu();
    }
  });

  // Wire App Switcher item clicks
  document.querySelectorAll('.browser-app-item, .browser-shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      closeBrowserAppsMenu();
      if (url) {
        if (browserUrlInput) browserUrlInput.value = url;
        if (isRemoteBrowserActive) {
          socket.emit('remote-browser-navigate', { url });
        } else {
          openInbuiltBrowser(url);
        }
      }
    });
  });

  // Wire modal inbuilt webview buttons (zero external tabs)
  document.querySelectorAll('.btn-inbuilt-app-webview').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (modalVault) modalVault.classList.remove('active');
      if (url) openInbuiltBrowser(url);
    });
  });

  // Mobile Quick Floating Toolbar & Keyboard Controls
  const btnMobileKb = document.getElementById('btn-browser-mobile-kb');
  const btnMobileKbClose = document.getElementById('btn-browser-mobile-kb-close');
  const mobileKbBar = document.getElementById('browser-mobile-keyboard-bar');
  const mobileKbForm = document.getElementById('browser-mobile-keyboard-form');
  const mobileTextInput = document.getElementById('browser-mobile-text-input');
  const btnMobileAudio = document.getElementById('btn-browser-mobile-audio');
  const btnMobileSync = document.getElementById('btn-browser-mobile-sync');
  const btnMobileCast = document.getElementById('btn-browser-mobile-cast');
  const btnMobileQuality = document.getElementById('btn-browser-mobile-quality');
  const mobileQualityText = document.getElementById('browser-mobile-quality-text');

  if (btnMobileKb) {
    btnMobileKb.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!mobileKbBar) return;
      const isVisible = mobileKbBar.style.display === 'flex' || mobileKbBar.style.display === 'block';
      if (isVisible) {
        mobileKbBar.style.display = 'none';
      } else {
        mobileKbBar.style.display = 'block';
        if (mobileTextInput) {
          setTimeout(() => {
            mobileTextInput.focus();
          }, 50);
        }
      }
    });
  }

  if (btnMobileKbClose && mobileKbBar) {
    btnMobileKbClose.addEventListener('click', () => {
      mobileKbBar.style.display = 'none';
    });
  }

  if (mobileKbForm && mobileTextInput) {
    mobileKbForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = mobileTextInput.value.trim();
      if (!text) return;
      socket.emit('remote-browser-insert-text', { text, pressEnter: true });
      mobileTextInput.value = '';
      if (window.showToast) window.showToast(`Typed "${text}" into remote browser`, 'info', 2000);
      if (mobileKbBar) mobileKbBar.style.display = 'none';
    });
  }

  if (btnMobileAudio) {
    btnMobileAudio.addEventListener('click', () => {
      const btnRemoteAudio = document.getElementById('btn-remote-audio-toggle');
      if (btnRemoteAudio) btnRemoteAudio.click();
    });
  }

  if (btnMobileSync) {
    btnMobileSync.addEventListener('click', () => {
      const btnBrowserSync = document.getElementById('btn-browser-sync-countdown');
      if (btnBrowserSync) btnBrowserSync.click();
    });
  }

  if (btnMobileCast) {
    btnMobileCast.addEventListener('click', () => {
      const btnBrowserCast = document.getElementById('btn-browser-cast-stage');
      if (btnBrowserCast) btnBrowserCast.click();
    });
  }

  if (btnMobileQuality) {
    btnMobileQuality.addEventListener('click', () => {
      const btnRemoteQuality = document.getElementById('btn-remote-quality-toggle');
      if (btnRemoteQuality) {
        btnRemoteQuality.click();
        if (mobileQualityText && currentRemoteQualityMode) {
          mobileQualityText.textContent = currentRemoteQualityMode.toUpperCase();
        }
      }
    });
  }

  // Stage choice card for Virtual Browser
  const btnStageChoiceBrowser = document.getElementById('btn-stage-choice-browser');
  if (btnStageChoiceBrowser) {
    btnStageChoiceBrowser.addEventListener('click', () => {
      openInbuiltBrowser('https://www.google.com');
    });
  }

  // Mobile subplayer quick Virtual Browser button
  const btnMobileBrowserQuick = document.getElementById('btn-mobile-browser-quick');
  if (btnMobileBrowserQuick) {
    btnMobileBrowserQuick.addEventListener('click', () => {
      openInbuiltBrowser('https://www.google.com');
    });
  }

  window.openInbuiltBrowser = openInbuiltBrowser;

  // Listen for postMessage from proxy helper & in-stage portals
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'CINESYNC_BROADCAST_NOW') {
      if (browserContainer) browserContainer.style.display = 'none';
      window.showToast('Connecting 1080p stereo broadcast to room...', 'info', 5000);
      if (window.webrtcManager) {
        window.webrtcManager.toggleScreenShare();
      }
    } else if (e.data && e.data.type === 'CINESYNC_COUNTDOWN') {
      if (socket) {
        socket.emit('sync-countdown', { seconds: 3, message: 'Co-Watching Countdown' });
        window.showToast('Initiated 3-2-1 co-watching countdown for room!', 'info', 4000);
      }
    } else if (e.data && e.data.type === 'CINESYNC_OPEN_MX_VAULT') {
      if (browserContainer) browserContainer.style.display = 'none';
      if (modalVault) {
        modalVault.classList.add('active');
        const mxTab = document.querySelector('.hub-nav-tab[data-tab="mx"]');
        if (mxTab) mxTab.click();
      }
    } else if (e.data && (e.data.type === 'CINESYNC_PLAY_MEDIA' || e.data.type === 'CINESYNC_PLAY_YOUTUBE')) {
      if (browserContainer) browserContainer.style.display = 'none';
      if (modalVault) modalVault.classList.remove('active');
      const streamUrl = e.data.streamUrl || e.data.url;
      const mediaType = e.data.mediaType || (e.data.type === 'CINESYNC_PLAY_YOUTUBE' && !e.data.streamUrl ? 'youtube' : 'hls');
      if (streamUrl && socket) {
        socket.emit('change-media', {
          type: mediaType,
          url: streamUrl,
          title: e.data.title || 'Video',
          poster: e.data.poster || null
        });
      }
      window.showToast(`Screening: ${e.data.title || 'Video'}`, 'success');
    } else if (e.data && (e.data.type === 'CINESYNC_QUEUE_MEDIA' || e.data.type === 'CINESYNC_QUEUE_YOUTUBE')) {
      const streamUrl = e.data.streamUrl || e.data.url;
      const mediaType = e.data.mediaType || (e.data.type === 'CINESYNC_QUEUE_YOUTUBE' && !e.data.streamUrl ? 'youtube' : 'hls');
      if (window.roomQueueManager && window.roomQueueManager.addItemFromUrl) {
        window.roomQueueManager.addItemFromUrl(streamUrl, e.data.title || 'Video', e.data.poster || null, mediaType);
      } else if (socket) {
        socket.emit('playlist-add', {
          item: {
            type: mediaType,
            url: streamUrl,
            title: e.data.title || 'Video',
            poster: e.data.poster || null
          }
        });
        if (window.showToast) window.showToast(`Added to queue: ${e.data.title || 'Video'}`, 'success');
      }
    } else if (e.data && (e.data.type === 'CINESYNC_CLOSE_YOUTUBE' || e.data.type === 'CINESYNC_CLOSE_SOURCE')) {
      closeModal();
    }
  });

  // ==========================================================================
  // FEATURE 2: Synchronized Stage Laser Pointer & Telestrator
  // ==========================================================================
  const laserCanvas = document.getElementById('stage-laser-canvas');
  const btnLaser = document.getElementById('ctrl-laser-pointer');
  const playerWrapperEl = document.querySelector('.player-wrapper');
  let isLaserActive = false;
  let isDrawingLaser = false;
  let lastDrawCoord = null;
  let lastLaserEmitTime = 0;
  const laserTrails = []; // { x0, y0, x1, y1, color, createdAt, duration }
  const remotePointers = new Map(); // senderId -> { x, y, name, color, lastSeen }

  window.toggleLaserPointer = function(force) {
    isLaserActive = force !== undefined ? Boolean(force) : !isLaserActive;
    if (playerWrapperEl) {
      playerWrapperEl.classList.toggle('laser-active', isLaserActive);
    }
    if (btnLaser) {
      btnLaser.classList.toggle('active', isLaserActive);
    }
    if (isLaserActive) {
      window.showToast('Laser Pointer & Telestrator Active (Hold/Drag on Stage)', 'info', 2500);
    } else {
      window.showToast('Laser Pointer Disabled', 'info', 1800);
    }
  };

  if (btnLaser) {
    btnLaser.addEventListener('click', () => {
      window.toggleLaserPointer();
    });
  }

  function getLaserPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  if (laserCanvas) {
    const laserCtx = laserCanvas.getContext('2d');

    // Pointer events on canvas
    laserCanvas.addEventListener('pointerdown', (e) => {
      if (!isLaserActive) return;
      isDrawingLaser = true;
      lastDrawCoord = getLaserPos(e, laserCanvas);
      laserCanvas.setPointerCapture(e.pointerId);
    });

    laserCanvas.addEventListener('pointermove', (e) => {
      if (!isLaserActive) return;
      const pos = getLaserPos(e, laserCanvas);
      const now = Date.now();

      // Broadcast pointer position (throttled ~35ms)
      if (now - lastLaserEmitTime > 35) {
        lastLaserEmitTime = now;
        socket.emit('stage-laser-pointer', { x: pos.x, y: pos.y, color: userColor });
      }

      // If drawing, add line segment and broadcast
      if (isDrawingLaser && lastDrawCoord) {
        const stroke = {
          x0: lastDrawCoord.x,
          y0: lastDrawCoord.y,
          x1: pos.x,
          y1: pos.y,
          color: userColor,
          createdAt: now,
          duration: 2500
        };
        laserTrails.push(stroke);
        socket.emit('stage-laser-draw', stroke);
        lastDrawCoord = pos;
        requestLaserRender();
      }
    });

    const stopDrawing = (e) => {
      isDrawingLaser = false;
      lastDrawCoord = null;
      if (e && e.pointerId && laserCanvas.hasPointerCapture(e.pointerId)) {
        laserCanvas.releasePointerCapture(e.pointerId);
      }
    };

    laserCanvas.addEventListener('pointerup', stopDrawing);
    laserCanvas.addEventListener('pointercancel', stopDrawing);
    laserCanvas.addEventListener('pointerleave', stopDrawing);

    // Socket listeners for peer laser pointer and drawing
    socket.on('stage-laser-pointer', (data) => {
      if (!data || !data.senderId) return;
      remotePointers.set(data.senderId, {
        x: data.x,
        y: data.y,
        name: data.senderName || 'Peer',
        color: data.senderColor || '#00f2fe',
        lastSeen: Date.now()
      });
      requestLaserRender();
    });

    socket.on('stage-laser-draw', (data) => {
      if (!data) return;
      laserTrails.push({
        x0: data.x0,
        y0: data.y0,
        x1: data.x1,
        y1: data.y1,
        color: data.color || '#00f2fe',
        createdAt: Date.now(),
        duration: 2500
      });
      requestLaserRender();
    });

    socket.on('stage-laser-clear', () => {
      laserTrails.length = 0;
      remotePointers.clear();
      if (laserRafId) {
        cancelAnimationFrame(laserRafId);
        laserRafId = null;
      }
      laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
    });

    // Render loop for laser pointer and fading neon strokes (only runs when active)
    let laserRafId = null;
    const requestLaserRender = () => {
      if (!laserRafId) {
        laserRafId = requestAnimationFrame(renderLaserLoop);
      }
    };

    const renderLaserLoop = () => {
      laserRafId = null;
      const w = laserCanvas.width;
      const h = laserCanvas.height;
      laserCtx.clearRect(0, 0, w, h);
      const now = Date.now();

      // 1. Draw glowing neon stroke trails
      for (let i = laserTrails.length - 1; i >= 0; i--) {
        const stroke = laserTrails[i];
        const age = now - stroke.createdAt;
        if (age >= stroke.duration) {
          laserTrails.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, 1 - age / stroke.duration);
        laserCtx.save();
        laserCtx.beginPath();
        laserCtx.moveTo(stroke.x0 * w, stroke.y0 * h);
        laserCtx.lineTo(stroke.x1 * w, stroke.y1 * h);
        laserCtx.strokeStyle = stroke.color;
        laserCtx.lineWidth = 4;
        laserCtx.lineCap = 'round';
        laserCtx.lineJoin = 'round';
        laserCtx.shadowColor = stroke.color;
        laserCtx.shadowBlur = 12;
        laserCtx.globalAlpha = alpha;
        laserCtx.stroke();
        laserCtx.restore();
      }

      // 2. Draw remote laser pointer dots with user name badge
      remotePointers.forEach((pointer, senderId) => {
        const age = now - pointer.lastSeen;
        if (age > 2500) {
          remotePointers.delete(senderId);
          return;
        }

        const px = pointer.x * w;
        const py = pointer.y * h;
        const alpha = Math.max(0, 1 - age / 2500);

        laserCtx.save();
        laserCtx.globalAlpha = alpha;

        // Outer pulsing neon halo
        laserCtx.beginPath();
        laserCtx.arc(px, py, 14, 0, Math.PI * 2);
        laserCtx.fillStyle = pointer.color;
        laserCtx.shadowColor = pointer.color;
        laserCtx.shadowBlur = 18;
        laserCtx.globalAlpha = alpha * 0.4;
        laserCtx.fill();

        // Inner solid dot
        laserCtx.beginPath();
        laserCtx.arc(px, py, 6, 0, Math.PI * 2);
        laserCtx.fillStyle = '#ffffff';
        laserCtx.globalAlpha = alpha;
        laserCtx.fill();

        // Peer name tag
        laserCtx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        const textMetrics = laserCtx.measureText(pointer.name);
        const tagW = textMetrics.width + 14;
        const tagH = 20;
        const tagX = px - tagW / 2;
        const tagY = py - 28;

        laserCtx.fillStyle = 'rgba(10, 12, 18, 0.85)';
        laserCtx.strokeStyle = pointer.color;
        laserCtx.lineWidth = 1;
        if (typeof laserCtx.roundRect === 'function') {
          laserCtx.beginPath();
          laserCtx.roundRect(tagX, tagY, tagW, tagH, 6);
          laserCtx.fill();
          laserCtx.stroke();
        } else {
          laserCtx.fillRect(tagX, tagY, tagW, tagH);
          laserCtx.strokeRect(tagX, tagY, tagW, tagH);
        }

        laserCtx.fillStyle = '#f4f4f5';
        laserCtx.fillText(pointer.name, tagX + 7, tagY + 14);

        laserCtx.restore();
      });

      if (laserTrails.length > 0 || remotePointers.size > 0) {
        laserRafId = requestAnimationFrame(renderLaserLoop);
      }
    };
  }

  // ==========================================================================
  // FEATURE 5: In-Room Trending Cinema Quick Shelf Drawer
  // ==========================================================================
  const quickShelfDrawer = document.getElementById('stage-quick-shelf');
  const btnCloseQuickShelf = document.getElementById('btn-close-quick-shelf');
  const quickShelfContent = document.getElementById('quick-shelf-content');
  const quickShelfTabs = document.querySelectorAll('.quick-shelf-tab');
  const btnQuickShelfCtrl = document.getElementById('ctrl-quick-shelf');

  let curatedMediaData = null;
  let activeQuickShelfCategory = 'trending-movies';

  window.toggleQuickShelf = function(force) {
    if (!quickShelfDrawer) return;
    const isVisible = quickShelfDrawer.style.display !== 'none';
    const shouldShow = force !== undefined ? Boolean(force) : !isVisible;

    quickShelfDrawer.style.display = shouldShow ? 'flex' : 'none';
    if (btnQuickShelfCtrl) {
      btnQuickShelfCtrl.classList.toggle('active', shouldShow);
    }

    if (shouldShow && !curatedMediaData) {
      loadQuickShelfData();
    }
  };

  if (btnCloseQuickShelf) {
    btnCloseQuickShelf.addEventListener('click', () => {
      window.toggleQuickShelf(false);
    });
  }

  quickShelfTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      quickShelfTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeQuickShelfCategory = tab.dataset.cat;
      renderQuickShelfList();
    });
  });

  async function loadQuickShelfData() {
    if (!quickShelfContent) return;
    try {
      const resp = await fetch('/api/tmdb/curated');
      const data = await resp.json();
      if (data && data.success && data.rows) {
        curatedMediaData = data;
        renderQuickShelfList();
      } else {
        renderQuickShelfFallback();
      }
    } catch (err) {
      console.warn('Failed to load curated TMDB data, using fallback:', err);
      renderQuickShelfFallback();
    }
  }

  function renderQuickShelfFallback() {
    if (!quickShelfContent) return;
    const curatedItems = [
      { id: 1290418, title: 'The Cycle', year: '2026', rating: '7.6', mediaType: 'movie', poster: 'https://image.tmdb.org/t/p/w500/n5gSNfZR54U9r9K81yq1R1t68Yk.jpg', overview: 'A dark mystery unfolds in a quiet town.' },
      { id: 157336, title: 'Interstellar', year: '2014', rating: '8.4', mediaType: 'movie', poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', overview: 'A team of explorers travel through a wormhole in space.' },
      { id: 1399, title: 'Game of Thrones', year: '2011', rating: '8.4', mediaType: 'tv', poster: 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg', overview: 'Nine noble families fight for control over the lands of Westeros.' },
      { id: 1084242, title: 'Bad Apples', year: '2026', rating: '7.8', mediaType: 'movie', poster: 'https://image.tmdb.org/t/p/w500/yQUpuUvG9JbW2w8P9X0hQk9C87B.jpg', overview: 'A sharp psychological thriller set in an elite academy.' }
    ];
    curatedMediaData = {
      rows: [
        { id: 'trending-movies', items: curatedItems.filter(i => i.mediaType === 'movie') },
        { id: 'trending-tv', items: curatedItems.filter(i => i.mediaType === 'tv') },
        { id: 'top-rated', items: curatedItems }
      ]
    };
    renderQuickShelfList();
  }

  function renderQuickShelfList() {
    if (!quickShelfContent || !curatedMediaData) return;

    let items = [];
    const targetRow = curatedMediaData.rows.find(r => r.id === activeQuickShelfCategory);
    if (targetRow && targetRow.items) {
      items = targetRow.items;
    } else if (curatedMediaData.rows[0]) {
      items = curatedMediaData.rows[0].items;
    }

    if (!items || items.length === 0) {
      quickShelfContent.innerHTML = `
        <div class="quick-shelf-loading">
          <span>No media found in this row.</span>
        </div>`;
      return;
    }

    quickShelfContent.innerHTML = items.map(item => {
      const poster = item.poster || 'https://via.placeholder.com/140x210?text=Cinema';
      const rating = item.rating ? `★ ${item.rating}` : '★ 7.5';
      const year = item.year ? item.year : '2026';
      const safeTitle = (item.title || 'Untitled').replace(/"/g, '&quot;');
      const itemId = item.id;
      const mediaType = item.mediaType || 'movie';

      return `
        <div class="quick-shelf-card" data-id="${itemId}" data-type="${mediaType}">
          <img src="${poster}" class="quick-shelf-thumb" alt="${safeTitle}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x210?text=Movie'">
          <div class="quick-shelf-info">
            <div>
              <div class="quick-shelf-card-title" title="${safeTitle}">${safeTitle}</div>
              <div class="quick-shelf-meta">
                <span>${year}</span>
                <span>•</span>
                <span class="quick-shelf-rating">${rating}</span>
                <span>•</span>
                <span>${mediaType.toUpperCase()}</span>
              </div>
            </div>
            <div class="quick-shelf-actions">
              <button type="button" class="quick-shelf-btn-play" data-action="play" title="Play on stage now">Play</button>
              <button type="button" class="quick-shelf-btn-queue" data-action="queue" title="Add to room queue">Queue</button>
              <button type="button" class="quick-shelf-btn-trailer" data-action="trailer" title="Watch official trailer">Trailer</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire action buttons on cards
    quickShelfContent.querySelectorAll('.quick-shelf-card').forEach(card => {
      const id = card.dataset.id;
      const type = card.dataset.type;
      const titleEl = card.querySelector('.quick-shelf-card-title');
      const title = titleEl ? titleEl.textContent : 'Movie';
      const imgEl = card.querySelector('.quick-shelf-thumb');
      const poster = imgEl ? imgEl.src : null;

      const btnPlay = card.querySelector('[data-action="play"]');
      const btnQueue = card.querySelector('[data-action="queue"]');
      const btnTrailer = card.querySelector('[data-action="trailer"]');

      if (btnPlay) {
        btnPlay.addEventListener('click', async () => {
          window.showToast(`Loading "${title}" stream...`, 'info', 3000);
          try {
            const res = await fetch(`/api/stream/resolve?id=${id}&type=${type}`).then(r => r.json());
            if (res.success && res.streamUrl) {
              socket.emit('change-media', {
                type: 'hls',
                url: res.streamUrl,
                title: title,
                poster: poster,
                streams: res.streams || [res.streamUrl]
              });
              window.showToast(`Now playing: ${title}`, 'success', 3000);
            } else {
              playTmdbTrailer(id, type, title, poster);
            }
          } catch (e) {
            playTmdbTrailer(id, type, title, poster);
          }
        });
      }

      if (btnQueue) {
        btnQueue.addEventListener('click', async () => {
          socket.emit('playlist-add', {
            item: {
              type: 'hls',
              url: `/api/stream/resolve?id=${id}&type=${type}`,
              title: title,
              poster: poster,
              duration: 0
            }
          });
          window.showToast(`Added to queue: "${title}"`, 'success', 3000);
        });
      }

      if (btnTrailer) {
        btnTrailer.addEventListener('click', () => {
          playTmdbTrailer(id, type, title, poster);
        });
      }
    });
  }

  async function playTmdbTrailer(id, type, title, poster) {
    window.showToast(`Fetching trailer for "${title}"...`, 'info', 2500);
    try {
      const details = await fetch(`/api/tmdb/details?id=${id}&type=${type}`).then(r => r.json());
      if (details.success && details.data && details.data.trailerYoutubeKey) {
        const trailerUrl = `https://www.youtube.com/watch?v=${details.data.trailerYoutubeKey}`;
        socket.emit('change-media', {
          type: 'youtube',
          url: trailerUrl,
          title: `${title} (Official Trailer)`,
          poster: poster || details.data.backdrop
        });
        window.showToast(`Screening trailer for "${title}"`, 'success', 3500);
      } else {
        const ytSearch = await fetch(`/api/youtube/search?q=${encodeURIComponent(title + ' official trailer')}`).then(r => r.json());
        if (ytSearch.success && ytSearch.items && ytSearch.items.length > 0) {
          const first = ytSearch.items[0];
          socket.emit('change-media', {
            type: 'youtube',
            url: `https://www.youtube.com/watch?v=${first.id}`,
            title: `${title} (Official Trailer)`,
            poster: first.thumbnail || poster
          });
          window.showToast(`Screening trailer for "${title}"`, 'success', 3500);
        } else {
          window.showToast(`No trailer found for "${title}"`, 'warning', 3000);
        }
      }
    } catch (err) {
      console.warn('Failed to load trailer:', err);
      window.showToast(`Could not load trailer for "${title}"`, 'error', 3000);
    }
  }

  // ==========================================================================
  // FEATURE 1: Watch Party Live Polls & Film Trivia
  // ==========================================================================
  let activeRoomPoll = null;
  const activePollHud = document.getElementById('active-poll-hud');
  const pollHudTypeBadge = document.getElementById('poll-hud-type-badge');
  const pollHudQuestion = document.getElementById('poll-hud-question');
  const pollHudOptions = document.getElementById('poll-hud-options');
  const pollHudCreator = document.getElementById('poll-hud-creator');
  const pollHudTotalVotes = document.getElementById('poll-hud-total-votes');
  const btnCloseActivePoll = document.getElementById('btn-close-active-poll');
  const btnOpenPollModal = document.getElementById('btn-open-poll-modal');
  const pollModal = document.getElementById('poll-modal');
  const btnClosePollModal = document.getElementById('btn-close-poll-modal');
  const btnCancelPoll = document.getElementById('btn-cancel-poll');
  const btnCreatePollSubmit = document.getElementById('btn-create-poll-submit');
  const btnPollModeStandard = document.getElementById('btn-poll-mode-standard');
  const btnPollModeTrivia = document.getElementById('btn-poll-mode-trivia');
  const triviaCorrectWrapper = document.getElementById('trivia-correct-wrapper');
  const triviaCorrectSelect = document.getElementById('trivia-correct-select');
  const pollQuestionInput = document.getElementById('poll-question-input');

  let isPollTriviaMode = false;

  if (btnOpenPollModal && pollModal) {
    btnOpenPollModal.addEventListener('click', () => {
      pollModal.style.display = 'flex';
      if (pollQuestionInput) pollQuestionInput.focus();
    });
  }

  const closePollModal = () => {
    if (pollModal) pollModal.style.display = 'none';
  };

  if (btnClosePollModal) btnClosePollModal.addEventListener('click', closePollModal);
  if (btnCancelPoll) btnCancelPoll.addEventListener('click', closePollModal);

  if (btnPollModeStandard && btnPollModeTrivia) {
    btnPollModeStandard.addEventListener('click', () => {
      isPollTriviaMode = false;
      btnPollModeStandard.classList.add('active', 'btn-primary');
      btnPollModeStandard.classList.remove('btn-outline');
      btnPollModeTrivia.classList.remove('active', 'btn-primary');
      btnPollModeTrivia.classList.add('btn-outline');
      if (triviaCorrectWrapper) triviaCorrectWrapper.style.display = 'none';
    });

    btnPollModeTrivia.addEventListener('click', () => {
      isPollTriviaMode = true;
      btnPollModeTrivia.classList.add('active', 'btn-primary');
      btnPollModeTrivia.classList.remove('btn-outline');
      btnPollModeStandard.classList.remove('active', 'btn-primary');
      btnPollModeStandard.classList.add('btn-outline');
      if (triviaCorrectWrapper) triviaCorrectWrapper.style.display = 'flex';
    });
  }

  if (btnCreatePollSubmit) {
    btnCreatePollSubmit.addEventListener('click', () => {
      const q = (pollQuestionInput && pollQuestionInput.value.trim()) || '';
      if (!q) {
        if (window.showToast) window.showToast('Please enter a poll question', 'warning');
        return;
      }
      const optInputs = document.querySelectorAll('.poll-option-input');
      const options = [];
      optInputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) options.push(val);
      });

      if (options.length < 2) {
        if (window.showToast) window.showToast('Please provide at least 2 options', 'warning');
        return;
      }

      const correctIndex = isPollTriviaMode && triviaCorrectSelect ? parseInt(triviaCorrectSelect.value, 10) : null;
      const curSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);

      if (curSocket) {
        curSocket.emit('room-poll-create', {
          question: q,
          options,
          isTrivia: isPollTriviaMode,
          correctIndex
        });
      }

      if (pollQuestionInput) pollQuestionInput.value = '';
      optInputs.forEach(inp => { inp.value = ''; });
      closePollModal();
    });
  }

  if (btnCloseActivePoll) {
    btnCloseActivePoll.addEventListener('click', () => {
      const curSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);
      if (activeRoomPoll && curSocket) {
        curSocket.emit('room-poll-end', { pollId: activeRoomPoll.id });
      }
    });
  }

  function handlePollUpdate(poll) {
    if (!poll || !poll.active) {
      activeRoomPoll = null;
      if (activePollHud) activePollHud.style.display = 'none';
      return;
    }

    activeRoomPoll = poll;
    if (!activePollHud) return;
    activePollHud.style.display = 'flex';

    if (pollHudTypeBadge) {
      pollHudTypeBadge.textContent = poll.isTrivia ? 'MOVIE TRIVIA' : 'LIVE POLL';
    }

    if (pollHudQuestion) {
      pollHudQuestion.textContent = poll.question;
    }

    if (pollHudCreator) {
      pollHudCreator.textContent = `By ${poll.creator}`;
    }

    const totalVotes = poll.votes ? poll.votes.reduce((a, b) => a + b, 0) : 0;
    if (pollHudTotalVotes) {
      pollHudTotalVotes.textContent = `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
    }

    const curSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);
    const myVote = poll.voters && curSocket ? poll.voters[curSocket.id] : undefined;
    const hasVoted = typeof myVote === 'number';

    if (pollHudOptions) {
      pollHudOptions.innerHTML = '';
      poll.options.forEach((optText, idx) => {
        const count = (poll.votes && poll.votes[idx]) || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isMyChoice = myVote === idx;
        const isCorrectTrivia = poll.isTrivia && hasVoted && poll.correctIndex === idx;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'poll-opt-btn' + (isMyChoice ? ' voted' : '') + (isCorrectTrivia ? ' correct' : '');

        btn.innerHTML = `
          <div class="poll-opt-progress" style="width: ${pct}%;"></div>
          <span class="poll-opt-text">${optText}${isMyChoice ? ' (You)' : ''}${isCorrectTrivia ? ' (Correct!)' : ''}</span>
          <span class="poll-opt-pct">${pct}% (${count})</span>
        `;

        btn.addEventListener('click', () => {
          const s = window.socket || (typeof socket !== 'undefined' ? socket : null);
          if (s) {
            s.emit('room-poll-vote', {
              pollId: poll.id,
              optionIndex: idx
            });
          }
        });

        pollHudOptions.appendChild(btn);
      });
    }
  }
  window.handlePollUpdate = handlePollUpdate;

  // ==========================================================================
  // FEATURE 2: Cinema Themes & OLED Stage Presets
  // ==========================================================================
  const btnNavTheme = document.getElementById('btn-nav-theme');
  const themeSwitcherFlyout = document.getElementById('theme-switcher-flyout');
  const themeOptBtns = document.querySelectorAll('.theme-opt-btn');

  function setCinemaTheme(themeName, broadcast = false) {
    const validThemes = ['default', 'cyberpunk', 'oled', 'amber', 'vhs'];
    const safeTheme = validThemes.includes(themeName) ? themeName : 'default';

    document.body.setAttribute('data-theme', safeTheme);
    localStorage.setItem('zami_cinema_theme', safeTheme);

    themeOptBtns.forEach(b => {
      if (b.getAttribute('data-theme') === safeTheme) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    const themeTitles = {
      default: 'ZAMI Classic Obsidian',
      cyberpunk: 'Cyberpunk Neon',
      oled: 'Pure OLED Black',
      amber: 'Warm Amber Cinema',
      vhs: 'Retro VHS 80s'
    };

    const curSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);
    if (broadcast && curSocket) {
      curSocket.emit('change-stage-theme', { theme: safeTheme });
    }

    if (window.showToast) {
      window.showToast(`Cinema Theme: ${themeTitles[safeTheme]}`, 'info', 2000);
    }
  }
  window.setCinemaTheme = setCinemaTheme;

  if (btnNavTheme && themeSwitcherFlyout) {
    btnNavTheme.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = !themeSwitcherFlyout.style.display || themeSwitcherFlyout.style.display === 'none' || window.getComputedStyle(themeSwitcherFlyout).display === 'none';
      themeSwitcherFlyout.style.display = isHidden ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!themeSwitcherFlyout.contains(e.target) && e.target !== btnNavTheme) {
        themeSwitcherFlyout.style.display = 'none';
      }
    });
  }

  themeOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      setCinemaTheme(theme, true);
      if (themeSwitcherFlyout) themeSwitcherFlyout.style.display = 'none';
    });
  });

  // Apply initial theme on startup
  const initialTheme = localStorage.getItem('zami_cinema_theme') || 'default';
  document.body.setAttribute('data-theme', initialTheme);
}


/* ==========================================================================
   WATCH2GETHER ROOM CONTROLLER (EXACT CLONE LOGIC & USER EXPERIENCE)
   ========================================================================== */
function initWatch2GetherRoomClone() {
  const curSocket = window.socket || (typeof socket !== 'undefined' ? socket : null);

  // Sync Room Name display in all headers
  const roomCode = window.location.pathname.split('/').pop() || 'Party Room';
  const prettyRoomName = roomCode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const subRoomNameEl = document.getElementById('mobile-sub-room-name');
  if (subRoomNameEl) subRoomNameEl.textContent = prettyRoomName;

  const w2gHeaderRoomName = document.querySelector('.w2g-room-name');
  if (w2gHeaderRoomName) w2gHeaderRoomName.textContent = prettyRoomName;

  // Invite URL setup
  const roomUrl = window.location.href;
  const inviteInput = document.getElementById('input-w2g-invite-url');
  if (inviteInput) inviteInput.value = roomUrl;

  const qrImg = document.getElementById('w2g-qr-img');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(roomUrl)}`;
  }

  // --- Watch2Gether Invite Dialog Controls ---
  const inviteDialog = document.getElementById('w2g-invite-dialog');
  const btnCloseInvite = document.getElementById('btn-close-w2g-invite');
  const btnCopyInviteAction = document.getElementById('btn-do-copy-invite');
  const btnDockInvite = document.getElementById('btn-dock-invite');
  const btnCopyLinkDesktop = document.getElementById('btn-copy-link');
  const btnHeaderCopyRoom = document.getElementById('btn-header-copy-room');

  let lastActiveOpenerInvite = null;

  function openInviteDialog(opener) {
    if (inviteDialog) {
      lastActiveOpenerInvite = (opener instanceof Element) ? opener : (document.activeElement instanceof Element ? document.activeElement : null);
      if (typeof inviteDialog.showModal === 'function') {
        if (!inviteDialog.open) inviteDialog.showModal();
      } else {
        inviteDialog.setAttribute('open', 'true');
      }
      const focusTarget = btnCopyInviteAction || inviteInput || btnCloseInvite;
      if (focusTarget) {
        setTimeout(() => focusTarget.focus(), 50);
      }
    }
  }

  function closeInviteDialog() {
    if (inviteDialog) {
      if (typeof inviteDialog.close === 'function') {
        if (inviteDialog.open) inviteDialog.close();
      } else {
        inviteDialog.removeAttribute('open');
      }
      if (lastActiveOpenerInvite && typeof lastActiveOpenerInvite.focus === 'function') {
        lastActiveOpenerInvite.focus();
        lastActiveOpenerInvite = null;
      }
    }
  }
  window.openInviteDialog = openInviteDialog;
  window.closeInviteDialog = closeInviteDialog;

  async function handleMobileInvite(opener) {
    const shareData = {
      title: 'Join my ZAMI room',
      text: 'Watch movies and videos together in sync on ZAMI!',
      url: window.location.href
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    openInviteDialog(opener);
  }

  if (btnDockInvite) btnDockInvite.addEventListener('click', () => handleMobileInvite(btnDockInvite));
  const btnMobileShareQuick = document.getElementById('btn-mobile-share-quick');
  if (btnMobileShareQuick) btnMobileShareQuick.addEventListener('click', () => handleMobileInvite(btnMobileShareQuick));
  if (btnCopyLinkDesktop) btnCopyLinkDesktop.addEventListener('click', () => openInviteDialog(btnCopyLinkDesktop));
  if (btnHeaderCopyRoom) btnHeaderCopyRoom.addEventListener('click', () => openInviteDialog(btnHeaderCopyRoom));
  if (btnCloseInvite) btnCloseInvite.addEventListener('click', closeInviteDialog);

  if (inviteDialog) {
    inviteDialog.addEventListener('click', (e) => {
      if (e.target === inviteDialog) closeInviteDialog();
    });
    inviteDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeInviteDialog();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(inviteDialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    inviteDialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeInviteDialog();
    });
  }

  if (btnCopyInviteAction) {
    btnCopyInviteAction.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(roomUrl);
        btnCopyInviteAction.textContent = 'Copied!';
        setTimeout(() => { btnCopyInviteAction.textContent = 'Copy'; }, 2000);
        if (window.showToast) window.showToast('Room link copied to clipboard!', 'success');
      } catch (err) {
        if (inviteInput) {
          inviteInput.select();
          document.execCommand('copy');
          btnCopyInviteAction.textContent = 'Copied!';
          setTimeout(() => { btnCopyInviteAction.textContent = 'Copy'; }, 2000);
        }
      }
    });
  }

  if (btnHeaderCopyRoom) {
    btnHeaderCopyRoom.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(roomUrl);
        if (window.showToast) window.showToast('Room link copied!', 'success');
      } catch (err) {
        openInviteDialog();
      }
    });
  }

  // Invite Modal Tab Switching
  const modalTabBtns = document.querySelectorAll('.w2g-modal-tabs .modal-tab-btn');
  modalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.querySelectorAll('.invite-tab-pane').forEach(p => p.style.display = 'none');
      const pane = document.getElementById(`tab-invite-${target}`);
      if (pane) pane.style.display = 'block';
    });
  });

  // Sharing links
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
  if (btnShareWhatsapp) {
    btnShareWhatsapp.addEventListener('click', () => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Join my ZAMI Watch Party: ' + roomUrl)}`, '_blank');
    });
  }
  const btnShareTelegram = document.getElementById('btn-share-telegram');
  if (btnShareTelegram) {
    btnShareTelegram.addEventListener('click', () => {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent('Join my ZAMI Watch Party!')}`, '_blank');
    });
  }
  const btnShareNative = document.getElementById('btn-share-native');
  if (btnShareNative) {
    btnShareNative.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({ title: 'ZAMI Watch Party', url: roomUrl }).catch(() => {});
      } else {
        openInviteDialog();
      }
    });
  }

  // --- Watch2Gether Search Drawer Logic ---
  const searchDrawer = document.getElementById('w2g-search-drawer');
  const btnOpenSearchMobile = document.getElementById('btn-mobile-open-search');
  const btnCloseSearchDrawer = document.getElementById('btn-close-search-drawer');
  const drawerSearchInput = document.getElementById('w2g-drawer-search-input');
  const drawerSearchClear = document.getElementById('w2g-drawer-search-clear');
  const drawerSearchSubmit = document.getElementById('w2g-drawer-search-submit');
  const drawerResultsContainer = document.getElementById('drawer-results-container');

  let lastActiveOpenerSearch = null;

  function openSearchDrawer(initialQuery = '', opener = null) {
    if (searchDrawer) {
      lastActiveOpenerSearch = (opener instanceof Element) ? opener : (document.activeElement instanceof Element ? document.activeElement : null);
      searchDrawer.style.display = 'flex';
      if (drawerSearchInput) {
        if (initialQuery) drawerSearchInput.value = initialQuery;
        setTimeout(() => drawerSearchInput.focus(), 50);
        if (initialQuery) {
          executeW2GSearch(initialQuery);
        } else if (!drawerResultsContainer.children.length) {
          executeW2GSearch('trending');
        }
      }
    }
  }

  function closeSearchDrawer() {
    if (searchDrawer) {
      searchDrawer.style.display = 'none';
      if (lastActiveOpenerSearch && typeof lastActiveOpenerSearch.focus === 'function') {
        lastActiveOpenerSearch.focus();
        lastActiveOpenerSearch = null;
      }
    }
  }
  window.openSearchDrawer = openSearchDrawer;
  window.closeSearchDrawer = closeSearchDrawer;

  if (btnOpenSearchMobile) {
    btnOpenSearchMobile.addEventListener('click', () => openSearchDrawer('', btnOpenSearchMobile));
  }
  if (btnCloseSearchDrawer) {
    btnCloseSearchDrawer.addEventListener('click', closeSearchDrawer);
  }

  if (searchDrawer) {
    searchDrawer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchDrawer();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(searchDrawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  if (drawerSearchInput) {
    drawerSearchInput.addEventListener('input', () => {
      if (drawerSearchClear) {
        drawerSearchClear.style.display = drawerSearchInput.value ? 'block' : 'none';
      }
    });
    drawerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = drawerSearchInput.value.trim();
        if (q) executeW2GSearch(q);
      }
    });
  }

  if (drawerSearchClear) {
    drawerSearchClear.addEventListener('click', () => {
      if (drawerSearchInput) {
        drawerSearchInput.value = '';
        drawerSearchClear.style.display = 'none';
        drawerSearchInput.focus();
      }
    });
  }

  if (drawerSearchSubmit) {
    drawerSearchSubmit.addEventListener('click', () => {
      const q = (drawerSearchInput?.value || '').trim();
      if (q) executeW2GSearch(q);
    });
  }

  // Desktop Header Search Bar
  const headerSearchInput = document.getElementById('w2g-header-search-input');
  const headerSearchClear = document.getElementById('w2g-header-search-clear');
  const headerSearchSubmit = document.getElementById('w2g-header-search-submit');

  if (headerSearchInput) {
    headerSearchInput.addEventListener('input', () => {
      if (headerSearchClear) {
        headerSearchClear.style.display = headerSearchInput.value ? 'block' : 'none';
      }
    });
    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = headerSearchInput.value.trim();
        if (val) handleUniversalSearchOrUrl(val);
      }
    });
  }

  if (headerSearchClear) {
    headerSearchClear.addEventListener('click', () => {
      if (headerSearchInput) {
        headerSearchInput.value = '';
        headerSearchClear.style.display = 'none';
        headerSearchInput.focus();
      }
    });
  }

  if (headerSearchSubmit) {
    headerSearchSubmit.addEventListener('click', () => {
      const val = (headerSearchInput?.value || '').trim();
      if (val) handleUniversalSearchOrUrl(val);
    });
  }

  function handleUniversalSearchOrUrl(val) {
    const isUrl = val.startsWith('http://') || val.startsWith('https://') || val.includes('.com') || val.includes('.be') || val.includes('.org') || val.includes('.m3u8');
    if (isUrl) {
      if (window.handleLoadDirectStream) {
        window.handleLoadDirectStream(val);
      } else if (curSocket) {
        curSocket.emit('change-media', { type: val.includes('.m3u8') ? 'hls' : 'url', url: val, title: 'Web Stream' });
      }
      if (headerSearchInput) headerSearchInput.value = '';
      if (window.showToast) window.showToast('Streaming media link...', 'info');
    } else {
      openSearchDrawer(val);
    }
  }

  // Search API execution and rendering
  async function executeW2GSearch(query) {
    if (!drawerResultsContainer) return;

    const isUrl = query.startsWith('http://') || query.startsWith('https://') || query.includes('.com') || query.includes('.be') || query.includes('.m3u8');
    if (isUrl) {
      handleUniversalSearchOrUrl(query);
      closeSearchDrawer();
      return;
    }

    drawerResultsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #a1a1aa;">
        <div class="cinema-spinner-ring mini" style="margin-bottom: 12px;"></div>
        <span style="font-size: 0.85rem;">Searching Zami catalog &amp; web sources for "${escapeHtml(query)}"...</span>
      </div>
    `;

    try {
      const isTrending = query === 'trending';
      const tmdbQuery = isTrending ? 'movie' : query;
      const [tmdbRes, ytRes] = await Promise.all([
        fetch(`/api/tmdb/search?q=${encodeURIComponent(tmdbQuery)}`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] }))
      ]);

      const movieItems = (tmdbRes.results || []).slice(0, 8);
      const ytItems = (ytRes.results || []).slice(0, 12);

      if (movieItems.length === 0 && ytItems.length === 0) {
        drawerResultsContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #71717a;">
            <p style="font-size: 0.9rem; margin-bottom: 6px;">No results found for "${escapeHtml(query)}"</p>
            <p style="font-size: 0.78rem;">Try searching for a film title, director, artist, or paste a direct video link.</p>
          </div>
        `;
        return;
      }

      let html = '';

      // Section 1: Feature Films & Series (Catalog)
      if (movieItems.length > 0) {
        html += `
          <div class="search-category-section">
            <div class="search-category-header">
              <div class="search-category-title-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                <span class="search-category-title">Feature Films &amp; Series</span>
              </div>
              <span class="search-category-badge">${movieItems.length} Titles</span>
            </div>
            <div class="search-movies-grid">
              ${movieItems.map(item => {
                const isTv = item.mediaType === 'tv';
                const poster = item.poster || 'https://via.placeholder.com/300x450?text=No+Poster';
                const year = item.year ? `(${item.year})` : '';
                return `
                  <div class="drawer-movie-card" role="button" tabindex="0" aria-label="Play movie: ${escapeHtml(item.title)} ${year}" data-id="${item.id}" data-type="${item.mediaType || 'movie'}" data-title="${encodeURIComponent(item.title)}" data-poster="${poster}">
                    <div class="drawer-movie-poster-wrap">
                      <img src="${poster}" alt="${escapeHtml(item.title)}" class="drawer-movie-poster" loading="lazy">
                      <span class="drawer-movie-badge">${isTv ? 'SERIES' : 'MOVIE'}</span>
                    </div>
                    <div class="drawer-movie-info">
                      <div class="drawer-movie-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                      <div class="drawer-movie-meta">${item.year || (isTv ? 'Series' : 'Feature')}</div>
                      <div class="drawer-movie-actions">
                        <button type="button" class="btn btn-primary btn-sm btn-drawer-movie-play" aria-label="Play ${escapeHtml(item.title)}">${isTv ? 'Episodes' : 'Play'}</button>
                        <button type="button" class="btn btn-secondary btn-sm btn-drawer-movie-queue" aria-label="Add ${escapeHtml(item.title)} to queue">+ Queue</button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Section 2: Web Videos & Clips (YouTube)
      if (ytItems.length > 0) {
        html += `
          <div class="search-category-section">
            <div class="search-category-header">
              <div class="search-category-title-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                <span class="search-category-title">Web Videos &amp; Clips</span>
              </div>
              <span class="search-category-badge">${ytItems.length} Videos</span>
            </div>
            <div class="drawer-youtube-list">
              ${ytItems.map(item => `
                <div class="w2g-drawer-card">
                  <div class="w2g-drawer-thumb-wrap">
                    <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy">
                    <span class="w2g-drawer-duration">${item.duration || 'Video'}</span>
                  </div>
                  <div class="w2g-drawer-info">
                    <div>
                      <div class="w2g-drawer-title">${escapeHtml(item.title)}</div>
                      <div class="w2g-drawer-channel">${escapeHtml(item.channel || 'YouTube')}</div>
                    </div>
                    <div class="w2g-drawer-card-actions">
                      <button type="button" class="btn-w2g-play" aria-label="Play video: ${escapeHtml(item.title)}" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" data-thumb="${item.thumbnail}">
                        Play Now
                      </button>
                      <button type="button" class="btn-w2g-queue" aria-label="Queue video: ${escapeHtml(item.title)}" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" data-thumb="${item.thumbnail}">
                        + Playlist
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      drawerResultsContainer.innerHTML = html;

      // Wire Movie Cards (Click + Keyboard Enter/Space)
      drawerResultsContainer.querySelectorAll('.drawer-movie-card').forEach(card => {
        const playMovie = async () => {
          const id = card.dataset.id;
          const type = card.dataset.type || 'movie';
          const title = decodeURIComponent(card.dataset.title);
          closeSearchDrawer();
          if (window.universalPlayer) window.universalPlayer.showSpinner(`CONNECTING: ${title.toUpperCase()}...`);
          try {
            const resp = await fetch(`/api/stream/resolve?id=${id}&type=${type}`);
            const result = await resp.json();
            if (result.success && result.streamUrl && curSocket) {
              curSocket.emit('change-media', {
                type: 'hls',
                url: result.streamUrl,
                streams: result.streams,
                title: title,
                poster: card.dataset.poster,
                isPlaying: true
              });
              if (window.showToast) window.showToast(`Now playing: ${title}`, 'success');
              return;
            }
          } catch(e) {}
          if (curSocket) {
            curSocket.emit('change-media', {
              type: 'embed',
              url: `https://vidsrc.sh/embed/${type === 'tv' ? 'tv' : 'movie'}?tmdb=${id}`,
              title: title,
              poster: card.dataset.poster,
              isPlaying: true
            });
            if (window.showToast) window.showToast(`Now playing: ${title}`, 'info');
          }
        };

        const queueMovie = async () => {
          const id = card.dataset.id;
          const type = card.dataset.type || 'movie';
          const title = decodeURIComponent(card.dataset.title);
          if (curSocket) {
            curSocket.emit('playlist-add', {
              item: {
                type: 'embed',
                url: `https://vidsrc.sh/embed/${type === 'tv' ? 'tv' : 'movie'}?tmdb=${id}`,
                title: title,
                poster: card.dataset.poster
              }
            });
            if (window.showToast) window.showToast(`Queued: "${title}"`, 'success');
          }
        };

        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-drawer-movie-queue')) {
            e.stopPropagation();
            queueMovie();
          } else {
            playMovie();
          }
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.target === card) {
              e.preventDefault();
              playMovie();
            }
          }
        });
      });

      // Wire YouTube Play and Queue buttons
      drawerResultsContainer.querySelectorAll('.btn-w2g-play').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const title = decodeURIComponent(btn.dataset.title);
          const thumb = btn.dataset.thumb;
          const url = `https://www.youtube.com/watch?v=${id}`;

          if (curSocket) {
            curSocket.emit('change-media', {
              type: 'youtube',
              url: url,
              title: title,
              poster: thumb
            });
          }
          closeSearchDrawer();
          if (window.showToast) window.showToast(`Playing: "${title}"`, 'success');
        });
      });

      drawerResultsContainer.querySelectorAll('.btn-w2g-queue').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const title = decodeURIComponent(btn.dataset.title);
          const thumb = btn.dataset.thumb;
          const url = `https://www.youtube.com/watch?v=${id}`;

          if (curSocket) {
            curSocket.emit('playlist-add', {
              item: {
                type: 'youtube',
                url: url,
                title: title,
                poster: thumb
              }
            });
          }
          btn.textContent = 'Added ✓';
          btn.style.opacity = '0.7';
          if (window.showToast) window.showToast(`Queued: "${title}"`, 'success');
        });
      });

    } catch (err) {
      drawerResultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <p>Failed to load search results. Please check your connection.</p>
        </div>
      `;
    }
  }

  // Platform pills in search drawer
  const platformPills = document.querySelectorAll('.platform-pill');
  platformPills.forEach(pill => {
    pill.addEventListener('click', () => {
      platformPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const platform = pill.dataset.platform;

      if (platform === 'youtube') {
        if (drawerSearchInput) drawerSearchInput.placeholder = 'Search YouTube or paste link...';
        executeW2GSearch('trending');
      } else if (platform === 'movies') {
        closeSearchDrawer();
        const mediaModal = document.getElementById('media-modal');
        if (mediaModal) {
          mediaModal.classList.add('active');
          mediaModal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('movies');
        }
      } else if (platform === 'websites') {
        closeSearchDrawer();
        const mediaModal = document.getElementById('media-modal');
        if (mediaModal) {
          mediaModal.classList.add('active');
          mediaModal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('apps');
        }
      } else if (platform === 'local') {
        closeSearchDrawer();
        const mediaModal = document.getElementById('media-modal');
        if (mediaModal) {
          mediaModal.classList.add('active');
          mediaModal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('menu');
        }
      } else if (platform === 'wallpaper') {
        closeSearchDrawer();
        const wpBtn = document.getElementById('btn-nav-wallpaper');
        if (wpBtn) wpBtn.click();
      } else {
        executeW2GSearch(platform);
      }
    });
  });

  // Drawer category tabs
  const drawerTabBtns = document.querySelectorAll('.drawer-tab-btn');
  drawerTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      drawerTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;

      if (view === 'contents') {
        executeW2GSearch('trending');
      } else if (view === 'apps') {
        closeSearchDrawer();
        const appsBtn = document.getElementById('btn-w2g-apps');
        if (appsBtn) appsBtn.click();
      } else if (view === 'screenshare') {
        closeSearchDrawer();
        if (window.webrtcManager) window.webrtcManager.toggleScreenShare();
      } else if (view === 'local') {
        closeSearchDrawer();
        const mediaModal = document.getElementById('media-modal');
        if (mediaModal) {
          mediaModal.classList.add('active');
          mediaModal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('menu');
        }
      }
    });
  });

  // --- Mobile Subplayer Bar Actions ---
  const mobileRoomPill = document.getElementById('mobile-room-identity-group');
  const btnMobileSettings = document.getElementById('btn-mobile-open-settings');

  function openRoomSettingsModal(opener) {
    if (window.openSettingsModal) {
      window.openSettingsModal(opener);
    }
  }

  if (mobileRoomPill) {
    mobileRoomPill.addEventListener('click', () => openRoomSettingsModal(mobileRoomPill));
    mobileRoomPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRoomSettingsModal(mobileRoomPill);
      }
    });
  }

  if (btnMobileSettings) {
    btnMobileSettings.addEventListener('click', () => openRoomSettingsModal(btnMobileSettings));
    btnMobileSettings.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRoomSettingsModal(btnMobileSettings);
      }
    });
  }

  const btnMobileResize = document.getElementById('btn-mobile-resize-player');
  if (btnMobileResize) {
    btnMobileResize.addEventListener('click', () => {
      const playerWrapper = document.querySelector('.player-wrapper');
      if (playerWrapper) {
        const isExpanded = playerWrapper.classList.toggle('is-expanded');
        btnMobileResize.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        btnMobileResize.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        btnMobileResize.setAttribute('title', isExpanded ? 'Collapse streaming area' : 'Expand streaming area');
        btnMobileResize.setAttribute('aria-label', isExpanded ? 'Collapse streaming area' : 'Expand streaming area');
      }
    });
  }

  const btnMobileSplit = document.getElementById('btn-mobile-split-toggle');
  if (btnMobileSplit) {
    btnMobileSplit.addEventListener('click', () => {
      document.body.classList.toggle('w2g-split');
      if (window.showToast) {
        window.showToast(document.body.classList.contains('w2g-split') ? 'Split view enabled' : 'Standard view', 'info');
      }
    });
  }

  // --- Mobile Bottom Dock Pagination Bullets & Tab Navigation ---
  const roomSidebar = document.getElementById('room-sidebar');
  const dockBullets = document.querySelectorAll('.w2g-dock-bullets .w2g-bullet');
  const btnDockPeople = document.getElementById('btn-dock-people');
  const btnDockQueue = document.getElementById('btn-dock-queue');
  const btnDockChat = document.getElementById('btn-dock-chat');

  // Slide mapping: 0 = People (voice), 1 = Playlists (queue), 2 = Chat (chat)
  function scrollRoomToSlide(index) {
    if (!roomSidebar) return;
    const w = roomSidebar.clientWidth || window.innerWidth;
    roomSidebar.scrollTo({
      left: index * w,
      behavior: 'smooth'
    });
    updateActiveBullet(index);
    const slideTabs = ['voice', 'queue', 'chat'];
    const activeTab = slideTabs[index];
    if (activeTab && window.switchRoomTab) {
      window.switchRoomTab(activeTab);
    }
  }

  function updateActiveBullet(index) {
    dockBullets.forEach((b, i) => {
      b.classList.toggle('active', i === index);
    });
    if (btnDockPeople) {
      btnDockPeople.classList.toggle('active', index === 0);
      btnDockPeople.setAttribute('aria-selected', String(index === 0));
    }
    if (btnDockQueue) {
      btnDockQueue.classList.toggle('active', index === 1);
      btnDockQueue.setAttribute('aria-selected', String(index === 1));
    }
    if (btnDockChat) {
      btnDockChat.classList.toggle('active', index === 2);
      btnDockChat.setAttribute('aria-selected', String(index === 2));
    }
  }

  if (btnDockPeople) btnDockPeople.addEventListener('click', () => scrollRoomToSlide(0));
  if (btnDockQueue) btnDockQueue.addEventListener('click', () => scrollRoomToSlide(1));
  if (btnDockChat) btnDockChat.addEventListener('click', () => scrollRoomToSlide(2));

  const dockRow = document.querySelector('.dock-actions-row');
  if (dockRow) {
    dockRow.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const tabs = [btnDockPeople, btnDockQueue, btnDockChat].filter(Boolean);
        const curIdx = tabs.indexOf(document.activeElement);
        const nextIdx = curIdx >= 0 ? (curIdx + 1) % tabs.length : 0;
        tabs[nextIdx].focus();
        scrollRoomToSlide(nextIdx);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const tabs = [btnDockPeople, btnDockQueue, btnDockChat].filter(Boolean);
        const curIdx = tabs.indexOf(document.activeElement);
        const prevIdx = curIdx >= 0 ? (curIdx - 1 + tabs.length) % tabs.length : tabs.length - 1;
        tabs[prevIdx].focus();
        scrollRoomToSlide(prevIdx);
      }
    });
  }

  dockBullets.forEach(bullet => {
    bullet.addEventListener('click', () => {
      const slideIdx = parseInt(bullet.dataset.slide, 10);
      scrollRoomToSlide(slideIdx);
    });
  });

  if (roomSidebar) {
    let scrollTimeout = null;
    roomSidebar.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const w = roomSidebar.clientWidth || window.innerWidth;
        if (w > 0) {
          const currentSlide = Math.round(roomSidebar.scrollLeft / w);
          updateActiveBullet(Math.max(0, Math.min(2, currentSlide)));
        }
      }, 50);
    }, { passive: true });

    // Initial positioning on mobile (Slide 0)
    if (window.innerWidth <= 900) {
      setTimeout(() => {
        scrollRoomToSlide(0);
      }, 200);
    }
  }

  // Bottom Dock Mic & Cam toggles
  const btnDockCam = document.getElementById('btn-dock-cam');
  const btnDockMic = document.getElementById('btn-dock-mic');
  const btnDesktopCam = document.getElementById('btn-desktop-cam');
  const btnDesktopMic = document.getElementById('btn-desktop-mic');

  function toggleLocalMic() {
    const legacyMicBtn = document.getElementById('btn-toggle-mic');
    if (legacyMicBtn && !legacyMicBtn.disabled) {
      legacyMicBtn.click();
    } else if (window.webrtcManager) {
      window.webrtcManager.toggleMic();
    } else {
      if (window.showToast) window.showToast('Join voice protocol to enable microphone', 'info');
    }
  }

  function toggleLocalCam() {
    const legacyCamBtn = document.getElementById('btn-toggle-cam');
    if (legacyCamBtn && !legacyCamBtn.disabled) {
      legacyCamBtn.click();
    } else if (window.webrtcManager) {
      if (typeof window.webrtcManager.toggleCamera === 'function') {
        window.webrtcManager.toggleCamera();
      } else if (typeof window.webrtcManager.toggleCam === 'function') {
        window.webrtcManager.toggleCam();
      }
    } else {
      if (window.showToast) window.showToast('Join voice protocol to enable camera', 'info');
    }
  }

  if (btnDockMic) btnDockMic.addEventListener('click', toggleLocalMic);
  if (btnDesktopMic) btnDesktopMic.addEventListener('click', toggleLocalMic);
  if (btnDockCam) btnDockCam.addEventListener('click', toggleLocalCam);
  if (btnDesktopCam) btnDesktopCam.addEventListener('click', toggleLocalCam);

  // Bottom Dock Zoom toggles
  let currentStageScale = 1;
  function changeStageZoom(delta) {
    currentStageScale = Math.max(0.7, Math.min(1.4, currentStageScale + delta));
    const stage = document.querySelector('.room-stage');
    if (stage) {
      stage.style.transform = `scale(${currentStageScale})`;
      stage.style.transformOrigin = 'top center';
    }
  }
  const btnDockZoomIn = document.getElementById('btn-dock-zoom-in');
  const btnDockZoomOut = document.getElementById('btn-dock-zoom-out');
  const btnDesktopZoomIn = document.getElementById('btn-desktop-zoom-in');
  const btnDesktopZoomOut = document.getElementById('btn-desktop-zoom-out');

  if (btnDockZoomIn) btnDockZoomIn.addEventListener('click', () => changeStageZoom(0.08));
  if (btnDockZoomOut) btnDockZoomOut.addEventListener('click', () => changeStageZoom(-0.08));
  if (btnDesktopZoomIn) btnDesktopZoomIn.addEventListener('click', () => changeStageZoom(0.08));
  if (btnDesktopZoomOut) btnDesktopZoomOut.addEventListener('click', () => changeStageZoom(-0.08));

  // Sync user profile display on user avatar card
  function updateUserCardProfile() {
    const profile = JSON.parse(localStorage.getItem('zami_profile') || '{}');
    const myName = profile.name || localStorage.getItem('zami_room_nickname') || 'You';
    const myInitial = myName.charAt(0).toUpperCase() || 'Y';

    const myNameTag = document.getElementById('w2g-my-name-tag');
    if (myNameTag) myNameTag.textContent = myName;

    const myInitialEl = document.getElementById('w2g-my-initial');
    if (myInitialEl) myInitialEl.textContent = myInitial;
  }
  updateUserCardProfile();
  window.addEventListener('storage', updateUserCardProfile);

  // Apps Menu button (Desktop)
  const btnW2gApps = document.getElementById('btn-w2g-apps');
  if (btnW2gApps) {
    btnW2gApps.addEventListener('click', () => {
      const mediaModal = document.getElementById('media-modal');
      if (mediaModal) {
        mediaModal.classList.add('active');
        mediaModal.style.display = 'flex';
        if (window.showVaultView) window.showVaultView('apps');
      }
    });
  }

  // Hamburger Menu button (Desktop)
  const btnW2gMenu = document.getElementById('btn-w2g-menu');
  if (btnW2gMenu) {
    btnW2gMenu.addEventListener('click', () => openRoomSettingsModal(btnW2gMenu));
  }

  // Upgrade button
  const btnW2gUpgrade = document.getElementById('btn-w2g-upgrade');
  if (btnW2gUpgrade) {
    btnW2gUpgrade.addEventListener('click', () => {
      if (window.showToast) {
        window.showToast('ZAMI Pro: 4K 60fps Ultra HD Cinema Streaming Unlocked!', 'success', 3000);
      }
    });
  }
}

// Automatically invoke on DOMContentLoaded or immediate execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWatch2GetherRoomClone);
} else {
  initWatch2GetherRoomClone();
}
