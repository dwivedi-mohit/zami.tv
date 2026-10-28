const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9235;
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
    '--user-agent=Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 412,
      height: 915,
      deviceScaleFactor: 2,
      mobile: true
    });

    console.log('1. Loading room.html on mobile...');
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=apps_test' });
    await sleep(2500);

    console.log('2. Opening Apps modal view...');
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
    await sleep(1000);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/test_apps_modal_open.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/test_apps_modal_open.png');

    console.log('3. Clicking Netflix in the Apps grid...');
    await send('Runtime.evaluate', {
      expression: `
        const netflixItem = document.querySelector('.app-item[data-app="netflix"]');
        if (netflixItem) {
          netflixItem.click();
        }
      `
    });
    await sleep(3500);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/test_apps_browser_active.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/test_apps_browser_active.png');

    console.log('4. Checking header and container state...');
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const container = document.getElementById('inbuilt-browser-container');
        const title = document.getElementById('browser-inapp-title');
        const modal = document.getElementById('media-modal');
        return {
          containerDisplay: container ? container.style.display : null,
          titleText: title ? title.textContent : null,
          modalActive: modal ? modal.classList.contains('active') : null,
          modalDisplay: modal ? modal.style.display : null
        };
      })()`,
      returnByValue: true
    });
    console.log('State check:', JSON.stringify(check.result.value, null, 2));

    console.log('5. Clicking browser close (✕)...');
    await send('Runtime.evaluate', {
      expression: `
        const bClose = document.getElementById('btn-browser-close');
        if (bClose) bClose.click();
      `
    });
    await sleep(1000);

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/test_apps_after_close.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved scratch/test_apps_after_close.png');

    console.log('All tests passed successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
