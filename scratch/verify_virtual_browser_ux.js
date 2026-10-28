const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9227;
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

    console.log('Loading room.html on mobile...');
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=ux_test' });
    await sleep(2500);

    // Call openInbuiltBrowser with Prime Video
    console.log('Triggering Prime Video in-app browser...');
    await send('Runtime.evaluate', {
      expression: `
        if (typeof window.openInbuiltBrowser === 'function') {
          window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video');
        }
      `
    });

    console.log('Waiting 5s for remote browser to stream initial frames...');
    await sleep(5000);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_inapp_webview_verified.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/mobile_inapp_webview_verified.png');

    // Click Paste link button
    console.log('Clicking Paste link button...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = document.getElementById('btn-browser-paste-link');
        if (btn) btn.click();
      `
    });
    await sleep(800);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_paste_dialog_verified.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/mobile_paste_dialog_verified.png');

    // Close paste dialog
    await send('Runtime.evaluate', {
      expression: `
        const dClose = document.getElementById('btn-paste-dialog-close');
        if (dClose) dClose.click();
      `
    });
    await sleep(500);

    // Click Close (✕) on browser
    console.log('Clicking browser close button (✕)...');
    await send('Runtime.evaluate', {
      expression: `
        const bClose = document.getElementById('btn-browser-close');
        if (bClose) bClose.click();
      `
    });
    await sleep(1000);

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_after_close_verified.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved scratch/mobile_after_close_verified.png');

    console.log('All verification screenshots captured successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
