const express = require('express');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { Server } = require('socket.io');
const cors = require('cors');
const Unblocker = require('unblocker');
const { Transform } = require('stream');
const { RemoteBrowserManager } = require('./server/remoteBrowser');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const remoteBrowserManager = new RemoteBrowserManager(io);

const PORT = process.env.PORT || 3000;

// Strip framing restrictions (X-Frame-Options, CSP, COOP, COEP) from proxied sites
function stripFrameHeaders(data) {
  if (data.headers) {
    delete data.headers['x-frame-options'];
    delete data.headers['X-Frame-Options'];
    delete data.headers['frame-options'];
    delete data.headers['content-security-policy'];
    delete data.headers['content-security-policy-report-only'];
    delete data.headers['cross-origin-opener-policy'];
    delete data.headers['cross-origin-embedder-policy'];
    delete data.headers['cross-origin-resource-policy'];
    delete data.headers['content-length'];
    delete data.headers['Content-Length'];
  }
}

// Inject Frame-Busting Override & Transparent Proxy Interceptor into Proxied Live Websites
function cinesyncHudInjector(data) {
  const ct = data.headers && (data.headers['content-type'] || data.headers['Content-Type'] || data.contentType || '');
  if (ct.includes('text/html')) {
    if (data.headers) {
      delete data.headers['content-length'];
      delete data.headers['Content-Length'];
    }

    let remoteOrigin = '';
    try {
      if (data.url) {
        remoteOrigin = new URL(data.url).origin;
      }
    } catch(e) {}

    data.stream = data.stream.pipe(
      new Transform({
        decodeStrings: false,
        transform(chunk, encoding, next) {
          let updated = chunk.toString();
          if (updated.includes('<head') || updated.includes('<HEAD')) {
            const frameScript = `
              <script>
                (function() {
                  window.__cinesync_upstream = "${remoteOrigin}";
                  try {
                    Object.defineProperty(window, 'top', { get: function() { return window; } });
                    Object.defineProperty(window, 'parent', { get: function() { return window; } });
                    Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
                  } catch(e) {}

                  if (!window.__cinesync_upstream) {
                    try {
                      var m = window.location.pathname.match(/^\\/proxy\\/(https?:\\/\\/[^\\/]+)/);
                      if (m) window.__cinesync_upstream = m[1];
                    } catch(e) {}
                  }

                  function wrapProxyUrl(u) {
                    if (!u || typeof u !== 'string') return u;
                    u = u.trim();
                    if (!u || u.startsWith('#') || u.startsWith('javascript:') || u.startsWith('mailto:') || u.startsWith('data:') || u.startsWith('blob:')) return u;

                    // Strip any localhost:3000 origin
                    u = u.replace(/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?/i, '');

                    // If it already has /proxy/, extract the clean upstream target
                    var pIdx = u.lastIndexOf('/proxy/');
                    if (pIdx !== -1) {
                      var targetPart = u.slice(pIdx + 7);
                      var lastHttp = Math.max(targetPart.lastIndexOf('http://'), targetPart.lastIndexOf('https://'));
                      if (lastHttp !== -1) {
                        return '/proxy/' + targetPart.slice(lastHttp);
                      }
                      if (window.__cinesync_upstream && targetPart.startsWith('/')) {
                        return '/proxy/' + window.__cinesync_upstream + targetPart;
                      }
                      return '/proxy/' + targetPart;
                    }

                    if (u.startsWith('//')) {
                      return '/proxy/https:' + u;
                    }
                    if (u.startsWith('http://') || u.startsWith('https://')) {
                      return '/proxy/' + u;
                    }
                    if (u.startsWith('/') && window.__cinesync_upstream) {
                      return '/proxy/' + window.__cinesync_upstream + u;
                    }
                    return u;
                  }

                  // Transparent fetch proxy hook
                  var _origFetch = window.fetch;
                  if (_origFetch) {
                    window.fetch = function(res, init) {
                      try {
                        if (typeof res === 'string') {
                          res = wrapProxyUrl(res);
                        } else if (res && res.url) {
                          // Request object
                        }
                      } catch(err) {}
                      return _origFetch.call(this, res, init);
                    };
                  }

                  // Transparent XHR proxy hook
                  var _origOpen = XMLHttpRequest.prototype.open;
                  if (_origOpen) {
                    XMLHttpRequest.prototype.open = function(method, url) {
                      try {
                        if (typeof url === 'string') {
                          url = wrapProxyUrl(url);
                        }
                      } catch(err) {}
                      return _origOpen.apply(this, arguments);
                    };
                  }

                  // Intercept anchor clicks
                  document.addEventListener('click', function(e) {
                    var a = e.target.closest('a');
                    if (!a) return;
                    var rawHref = a.getAttribute('href');
                    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) return;
                    var wrapped = wrapProxyUrl(rawHref);
                    if (wrapped && wrapped !== rawHref) {
                      e.preventDefault();
                      window.location.href = wrapped;
                    }
                  }, true);

                  // Intercept form submissions
                  document.addEventListener('submit', function(e) {
                    var form = e.target;
                    if (form && form.action) {
                      var wrapped = wrapProxyUrl(form.action);
                      if (wrapped) form.action = wrapped;
                    }
                  }, true);

                  // PushState & ReplaceState proxy hook for SPAs
                  var _origPush = history.pushState;
                  history.pushState = function(state, title, url) {
                    if (url && typeof url === 'string') {
                      url = wrapProxyUrl(url);
                    }
                    return _origPush.call(this, state, title, url);
                  };
                  var _origReplace = history.replaceState;
                  history.replaceState = function(state, title, url) {
                    if (url && typeof url === 'string') {
                      url = wrapProxyUrl(url);
                    }
                    return _origReplace.call(this, state, title, url);
                  };
                })();
              </script>
            `;
            updated = updated.replace(/(<head[^>]*>)/i, '$1' + frameScript);
          }
          this.push(updated, 'utf8');
          next();
        }
      })
    );
  }
}

// Emulate genuine modern Chrome browser headers to prevent upstream bot blocking
function browserHeadersInjector(data) {
  if (data.headers) {
    data.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    data.headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    data.headers['accept-language'] = 'en-US,en;q=0.9';
    data.headers['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
    data.headers['sec-ch-ua-mobile'] = '?0';
    data.headers['sec-ch-ua-platform'] = '"Windows"';
    data.headers['upgrade-insecure-requests'] = '1';
  }
}

const unblocker = new Unblocker({
  prefix: '/proxy/',
  clientScripts: false,
  requestMiddleware: [browserHeadersInjector],
  responseMiddleware: [stripFrameHeaders, cinesyncHudInjector]
});

// Clean and normalize any nested or looped proxy URLs (e.g. /proxy/http://localhost:3000/proxy/...)
app.use((req, res, next) => {
  if (req.url && req.url.startsWith('/proxy/')) {
    const raw = req.url.slice('/proxy/'.length);
    const lastHttpIdx = Math.max(raw.lastIndexOf('http://'), raw.lastIndexOf('https://'));
    if (lastHttpIdx > 0) {
      const cleanTarget = raw.slice(lastHttpIdx);
      return res.redirect(307, '/proxy/' + cleanTarget);
    }
  }
  next();
});

app.use(unblocker);

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/proxy/')) {
    unblocker.onUpgrade(req, socket, head);
  }
});

app.use(cors());
app.use(express.json());

// Fallback router: Route root-relative sub-resources from proxied iframes (YouTube, Hotstar, Prime, etc.) to upstream
app.use((req, res, next) => {
  const isLocalApi = /^\/api\/(room|resolve-media|proxy-stream|hls-proxy|client-log|download-extension|proxy-web|mx|tmdb|stream|youtube|remote-browser|netmirror|anime)($|\/|\?)/.test(req.url);
  if (
    req.url.startsWith('/proxy/') ||
    req.url.startsWith('/socket.io/') ||
    isLocalApi ||
    req.url.startsWith('/room/') ||
    req.url.startsWith('/css/') ||
    req.url.startsWith('/js/') ||
    req.url.startsWith('/libs/') ||
    req.url === '/' ||
    req.url === '/favicon.ico'
  ) {
    return next();
  }

  const referer = req.headers['referer'] || req.headers['Referer'] || '';
  const proxyPrefix = '/proxy/';
  const proxyIdx = referer.indexOf(proxyPrefix);
  if (proxyIdx !== -1) {
    try {
      const remotePart = referer.slice(proxyIdx + proxyPrefix.length);
      const lastHttpIdx = Math.max(remotePart.lastIndexOf('http://'), remotePart.lastIndexOf('https://'));
      const effectiveRemote = lastHttpIdx !== -1 ? remotePart.slice(lastHttpIdx) : remotePart;
      const remoteUrl = new URL(effectiveRemote.startsWith('http') ? effectiveRemote : 'https://' + effectiveRemote);
      const targetUrl = `/proxy/${remoteUrl.origin}${req.url}`;
      return res.redirect(307, targetUrl);
    } catch (e) {
      return next();
    }
  }
  next();
});

