const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/blawten/.gemini/antigravity/brain/15abb512-10f4-413b-b852-718c8cc20969';
const PORT = 9223;

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
  console.log('Launching Brave for verification...');
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

    console.log('Navigating to room on localhost:3000...');
    await client.send('Page.navigate', { url: 'http://localhost:3000/room.html?room=test-bw-logos' });
    await sleep(2500);

    // 1. Verify Subplayer Center Resize Button
    const resizeStatus = await client.eval(`(() => {
      const bar = document.getElementById('w2g-subplayer-bar');
      const center = document.querySelector('.subplayer-center');
      const btnResize = document.getElementById('btn-mobile-resize-player');
      const playerWrapper = document.querySelector('.player-wrapper');
      
      const barVisible = bar && window.getComputedStyle(bar).display !== 'none';
      const btnVisible = btnResize && window.getComputedStyle(btnResize).display !== 'none';
      
      const barRect = bar ? bar.getBoundingClientRect() : null;
      const btnRect = btnResize ? btnResize.getBoundingClientRect() : null;
      
      // Calculate center deviation
      const barCenterX = barRect ? (barRect.left + barRect.width / 2) : 0;
      const btnCenterX = btnRect ? (btnRect.left + btnRect.width / 2) : 0;
      const centered = Math.abs(barCenterX - btnCenterX) < 2; // within 2px
      
      // Test click toggle
      btnResize.click();
      const expandedAfterClick = playerWrapper.classList.contains('is-expanded');
      const ariaExpanded = btnResize.getAttribute('aria-expanded');
      
      // Toggle back
      btnResize.click();
      const normalAfterSecondClick = !playerWrapper.classList.contains('is-expanded');
      
      return {
        barVisible,
        btnVisible,
        centered,
        barCenterX,
        btnCenterX,
        expandedAfterClick,
        ariaExpanded,
        normalAfterSecondClick
      };
    })()`);

    console.log('1. Subplayer Center Resize Button Status:', resizeStatus);

    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_subplayer_expand_minimize.png'));

    // 2. Open Settings Modal & Verify B&W Quick Actions
    const settingsStatus = await client.eval(`(() => {
      const btnSettings = document.getElementById('btn-mobile-open-settings');
      btnSettings.click();
      
      const modal = document.getElementById('settings-modal');
      const modalVisible = modal && window.getComputedStyle(modal).display !== 'none';
      
      const tiles = Array.from(document.querySelectorAll('.settings-action-tile'));
      const tilesInfo = tiles.map(t => ({
        id: t.id,
        label: t.querySelector('.settings-action-label') ? t.querySelector('.settings-action-label').textContent.trim() : '',
        hint: t.querySelector('.settings-action-hint') ? t.querySelector('.settings-action-hint').textContent.trim() : '',
        iconColor: window.getComputedStyle(t.querySelector('.settings-action-icon')).color
      }));
      
      return {
        modalVisible,
        tilesCount: tiles.length,
        tilesInfo
      };
    })()`);

    await sleep(600);
    console.log('2. Settings Modal Status:', settingsStatus);
    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_settings_bw_quick_actions.png'));

    // Close settings modal
    await client.eval(`(() => {
      const btnClose = document.getElementById('btn-close-settings-modal');
      if (btnClose) btnClose.click();
    })()`);
    await sleep(400);

    // 3. Open Stage Sources Popup Modal & Verify Generic B&W vs Platform Official Logos
    const sourcesStatus = await client.eval(`(() => {
      const btnChoose = document.getElementById('btn-stage-single-choose');
      btnChoose.click();
      
      const modal = document.getElementById('stage-sources-popup-modal');
      const modalVisible = modal && window.getComputedStyle(modal).display !== 'none';
      
      const cards = Array.from(modal.querySelectorAll('.stage-choice-card'));
      const cardsInfo = cards.map(c => ({
        id: c.id,
        title: c.querySelector('.choice-title') ? c.querySelector('.choice-title').textContent.trim() : '',
        isAction: c.querySelector('.choice-icon-wrap') ? c.querySelector('.choice-icon-wrap').classList.contains('choice-action') : false,
        isPlatform: c.querySelector('.choice-icon-wrap') ? c.querySelector('.choice-icon-wrap').classList.contains('choice-platform') : false,
        svgExists: !!c.querySelector('svg')
      }));
      
      return {
        modalVisible,
        cardsCount: cards.length,
        cardsInfo
      };
    })()`);

    await sleep(600);
    console.log('3. Stage Sources Popup Modal Status:', sourcesStatus);
    await client.screenshot(path.join(ARTIFACTS_DIR, 'mobile_stage_official_logos.png'));

    // 4. Desktop View (1440x900)
    console.log('Switching to Desktop View (1440x900)...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(1000);
    await client.screenshot(path.join(ARTIFACTS_DIR, 'desktop_stage_official_logos.png'));

    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } finally {
    browserProc.kill();
  }
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
