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

    const btnSkip = document.getElementById('btn-queue-skip');
    const btnClear = document.getElementById('btn-queue-clear');
    if (btnSkip) {
      btnSkip.disabled = this.playlist.length === 0;
      btnSkip.style.opacity = this.playlist.length === 0 ? '0.45' : '1';
      btnSkip.style.pointerEvents = this.playlist.length === 0 ? 'none' : 'auto';
    }
    if (btnClear) {
      btnClear.disabled = this.playlist.length === 0;
      btnClear.style.opacity = this.playlist.length === 0 ? '0.45' : '1';
      btnClear.style.pointerEvents = this.playlist.length === 0 ? 'none' : 'auto';
    }

    if (!this.container) return;

    if (this.playlist.length === 0) {
      this.container.innerHTML = `
        <div class="queue-empty-state">
          <div class="queue-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <div class="queue-empty-title">Queue is empty</div>
          <div class="queue-empty-desc">Paste any video or YouTube link below, or browse movies to queue up shows for everyone.</div>
          <button type="button" class="btn btn-secondary btn-xs" id="btn-empty-queue-load" style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
            <span>Browse Media</span>
          </button>
        </div>
      `;
      const emptyLoadBtn = this.container.querySelector('#btn-empty-queue-load');
      if (emptyLoadBtn) {
        emptyLoadBtn.addEventListener('click', () => {
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
          <span class="queue-item-idx">#${idx + 1}</span>
          <img src="${poster}" class="queue-item-thumb" alt="${escape(item.title)}" onerror="this.src='https://via.placeholder.com/80x45?text=Reel'">
          <div class="queue-item-details">
            <div class="queue-item-title" title="${escape(item.title)}">${escape(item.title)}</div>
            <div class="queue-item-meta">
              <span class="queue-item-badge">${escape(item.type.toUpperCase())}</span>
              <span class="queue-item-by">by ${escape(item.addedBy || 'Member')}</span>
              ${durationStr ? `<span class="queue-item-dur">${durationStr}</span>` : ''}
            </div>
          </div>
          <div class="queue-item-actions">
            ${idx > 0 ? `
            <button class="btn-queue-move-up btn btn-icon btn-xs" title="Move Up in Queue" data-index="${idx}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            </button>` : ''}
            ${idx < this.playlist.length - 1 ? `
            <button class="btn-queue-move-down btn btn-icon btn-xs" title="Move Down in Queue" data-index="${idx}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>` : ''}
            <button class="btn-queue-play btn btn-icon btn-xs" title="Play Now" data-id="${item.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="btn-queue-remove btn btn-icon btn-xs" title="Remove" data-id="${item.id}">
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