// API Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.url.startsWith('/api/')) {
      console.log(`[${req.method}] ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve HLS.js dist files for reliable local access
app.use('/libs/hls', express.static(path.join(__dirname, 'node_modules/hls.js/dist')));

// In-memory room store
const rooms = new Map();

function getDefaultRoomBackdrop(roomId) {
  return '/video/summer-outfit-bg.mp4';
}

/**
 * Get or create room object
 */
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      createdAt: Date.now(),
      hostId: null,
      hostOnlyControls: false,
      backdrop: getDefaultRoomBackdrop(roomId),
      mediaSource: {
        type: 'empty', // 'empty' | 'url' | 'hls' | 'youtube' | 'local' | 'screenshare' | 'embed'
        url: '',
        title: '',
        poster: null,
        backdrop: null,
        currentTime: 0,
        isPlaying: false,
        playbackRate: 1.0,
        lastUpdated: Date.now()
      },
      screenShare: {
        active: false,
        sharerId: null,
        sharerName: null,
        title: null
      },
      playlist: [],
      users: new Map(),
      chatHistory: [],
      activePoll: null,
      activeTheme: 'default'
    });
  }
  return rooms.get(roomId);
}

/**
 * Calculate the estimated current playback time taking elapsed real time into account
 */
function getCalculatedCurrentTime(mediaSource) {
  if (!mediaSource.isPlaying) {
    return mediaSource.currentTime;
  }
  const elapsedSec = (Date.now() - mediaSource.lastUpdated) / 1000;
  return mediaSource.currentTime + (elapsedSec * (mediaSource.playbackRate || 1.0));
}

// REST endpoints
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId);
    res.json({
      exists: true,
      id: room.id,
      userCount: room.users.size,
      backdrop: room.backdrop,
      mediaTitle: room.mediaSource.title || null,
      isPlaying: room.mediaSource.isPlaying
    });
  } else {
    res.json({ exists: false });
  }
});

// Universal Media Resolver using yt-dlp & direct stream detection
app.post('/api/resolve-media', (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid URL provided' });
  }

  const cleanUrl = url.trim();

  // Fast direct stream detection
  if (cleanUrl.match(/\.(mp4|webm|mkv|mov)($|\?)/i)) {
    return res.json({
      success: true,
      type: 'url',
      streamUrl: cleanUrl,
      title: cleanUrl.split('/').pop().split('?')[0] || 'Direct Video'
    });
  }
  if (cleanUrl.match(/\.m3u8($|\?)/i)) {
    return res.json({
      success: true,
      type: 'hls',
      streamUrl: cleanUrl,
      title: 'HLS Live Stream'
    });
  }

  // Check for known DRM platforms to provide instant guidance
  const isHotstar = cleanUrl.includes('hotstar.com');
  const isMxPlayer = cleanUrl.includes('mxplayer.in');

  // Attempt stream extraction with yt-dlp
  const args = [
    '--dump-single-json',
    '--no-playlist',
    '--no-warnings',
    '--format', 'best[ext=mp4]/best',
    cleanUrl
  ];

  execFile('yt-dlp', args, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      const errText = (stderr || error.message || '').toLowerCase();
      if (errText.includes('drm') || isHotstar || isMxPlayer) {
        return res.json({
          success: false,
          isDrm: true,
          platform: isHotstar ? 'Disney+ Hotstar' : isMxPlayer ? 'MX Player' : 'DRM Stream',
          message: 'DRM-protected video detected. Use the ZAMI Chrome Extension to watch together directly on the official site in 100% full HD, or use Screen Share mode!'
        });
      }
      return res.json({
        success: false,
        message: 'Could not extract direct stream automatically. You can paste a direct video link or use Screen Share.'
      });
    }

    try {
      const data = JSON.parse(stdout);
      const streamUrl = data.url || (data.formats && data.formats.length > 0 ? data.formats[data.formats.length - 1].url : null);
      const isHls = (streamUrl && streamUrl.includes('.m3u8')) || data.protocol === 'm3u8_native';

      if (!streamUrl) {
        return res.json({
          success: false,
          isDrm: isHotstar || isMxPlayer,
          message: 'No direct video stream found for this URL.'
        });
      }

      return res.json({
        success: true,
        type: isHls ? 'hls' : 'url',
        streamUrl: streamUrl,
        title: data.title || 'Extracted Movie',
        thumbnail: data.thumbnail || null,
        duration: data.duration || 0
      });
    } catch (e) {
      return res.json({
        success: false,
        message: 'Failed to parse stream metadata.'
      });
    }
  });
});

// Remote browser session status endpoint
app.get('/api/remote-browser/status/:roomId', (req, res) => {
  const { roomId } = req.params;
  const session = remoteBrowserManager.getSession(roomId);
  if (session && session.status !== 'closed' && session.status !== 'error') {
    res.json({
      active: true,
      status: session.status,
      url: session.currentUrl || null,
      title: session.currentTitle || null
    });
  } else {
    res.json({
      active: false,
      status: 'idle'
    });
  }
});

// Stream remote browser audio (PulseAudio monitor -> MP3)
app.get('/api/remote-browser/audio/:roomId', (req, res) => {
  const { roomId } = req.params;
  remoteBrowserManager.attachAudio(roomId, req, res);
});

// Built-in CORS Proxy for external media streams
app.get('/api/proxy-stream', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'application/octet-stream');

    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// In-memory cache for recent segments & manifests to make playback lighting fast
const hlsSegmentCache = new Map();

// Background prefetch for upcoming segments to ensure zero buffering
function prefetchUpcomingSegments(currentSegmentUrl) {
  const match = currentSegmentUrl.match(/(.*\/page-)(\d+)(\.html.*)/);
  if (!match) return;
  const prefix = match[1];
  const currentNum = parseInt(match[2], 10);
  const suffix = match[3];

  for (let offset = 1; offset <= 3; offset++) {
    const nextUrl = `${prefix}${currentNum + offset}${suffix}`;
    if (hlsSegmentCache.has(nextUrl)) continue;

    fetch(nextUrl, {
      headers: {
        'Origin': 'https://nextgencloudfabric.com',
        'Referer': 'https://nextgencloudfabric.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(8000)
    }).then(async (res) => {
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());
      const outType = buffer[0] === 0x47 ? 'video/mp2t' : 'application/octet-stream';
      if (hlsSegmentCache.size > 300) {
        const oldestKey = hlsSegmentCache.keys().next().value;
        hlsSegmentCache.delete(oldestKey);
      }
      hlsSegmentCache.set(nextUrl, {
        timestamp: Date.now(),
        contentType: outType,
        buffer: buffer,
        isPlaylist: false
      });
    }).catch(() => {});
  }
}

/**
 * Universal HLS Stream Proxy & Rewriter
 * Bypasses Cloudflare Origin restrictions by fetching upstream with whitelisted headers
 * and rewriting all manifest lines to route through this endpoint.
 */
app.get('/api/hls-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  const customReferer = req.query.referer || null;
  const cacheKey = customReferer ? `${targetUrl}__${customReferer}` : targetUrl;

  const cached = hlsSegmentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Content-Type', cached.contentType);
    if (!cached.isPlaylist) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      prefetchUpcomingSegments(targetUrl);
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
    return res.send(cached.buffer);
  }

  try {
    const upstreamReferer = customReferer || 'https://nextgencloudfabric.com/';
    let upstreamOrigin = 'https://nextgencloudfabric.com';
    try {
      upstreamOrigin = new URL(upstreamReferer).origin;
    } catch (e) {}

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'Origin': upstreamOrigin,
        'Referer': upstreamReferer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Upstream error: ${upstreamRes.statusText}`);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isPlaylist = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (isPlaylist) {
      const text = await upstreamRes.text();
      const baseUrl = new URL(targetUrl);
      const refParam = customReferer ? `&referer=${encodeURIComponent(customReferer)}` : '';

      // Rewrite manifest entries to route through /api/hls-proxy
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Handle URI attribute in tags like #EXT-X-KEY or #EXT-X-MAP or subtitles
        if (trimmed.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (match, uri) => {
            try {
              const abs = new URL(uri, baseUrl).href;
              return `URI="/api/hls-proxy?url=${encodeURIComponent(abs)}${refParam}"`;
            } catch {
              return match;
            }
          });
        }

        // Relative or absolute stream or chunk URL
        try {
          const absUrl = new URL(trimmed, baseUrl).href;
          return `/api/hls-proxy?url=${encodeURIComponent(absUrl)}${refParam}`;
        } catch {
          return line;
        }
      }).join('\n');

      const playlistBuffer = Buffer.from(rewritten, 'utf8');
      if (hlsSegmentCache.size > 300) {
        const oldestKey = hlsSegmentCache.keys().next().value;
        hlsSegmentCache.delete(oldestKey);
      }
      hlsSegmentCache.set(cacheKey, {
        timestamp: Date.now(),
        contentType: 'application/vnd.apple.mpegurl; charset=utf-8',
        buffer: playlistBuffer,
        isPlaylist: true
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(playlistBuffer);
    } else {
      // Binary video segment chunk (MPEG-TS or fMP4)
      const buffer = Buffer.from(await upstreamRes.arrayBuffer());
      const outType = buffer[0] === 0x47 ? 'video/mp2t' : (contentType || 'application/octet-stream');

      res.setHeader('Content-Type', outType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (hlsSegmentCache.size > 300) {
        const oldestKey = hlsSegmentCache.keys().next().value;
        hlsSegmentCache.delete(oldestKey);
      }
      hlsSegmentCache.set(cacheKey, {
        timestamp: Date.now(),
        contentType: outType,
        buffer: buffer,
        isPlaylist: false
      });

      // Background prefetch upcoming segments
      prefetchUpcomingSegments(targetUrl);

      return res.send(buffer);
    }
  } catch (err) {
    console.error('HLS Proxy error:', err.message);
    res.status(502).send('Proxy error: ' + err.message);
  }
});

