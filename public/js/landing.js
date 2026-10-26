/**
 * ZAMI — Landing Page Controller
 * Faithful Recreation of Reference Specification
 * Handles room creation, modal join with code, mobile drawer navigation,
 * player preview playback controls, scrubber seek simulation, sync ping,
 * streaming services integrations, and accessible dialog management.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --------------------------------------------------------------------------
  // User Profile & Preferences
  // --------------------------------------------------------------------------
  let currentUsername = localStorage.getItem("zami_username") ||
                        localStorage.getItem("cinesync_username") ||
                        `Viewer-${Math.floor(100 + Math.random() * 900)}`;

  let selectedColor = localStorage.getItem("zami_color") ||
                      localStorage.getItem("cinesync_color") ||
                      "#FFB84D";

  function saveProfile(name) {
    if (name) {
      currentUsername = name.trim();
      localStorage.setItem("zami_username", currentUsername);
      localStorage.setItem("cinesync_username", currentUsername);
    }
  }

  // --------------------------------------------------------------------------
  // Modal Dialog Helpers (Modern HTML5 <dialog> with Fallbacks)
  // --------------------------------------------------------------------------
  function openModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      try {
        dialog.showModal();
      } catch (err) {
        dialog.setAttribute("open", "");
      }
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      try {
        dialog.close();
      } catch (err) {
        dialog.removeAttribute("open");
      }
    } else {
      dialog.removeAttribute("open");
    }
  }

  function setupDialogBackdropDismiss(dialog) {
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      dialog.addEventListener("click", (event) => {
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
  // Room ID Generator & Navigation
  // --------------------------------------------------------------------------
  const adjectives = ["midnight", "cinema", "bollywood", "velvet", "solis", "astral", "squad", "chill", "lounge"];
  const nouns = ["crew", "party", "squad", "room", "theater", "vault", "loft", "session"];

  function generateRoomId() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${adj}-${noun}-${num}`;
  }

  function createRoomAndNavigate() {
    saveProfile();
    const newRoomId = generateRoomId();
    window.location.href = `/room/${newRoomId}`;
  }

  const btnHeroCreate = document.getElementById("btn-hero-create");
  const btnNavCreate = document.getElementById("btn-nav-create");
  const btnMobCreate = document.getElementById("btn-mob-create");
  const btnMobDrawerCreate = document.getElementById("btn-mob-drawer-create");

  if (btnHeroCreate) btnHeroCreate.addEventListener("click", createRoomAndNavigate);
  if (btnNavCreate) btnNavCreate.addEventListener("click", createRoomAndNavigate);
  if (btnMobCreate) btnMobCreate.addEventListener("click", createRoomAndNavigate);
  if (btnMobDrawerCreate) btnMobDrawerCreate.addEventListener("click", createRoomAndNavigate);

  // --------------------------------------------------------------------------
  // Join Room with Code Modal
  // --------------------------------------------------------------------------
  const joinModal = document.getElementById("join-modal");
  const btnHeroJoin = document.getElementById("btn-hero-join");
  const btnMobJoin = document.getElementById("btn-mob-join");
  const btnMobDrawerJoin = document.getElementById("btn-mob-drawer-join");
  const btnCloseJoin = document.getElementById("btn-close-join");
  const btnCancelJoin = document.getElementById("btn-cancel-join");
  const formJoinModal = document.getElementById("form-join-modal");
  const inputModalCode = document.getElementById("input-modal-code");

  setupDialogBackdropDismiss(joinModal);

  function openJoinModal() {
    if (joinModal) {
      openModal(joinModal);
      if (inputModalCode) {
        setTimeout(() => inputModalCode.focus(), 50);
      }
    }
  }

  if (btnHeroJoin) btnHeroJoin.addEventListener("click", openJoinModal);
  if (btnMobJoin) {
    btnMobJoin.addEventListener("click", () => {
      closeModal(mobileNavDialog);
      openJoinModal();
    });
  }
  if (btnMobDrawerJoin) {
    btnMobDrawerJoin.addEventListener("click", () => {
      closeModal(mobileNavDialog);
      openJoinModal();
    });
  }
  if (btnCloseJoin) btnCloseJoin.addEventListener("click", () => closeModal(joinModal));
  if (btnCancelJoin) btnCancelJoin.addEventListener("click", () => closeModal(joinModal));

  function handleJoinSubmit() {
    if (!inputModalCode) return;
    let code = inputModalCode.value.trim();
    if (!code) {
      inputModalCode.focus();
      return;
    }

    if (code.includes("/room/")) {
      const parts = code.split("/room/");
      code = parts[1].split("?")[0].split("#")[0];
    } else if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const url = new URL(code);
        const parts = url.pathname.split("/room/");
        if (parts[1]) {
          code = parts[1].split("/")[0];
        }
      } catch (err) {}
    }

    code = code.replace(/^\/+|\/+$/g, "");
    if (!code) return;

    saveProfile();
    window.location.href = `/room/${code}`;
  }

  if (formJoinModal) {
    formJoinModal.addEventListener("submit", (e) => {
      e.preventDefault();
      handleJoinSubmit();
    });
  }

  // --------------------------------------------------------------------------
  // Mobile Navigation Drawer
  // --------------------------------------------------------------------------
  const mobileNavDialog = document.getElementById("mobile-nav-dialog");
  const btnHamburger = document.getElementById("btn-hamburger");
  const btnCloseMobileNav = document.getElementById("btn-close-mobile-nav");
  const mobLinkFeatures = document.getElementById("mob-link-features");
  const mobLinkApps = document.getElementById("mob-link-apps");
  const mobLinkHow = document.getElementById("mob-link-how");
  const mobLinkPricing = document.getElementById("mob-link-pricing");

  setupDialogBackdropDismiss(mobileNavDialog);

  if (btnHamburger && mobileNavDialog) {
    btnHamburger.addEventListener("click", () => {
      openModal(mobileNavDialog);
      btnHamburger.setAttribute("aria-expanded", "true");
    });

    mobileNavDialog.addEventListener("close", () => {
      btnHamburger.setAttribute("aria-expanded", "false");
    });
  }

  if (btnCloseMobileNav && mobileNavDialog) {
    btnCloseMobileNav.addEventListener("click", () => closeModal(mobileNavDialog));
  }

  if (mobLinkFeatures) {
    mobLinkFeatures.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      showToast("Sync in Real-Time • Watch Anything");
    });
  }

  if (mobLinkApps) {
    mobLinkApps.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      openHelpModal();
    });
  }

  if (mobLinkHow) {
    mobLinkHow.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      openHelpModal();
    });
  }

  if (mobLinkPricing) {
    mobLinkPricing.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal(mobileNavDialog);
      showToast("100% Free Forever");
    });
  }

  // --------------------------------------------------------------------------
  // Desktop Nav Links
  // --------------------------------------------------------------------------
  const navLinkFeatures = document.getElementById("nav-link-features");
  const navLinkApps = document.getElementById("nav-link-apps");
  const navLinkHow = document.getElementById("nav-link-how");
  const navLinkPricing = document.getElementById("nav-link-pricing");

  if (navLinkFeatures) {
    navLinkFeatures.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("Sync in Real-Time • Watch Anything");
    });
  }

  if (navLinkApps) {
    navLinkApps.addEventListener("click", (e) => {
      e.preventDefault();
      openHelpModal();
    });
  }

  if (navLinkHow) {
    navLinkHow.addEventListener("click", (e) => {
      e.preventDefault();
      openHelpModal();
    });
  }

  if (navLinkPricing) {
    navLinkPricing.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("100% Free Forever");
    });
  }

  // --------------------------------------------------------------------------
  // Help Modal
  // --------------------------------------------------------------------------
  const helpModal = document.getElementById("help-modal");
  const btnCloseHelp = document.getElementById("btn-close-help");
  const dockBtnMore = document.getElementById("dock-btn-more");
  const dockBtnParty = document.getElementById("dock-btn-party");

  setupDialogBackdropDismiss(helpModal);

  function openHelpModal() {
    if (helpModal) openModal(helpModal);
  }

  if (btnCloseHelp) btnCloseHelp.addEventListener("click", () => closeModal(helpModal));
  if (dockBtnMore) dockBtnMore.addEventListener("click", openHelpModal);
  if (dockBtnParty) dockBtnParty.addEventListener("click", (e) => { e.preventDefault(); openJoinModal(); });

  // --------------------------------------------------------------------------
  // Profile / Settings Modal
  // --------------------------------------------------------------------------
  const profileDialog = document.getElementById("profile-dialog");
  const btnCloseProfile = document.getElementById("btn-close-profile");
  const btnSaveProfile = document.getElementById("btn-save-profile");
  const inputDisplayName = document.getElementById("input-display-name");
  const ctrlBtnGear = document.getElementById("ctrl-btn-gear");

  setupDialogBackdropDismiss(profileDialog);

  function openProfileModal() {
    if (profileDialog) {
      if (inputDisplayName) inputDisplayName.value = currentUsername;
      openModal(profileDialog);
      if (inputDisplayName) {
        setTimeout(() => inputDisplayName.focus(), 50);
      }
    }
  }

  if (ctrlBtnGear) ctrlBtnGear.addEventListener("click", openProfileModal);
  if (btnCloseProfile) btnCloseProfile.addEventListener("click", () => closeModal(profileDialog));
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", () => {
      const name = inputDisplayName ? inputDisplayName.value.trim() : currentUsername;
      saveProfile(name);
      closeModal(profileDialog);
      showToast(`Saved as ${currentUsername}`);
    });
  }

  // --------------------------------------------------------------------------
  // TV Status Toast Notification
  // --------------------------------------------------------------------------
  const tvFeedbackToast = document.getElementById("tv-feedback-toast");
  let toastTimer = null;

  function showToast(msg) {
    if (!tvFeedbackToast) return;
    tvFeedbackToast.textContent = msg;
    tvFeedbackToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      tvFeedbackToast.classList.remove("show");
    }, 1800);
  }

  // --------------------------------------------------------------------------
  // Media Preview Player Interactive Controls & Live Playback
  // --------------------------------------------------------------------------
  const ctrlBtnPlay = document.getElementById("ctrl-btn-play");
  const ctrlScrubberWrap = document.getElementById("ctrl-scrubber-wrap");
  const ctrlScrubberFill = document.getElementById("ctrl-scrubber-fill");
  const ctrlScrubberThumb = document.getElementById("ctrl-scrubber-thumb");
  const ctrlTimeDisplay = document.getElementById("ctrl-time-display");
  const ctrlBtnVolume = document.getElementById("ctrl-btn-volume");
  const ctrlBtnCc = document.getElementById("ctrl-btn-cc");
  const ctrlBtnFullscreen = document.getElementById("ctrl-btn-fullscreen");
  const btnMobPlay = document.getElementById("btn-mob-play");
  const btnMobFs = document.getElementById("btn-mob-fs");
  const hudSyncPill = document.getElementById("hud-sync-pill");
  const screenArtwork = document.getElementById("screen-artwork");
  const hudChannelTitle = document.getElementById("hud-channel-title");
  const playerMonitor = document.getElementById("player-monitor");
  const floatingReactionsStage = document.getElementById("floating-reactions-stage");

  let isPlaying = true;
  let isMuted = false;
  let hasCc = true;
  let currentSec = 756; // 12m 36s
  const totalSec = 8890; // 2h 28m 10s

  function formatTime(s) {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
  }

  function updateScrubberUI() {
    const pct = (currentSec / totalSec) * 100;
    if (ctrlScrubberFill) ctrlScrubberFill.style.width = `${pct}%`;
    if (ctrlScrubberThumb) ctrlScrubberThumb.style.left = `${pct}%`;
    if (ctrlTimeDisplay) {
      ctrlTimeDisplay.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
    }
  }

  // Ticking playback timer (increments every second while playing)
  setInterval(() => {
    if (isPlaying) {
      currentSec = (currentSec + 1) % totalSec;
      updateScrubberUI();
    }
  }, 1000);

  function togglePlayState() {
    isPlaying = !isPlaying;
    const playIcon = document.getElementById("icon-play-state");
    if (playIcon) {
      if (isPlaying) {
        playIcon.innerHTML = `
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        `;
        if (ctrlBtnPlay) ctrlBtnPlay.setAttribute("aria-label", "Pause playback");
      } else {
        playIcon.innerHTML = `
          <polygon points="6 4 19 12 6 20 6 4"/>
        `;
        if (ctrlBtnPlay) ctrlBtnPlay.setAttribute("aria-label", "Start playback");
      }
    }
    showToast(isPlaying ? "Playing • In sync" : "Playback paused");
  }

  if (ctrlBtnPlay) ctrlBtnPlay.addEventListener("click", togglePlayState);
  if (btnMobPlay) btnMobPlay.addEventListener("click", togglePlayState);

  // Scrubber drag / click seek
  if (ctrlScrubberWrap) {
    let isDragging = false;

    function handleScrub(e) {
      const rect = ctrlScrubberWrap.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      currentSec = Math.floor((pct / 100) * totalSec);
      updateScrubberUI();
    }

    ctrlScrubberWrap.addEventListener("click", handleScrub);
    ctrlScrubberWrap.addEventListener("mousedown", (e) => {
      isDragging = true;
      handleScrub(e);
    });
    window.addEventListener("mousemove", (e) => {
      if (isDragging) handleScrub(e);
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
    });
    ctrlScrubberWrap.addEventListener("touchstart", (e) => {
      isDragging = true;
      handleScrub(e);
    }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (isDragging) handleScrub(e);
    }, { passive: true });
    window.addEventListener("touchend", () => {
      isDragging = false;
    });
  }

  // Volume toggle
  if (ctrlBtnVolume) {
    ctrlBtnVolume.addEventListener("click", () => {
      isMuted = !isMuted;
      if (isMuted) {
        ctrlBtnVolume.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        `;
        showToast("Audio Muted");
      } else {
        ctrlBtnVolume.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        `;
        showToast("Audio Active (100%)");
      }
    });
  }

  // Subtitles toggle
  if (ctrlBtnCc) {
    ctrlBtnCc.addEventListener("click", () => {
      hasCc = !hasCc;
      showToast(hasCc ? "English Subtitles ON" : "Subtitles OFF");
    });
  }

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      showToast("Fullscreen Mode");
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      showToast("Exited Fullscreen");
    }
  }

  if (ctrlBtnFullscreen) ctrlBtnFullscreen.addEventListener("click", toggleFullscreen);
  if (btnMobFs) btnMobFs.addEventListener("click", toggleFullscreen);

  // --------------------------------------------------------------------------
  // Floating Reaction Particle Engine (Zero Unicode Emojis)
  // --------------------------------------------------------------------------
  function spawnReaction(type, clientX = null) {
    if (!floatingReactionsStage) return;

    const particle = document.createElement("div");
    particle.className = "reaction-particle";

    const stageRect = floatingReactionsStage.getBoundingClientRect();
    let leftPercent = 50;
    if (clientX && stageRect.width > 0) {
      leftPercent = Math.max(10, Math.min(90, ((clientX - stageRect.left) / stageRect.width) * 100));
    }
    const jitter = (Math.random() * 24 - 12);
    particle.style.left = `calc(${leftPercent}% + ${jitter}px)`;

    let svgIcon = "";
    if (type === "heart") {
      svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#FF5376"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    } else if (type === "fire") {
      svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#FF9500"><path d="M12 23c-4.97 0-9-4.03-9-9 0-3.92 2.5-7.24 6-8.48.5-.18 1 .2 1 .73v.15c0 .32-.2.6-.5.72-2.14.86-3.5 2.92-3.5 5.38 0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24-.26-.26-.26-.68 0-.94.26-.26.68-.26.94 0C19.34 9.18 20 11.25 20 14c0 4.97-4.03 9-9 9z"/></svg>`;
    } else if (type === "star") {
      svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#FFB84D"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    } else {
      svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#F4D06F"><path d="M19 4h-2.18C16.4 2.84 15.3 2 14 2c-.93 0-1.75.42-2.3 1.08C11.15 2.42 10.33 2 9.4 2 8.1 2 7 2.84 6.58 4H5c-1.1 0-2 .9-2 2v1h18V6c0-1.1-.9-2-2-2zM4 9l1.6 11.2c.13.92.92 1.6 1.85 1.6h9.1c.93 0 1.72-.68 1.85-1.6L20 9H4zm7 10H9v-8h2v8zm4 0h-2v-8h2v8z"/></svg>`;
    }

    particle.innerHTML = svgIcon;
    floatingReactionsStage.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
    }, 2300);
  }

  // Reaction button triggers
  document.querySelectorAll(".btn-reaction-trigger, .btn-hud-reaction").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const reactionType = btn.getAttribute("data-reaction") || "heart";
      spawnReaction(reactionType);
      setTimeout(() => spawnReaction(reactionType), 140);
      showToast(`Reaction sent: ${reactionType}`);
    });
  });

  // Clicking player screen triggers heart reaction
  if (playerMonitor) {
    playerMonitor.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest(".tv-scrubber-track")) return;
      spawnReaction("heart", e.clientX);
    });
  }

  // Sync Pill click shows sync stats
  if (hudSyncPill) {
    hudSyncPill.addEventListener("click", (e) => {
      e.stopPropagation();
      showToast("Sync Health: 100% • Ping: 12ms • 0.0s delay with 4 peers");
    });
  }

  // --------------------------------------------------------------------------
  // Streaming Source Shelf Interactions
  // --------------------------------------------------------------------------
  const serviceChannels = {
    youtube: {
      name: "YouTube",
      title: "Tokyo Sunset • Live Stream",
      art: "/img/concept_watch_party.jpg"
    },
    netflix: {
      name: "Netflix",
      title: "Stranger Things S4:E1 • In Sync",
      art: "/img/clean_anime_sunset_16_9.jpg"
    },
    disney: {
      name: "Disney+",
      title: "Makoto & Ghibli • Movie Night",
      art: "/img/concept_watch_party.jpg"
    },
    prime: {
      name: "Prime Video",
      title: "Interstellar • Synchronized",
      art: "/img/clean_anime_sunset_16_9.jpg"
    },
    hotstar: {
      name: "JioHotstar",
      title: "Cricket World Cup • Watch Party",
      art: "/img/concept_watch_party.jpg"
    },
    mx: {
      name: "MX Player",
      title: "Cinema Vault • Shared Session",
      art: "/img/clean_anime_sunset_16_9.jpg"
    }
  };

  document.querySelectorAll(".stream-card-btn, .dock-service-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const svc = item.getAttribute("data-service");
      if (svc === "more") {
        openHelpModal();
        return;
      }
      if (svc === "party") {
        openJoinModal();
        return;
      }

      document.querySelectorAll(".stream-card-btn, .dock-service-item").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-selected", "false");
      });
      item.classList.add("active");
      item.setAttribute("aria-selected", "true");

      const channel = serviceChannels[svc];
      if (channel) {
        if (hudChannelTitle) hudChannelTitle.textContent = channel.title;
        if (screenArtwork && screenArtwork.getAttribute("src") !== channel.art) {
          screenArtwork.style.opacity = "0.4";
          setTimeout(() => {
            screenArtwork.src = channel.art;
            screenArtwork.style.opacity = "1";
          }, 180);
        }
        showToast(`Connected to ${channel.name} • ${channel.title}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Showcase Video Reel & Canvas Ambient Renderer
  // --------------------------------------------------------------------------
  const showcaseVideo = document.getElementById("showcase-reel-video");
  const showcaseCanvas = document.getElementById("showcase-reel-canvas");
  const btnShowcaseSound = document.getElementById("btn-showcase-sound");
  const iconShowcaseSound = document.getElementById("icon-showcase-sound");

  if (showcaseVideo && showcaseCanvas) {
    const ctx = showcaseCanvas.getContext("2d", { alpha: true });
    let animFrameId = null;

    function resizeCanvas() {
      const w = showcaseVideo.videoWidth || 720;
      const h = showcaseVideo.videoHeight || 540;
      if (showcaseCanvas.width !== w || showcaseCanvas.height !== h) {
        showcaseCanvas.width = w;
        showcaseCanvas.height = h;
      }
    }

    function renderLoop() {
      if (!showcaseVideo.paused && !showcaseVideo.ended) {
        if (showcaseCanvas.width !== (showcaseVideo.videoWidth || 720)) {
          resizeCanvas();
        }
        ctx.drawImage(showcaseVideo, 0, 0, showcaseCanvas.width, showcaseCanvas.height);
      }
      animFrameId = requestAnimationFrame(renderLoop);
    }

    showcaseVideo.addEventListener("loadedmetadata", resizeCanvas);
    showcaseVideo.addEventListener("canplay", () => {
      resizeCanvas();
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(renderLoop);
      }
    });
    showcaseVideo.addEventListener("play", () => {
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(renderLoop);
      }
    });

    const playPromise = showcaseVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        showcaseVideo.muted = true;
        showcaseVideo.play().catch(() => {});
      });
    }

    if (showcaseVideo.readyState >= 2) {
      resizeCanvas();
      animFrameId = requestAnimationFrame(renderLoop);
    }
  }

  if (showcaseVideo && btnShowcaseSound) {
    btnShowcaseSound.addEventListener("click", () => {
      showcaseVideo.muted = !showcaseVideo.muted;
      if (showcaseVideo.muted) {
        if (iconShowcaseSound) {
          iconShowcaseSound.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          `;
        }
        btnShowcaseSound.setAttribute("aria-label", "Unmute showcase audio");
        showToast("Showcase audio muted");
      } else {
        if (iconShowcaseSound) {
          iconShowcaseSound.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          `;
        }
        btnShowcaseSound.setAttribute("aria-label", "Mute showcase audio");
        showToast("Showcase audio unmuted");
      }
    });
  }
});
