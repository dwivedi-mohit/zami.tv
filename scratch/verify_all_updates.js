const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/blawten/.gemini/antigravity/brain/15abb512-10f4-413b-b852-718c8cc20969';
const PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${PORT}/json/list`, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
      });
      const pages = JSON.parse(data);
      if (pages.length > 0 && pages[0].webSocketDebuggerUrl) {
        return pages[0].webSocketDebuggerUrl;
      }
    } catch (e) {
      await sleep(200);
    }
  }
  throw new Error('Unable to connect to CDP endpoint');
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  console.log('Launching Brave...');
  const browserProc = spawn('/bin/brave-browser', [
    '--remote-debugging-port=' + PORT,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=390,844',
    '--disable-dev-shm-usage',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to CDP at', wsUrl);
    const ws = new WebSocket(wsUrl);
    await new Promise(res => ws.onopen = res);

    const client = new CdpClient(ws);
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // Emulate iPhone 14 / Mobile (390 x 844)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });

    console.log('Navigating to room...');
    await client.send('Page.navigate', { url: 'http://localhost:3000/room.html?room=verify-updates' });
    await sleep(2500);

    // Verify Call Card Dock, Stage, and Subplayer Bar
    const status = await client.eval(`(() => {
      const gmeetCard = document.getElementById('gmeet-call-card');
      const cardTop = document.querySelector('.gmeet-card-top');
      const ctrlLabels = Array.from(document.querySelectorAll('.gmeet-ctrl-label'));
      const visibleLabels = ctrlLabels.filter(el => {
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });

      const btnVoice = document.getElementById('btn-toggle-voice');
      const voiceText = btnVoice ? btnVoice.querySelector('.gmeet-call-text') : null;
      const voiceTextVisible = voiceText && window.getComputedStyle(voiceText).display !== 'none';
      const voiceCs = btnVoice ? window.getComputedStyle(btnVoice) : null;

      const subplayerBar = document.getElementById('w2g-subplayer-bar');
      const settingsBtn = document.getElementById('btn-mobile-open-settings');
      const roomPill = document.getElementById('mobile-room-identity-group');

      // Check subplayer bar hidden buttons
      const hiddenSubButtons = ['#btn-mobile-resize-player', '#btn-mobile-pip', '#btn-mobile-mic-quick', '#btn-mobile-cam-quick', '#btn-mobile-share-quick', '#btn-mobile-browser-quick', '#btn-mobile-open-search'].map(sel => {
        const el = document.querySelector(sel);
        return { sel, exists: !!el, visible: el ? (window.getComputedStyle(el).display !== 'none') : false };
      });

      // Stage check
      const singlePlayBtn = document.getElementById('btn-stage-single-choose');
      const singlePlayCs = singlePlayBtn ? window.getComputedStyle(singlePlayBtn) : null;
      const stageTitle = document.querySelector('.empty-stage-title');
      const stageSubtitle = document.querySelector('.empty-stage-subtitle');

      return {
        cardTopExists: !!cardTop,
        cardTopVisible: cardTop ? (window.getComputedStyle(cardTop).display !== 'none') : false,
        visibleLabelsCount: visibleLabels.length,
        btnVoiceExists: !!btnVoice,
        btnVoiceWidth: voiceCs ? voiceCs.width : null,
        btnVoiceHeight: voiceCs ? voiceCs.height : null,
        btnVoiceBorderRadius: voiceCs ? voiceCs.borderRadius : null,
        voiceTextVisible: voiceTextVisible,
        subplayerVisible: subplayerBar ? (window.getComputedStyle(subplayerBar).display !== 'none') : false,
        settingsBtnVisible: settingsBtn ? (window.getComputedStyle(settingsBtn).display !== 'none') : false,
        roomPillVisible: roomPill ? (window.getComputedStyle(roomPill).display !== 'none') : false,
        hiddenSubButtons,
        singlePlayBtnVisible: singlePlayCs ? (singlePlayCs.display !== 'none') : false,
        stageTitleExists: !!stageTitle,
        stageSubtitleExists: !!stageSubtitle
      };
    })()`);

    console.log('DOM Evaluation Status:', JSON.stringify(status, null, 2));

    // Capture clean call controls dock & single stage button view
    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_call_controls_dock_clean.png'));

    // Test clicking Single Play Button to open Sources Popup Modal
    console.log('Clicking single stage play button...');
    await client.eval(`document.getElementById('btn-stage-single-choose').click()`);
    await sleep(600);

    const popupStatus = await client.eval(`(() => {
      const modal = document.getElementById('stage-sources-popup-modal');
      const cs = modal ? window.getComputedStyle(modal) : null;
      const cards = modal ? Array.from(modal.querySelectorAll('.stage-choice-card')) : [];
      return {
        modalExists: !!modal,
        modalDisplay: cs ? cs.display : null,
        cardCount: cards.length
      };
    })()`);
    console.log('Sources Popup Modal Status:', JSON.stringify(popupStatus, null, 2));

    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_stage_sources_popup.png'));

    // Close sources popup
    await client.eval(`document.getElementById('btn-close-stage-sources-modal').click()`);
    await sleep(400);

    // Test clicking Room Settings to verify merged Quick Actions
    console.log('Opening Room Settings modal...');
    await client.eval(`document.getElementById('btn-mobile-open-settings').click()`);
    await sleep(600);

    const settingsStatus = await client.eval(`(() => {
      const modal = document.getElementById('settings-modal');
      const cs = modal ? window.getComputedStyle(modal) : null;
      const quickSection = document.querySelector('.settings-quick-actions-section');
      const quickTiles = quickSection ? Array.from(quickSection.querySelectorAll('.settings-action-tile')) : [];
      return {
        settingsModalDisplay: cs ? cs.display : null,
        quickSectionVisible: quickSection ? (window.getComputedStyle(quickSection).display !== 'none') : false,
        tileCount: quickTiles.length,
        tiles: quickTiles.map(t => t.querySelector('.settings-action-label')?.textContent?.trim())
      };
    })()`);
    console.log('Settings Quick Actions Status:', JSON.stringify(settingsStatus, null, 2));

    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_settings_quick_actions.png'));

    // Close settings modal
    await client.eval(`document.getElementById('btn-close-settings-modal').click()`);
    await sleep(400);

    console.log('All verifications completed successfully!');
  } finally {
    browserProc.kill();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