// Client Diagnostic Log Collector
app.post('/api/client-log', (req, res) => {
  const { type, message, data } = req.body || {};
  console.log(`[CLIENT ${type || 'INFO'}]: ${message}`, data ? JSON.stringify(data) : '');
  res.sendStatus(200);
});

// Download Chrome Extension package
app.get('/api/download-extension', (req, res) => {
  const zipPath = path.join(__dirname, 'public', 'downloads', 'cinesync-extension.zip');
  res.download(zipPath, 'cinesync-extension.zip');
});

// Inbuilt Virtual Webview / Proxy for Web Video & Sites (Rave Mode)
app.get('/app/youtube', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'youtube-app.html'));
});

app.get(['/app/source', '/app/prime', '/app/netflix', '/app/hotstar', '/app/mx', '/app/twitch', '/app/crunchyroll', '/app/movies', '/app/url', '/app/local'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'source-app.html'));
});

// ============================================================================
// OPEN SOURCE NETMIRROR STREAM RESOLUTION (Netflix, Prime Video, Hotstar)
// ============================================================================
const NETMIRROR_DOMAINS = [
  'aHR0cHM6Ly9tb2JpbGVkZXRlY3RzLmNvbQ==',
  'aHR0cHM6Ly9tb2JpbGVkZXRlY3QuYXBw',
  'aHR0cHM6Ly9tb2JpZGV0ZWN0LmFydA==',
  'aHR0cHM6Ly9tb2JpZGV0ZWN0LmNj',
  'aHR0cHM6Ly9tb2JpZGV0ZWN0LmNsaWNr',
  'aHR0cHM6Ly9tb2JpZGV0ZWN0LmxpdmU='
];

let cachedNetMirrorBase = null;
let netMirrorBaseExpiry = 0;

async function resolveNetMirrorBase() {
  if (cachedNetMirrorBase && Date.now() < netMirrorBaseExpiry) {
    return cachedNetMirrorBase;
  }
  for (const enc of NETMIRROR_DOMAINS) {
    try {
      const base = Buffer.from(enc, 'base64').toString('utf8').replace(/\/$/, '');
      const resp = await fetch(`${base}/checknewtv.php`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.token_hash) {
          cachedNetMirrorBase = Buffer.from(data.token_hash, 'base64').toString('utf8').replace(/\/$/, '');
          netMirrorBaseExpiry = Date.now() + 60 * 60 * 1000;
          console.log(`[NETMIRROR] Resolved active base URL: ${cachedNetMirrorBase}`);
          return cachedNetMirrorBase;
        }
      }
    } catch (e) {}
  }
  cachedNetMirrorBase = 'https://tv.imgcdn.kim';
  netMirrorBaseExpiry = Date.now() + 30 * 60 * 1000;
  return cachedNetMirrorBase;
}

const NETMIRROR_PLATFORMS = {
  netflix: { ott: 'nf', name: 'Netflix', posterBase: 'https://imgcdn.kim/poster/341/' },
  prime: { ott: 'pv', name: 'Prime Video', posterBase: 'https://imgcdn.kim/pv/341/' },
  hotstar: { ott: 'hs', name: 'JioHotstar', posterBase: 'https://imgcdn.kim/hs/v/166/' }
};

function getNetMirrorHeaders(ott = 'nf', extra = {}) {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Requested-With': 'NetmirrorNewTV v1.0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0',
    'Accept': 'application/json, text/plain, */*',
    'Ott': ott,
    ...extra
  };
}

// 1. Search endpoint
app.get('/api/netmirror/search', async (req, res) => {
  const platformKey = (req.query.platform || 'netflix').toLowerCase();
  const query = (req.query.q || '').trim();
  const platform = NETMIRROR_PLATFORMS[platformKey] || NETMIRROR_PLATFORMS.netflix;

  if (!query) {
    return res.json({ success: true, count: 0, results: [] });
  }

  try {
    const base = await resolveNetMirrorBase();
    const searchUrl = `${base}/newtv/search.php?s=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: getNetMirrorHeaders(platform.ott),
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ success: false, message: 'Upstream search error' });
    }

    const data = await resp.json();
    const rawResults = data.searchResult || [];
    const results = rawResults.map(item => ({
      id: item.id,
      title: item.t,
      platform: platformKey,
      ott: platform.ott,
      poster: `${platform.posterBase}${item.id}.jpg`
    }));

    return res.json({ success: true, count: results.length, results });
  } catch (err) {
    console.error('[NETMIRROR SEARCH ERROR]:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Details endpoint (episodes, seasons, descriptions)
app.get('/api/netmirror/details', async (req, res) => {
  const platformKey = (req.query.platform || 'netflix').toLowerCase();
  const contentId = (req.query.id || '').trim();
  const platform = NETMIRROR_PLATFORMS[platformKey] || NETMIRROR_PLATFORMS.netflix;

  if (!contentId) {
    return res.status(400).json({ success: false, message: 'id is required' });
  }

  try {
    const base = await resolveNetMirrorBase();
    const postUrl = `${base}/newtv/post.php?id=${encodeURIComponent(contentId)}`;
    const resp = await fetch(postUrl, {
      headers: getNetMirrorHeaders(platform.ott, { Lastep: '', Usertoken: '' }),
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ success: false, message: 'Upstream details error' });
    }

    const data = await resp.json();
    const isSeries = data.type === 't' || (Array.isArray(data.episodes) && data.episodes.length > 0 && data.episodes[0] !== null);

    const episodes = [];
    if (Array.isArray(data.episodes)) {
      data.episodes.filter(Boolean).forEach(ep => {
        episodes.push({
          id: ep.id,
          title: ep.t || `Episode ${ep.ep || ''}`,
          ep: ep.ep || '1',
          desc: ep.ep_desc || '',
          info: ep.info || []
        });
      });
    }

    return res.json({
      success: true,
      data: {
        id: contentId,
        title: data.title || data.title_name || 'Title',
        year: data.year || '',
        desc: data.desc || '',
        type: isSeries ? 'tv' : 'movie',
        seasons: data.season || [],
        episodes: episodes,
        poster: `${platform.posterBase}${contentId}.jpg`,
        mainId: data.main_id || contentId,
        platform: platformKey
      }
    });
  } catch (err) {
    console.error('[NETMIRROR DETAILS ERROR]:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Resolve endpoint (direct .m3u8 stream)
app.get('/api/netmirror/resolve', async (req, res) => {
  const platformKey = (req.query.platform || 'netflix').toLowerCase();
  const targetId = (req.query.id || '').trim();
  const platform = NETMIRROR_PLATFORMS[platformKey] || NETMIRROR_PLATFORMS.netflix;

  if (!targetId) {
    return res.status(400).json({ success: false, message: 'id is required' });
  }

  // If targetId is a numeric TMDB ID, route through rock-solid VAPlayer HLS engine
  if (/^\d{3,8}$/.test(targetId)) {
    try {
      const vapQuery = `?tmdb=${encodeURIComponent(targetId)}&type=tv&season=1&episode=1`;
      const upstream = await fetch(`https://streamdata.vaplayer.ru/api.php${vapQuery}`, {
        headers: {
          'Origin': 'https://nextgencloudfabric.com',
          'Referer': 'https://nextgencloudfabric.com/',
          'User-Agent': 'Mozilla/5.0'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (upstream.ok) {
        const vData = await upstream.json();
        if (vData?.data?.stream_urls?.length) {
          const proxied = `/api/hls-proxy?url=${encodeURIComponent(vData.data.stream_urls[0])}`;
          return res.json({
            success: true,
            type: 'hls',
            streamUrl: proxied,
            rawUrl: vData.data.stream_urls[0],
            title: vData.data.title || 'Live Stream'
          });
        }
      }
    } catch (vapErr) {
      console.warn('VAPlayer fallback resolution notice:', vapErr.message);
    }
  }

  try {
    const base = await resolveNetMirrorBase();
    const playerUrl = `${base}/newtv/player.php?id=${encodeURIComponent(targetId)}`;
    const resp = await fetch(playerUrl, {
      headers: getNetMirrorHeaders(platform.ott, { Usertoken: '' }),
      signal: AbortSignal.timeout(8000)
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.video_link) {
        const referer = data.referer || 'https://net52.cc';
        const proxiedStream = `/api/hls-proxy?url=${encodeURIComponent(data.video_link)}&referer=${encodeURIComponent(referer)}`;

        return res.json({
          success: true,
          type: 'hls',
          streamUrl: proxiedStream,
          rawUrl: data.video_link,
          referer: referer,
          title: data.title || '',
          ep: data.ep || '',
          epTitle: data.ep_title || ''
        });
      }
    }
  } catch (err) {
    console.error('[NETMIRROR RESOLVE ERROR]:', err.message);
  }

  return res.json({
    success: false,
    message: 'NetMirror upstream is currently rate-limited by provider. Use native TMDB resolver instead.'
  });
});

app.get('/api/proxy-web', (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL required');
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  return res.redirect(`/proxy/${targetUrl}`);
});

