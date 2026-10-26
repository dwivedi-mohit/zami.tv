/**
 * WebRTC Mesh & Tab Cast Engine
 * High-definition (1080p 60fps) Screen & Browser Tab Sharing with stereo sound (Netflix, Prime, Hotstar, YouTube)
 * Peer-to-peer Voice/Video mesh
 */

class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peers = new Map(); // peerId -> { pc, audioEl, stream }
    this.knownPeerIds = new Set();
    this.localStream = null;
    this.screenStream = null;

    this.isMuted = true;
    this.isCameraOn = false;
    this.isSharingScreen = false;

    this.activeScreenSharerId = null;
    this.activeScreenSharerName = null;
    this.activeScreenShareTitle = null;
    this.remoteScreenStream = null;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ]
    };

    this.audioCtx = null;
    this.analysers = new Map();
    this.speakingLoopInterval = null;

    this.initSocketSignaling();
    this.initUIControls();

    // Auto-resume AudioContext and unlock any pending peer audio on user click
    window.addEventListener('click', () => {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      this.peers.forEach(({ audioEl }) => {
        if (audioEl && audioEl.paused && audioEl.srcObject) {
          audioEl.play().catch(() => {});
        }
      });
    }, { passive: true });
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  attachAudioAnalyser(id, stream) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || !stream || !stream.getAudioTracks().length) return;

      this.detachAudioAnalyser(id);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      const sourceNode = ctx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.analysers.set(id, { analyser, sourceNode, dataArray });
    } catch (e) {
      console.warn('Could not attach audio analyser for', id, e);
    }
  }

  detachAudioAnalyser(id) {
    if (this.analysers.has(id)) {
      const { sourceNode } = this.analysers.get(id);
      try {
        sourceNode.disconnect();
      } catch (e) {}
      this.analysers.delete(id);
    }
    const targetPeerId = id === 'local' ? (this.socket ? this.socket.id : null) : id;
    if (targetPeerId) {
      const tile = document.querySelector(`.peer-tile[data-peer-id="${targetPeerId}"]`);
      if (tile) tile.classList.remove('speaking');
    }
  }

  startSpeakingLoop() {
    if (this.speakingLoopInterval) return;

    this.speakingLoopInterval = setInterval(() => {
      if (this.analysers.size === 0) {
        this.stopSpeakingLoop();
        return;
      }

      let anyRemoteSpeaking = false;

      this.analysers.forEach(({ analyser, dataArray }, id) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 14;
        const vuPercent = Math.min(100, Math.round((avg / 100) * 100));

        if (id !== 'local' && isSpeaking) {
          anyRemoteSpeaking = true;
        }

        const targetPeerId = id === 'local' ? (this.socket ? this.socket.id : null) : id;
        if (targetPeerId) {
          const tile = document.querySelector(`.peer-tile[data-peer-id="${targetPeerId}"]`);
          if (tile) {
            tile.classList.toggle('speaking', isSpeaking);
            const vuBar = tile.querySelector('.peer-vu-bar');
            if (vuBar) {
              vuBar.style.width = `${isSpeaking ? Math.max(15, vuPercent) : 0}%`;
            }
          }
          const navAvatar = document.querySelector(`.nav-mini-avatar[data-peer-id="${targetPeerId}"]`);
          if (navAvatar) {
            navAvatar.classList.toggle('speaking', isSpeaking);
          }
          const userItem = document.querySelector(`.user-item[data-user-id="${targetPeerId}"]`);
          if (userItem) {
            userItem.classList.toggle('speaking', isSpeaking);
          }
        }
      });

      if (typeof window.onRemotePeerSpeakingChange === 'function') {
        window.onRemotePeerSpeakingChange(anyRemoteSpeaking);
      }
    }, 100);
  }

  stopSpeakingLoop() {
    if (this.speakingLoopInterval) {
      clearInterval(this.speakingLoopInterval);
      this.speakingLoopInterval = null;
    }
    document.querySelectorAll('.peer-tile.speaking, .nav-mini-avatar.speaking, .user-item.speaking').forEach(t => t.classList.remove('speaking'));
    document.querySelectorAll('.peer-vu-bar').forEach(bar => { bar.style.width = '0%'; });
    if (typeof window.onRemotePeerSpeakingChange === 'function') {
      window.onRemotePeerSpeakingChange(false);
    }
  }

  setPeerVolume(peerId, volume) {
    const peerObj = this.peers.get(peerId);
    if (peerObj && peerObj.audioEl) {
      const vol = Math.max(0, Math.min(3, volume));
      if (window.volumeBooster) {
        window.volumeBooster.applyToElement(peerObj.audioEl, vol);
      } else {
        peerObj.audioEl.volume = Math.min(1, vol);
      }
      peerObj.audioEl.muted = vol <= 0;
    }
  }

  setAllPeersVolume(volume) {
    this.voiceVolume = Math.max(0, Math.min(3, volume));
    this.peers.forEach((peerObj) => {
      if (peerObj && peerObj.audioEl) {
        if (window.volumeBooster) {
          window.volumeBooster.applyToElement(peerObj.audioEl, this.voiceVolume);
        } else {
          peerObj.audioEl.volume = Math.min(1, this.voiceVolume);
        }
      }
    });
  }

  initUIControls() {
    this.btnToggleVoice = document.getElementById('btn-toggle-voice');
    this.btnToggleMic = document.getElementById('btn-toggle-mic');
    this.btnToggleCam = document.getElementById('btn-toggle-cam');
    this.btnShareScreen = document.getElementById('btn-screenshare-trigger');
    this.btnNavbarScreenshare = document.getElementById('btn-navbar-screenshare');
    this.btnHubScreenshare = document.getElementById('btn-trigger-screenshare-hub');
    this.voiceStatusText = document.getElementById('voice-status-text');

    if (this.btnToggleVoice) {
      this.btnToggleVoice.addEventListener('click', () => this.toggleVoiceConnection());
    }

    if (this.btnToggleMic) {
      this.btnToggleMic.addEventListener('click', () => this.toggleMic());
    }

    if (this.btnToggleCam) {
      this.btnToggleCam.addEventListener('click', () => this.toggleCamera());
    }

    if (this.btnShareScreen) {
      this.btnShareScreen.addEventListener('click', () => this.toggleScreenShare());
    }

    if (this.btnNavbarScreenshare) {
      this.btnNavbarScreenshare.addEventListener('click', () => this.toggleScreenShare());
    }

    if (this.btnHubScreenshare) {
      this.btnHubScreenshare.addEventListener('click', () => this.toggleScreenShare());
    }
  }

  updateScreenshareUI() {
    const isLive = this.isSharingScreen;

    // Navbar Screen Share Button
    if (this.btnNavbarScreenshare) {
      const textSpan = document.getElementById('navbar-screenshare-text') || this.btnNavbarScreenshare;
      if (isLive) {
        textSpan.textContent = 'STOP CASTING';
        this.btnNavbarScreenshare.className = 'btn btn-danger btn-sm';
        this.btnNavbarScreenshare.title = 'Click to stop broadcasting your screen';
      } else {
        textSpan.textContent = 'CAST SCREEN';
        this.btnNavbarScreenshare.className = 'btn btn-secondary btn-sm';
        this.btnNavbarScreenshare.title = 'Cast Netflix, Prime, Hotstar, or any tab with audio';
      }
    }

    // Sidebar Screen Share Trigger
    if (this.btnShareScreen) {
      if (isLive) {
        this.btnShareScreen.textContent = 'STOP CASTING';
        this.btnShareScreen.className = 'btn btn-danger btn-sm';
      } else {
        this.btnShareScreen.textContent = 'SHARE TAB WITH AUDIO';
        this.btnShareScreen.className = 'btn btn-secondary btn-sm';
      }
    }

    // Media Hub Screen Share Trigger
    if (this.btnHubScreenshare) {
      if (isLive) {
        this.btnHubScreenshare.textContent = 'STOP BROADCASTING TAB';
        this.btnHubScreenshare.className = 'btn btn-danger';
      } else {
        this.btnHubScreenshare.textContent = 'BROADCAST TAB WITH STEREO AUDIO';
        this.btnHubScreenshare.className = 'btn btn-primary';
      }
    }
  }

  async toggleVoiceConnection() {
    if (this.localStream) {
      // Disconnect
      this.leaveVoice();
      if (this.btnToggleVoice) {
        this.btnToggleVoice.textContent = 'Join Voice Chat';
        this.btnToggleVoice.className = 'btn btn-primary btn-sm';
      }
      if (this.voiceStatusText) this.voiceStatusText.textContent = 'Voice disconnected';
    } else {
      // Connect
      try {
        // Resume AudioContext on user gesture
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        this.localStream = stream;
        this.isMuted = false;
        this.attachAudioAnalyser('local', this.localStream);
        this.startSpeakingLoop();

        if (this.btnToggleVoice) {
          this.btnToggleVoice.textContent = 'Leave Voice';
          this.btnToggleVoice.className = 'btn btn-danger btn-sm';
        }
        if (this.btnToggleMic) {
          this.btnToggleMic.disabled = false;
          this.btnToggleMic.textContent = 'Mute Mic';
          this.btnToggleMic.className = 'btn btn-outline btn-sm';
        }
        if (this.btnToggleCam) this.btnToggleCam.disabled = false;
        if (this.voiceStatusText) this.voiceStatusText.textContent = 'Connected (Mic ON)';

        // Broadcast microphone tracks to existing and new peers
        await this.broadcastVoiceTracks();
        this.socket.emit('update-av-state', { isMuted: false, isCameraOn: this.isCameraOn });
        if (window.showToast) window.showToast('Connected to Voice Chat!', 'success');
      } catch (err) {
        console.error('Microphone access denied:', err);
        if (window.showToast) window.showToast('Microphone access was denied or unavailable.', 'error');
      }
    }
  }

  toggleMic() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      this.btnToggleMic.textContent = this.isMuted ? 'Unmute Mic' : 'Mute Mic';
      this.btnToggleMic.className = this.isMuted ? 'btn btn-secondary btn-sm' : 'btn btn-outline btn-sm';
      if (this.voiceStatusText) {
        this.voiceStatusText.textContent = this.isMuted ? 'Connected (Muted)' : 'Connected (Mic ON)';
      }
      this.socket.emit('update-av-state', { isMuted: this.isMuted, isCameraOn: this.isCameraOn });
    }
  }

  async toggleCamera() {
    if (!this.localStream) return;
    if (this.isCameraOn) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        this.localStream.removeTrack(videoTrack);
      }
      this.isCameraOn = false;
      this.btnToggleCam.textContent = 'Turn On Camera';
      this.updateLocalTile();
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        const videoTrack = videoStream.getVideoTracks()[0];
        this.localStream.addTrack(videoTrack);
        this.isCameraOn = true;
        this.btnToggleCam.textContent = 'Turn Off Camera';

        // Update senders for peers
        this.peers.forEach(({ pc }) => {
          pc.addTrack(videoTrack, this.localStream);
        });
        this.updateLocalTile();
      } catch (err) {
        console.error('Camera access error:', err);
        if (window.showToast) window.showToast('Could not access camera.', 'error');
      }
    }
  }

  /**
   * Screen & Tab Sharing
   * Captures 1080p 60fps video with high-fidelity stereo tab audio (Netflix, Prime, Hotstar, YouTube)
   */
  async toggleScreenShare() {
    if (this.isSharingScreen) {
      this.stopScreenShare();
      return;
    }

    try {
      // Prompt user with full stereo tab audio options
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'browser',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 }
        },
        audio: {
          echoCancellation: false,  // Do not filter out film background scores
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2           // Stereo audio
        },
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'include'
      });

      this.screenStream = stream;
      this.isSharingScreen = true;
      this.updateScreenshareUI();

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const tabTitle = videoTrack && videoTrack.label ? videoTrack.label : 'Browser Tab';

      // Auto-stop when user clicks Chrome native "Stop sharing" bar
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      // Display stream locally on host stage
      if (window.universalPlayer) {
        window.universalPlayer.setupScreenShare(this.screenStream, `CAST // ${tabTitle.toUpperCase()}`, 'You');
      }

      // Notify room server
      this.socket.emit('screenshare-start', {
        title: `CAST // ${tabTitle.toUpperCase()}`
      });

      // Broadcast screen tracks to all connected peers in room
      await this.broadcastScreenTracks();

      if (window.showToast) {
        const audioMsg = audioTrack
          ? 'Screen cast active with Stereo Tab Audio!'
          : 'Screen cast active (Note: Tab audio was not selected in browser prompt).';
        window.showToast(audioMsg, 'success', 4000);
      }
    } catch (err) {
      console.warn('Screen share canceled or denied:', err);
      this.isSharingScreen = false;
      this.updateScreenshareUI();
    }
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    this.isSharingScreen = false;
    this.updateScreenshareUI();

    // Notify server and peers
    this.socket.emit('screenshare-stop');

    if (window.universalPlayer && window.universalPlayer.activeType === 'screenshare') {
      window.universalPlayer.stopScreenShare();
    }

    if (window.showToast) {
      window.showToast('Screen cast stopped.', 'info', 2500);
    }
  }

  async broadcastScreenTracks() {
    if (!this.screenStream) return;

    // Ensure all peers in room are included
    document.querySelectorAll('.peer-tile').forEach(tile => {
      if (tile.dataset.peerId && tile.dataset.peerId !== this.socket.id) {
        this.knownPeerIds.add(tile.dataset.peerId);
      }
    });

    // Connect to all known peers who are in the room
    const targetPeerIds = Array.from(this.knownPeerIds).filter(id => id && id !== this.socket.id);

    for (const peerId of targetPeerIds) {
      try {
        let pc = this.peers.get(peerId)?.pc;
        if (!pc) {
          pc = this.createPeerConnection(peerId);
        }

        // Add screen tracks to peer connection
        this.screenStream.getTracks().forEach(track => {
          try {
            pc.addTrack(track, this.screenStream);
          } catch (e) {
            // Track may already be added
          }
        });

        // Renegotiate with offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('webrtc-signal', {
          targetId: peerId,
          signal: { type: 'offer', sdp: pc.localDescription },
          streamType: 'screenshare'
        });
      } catch (err) {
        console.error(`Failed to send screen tracks to peer ${peerId}:`, err);
      }
    }
  }

  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(this.rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-signal', {
          targetId: peerId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.handleRemoteStream(peerId, remoteStream, event.track);
    };

    // Attach local voice tracks if active
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try { pc.addTrack(track, this.localStream); } catch (_) {}
      });
    }

    // Attach screen stream if active
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        try { pc.addTrack(track, this.screenStream); } catch (_) {}
      });
    }

    const peerObj = { pc, stream: null, pendingCandidates: [], audioEl: null };
    this.peers.set(peerId, peerObj);
    return pc;
  }

  handleRemoteStream(peerId, stream, track) {
    const isScreenSharer = (this.activeScreenSharerId && this.activeScreenSharerId === peerId);

    // If it's a video track and either from the known screen sharer or player is expecting a screen share
    if (track.kind === 'video') {
      if (isScreenSharer || (window.universalPlayer && window.universalPlayer.activeType === 'screenshare')) {
        this.remoteScreenStream = stream;
        if (window.universalPlayer) {
          window.universalPlayer.setupScreenShare(
            stream,
            this.activeScreenShareTitle || 'Live Screen / Tab Share',
            this.activeScreenSharerName || 'Host'
          );
        }
        return;
      }
    }

    // If it's an audio track from the screen sharer, it's rendered through HTML5 video element via setupScreenShare
    if (track.kind === 'audio' && (isScreenSharer || (window.universalPlayer && window.universalPlayer.activeType === 'screenshare'))) {
      return;
    }

    // Voice Chat Microphone handling
    let peerObj = this.peers.get(peerId);
    if (!peerObj) {
      peerObj = { pc: null, stream: null, pendingCandidates: [], audioEl: null };
      this.peers.set(peerId, peerObj);
    }

    if (track.kind === 'audio') {
      if (!peerObj.audioEl) {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = stream;
        if (typeof this.voiceVolume === 'number') {
          audio.volume = this.voiceVolume;
        }
        peerObj.audioEl = audio;
        const p = audio.play();
        if (p !== undefined) {
          p.catch(err => {
            console.warn('[WebRTC] Autoplay waiting for user gesture to play peer audio:', peerId, err);
          });
        }
      } else if (peerObj.audioEl.srcObject !== stream) {
        peerObj.audioEl.srcObject = stream;
        peerObj.audioEl.play().catch(() => {});
      }
      this.attachAudioAnalyser(peerId, stream);
      this.startSpeakingLoop();
    }
  }

  async broadcastVoiceTracks() {
    if (!this.localStream) return;

    // 1. Add microphone tracks to all existing peer connections and renegotiate
    for (const [peerId, peerObj] of this.peers.entries()) {
      const pc = peerObj.pc;
      if (pc) {
        let trackAdded = false;
        this.localStream.getAudioTracks().forEach(track => {
          const senders = pc.getSenders();
          const exists = senders.some(s => s.track && s.track.id === track.id);
          if (!exists) {
            try {
              pc.addTrack(track, this.localStream);
              trackAdded = true;
            } catch(e) {}
          }
        });

        if (trackAdded) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.socket.emit('webrtc-signal', {
              targetId: peerId,
              signal: { type: 'offer', sdp: pc.localDescription },
              streamType: 'voice'
            });
          } catch (err) {
            console.error('Failed to renegotiate voice tracks with peer:', peerId, err);
          }
        }
      }
    }

    // 2. Initiate connection with any known peer who doesn't have an RTCPeerConnection yet
    this.knownPeerIds.forEach(async (peerId) => {
      if (peerId && peerId !== this.socket.id && !this.peers.has(peerId)) {
        await this.initiateCallTo(peerId);
      }
    });
  }

  async connectToAllPeers() {
    return this.broadcastVoiceTracks();
  }

  async initiateCallTo(peerId) {
    const pc = this.createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('webrtc-signal', {
        targetId: peerId,
        signal: { type: 'offer', sdp: pc.localDescription },
        streamType: this.isSharingScreen ? 'screenshare' : 'voice'
      });
    } catch (e) {
      console.error('Call initiation error to peer', peerId, e);
    }
  }

  initSocketSignaling() {
    // Track room participants
    this.socket.on('room-joined', (data) => {
      if (data.users && Array.isArray(data.users)) {
        data.users.forEach(u => this.knownPeerIds.add(u.id));
      }

      // Check if someone is already sharing their screen
      if (data.screenShare && data.screenShare.active) {
        this.activeScreenSharerId = data.screenShare.sharerId;
        this.activeScreenSharerName = data.screenShare.sharerName;
        this.activeScreenShareTitle = data.screenShare.title;

        if (data.screenShare.sharerId !== this.socket.id) {
          if (window.universalPlayer) {
            window.universalPlayer.showSpinner(`CONNECTING TO ${data.screenShare.sharerName.toUpperCase()}'S LIVE CAST...`);
          }
        }
      }
    });

    this.socket.on('user-joined', ({ user, users }) => {
      if (user && user.id) this.knownPeerIds.add(user.id);
      if (users && Array.isArray(users)) {
        users.forEach(u => this.knownPeerIds.add(u.id));
      }

      // If we are currently sharing screen, send the stream to newcomer immediately!
      if (this.isSharingScreen && this.screenStream && user && user.id !== this.socket.id) {
        this.initiateCallTo(user.id);
      } else if (this.localStream && user && user.id !== this.socket.id) {
        this.initiateCallTo(user.id);
      }
    });

    this.socket.on('user-left', ({ userId, users }) => {
      this.knownPeerIds.delete(userId);
      this.detachAudioAnalyser(userId);
      if (this.peers.has(userId)) {
        const { pc, audioEl } = this.peers.get(userId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
        }
        if (pc) pc.close();
        this.peers.delete(userId);
      }

      // If active screen sharer left
      if (this.activeScreenSharerId === userId) {
        this.activeScreenSharerId = null;
        this.remoteScreenStream = null;
        if (window.universalPlayer && window.universalPlayer.activeType === 'screenshare') {
          window.universalPlayer.stopScreenShare();
        }
        if (window.showToast) {
          window.showToast('Screen cast ended because the host left.', 'info');
        }
        this.updateScreenshareUI();
      }
    });

    // Remote Screen Share Start Announcement
    this.socket.on('screenshare-started', ({ active, sharerId, sharerName, title }) => {
      this.activeScreenSharerId = sharerId;
      this.activeScreenSharerName = sharerName;
      this.activeScreenShareTitle = title;

      if (sharerId !== this.socket.id) {
        if (window.showToast) {
          window.showToast(`${sharerName} started live Screen / Tab Cast!`, 'info', 4000);
        }
        if (window.universalPlayer) {
          window.universalPlayer.showSpinner(`CONNECTING TO ${sharerName.toUpperCase()}'S LIVE CAST...`);
        }
      }
      this.updateScreenshareUI();
    });

    // Remote Screen Share Stop Announcement
    this.socket.on('screenshare-stopped', ({ sharerName }) => {
      this.activeScreenSharerId = null;
      this.remoteScreenStream = null;

      if (window.universalPlayer && window.universalPlayer.activeType === 'screenshare') {
        window.universalPlayer.stopScreenShare();
      }
      if (window.showToast) {
        window.showToast(`Screen cast ended by ${sharerName || 'Host'}.`, 'info');
      }
      this.updateScreenshareUI();
    });

    this.socket.on('webrtc-peer-joined', ({ peerId }) => {
      this.knownPeerIds.add(peerId);
      if (this.isSharingScreen && this.screenStream) {
        this.initiateCallTo(peerId);
      } else if (this.localStream) {
        this.initiateCallTo(peerId);
      }
    });

    this.socket.on('webrtc-peer-left', ({ peerId }) => {
      this.knownPeerIds.delete(peerId);
      this.detachAudioAnalyser(peerId);
      if (this.peers.has(peerId)) {
        const { pc, audioEl } = this.peers.get(peerId);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
        }
        if (pc) pc.close();
        this.peers.delete(peerId);
      }
    });

    this.socket.on('webrtc-signal', async ({ fromId, signal }) => {
      this.knownPeerIds.add(fromId);
      let peerObj = this.peers.get(fromId);
      let pc = peerObj ? peerObj.pc : null;

      if (!pc) {
        pc = this.createPeerConnection(fromId);
        peerObj = this.peers.get(fromId);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain any queued ICE candidates that arrived before the remote description was set
          if (peerObj && peerObj.pendingCandidates && peerObj.pendingCandidates.length) {
            for (const cand of peerObj.pendingCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
              }
            }
            peerObj.pendingCandidates = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.socket.emit('webrtc-signal', {
            targetId: fromId,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain any queued ICE candidates
          if (peerObj && peerObj.pendingCandidates && peerObj.pendingCandidates.length) {
            for (const cand of peerObj.pendingCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
              }
            }
            peerObj.pendingCandidates = [];
          }
        } else if (signal.type === 'candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            if (!peerObj.pendingCandidates) peerObj.pendingCandidates = [];
            peerObj.pendingCandidates.push(signal.candidate);
          }
        }
      } catch (err) {
        console.error('WebRTC signal handling failed from peer', fromId, err);
      }
    });
  }

  updateLocalTile() {
    const localVideo = document.getElementById('local-video-preview');
    const localAvatar = document.getElementById('local-avatar-preview');
    if (this.isCameraOn && this.localStream) {
      if (localVideo) {
        localVideo.style.display = 'block';
        localVideo.srcObject = this.localStream;
      }
      if (localAvatar) localAvatar.style.display = 'none';
    } else {
      if (localVideo) {
        localVideo.style.display = 'none';
        localVideo.srcObject = null;
      }
      if (localAvatar) localAvatar.style.display = 'flex';
    }
  }

  leaveVoice() {
    this.detachAudioAnalyser('local');
    this.analysers.forEach((_, id) => this.detachAudioAnalyser(id));
    this.stopSpeakingLoop();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.socket) {
      this.socket.emit('update-av-state', { isMuted: true, isCameraOn: false });
    }

    // Remove voice audio senders from peer connections
    this.peers.forEach(({ pc }) => {
      if (pc) {
        pc.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'audio') {
            if (!this.screenStream || !this.screenStream.getAudioTracks().some(t => t.id === sender.track.id)) {
              try { pc.removeTrack(sender); } catch (_) {}
            }
          }
        });
      }
    });

    // Keep peer connections alive if screen sharing is active
    if (!this.isSharingScreen) {
      this.peers.forEach(({ pc, audioEl }) => {
        if (audioEl) audioEl.srcObject = null;
        if (pc) pc.close();
      });
      this.peers.clear();
    }
  }
}

window.WebRTCManager = WebRTCManager;
