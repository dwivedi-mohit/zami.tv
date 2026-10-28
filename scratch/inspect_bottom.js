const { spawn } = require('child_process');
const http = require('http');

const PORT = 9228;
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
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=ux_test' });
    await sleep(2000);

    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video')`
    });
    await sleep(1000);

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const els = document.elementsFromPoint(206, 900);
        return els.map(el => ({ tag: el.tagName, id: el.id, className: el.className }));
      })()`,
      returnByValue: true
    });
    console.log('Elements at bottom:', JSON.stringify(check.result.value, null, 2));
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