// MX Player Live Search Endpoint (searches free movies and web series)
app.get('/api/mx/search', async (req, res) => {
  const query = (req.query.q || 'movie').trim();
  try {
    const upstream = await fetch(
      `https://api.mxplayer.in/v1/web/search/result?query=${encodeURIComponent(query)}&platform=com.mxplay.desktop`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    const data = await upstream.json();
    const results = [];

    (data.sections || []).forEach(sec => {
      (sec.items || []).forEach(item => {
        if (item.webUrl && (item.type === 'movie' || item.type === 'tvshow' || item.type === 'episode')) {
          results.push({
            id: item.id,
            title: item.title,
            type: item.type,
            webUrl: item.webUrl,
            fullUrl: `https://www.mxplayer.in${item.webUrl}`,
            image: item.imageInfo && item.imageInfo[0] ? `https://qqcdnpictest.mxplay.com/${item.imageInfo[0].url}` : null,
            duration: item.duration || 0
          });
        }
      });
    });

    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'MX search failed: ' + err.message });
  }
});

// MX Player Stream Resolver
app.post('/api/mx/resolve', (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

  execFile('/bin/yt-dlp', ['-g', '--no-warnings', url], { timeout: 20000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('MX resolve error:', error.message, 'stderr:', stderr);
      return res.json({
        success: false,
        message: 'Could not extract stream from MX Player. You can share your browser tab via Screen Share.'
      });
    }

    const lines = stdout.trim().split('\n').filter(Boolean);
    const hlsUrl = lines.find(l => l.includes('.m3u8')) || lines[0];

    if (!hlsUrl) {
      return res.json({ success: false, message: 'No playable stream found.' });
    }

    res.json({
      success: true,
      type: 'hls',
      streamUrl: hlsUrl,
      title: title || 'MX Player Video'
    });
  });
});

// --------------------------------------------------------------------------
// TMDB Discovery & Universal Streaming Endpoints
// --------------------------------------------------------------------------
const TMDB_API_KEY = process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const TMDB_HOSTS = ['https://api.tmdb.org/3', 'https://api.themoviedb.org/3'];
const tmdbCache = new Map();

async function fetchFromTmdb(endpoint, params = {}) {
  const query = new URLSearchParams({ api_key: TMDB_API_KEY, ...params }).toString();
  let lastErr = null;
  for (const host of TMDB_HOSTS) {
    try {
      const response = await fetch(`${host}${endpoint}?${query}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`TMDB request failed for ${endpoint}`);
}

function formatTmdbItem(item, defaultType = 'movie') {
  const mediaType = item.media_type || defaultType;
  const isMovie = mediaType === 'movie';
  const title = isMovie ? (item.title || item.original_title) : (item.name || item.original_name);
  const releaseDate = isMovie ? item.release_date : item.first_air_date;
  const year = releaseDate ? releaseDate.slice(0, 4) : '';

  return {
    id: item.id,
    title: title || 'Untitled',
    mediaType: mediaType,
    year: year,
    rating: item.vote_average ? item.vote_average.toFixed(1) : null,
    votes: item.vote_count || 0,
    overview: item.overview || '',
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null
  };
}

// Curated Discovery Rows & Hero Spotlight
app.get('/api/tmdb/curated', async (req, res) => {
  const cacheKey = 'tmdb_curated_v1';
  const cached = tmdbCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return res.json(cached.data);
  }

  try {
    const [trendingMoviesData, trendingTvData, nowPlayingData, topRatedData] = await Promise.all([
      fetchFromTmdb('/trending/movie/week'),
      fetchFromTmdb('/trending/tv/week'),
      fetchFromTmdb('/movie/now_playing'),
      fetchFromTmdb('/movie/top_rated')
    ]);

    const trendingMovies = (trendingMoviesData.results || []).map(i => formatTmdbItem(i, 'movie'));
    const trendingTv = (trendingTvData.results || []).map(i => formatTmdbItem(i, 'tv'));
    const inTheaters = (nowPlayingData.results || []).map(i => formatTmdbItem(i, 'movie'));
    const topRated = (topRatedData.results || []).map(i => formatTmdbItem(i, 'movie'));

    // Select featured spotlight movie (with high quality backdrop and poster)
    const spotlightCandidates = trendingMovies.filter(m => m.backdrop && m.overview && m.overview.length > 50);
    const spotlight = spotlightCandidates[0] || trendingMovies[0] || null;

    const payload = {
      success: true,
      spotlight,
      rows: [
        { id: 'trending-movies', title: 'Trending Cinema // Worldwide', items: trendingMovies },
        { id: 'in-theaters', title: 'In Theatres Now', items: inTheaters },
        { id: 'trending-tv', title: 'Popular Series & Serials', items: trendingTv },
        { id: 'top-rated', title: 'Top Rated of All Time', items: topRated }
      ]
    };

    tmdbCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    res.json(payload);
  } catch (err) {
    console.error('TMDB Curated fetch failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not fetch catalog: ' + err.message });
  }
});

// TMDB Multi Search (Movies and TV)
app.get('/api/tmdb/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ success: true, results: [] });

  try {
    const data = await fetchFromTmdb('/search/multi', { query });
    const results = (data.results || [])
      .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
      .map(item => formatTmdbItem(item));

    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// TMDB Movie/Series Full Details (Cast, Runtime, Trailer)
app.get('/api/tmdb/details', async (req, res) => {
  const { id, type = 'movie' } = req.query;
  if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

  const endpoint = type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
  try {
    const data = await fetchFromTmdb(endpoint, { append_to_response: 'videos,credits' });

    // Extract official trailer
    const videos = data.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') ||
                    videos.find(v => v.site === 'YouTube') || null;

    // Top cast & director
    const cast = (data.credits?.cast || []).slice(0, 6).map(c => ({
      name: c.name,
      character: c.character,
      profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
    }));
    const director = (data.credits?.crew || []).find(c => c.job === 'Director')?.name || null;

    const details = {
      id: data.id,
      title: type === 'tv' ? (data.name || data.original_name) : (data.title || data.original_title),
      mediaType: type,
      tagline: data.tagline || '',
      overview: data.overview || '',
      rating: data.vote_average ? data.vote_average.toFixed(1) : null,
      runtime: data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : null,
      genres: (data.genres || []).map(g => g.name),
      releaseYear: (data.release_date || data.first_air_date || '').slice(0, 4),
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
      director,
      cast,
      trailerYoutubeKey: trailer ? trailer.key : null,
      numberOfSeasons: type === 'tv' ? (data.number_of_seasons || 1) : null,
      seasons: type === 'tv' ? (data.seasons || []).filter(s => s.season_number > 0) : null
    };

    res.json({ success: true, details });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// TMDB TV Show Season Episodes
app.get('/api/tmdb/season', async (req, res) => {
  const { id, season = 1 } = req.query;
  if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

  try {
    const data = await fetchFromTmdb(`/tv/${id}/season/${season}`);
    const episodes = (data.episodes || []).map(ep => ({
      episodeNumber: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      airDate: ep.air_date,
      still: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null
    }));

    res.json({ success: true, seasonNumber: data.season_number, episodes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// In-memory stream resolution cache (1 hour TTL)
const streamResolutionCache = new Map();

/**
 * Universal Stream Resolver (Option 1: Direct Native HLS without iframes)
 * Scrapes direct .m3u8 adaptive bitrate master playlists using TMDB or IMDb IDs.
 */
app.get('/api/stream/resolve', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;
  if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

  const isTv = type === 'tv';
  const s = parseInt(season, 10) || 1;
  const e = parseInt(episode, 10) || 1;
  const cacheKey = `${type}_${id}_s${s}_e${e}`;

  const cached = streamResolutionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return res.json(cached.data);
  }

  try {
    // 1. Direct query using TMDB ID
    const tmdbQuery = isTv
      ? `?tmdb=${encodeURIComponent(id)}&type=tv&season=${s}&episode=${e}`
      : `?tmdb=${encodeURIComponent(id)}&type=movie`;

    let data = null;
    try {
      const upstream = await fetch(`https://streamdata.vaplayer.ru/api.php${tmdbQuery}`, {
        headers: {
          'Origin': 'https://nextgencloudfabric.com',
          'Referer': 'https://nextgencloudfabric.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(9000)
      });
      if (upstream.ok) {
        data = await upstream.json();
      }
    } catch (fetchErr) {
      console.warn('VaPlayer TMDB query failed:', fetchErr.message);
    }

    // 2. If no stream_urls found, attempt lookup via IMDb ID
    if (!data?.data?.stream_urls || data.data.stream_urls.length === 0) {
      try {
        let imdbId = null;
        if (typeof id === 'string' && id.startsWith('tt')) {
          imdbId = id;
        } else {
          const extData = await fetchFromTmdb(isTv ? `/tv/${id}/external_ids` : `/movie/${id}`);
          imdbId = extData?.imdb_id;
        }

        if (imdbId) {
          const imdbQuery = isTv
            ? `?imdb=${encodeURIComponent(imdbId)}&type=tv&season=${s}&episode=${e}`
            : `?imdb=${encodeURIComponent(imdbId)}&type=movie`;

          const upstreamImdb = await fetch(`https://streamdata.vaplayer.ru/api.php${imdbQuery}`, {
            headers: {
              'Origin': 'https://nextgencloudfabric.com',
              'Referer': 'https://nextgencloudfabric.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(9000)
          });
          if (upstreamImdb.ok) {
            data = await upstreamImdb.json();
          }
        }
      } catch (imdbErr) {
        console.warn('VaPlayer IMDb query failed:', imdbErr.message);
      }
    }

    if (data?.data?.stream_urls && data.data.stream_urls.length > 0) {
      const streamUrls = data.data.stream_urls;
      const proxiedStreamUrl = `/api/hls-proxy?url=${encodeURIComponent(streamUrls[0])}`;
      const proxiedStreams = streamUrls.map(s => `/api/hls-proxy?url=${encodeURIComponent(s)}`);
      const payload = {
        success: true,
        streamType: 'hls',
        streamUrl: proxiedStreamUrl,
        streams: proxiedStreams,
        rawStreams: streamUrls,
        title: data.data.title || null,
        fileName: data.data.file_name || null,
        subtitles: data.data.default_subs || [],
        thumbnails: data.data.thumbnails_url || null
      };
      streamResolutionCache.set(cacheKey, { timestamp: Date.now(), data: payload });
      return res.json(payload);
    }

    // If direct stream is not yet indexed, respond with graceful fallback
    return res.json({
      success: false,
      message: 'Direct HLS stream not indexed for this selection. Fallback embed server available.',
      fallbackUrl: isTv
        ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
        : `https://vidsrc.sh/embed/movie?tmdb=${id}`
    });
  } catch (err) {
    console.error('Stream resolve error:', err.message);
    return res.status(500).json({ success: false, message: 'Resolution error: ' + err.message });
  }
});

