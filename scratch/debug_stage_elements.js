const { spawn } = require('child_process');
const http = require('http');

const PORT = 9233;
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
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=debug_stage' });
    await sleep(2000);

    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video')`
    });
    await sleep(1000);

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const container = document.getElementById('inbuilt-browser-container');
        const header = document.getElementById('browser-inapp-header');
        const canvas = document.getElementById('remote-browser-canvas');
        const wrapper = document.querySelector('.player-wrapper');
        return {
          wrapper: wrapper ? {
            rect: wrapper.getBoundingClientRect(),
            className: wrapper.className,
            display: getComputedStyle(wrapper).display,
            height: getComputedStyle(wrapper).height
          } : null,
          container: container ? {
            rect: container.getBoundingClientRect(),
            styleDisplay: container.style.display,
            computedDisplay: getComputedStyle(container).display,
            zIndex: getComputedStyle(container).zIndex,
            height: getComputedStyle(container).height
          } : null,
          header: header ? {
            rect: header.getBoundingClientRect(),
            computedDisplay: getComputedStyle(header).display,
            height: getComputedStyle(header).height,
            color: getComputedStyle(header).color,
            bg: getComputedStyle(header).backgroundColor,
            zIndex: getComputedStyle(header).zIndex
          } : null,
          canvas: canvas ? {
            rect: canvas.getBoundingClientRect(),
            width: canvas.width,
            height: canvas.height,
            display: getComputedStyle(canvas).display
          } : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Stage elements debug:', JSON.stringify(check.result.value, null, 2));
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
