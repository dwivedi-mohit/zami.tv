/**
 * ZAMI — Landing Page Controller
 * Handles room creation, code-based joining, profile management, and session history.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const inputUsername = document.getElementById('landing-username');
  const btnToggleProfile = document.getElementById('btn-toggle-profile');
  const profileDrawer = document.getElementById('profile-drawer');
  const profileAvatarImg = document.getElementById('profile-avatar-img');
  const avatarColors = document.querySelectorAll('.color-choice');

  const btnCreateRoom = document.getElementById('btn-create-room');
  const formJoinRoom = document.getElementById('form-join-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const inputRoomCode = document.getElementById('input-join-code');

  const recentCardsGrid = document.getElementById('recent-cards-grid');
  const btnSeeAllRooms = document.getElementById('btn-see-all-rooms');

  const helpModal = document.getElementById('help-modal');
  const btnOpenHelp = document.getElementById('btn-open-help');
  const btnCloseHelp = document.getElementById('btn-close-help');

  // Load existing username & color or generate defaults (backward compatible)
  let currentUsername = localStorage.getItem('zami_username') ||
                        localStorage.getItem('cinesync_username') ||
                        `Viewer-${Math.floor(100 + Math.random() * 900)}`;

  let selectedColor = localStorage.getItem('zami_color') ||
                      localStorage.getItem('cinesync_color') ||
                      '#f3a93b';

  // Apply to UI
  if (profileAvatarImg) {
    profileAvatarImg.style.borderColor = selectedColor;
  }
  if (inputUsername) {
    inputUsername.value = currentUsername;
    inputUsername.addEventListener('input', (e) => {
      const val = e.target.value.trim() || 'Viewer';
      currentUsername = val;
      localStorage.setItem('zami_username', val);
      localStorage.setItem('cinesync_username', val);
    });
  }

  // Color picker
  avatarColors.forEach(circle => {
    if (circle.dataset.color === selectedColor) {
      circle.classList.add('selected');
    }
    circle.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarColors.forEach(c => c.classList.remove('selected'));
      circle.classList.add('selected');
      selectedColor = circle.dataset.color;
      if (profileAvatarImg) {
        profileAvatarImg.style.borderColor = selectedColor;
      }
      localStorage.setItem('zami_color', selectedColor);
      localStorage.setItem('cinesync_color', selectedColor);
    });
  });

  // Profile Drawer Toggle & Outside-Click Handling
  if (btnToggleProfile && profileDrawer) {
    btnToggleProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = profileDrawer.hasAttribute('hidden');
      if (isHidden) {
        profileDrawer.removeAttribute('hidden');
        btnToggleProfile.setAttribute('aria-expanded', 'true');
        if (inputUsername) inputUsername.focus();
      } else {
        profileDrawer.setAttribute('hidden', '');
        btnToggleProfile.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', (e) => {
      if (!profileDrawer.hasAttribute('hidden')) {
        if (!profileDrawer.contains(e.target) && !btnToggleProfile.contains(e.target)) {
          profileDrawer.setAttribute('hidden', '');
          btnToggleProfile.setAttribute('aria-expanded', 'false');
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !profileDrawer.hasAttribute('hidden')) {
        profileDrawer.setAttribute('hidden', '');
        btnToggleProfile.setAttribute('aria-expanded', 'false');
        btnToggleProfile.focus();
      }
    });
  }

  // Room generation helpers
  const adjectives = ['midnight', 'cinema', 'bollywood', 'velvet', 'solis', 'astral', 'squad', 'chill', 'lounge'];
  const nouns = ['crew', 'party', 'squad', 'room', 'theater', 'vault', 'loft', 'session'];

  function generateRoomId() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${adj}-${noun}-${num}`;
  }

  function saveProfile() {
    const nameToSave = (inputUsername && inputUsername.value.trim()) ? inputUsername.value.trim() : currentUsername;
    localStorage.setItem('zami_username', nameToSave);
    localStorage.setItem('cinesync_username', nameToSave);
    localStorage.setItem('zami_color', selectedColor);
    localStorage.setItem('cinesync_color', selectedColor);
  }

  function saveRecentRoom(roomId) {
    try {
      let recents = JSON.parse(localStorage.getItem('zami_recent_rooms') || localStorage.getItem('cinesync_recent_rooms') || '[]');
      recents = recents.filter(id => id !== roomId);
      recents.unshift(roomId);
      if (recents.length > 8) recents.pop();
      localStorage.setItem('zami_recent_rooms', JSON.stringify(recents));
      localStorage.setItem('cinesync_recent_rooms', JSON.stringify(recents));
    } catch (e) {}
  }

  // Create Room
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      saveProfile();
      const newRoomId = generateRoomId();
      saveRecentRoom(newRoomId);
      window.location.href = `/room/${newRoomId}`;
    });
  }

  // Join Room
  function handleJoin() {
    if (!inputRoomCode) return;
    let code = inputRoomCode.value.trim();
    if (!code) {
      alert('Please enter a room code or link!');
      inputRoomCode.focus();
      return;
    }

    // If user pasted a full URL or room path
    if (code.includes('/room/')) {
      const parts = code.split('/room/');
      code = parts[1].split('?')[0].split('#')[0];
    } else if (code.startsWith('http://') || code.startsWith('https://')) {
      try {
        const url = new URL(code);
        const parts = url.pathname.split('/room/');
        if (parts[1]) {
          code = parts[1].split('/')[0];
        }
      } catch (err) {}
    }

    code = code.replace(/^\/+|\/+$/g, '');

    saveProfile();
    saveRecentRoom(code);
    window.location.href = `/room/${code}`;
  }

  if (formJoinRoom) {
    formJoinRoom.addEventListener('submit', (e) => {
      e.preventDefault();
      handleJoin();
    });
  }
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', (e) => {
      e.preventDefault();
      handleJoin();
    });
  }

  // Render recent rooms dynamically if available, otherwise preserve default cards
  try {
    const recents = JSON.parse(localStorage.getItem('zami_recent_rooms') || localStorage.getItem('cinesync_recent_rooms') || '[]');
    const thumbs = ['/img/recent_backdrop_1.png', '/img/recent_backdrop_2.png', '/img/recent_backdrop_3.png'];

    if (Array.isArray(recents) && recents.length > 0 && recentCardsGrid) {
      // If user has stored recent rooms, update cards
      recentCardsGrid.innerHTML = '';
      const displayRooms = recents.slice(0, 3);

      // If fewer than 3, pad with default fallback rooms
      const defaultRooms = ['midnight-crew-75', 'cinema-party-35', 'bollywood-squad-98'];
      defaultRooms.forEach(def => {
        if (displayRooms.length < 3 && !displayRooms.includes(def)) {
          displayRooms.push(def);
        }
      });

      const scenes = ['astronaut', 'sunset', 'neon'];
      displayRooms.forEach((roomId, index) => {
        const item = document.createElement('a');
        item.className = 'recent-room-card';
        item.href = `/room/${roomId}`;
        item.title = `Preview & Join ${roomId}`;
        const scene = scenes[index % scenes.length];
        item.setAttribute('data-scene', scene);
        const thumbSrc = thumbs[index % thumbs.length];
        item.style.backgroundImage = `url('${thumbSrc}')`;
        item.innerHTML = `
          <div class="recent-room-scrim"></div>
          <div class="recent-room-info">
            <span class="recent-room-name">${roomId}</span>
          </div>
        `;
        recentCardsGrid.appendChild(item);
      });
    }
  } catch (e) {}

  // --------------------------------------------------------------------------
  // Interactive TV Screen Preview on Recent Rooms Hover & Selection
  // --------------------------------------------------------------------------
  function initTvScreenPreview() {
    const ambilightGlow = document.getElementById('couch-ambilight-glow');
    const overlayAstronaut = document.getElementById('couch-img-astronaut');
    const overlaySunset = document.getElementById('couch-img-sunset');
    const overlayNeon = document.getElementById('couch-img-neon');

    const sceneMap = {
      astronaut: overlayAstronaut,
      sunset: overlaySunset,
      neon: overlayNeon
    };

    const glowColors = {
      default: 'radial-gradient(circle, rgba(243, 169, 59, 0.16) 0%, rgba(243, 169, 59, 0.04) 50%, transparent 75%)',
      astronaut: 'radial-gradient(circle, rgba(56, 189, 248, 0.24) 0%, rgba(14, 165, 233, 0.08) 50%, transparent 75%)',
      sunset: 'radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(239, 68, 68, 0.09) 50%, transparent 75%)',
      neon: 'radial-gradient(circle, rgba(20, 184, 166, 0.24) 0%, rgba(139, 92, 246, 0.09) 50%, transparent 75%)'
    };

    let pinnedScene = 'default';

    function setScene(scene) {
      Object.keys(sceneMap).forEach(key => {
        const el = sceneMap[key];
        if (!el) return;
        if (key === scene) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      if (ambilightGlow) {
        ambilightGlow.style.background = glowColors[scene] || glowColors.default;
      }
    }

    const cards = document.querySelectorAll('.recent-room-card');
    cards.forEach((card, idx) => {
      const scenes = ['astronaut', 'sunset', 'neon'];
      const scene = card.getAttribute('data-scene') || scenes[idx % scenes.length];
      card.setAttribute('data-scene', scene);

      card.addEventListener('mouseenter', () => {
        setScene(scene);
      });

      card.addEventListener('pointerenter', () => {
        setScene(scene);
      });

      card.addEventListener('touchstart', () => {
        setScene(scene);
      }, { passive: true });

      card.addEventListener('focus', () => {
        setScene(scene);
      });

      card.addEventListener('mouseleave', () => {
        setScene(pinnedScene);
      });

      card.addEventListener('blur', () => {
        setScene(pinnedScene);
      });

      card.addEventListener('click', (e) => {
        pinnedScene = scene;
        cards.forEach(c => c.classList.remove('active-preview'));
        card.classList.add('active-preview');
        setScene(scene);

        const roomNameEl = card.querySelector('.recent-room-name');
        if (roomNameEl) {
          const rName = roomNameEl.textContent.trim();
          if (inputJoinCode) {
            inputJoinCode.value = rName;
          }
          const backdropMap = {
            astronaut: '/img/backdrop_astronaut.jpg',
            sunset: '/img/backdrop_sunset.jpg',
            neon: '/img/backdrop_neon.jpg'
          };
          if (backdropMap[scene]) {
            try {
              localStorage.setItem('zami_room_backdrop_' + rName, backdropMap[scene]);
            } catch (err) {}
          }
        }
      });
    });

    const grid = document.getElementById('recent-cards-grid');
    if (grid) {
      grid.addEventListener('mouseleave', () => {
        setScene(pinnedScene);
      });
    }
  }

  // Initialize interactive TV screen preview
  initTvScreenPreview();

  if (btnSeeAllRooms) {
    btnSeeAllRooms.addEventListener('click', () => {
      openHelp();
    });
  }

  // Help Modal handlers
  function openHelp() {
    if (helpModal) {
      if (typeof helpModal.showModal === 'function') {
        helpModal.showModal();
      } else {
        helpModal.setAttribute('open', '');
      }
    }
  }

  function closeHelp() {
    if (helpModal) {
      if (typeof helpModal.close === 'function') {
        helpModal.close();
      } else {
        helpModal.removeAttribute('open');
      }
    }
  }

  if (btnOpenHelp) {
    btnOpenHelp.addEventListener('click', openHelp);
  }
  if (btnCloseHelp) {
    btnCloseHelp.addEventListener('click', closeHelp);
  }
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeHelp();
      }
    });
  }
});