// Universal Multi-Server Embed Stream Generator
app.get('/api/stream/servers', (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;
  if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

  const isTv = type === 'tv';
  const s = parseInt(season, 10) || 1;
  const e = parseInt(episode, 10) || 1;

  const servers = [
    {
      id: 'cinesync-native',
      name: 'Server 1 · CineSync Native HLS (Zero Pop-ups · 1080p Pure)',
      isNative: true,
      url: `/api/stream/resolve?id=${id}&type=${type}&season=${s}&episode=${e}`
    },
    {
      id: 'vidsrc-sh',
      name: 'Server 2 · VidSrc HD (Direct Embed)',
      isNative: false,
      url: isTv ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.sh/embed/movie?tmdb=${id}`
    },
    {
      id: 'autoembed',
      name: 'Server 3 · AutoEmbed Global',
      isNative: false,
      url: isTv ? `https://autoembed.co/tv/tmdb/${id}/${s}/${e}` : `https://autoembed.co/movie/tmdb/${id}`
    },
    {
      id: '2embed',
      name: 'Server 4 · 2Embed Cinema',
      isNative: false,
      url: isTv ? `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${id}`
    },
    {
      id: 'vidsrc-pm',
      name: 'Server 5 · VidSrc Prime',
      isNative: false,
      url: isTv ? `https://vidsrc.pm/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.pm/embed/movie?tmdb=${id}`
    }
  ];

  res.json({
    success: true,
    servers,
    activeUrl: servers[0].url
  });
});

// Official Free YouTube Info via oEmbed API (Zero scraping, zero API key)
app.get('/api/youtube/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'Missing url parameter' });

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      return res.json({ success: true, title: 'YouTube Video', author: 'YouTube', poster: null });
    }
    const data = await response.json();
    res.json({
      success: true,
      title: data.title || 'YouTube Video',
      author: data.author_name || 'YouTube',
      poster: data.thumbnail_url || null
    });
  } catch (e) {
    res.json({ success: true, title: 'YouTube Video', author: 'YouTube', poster: null });
  }
});

// Real-Time YouTube Search & Discovery API (Free, zero API key, cached)
const ytSearchCache = new Map();

// Helper to extract videos and shorts from YouTube search payload
function parseYtData(data) {
  const sectionContents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const results = [];
  const shorts = [];

  for (const section of sectionContents) {
    const items = section.itemSectionRenderer?.contents || [];
    for (const item of items) {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        const videoId = v.videoId;
        if (!videoId) continue;

        const title = v.title?.runs?.map(r => r.text).join('') || v.title?.simpleText || 'YouTube Video';
        const channel = v.ownerText?.runs?.map(r => r.text).join('') || '';
        const avatar = v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
        const thumbs = v.thumbnail?.thumbnails || [];
        const thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const duration = v.lengthText?.simpleText || '';
        const views = v.viewCountText?.simpleText || '';
        const publishedTime = v.publishedTimeText?.simpleText || '';
        const isVerified = !!(v.ownerBadges && v.ownerBadges.some(b => (b.metadataBadgeRenderer?.style || '').includes('VERIFIED')));

        results.push({
          id: videoId,
          title,
          channel,
          avatar,
          thumbnail,
          duration,
          views,
          publishedTime,
          isVerified,
          fullUrl: `https://www.youtube.com/watch?v=${videoId}`
        });
      }

      // Extract Shorts from gridShelfViewModel or reelShelfRenderer
      if (item.gridShelfViewModel?.contents) {
        for (const s of item.gridShelfViewModel.contents) {
          const shortVm = s.shortsLockupViewModel;
          if (!shortVm) continue;
          const shortId = shortVm.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
                          shortVm.entityId?.replace('shorts-shelf-item-', '');
          if (!shortId) continue;
          const shortTitle = shortVm.overlayMetadata?.primaryText?.content || 'Short';
          const shortViews = shortVm.overlayMetadata?.secondaryText?.content || '';
          const shortThumb = shortVm.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${shortId}/frame0.jpg`;
          shorts.push({
            id: shortId,
            title: shortTitle,
            views: shortViews,
            thumbnail: shortThumb,
            fullUrl: `https://www.youtube.com/shorts/${shortId}`
          });
        }
      } else if (item.reelShelfRenderer?.items) {
        for (const s of item.reelShelfRenderer.items) {
          const reelItem = s.reelItemRenderer;
          if (!reelItem || !reelItem.videoId) continue;
          shorts.push({
            id: reelItem.videoId,
            title: reelItem.headline?.simpleText || 'Short',
            views: reelItem.viewCountText?.simpleText || '',
            thumbnail: reelItem.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${reelItem.videoId}/frame0.jpg`,
            fullUrl: `https://www.youtube.com/shorts/${reelItem.videoId}`
          });
        }
      }
    }
  }

  return { results, shorts };
}

app.get('/api/youtube/search', async (req, res) => {
  const query = (req.query.q || 'trending').trim();
  const cacheKey = query.toLowerCase();

  if (ytSearchCache.has(cacheKey)) {
    const cached = ytSearchCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 1000 * 60 * 15) { // 15-minute cache
      return res.json({ success: true, results: cached.results, shorts: cached.shorts });
    }
  }

  try {
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(6000)
    });

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) {
      return res.json({ success: true, results: [], shorts: [] });
    }

    const data = JSON.parse(match[1]);
    const parsed = parseYtData(data);

    // If shorts are empty and it was a general search, provide curated/popular shorts
    if (parsed.shorts.length === 0) {
      parsed.shorts = [
        { id: '3lSN4XdWpm4', title: 'Navratri outfit inspiration #trending #fashion #shorts', views: '8.3M views', thumbnail: 'https://i.ytimg.com/vi/3lSN4XdWpm4/frame0.jpg' },
        { id: '9WJqdSs5ZQM', title: 'Jethalal epic comedy moment! #shorts #comedy #viral', views: '14M views', thumbnail: 'https://i.ytimg.com/vi/9WJqdSs5ZQM/frame0.jpg' },
        { id: 'xz8htb5-8wM', title: 'Incredible Fitness & Energy motivation #shorts #viral', views: '69M views', thumbnail: 'https://i.ytimg.com/vi/xz8htb5-8wM/frame0.jpg' },
        { id: 'gCNeDWCI0vo', title: 'Street food cooking skills 1000% #shorts #food', views: '22M views', thumbnail: 'https://i.ytimg.com/vi/gCNeDWCI0vo/frame0.jpg' },
        { id: 'kJQP7kiw5Fk', title: 'Despacito Acoustic Guitar Solo #shorts #music', views: '5.1M views', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/frame0.jpg' },
        { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody Live Crowd Singing #shorts #legend', views: '31M views', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/frame0.jpg' }
      ];
    }

    ytSearchCache.set(cacheKey, { timestamp: Date.now(), results: parsed.results, shorts: parsed.shorts });
    res.json({ success: true, results: parsed.results, shorts: parsed.shorts });
  } catch (err) {
    console.error('[YT SEARCH ERROR]', err.message);
    res.json({ success: false, results: [], shorts: [], error: err.message });
  }
});

