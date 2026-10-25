# CineSync Chrome Extension — Chrome Web Store Listing & Guide

## Store Listing Metadata

- **Name**: CineSync — Watch Party for Hotstar & MX Player
- **Summary**: Watch movies together on Disney+ Hotstar and MX Player in real-time sync with friends, with floating chat and live emoji reactions.
- **Category**: Social & Communication / Entertainment
- **Default Language**: English
- **Version**: 1.0.0

## Description

Watch movies and shows together with 2 to 3 friends in perfect sync!

CineSync allows you and your friends to enjoy Disney+ Hotstar and MX Player together in original full HD quality with zero DRM blocks, zero black screens, and zero video buffering.

### ✨ Key Features:
- **Synchronized Playback**: Automatically syncs Play, Pause, and Seek events between all room participants.
- **In-Movie Floating Chat**: Chat with friends directly on Hotstar and MX Player without switching tabs.
- **Live Emoji Reactions**: Burst popcorn 🍿, hearts ❤️, laughs 😂, fire 🔥, and claps 👏 across the screen in real-time.
- **Automatic Drift Correction**: Keeps everyone aligned down to the exact second.
- **No DRM Issues**: Plays directly inside your authenticated browser session with full Widevine DRM decryption.

---

## Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `storage` | Used to save the user's active party room code, chosen nickname, and server preferences across browser sessions. |
| `activeTab` | Allows the extension to interact with the currently active tab when the user clicks the extension popup to connect to a watch party. |

### Host Permissions Justification

| Host Match | Justification |
| :--- | :--- |
| `https://*.hotstar.com/*` | Required to detect the native Hotstar video player, synchronize playback timestamps, and display the floating watch party chat overlay. |
| `https://*.mxplayer.in/*` | Required to detect the native MX Player video player, synchronize playback timestamps, and display the floating watch party chat overlay. |
| `http://localhost:3000/*` | Required to communicate with your local CineSync signaling server for real-time WebSocket party events. |

---

## Privacy Policy & Disclosures

1. **Does the extension collect personal data?**
   No. CineSync does not collect, track, or sell any personal information, browsing history, or payment credentials.
2. **What data is transmitted?**
   Only real-time playback control commands (Play, Pause, Seek timestamp, Room ID, and user chat messages) sent to your chosen CineSync server.
3. **Account credentials**:
   CineSync never touches or inspects your Hotstar or MX Player passwords, cookies, or account credentials.
