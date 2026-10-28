const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9240;
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
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

    console.log('1. Loading room on mobile (412x915)...');
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=expand_screen_test' });
    await sleep(2500);

    const initialStage = await send('Runtime.evaluate', {
      expression: `(() => {
        const wrapper = document.querySelector('.player-wrapper');
        const btn = document.getElementById('btn-mobile-resize-player');
        return {
          wrapperHeight: wrapper ? wrapper.getBoundingClientRect().height : 0,
          isExpanded: wrapper ? wrapper.classList.contains('is-expanded') : false,
          btnExpanded: btn ? btn.getAttribute('aria-expanded') : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Initial stage state:', initialStage.result.value);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/stage_unexpanded.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/stage_unexpanded.png');

    console.log('2. Clicking expand button...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-mobile-resize-player').click();`
    });
    await sleep(600);

    const expandedStage = await send('Runtime.evaluate', {
      expression: `(() => {
        const wrapper = document.querySelector('.player-wrapper');
        const btn = document.getElementById('btn-mobile-resize-player');
        return {
          wrapperHeight: wrapper ? wrapper.getBoundingClientRect().height : 0,
          isExpanded: wrapper ? wrapper.classList.contains('is-expanded') : false,
          btnExpanded: btn ? btn.getAttribute('aria-expanded') : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Expanded stage state:', expandedStage.result.value);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/stage_expanded.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/stage_expanded.png');

    console.log('3. Opening Prime Video in-app browser on stage...');
    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video');`
    });
    await sleep(4000);

    const browserExpanded = await send('Runtime.evaluate', {
      expression: `(() => {
        const wrapper = document.querySelector('.player-wrapper');
        const container = document.getElementById('inbuilt-browser-container');
        return {
          wrapperHeight: wrapper ? wrapper.getBoundingClientRect().height : 0,
          containerHeight: container ? container.getBoundingClientRect().height : 0,
          isExpanded: wrapper ? wrapper.classList.contains('is-expanded') : false
        };
      })()`,
      returnByValue: true
    });
    console.log('Browser in expanded stage:', browserExpanded.result.value);

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/browser_stage_expanded.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved scratch/browser_stage_expanded.png');

    console.log('4. Clicking minimize button to shrink back...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-mobile-resize-player').click();`
    });
    await sleep(600);

    const browserMinimized = await send('Runtime.evaluate', {
      expression: `(() => {
        const wrapper = document.querySelector('.player-wrapper');
        const container = document.getElementById('inbuilt-browser-container');
        return {
          wrapperHeight: wrapper ? wrapper.getBoundingClientRect().height : 0,
          containerHeight: container ? container.getBoundingClientRect().height : 0,
          isExpanded: wrapper ? wrapper.classList.contains('is-expanded') : false
        };
      })()`,
      returnByValue: true
    });
    console.log('Browser in minimized stage:', browserMinimized.result.value);

    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/browser_stage_minimized.png', Buffer.from(shot4.data, 'base64'));
    console.log('Saved scratch/browser_stage_minimized.png');

    console.log('All expand button verification tests completed successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
