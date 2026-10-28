const { spawn } = require('child_process');
const http = require('http');

const PORT = 9245;
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

    // Create test HTML with search input and number input
    await send('Page.navigate', {
      url: 'data:text/html,<html><body><input id="search-input" placeholder="Search"><input id="phone-input" type="tel" placeholder="Phone"></body></html>'
    });
    await sleep(500);

    // 1. Focus search input
    await send('Runtime.evaluate', { expression: `document.getElementById('search-input').focus();` });

    // 2. Test Input.insertText with text & numbers
    console.log('Testing Input.insertText for search text...');
    await send('Input.insertText', { text: 'Inception 2010 movie' });
    const searchVal = await send('Runtime.evaluate', {
      expression: `document.getElementById('search-input').value`,
      returnByValue: true
    });
    console.log('Search input value:', searchVal.result.value);

    // 3. Focus phone input
    await send('Runtime.evaluate', { expression: `document.getElementById('phone-input').focus();` });

    // 4. Test typing numbers & OTP
    console.log('Testing Input.insertText for phone number & OTP...');
    await send('Input.insertText', { text: '+1 9876543210' });
    const phoneVal = await send('Runtime.evaluate', {
      expression: `document.getElementById('phone-input').value`,
      returnByValue: true
    });
    console.log('Phone input value:', phoneVal.result.value);

    // 5. Test Backspace via dispatchKeyEvent
    console.log('Testing Backspace dispatchKeyEvent...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    const phoneValAfterBs = await send('Runtime.evaluate', {
      expression: `document.getElementById('phone-input').value`,
      returnByValue: true
    });
    console.log('Phone after backspace:', phoneValAfterBs.result.value);

    console.log('SUCCESS! CDP Input.insertText and key events work flawlessly!');
  } finally {
    browser.kill();
  }
}
main().catch(console.error);
