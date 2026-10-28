const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

/**
 * Find an available local port
 */
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Remote Browser Session per CineSync Room
 * Controls headless Chromium/Brave via Chrome DevTools Protocol (CDP)
 */
class RemoteBrowserSession {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.proc = null;
    this.ws = null;
    this.port = null;
    this.status = 'idle'; // 'idle' | 'starting' | 'ready' | 'closed' | 'error'
    this.currentUrl = 'https://www.youtube.com';
    this.currentTitle = 'CineSync Remote Stage';
    this.canGoBack = false;
    this.canGoForward = false;
    this.lastActive = Date.now();
    this.profileDir = path.join(os.tmpdir(), `cinesync-remote-profile-${roomId}`);
    this.msgId = 1;
    this.callbacks = new Map();
    this.screencastActive = false;
    this.hostOnlyControl = false;
    this.hostId = null;

    // Viewport resolution - Native 1080p Full HD by default for razor-sharp clarity
    this.width = 1920;
    this.height = 1080;
    this.quality = 92;
    this.currentQualityMode = '1080p';
    this.trailingFrameTimer = null;

    // Audio capture & streaming
    this.audioProc = null;
    this.audioClients = new Set();
  }

  log(msg, ...args) {
    console.log(`[RemoteBrowser][${this.roomId}] ${msg}`, ...args);
  }

  warn(msg, ...args) {
    console.warn(`[RemoteBrowser][${this.roomId}] [WARN] ${msg}`, ...args);
  }

  error(msg, ...args) {
    console.error(`[RemoteBrowser][${this.roomId}] [ERROR] ${msg}`, ...args);
  }

  async start(initialUrl = 'https://www.youtube.com', options = {}) {
    if (this.status === 'starting' || this.status === 'ready') {
      if (initialUrl && initialUrl !== this.currentUrl) {
        await this.navigate(initialUrl, options);
      }
      return;
    }

    this.status = 'starting';
    this.currentUrl = initialUrl || 'https://www.youtube.com';
    this.lastActive = Date.now();
    this.isMobile = !!options.isMobile;
    if (this.isMobile) {
      this.width = options.width ? Math.round(options.width) : 412;
      this.height = options.height ? Math.round(options.height) : 340;
    } else {
      this.width = options.width ? Math.round(options.width) : 1920;
      this.height = options.height ? Math.round(options.height) : 1080;
    }

    try {
      this.port = await getAvailablePort();
      fs.mkdirSync(this.profileDir, { recursive: true });

      const browserBin = process.env.CHROME_BIN || '/bin/brave-browser';
      this.log(`Launching isolated browser on 127.0.0.1:${this.port} using ${browserBin} (Mobile: ${this.isMobile}, ${this.width}x${this.height})`);

      const desktopUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      const mobileUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
      const activeUA = this.isMobile ? mobileUA : desktopUA;

      const args = [
        '--headless=new',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
        `--window-size=${this.width},${this.height}`,
        '--force-device-scale-factor=1',
        '--high-dpi-support=1',
        '--font-render-hinting=slight',
        '--enable-font-antialiasing',
        `--remote-debugging-port=${this.port}`,
        '--remote-debugging-address=127.0.0.1',
        `--user-data-dir=${this.profileDir}`,
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        `--user-agent=${activeUA}`,
        this.currentUrl
      ];

      this.ensureAudioSystemReady();

      this.proc = spawn(browserBin, args, {
        stdio: 'ignore',
        env: {
          ...process.env,
          PULSE_SINK: 'cinesync_sink'
        }
      });

      this.proc.on('exit', (code, signal) => {
        this.log(`Process exited with code ${code}, signal ${signal}`);
        this.status = 'closed';
        this.notifyStatus('closed', 'Remote browser session ended');
      });

      this.proc.on('error', (err) => {
        this.error('Failed to spawn browser:', err);
        this.status = 'error';
        this.notifyStatus('error', err.message);
      });

      // Wait for DevTools endpoint to become available
      await this.connectCDP();

      // Configure viewport and enable domains
      await this.sendCommand('Page.enable');
      await this.sendCommand('Runtime.enable');
      await this.sendCommand('Network.enable');

      // Set realistic User-Agent
      await this.sendCommand('Network.setUserAgentOverride', {
        userAgent: activeUA
      });

      // Emulate viewport size
      await this.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: this.width,
        height: this.height,
        deviceScaleFactor: this.isMobile ? 2 : 1,
        mobile: !!this.isMobile
      });

      // Auto-unmute video and audio elements, dark scrollbars, and cookie banner auto-dismiss
      await this.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: this.getInjectedPageEnhancementsScript()
      });

      this.injectAutoUnmute();

      // Start video screencast stream
      await this.startScreencast();

      // Pre-start audio capture from PulseAudio monitor
      this.startAudioStream();

      this.status = 'ready';
      this.log('Remote browser session is READY');
      this.notifyStatus('ready', 'Connected to remote browser session');

    } catch (err) {
      this.error('Failed to start remote browser:', err);
      this.status = 'error';
      this.notifyStatus('error', err.message);
      this.stop();
      throw err;
    }
  }

  async connectCDP(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        if (res.ok) {
          const listRes = await fetch(`http://127.0.0.1:${this.port}/json/list`);
          const tabs = await listRes.json();
          const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
          if (targetTab && targetTab.webSocketDebuggerUrl) {
            this.log('Connecting to DevTools WebSocket:', targetTab.webSocketDebuggerUrl);
            await this.openWebSocket(targetTab.webSocketDebuggerUrl);
            return;
          }
        }
      } catch (e) {
        // Retry until ready
      }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Timed out waiting for browser DevTools interface');
  }

  openWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.log('CDP WebSocket connected');
        resolve();
      };

      this.ws.onerror = (err) => {
        this.error('CDP WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.log('CDP WebSocket closed');
        this.ws = null;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleCDPMessage(msg);
        } catch (e) {}
      };
    });
  }

  handleCDPMessage(msg) {
    // Check if response to a pending command
    if (msg.id && this.callbacks.has(msg.id)) {
      const { resolve, reject } = this.callbacks.get(msg.id);
      this.callbacks.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || 'CDP Error'));
      } else {
        resolve(msg.result);
      }
      return;
    }

    // Handle incoming events
    if (msg.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = msg.params;
      this.lastActive = Date.now();

      // Flow control: acknowledge frame immediately to receive next
      this.sendCommand('Page.screencastFrameAck', { sessionId }).catch(() => {});

      if (this.trailingFrameTimer) {
        clearTimeout(this.trailingFrameTimer);
        this.trailingFrameTimer = null;
      }

      // Throttle broadcast to ~40 FPS (25ms interval) for fluid responsive playback
      const now = Date.now();
      if (this.lastBroadcast && (now - this.lastBroadcast < 25)) {
        // Schedule trailing frame emit so final sharp frame is never skipped when motion ceases
        this.trailingFrameTimer = setTimeout(() => {
          this.broadcastFrame(data, metadata);
          this.lastBroadcast = Date.now();
        }, 25);
        return;
      }
      this.lastBroadcast = now;

      this.broadcastFrame(data, metadata);
      return;
    }

    if (msg.method === 'Page.frameNavigated') {
      const frame = msg.params.frame;
      if (!frame.parentId) {
        // Main frame navigated
        this.currentUrl = frame.url;
        this.log('Page navigated to:', frame.url);
        this.io.to(this.roomId).emit('remote-browser-navigated', {
          url: frame.url,
          title: this.currentTitle
        });
        this.injectAutoUnmute();
      }
      return;
    }

    if (msg.method === 'Page.loadEventFired' || msg.method === 'Page.domContentEventFired') {
      this.injectAutoUnmute();
      return;
    }

    if (msg.method === 'Page.navigatedWithinDocument') {
      this.currentUrl = msg.params.url;
      this.io.to(this.roomId).emit('remote-browser-navigated', {
        url: msg.params.url,
        title: this.currentTitle
      });
      this.injectAutoUnmute();
      return;
    }
  }

  getInjectedPageEnhancementsScript() {
    return `
      (() => {
        // 0. Automation & Stealth Overrides
        try {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          if (!window.chrome) window.chrome = {};
          if (!window.chrome.runtime) window.chrome.runtime = {};
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        } catch(e) {}

        // 1. ZAMI Cinematic Dark Scrollbars
        const injectDarkScrollbars = () => {
          try {
            if (document.getElementById('__zami_dark_scrollbars')) return;
            const style = document.createElement('style');
            style.id = '__zami_dark_scrollbars';
            style.textContent = \`
              ::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
              ::-webkit-scrollbar-track { background: #08090d !important; }
              ::-webkit-scrollbar-thumb { background: #232733 !important; border-radius: 4px !important; border: 1px solid rgba(255,255,255,0.06) !important; }
              ::-webkit-scrollbar-thumb:hover { background: #d4a373 !important; }
              * { scrollbar-color: #232733 #08090d !important; scrollbar-width: thin !important; }
            \`;
            (document.head || document.documentElement).appendChild(style);
          } catch(e) {}
        };

        // 2. Auto-Dismiss Annoying Cookie Consent Banners
        const dismissCookieBanners = () => {
          try {
            const acceptSelectors = [
              '#onetrust-accept-btn-handler',
              '#onetrust-reject-all-handler',
              '#accept-recommended-btn-handler',
              '.cookie-banner button.agree',
              '.cookie-banner button.accept',
              '#didomi-notice-agree-button',
              '.fc-cta-consent',
              '.fc-consent-root button.fc-cta-consent',
              '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
              'button[id*="cookie-accept" i]',
              'button[id*="accept-cookie" i]',
              'button[class*="cookie-accept" i]',
              'button[class*="accept-cookie" i]',
              'button[aria-label*="accept all" i]',
              'button[aria-label*="accept cookies" i]'
            ];
            for (const sel of acceptSelectors) {
              const btn = document.querySelector(sel);
              if (btn && typeof btn.click === 'function' && btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                btn.click();
                break;
              }
            }

            const overlaySelectors = [
              '#onetrust-consent-sdk',
              '#onetrust-banner-sdk',
              '.qc-cmp2-container',
              '#didomi-host'
            ];
            for (const sel of overlaySelectors) {
              const el = document.querySelector(sel);
              if (el && el.style.display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
              }
            }
          } catch(e) {}
        };

        // 3. Audio Auto-Unmute (Only for actively playing media)
        const unmute = () => {
          try {
            document.querySelectorAll('video, audio').forEach(el => {
              if (!el.paused && el.muted) el.muted = false;
              if (!el.paused && el.volume < 1) el.volume = 1;
            });

            const yt = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (yt) {
              if (typeof yt.isMuted === 'function' && yt.isMuted()) {
                if (typeof yt.unMute === 'function') yt.unMute();
                const ytMuteBtn = document.querySelector('button.ytp-mute-button');
                if (ytMuteBtn) ytMuteBtn.click();
              }
              if (typeof yt.setVolume === 'function') yt.setVolume(100);
            }

            const shortsUnmute = document.querySelector('button.ytdVolumeControlsMuteIconButton, ytd-shorts [aria-label*="unmute" i], .ytdVolumeControlsMuteIconButton');
            if (shortsUnmute) {
              const label = (shortsUnmute.getAttribute('aria-label') || '').toLowerCase();
              if (label.includes('unmute') || shortsUnmute.classList.contains('ytdVolumeControlsMuteIconButton')) {
                shortsUnmute.click();
              }
            }

            const v = document.querySelector('video');
            if (v && !v.paused) {
              const unmuteBtn = document.querySelector('.ytp-unmute, .ytp-unmute-inner, [aria-label*="unmute" i], [title*="unmute" i]');
              if (unmuteBtn) unmuteBtn.click();
            }
          } catch(e) {}
        };

        const runAll = () => {
          injectDarkScrollbars();
          dismissCookieBanners();
          unmute();
        };

        runAll();
        document.addEventListener('DOMContentLoaded', runAll, true);
        document.addEventListener('load', runAll, true);
        document.addEventListener('play', unmute, true);
        document.addEventListener('loadeddata', unmute, true);
        document.addEventListener('click', runAll, true);
        if (!window.__cinesync_enhancement_interval) {
          window.__cinesync_enhancement_interval = setInterval(runAll, 800);
        }
      })();
    `;
  }

  async injectAutoUnmute() {
    await this.sendCommand('Runtime.evaluate', { expression: this.getInjectedPageEnhancementsScript() }).catch(() => {});

    if (this.currentUrl && this.currentUrl.includes('/shorts/')) {
      try {
        const check = await this.sendCommand('Runtime.evaluate', {
          expression: `(() => {
            const btn = document.querySelector('button.ytdVolumeControlsMuteIconButton, ytd-shorts [aria-label*="unmute" i]');
            if (btn && (btn.getAttribute('aria-label') || '').toLowerCase().includes('unmute')) {
              return true;
            }
            return false;
          })()`,
          returnByValue: true
        });
        if (check && check.result && check.result.value === true) {
          await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 });
          await this.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 });
        }
      } catch(e) {}
    }
  }

  sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        return reject(new Error('CDP connection not open'));
      }
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  broadcastFrame(data, metadata) {
    this.io.to(this.roomId).emit('remote-browser-frame', {
      data,
      metadata: {
        timestamp: metadata.timestamp,
        offsetTop: metadata.offsetTop,
        pageScaleFactor: metadata.pageScaleFactor,
        deviceWidth: metadata.deviceWidth,
        deviceHeight: metadata.deviceHeight
      }
    });
  }

  async startScreencast(qualityOverride = null) {
    this.screencastActive = true;
    const q = qualityOverride || this.quality || 92;
    this.log(`Starting screencast: ${this.width}x${this.height} @ quality ${q}%`);
    return this.sendCommand('Page.startScreencast', {
      format: 'jpeg',
      quality: q,
      maxWidth: this.width,
      maxHeight: this.height,
      everyNthFrame: 1
    });
  }

  async setQuality(qualityMode = '1080p') {
    this.lastActive = Date.now();
    let targetWidth = 1920;
    let targetHeight = 1080;
    let targetQuality = 92;

    if (qualityMode === 'ultra' || qualityMode === '1080p-ultra') {
      targetWidth = 1920;
      targetHeight = 1080;
      targetQuality = 96;
    } else if (qualityMode === '1080p' || qualityMode === 'high') {
      targetWidth = 1920;
      targetHeight = 1080;
      targetQuality = 92;
    } else if (qualityMode === '720p' || qualityMode === 'low') {
      targetWidth = 1280;
      targetHeight = 720;
      targetQuality = 80;
    }

    this.width = targetWidth;
    this.height = targetHeight;
    this.quality = targetQuality;
    this.currentQualityMode = qualityMode;

    this.log(`Switching quality to ${qualityMode}: ${this.width}x${this.height} @ ${this.quality}%`);

    try {
      await this.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: this.width,
        height: this.height,
        deviceScaleFactor: 1,
        mobile: false
      });

      if (this.screencastActive) {
        await this.sendCommand('Page.stopScreencast').catch(() => {});
        await this.startScreencast();
      }

      this.notifyStatus(this.status, `Resolution set to ${this.width}x${this.height} (${this.quality}% crisp quality)`);
    } catch (e) {
      this.warn('Failed to switch screencast quality:', e.message);
    }
  }

  async stopScreencast() {
    this.screencastActive = false;
    if (this.trailingFrameTimer) {
      clearTimeout(this.trailingFrameTimer);
      this.trailingFrameTimer = null;
    }
    try {
      await this.sendCommand('Page.stopScreencast');
    } catch(e) {}
  }

  async navigate(url, options = {}) {
    let target = (url || '').trim();
    const isResizeOnly = !target && options.resize;

    if (!target && !isResizeOnly) return;

    if (target) {
      if (!target.includes('.') || target.includes(' ')) {
        target = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(target);
      } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target;
      }
    }

    if (options.isMobile !== undefined) {
      this.isMobile = !!options.isMobile;
    }
    if (options.width && options.height) {
      this.width = Math.round(options.width);
      this.height = Math.round(options.height);
      const mobileUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
      const desktopUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      const activeUA = this.isMobile ? mobileUA : desktopUA;
      await this.sendCommand('Network.setUserAgentOverride', { userAgent: activeUA }).catch(() => {});
      await this.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: this.width,
        height: this.height,
        deviceScaleFactor: this.isMobile ? 2 : 1,
        mobile: !!this.isMobile
      }).catch(() => {});
    }

    // Resize-only: viewport updated, no navigation needed
    if (isResizeOnly) {
      this.lastActive = Date.now();
      this.log(`Viewport resized to ${this.width}x${this.height}`);
      return;
    }

    this.currentUrl = target;
    this.lastActive = Date.now();
    this.log('Navigating to genuine website:', target);

    // Forcibly silence and pause any active audio/video on previous page immediately
    try {
      await this.sendCommand('Runtime.evaluate', {
        expression: `(() => {
          try {
            document.querySelectorAll('video, audio').forEach(el => {
              el.pause();
              el.muted = true;
              el.currentTime = 0;
            });
            const yt = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (yt && typeof yt.stopVideo === 'function') yt.stopVideo();
          } catch(e) {}
        })()`
      });
    } catch(e) {}

    return this.sendCommand('Page.navigate', { url: target });
  }

  async reload() {
    this.lastActive = Date.now();
    return this.sendCommand('Page.reload', { ignoreCache: true });
  }

  async goBack() {
    this.lastActive = Date.now();
    try {
      const history = await this.sendCommand('Page.getNavigationHistory');
      if (history.currentIndex > 0) {
        const entry = history.entries[history.currentIndex - 1];
        await this.sendCommand('Page.navigateToHistoryEntry', { entryId: entry.id });
      }
    } catch(e) {
      this.warn('goBack error:', e.message);
    }
  }

  async goForward() {
    this.lastActive = Date.now();
    try {
      const history = await this.sendCommand('Page.getNavigationHistory');
      if (history.currentIndex < history.entries.length - 1) {
        const entry = history.entries[history.currentIndex + 1];
        await this.sendCommand('Page.navigateToHistoryEntry', { entryId: entry.id });
      }
    } catch(e) {
      this.warn('goForward error:', e.message);
    }
  }

  // Interactive Mouse Dispatch
  async dispatchMouseEvent(event) {
    this.lastActive = Date.now();
    const { type, x, y, button = 'none', clickCount = 1, deltaX = 0, deltaY = 0 } = event;

    // Scale coordinates to browser resolution
    const scaledX = Math.round(Math.max(0, Math.min(this.width, x)));
    const scaledY = Math.round(Math.max(0, Math.min(this.height, y)));

    const params = {
      type, // 'mouseMoved', 'mousePressed', 'mouseReleased', 'mouseWheel'
      x: scaledX,
      y: scaledY,
      button, // 'left', 'middle', 'right', 'none'
      clickCount
    };

    if (type === 'mouseWheel') {
      params.deltaX = deltaX;
      params.deltaY = deltaY;
    }

    if (type === 'mousePressed') {
      this.injectAutoUnmute();
    }

    return this.sendCommand('Input.dispatchMouseEvent', params);
  }

  // Interactive Keyboard Dispatch
  async dispatchKeyEvent(event) {
    this.lastActive = Date.now();
    const {
      type,
      text,
      key,
      code,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode,
      modifiers,
      ctrlKey,
      metaKey,
      altKey,
      shiftKey
    } = event;

    // Calculate modifiers bitmask if not explicitly provided (Alt=1, Ctrl=2, Meta=4, Shift=8)
    let effectiveModifiers = modifiers;
    if (effectiveModifiers === undefined) {
      effectiveModifiers = 0;
      if (altKey) effectiveModifiers |= 1;
      if (ctrlKey) effectiveModifiers |= 2;
      if (metaKey) effectiveModifiers |= 4;
      if (shiftKey) effectiveModifiers |= 8;
    }

    // Determine text insertion:
    // In CDP, 'keyDown' with non-empty 'text' directly inserts the character into the active input.
    // We must NOT dispatch a secondary 'char' event, as that would insert the character a second time!
    let effectiveText = text;
    if (type === 'keyDown') {
      if (key === 'Enter') {
        effectiveText = '\r';
      } else if (!effectiveText && key && key.length === 1 && !ctrlKey && !metaKey) {
        effectiveText = key;
      }
    } else {
      effectiveText = undefined;
    }

    let vKeyCode = windowsVirtualKeyCode;
    if (!vKeyCode && key) {
      if (key === 'Enter') vKeyCode = 13;
      else if (key === 'Backspace') vKeyCode = 8;
      else if (key === 'Tab') vKeyCode = 9;
      else if (key === 'Escape') vKeyCode = 27;
      else if (key === 'Space' || key === ' ') vKeyCode = 32;
      else if (key >= '0' && key <= '9') vKeyCode = key.charCodeAt(0);
      else if (key.length === 1) vKeyCode = key.toUpperCase().charCodeAt(0);
    }

    const params = {
      type, // 'keyDown' or 'keyUp'
      key,
      code,
      windowsVirtualKeyCode: vKeyCode,
      nativeVirtualKeyCode,
      modifiers: effectiveModifiers
    };

    if (effectiveText) {
      params.text = effectiveText;
      params.unmodifiedText = effectiveText;
    }

    return this.sendCommand('Input.dispatchKeyEvent', params);
  }

  // Insert Text (Mobile Soft Keyboard & IME support via CDP Input.insertText)
  async insertText(text) {
    this.lastActive = Date.now();
    if (!text) return;
    try {
      await this.sendCommand('Input.insertText', { text });
    } catch (e) {
      this.warn('Failed to insertText:', e.message);
    }
  }

  ensureAudioSystemReady() {
    try {
      const { execSync } = require('child_process');

      // 1. Ensure cinesync_sink virtual null sink exists and is unmuted at 100%
      try {
        const sinks = execSync('pactl list sinks short', { timeout: 1500 }).toString();
        if (!sinks.includes('cinesync_sink')) {
          execSync('pactl load-module module-null-sink sink_name=cinesync_sink sink_properties=device.description=CineSync_Virtual_Sink', { timeout: 2000 });
        }
        execSync('pactl set-sink-mute cinesync_sink 0', { timeout: 1500 });
        execSync('pactl set-sink-volume cinesync_sink 100%', { timeout: 1500 });
      } catch(e) {}

      // 2. Ensure physical ALSA & default outputs are unmuted and 100%
      try { execSync('amixer -c 0 sset Master unmute 100%', { timeout: 1000 }); } catch(e) {}
      try { execSync('amixer -c 0 sset Speaker unmute 100%', { timeout: 1000 }); } catch(e) {}
      try { execSync('amixer -c 0 sset Headphone unmute 100%', { timeout: 1000 }); } catch(e) {}
      try { execSync('pactl set-sink-mute @DEFAULT_SINK@ 0', { timeout: 1500 }); } catch(e) {}
      try { execSync('pactl set-sink-volume @DEFAULT_SINK@ 100%', { timeout: 1500 }); } catch(e) {}

      // 3. Unmute any existing browser audio streams in PulseAudio & ensure routed to cinesync_sink
      try {
        const sinkInputs = execSync('pactl list sink-inputs', { timeout: 2000 }).toString();
        const ids = sinkInputs.match(/Sink Input #(\d+)/g) || [];
        for (const idStr of ids) {
          const id = idStr.replace('Sink Input #', '');
          try { execSync(`pactl set-sink-input-mute ${id} 0`, { timeout: 1000 }); } catch(e) {}
          try { execSync(`pactl set-sink-input-volume ${id} 100%`, { timeout: 1000 }); } catch(e) {}
        }
      } catch(e) {}
    } catch (e) {}
  }

  startAudioStream() {
    if (this.audioProc) return;
    this.ensureAudioSystemReady();

    // Capture specifically from isolated virtual sink monitor to prevent acoustic feedback loop with user mic/speakers
    let pulseSource = process.env.PULSE_SOURCE;
    if (!pulseSource) {
      try {
        const { execSync } = require('child_process');
        const sinks = execSync('pactl list sinks short', { timeout: 1500 }).toString();
        if (sinks.includes('cinesync_sink')) {
          pulseSource = 'cinesync_sink.monitor';
        } else {
          pulseSource = '@DEFAULT_SINK@.monitor';
        }
      } catch (e) {
        pulseSource = 'cinesync_sink.monitor';
      }
    }

    this.log(`Starting audio capture from ${pulseSource} for room...`);

    const ffmpegArgs = [
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-f', 'pulse',
      '-i', pulseSource,
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      '-bufsize', '32k',
      '-flush_packets', '1',
      '-write_xing', '0',
      '-id3v2_version', '0',
      '-f', 'mp3',
      'pipe:1'
    ];

    try {
      this.audioProc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });

      this.audioProc.stdout.on('data', (chunk) => {
        for (const res of this.audioClients) {
          try {
            res.write(chunk);
          } catch (e) {
            this.audioClients.delete(res);
          }
        }
      });

      this.audioProc.on('exit', (code) => {
        this.log(`Audio capture process exited with code ${code}`);
        this.audioProc = null;
        // Auto-restart audio capture if clients are still attached and browser is ready
        if (this.status === 'ready' && this.audioClients.size > 0) {
          this.log('Auto-restarting audio capture process...');
          setTimeout(() => {
            if (this.status === 'ready') this.startAudioStream();
          }, 1000);
        }
      });

      this.audioProc.on('error', (err) => {
        this.warn('Audio capture process error:', err.message);
        this.audioProc = null;
      });
    } catch (err) {
      this.warn('Failed to start audio capture:', err.message);
    }
  }

  attachAudioClient(req, res) {
    this.lastActive = Date.now();
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Accept-Ranges': 'none'
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    this.audioClients.add(res);

    if (!this.audioProc) {
      this.startAudioStream();
    }

    req.on('close', () => {
      this.audioClients.delete(res);
    });
  }

  notifyStatus(status, message) {
    this.io.to(this.roomId).emit('remote-browser-status', {
      status,
      message,
      url: this.currentUrl,
      title: this.currentTitle,
      width: this.width,
      height: this.height,
      quality: this.quality,
      qualityMode: this.currentQualityMode
    });
  }

  stop() {
    this.log('Stopping remote browser session...');
    this.status = 'closed';

    if (this.trailingFrameTimer) {
      clearTimeout(this.trailingFrameTimer);
      this.trailingFrameTimer = null;
    }

    if (this.audioProc) {
      try { this.audioProc.kill('SIGTERM'); } catch(e) {}
      this.audioProc = null;
    }
    for (const res of this.audioClients) {
      try { res.end(); } catch(e) {}
    }
    this.audioClients.clear();

    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }

    if (this.proc) {
      try {
        this.proc.kill('SIGTERM');
        setTimeout(() => {
          try { this.proc.kill('SIGKILL'); } catch(e) {}
        }, 1500);
      } catch(e) {}
      this.proc = null;
    }

    // Safely clean up user profile data
    setTimeout(() => {
      try {
        if (fs.existsSync(this.profileDir)) {
          fs.rmSync(this.profileDir, { recursive: true, force: true });
        }
      } catch(e) {}
    }, 2000);

    this.notifyStatus('closed', 'Session closed');
  }
}

