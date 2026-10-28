const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9255;
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
    '--window-size=1280,800',
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

    console.log('1. Loading room on desktop (1280x800)...');
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=desktop_typing_test' });
    await sleep(2500);

    console.log('2. Opening Netflix in-app browser on stage...');
    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Netflix');`
    });
    await sleep(4000);

    const uiCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btnType = document.getElementById('btn-browser-type');
        const btnPaste = document.getElementById('btn-browser-paste-link');
        return {
          hasBtnType: !!btnType,
          btnTypeVisible: btnType ? window.getComputedStyle(btnType).display !== 'none' : false,
          hasBtnPaste: !!btnPaste
        };
      })()`,
      returnByValue: true
    });
    console.log('Desktop UI Check:', uiCheck.result.value);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/desktop_browser_with_type_btn.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/desktop_browser_with_type_btn.png');

    console.log('3. Clicking "Type" button...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-browser-type').click();`
    });
    await sleep(500);

    const dialogCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const dialog = document.getElementById('browser-type-dialog');
        return {
          isOpen: dialog ? dialog.open : false
        };
      })()`,
      returnByValue: true
    });
    console.log('Desktop Dialog Check:', dialogCheck.result.value);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/desktop_type_dialog_open.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/desktop_type_dialog_open.png');

    console.log('Desktop verification completed successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
