import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'https://srephoto.github.io/Cosmic-Explorer/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(45000);

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/pages-load.png`, fullPage: true });

const guest = page.getByRole('button', { name: /Play as Guest/i });
if (await guest.count()) {
  await guest.first().click({ force: true });
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: `${OUT}/pages-menu.png`, fullPage: true });

const play = page.getByText(/Solo Voyage/i).first();
if (await play.count()) {
  await play.click({ force: true });
  await page.waitForTimeout(1800);
}
await page.screenshot({ path: `${OUT}/pages-play.png`, fullPage: true });

const title = await page.title();
const body = await page.locator('#root').innerText().catch(() => '');
console.log(JSON.stringify({ title, url: page.url(), bodySnippet: body.slice(0, 180) }));
await browser.close();