/**
 * Remote Browser Manager (Pool of room browser sessions)
 */
class RemoteBrowserManager {
  constructor(io) {
    this.io = io;
    this.sessions = new Map(); // roomId -> RemoteBrowserSession
    this.maxSessions = parseInt(process.env.MAX_REMOTE_BROWSERS, 10) || 10;

    // Reaper interval to clean idle browser sessions (idle > 15 minutes)
    setInterval(() => this.reapIdleSessions(), 60000);
  }

  getOrCreateSession(roomId) {
    if (this.sessions.has(roomId)) {
      const session = this.sessions.get(roomId);
      if (session.status !== 'closed' && session.status !== 'error') {
        session.lastActive = Date.now();
        return session;
      }
    }

    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum concurrent remote browser limit (${this.maxSessions}) reached on this instance.`);
    }

    const session = new RemoteBrowserSession(roomId, this.io);
    this.sessions.set(roomId, session);
    return session;
  }

  getSession(roomId) {
    return this.sessions.get(roomId) || null;
  }

  attachAudio(roomId, req, res) {
    const session = this.getSession(roomId);
    if (session && session.status !== 'closed' && session.status !== 'error') {
      session.attachAudioClient(req, res);
    } else {
      res.status(404).json({ error: 'No active remote browser session for room ' + roomId });
    }
  }

  closeSession(roomId) {
    if (this.sessions.has(roomId)) {
      const session = this.sessions.get(roomId);
      session.stop();
      this.sessions.delete(roomId);
    }
  }

  reapIdleSessions() {
    const now = Date.now();
    const idleTimeout = 15 * 60 * 1000; // 15 minutes

    this.sessions.forEach((session, roomId) => {
      const room = this.io.sockets.adapter.rooms.get(roomId);
      const viewerCount = room ? room.size : 0;

      // Close if no viewers for 10 minutes or inactive for 15 minutes
      if (viewerCount === 0 && (now - session.lastActive > 600000)) {
        console.log(`[RemoteBrowserManager] Reaping orphaned session for empty room: ${roomId}`);
        session.stop();
        this.sessions.delete(roomId);
      } else if (now - session.lastActive > idleTimeout) {
        console.log(`[RemoteBrowserManager] Reaping idle session for room: ${roomId}`);
        session.stop();
        this.sessions.delete(roomId);
      }
    });
  }
}

module.exports = {
  RemoteBrowserSession,
  RemoteBrowserManager
};
