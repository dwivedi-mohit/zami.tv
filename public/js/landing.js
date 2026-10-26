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
  // Interactive Cinematic Media-Player Preview
  // --------------------------------------------------------------------------
  const btnCopyPreviewRoom = document.getElementById('btn-copy-preview-room');
  const previewToast = document.getElementById('preview-toast');

  if (btnCopyPreviewRoom) {
    btnCopyPreviewRoom.addEventListener('click', async () => {
      const roomUrl = `${window.location.origin}/room/zami-7f3k`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(roomUrl);
        }
      } catch (e) {}

      if (previewToast) {
        previewToast.classList.add('active');
        setTimeout(() => {
          previewToast.classList.remove('active');
        }, 2200);
      }
    });
  }

  const btnPreviewPlay = document.getElementById('btn-preview-play');
  if (btnPreviewPlay) {
    const iconPlay = btnPreviewPlay.querySelector('.icon-play');
    const iconPause = btnPreviewPlay.querySelector('.icon-pause');
    let isPlaying = true;

    btnPreviewPlay.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (iconPlay && iconPause) {
        iconPlay.style.display = isPlaying ? 'none' : 'block';
        iconPause.style.display = isPlaying ? 'block' : 'none';
      }
    });
  }

  // Interactive scrubber progress bar
  const previewScrubber = document.getElementById('preview-scrubber');
  if (previewScrubber) {
    const fill = previewScrubber.querySelector('.scrubber-fill');
    const knob = previewScrubber.querySelector('.scrubber-knob');
    const timeDisplay = document.getElementById('preview-time-display');

    function updateScrubber(e) {
      const rect = previewScrubber.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      const pct = (ratio * 100).toFixed(1) + '%';

      if (fill) fill.style.width = pct;
      if (knob) knob.style.left = pct;
      previewScrubber.setAttribute('aria-valuenow', Math.round(ratio * 100));

      if (timeDisplay) {
        const totalSecs = 1 * 3600 + 56 * 60 + 20; // 1:56:20 = 6980s
        const curSecs = Math.floor(totalSecs * ratio);
        const mins = Math.floor(curSecs / 60);
        const secs = curSecs % 60;
        timeDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs} / 1:56:20`;
      }
    }

    previewScrubber.addEventListener('click', updateScrubber);
  }

  // Volume toggle
  const btnPreviewVol = document.getElementById('btn-preview-vol');
  if (btnPreviewVol) {
    let isMuted = false;
    btnPreviewVol.addEventListener('click', () => {
      isMuted = !isMuted;
      btnPreviewVol.style.opacity = isMuted ? '0.5' : '1';
    });
  }

  // --------------------------------------------------------------------------
  // Animated Video Background Auto-playback Handler
  // --------------------------------------------------------------------------
  const bgVideo = document.getElementById('landing-bg-video');
  if (bgVideo) {
    const playPromise = bgVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const startVideo = () => {
          bgVideo.play();
          window.removeEventListener('click', startVideo);
          window.removeEventListener('touchstart', startVideo);
          window.removeEventListener('keydown', startVideo);
        };
        window.addEventListener('click', startVideo, { once: true });
        window.addEventListener('touchstart', startVideo, { once: true });
        window.addEventListener('keydown', startVideo, { once: true });
      });
    }
  }
});

