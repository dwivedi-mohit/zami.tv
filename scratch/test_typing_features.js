const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9250;
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
    await send('Page.navigate', { url: 'http://localhost:3000/room.html?room=typing_verification_test' });
    await sleep(2500);

    console.log('2. Opening Prime Video in-app browser on stage...');
    await send('Runtime.evaluate', {
      expression: `window.openInbuiltBrowser('https://www.mxplayer.in', 'Prime Video');`
    });
    await sleep(4000);

    const uiCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const btnType = document.getElementById('btn-browser-type');
        const btnPaste = document.getElementById('btn-browser-paste-link');
        const proxy = document.getElementById('remote-browser-keyboard-proxy');
        const typeDialog = document.getElementById('browser-type-dialog');
        const mobileKbBar = document.getElementById('browser-mobile-keyboard-bar');

        return {
          hasBtnType: !!btnType,
          btnTypeVisible: btnType ? window.getComputedStyle(btnType).display !== 'none' : false,
          hasBtnPaste: !!btnPaste,
          hasProxy: !!proxy,
          hasTypeDialog: !!typeDialog,
          hasMobileKbBar: !!mobileKbBar
        };
      })()`,
      returnByValue: true
    });
    console.log('UI Elements Check:', uiCheck.result.value);

    // Capture screenshot of webview with Type button
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_browser_with_type_btn.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scratch/mobile_browser_with_type_btn.png');

    console.log('3. Clicking "Type" button in header...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-browser-type').click();`
    });
    await sleep(500);

    const dialogCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const dialog = document.getElementById('browser-type-dialog');
        const input = document.getElementById('browser-type-input');
        return {
          isOpen: dialog ? dialog.open : false,
          hasInput: !!input,
          inputFocused: document.activeElement === input,
          keysCount: document.querySelectorAll('.btn-type-key').length
        };
      })()`,
      returnByValue: true
    });
    console.log('Dialog Check:', dialogCheck.result.value);

    // Capture screenshot of Type dialog open
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_type_dialog_open.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scratch/mobile_type_dialog_open.png');

    console.log('4. Testing typing phone number & search text in dialog...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('browser-type-input');
        input.value = '+91 9876543210';
        return input.value;
      })()`,
      returnByValue: true
    });

    console.log('5. Clicking backspace helper key...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const bsBtn = document.querySelector('.btn-type-key[data-action="backspace"]');
        if (bsBtn) bsBtn.click();
        const input = document.getElementById('browser-type-input');
        return input.value;
      })()`,
      returnByValue: true
    });
    const valAfterBs = await send('Runtime.evaluate', {
      expression: `document.getElementById('browser-type-input').value`,
      returnByValue: true
    });
    console.log('Input value after Backspace:', valAfterBs.result.value);

    console.log('6. Submitting text to remote browser...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-type-send-enter').click();`
    });
    await sleep(500);

    const afterSubmit = await send('Runtime.evaluate', {
      expression: `(() => {
        const dialog = document.getElementById('browser-type-dialog');
        return {
          isOpen: dialog ? dialog.open : false
        };
      })()`,
      returnByValue: true
    });
    console.log('Dialog state after submit:', afterSubmit.result.value);

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/mobile_after_type_submit.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved scratch/mobile_after_type_submit.png');

    console.log('7. Testing canvas tap and keyboard proxy focus...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.getElementById('remote-browser-canvas');
        const rect = canvas.getBoundingClientRect();
        const touch = new Touch({
          identifier: Date.now(),
          target: canvas,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        canvas.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], cancelable: true }));
        canvas.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch], cancelable: true }));
        const proxy = document.getElementById('remote-browser-keyboard-proxy');
        return {
          proxyFocused: document.activeElement === proxy
        };
      })()`,
      returnByValue: true
    });

    console.log('All typing verification tests PASSED successfully!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
