# 🎬 CineSync — Watch Movies Together in Sync

A real-time, synchronized watch party platform built for 2 to 3 friends to watch movies together with synchronized playback, live chat, voice calls, and floating emoji reactions.

Supports **Disney+ Hotstar**, **MX Player**, direct **MP4/WebM**, **HLS (.m3u8)** streams, **YouTube**, and **Local Movie Files**!

---

## 🚀 Quick Start

### 1. Start the Server
```bash
npm start
```
The server will start at:
👉 **[http://localhost:3000](http://localhost:3000)**

### 2. Invite Friends
1. Open [http://localhost:3000](http://localhost:3000) and click **"Create New Room"**.
2. Click **"Invite Friends"** to copy the room link (e.g. `http://localhost:3000/room/cinema-party-42`).
3. Send the link to 1 or 2 friends to join from their browsers!

---

## 🍿 How to Watch Disney+ Hotstar & MX Player Together

Because OTT platforms like **Disney+ Hotstar** and **MX Player** enforce Widevine DRM encryption, CineSync provides two proven ways to watch together:

### Method 1: Live Tab Sharing with Audio (Recommended)
1. **Fix the Black Screen (Crucial for DRM)**:
   - In Google Chrome, go to **Settings > System**.
   - Turn **OFF** *"Use graphics acceleration when available"*.
   - Relaunch Chrome. *(This prevents the browser from blacking out protected DRM streams).*
2. Open **Hotstar** or **MX Player** in a Chrome tab.
3. In CineSync, click **"Voice" > "Share Screen / Tab with Audio"**.
4. Select the Hotstar or MX Player tab and **ensure "Share tab audio" is checked**.
5. Your friends will see and hear the movie with low-latency WebRTC!

### Method 2: Synchronized Local Movie Files (Zero Lag & 4K Quality)
1. Both you and your friends download the same movie file onto your laptops.
2. In CineSync, click **"Choose Video" > "Local Movie File"**.
3. Select your local file.
4. The movie streams directly from each person's hard drive (**0 buffering**, **0 bandwidth load**, crisp 4K), while CineSync synchronizes your **Play, Pause, and Seek** actions in real time!

---

## 📽️ Supported Video Sources

| Source Type | Description |
| :--- | :--- |
| **Direct URL** | Direct links to `.mp4`, `.webm`, or cloud video files. |
| **HLS Streams (.m3u8)** | Adaptive HTTP Live Streaming with built-in `Hls.js` engine for live feeds and VOD. |
| **YouTube** | Paste any YouTube URL for synchronized playback with YouTube IFrame API. |
| **Local File Sync** | Play local files in sync with friends without uploading them to any server. |
| **WebRTC Screen Share** | Stream your browser tab with full stereo audio directly to peers. |

---

## ✨ Features

- **High-Precision Sync**: Automatic heartbeat every 2.5 seconds with auto-drift correction.
- **Master Clock & Host Controls**: The room creator can lock controls so only the host can play/pause/seek.
- **Floating Live Reactions**: Click 🍿, ❤️, 😂, 🔥, 👏, 😱 to burst animated emoji particles across everyone's screens in real-time.
- **Built-in Voice Call**: WebRTC mesh voice chat with mute/unmute and camera toggles.
- **Integrated Live Chat**: Real-time room chat with custom avatar colors and chime sound effects.
- **Cinematic Dark UI**: Sleek theater layout with custom overlay controls and keyboard shortcuts (`Space` to play/pause, `Left`/`Right` to seek 10s, `F` for fullscreen, `M` for mute).
