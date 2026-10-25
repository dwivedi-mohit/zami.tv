/**
 * CineSync Extensible Streaming Providers Registry & UI Engine
 * Supports 20+ streaming services, DRM OTT, Live TV, and Direct Video streams.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. OFFICIAL STREAMING PROVIDERS REGISTRY
  // =========================================================================
  const PROVIDER_REGISTRY = [
    // --- Indian OTT ---
    {
      id: 'jiohotstar',
      name: 'JioHotstar',
      categories: ['indian-ott', 'live'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India / Global',
      defaultUrl: 'https://www.hotstar.com',
      supportedUrls: ['hotstar.com', 'jiohotstar.com'],
      description: 'Stream live IPL & ICC cricket tournaments, Marvel Cinematic Universe blockbusters, Disney classics, and Hotstar Specials.',
      syncExplanation: 'DRM-protected service (Widevine DRM). Direct iframe embedding is prohibited by provider security controls. Watch together with friends using ZAMI\'s high-definition WebRTC Tab Audio & Video Share.',
      logoSvg: `<svg viewBox="0 0 140 44" width="94" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 30 C 14 6, 46 2, 68 12" stroke="#00D2FF" stroke-width="2.8" stroke-linecap="round"/>
        <text x="8" y="29" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="900" fill="#FFFFFF" font-style="italic">Disney+</text>
        <polygon points="82,14 84,18 88.5,18.5 85,21.5 86,26 82,23.5 78,26 79,21.5 75.5,18.5 80,18" fill="#FFB703"/>
        <text x="91" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="800" fill="#FFB703" letter-spacing="0.06em">HOTSTAR</text>
      </svg>`
    },
    {
      id: 'zee5',
      name: 'ZEE5',
      categories: ['indian-ott'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India / Global',
      defaultUrl: 'https://www.zee5.com',
      supportedUrls: ['zee5.com'],
      description: 'Stream regional Indian blockbusters, original web series, and TV broadcasts across Hindi, Tamil, Telugu, and Bengali.',
      syncExplanation: 'DRM-protected service. Launch official ZEE5 in your browser and broadcast your tab with stereo audio to your screening squad.',
      logoSvg: `<svg viewBox="0 0 110 44" width="76" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="22" r="16" fill="url(#zee-grad)" />
        <circle cx="24" cy="22" r="9" fill="#121316" />
        <path d="M22 17h5l-4 6.5h4v2h-6l4-6.5h-3z" fill="#FFFFFF" />
        <text x="46" y="28" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="900" fill="#FFFFFF" letter-spacing="0.04em">ZEE5</text>
        <defs>
          <linearGradient id="zee-grad" x1="8" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#9C27B0"/>
            <stop offset="0.33" stop-color="#2196F3"/>
            <stop offset="0.66" stop-color="#4CAF50"/>
            <stop offset="1" stop-color="#FF9800"/>
          </linearGradient>
        </defs>
      </svg>`
    },
    {
      id: 'sonyliv',
      name: 'Sony LIV',
      categories: ['indian-ott', 'live'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India / South Asia',
      defaultUrl: 'https://www.sonyliv.com',
      supportedUrls: ['sonyliv.com'],
      description: 'Stream live Champions League football, international cricket, Shark Tank India, Scam 1992, and Sony entertainment originals.',
      syncExplanation: 'DRM-protected premium service. Stream live sports and series to friends via ZAMI Tab Share with stereo audio.',
      logoSvg: `<svg viewBox="0 0 120 44" width="82" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="4" y="19" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="0.14em">SONY</text>
        <g transform="translate(4, 21)">
          <path d="M0 0h5v16h8v4H0z" fill="#E6007E"/>
          <path d="M17 0h5v20h-5z" fill="#FF8400"/>
          <path d="M26 0l5 15 5-15h5l-7.5 20h-5L21 0z" fill="#00A0E9"/>
        </g>
      </svg>`
    },
    {
      id: 'sunnxt',
      name: 'Sun NXT',
      categories: ['indian-ott'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India (South Cinema)',
      defaultUrl: 'https://www.sunnxt.com',
      supportedUrls: ['sunnxt.com'],
      description: 'The home of South Indian cinema: Tamil, Telugu, Malayalam, and Kannada blockbuster films, live TV channels, and music videos.',
      syncExplanation: 'DRM-protected service. Watch South Indian premieres together by streaming your browser tab with full sound.',
      logoSvg: `<svg viewBox="0 0 120 44" width="82" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="14" fill="#ED1C24"/>
        <g transform="translate(22, 22)">
          <polygon points="0,-11 3,-5 0,0 -3,-5" fill="#FFE600"/>
          <polygon points="11,0 5,3 0,0 5,-3" fill="#FFE600"/>
          <polygon points="0,11 3,5 0,0 -3,5" fill="#FFE600"/>
          <polygon points="-11,0 -5,3 0,0 -5,-3" fill="#FFE600"/>
          <polygon points="8,-8 5,-2 0,0 2,-5" fill="#FFE600"/>
          <polygon points="8,8 2,5 0,0 5,2" fill="#FFE600"/>
          <polygon points="-8,8 -5,2 0,0 -2,5" fill="#FFE600"/>
          <polygon points="-8,-8 -2,-5 0,0 -5,-2" fill="#FFE600"/>
          <circle cx="0" cy="0" r="5" fill="#FFC20E"/>
        </g>
        <text x="44" y="23" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" letter-spacing="0.04em">SUN</text>
        <text x="76" y="23" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="900" fill="#ED1C24" letter-spacing="0.04em">NXT</text>
      </svg>`
    },
    {
      id: 'aha',
      name: 'aha',
      categories: ['indian-ott'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India (Telugu & Tamil)',
      defaultUrl: 'https://www.aha.video',
      supportedUrls: ['aha.video'],
      description: '100% Telugu & Tamil entertainment platform featuring exclusive theatrical premieres, talk shows, and original web series.',
      syncExplanation: 'DRM-protected service. Launch official aha and cast with your room via low-latency WebRTC screen audio.',
      logoSvg: `<svg viewBox="0 0 90 44" width="62" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="8" y="29" font-family="'Plus Jakarta Sans', sans-serif" font-size="26" font-weight="900" fill="#FF5722" letter-spacing="-0.04em">aha</text>
        <circle cx="68" cy="27" r="3.5" fill="#FF9800"/>
      </svg>`
    },
    {
      id: 'lionsgateplay',
      name: 'Lionsgate Play',
      categories: ['indian-ott', 'international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India / SE Asia / Global',
      defaultUrl: 'https://lionsgateplay.com',
      supportedUrls: ['lionsgateplay.com'],
      description: 'Stream John Wick, The Hunger Games, exclusive Starz originals, and Hollywood action blockbusters.',
      syncExplanation: 'DRM-protected Hollywood catalog. Stream synchronized playback via Tab Share with Audio.',
      logoSvg: `<svg viewBox="0 0 140 44" width="96" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 8v26h18v-4h-13v-22z" fill="#00C4D6"/>
        <text x="34" y="22" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="900" fill="#FFFFFF" letter-spacing="0.12em">LIONSGATE</text>
        <text x="34" y="33" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="800" fill="#00C4D6" letter-spacing="0.16em">PLAY</text>
      </svg>`
    },
    {
      id: 'hoichoi',
      name: 'Hoichoi',
      categories: ['indian-ott'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'India (Bengali)',
      defaultUrl: 'https://www.hoichoi.tv',
      supportedUrls: ['hoichoi.tv'],
      description: 'The world\'s leading Bengali entertainment platform: gripping thrillers, classic cinema, and original dramas.',
      syncExplanation: 'DRM-protected regional service. Co-watch Bengali blockbusters with friends via tab audio/video cast.',
      logoSvg: `<svg viewBox="0 0 110 44" width="76" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="15" fill="#E51937"/>
        <path d="M16 14v16h4v-6h4v6h4V14h-4v6h-4v-6z" fill="#FFFFFF"/>
        <text x="44" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="900" fill="#FFFFFF" letter-spacing="-0.02em">hoichoi</text>
      </svg>`
    },
    {
      id: 'mxplayer',
      name: 'MX Player',
      categories: ['indian-ott', 'direct-video'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported In-App Stream',
      region: 'India / Global',
      defaultUrl: 'https://www.mxplayer.in',
      supportedUrls: ['mxplayer.in'],
      description: 'Search and screen thousands of Bollywood blockbusters, web series, and regional cinema with native HLS extraction.',
      syncExplanation: 'Directly integrated with ZAMI\'s native HLS extractor and screening vault.',
      logoSvg: `<svg viewBox="0 0 100 44" width="70" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="5" width="34" height="34" rx="9" fill="#0066FF"/>
        <polygon points="19,14 30,22 19,30" fill="#FFFFFF"/>
        <text x="46" y="25" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="900" fill="#FFFFFF">MX</text>
        <text x="47" y="34" font-family="'Plus Jakarta Sans', sans-serif" font-size="7" font-weight="800" fill="#3B82F6">PLAYER</text>
      </svg>`
    },

    // --- International OTT & Studio Streamers ---
    {
      id: 'netflix',
      name: 'Netflix',
      categories: ['international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'Global',
      defaultUrl: 'https://www.netflix.com',
      supportedUrls: ['netflix.com'],
      description: 'Stream award-winning cinema, Stranger Things, Wednesday, Squid Game, and your entire watchlist in 1080p.',
      syncExplanation: 'Enforces Widevine DRM encryption. Watch together by launching Netflix in Google Chrome and selecting "Share Tab with Audio" in ZAMI.',
      logoSvg: `<svg viewBox="0 0 100 44" width="68" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M38 4h8v36h-8z" fill="#B1060F"/>
        <path d="M54 4h8v36h-8z" fill="#B1060F"/>
        <path d="M38 4h8l16 36h-8L38 4z" fill="#E50914"/>
      </svg>`
    },
    {
      id: 'prime',
      name: 'Amazon Prime Video',
      categories: ['international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'Global',
      defaultUrl: 'https://www.primevideo.com',
      supportedUrls: ['primevideo.com', 'amazon.com'],
      description: 'Watch The Boys, The Rings of Power, Fallout, Reacher, and cinema blockbusters together.',
      syncExplanation: 'DRM-protected catalog. Launch official Prime Video in a browser tab and share with stereo sound.',
      logoSvg: `<svg viewBox="0 0 110 44" width="76" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="6" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-size="22" font-weight="900" fill="#FFFFFF">prime</text>
        <path d="M10 33c16 6 36 6 50-1" fill="none" stroke="#00A8E1" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M57 30l5 3-5 3z" fill="#00A8E1"/>
      </svg>`
    },
    {
      id: 'appletv',
      name: 'Apple TV+',
      categories: ['international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'Global',
      defaultUrl: 'https://tv.apple.com',
      supportedUrls: ['tv.apple.com'],
      description: 'Stream Ted Lasso, Severance, The Morning Show, Slow Horses, and prestige original cinema.',
      syncExplanation: 'Protected Apple FairPlay / Widevine stream. Co-watch via low-latency WebRTC screen audio.',
      logoSvg: `<svg viewBox="0 0 100 44" width="68" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="#FFFFFF">
          <path d="M22 17.5c-.8 1-2 1.6-3.2 1.5-.2-1.2.4-2.4 1.1-3.2.8-1 2.1-1.6 3.2-1.5.2 1.3-.3 2.4-1.1 3.2z"/>
          <path d="M23.1 19.3c-1.8-.1-3.3 1-4.2 1-.9 0-2.2-1-3.6-1-1.9 0-3.6 1.1-4.6 2.8-2 3.4-.5 8.5 1.4 11.3.9 1.4 2 2.9 3.5 2.8 1.4-.1 2-.9 3.6-.9 1.7 0 2.2.9 3.7.9 1.5 0 2.4-1.3 3.3-2.7 1.1-1.6 1.5-3.1 1.6-3.2-.1 0-3-1.2-3.1-4.6 0-2.9 2.4-4.2 2.5-4.3-1.4-2.1-3.6-2.2-4.1-2.1z"/>
        </g>
        <text x="36" y="29" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">tv+</text>
      </svg>`
    },
    {
      id: 'hulu',
      name: 'Hulu',
      categories: ['international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'United States (US)',
      defaultUrl: 'https://www.hulu.com',
      supportedUrls: ['hulu.com'],
      description: 'Stream The Bear, Only Murders in the Building, Shogun, next-day network TV, and FX series.',
      syncExplanation: 'Widevine DRM-protected US streaming service. Broadcast your active Hulu tab with audio.',
      logoSvg: `<svg viewBox="0 0 90 44" width="64" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="8" y="30" font-family="'Plus Jakarta Sans', sans-serif" font-size="28" font-weight="900" fill="#1CE783" letter-spacing="-0.04em">hulu</text>
      </svg>`
    },
    {
      id: 'plex',
      name: 'Plex',
      categories: ['international', 'live'],
      capability: 'external-launch',
      capabilityLabel: 'External Launch & Stream',
      region: 'Global',
      defaultUrl: 'https://app.plex.tv',
      supportedUrls: ['plex.tv'],
      description: 'Stream free movies, 600+ live TV channels, and personal media libraries with your watch party.',
      syncExplanation: 'Launch Plex in your browser and sync media or share the screen stream directly into the room.',
      logoSvg: `<svg viewBox="0 0 90 44" width="62" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="18,12 28,22 18,32 26,32 36,22 26,12" fill="#E5A00D"/>
        <text x="40" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-size="17" font-weight="900" fill="#FFFFFF" letter-spacing="0.04em">PLEX</text>
      </svg>`
    },

    // --- Direct Video, Embeds & Archival Hosts ---
    {
      id: 'vimeo',
      name: 'Vimeo',
      categories: ['international', 'direct-video'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Synchronized Embed',
      region: 'Global',
      defaultUrl: 'https://vimeo.com',
      supportedUrls: ['vimeo.com', 'player.vimeo.com'],
      description: 'Stream high-bitrate independent cinema, short films, documentaries, and creative reels in pristine quality.',
      syncExplanation: 'Officially embeddable! Enter any Vimeo video link or ID to screen synchronized playback on stage for all viewers.',
      presets: [
        { label: 'Sample Reel 1', url: 'https://player.vimeo.com/video/76979871', title: 'The Mountain (Vimeo Reel)' },
        { label: 'Sample Reel 2', url: 'https://player.vimeo.com/video/1084537', title: 'Big Buck Bunny (Vimeo 1080p)' }
      ],
      logoSvg: `<svg viewBox="0 0 100 44" width="70" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 14c.4 3 2.5 9 6.5 18 4 9 8 13.5 12 13.5 4 0 7.5-6 10.5-18 2.5-10.5 4-16 4.5-16.5.8-.8 2-1 3.5-.8l-1.5 6.5c-2 8.5-4.5 17-7.5 25.5-4 11-9.5 16.5-16.5 16.5-7.5 0-13.5-7-18-21-3-9.5-5.5-17-7.5-22.5-1.5-4-3.5-6-6-6-1.5 0-4 1.5-7.5 4.5L0 4c4-3.5 8.5-7 13.5-10.5 5.5-4 9.5-6 12-6 6.5 0 10 5.5 10.5 16.5" fill="#1AB7EA" transform="scale(0.55) translate(16, 8)"/>
      </svg>`
    },
    {
      id: 'dailymotion',
      name: 'Dailymotion',
      categories: ['international', 'direct-video'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Synchronized Embed',
      region: 'Global',
      defaultUrl: 'https://www.dailymotion.com',
      supportedUrls: ['dailymotion.com', 'dai.ly'],
      description: 'Stream news broadcasts, sports highlights, entertainment clips, and independent films from Dailymotion.',
      syncExplanation: 'Officially embeddable player. Enter any Dailymotion video URL or ID to broadcast synchronized video to the room.',
      presets: [
        { label: 'Creative Commons Reel', url: 'https://www.dailymotion.com/embed/video/x8mupd6', title: 'Nature Showcase (Dailymotion)' }
      ],
      logoSvg: `<svg viewBox="0 0 110 44" width="76" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="22" r="14" fill="#0066DC"/>
        <path d="M16 12v20h5v-5.5c1.2 1.2 2.8 1.8 4.5 1.8 4 0 7.5-3.2 7.5-8.2s-3.5-8.2-7.5-8.2c-1.7 0-3.3.6-4.5 1.8V12h-5zm5 9.8c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8-2 4.8-4.5 4.8-4.5-2-4.5-4.8z" fill="#FFFFFF"/>
        <text x="42" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="900" fill="#FFFFFF" letter-spacing="-0.02em">dailymotion</text>
      </svg>`
    },
    {
      id: 'archive',
      name: 'Internet Archive',
      categories: ['international', 'direct-video'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Direct & Embed Stream',
      region: 'Global (Public Domain)',
      defaultUrl: 'https://archive.org/details/movies',
      supportedUrls: ['archive.org'],
      description: 'Access millions of public domain historical films, classic cinema, silent masterpieces, and retro television recordings.',
      syncExplanation: 'Public domain media stream with synchronized theater playback and full scrubber timeline sync.',
      presets: [
        { label: 'Night of the Living Dead (1968)', url: 'https://archive.org/embed/night_of_the_living_dead', title: 'Night of the Living Dead (1968 Classic)' },
        { label: 'A Trip to the Moon (1902)', url: 'https://archive.org/embed/george-melies-a-trip-to-the-moon', title: 'A Trip to the Moon (1902)' }
      ],
      logoSvg: `<svg viewBox="0 0 120 44" width="82" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 12h24v2H8zm2 20h20v2H10zm0-16h3v14h-3zm6 0h3v14h-3zm6 0h3v14h-3zm6 0h3v14h-3zM20 6l-14 6h28z" fill="#FFFFFF"/>
        <text x="38" y="21" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="0.08em">INTERNET</text>
        <text x="38" y="31" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="800" fill="#D4A359" letter-spacing="0.1em">ARCHIVE</text>
      </svg>`
    },
    {
      id: 'direct-video',
      name: 'Direct Video & Cloud',
      categories: ['direct-video'],
      capability: 'direct-video',
      capabilityLabel: 'Supported Direct HLS / MP4',
      region: 'Universal Web',
      defaultUrl: '',
      supportedUrls: ['.m3u8', '.mp4', '.webm'],
      description: 'Play any direct MP4 or adaptive HLS stream from cloud drives, CDNs, or private servers with room play, pause, and seek sync.',
      syncExplanation: 'Native HTML5 and HLS.js video engine with real-time heartbeat synchronization across all participants.',
      presets: [
        { label: 'Mux 1080p HLS Stream', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', title: 'Big Buck Bunny (1080p HLS Test)' },
        { label: 'Sintel 4K HLS Stream', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', title: 'Sintel (Akamai HLS)' }
      ],
      logoSvg: `<svg viewBox="0 0 100 44" width="70" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="14" fill="#1C1E24" stroke="#D4A359" stroke-width="2"/>
        <polygon points="19,16 28,22 19,28" fill="#D4A359"/>
        <path d="M44 18h16M44 26h10" stroke="#00D2FF" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="66" cy="26" r="2" fill="#00D2FF"/>
      </svg>`
    },

    // --- Live Streaming Platforms ---
    {
      id: 'youtube-live',
      name: 'YouTube Live',
      categories: ['live'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Synchronized Live Embed',
      region: 'Global',
      defaultUrl: 'https://www.youtube.com/live',
      supportedUrls: ['youtube.com/live', 'youtu.be'],
      description: 'Stream 24/7 news broadcasts, live esports events, space launches, and creator streams in synchronized harmony.',
      syncExplanation: 'Synchronized live playback powered by YouTube IFrame Engine on the room stage.',
      presets: [
        { label: 'Lofi Girl 24/7 Live', url: 'jfKfPfyJRdk', title: 'Lofi Girl // 24/7 Live Stream' },
        { label: 'NASA Space Live', url: '21X5lGlDOfg', title: 'NASA TV // Live Earth & Space Feed' }
      ],
      logoSvg: `<svg viewBox="0 0 120 44" width="84" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 11c-.3-1.4-1.4-2.4-2.8-2.8-2.5-.6-12.7-.6-12.7-.6s-10.2 0-12.7.6C.4 8.6-.7 9.6-1 11-.4 13.5-.4 20-.4 20s0 6.5.6 9c.3 1.4 1.4 2.4 2.8 2.8 2.5.6 12.7.6 12.7.6s10.2 0 12.7-.6c1.4-.4 2.5-1.4 2.8-2.8.6-2.5.6-9 .6-9s0-6.5-.6-9z" fill="#FF0000" transform="translate(6, 2) scale(0.95)"/>
        <polygon points="18,17 25,21 18,25" fill="#FFFFFF"/>
        <rect x="42" y="14" width="36" height="15" rx="3" fill="#E50914"/>
        <text x="47" y="25" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="0.1em">LIVE</text>
      </svg>`
    },
    {
      id: 'youtube',
      name: 'YouTube',
      categories: ['international', 'direct-video'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Synchronized Stage & Queue',
      region: 'Global',
      defaultUrl: 'https://www.youtube.com',
      supportedUrls: ['youtube.com', 'youtu.be'],
      description: 'Stream movie trailers, video essays, music videos, and comedy specials with synchronized play/pause and advancing queue.',
      syncExplanation: 'Synchronized stage playback with automatic playlist queueing and real-time scrubber tracking.',
      presets: [
        { label: 'Rick Astley Classic', url: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up' },
        { label: 'Cyberpunk 2077 Trailer', url: '8X2kIfS6fb8', title: 'Cyberpunk 2077 Official Cinematic' }
      ],
      logoSvg: `<svg viewBox="0 0 100 44" width="70" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M38 12c-.4-1.6-1.7-2.9-3.3-3.3C31.7 8 19.6 8 19.6 8s-12.1 0-15.1.7C2.9 9.1 1.6 10.4 1.2 12 .5 15 .5 22 .5 22s0 7 .7 10c.4 1.6 1.7 2.9 3.3 3.3 3 .7 15.1.7 15.1.7s12.1 0 15.1-.7c1.6-.4 2.9-1.7 3.3-3.3.7-3 .7-10 .7-10s0-7-.7-10z" fill="#FF0000" transform="translate(6, 0) scale(0.95)"/>
        <polygon points="21,17 29,22 21,27" fill="#FFFFFF"/>
        <text x="48" y="27" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="900" fill="#FFFFFF" letter-spacing="-0.03em">YouTube</text>
      </svg>`
    },
    {
      id: 'twitch',
      name: 'Twitch',
      categories: ['live'],
      capability: 'supported-embed',
      capabilityLabel: 'Supported Synchronized Stage Embed',
      region: 'Global',
      defaultUrl: 'https://www.twitch.tv',
      supportedUrls: ['twitch.tv'],
      description: 'Watch gaming tournaments, esports, live music performances, and your favorite Twitch broadcasters.',
      syncExplanation: 'Live Twitch interactive player directly integrated on the room stage.',
      presets: [
        { label: 'Riot Games', url: 'riotgames', title: 'Riot Games Official Broadcast' },
        { label: 'Shroud', url: 'shroud', title: 'Shroud Live Stream' }
      ],
      logoSvg: `<svg viewBox="0 0 90 44" width="64" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(8, 7) scale(1.25)">
          <path d="M2 0L.5 3.8v15h5v3.5h3.5l3.5-3.5h4L22 13.5V0H2zm17.8 12.5l-3 3h-4.5l-2.7 2.8V15.5H5.5V2h14.3v10.5z" fill="#9146FF"/>
          <path d="M12 6.5h-2.5v5H12V6.5zm5 0h-2.5v5H17V6.5z" fill="#9146FF"/>
        </g>
        <text x="44" y="26" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="900" fill="#FFFFFF">Twitch</text>
      </svg>`
    },

    // --- Anime Platforms ---
    {
      id: 'crunchyroll',
      name: 'Crunchyroll',
      categories: ['anime', 'international'],
      capability: 'screen-share',
      capabilityLabel: 'Screen Share & Tab Cast',
      region: 'Global',
      defaultUrl: 'https://www.crunchyroll.com',
      supportedUrls: ['crunchyroll.com'],
      description: 'Watch Demon Slayer, Jujutsu Kaisen, One Piece, Attack on Titan, and hot simulcasts together.',
      syncExplanation: 'DRM-protected anime catalog. Broadcast your Crunchyroll player tab with high-fidelity audio.',
      logoSvg: `<svg viewBox="0 0 110 44" width="78" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(8, 6) scale(0.68)">
          <circle cx="24" cy="24" r="22" fill="#F47521"/>
          <path d="M29 13.5 C22.6 13.5 17.5 18.6 17.5 25 C17.5 31.4 22.6 36.5 29 36.5 C31.1 36.5 33.1 35.9 34.8 34.9 C32.7 33.1 31.4 30.2 31.4 27 C31.4 22.8 33.7 19.2 36.8 17.5 C34.6 15 31.9 13.5 29 13.5 Z" fill="#FFFFFF"/>
          <circle cx="27" cy="25" r="4.5" fill="#F47521"/>
        </g>
        <text x="46" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="900" fill="#FFFFFF">crunchyroll</text>
        <text x="47" y="33" font-family="'Plus Jakarta Sans', sans-serif" font-size="7" font-weight="800" fill="#F47521">ANIME</text>
      </svg>`
    }
  ];

  // =========================================================================
  // 2. PROVIDER CATALOG CONTROLLER CLASS
  // =========================================================================
  class ProviderCatalog {
    constructor() {
      this.providers = PROVIDER_REGISTRY;
      this.activeFilter = 'all';
      this.searchQuery = '';
      this.selectedProvider = null;
      this.socket = null;

      // Select default provider (Vimeo or JioHotstar)
      this.selectedProvider = this.providers[0];
    }

    init(socket) {
      this.socket = socket;
      this.render();
      this.bindEvents();
    }

    getFilteredProviders() {
      return this.providers.filter(p => {
        const matchesCategory = this.activeFilter === 'all' || p.categories.includes(this.activeFilter);
        const q = this.searchQuery.trim().toLowerCase();
        if (!q) return matchesCategory;

        const matchesSearch = p.name.toLowerCase().includes(q) ||
                              p.id.toLowerCase().includes(q) ||
                              (p.region && p.region.toLowerCase().includes(q)) ||
                              p.categories.some(c => c.toLowerCase().includes(q));

        return matchesCategory && matchesSearch;
      });
    }

    render() {
      const pane = document.getElementById('hub-pane-apps');
      if (!pane) return;

      const filtered = this.getFilteredProviders();

      // Ensure selected provider is valid in current filter or fallback
      if (!this.selectedProvider || !filtered.some(p => p.id === this.selectedProvider.id)) {
        if (filtered.length > 0) {
          this.selectedProvider = filtered[0];
        }
      }

      // Count categories for pill badges
      const counts = {
        all: this.providers.length,
        'indian-ott': this.providers.filter(p => p.categories.includes('indian-ott')).length,
        international: this.providers.filter(p => p.categories.includes('international')).length,
        live: this.providers.filter(p => p.categories.includes('live')).length,
        anime: this.providers.filter(p => p.categories.includes('anime')).length,
        'direct-video': this.providers.filter(p => p.categories.includes('direct-video')).length
      };

      pane.innerHTML = `
        <!-- Catalog Header Banner -->
        <div class="apps-banner">
          <div class="apps-banner-info">
            <span class="hub-eyebrow">STREAMING DIRECTORY</span>
            <h3 class="pane-title" style="margin-bottom: 6px;">Universal Streaming Apps &amp; Video Catalog</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 720px; line-height: 1.5; margin: 0;">
              Extensible screening index spanning Indian OTT, international platforms, live broadcasts, and direct streams.
              Select any service to stream on stage, share your tab with stereo audio, or launch official media.
            </p>
          </div>
          <div class="apps-banner-action">
            <a href="/api/download-extension" class="btn btn-secondary btn-sm" style="text-decoration: none; display: flex; align-items: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 13.5a2.5 2.5 0 1 0-3-3V7a2 2 0 0 0-2-2h-3.5a2.5 2.5 0 1 0-3 3H7a2 2 0 0 0-2 2v3.5a2.5 2.5 0 1 0 3 3V19a2 2 0 0 0 2 2h3.5a2.5 2.5 0 1 0 3-3H19a2 2 0 0 0 2-2v-3.5z"/></svg>
              <span>Chrome Extension</span>
            </a>
          </div>
        </div>

        <!-- Controls: Category Filters & Live Search -->
        <div class="catalog-controls-bar">
          <div class="category-filters-scroll" role="tablist" aria-label="Streaming service categories">
            <button type="button" class="filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" data-cat="all" role="tab" aria-selected="${this.activeFilter === 'all'}">
              <span>All</span>
              <span class="filter-count">${counts.all}</span>
            </button>
            <button type="button" class="filter-pill ${this.activeFilter === 'indian-ott' ? 'active' : ''}" data-cat="indian-ott" role="tab" aria-selected="${this.activeFilter === 'indian-ott'}">
              <span>Indian OTT</span>
              <span class="filter-count">${counts['indian-ott']}</span>
            </button>
            <button type="button" class="filter-pill ${this.activeFilter === 'international' ? 'active' : ''}" data-cat="international" role="tab" aria-selected="${this.activeFilter === 'international'}">
              <span>International</span>
              <span class="filter-count">${counts.international}</span>
            </button>
            <button type="button" class="filter-pill ${this.activeFilter === 'live' ? 'active' : ''}" data-cat="live" role="tab" aria-selected="${this.activeFilter === 'live'}">
              <span>Live</span>
              <span class="filter-count">${counts.live}</span>
            </button>
            <button type="button" class="filter-pill ${this.activeFilter === 'anime' ? 'active' : ''}" data-cat="anime" role="tab" aria-selected="${this.activeFilter === 'anime'}">
              <span>Anime</span>
              <span class="filter-count">${counts.anime}</span>
            </button>
            <button type="button" class="filter-pill ${this.activeFilter === 'direct-video' ? 'active' : ''}" data-cat="direct-video" role="tab" aria-selected="${this.activeFilter === 'direct-video'}">
              <span>Direct Video</span>
              <span class="filter-count">${counts['direct-video']}</span>
            </button>
          </div>

          <div class="catalog-search-wrap">
            <span class="catalog-search-icon" style="display: flex; align-items: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="search" 
                   id="catalog-search-input" 
                   class="catalog-search-input" 
                   placeholder="Search providers (e.g. Hotstar, Vimeo, ZEE5)... [/]" 
                   value="${this.escapeHtml(this.searchQuery)}"
                   aria-label="Search streaming providers" />
            ${this.searchQuery ? `<button type="button" id="catalog-search-clear" class="catalog-search-clear" title="Clear search"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          </div>
        </div>

        <!-- Compact Official Logo Grid (LOGOS ONLY, NO TEXT/BADGES ON TILES) -->
        <div class="provider-logo-grid" role="region" aria-label="Streaming Provider Logo Grid">
          ${filtered.length === 0 ? `
            <div class="provider-grid-empty">
              <span>No streaming services found matching "${this.escapeHtml(this.searchQuery)}"</span>
              <button type="button" class="btn btn-outline btn-sm" id="btn-reset-catalog-filter">Reset Filters</button>
            </div>
          ` : filtered.map(provider => {
            const isSelected = this.selectedProvider && this.selectedProvider.id === provider.id;
            return `
              <button type="button" 
                      class="provider-tile ${isSelected ? 'selected' : ''}" 
                      data-provider-id="${provider.id}"
                      tabindex="0"
                      role="button"
                      aria-label="${provider.name} (${provider.capabilityLabel})"
                      title="${provider.name} · ${provider.capabilityLabel}">
                <div class="provider-tile-logo">
                  ${provider.logoSvg}
                </div>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Selected Provider Action Panel / Launchpad -->
        ${this.renderActionPanel()}

        <!-- DRM Pro-Tip Guide Banner -->
        <div class="drm-guide-card" style="margin-top: 24px;">
          <div class="drm-guide-header">
            <span class="drm-guide-badge" style="display: inline-flex; align-items: center; gap: 5px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>PRO-TIP · DRM CO-WATCHING PROTOCOL</span>
            </span>
            <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">Watch JioHotstar, Netflix, Prime Video &amp; ZEE5 Together</h4>
          </div>
          <div class="drm-steps-grid">
            <div class="drm-step-col">
              <div class="drm-step-num">1</div>
              <div class="drm-step-content">
                <strong>Launch Official App</strong>
                <span>Open your favorite streaming service in a Chrome or Brave tab.</span>
              </div>
            </div>
            <div class="drm-step-col">
              <div class="drm-step-num">2</div>
              <div class="drm-step-content">
                <strong>Share Tab with Audio</strong>
                <span>In ZAMI, click "Share Screen / Tab" and ensure "Share tab audio" is checked.</span>
              </div>
            </div>
            <div class="drm-step-col">
              <div class="drm-step-num">3</div>
              <div class="drm-step-content">
                <strong>Zero Lag &amp; Full Sync</strong>
                <span>Your friends watch in sync with 1080p 60fps stereo audio and live soundboard chimes.</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderActionPanel() {
      if (!this.selectedProvider) return '';
      const p = this.selectedProvider;

      let capabilityBadgeClass = 'badge-embed';
      let capabilityIconSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
      if (p.capability === 'screen-share') {
        capabilityBadgeClass = 'badge-screenshare';
        capabilityIconSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
      } else if (p.capability === 'direct-video') {
        capabilityBadgeClass = 'badge-direct';
        capabilityIconSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
      } else if (p.capability === 'external-launch') {
        capabilityBadgeClass = 'badge-external';
        capabilityIconSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
      }

      return `
        <div class="provider-action-panel" id="provider-action-panel">
          <div class="provider-panel-top">
            <div class="provider-panel-brand">
              <div class="provider-panel-logo-wrap">
                ${p.logoSvg}
              </div>
              <div class="provider-panel-meta">
                <div class="provider-panel-title-row">
                  <h4 class="provider-panel-name">${p.name}</h4>
                  <span class="provider-capability-badge ${capabilityBadgeClass}">
                    ${capabilityIconSvg} <span>${p.capabilityLabel.toUpperCase()}</span>
                  </span>
                  <span class="provider-region-pill">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>${p.region}</span>
                  </span>
                </div>
                <p class="provider-panel-desc">${p.description}</p>
              </div>
            </div>
          </div>

          <div class="provider-panel-note">
            <span class="note-bullet">ℹ</span>
            <span>${p.syncExplanation}</span>
          </div>

          <!-- Dynamic Action Forms based on capability -->
          <div class="provider-panel-actions-wrapper">
            ${this.renderCapabilityActions(p)}
          </div>
        </div>
      `;
    }

    renderCapabilityActions(p) {
      if (p.capability === 'supported-embed') {
        const placeholder = p.id === 'vimeo' ? 'https://vimeo.com/76979871 or video ID'
                          : p.id === 'dailymotion' ? 'https://www.dailymotion.com/video/x8mupd6 or video ID'
                          : p.id === 'archive' ? 'https://archive.org/details/night_of_the_living_dead or item ID'
                          : p.id === 'youtube-live' ? 'YouTube Live stream URL or Video ID (e.g. jfKfPfyJRdk)'
                          : p.id === 'twitch' ? 'Twitch channel name (e.g. shroud, riotgames)'
                          : 'Enter video URL or identifier...';

        return `
          <div class="provider-input-flow">
            <div class="provider-input-group">
              <input type="text" 
                     id="provider-media-input" 
                     class="input-cinematic" 
                     placeholder="${placeholder}" 
                     aria-label="Media URL or ID for ${p.name}" />
              <button type="button" class="btn btn-primary" id="btn-provider-stream-stage" title="Screen synchronized video with room-wide playback">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Sync Video Player</span>
              </button>
              <button type="button" class="btn btn-secondary" id="btn-provider-embed-stage" title="Embed original ${p.name} website directly on stage">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Embed Site</span>
              </button>
              ${p.defaultUrl ? `
                <a href="${p.defaultUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" title="Open official ${p.name} website in new tab">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                  <span>New Tab</span>
                </a>
              ` : ''}
            </div>

            ${p.presets && p.presets.length > 0 ? `
              <div class="provider-presets-row">
                <span class="presets-label">QUICK TEST PRESETS:</span>
                ${p.presets.map((pr, idx) => `
                  <button type="button" class="btn-preset-pill" data-preset-idx="${idx}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span>${pr.label}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      if (p.capability === 'direct-video') {
        return `
          <div class="provider-input-flow">
            <div class="provider-input-group">
              <input type="url" 
                     id="provider-media-input" 
                     class="input-cinematic" 
                     placeholder="Enter direct .m3u8 (HLS) or .mp4 / .webm video URL..." 
                     aria-label="Direct video URL" />
              <button type="button" class="btn btn-primary" id="btn-provider-stream-stage" title="Load stream into synchronized video player">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Load Stream</span>
              </button>
              <button type="button" class="btn btn-secondary" id="btn-provider-embed-stage" title="Preview video URL in stage webview">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Embed Webview</span>
              </button>
            </div>

            ${p.presets && p.presets.length > 0 ? `
              <div class="provider-presets-row">
                <span class="presets-label">TEST STREAMS:</span>
                ${p.presets.map((pr, idx) => `
                  <button type="button" class="btn-preset-pill" data-preset-idx="${idx}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    <span>${pr.label}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      // Default: Streaming Apps & DRM OTT (JioHotstar, ZEE5, Sony LIV, Sun NXT, aha, Lionsgate Play, Hoichoi, Apple TV+, Hulu, Plex, Netflix, Prime Video, Crunchyroll, MX Player)
      return `
        <div class="provider-input-flow">
          <div class="provider-input-group">
            <input type="text" 
                   id="provider-media-input" 
                   class="input-cinematic" 
                   value="${p.defaultUrl || ''}"
                   placeholder="Enter ${p.name} URL (movie, show, or browse page)..." 
                   aria-label="Target URL for ${p.name}" />
            <button type="button" class="btn btn-primary" id="btn-provider-embed-stage" title="Embed original ${p.name} website directly on stage">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Embed on Stage</span>
            </button>
            <button type="button" class="btn btn-secondary" id="btn-provider-tabcast" title="Broadcast tab with stereo audio">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>Cast Tab (Stereo)</span>
            </button>
            <a href="${p.defaultUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" title="Open official ${p.name} website in new tab">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              <span>New Tab</span>
            </a>
          </div>

          ${p.presets && p.presets.length > 0 ? `
            <div class="provider-presets-row">
              <span class="presets-label">QUICK EMBED PRESETS:</span>
              ${p.presets.map((pr, idx) => `
                <button type="button" class="btn-preset-pill" data-preset-idx="${idx}">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span>${pr.label}</span>
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    bindEvents() {
      const pane = document.getElementById('hub-pane-apps');
      if (!pane) return;

      // Filter Pill Clicking
      pane.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeFilter = btn.dataset.cat || 'all';
          this.render();
          this.bindEvents();
        });
      });

      // Search Input Interactivity
      const searchInput = pane.querySelector('#catalog-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value;
          this.render();
          this.bindEvents();
          // Restore focus to input
          const newInput = document.getElementById('catalog-search-input');
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
          }
        });

        // Global hotkey '/' to focus search
        document.addEventListener('keydown', (e) => {
          if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            searchInput.focus();
          }
        });
      }

      // Search Clear Button
      const clearBtn = pane.querySelector('#catalog-search-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.searchQuery = '';
          this.render();
          this.bindEvents();
        });
      }

      // Reset Filter Button
      const resetBtn = pane.querySelector('#btn-reset-catalog-filter');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.activeFilter = 'all';
          this.searchQuery = '';
          this.render();
          this.bindEvents();
        });
      }

      // Provider Tile Selection & Double-Click Fast Embed
      pane.querySelectorAll('.provider-tile').forEach(tile => {
        const selectTile = () => {
          const providerId = tile.dataset.providerId;
          const found = this.providers.find(p => p.id === providerId);
          if (found) {
            this.selectedProvider = found;
            this.render();
            this.bindEvents();
            // Scroll action panel smoothly into view if needed
            const panel = document.getElementById('provider-action-panel');
            if (panel) {
              panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        };

        tile.addEventListener('click', selectTile);
        tile.addEventListener('dblclick', (e) => {
          e.preventDefault();
          const providerId = tile.dataset.providerId;
          const found = this.providers.find(p => p.id === providerId);
          if (found) {
            this.selectedProvider = found;
            const targetUrl = found.defaultUrl || ((found.presets && found.presets[0]) ? found.presets[0].url : '');
            if (found.capability === 'supported-embed' && found.presets && found.presets[0] && !found.presets[0].url.startsWith('http')) {
              this.executeStreamAction(found.presets[0].url, found.presets[0].title);
            } else if (window.openInbuiltBrowser && targetUrl) {
              window.openInbuiltBrowser(targetUrl);
              if (window.showToast) window.showToast(`Embedding ${found.name} on stage...`, 'info', 3000);
            }
            const modalVault = document.getElementById('media-modal');
            if (modalVault) modalVault.classList.remove('active');
          }
        });
        tile.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectTile();
          }
        });
      });

      // Preset Buttons Clicking
      pane.querySelectorAll('.btn-preset-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.presetIdx, 10);
          if (this.selectedProvider && this.selectedProvider.presets && this.selectedProvider.presets[idx]) {
            const preset = this.selectedProvider.presets[idx];
            const input = document.getElementById('provider-media-input');
            if (input) {
              input.value = preset.url;
            }
            if (this.selectedProvider.capability === 'supported-embed' && !preset.url.startsWith('https://www.youtube.com') && !preset.url.startsWith('https://www.twitch.tv')) {
              this.executeStreamAction(preset.url, preset.title);
            } else if (this.selectedProvider.capability === 'direct-video') {
              this.executeStreamAction(preset.url, preset.title);
            } else if (window.openInbuiltBrowser) {
              window.openInbuiltBrowser(preset.url);
              if (window.showToast) window.showToast(`Embedding ${this.selectedProvider.name} on stage...`, 'info', 3000);
              const modalVault = document.getElementById('media-modal');
              if (modalVault) modalVault.classList.remove('active');
            }
          }
        });
      });

      // Embed on Stage Button (Primary for all providers)
      const btnEmbed = pane.querySelector('#btn-provider-embed-stage');
      if (btnEmbed) {
        btnEmbed.addEventListener('click', () => {
          const p = this.selectedProvider;
          if (!p) return;
          const input = document.getElementById('provider-media-input');
          const targetUrl = (input ? input.value : '').trim() || p.defaultUrl;
          if (!targetUrl) {
            window.showToast('Please enter a target URL or select a preset', 'error');
            return;
          }
          if (window.openInbuiltBrowser) {
            window.openInbuiltBrowser(targetUrl);
            if (window.showToast) window.showToast(`Embedding ${p.name} on stage...`, 'info', 3000);
          }
          const modalVault = document.getElementById('media-modal');
          if (modalVault) modalVault.classList.remove('active');
        });
      }

      // Stream on Stage Button
      const btnStream = pane.querySelector('#btn-provider-stream-stage');
      if (btnStream) {
        btnStream.addEventListener('click', () => {
          const input = document.getElementById('provider-media-input');
          const rawUrl = (input ? input.value : '').trim();
          if (!rawUrl) {
            window.showToast('Please enter a video URL, identifier, or select a preset', 'error');
            return;
          }
          this.executeStreamAction(rawUrl);
        });
      }

      // Tab Cast Button (for DRM OTT)
      const btnTabcast = pane.querySelector('#btn-provider-tabcast');
      if (btnTabcast) {
        btnTabcast.addEventListener('click', () => {
          const p = this.selectedProvider;
          if (window.showToast) {
            window.showToast(`Starting WebRTC tab cast for ${p.name}... Make sure "Share tab audio" is enabled!`, 'info', 5000);
          }
          if (window.webrtcManager) {
            window.webrtcManager.toggleScreenShare();
          }
          // Close modal vault to reveal stage
          const modalVault = document.getElementById('modal-vault');
          if (modalVault) modalVault.classList.remove('active');
        });
      }
    }

    executeStreamAction(rawInput, customTitle) {
      const p = this.selectedProvider;
      if (!p) return;

      const input = (rawInput || '').trim();
      const modalVault = document.getElementById('modal-vault');

      // 1. VIMEO
      if (p.id === 'vimeo') {
        let vimeoId = input;
        const match = input.match(/(?:vimeo\.com\/|video\/)(\d+)/);
        if (match) vimeoId = match[1];

        const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
        const title = customTitle || `VIMEO // ${vimeoId}`;

        if (this.socket) {
          this.socket.emit('change-media', {
            type: 'embed',
            url: embedUrl,
            title: title
          });
        }
        if (window.showToast) window.showToast(`Screening Vimeo: ${vimeoId}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 2. DAILYMOTION
      if (p.id === 'dailymotion') {
        let dmId = input;
        const match = input.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
        if (match) dmId = match[1];

        const embedUrl = `https://www.dailymotion.com/embed/video/${dmId}?autoplay=1`;
        const title = customTitle || `DAILYMOTION // ${dmId}`;

        if (this.socket) {
          this.socket.emit('change-media', {
            type: 'embed',
            url: embedUrl,
            title: title
          });
        }
        if (window.showToast) window.showToast(`Screening Dailymotion: ${dmId}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 3. INTERNET ARCHIVE
      if (p.id === 'archive') {
        let itemId = input;
        const match = input.match(/archive\.org\/(?:details|embed)\/([a-zA-Z0-9_\-\.]+)/);
        if (match) itemId = match[1];

        const embedUrl = input.endsWith('.mp4') || input.endsWith('.ogv')
          ? input
          : `https://archive.org/embed/${itemId}`;

        const isDirect = embedUrl.endsWith('.mp4') || embedUrl.endsWith('.ogv');
        const title = customTitle || `ARCHIVE // ${itemId}`;

        if (this.socket) {
          this.socket.emit('change-media', {
            type: isDirect ? 'url' : 'embed',
            url: embedUrl,
            title: title
          });
        }
        if (window.showToast) window.showToast(`Screening Internet Archive: ${itemId}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 4. YOUTUBE / YOUTUBE LIVE
      if (p.id === 'youtube-live' || p.id === 'youtube') {
        let ytId = input;
        const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/|shorts\/))([a-zA-Z0-9_-]{11})/);
        if (match) ytId = match[1];

        const ytUrl = `https://www.youtube.com/watch?v=ytId`;
        const title = customTitle || `${p.name.toUpperCase()} // ${ytId}`;

        if (this.socket) {
          this.socket.emit('change-media', {
            type: 'youtube',
            url: ytId,
            title: title
          });
        }
        if (window.showToast) window.showToast(`Screening YouTube: ${ytId}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 5. TWITCH
      if (p.id === 'twitch') {
        let ch = input;
        const match = input.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
        if (match) ch = match[1];

        if (this.socket) {
          this.socket.emit('change-media', {
            type: 'twitch',
            url: ch,
            title: `TWITCH // ${ch.toUpperCase()}`
          });
        }
        if (window.showToast) window.showToast(`Screening Twitch: ${ch}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 6. DIRECT VIDEO / HLS
      if (p.capability === 'direct-video') {
        const isHls = input.includes('.m3u8');
        const isMp4 = input.includes('.mp4') || input.includes('.webm') || input.includes('.ogg');

        if (!isHls && !isMp4 && !input.startsWith('http')) {
          if (window.showToast) window.showToast('Please enter a valid HTTP/HTTPS video URL (.m3u8, .mp4, or .webm)', 'error');
          return;
        }

        const type = isHls ? 'hls' : 'url';
        const title = customTitle || (isHls ? 'HLS LIVE STREAM' : 'DIRECT VIDEO REEL');

        if (this.socket) {
          this.socket.emit('change-media', {
            type: type,
            url: input,
            title: title
          });
        }
        if (window.showToast) window.showToast(`Loading direct stream: ${title}`, 'success');
        if (modalVault) modalVault.classList.remove('active');
        return;
      }

      // 7. MX PLAYER
      if (p.id === 'mxplayer') {
        if (input && input.startsWith('http')) {
          if (window.openInbuiltBrowser) {
            window.openInbuiltBrowser(input);
            if (window.showToast) window.showToast('Embedding MX Player on stage...', 'info');
          }
          if (modalVault) modalVault.classList.remove('active');
          return;
        }
        if (window.switchHubTab) {
          window.switchHubTab('mx');
        }
        return;
      }

      // 8. OTT & WEB STREAMING WEBSITES (JioHotstar, ZEE5, Sony LIV, Sun NXT, aha, Netflix, Prime, etc.)
      if (p.capability === 'screen-share' || p.capability === 'external-launch') {
        const target = input || p.defaultUrl;
        if (window.openInbuiltBrowser) {
          window.openInbuiltBrowser(target);
          if (window.showToast) window.showToast(`Embedding ${p.name} on stage...`, 'info');
        }
        if (modalVault) modalVault.classList.remove('active');
        return;
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Export Singleton
  window.CineSyncProviderCatalog = new ProviderCatalog();

  // Expose global initializer
  window.initProviderCatalog = function (socket) {
    if (window.CineSyncProviderCatalog) {
      window.CineSyncProviderCatalog.init(socket);
    }
  };

  // Auto-render on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.CineSyncProviderCatalog.render();
      window.CineSyncProviderCatalog.bindEvents();
    });
  } else {
    window.CineSyncProviderCatalog.render();
    window.CineSyncProviderCatalog.bindEvents();
  }

})();
