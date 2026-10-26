/**
 * ZAMI — Landing Page Controller
 * Handles room creation, modal join with code, mobile drawer navigation,
 * profile customizer, interactive player preview, and modern dialog fallbacks.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // User Profile & Preferences
  // --------------------------------------------------------------------------
  let currentUsername = localStorage.getItem('zami_username') ||
                        localStorage.getItem('cinesync_username') ||
                        `Viewer-${Math.floor(100 + Math.random() * 900)}`;

  let selectedColor = localStorage.getItem('zami_color') ||
                      localStorage.getItem('cinesync_color') ||
                      '#f3a93b';

  function saveProfile(name, color) {
    if (name) {
      currentUsername = name.trim();
      localStorage.setItem('zami_username', currentUsername);
      localStorage.setItem('cinesync_username', currentUsername);
    }
    if (color) {
      selectedColor = color;
      localStorage.setItem('zami_color', selectedColor);
      localStorage.setItem('cinesync_color', selectedColor);
    }
  }

  // --------------------------------------------------------------------------
  // Modal Dialog Helper with Light-Dismiss Fallback
  // --------------------------------------------------------------------------
  function openModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
      } catch (err) {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      try {
        dialog.close();
      } catch (err) {
        dialog.removeAttribute('open');
      }
    } else {
      dialog.removeAttribute('open');
    }
  }

  // Modern Web Guidance: Fallback for browsers without native closedby support
  function setupDialogBackdropDismiss(dialog) {
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isDialogContent) {
          closeModal(dialog);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // Room ID Generator
  // --------------------------------------------------------------------------
  const adjectives = ['midnight', 'cinema', 'bollywood', 'velvet', 'solis', 'astral', 'squad', 'chill', 'lounge'];
  const nouns = ['crew', 'party', 'squad', 'room', 'theater', 'vault', 'loft', 'session'];

  function generateRoomId() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${adj}-${noun}-${num}`;
  }

  // --------------------------------------------------------------------------
  // Create Room Action
  // --------------------------------------------------------------------------
  function createRoomAndNavigate() {
    saveProfile();
    const newRoomId = generateRoomId();
    window.location.href = `/room/${newRoomId}`;
  }

  const btnHeroCreate = document.getElementById('btn-hero-create');
  const btnNavCreate = document.getElementById('btn-nav-create');
  const btnMobCreate = document.getElementById('btn-mob-create');

  if (btnHeroCreate) btnHeroCreate.addEventListener('click', createRoomAndNavigate);
  if (btnNavCreate) btnNavCreate.addEventListener('click', createRoomAndNavigate);
  if (btnMobCreate) btnMobCreate.addEventListener('click', createRoomAndNavigate);

  // --------------------------------------------------------------------------
  // Join Room with Code Modal
  // --------------------------------------------------------------------------
  const joinModal = document.getElementById('join-modal');
  const btnHeroJoin = document.getElementById('btn-hero-join');
  const btnCloseJoin = document.getElementById('btn-close-join');
  const btnCancelJoin = document.getElementById('btn-cancel-join');
  const formJoinModal = document.getElementById('form-join-modal');
  const inputModalCode = document.getElementById('input-modal-code');

  setupDialogBackdropDismiss(joinModal);

  function openJoinModal() {
    if (joinModal) {
      openModal(joinModal);
      if (inputModalCode) {
        setTimeout(() => inputModalCode.focus(), 50);
      }
    }
  }

  if (btnHeroJoin) btnHeroJoin.addEventListener('click', openJoinModal);
  if (btnCloseJoin) btnCloseJoin.addEventListener('click', () => closeModal(joinModal));
  if (btnCancelJoin) btnCancelJoin.addEventListener('click', () => closeModal(joinModal));

  function handleJoinSubmit() {
    if (!inputModalCode) return;
    let code = inputModalCode.value.trim();
    if (!code) {
      inputModalCode.focus();
      return;
    }

    // Parse full URL if pasted
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
    if (!code) return;

    saveProfile();
    window.location.href = `/room/${code}`;
  }

  if (formJoinModal) {
    formJoinModal.addEventListener('submit', (e) => {
      e.preventDefault();
      handleJoinSubmit();
    });
  }

  // --------------------------------------------------------------------------
  // Mobile Navigation Drawer
  // --------------------------------------------------------------------------
  const mobileNavDialog = document.getElementById('mobile-nav-dialog');
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnCloseMobileNav = document.getElementById('btn-close-mobile-nav');
  const mobLinkHow = document.getElementById('mob-link-how');
  const mobLinkFeatures = document.getElementById('mob-link-features');
  const mobLinkApps = document.getElementById('mob-link-apps');
  const btnMobSignin = document.getElementById('btn-mob-signin');

  setupDialogBackdropDismiss(mobileNavDialog);

  if (btnHamburger && mobileNavDialog) {
    btnHamburger.addEventListener('click', () => {
      openModal(mobileNavDialog);
      btnHamburger.setAttribute('aria-expanded', 'true');
    });

    mobileNavDialog.addEventListener('close', () => {
      btnHamburger.setAttribute('aria-expanded', 'false');
    });
  }

  if (btnCloseMobileNav && mobileNavDialog) {
    btnCloseMobileNav.addEventListener('click', () => {
      closeModal(mobileNavDialog);
    });
  }

  if (mobLinkHow) {
    mobLinkHow.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      openHelpModal();
    });
  }

  if (mobLinkFeatures) {
    mobLinkFeatures.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      const feat = document.getElementById('mobile-features') || document.getElementById('desktop-features');
      if (feat) feat.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (mobLinkApps) {
    mobLinkApps.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      openHelpModal();
    });
  }

  // --------------------------------------------------------------------------
  // Profile / Settings Modal
  // --------------------------------------------------------------------------
  const profileDialog = document.getElementById('profile-dialog');
  const btnNavSignin = document.getElementById('btn-nav-signin');
  const btnCloseProfile = document.getElementById('btn-close-profile');
  const inputDisplayName = document.getElementById('input-display-name');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const colorDots = document.querySelectorAll('.color-dot');

  setupDialogBackdropDismiss(profileDialog);

  function openProfileModal() {
    if (profileDialog) {
      if (inputDisplayName) inputDisplayName.value = currentUsername;
      colorDots.forEach(dot => {
        dot.classList.toggle('selected', dot.dataset.color === selectedColor);
      });
      openModal(profileDialog);
      if (inputDisplayName) {
        setTimeout(() => inputDisplayName.focus(), 50);
      }
    }
  }

  if (btnNavSignin) btnNavSignin.addEventListener('click', openProfileModal);
  if (btnMobSignin) {
    btnMobSignin.addEventListener('click', () => {
      closeModal(mobileNavDialog);
      openProfileModal();
    });
  }
  if (btnCloseProfile) btnCloseProfile.addEventListener('click', () => closeModal(profileDialog));

  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedColor = dot.dataset.color || '#f3a93b';
    });
  });

  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const name = inputDisplayName ? inputDisplayName.value.trim() : currentUsername;
      saveProfile(name, selectedColor);
      closeModal(profileDialog);
    });
  }

  // --------------------------------------------------------------------------
  // Help Modal
  // --------------------------------------------------------------------------
  const helpModal = document.getElementById('help-modal');
  const linkHowItWorks = document.getElementById('link-how-it-works');
  const linkFeatures = document.getElementById('link-features');
  const linkSupportedApps = document.getElementById('link-supported-apps');
  const btnCloseHelp = document.getElementById('btn-close-help');

  setupDialogBackdropDismiss(helpModal);

  function openHelpModal() {
    if (helpModal) openModal(helpModal);
  }

  if (linkHowItWorks) linkHowItWorks.addEventListener('click', (e) => { e.preventDefault(); openHelpModal(); });
  if (linkFeatures) linkFeatures.addEventListener('click', (e) => { e.preventDefault(); openHelpModal(); });
  if (linkSupportedApps) linkSupportedApps.addEventListener('click', (e) => { e.preventDefault(); openHelpModal(); });
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => closeModal(helpModal));

  // --------------------------------------------------------------------------
  // Interactive Blended Living Cinema Stage Controller
  // --------------------------------------------------------------------------
  const cinemaViewport = document.getElementById('stage-cinema-viewport');
  const ambientGlow = document.getElementById('stage-ambient-glow');
  const particleCanvas = document.getElementById('stage-particle-canvas');
  const moodTabs = document.querySelectorAll('.mood-tab');
  const sceneImages = document.querySelectorAll('.stage-scene-img');
  const reactionCounter = document.getElementById('reaction-counter');
  const reactionPill = document.getElementById('reaction-stats-pill');
  const syncPill = document.getElementById('hud-sync-pill');

  // 1. Cinematic Scene Mood Switcher
  const glowMoods = {
    '1': 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(245, 158, 11, 0.24) 0%, rgba(251, 146, 60, 0.08) 50%, transparent 75%)',
    '2': 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(99, 102, 241, 0.24) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 75%)',
    '3': 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(236, 72, 153, 0.24) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 75%)'
  };

  moodTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      moodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const sceneId = tab.getAttribute('data-scene');
      sceneImages.forEach(img => {
        img.classList.toggle('active', img.id === `scene-img-${sceneId}`);
      });

      if (ambientGlow && glowMoods[sceneId]) {
        ambientGlow.style.background = glowMoods[sceneId];
      }
    });
  });

  // 2. High-Performance Canvas Particle Engine (Reaction Cannon)
  let particles = [];
  let animFrameId = null;
  let totalReactions = parseInt(localStorage.getItem('zami_reaction_count') || '42', 10);
  if (reactionCounter) reactionCounter.textContent = totalReactions;

  function resizeCanvas() {
    if (!particleCanvas || !cinemaViewport) return;
    const rect = cinemaViewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    particleCanvas.width = rect.width * dpr;
    particleCanvas.height = rect.height * dpr;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnParticles(type, originX, originY) {
    if (!particleCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cinemaViewport.getBoundingClientRect();
    const startX = originX !== undefined ? (originX - rect.left) * dpr : (rect.width * 0.5) * dpr;
    const startY = originY !== undefined ? (originY - rect.top) * dpr : (rect.height * 0.85) * dpr;

    const count = 10 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: startX + (Math.random() - 0.5) * 36 * dpr,
        y: startY + (Math.random() - 0.5) * 16 * dpr,
        vx: (Math.random() - 0.5) * 2.8 * dpr,
        vy: -(2.5 + Math.random() * 4) * dpr,
        size: (12 + Math.random() * 10) * dpr,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.1,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.014,
        type: type || 'popcorn'
      });
    }

    totalReactions++;
    if (reactionCounter) reactionCounter.textContent = totalReactions;
    localStorage.setItem('zami_reaction_count', totalReactions.toString());

    if (reactionPill) {
      reactionPill.classList.add('pulse');
      setTimeout(() => reactionPill.classList.remove('pulse'), 250);
    }

    if (!animFrameId) {
      animFrameId = requestAnimationFrame(renderParticles);
    }
  }

  function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(0, topCurveHeight);
    ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
    ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, (size + topCurveHeight) / 1.4, 0, size);
    ctx.bezierCurveTo(0, (size + topCurveHeight) / 1.4, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
    ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
    ctx.closePath();
    ctx.fillStyle = '#f43f5e';
    ctx.fill();
    ctx.restore();
  }

  function drawStar(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(Math.cos((18 + i * 90) * Math.PI / 180) * size, -Math.sin((18 + i * 90) * Math.PI / 180) * size);
      ctx.lineTo(Math.cos((63 + i * 90) * Math.PI / 180) * (size * 0.38), -Math.sin((63 + i * 90) * Math.PI / 180) * (size * 0.38));
    }
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.restore();
  }

  function drawFlame(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.6, -size * 0.2, size * 0.4, size * 0.5);
    ctx.quadraticCurveTo(0, size * 0.8, -size * 0.4, size * 0.5);
    ctx.quadraticCurveTo(-size * 0.6, -size * 0.2, 0, -size);
    ctx.closePath();
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.restore();
  }

  function drawPopcorn(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.1, size * 0.35, 0, Math.PI * 2);
    ctx.arc(size * 0.25, -size * 0.1, size * 0.35, 0, Math.PI * 2);
    ctx.arc(0, size * 0.2, size * 0.38, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();
  }

  function renderParticles() {
    if (!particleCanvas) return;
    const ctx = particleCanvas.getContext('2d');
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'heart') {
        drawHeart(ctx, p.x, p.y, p.size);
      } else if (p.type === 'fire') {
        drawFlame(ctx, p.x, p.y, p.size);
      } else if (p.type === 'spark') {
        drawStar(ctx, p.x, p.y, p.size);
      } else {
        drawPopcorn(ctx, p.x, p.y, p.size);
      }

      ctx.restore();
    }

    if (particles.length > 0) {
      animFrameId = requestAnimationFrame(renderParticles);
    } else {
      animFrameId = null;
    }
  }

  // 3. Reaction Buttons Trigger
  const reactionButtons = document.querySelectorAll('.btn-react-pill');
  reactionButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type') || 'popcorn';
      const rect = btn.getBoundingClientRect();
      spawnParticles(type, rect.left + rect.width * 0.5, rect.top);
    });
  });

  // 4. Direct Viewport Tap / Click Trigger
  if (cinemaViewport) {
    cinemaViewport.addEventListener('click', (e) => {
      // Don't trigger if clicking top HUD or party dock
      if (e.target.closest('.stage-top-hud') || e.target.closest('.stage-party-dock')) return;
      const types = ['heart', 'popcorn', 'fire', 'spark'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      spawnParticles(randomType, e.clientX, e.clientY);
    });
  }

  // 5. Interactive Sync Pill Ping
  if (syncPill) {
    syncPill.addEventListener('click', (e) => {
      e.stopPropagation();
      const syncText = syncPill.querySelector('.hud-sync-text');
      if (syncText) {
        const orig = syncText.textContent;
        syncText.textContent = 'Sync Ping: 8ms (Locked)';
        spawnParticles('spark');
        setTimeout(() => {
          syncText.textContent = orig;
        }, 2200);
      }
    });
  }

  // 6. Dynamic Whisper Chat Rotation
  const whisperTexts = [
    { name: 'Sarah', avatar: '/img/avatar_p2.png', text: 'Sarah: This sunset scene looks unreal!' },
    { name: 'Alex', avatar: '/img/avatar_p3.png', text: 'Alex: Popcorn ready, don\'t pause' },
    { name: 'Maya', avatar: '/img/avatar_p4.png', text: 'Maya: The soundtrack is so cozy' },
    { name: 'Host', avatar: '/img/avatar_p1.png', text: 'Host: Sub-second sync locked' }
  ];
  let whisperIdx = 0;
  const whisperEl1 = document.querySelector('.stage-whisper-bubble.whisper-1');
  const whisperEl2 = document.querySelector('.stage-whisper-bubble.whisper-2');

  setInterval(() => {
    whisperIdx = (whisperIdx + 1) % whisperTexts.length;
    const nextItem = whisperTexts[whisperIdx];
    if (whisperEl1) {
      whisperEl1.style.opacity = '0';
      setTimeout(() => {
        const avatar = whisperEl1.querySelector('.whisper-avatar');
        const text = whisperEl1.querySelector('.whisper-text');
        if (avatar) avatar.src = nextItem.avatar;
        if (text) text.textContent = nextItem.text;
        whisperEl1.style.opacity = '1';
      }, 400);
    }
  }, 6500);
});