// Socket.io real-time synchronization & signaling
io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUser = null;

  socket.on('join-room', ({ roomId, username, avatarColor }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    const room = getOrCreateRoom(roomId);

    // If first user, make them host
    const isHost = room.users.size === 0 || !room.hostId;
    if (isHost) {
      room.hostId = socket.id;
    }

    const safeUsername = (username && username.trim().slice(0, 25)) || `Viewer-${socket.id.slice(0, 4)}`;
    const safeColor = avatarColor || '#6366f1';

    currentUser = {
      id: socket.id,
      username: safeUsername,
      avatarColor: safeColor,
      isHost: room.hostId === socket.id,
      isMuted: true,
      isCameraOn: false,
      joinedAt: Date.now()
    };

    room.users.set(socket.id, currentUser);

    // Calculate current estimated time for smooth sync
    const liveTime = getCalculatedCurrentTime(room.mediaSource);

    // Welcome this user with full room state
    socket.emit('room-joined', {
      roomId: room.id,
      userId: socket.id,
      isHost: currentUser.isHost,
      hostOnlyControls: room.hostOnlyControls,
      backdrop: room.backdrop,
      mediaSource: {
        ...room.mediaSource,
        currentTime: liveTime
      },
      screenShare: room.screenShare || { active: false },
      playlist: room.playlist || [],
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory.slice(-50),
      activePoll: room.activePoll || null,
      activeTheme: room.activeTheme || 'default'
    });

    // Notify others in room
    socket.to(roomId).emit('user-joined', {
      user: currentUser,
      users: Array.from(room.users.values())
    });

    // Add system message to chat (only if not an immediate duplicate)
    const joinText = `${currentUser.username} joined the party!`;
    const lastSysMsg = room.chatHistory[room.chatHistory.length - 1];
    if (!lastSysMsg || lastSysMsg.text !== joinText || (Date.now() - lastSysMsg.timestamp > 15000)) {
      const sysMsg = {
        id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'system',
        text: joinText,
        timestamp: Date.now()
      };
      room.chatHistory.push(sysMsg);
      io.to(roomId).emit('chat-message', sysMsg);
    }

    // Notify others to establish WebRTC peer connection if needed
    socket.to(roomId).emit('webrtc-peer-joined', {
      peerId: socket.id,
      user: currentUser
    });

    // Notify joining user of active remote browser session in this room
    const activeRemoteSession = remoteBrowserManager.getSession(roomId);
    if (activeRemoteSession && activeRemoteSession.status !== 'closed' && activeRemoteSession.status !== 'error') {
      socket.emit('remote-browser-status', {
        status: activeRemoteSession.status,
        message: activeRemoteSession.status === 'ready' ? 'Connected to remote browser session' : 'Starting remote browser...',
        url: activeRemoteSession.currentUrl,
        title: activeRemoteSession.currentTitle,
        width: activeRemoteSession.width,
        height: activeRemoteSession.height
      });
    }
  });

  // Stage Backdrop / Wallpaper Change
  socket.on('change-stage-backdrop', ({ backdrop }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (!backdrop || typeof backdrop !== 'string') return;
    const safeBackdrop = backdrop.trim().slice(0, 1000);
    room.backdrop = safeBackdrop;
    io.to(currentRoomId).emit('stage-backdrop-changed', {
      backdrop: safeBackdrop,
      changedBy: currentUser ? currentUser.username : 'Host'
    });
  });

  // Media Source Change (URL, HLS, YouTube, Local, ScreenShare)
  socket.on('change-media', (mediaData) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    // Check permissions
    if (room.hostOnlyControls && room.hostId !== socket.id) {
      socket.emit('error-notice', 'Only the host can change media right now.');
      return;
    }

    room.mediaSource = {
      type: mediaData.type, // 'url' | 'hls' | 'youtube' | 'local' | 'screenshare' | 'embed'
      url: mediaData.url || '',
      title: mediaData.title || 'Untitled Video',
      poster: mediaData.poster || null,
      backdrop: mediaData.backdrop || null,
      streams: mediaData.streams || null,
      subtitles: mediaData.subtitles || null,
      currentTime: 0,
      isPlaying: mediaData.isPlaying !== undefined ? Boolean(mediaData.isPlaying) : true,
      playbackRate: 1.0,
      lastUpdated: Date.now()
    };

    io.to(currentRoomId).emit('media-changed', {
      mediaSource: room.mediaSource,
      changedBy: currentUser ? currentUser.username : 'Someone'
    });

    // System announcement in chat
    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: `Video changed to: "${room.mediaSource.title}"`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  // Screen Sharing Start/Stop Events
  socket.on('screenshare-start', ({ title } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    const shareTitle = title || 'Live Screen / Tab Share';
    const sharerName = currentUser ? currentUser.username : 'Host';

    room.screenShare = {
      active: true,
      sharerId: socket.id,
      sharerName,
      title: shareTitle
    };

    room.mediaSource = {
      type: 'screenshare',
      url: '',
      title: shareTitle,
      poster: null,
      backdrop: null,
      sharerId: socket.id,
      currentTime: 0,
      isPlaying: true,
      lastUpdated: Date.now()
    };

    io.to(currentRoomId).emit('screenshare-started', room.screenShare);
    io.to(currentRoomId).emit('media-changed', {
      mediaSource: room.mediaSource,
      changedBy: sharerName
    });

    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: `${sharerName} started live Screen / Tab Cast!`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  socket.on('screenshare-stop', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.screenShare && room.screenShare.sharerId === socket.id) {
      const sharerName = currentUser ? currentUser.username : 'Host';
      room.screenShare = {
        active: false,
        sharerId: null,
        sharerName: null,
        title: null
      };

      if (room.mediaSource && room.mediaSource.type === 'screenshare') {
        room.mediaSource = {
          type: 'empty',
          url: '',
          title: 'Screening Stage Ready',
          poster: null,
          currentTime: 0,
          isPlaying: false,
          lastUpdated: Date.now()
        };
      }

      io.to(currentRoomId).emit('screenshare-stopped', { sharerName });

      const sysMsg = {
        id: 'sys_' + Date.now(),
        type: 'system',
        text: `Screen cast ended by ${sharerName}.`,
        timestamp: Date.now()
      };
      room.chatHistory.push(sysMsg);
      io.to(currentRoomId).emit('chat-message', sysMsg);
    }
  });

  // Shared Room Playlist / Queue Events
  socket.on('playlist-add', ({ item } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !item) return;
    const room = rooms.get(currentRoomId);
    if (!room.playlist) room.playlist = [];

    const playlistItem = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type: item.type || 'url',
      url: item.url || '',
      title: item.title || 'Untitled Video',
      poster: item.poster || item.backdrop || null,
      backdrop: item.backdrop || item.poster || null,
      duration: item.duration || 0,
      addedBy: currentUser ? currentUser.username : 'Guest',
      addedAt: Date.now()
    };

    room.playlist.push(playlistItem);
    io.to(currentRoomId).emit('playlist-updated', {
      playlist: room.playlist,
      action: 'add',
      item: playlistItem
    });

    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: `${currentUser ? currentUser.username : 'Someone'} queued: "${playlistItem.title}"`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  socket.on('playlist-remove', ({ itemId } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !itemId) return;
    const room = rooms.get(currentRoomId);
    if (!room.playlist) return;

    const idx = room.playlist.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      const removed = room.playlist.splice(idx, 1)[0];
      io.to(currentRoomId).emit('playlist-updated', {
        playlist: room.playlist,
        action: 'remove',
        item: removed
      });
    }
  });

  socket.on('playlist-clear', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.playlist = [];
    io.to(currentRoomId).emit('playlist-updated', {
      playlist: room.playlist,
      action: 'clear'
    });
  });

  socket.on('playlist-reorder', ({ fromIndex, toIndex } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (!room.playlist || !Array.isArray(room.playlist)) return;
    const from = parseInt(fromIndex, 10);
    const to = parseInt(toIndex, 10);
    if (isNaN(from) || isNaN(to) || from < 0 || from >= room.playlist.length || to < 0 || to >= room.playlist.length) return;
    const [moved] = room.playlist.splice(from, 1);
    room.playlist.splice(to, 0, moved);
    io.to(currentRoomId).emit('playlist-updated', {
      playlist: room.playlist,
      action: 'reorder',
      item: moved
    });
  });

  socket.on('playlist-play', ({ itemId } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !itemId) return;
    const room = rooms.get(currentRoomId);
    if (!room.playlist) return;

    const idx = room.playlist.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      const item = room.playlist.splice(idx, 1)[0];
      room.mediaSource = {
        type: item.type,
        url: item.url,
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        currentTime: 0,
        isPlaying: true,
        playbackRate: 1.0,
        lastUpdated: Date.now()
      };

      io.to(currentRoomId).emit('media-changed', {
        mediaSource: room.mediaSource,
        changedBy: currentUser ? currentUser.username : 'Queue'
      });

      io.to(currentRoomId).emit('playlist-updated', {
        playlist: room.playlist,
        action: 'play',
        item
      });
    }
  });

  socket.on('playlist-next', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (!room.playlist || room.playlist.length === 0) return;

    const nextItem = room.playlist.shift();
    room.mediaSource = {
      type: nextItem.type,
      url: nextItem.url,
      title: nextItem.title,
      poster: nextItem.poster,
      backdrop: nextItem.backdrop,
      currentTime: 0,
      isPlaying: true,
      playbackRate: 1.0,
      lastUpdated: Date.now()
    };

    io.to(currentRoomId).emit('media-changed', {
      mediaSource: room.mediaSource,
      changedBy: 'Queue Autoplay'
    });

    io.to(currentRoomId).emit('playlist-updated', {
      playlist: room.playlist,
      action: 'next',
      item: nextItem
    });

    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: `Queue Autoplay: now screening "${nextItem.title}"!`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  // Soundboard Party Reactions
  socket.on('soundboard-play', ({ soundId } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !soundId) return;
    const senderName = currentUser ? currentUser.username : 'Party Member';
    io.to(currentRoomId).emit('soundboard-triggered', {
      soundId,
      senderName,
      timestamp: Date.now()
    });
  });

  // Synchronized Party Countdown (3... 2... 1... Play!) - Rave-style synchronous start
  socket.on('sync-countdown', ({ seconds = 3, message = 'Sync Countdown' } = {}) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (room.hostOnlyControls && room.hostId !== socket.id) {
      socket.emit('error-notice', 'Only the host can initiate synchronized countdown.');
      return;
    }

    const safeSeconds = Math.max(1, Math.min(10, parseInt(seconds, 10) || 3));
    const senderName = currentUser ? currentUser.username : 'Host';
    const startTime = Date.now() + (safeSeconds * 1000);

    io.to(currentRoomId).emit('sync-countdown-started', {
      seconds: safeSeconds,
      startTime,
      message,
      initiator: senderName
    });

    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: `${senderName} initiated a ${safeSeconds}s synchronized countdown!`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  // Media Play
  socket.on('media-play', ({ currentTime }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostOnlyControls && room.hostId !== socket.id) {
      socket.emit('sync-command', {
        action: 'pause',
        currentTime: getCalculatedCurrentTime(room.mediaSource)
      });
      return;
    }

    room.mediaSource.isPlaying = true;
    room.mediaSource.currentTime = currentTime;
    room.mediaSource.lastUpdated = Date.now();

    socket.to(currentRoomId).emit('media-play', {
      currentTime,
      senderId: socket.id,
      senderName: currentUser ? currentUser.username : 'Host'
    });
  });

  // Media Pause
  socket.on('media-pause', ({ currentTime }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostOnlyControls && room.hostId !== socket.id) {
      socket.emit('sync-command', {
        action: 'play',
        currentTime: getCalculatedCurrentTime(room.mediaSource)
      });
      return;
    }

    room.mediaSource.isPlaying = false;
    room.mediaSource.currentTime = currentTime;
    room.mediaSource.lastUpdated = Date.now();

    socket.to(currentRoomId).emit('media-pause', {
      currentTime,
      senderId: socket.id,
      senderName: currentUser ? currentUser.username : 'Host'
    });
  });

  // Media Seek
  socket.on('media-seek', ({ currentTime }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostOnlyControls && room.hostId !== socket.id) {
      return;
    }

    room.mediaSource.currentTime = currentTime;
    room.mediaSource.lastUpdated = Date.now();

    socket.to(currentRoomId).emit('media-seek', {
      currentTime,
      senderId: socket.id,
      senderName: currentUser ? currentUser.username : 'Host'
    });
  });

  // Media Playback Rate (Speed: 1x, 1.25x, 1.5x)
  socket.on('media-ratechange', ({ playbackRate }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostOnlyControls && room.hostId !== socket.id) return;

    room.mediaSource.playbackRate = playbackRate;
    room.mediaSource.lastUpdated = Date.now();

    socket.to(currentRoomId).emit('media-ratechange', {
      playbackRate,
      senderId: socket.id
    });
  });

  // Member Buffering Notification
  socket.on('media-buffering', ({ isBuffering, currentTime }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    socket.to(currentRoomId).emit('room-member-buffering', {
      peerId: socket.id,
      username: currentUser ? currentUser.username : 'Member',
      isBuffering,
      currentTime
    });
  });

  // Periodic Heartbeat from Host to prevent drift
  socket.on('host-heartbeat', ({ currentTime, isPlaying }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    // Only accept heartbeats from the host
    if (room.hostId !== socket.id) return;

    room.mediaSource.currentTime = currentTime;
    room.mediaSource.isPlaying = isPlaying;
    room.mediaSource.lastUpdated = Date.now();

    // Broadcast heartbeat to members for drift checking
    socket.to(currentRoomId).emit('room-heartbeat', {
      currentTime,
      isPlaying,
      timestamp: Date.now()
    });
  });

  // Explicit Sync Request (e.g. viewer clicks "Sync with Host")
  socket.on('request-sync', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    const calculatedTime = getCalculatedCurrentTime(room.mediaSource);
    socket.emit('sync-response', {
      currentTime: calculatedTime,
      isPlaying: room.mediaSource.isPlaying,
      playbackRate: room.mediaSource.playbackRate,
      mediaSource: room.mediaSource
    });
  });

  // Toggle Host Control restriction
  socket.on('toggle-host-controls', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostId !== socket.id) {
      socket.emit('error-notice', 'Only the host can toggle host-only controls.');
      return;
    }

    room.hostOnlyControls = !room.hostOnlyControls;
    io.to(currentRoomId).emit('host-controls-updated', {
      hostOnlyControls: room.hostOnlyControls,
      updatedBy: currentUser.username
    });

    const sysMsg = {
      id: 'sys_' + Date.now(),
      type: 'system',
      text: room.hostOnlyControls
        ? `Host locked playback controls (Only host can play/pause/seek)`
        : `Host unlocked playback controls (Anyone can play/pause/seek)`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    io.to(currentRoomId).emit('chat-message', sysMsg);
  });

  // Transfer Host Role
  socket.on('transfer-host', ({ newHostId }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);

    if (room.hostId !== socket.id) return;
    if (!room.users.has(newHostId)) return;

    const oldHostUser = room.users.get(socket.id);
    if (oldHostUser) oldHostUser.isHost = false;

    room.hostId = newHostId;
    const newHostUser = room.users.get(newHostId);
    if (newHostUser) newHostUser.isHost = true;

    io.to(currentRoomId).emit('host-transferred', {
      newHostId,
      newHostName: newHostUser ? newHostUser.username : 'Someone',
      users: Array.from(room.users.values())
    });
  });

  // Chat message
  socket.on('send-chat', ({ text }) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !currentUser) return;
    const room = rooms.get(currentRoomId);

    const safeText = (text || '').trim().slice(0, 500);
    if (!safeText) return;

    const chatMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'user',
      userId: socket.id,
      sender: currentUser.username,
      color: currentUser.avatarColor,
      text: safeText,
      timestamp: Date.now()
    };

    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 100) {
      room.chatHistory.shift();
    }

    io.to(currentRoomId).emit('chat-message', chatMsg);
  });

  // Live Emoji Reaction (popcorn, hearts, laughter, fire, etc.)
  socket.on('send-reaction', ({ emoji }) => {
    if (!currentRoomId || !currentUser) return;
    io.to(currentRoomId).emit('new-reaction', {
      emoji,
      sender: currentUser.username,
      id: Date.now() + '_' + Math.random()
    });
  });

  // Synchronized Vector Particle Reaction Broadcast
  socket.on('room-reaction', ({ reactionType } = {}) => {
    if (!currentRoomId || !currentUser || !reactionType) return;
    const type = String(reactionType).trim().slice(0, 30);
    io.to(currentRoomId).emit('room-reaction', {
      reactionType: type,
      sender: currentUser.username,
      senderId: socket.id,
      timestamp: Date.now()
    });
    // Backwards compatibility with new-reaction
    io.to(currentRoomId).emit('new-reaction', {
      emoji: type,
      sender: currentUser.username,
      id: Date.now() + '_' + Math.random()
    });
  });

  // Synchronized Stage Laser Pointer & Telestrator
  socket.on('stage-laser-pointer', (data) => {
    if (!currentRoomId || !currentUser) return;
    socket.to(currentRoomId).emit('stage-laser-pointer', {
      ...data,
      senderId: socket.id,
      senderName: currentUser.username || 'Friend',
      senderColor: currentUser.color || '#e50914'
    });
  });

  socket.on('stage-laser-draw', (data) => {
    if (!currentRoomId || !currentUser) return;
    socket.to(currentRoomId).emit('stage-laser-draw', {
      ...data,
      senderId: socket.id,
      senderName: currentUser.username || 'Friend',
      senderColor: currentUser.color || '#e50914'
    });
  });

  socket.on('stage-laser-clear', () => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('stage-laser-clear');
  });

  // Watch Party Live Polls & Film Trivia
  socket.on('room-poll-create', (pollData) => {
    if (!currentRoomId || !currentUser || !pollData) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const rawOptions = Array.isArray(pollData.options) ? pollData.options : [];
    const options = rawOptions.map(opt => String(opt).trim().slice(0, 100)).filter(Boolean);
    if (options.length < 2) return;
    const pollId = 'poll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newPoll = {
      id: pollId,
      question: String(pollData.question || 'Watch Party Poll').trim().slice(0, 180),
      options: options,
      votes: new Array(options.length).fill(0),
      voters: {},
      isTrivia: !!pollData.isTrivia,
      correctIndex: typeof pollData.correctIndex === 'number' ? pollData.correctIndex : null,
      creator: currentUser.username,
      creatorId: socket.id,
      createdAt: Date.now(),
      active: true
    };
    room.activePoll = newPoll;
    io.to(currentRoomId).emit('room-poll-update', newPoll);

    // Announce poll in room chat
    const announceMsg = {
      id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'system',
      text: `${currentUser.username} launched ${newPoll.isTrivia ? 'a Movie Trivia challenge' : 'a Watch Party Poll'}: "${newPoll.question}"`,
      timestamp: Date.now()
    };
    room.chatHistory.push(announceMsg);
    io.to(currentRoomId).emit('chat-message', announceMsg);
  });

  socket.on('room-poll-vote', ({ pollId, optionIndex }) => {
    if (!currentRoomId || !currentUser) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.activePoll || room.activePoll.id !== pollId || !room.activePoll.active) return;
    const poll = room.activePoll;
    if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= poll.options.length) return;

    const previousVote = poll.voters[socket.id];
    if (typeof previousVote === 'number') {
      if (previousVote === optionIndex) return;
      poll.votes[previousVote] = Math.max(0, (poll.votes[previousVote] || 1) - 1);
    }
    poll.voters[socket.id] = optionIndex;
    poll.votes[optionIndex] = (poll.votes[optionIndex] || 0) + 1;
    io.to(currentRoomId).emit('room-poll-update', poll);
  });

  socket.on('room-poll-end', ({ pollId }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.activePoll || room.activePoll.id !== pollId) return;
    room.activePoll.active = false;
    io.to(currentRoomId).emit('room-poll-update', room.activePoll);
  });

  // Cinema Stage Theme Synchronization
  socket.on('change-stage-theme', ({ theme }) => {
    if (!currentRoomId || !theme) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const safeTheme = String(theme).trim().toLowerCase().slice(0, 20);
    room.activeTheme = safeTheme;
    io.to(currentRoomId).emit('stage-theme-changed', { theme: safeTheme });
  });

  // WebRTC Mesh Signaling for Voice / Video / Screen Share
  socket.on('webrtc-signal', ({ targetId, signal, streamType }) => {
    io.to(targetId).emit('webrtc-signal', {
      fromId: socket.id,
      fromUser: currentUser,
      signal,
      streamType // 'voice' | 'camera' | 'screen'
    });
  });

  // Voice/Video state toggle (mute/unmute, camera on/off)
  socket.on('update-av-state', ({ isMuted, isCameraOn }) => {
    if (!currentRoomId || !rooms.has(currentRoomId) || !currentUser) return;
    const room = rooms.get(currentRoomId);

    currentUser.isMuted = isMuted;
    currentUser.isCameraOn = isCameraOn;

    socket.to(currentRoomId).emit('user-av-updated', {
      userId: socket.id,
      isMuted,
      isCameraOn
    });
  });

  // --------------------------------------------------------------------------
  // Remote Browser Stage Handlers (Real Isolated Chromium Instance per Room)
  // --------------------------------------------------------------------------
  socket.on('remote-browser-start', async ({ url, isMobile, width, height, appName }) => {
    if (!currentRoomId) return;
    try {
      const session = remoteBrowserManager.getOrCreateSession(currentRoomId);
      await session.start(url || 'https://www.youtube.com', { isMobile, width, height, appName });
    } catch (err) {
      socket.emit('remote-browser-status', { status: 'error', message: err.message });
    }
  });

  socket.on('remote-browser-navigate', async ({ url, isMobile, width, height, appName }) => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) {
      await session.navigate(url, { isMobile, width, height, appName });
    }
  });

  socket.on('remote-browser-mouse', async (event) => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session && session.status === 'ready') {
      const room = rooms.get(currentRoomId);
      if (room && room.hostOnlyControls && room.hostId !== socket.id) {
        return; // Host locked controls
      }
      await session.dispatchMouseEvent(event);
    }
  });

  socket.on('remote-browser-key', async (event) => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session && session.status === 'ready') {
      const room = rooms.get(currentRoomId);
      if (room && room.hostOnlyControls && room.hostId !== socket.id) {
        return; // Host locked controls
      }
      await session.dispatchKeyEvent(event);
    }
  });

  socket.on('remote-browser-insert-text', async ({ text, pressEnter, keyAction }) => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session && session.status === 'ready') {
      const room = rooms.get(currentRoomId);
      if (room && room.hostOnlyControls && room.hostId !== socket.id) {
        return; // Host locked controls
      }
      if (keyAction === 'backspace') {
        await session.dispatchKeyEvent({ type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
        await session.dispatchKeyEvent({ type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
        return;
      }
      if (keyAction === 'tab') {
        await session.dispatchKeyEvent({ type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, text: '\t' });
        await session.dispatchKeyEvent({ type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        return;
      }
      if (keyAction === 'enter') {
        await session.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await session.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        return;
      }
      if (keyAction === 'space') {
        await session.insertText(' ');
        return;
      }
      if (text) {
        await session.insertText(text);
      }
      if (pressEnter) {
        await session.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await session.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      }
    }
  });

  socket.on('remote-browser-back', async () => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) await session.goBack();
  });

  socket.on('remote-browser-forward', async () => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) await session.goForward();
  });

  socket.on('remote-browser-reload', async () => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) await session.reload();
  });

  socket.on('remote-browser-stop', () => {
    if (!currentRoomId) return;
    remoteBrowserManager.closeSession(currentRoomId);
  });

  socket.on('remote-browser-set-quality', async ({ quality }) => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) {
      await session.setQuality(quality);
    }
  });

  socket.on('remote-browser-get-status', () => {
    if (!currentRoomId) return;
    const session = remoteBrowserManager.getSession(currentRoomId);
    if (session) {
      socket.emit('remote-browser-status', {
        status: session.status,
        message: session.status === 'ready' ? 'Connected to remote browser session' : 'Starting remote browser...',
        url: session.currentUrl,
        title: session.currentTitle,
        width: session.width,
        height: session.height,
        quality: session.quality,
        qualityMode: session.currentQualityMode
      });
    } else {
      socket.emit('remote-browser-status', { status: 'idle' });
    }
  });

  // Client telemetry ping for real-time latency HUD
  socket.on('client-ping', (clientTs, cb) => {
    if (typeof cb === 'function') {
      cb(clientTs);
    }
  });

  // Disconnect & cleanup
  socket.on('disconnect', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      room.users.delete(socket.id);

      // Notify others of WebRTC peer departure
      socket.to(currentRoomId).emit('webrtc-peer-left', {
        peerId: socket.id
      });

      // If active screen sharer left, notify room
      if (room.screenShare && room.screenShare.sharerId === socket.id) {
        const sharerName = currentUser ? currentUser.username : 'Host';
        room.screenShare = { active: false, sharerId: null, sharerName: null, title: null };
        if (room.mediaSource && room.mediaSource.type === 'screenshare') {
          room.mediaSource = {
            type: 'empty',
            url: '',
            title: 'Screening Stage Ready',
            poster: null,
            currentTime: 0,
            isPlaying: false,
            lastUpdated: Date.now()
          };
        }
        socket.to(currentRoomId).emit('screenshare-stopped', { sharerName });
      }

      if (room.users.size === 0) {
        // Allow a 10-minute grace period before closing remote browser,
        // ensuring browser reloads, network switches, or temporary navigation do not destroy active sessions!
        const rId = currentRoomId;
        setTimeout(() => {
          const activeRoom = rooms.get(rId);
          if (!activeRoom || activeRoom.users.size === 0) {
            remoteBrowserManager.closeSession(rId);
            rooms.delete(rId);
            console.log(`Cleaned up empty room and remote session: ${rId}`);
          }
        }, 10 * 60 * 1000);
      } else {
        // If host left, elect new host automatically
        if (room.hostId === socket.id) {
          const remainingUserIds = Array.from(room.users.keys());
          room.hostId = remainingUserIds[0];
          const newHostUser = room.users.get(room.hostId);
          if (newHostUser) newHostUser.isHost = true;

          io.to(currentRoomId).emit('host-transferred', {
            newHostId: room.hostId,
            newHostName: newHostUser ? newHostUser.username : 'Someone',
            users: Array.from(room.users.values())
          });
        }

        // Notify room members
        io.to(currentRoomId).emit('user-left', {
          userId: socket.id,
          username: currentUser ? currentUser.username : 'Someone',
          users: Array.from(room.users.values())
        });

        if (currentUser) {
          const sysMsg = {
            id: 'sys_' + Date.now(),
            type: 'system',
            text: `${currentUser.username} left the room.`,
            timestamp: Date.now()
          };
          room.chatHistory.push(sysMsg);
          io.to(currentRoomId).emit('chat-message', sysMsg);
        }
      }
    }
  });
});

