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
    this.isInCall = true;

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

    this.toggleCam = this.toggleCamera.bind(this);

    this.initSocketSignaling();
    this.initUIControls();
    this.updateDockAVButtons();

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

  updateDockAVButtons() {
    const dockMic = document.getElementById('btn-dock-mic');
    const desktopMic = document.getElementById('btn-desktop-mic');
    const dockCam = document.getElementById('btn-dock-cam');
    const desktopCam = document.getElementById('btn-desktop-cam');

    [dockMic, desktopMic].forEach(btn => {
      if (!btn) return;
      btn.classList.toggle('active', !this.isMuted);
      btn.classList.toggle('is-muted', this.isMuted);
    });

    [dockCam, desktopCam].forEach(btn => {
      if (!btn) return;
      btn.classList.toggle('active', this.isCameraOn);
      btn.classList.toggle('is-muted', !this.isCameraOn);
    });
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

  autoJoinOnRoomEntry() {
    this.isInCall = true;
    this.updateInCallUI(true);

    // Immediately initiate WebRTC connections to existing peers so we receive their video/audio
    if (this.knownPeerIds) {
      this.knownPeerIds.forEach((peerId) => {
        if (peerId && peerId !== this.socket.id && !this.peers.has(peerId)) {
          this.initiateCallTo(peerId);
        }
      });
    }
  }

  updateInCallUI(inCall) {
    this.isInCall = inCall;
    const dot = document.getElementById('gmeet-status-dot');
    if (dot) {
      dot.classList.toggle('online', inCall);
      dot.classList.toggle('paused', !inCall);
    }
    if (this.voiceStatusText) {
      if (inCall) {
        this.voiceStatusText.textContent = this.isMuted ? 'In call · Muted' : 'In call · Mic ON';
      } else {
        this.voiceStatusText.textContent = 'Call paused';
      }
    }
    if (this.btnToggleVoice) {
      this.btnToggleVoice.classList.toggle('in-call', inCall);
      this.btnToggleVoice.classList.toggle('gmeet-btn-leave', inCall);
      this.btnToggleVoice.classList.toggle('gmeet-btn-join', !inCall);
      this.btnToggleVoice.title = inCall ? 'Leave call' : 'Rejoin call';
      const joinIcon = this.btnToggleVoice.querySelector('.gmeet-icon-join');
      const leaveIcon = this.btnToggleVoice.querySelector('.gmeet-icon-leave');
      const callText = this.btnToggleVoice.querySelector('.gmeet-call-text');
      if (joinIcon) joinIcon.style.display = inCall ? 'none' : 'inline-block';
      if (leaveIcon) leaveIcon.style.display = inCall ? 'inline-block' : 'none';
      if (callText) callText.textContent = inCall ? 'Leave call' : 'Rejoin call';
    }
    if (this.btnToggleMic) {
      this.btnToggleMic.disabled = !inCall;
    }
    if (this.btnToggleCam) {
      this.btnToggleCam.disabled = !inCall;
    }
  }

  async toggleVoiceConnection() {
    if (this.isInCall) {
      // User clicked Leave Call (Hangup)
      this.leaveVoice();
      this.isInCall = false;
      this.updateInCallUI(false);
      if (window.showToast) window.showToast('You left the call. Click Rejoin to join again.', 'info', 2500);
    } else {
      // User clicked Rejoin Call
      this.autoJoinOnRoomEntry();
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (window.showToast) window.showToast('Rejoined call!', 'success', 2000);
    }
  }

  async toggleMic() {
    if (!this.isInCall) {
      this.autoJoinOnRoomEntry();
    }

    const existingTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
    if (!existingTrack) {
      // Prompt microphone permission on demand
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        const audioTrack = stream.getAudioTracks()[0];
        if (!this.localStream) {
          this.localStream = new MediaStream();
        }
        this.localStream.addTrack(audioTrack);
        this.isMuted = false;
        this.updateDockAVButtons();

        this.attachAudioAnalyser('local', this.localStream);
        this.startSpeakingLoop();

        if (this.btnToggleMic) {
          this.btnToggleMic.classList.remove('is-muted');
          this.btnToggleMic.classList.add('is-active');
          const micOn = this.btnToggleMic.querySelector('.gmeet-icon-mic-on');
          const micOff = this.btnToggleMic.querySelector('.gmeet-icon-mic-off');
          if (micOn) micOn.style.display = 'inline-block';
          if (micOff) micOff.style.display = 'none';
        }
        if (this.voiceStatusText) this.voiceStatusText.textContent = 'In call · Mic ON';

        await this.broadcastVoiceTracks();
        this.socket.emit('update-av-state', { isMuted: false, isCameraOn: this.isCameraOn });
        if (window.showToast) window.showToast('Microphone ON', 'info', 2000);
      } catch (err) {
        console.error('Microphone access denied:', err);
        if (window.showToast) window.showToast('Microphone access denied: ' + (err.message || 'Permission denied'), 'error');
      }
      return;
    }

    // Audio track already exists: toggle mute
    existingTrack.enabled = !existingTrack.enabled;
    this.isMuted = !existingTrack.enabled;
    this.updateDockAVButtons();
    if (this.btnToggleMic) {
      this.btnToggleMic.classList.toggle('is-muted', this.isMuted);
      this.btnToggleMic.classList.toggle('is-active', !this.isMuted);
      const micOn = this.btnToggleMic.querySelector('.gmeet-icon-mic-on');
      const micOff = this.btnToggleMic.querySelector('.gmeet-icon-mic-off');
      if (micOn) micOn.style.display = this.isMuted ? 'none' : 'inline-block';
      if (micOff) micOff.style.display = this.isMuted ? 'inline-block' : 'none';
    }
    if (this.voiceStatusText) {
      this.voiceStatusText.textContent = this.isMuted ? 'In call · Muted' : 'In call · Mic ON';
    }
    this.socket.emit('update-av-state', { isMuted: this.isMuted, isCameraOn: this.isCameraOn });
  }

  async toggleCamera() {
    if (!this.isInCall) {
      this.autoJoinOnRoomEntry();
    }

    if (this.isCameraOn) {
      // Turn camera off
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          this.localStream.removeTrack(videoTrack);
        }
      }
      this.isCameraOn = false;
      this.updateDockAVButtons();
      if (this.btnToggleCam) {
        this.btnToggleCam.classList.remove('is-active');
        this.btnToggleCam.classList.add('is-muted');
        const camOn = this.btnToggleCam.querySelector('.gmeet-icon-cam-on');
        const camOff = this.btnToggleCam.querySelector('.gmeet-icon-cam-off');
        if (camOn) camOn.style.display = 'none';
        if (camOff) camOff.style.display = 'inline-block';
      }
      this.updateLocalTile();

      // Remove video track from peers
      this.peers.forEach(({ pc }) => {
        if (pc) {
          pc.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'video') {
              try { pc.removeTrack(sender); } catch (_) {}
            }
          });
        }
      });
      this.socket.emit('update-av-state', { isMuted: this.isMuted, isCameraOn: false });
      if (window.showToast) window.showToast('Camera turned off', 'info', 2000);
    } else {
      // Turn camera on
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!this.localStream) {
          this.localStream = new MediaStream();
        }
        this.localStream.addTrack(videoTrack);
        this.isCameraOn = true;
        this.updateDockAVButtons();

        if (this.btnToggleCam) {
          this.btnToggleCam.classList.add('is-active');
          this.btnToggleCam.classList.remove('is-muted');
          const camOn = this.btnToggleCam.querySelector('.gmeet-icon-cam-on');
          const camOff = this.btnToggleCam.querySelector('.gmeet-icon-cam-off');
          if (camOn) camOn.style.display = 'inline-block';
          if (camOff) camOff.style.display = 'none';
        }

        this.updateLocalTile();

        // Broadcast camera track to all peers
        for (const [peerId, peerObj] of this.peers.entries()) {
          const pc = peerObj.pc;
          if (pc) {
            try {
              const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video') ||
                                  pc.getSenders().find(s => !s.track && s.kind === 'video');
              if (videoSender && typeof videoSender.replaceTrack === 'function') {
                await videoSender.replaceTrack(videoTrack);
              } else {
                pc.addTrack(videoTrack, this.localStream);
              }
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              this.socket.emit('webrtc-signal', {
                targetId: peerId,
                signal: { type: 'offer', sdp: pc.localDescription },
                streamType: 'camera'
              });
            } catch (e) {
              console.warn('Renegotiate camera track error for peer', peerId, e);
            }
          }
        }

        this.socket.emit('update-av-state', { isMuted: this.isMuted, isCameraOn: true });
        if (window.showToast) window.showToast('Camera turned on', 'info', 2000);
      } catch (err) {
        console.error('Camera access error:', err);
        if (window.showToast) window.showToast('Could not access camera: ' + (err.message || 'Permission denied'), 'error');
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

    // Add audio and video transceivers with direction 'sendrecv' so SDP negotiates both media channels immediately
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch (e) {
      // Fallback for older WebRTC engines
    }

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

    const peerObj = { pc, stream: null, pendingCandidates: [], audioEl: null, videoStream: null };
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

      // Camera video track from remote peer in Google Meet grid
      let peerObj = this.peers.get(peerId);
      if (!peerObj) {
        peerObj = { pc: null, stream: null, pendingCandidates: [], audioEl: null, videoStream: null };
        this.peers.set(peerId, peerObj);
      }
      peerObj.videoStream = stream;

      const peerTile = document.querySelector(`.peer-tile[data-peer-id="${peerId}"]`);
      if (peerTile) {
        const video = peerTile.querySelector('.peer-video');
        const avatar = peerTile.querySelector('.peer-avatar');
        if (video) {
          video.srcObject = stream;
          video.style.display = 'block';
          video.play().catch(() => {});
        }
        if (avatar) avatar.style.display = 'none';
      }

      track.onended = () => {
        const pTile = document.querySelector(`.peer-tile[data-peer-id="${peerId}"]`);
        if (pTile) {
          const v = pTile.querySelector('.peer-video');
          const a = pTile.querySelector('.peer-avatar');
          if (v) {
            v.style.display = 'none';
            v.srcObject = null;
          }
          if (a) a.style.display = 'flex';
        }
      };
      return;
    }

    // If it's an audio track from the screen sharer, it's rendered through HTML5 video element via setupScreenShare
    if (track.kind === 'audio' && (isScreenSharer || (window.universalPlayer && window.universalPlayer.activeType === 'screenshare'))) {
      return;
    }

    // Voice Chat Microphone handling
    let peerObj = this.peers.get(peerId);
    if (!peerObj) {
      peerObj = { pc: null, stream: null, pendingCandidates: [], audioEl: null, videoStream: null };
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
      } else if (this.isInCall && user && user.id !== this.socket.id) {
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
      } else if (this.isInCall) {
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
    let localTile = document.querySelector('.peer-tile[data-is-me="true"]');
    if (!localTile && this.socket) {
      localTile = document.querySelector(`.peer-tile[data-peer-id="${this.socket.id}"]`);
    }
    if (!localTile && window.currentUser) {
      localTile = document.querySelector(`.peer-tile[data-peer-id="${window.currentUser.id}"]`);
    }

    if (localTile) {
      const localVideo = localTile.querySelector('.peer-video');
      const localAvatar = localTile.querySelector('.peer-avatar');
      if (this.isCameraOn && this.localStream && this.localStream.getVideoTracks().length > 0) {
        if (localVideo) {
          localVideo.srcObject = this.localStream;
          localVideo.style.display = 'block';
          localVideo.play().catch(() => {});
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

    // Also support any floating preview elements if present
    const legacyVideo = document.getElementById('local-video-preview');
    const legacyAvatar = document.getElementById('local-avatar-preview');
    if (legacyVideo) {
      if (this.isCameraOn && this.localStream) {
        legacyVideo.style.display = 'block';
        legacyVideo.srcObject = this.localStream;
      } else {
        legacyVideo.style.display = 'none';
        legacyVideo.srcObject = null;
      }
    }
    if (legacyAvatar) {
      legacyAvatar.style.display = this.isCameraOn ? 'none' : 'flex';
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
    this.isMuted = true;
    this.isCameraOn = false;
    this.updateDockAVButtons();

    if (this.btnToggleMic) {
      this.btnToggleMic.classList.add('is-muted');
      this.btnToggleMic.classList.remove('is-active');
      const micOn = this.btnToggleMic.querySelector('.gmeet-icon-mic-on');
      const micOff = this.btnToggleMic.querySelector('.gmeet-icon-mic-off');
      if (micOn) micOn.style.display = 'none';
      if (micOff) micOff.style.display = 'inline-block';
    }
    if (this.btnToggleCam) {
      this.btnToggleCam.classList.add('is-muted');
      this.btnToggleCam.classList.remove('is-active');
      const camOn = this.btnToggleCam.querySelector('.gmeet-icon-cam-on');
      const camOff = this.btnToggleCam.querySelector('.gmeet-icon-cam-off');
      if (camOn) camOn.style.display = 'none';
      if (camOff) camOff.style.display = 'inline-block';
    }
    this.updateLocalTile();

    if (this.socket) {
      this.socket.emit('update-av-state', { isMuted: true, isCameraOn: false });
    }

    // Remove voice audio and video senders from peer connections
    this.peers.forEach(({ pc }) => {
      if (pc) {
        pc.getSenders().forEach(sender => {
          if (sender.track && (sender.track.kind === 'audio' || sender.track.kind === 'video')) {
            if (!this.screenStream || !this.screenStream.getTracks().some(t => t.id === sender.track.id)) {
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
