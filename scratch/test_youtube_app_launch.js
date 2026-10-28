const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9236;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    } catch(e) { await sleep(200); }
  }
}

async function main() {
  const browser = spawn('/bin/brave-browser', [
    '--remote-debugging-port=' + PORT,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=412,915',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);
    let id = 1;
    function send(method, params={}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const onMsg = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', onMsg);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=yt_test' });
    await sleep(2500);

    console.log('Opening Apps modal...');
    await send('Runtime.evaluate', {
      expression: `
        const modal = document.getElementById('media-modal');
        if (modal) {
          modal.classList.add('active');
          modal.style.display = 'flex';
          if (window.showVaultView) window.showVaultView('apps');
        }
      `
    });
    await sleep(800);

    console.log('Clicking YouTube in Apps grid...');
    await send('Runtime.evaluate', {
      expression: `
        const ytItem = document.querySelector('.app-item[data-app="youtube"]');
        if (ytItem) ytItem.click();
      `
    });
    await sleep(4000);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/test_youtube_app_active.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved scratch/test_youtube_app_active.png');

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const container = document.getElementById('inbuilt-browser-container');
        const title = document.getElementById('browser-inapp-title');
        return {
          containerDisplay: container ? container.style.display : null,
          titleText: title ? title.textContent : null
        };
      })()`,
      returnByValue: true
    });
    console.log('YouTube check:', JSON.stringify(check.result.value, null, 2));
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
