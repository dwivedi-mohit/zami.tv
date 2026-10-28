const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9232;
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
    '--window-size=390,844',
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
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });

    console.log('1. Loading room.html on mobile...');
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=final_mobile_test' });
    await sleep(2500);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_room_ready.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/mobile_room_ready.png');

    console.log('2. Opening Prime Video in-app browser on stage...');
    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video')`
    });
    await sleep(4000);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_browser_active.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/mobile_browser_active.png');

    console.log('3. Closing in-app browser...');
    await send('Runtime.evaluate', {
      expression: `
        const bClose = document.getElementById('btn-browser-close');
        if (bClose) bClose.click();
      `
    });
    await sleep(1000);

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_after_close.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved scratch/mobile_after_close.png');

    console.log('Final mobile tests completed successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
