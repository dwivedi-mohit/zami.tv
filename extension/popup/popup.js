/**
 * CineSync Extension Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const inputRoomId = document.getElementById('room-id');
  const inputUsername = document.getElementById('username');
  const inputServerUrl = document.getElementById('server-url');
  const btnJoin = document.getElementById('btn-join');
  const statusMsg = document.getElementById('status-msg');

  // Load saved options
  const data = await chrome.storage.local.get(['cinesync_room', 'cinesync_username', 'cinesync_server']);
  if (data.cinesync_room) inputRoomId.value = data.cinesync_room;
  if (data.cinesync_username) inputUsername.value = data.cinesync_username;
  if (data.cinesync_server) inputServerUrl.value = data.cinesync_server;

  btnJoin.addEventListener('click', async () => {
    const roomId = inputRoomId.value.trim() || 'party-movie-42';
    const username = inputUsername.value.trim() || 'Friend-' + Math.floor(100 + Math.random() * 900);
    const serverUrl = inputServerUrl.value.trim() || 'http://localhost:3000';

    // Save to storage
    await chrome.storage.local.set({
      cinesync_room: roomId,
      cinesync_username: username,
      cinesync_server: serverUrl
    });

    statusMsg.style.color = '#818cf8';
    statusMsg.textContent = 'Connecting to active tab...';

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.id) {
      statusMsg.style.color = '#ef4444';
      statusMsg.textContent = 'No active tab found.';
      return;
    }

    const supportedDomains = [
      'netflix.com',
      'primevideo.com',
      'amazon.com',
      'hotstar.com',
      'mxplayer.in',
      'crunchyroll.com',
      'youtube.com',
      'twitch.tv'
    ];

    const isTargetSite = activeTab.url && supportedDomains.some(d => activeTab.url.includes(d));

    if (!isTargetSite) {
      statusMsg.style.color = '#f59e0b';
      statusMsg.textContent = 'Open Netflix, Prime, Hotstar, MX Player, or Crunchyroll tab first!';
      return;
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'CONNECT_ROOM',
        roomId,
        username,
        serverUrl
      });
      statusMsg.style.color = '#10b981';
      statusMsg.textContent = 'Connected! Watch Party overlay is open.';
      setTimeout(() => window.close(), 1200);
    } catch (err) {
      statusMsg.style.color = '#f87171';
      statusMsg.textContent = 'Reload the streaming app tab and try again.';
    }
  });
});