// Background Stream Prefetcher for Instant Playback
async function prefetchTrendingStreams() {
  try {
    const trendingData = await fetchFromTmdb('/trending/movie/week');
    const items = (trendingData.results || []).slice(0, 6);
    console.log(`[PREFETCH] Pre-warming direct stream manifests for ${items.length} trending titles...`);
    for (const item of items) {
      try {
        const query = `?tmdb=${item.id}&type=movie`;
        const upstream = await fetch(`https://streamdata.vaplayer.ru/api.php${query}`, {
          headers: {
            'Origin': 'https://nextgencloudfabric.com',
            'Referer': 'https://nextgencloudfabric.com/',
            'User-Agent': 'Mozilla/5.0'
          },
          signal: AbortSignal.timeout(5000)
        });
        if (upstream.ok) {
          const data = await upstream.json();
          if (data?.data?.stream_urls?.length) {
            const cacheKey = `movie_${item.id}_s1_e1`;
            streamResolutionCache.set(cacheKey, {
              timestamp: Date.now(),
              data: {
                success: true,
                streamType: 'hls',
                streamUrl: `/api/hls-proxy?url=${encodeURIComponent(data.data.stream_urls[0])}`,
                streams: data.data.stream_urls.map(s => `/api/hls-proxy?url=${encodeURIComponent(s)}`),
                rawStreams: data.data.stream_urls,
                title: data.data.title || item.title,
                fileName: data.data.file_name || null,
                subtitles: data.data.default_subs || [],
                thumbnails: data.data.thumbnails_url || null
              }
            });
            console.log(`[PREFETCH] Cached direct stream for: "${item.title}"`);
          }
        }
      } catch (e) {
        // Non-blocking prefetch failure
      }
    }
  } catch (err) {
    console.warn('[PREFETCH] Background warmup notice:', err.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CineSync Watch Party server running at http://localhost:${PORT}`);
  setTimeout(prefetchTrendingStreams, 1500);
});
