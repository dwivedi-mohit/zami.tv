/**
 * CineSync Shared Room Queue & Playlist Manager
 * Synchronizes upcoming videos, handles queue ordering, quick add, and autoplay next.
 */

class RoomQueueManager {
  constructor(socket) {
    this.socket = socket;
    this.playlist = [];

    this.container = document.getElementById('queue-items-container');
    this.badge = document.getElementById('queue-badge');
    this.btnSkip = document.getElementById('btn-queue-skip');
    this.btnClear = document.getElementById('btn-queue-clear');
    this.quickUrlInput = document.getElementById('queue-quick-url');
    this.btnQuickAdd = document.getElementById('btn-queue-quick-add');

    this.initControls();
  }

  initControls() {
    if (this.btnSkip) {
      this.btnSkip.disabled = true;
      this.btnSkip.setAttribute('aria-disabled', 'true');
      this.btnSkip.addEventListener('click', () => {
        if (!this.playlist || this.playlist.length === 0) {
          if (window.showToast) window.showToast('No more videos in queue', 'info');
        } else {
          this.socket.emit('playlist-next');
          if (window.showToast) window.showToast('Skipping to next queued reel...', 'info');
        }
      });
    }

    if (this.btnClear) {
      this.btnClear.disabled = true;
      this.btnClear.setAttribute('aria-disabled', 'true');
      this.btnClear.addEventListener('click', () => {
        if (!this.playlist || this.playlist.length === 0) {
          if (window.showToast) window.showToast('Queue is already empty', 'info');
          return;
        }
        this.socket.emit('playlist-clear');
        if (window.showToast) window.showToast('Party queue cleared', 'info');
      });
    }

    if (this.btnQuickAdd && this.quickUrlInput) {
      const handleQuickAdd = () => {
        const url = this.quickUrlInput.value.trim();
        if (!url) return;
        this.addItemFromUrl(url);
        this.quickUrlInput.value = '';
      };
      this.btnQuickAdd.addEventListener('click', handleQuickAdd);
      this.quickUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuickAdd();
        }
      });
    }
  }

  async addItemFromUrl(url, title = null, poster = null) {
    let type = 'url';
    const isYt = url.includes('youtube.com') || url.includes('youtu.be');
    if (isYt) {
      type = 'youtube';
    } else if (url.includes('.m3u8')) {
      type = 'hls';
    }

    let finalTitle = title;
    let finalPoster = poster;

    if (isYt && (!finalTitle || !finalPoster)) {
      try {
        const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data && data.success) {
          if (!finalTitle && data.title) finalTitle = data.title;
          if (!finalPoster && data.poster) finalPoster = data.poster;
        }
      } catch (e) {
        console.warn('[QUEUE] Could not fetch YouTube info:', e);
      }
    }

    const itemTitle = finalTitle || (type === 'youtube' ? 'YouTube Video' : 'Web Stream');

    this.socket.emit('playlist-add', {
      item: {
        type,
        url,
        title: itemTitle,
        poster: finalPoster
      }
    });
    if (window.showToast) {
      window.showToast(`Queued: "${itemTitle}"`, 'success');
    }
  }

  updatePlaylist(playlist) {
    this.playlist = playlist || [];
    this.render();
  }

  render() {
    if (this.badge) {
      this.badge.textContent = this.playlist.length;
    }
    const mobQueueBadge = document.getElementById('mob-queue-badge');
    if (mobQueueBadge) {
      mobQueueBadge.textContent = this.playlist.length;
      mobQueueBadge.style.display = this.playlist.length > 0 ? 'flex' : 'none';
    }
    const callQueueBadge = document.getElementById('call-card-queue-badge');
    if (callQueueBadge) {
      callQueueBadge.textContent = this.playlist.length;
    }
    const headerCount = document.getElementById('queue-header-count');
    if (headerCount) {
      headerCount.textContent = this.playlist.length === 1 ? '1 item' : `${this.playlist.length} items`;
    }

    const btnSkip = document.getElementById('btn-queue-skip');
    const btnClear = document.getElementById('btn-queue-clear');
    const isEmpty = !this.playlist || this.playlist.length === 0;
    if (btnSkip) {
      btnSkip.disabled = isEmpty;
      btnSkip.setAttribute('aria-disabled', String(isEmpty));
      btnSkip.style.opacity = isEmpty ? '0.35' : '1';
      btnSkip.style.pointerEvents = isEmpty ? 'none' : 'auto';
    }
    if (btnClear) {
      btnClear.disabled = isEmpty;
      btnClear.setAttribute('aria-disabled', String(isEmpty));
      btnClear.style.opacity = isEmpty ? '0.35' : '1';
      btnClear.style.pointerEvents = isEmpty ? 'none' : 'auto';
    }

    if (!this.container) return;

    if (this.playlist.length === 0) {
      this.container.innerHTML = `
        <div class="queue-empty-state">
          <div class="queue-empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <div class="queue-empty-title">Queue is empty</div>
          <div class="queue-empty-desc">Choose a source or paste a link to start watching together.</div>
          <div class="queue-empty-choices">
            <button type="button" class="btn-queue-choice" id="btn-queue-choice-movies">
              <svg class="choice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <div class="choice-text">
                <span class="choice-title">Browse Movies</span>
              </div>
              <svg class="choice-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button type="button" class="btn-queue-choice" id="btn-queue-choice-link">
              <svg class="choice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <div class="choice-text">
                <span class="choice-title">Paste Video URL</span>
              </div>
              <svg class="choice-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button type="button" class="btn-queue-choice" id="btn-queue-choice-more">
              <svg class="choice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <div class="choice-text">
                <span class="choice-title">More Sources</span>
              </div>
              <svg class="choice-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      `;
      const btnMovies = this.container.querySelector('#btn-queue-choice-movies');
      if (btnMovies) {
        btnMovies.addEventListener('click', () => {
          const modal = document.getElementById('media-modal');
          if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            if (window.showVaultView) window.showVaultView('movies');
          }
        });
      }
      const btnLink = this.container.querySelector('#btn-queue-choice-link');
      if (btnLink) {
        btnLink.addEventListener('click', () => {
          if (this.quickUrlInput) {
            this.quickUrlInput.focus();
            this.quickUrlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
      const btnMore = this.container.querySelector('#btn-queue-choice-more');
      if (btnMore) {
        btnMore.addEventListener('click', () => {
          const modal = document.getElementById('media-modal');
          if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            if (window.showVaultView) window.showVaultView('menu');
          }
        });
      }
      return;
    }

    const escape = (str) => {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    };

    this.container.innerHTML = this.playlist.map((item, idx) => {
      const poster = item.poster || item.backdrop || 'https://via.placeholder.com/80x45?text=Video';
      const durationStr = item.duration ? `${Math.floor(item.duration / 60)}m` : '';
      return `
        <div class="queue-item-card" data-id="${item.id}">
          <span class="queue-item-idx">${idx + 1}</span>
          <img src="${poster}" class="queue-item-thumb" alt="${escape(item.title)}" onerror="this.src='https://via.placeholder.com/80x45?text=Video'">
          <div class="queue-item-details">
            <div class="queue-item-title" title="${escape(item.title)}">${escape(item.title)}</div>
            <div class="queue-item-meta">
              <span class="queue-item-type">${escape(item.type.toUpperCase())}</span>
              ${durationStr ? `<span class="queue-item-dur">${durationStr}</span>` : ''}
              <span class="queue-item-by">by ${escape(item.addedBy || 'Member')}</span>
            </div>
          </div>
          <div class="queue-item-actions">
            ${idx > 0 ? `
            <button class="btn-queue-move-up queue-mini-btn" title="Move Up" data-index="${idx}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            </button>` : ''}
            ${idx < this.playlist.length - 1 ? `
            <button class="btn-queue-move-down queue-mini-btn" title="Move Down" data-index="${idx}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>` : ''}
            <button class="btn-queue-play queue-mini-btn" title="Play Now" data-id="${item.id}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="btn-queue-remove queue-mini-btn" title="Remove" data-id="${item.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners
    this.container.querySelectorAll('.btn-queue-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fromIdx = parseInt(btn.dataset.index, 10);
        if (fromIdx > 0) {
          this.socket.emit('playlist-reorder', { fromIndex: fromIdx, toIndex: fromIdx - 1 });
        }
      });
    });

    this.container.querySelectorAll('.btn-queue-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fromIdx = parseInt(btn.dataset.index, 10);
        if (fromIdx < this.playlist.length - 1) {
          this.socket.emit('playlist-reorder', { fromIndex: fromIdx, toIndex: fromIdx + 1 });
        }
      });
    });

    this.container.querySelectorAll('.btn-queue-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.socket.emit('playlist-play', { itemId: id });
      });
    });

    this.container.querySelectorAll('.btn-queue-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.socket.emit('playlist-remove', { itemId: id });
      });
    });
  }

  startAutoplayCountdown(seconds = 5) {
    if (!this.playlist || this.playlist.length === 0) return;
    this.cancelAutoplayCountdown();

    const overlay = document.getElementById('stage-upnext-countdown');
    if (!overlay) return;

    const nextItem = this.playlist[0];
    const titleEl = document.getElementById('upnext-title');
    const timeEl = document.getElementById('upnext-countdown-time');
    const numEl = document.getElementById('upnext-seconds-num');
    const ringFill = document.getElementById('upnext-ring-fill');
    const btnPlay = document.getElementById('btn-upnext-play');
    const btnCancel = document.getElementById('btn-upnext-cancel');

    if (titleEl) titleEl.textContent = nextItem.title || 'Next Queued Reel';

    let remaining = seconds;
    const total = seconds;

    const updateDisplay = () => {
      if (timeEl) timeEl.textContent = `${remaining}s`;
      if (numEl) numEl.textContent = `${remaining}`;
      if (ringFill) {
        const pct = Math.max(0, (remaining / total) * 100);
        ringFill.setAttribute('stroke-dasharray', `${pct}, 100`);
      }
    };

    updateDisplay();
    overlay.style.display = 'block';

    const handlePlayNow = () => {
      this.cancelAutoplayCountdown();
      this.socket.emit('playlist-next');
    };

    const handleCancel = () => {
      this.cancelAutoplayCountdown();
      if (window.showToast) window.showToast('Autoplay next cancelled', 'info');
    };

    if (btnPlay) {
      btnPlay.onclick = (e) => {
        e.stopPropagation();
        handlePlayNow();
      };
    }

    if (btnCancel) {
      btnCancel.onclick = (e) => {
        e.stopPropagation();
        handleCancel();
      };
    }

    this.autoplayCountdownTimer = setInterval(() => {
      remaining -= 1;
      updateDisplay();
      if (remaining <= 0) {
        this.cancelAutoplayCountdown();
        this.socket.emit('playlist-next');
      }
    }, 1000);
  }

  cancelAutoplayCountdown() {
    if (this.autoplayCountdownTimer) {
      clearInterval(this.autoplayCountdownTimer);
      this.autoplayCountdownTimer = null;
    }
    const overlay = document.getElementById('stage-upnext-countdown');
    if (overlay) overlay.style.display = 'none';
  }
}

window.RoomQueueManager = RoomQueueManager;
