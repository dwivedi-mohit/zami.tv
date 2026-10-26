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
  // Media Preview Player Interactive Controls
  // --------------------------------------------------------------------------
  const ctrlBtnPlay = document.getElementById("ctrl-btn-play");
  const ctrlScrubberWrap = document.getElementById("ctrl-scrubber-wrap");
  const ctrlScrubberFill = document.getElementById("ctrl-scrubber-fill");
  const ctrlBtnVolume = document.getElementById("ctrl-btn-volume");
  const ctrlBtnCc = document.getElementById("ctrl-btn-cc");
  const ctrlBtnFullscreen = document.getElementById("ctrl-btn-fullscreen");
  const btnMobPlay = document.getElementById("btn-mob-play");
  const btnMobFs = document.getElementById("btn-mob-fs");

  let isPlaying = true;
  let isMuted = false;
  let hasCc = true;

  if (ctrlBtnPlay) {
    ctrlBtnPlay.addEventListener("click", () => {
      isPlaying = !isPlaying;
      showToast(isPlaying ? "Playing • In sync" : "Paused");
    });
  }

  if (btnMobPlay) {
    btnMobPlay.addEventListener("click", () => {
      isPlaying = !isPlaying;
      showToast(isPlaying ? "Playing • In sync" : "Paused");
    });
  }

  if (ctrlScrubberWrap) {
    let isDragging = false;

    function handleScrub(e) {
      const rect = ctrlScrubberWrap.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      if (ctrlScrubberFill) ctrlScrubberFill.style.width = `${pct}%`;
      if (ctrlScrubberThumb) ctrlScrubberThumb.style.left = `${pct}%`;
      currentSec = Math.floor((pct / 100) * totalSec);
      if (ctrlTimeDisplay) {
        ctrlTimeDisplay.textContent = `${formatTime(currentSec)} / ${formatTime(totalSec)}`;
      }
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

  if (ctrlBtnCc) {
    ctrlBtnCc.addEventListener("click", () => {
      hasCc = !hasCc;
      showToast(hasCc ? "English Subtitles ON" : "Subtitles OFF");
    });
  }

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
  // Streaming Dock Interactions
  // --------------------------------------------------------------------------
  document.querySelectorAll(".dock-hotspot-btn, .dock-service-item, .dock-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const svc = tile.getAttribute("data-service");
      if (svc === "more") {
        openHelpModal();
      } else if (svc === "party") {
        openJoinModal();
      } else {
        const names = {
          netflix: "Netflix",
          disney: "Disney+",
          prime: "Prime Video",
          youtube: "YouTube",
          hotstar: "JioHotstar",
          mx: "MX Player"
        };
        showToast(`Connect to ${names[svc] || svc}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature Cards Interactions
  // --------------------------------------------------------------------------
  document.querySelectorAll(".card-hotspot").forEach((card) => {
    card.addEventListener("click", () => {
      const feat = card.getAttribute("data-feature");
      const titles = {
        sync: "Sync in Real-Time — Sub-second lag",
        anything: "Watch Anything — MP4, MKV, YouTube, Streams",
        together: "Be Together — Spatial audio & chat",
        device: "On Any Device — Mobile, Tablet & Desktop"
      };
      showToast(titles[feat] || "Feature Selected");
    });
  });
});
