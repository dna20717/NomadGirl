import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1536, height: 864 } });
await p.goto('http://localhost:8766/index.html?stickers=all');
await p.waitForFunction(() => window.bootReady, null, { timeout: 60000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: process.argv[2] || 'output/cockpit.png' });
await b.close();
