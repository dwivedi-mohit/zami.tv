const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/blawten/.gemini/antigravity/brain/15abb512-10f4-413b-b852-718c8cc20969';
const PORT = 9223;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    } catch (e) {
      await sleep(200);
    }
  }
  throw new Error('Unable to connect to CDP endpoint');
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  console.log('Launching Brave Desktop (1280x800)...');
  const browserProc = spawn('/bin/brave-browser', [
    '--remote-debugging-port=' + PORT,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    '--disable-dev-shm-usage',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise(res => ws.onopen = res);

    const client = new CdpClient(ws);
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://localhost:3000/room.html?room=verify-desktop' });
    await sleep(2500);

    await client.screenshot(path.join(ARTIFACTS_DIR, 'desktop_view_clean.png'));

    // Click single stage play button
    await client.eval(`document.getElementById('btn-stage-single-choose').click()`);
    await sleep(600);
    await client.screenshot(path.join(ARTIFACTS_DIR, 'desktop_stage_sources_popup.png'));

    console.log('Desktop verification completed!');
  } finally {
    browserProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
