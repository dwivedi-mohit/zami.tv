/**
 * CineSync Content Script
 * Injected into Disney+ Hotstar (*.hotstar.com) and MX Player (*.mxplayer.in)
 * Hooks the native HTML5 video player and synchronizes playback across 2-3 friends.
 */

(function () {
  console.log('[CineSync] Extension content script active on', window.location.hostname);

  let currentVideoEl = null;
  let socket = null;
  let currentRoomId = null;
  let currentUsername = 'Friend-' + Math.floor(100 + Math.random() * 900);
  let serverUrl = 'http://localhost:3000';
  let isRemoteAction = false;
  let widgetVisible = false;

  // 1. Locate the video player on the page (supports SPAs, Netflix, Prime, Hotstar, MX, Crunchyroll, YouTube)
  function findVideoElement() {
    const video = document.querySelector('video') ||
                  document.querySelector('.html5-main-video') ||
                  document.querySelector('#player0') ||
                  document.querySelector('.webPlayerSDKContainer video') ||
                  document.querySelector('.rendererContainer video');
    if (video && video !== currentVideoEl) {
      currentVideoEl = video;
      attachVideoListeners(video);
      console.log('[CineSync] Found and attached to video player on', window.location.hostname);
    }
  }

  // Observe DOM changes to catch dynamically inserted video players
  const observer = new MutationObserver(() => findVideoElement());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  findVideoElement();

  // Multi-platform safe playback controller (supports Netflix Cadmium API & HTML5)
  function safeSeek(time) {
    if (!currentVideoEl) return;
    try {
      const netflixPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
      if (netflixPlayer) {
        const sessionIds = netflixPlayer.getAllPlayerSessionIds();
        if (sessionIds && sessionIds.length > 0) {
          const player = netflixPlayer.getVideoPlayerBySessionId(sessionIds[sessionIds.length - 1]);
          if (player && typeof player.seek === 'function') {
            player.seek(time * 1000);
            return;
          }
        }
      }
    } catch (e) {}

    try {
      currentVideoEl.currentTime = time;
    } catch (e) {}
  }

  function safePlay() {
    if (!currentVideoEl) return;
    try {
      const netflixPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
      if (netflixPlayer) {
        const sessionIds = netflixPlayer.getAllPlayerSessionIds();
        if (sessionIds && sessionIds.length > 0) {
          const player = netflixPlayer.getVideoPlayerBySessionId(sessionIds[sessionIds.length - 1]);
          if (player && typeof player.play === 'function') {
            player.play();
            return;
          }
        }
      }
    } catch (e) {}
    currentVideoEl.play().catch(() => {});
  }

  function safePause() {
    if (!currentVideoEl) return;
    try {
      const netflixPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
      if (netflixPlayer) {
        const sessionIds = netflixPlayer.getAllPlayerSessionIds();
        if (sessionIds && sessionIds.length > 0) {
          const player = netflixPlayer.getVideoPlayerBySessionId(sessionIds[sessionIds.length - 1]);
          if (player && typeof player.pause === 'function') {
            player.pause();
            return;
          }
        }
      }
    } catch (e) {}
    try {
      currentVideoEl.pause();
    } catch (e) {}
  }

  // 2. Attach playback event listeners to the native video element
  function attachVideoListeners(video) {
    video.addEventListener('play', () => {
      if (isRemoteAction || !socket || !currentRoomId) return;
      socket.emit('media-play', { currentTime: video.currentTime });
    });

    video.addEventListener('pause', () => {
      if (isRemoteAction || !socket || !currentRoomId) return;
      socket.emit('media-pause', { currentTime: video.currentTime });
    });

    video.addEventListener('seeking', () => {
      if (isRemoteAction || !socket || !currentRoomId) return;
      socket.emit('media-seek', { currentTime: video.currentTime });
    });
  }

  // 3. Connect to CineSync WebSocket Server
  function connectToParty(roomId, user, hostUrl) {
    currentRoomId = roomId;
    currentUsername = user || currentUsername;
    serverUrl = hostUrl || serverUrl;

    if (socket) {
      socket.disconnect();
    }

    if (typeof io === 'undefined') {
      console.error('[CineSync] Socket.io client library not loaded');
      return;
    }

    socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('[CineSync] Connected to server at', serverUrl);
      socket.emit('join-room', {
        roomId: currentRoomId,
        username: currentUsername,
        avatarColor: '#6366f1'
      });
      updateStatusUI('Connected & Synced', '#10b981');
    });

    socket.on('room-joined', (data) => {
      appendChatMessage({
        type: 'system',
        text: `Connected to Party: "${currentRoomId}"`
      });
      // Synchronize video if room has active playback
      if (currentVideoEl && data.mediaSource && data.mediaSource.currentTime > 0) {
        applyRemoteSync(() => {
          safeSeek(data.mediaSource.currentTime);
          if (data.mediaSource.isPlaying) safePlay();
        });
      }
    });

    socket.on('media-play', ({ currentTime }) => {
      if (!currentVideoEl) return;
      applyRemoteSync(() => {
        const drift = Math.abs(currentVideoEl.currentTime - currentTime);
        if (drift > 1.0) safeSeek(currentTime);
        safePlay();
      });
    });

    socket.on('media-pause', ({ currentTime }) => {
      if (!currentVideoEl) return;
      applyRemoteSync(() => {
        safeSeek(currentTime);
        safePause();
      });
    });

    socket.on('media-seek', ({ currentTime }) => {
      if (!currentVideoEl) return;
      applyRemoteSync(() => {
        safeSeek(currentTime);
      });
    });

    socket.on('room-heartbeat', ({ currentTime, isPlaying }) => {
      if (!currentVideoEl) return;
      const drift = Math.abs(currentVideoEl.currentTime - currentTime);
      if (drift > 1.5) {
        applyRemoteSync(() => {
          safeSeek(currentTime);
          if (isPlaying && currentVideoEl.paused) safePlay();
          else if (!isPlaying && !currentVideoEl.paused) safePause();
        });
      }
    });

    socket.on('chat-message', (msg) => {
      appendChatMessage(msg);
    });

    socket.on('new-reaction', ({ emoji }) => {
      spawnFloatingReaction(emoji);
    });

    socket.on('disconnect', () => {
      updateStatusUI('Disconnected', '#ef4444');
    });
  }

  function applyRemoteSync(fn) {
    isRemoteAction = true;
    try {
      fn();
    } finally {
      setTimeout(() => { isRemoteAction = false; }, 250);
    }
  }

  // 4. Injected UI Widget
  function createWidget() {
    if (document.getElementById('cinesync-root')) return;

    const root = document.createElement('div');
    root.id = 'cinesync-root';

    root.innerHTML = `
      <div id="cinesync-pill-btn" class="cinesync-trigger-btn" title="Open CineSync Watch Party">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="#f59e0b"/></svg>
        <span>CineSync</span>
      </div>

      <div id="cinesync-card" class="cinesync-party-card" style="display: none;">
        <div class="cinesync-header">
          <div class="cinesync-room-pill">
            <div id="cinesync-status-dot" class="cinesync-status-dot"></div>
            <span id="cinesync-room-title">Party Offline</span>
          </div>
          <div class="cinesync-actions-row">
            <button id="cinesync-btn-resync" class="cinesync-icon-btn" title="Force Re-Sync">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            </button>
            <button id="cinesync-btn-close" class="cinesync-icon-btn" title="Minimize">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="cinesync-reactions-bar">
          <button class="cinesync-react-btn" data-reaction="star" title="Star"><svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
          <button class="cinesync-react-btn" data-reaction="heart" title="Heart"><svg width="14" height="14" viewBox="0 0 24 24" fill="#f43f5e"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
          <button class="cinesync-react-btn" data-reaction="flame" title="Flame"><svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></button>
          <button class="cinesync-react-btn" data-reaction="zap" title="Zap"><svg width="14" height="14" viewBox="0 0 24 24" fill="#38bdf8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></button>
          <button class="cinesync-react-btn" data-reaction="clap" title="Clap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></button>
        </div>

        <div id="cinesync-chat-body" class="cinesync-chat-body">
          <div class="cinesync-chat-sys">Welcome to CineSync Watch Party!</div>
        </div>

        <form id="cinesync-chat-form" class="cinesync-chat-input-bar">
          <input type="text" id="cinesync-chat-input" class="cinesync-chat-input" placeholder="Chat with room..." autocomplete="off">
          <button type="submit" class="cinesync-chat-send" title="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(root);

    // Event handlers
    const pillBtn = document.getElementById('cinesync-pill-btn');
    const card = document.getElementById('cinesync-card');
    const closeBtn = document.getElementById('cinesync-btn-close');
    const resyncBtn = document.getElementById('cinesync-btn-resync');
    const chatForm = document.getElementById('cinesync-chat-form');
    const chatInput = document.getElementById('cinesync-chat-input');

    pillBtn.addEventListener('click', () => {
      widgetVisible = !widgetVisible;
      card.style.display = widgetVisible ? 'flex' : 'none';
      pillBtn.style.display = widgetVisible ? 'none' : 'flex';
      if (!socket) {
        promptJoinRoom();
      }
    });

    closeBtn.addEventListener('click', () => {
      widgetVisible = false;
      card.style.display = 'none';
      pillBtn.style.display = 'flex';
    });

    if (resyncBtn) {
      resyncBtn.addEventListener('click', () => {
        if (socket) socket.emit('request-sync');
      });
    }

    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !socket) return;
        socket.emit('send-chat', { text });
        chatInput.value = '';
      });
    }

    // Reaction clicks
    const reactBtns = root.querySelectorAll('.cinesync-react-btn');
    reactBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const reaction = btn.dataset.reaction || 'star';
        if (socket) socket.emit('send-reaction', { reaction });
        spawnFloatingReaction(reaction);
      });
    });
  }

  function promptJoinRoom() {
    chrome.storage.local.get(['cinesync_room', 'cinesync_username', 'cinesync_server'], (res) => {
      const defaultRoom = res.cinesync_room || 'party-movie-42';
      const defaultUser = res.cinesync_username || currentUsername;
      const defaultServer = res.cinesync_server || serverUrl;

      const roomInput = prompt('Enter CineSync Room Code to join:', defaultRoom);
      if (!roomInput) return;

      chrome.storage.local.set({ cinesync_room: roomInput });
      connectToParty(roomInput, defaultUser, defaultServer);
    });
  }

  function updateStatusUI(text, color) {
    const dot = document.getElementById('cinesync-status-dot');
    const title = document.getElementById('cinesync-room-title');
    if (dot) dot.style.backgroundColor = color;
    if (title) title.textContent = `${currentRoomId || 'Party'} (${text})`;
  }

  function appendChatMessage(msg) {
    const body = document.getElementById('cinesync-chat-body');
    if (!body) return;

    const el = document.createElement('div');
    if (msg.type === 'system') {
      el.className = 'cinesync-chat-sys';
      el.textContent = msg.text;
    } else {
      el.className = 'cinesync-chat-msg';
      el.innerHTML = `
        <span class="cinesync-chat-author" style="color: ${msg.color || '#a5b4fc'}">${escape(msg.sender)}:</span>
        <span class="cinesync-chat-text">${escape(msg.text)}</span>
      `;
    }
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  const EXT_ICONS = {
    star: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#f43f5e"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    flame: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#f97316"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    zap: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#38bdf8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    clap: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>'
  };

  function spawnFloatingReaction(type) {
    const el = document.createElement('div');
    el.className = 'cinesync-floating-particle';
    el.innerHTML = EXT_ICONS[type] || EXT_ICONS.star;
    el.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 200) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  function escape(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  // Listen for messages from extension popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'CONNECT_ROOM') {
      connectToParty(req.roomId, req.username, req.serverUrl);
      createWidget();
      const card = document.getElementById('cinesync-card');
      const pill = document.getElementById('cinesync-pill-btn');
      if (card) card.style.display = 'flex';
      if (pill) pill.style.display = 'none';
      sendResponse({ success: true });
    }
    return true;
  });

  // Auto-create trigger widget once page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
