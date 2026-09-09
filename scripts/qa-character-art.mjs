import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

await page.addInitScript(() => {
  const key = 'LITTLE_GALAXY_SAVED_DATA_V1';
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  })();
  localStorage.setItem(key, JSON.stringify({
    ...existing,
    hasSeenOnboarding: true,
    hasCompletedTutorial: true,
    unlockedGadgetIds: ['VOID_FLARE', 'STAR_BURST', 'ICE_SHELL'],
    equippedGadgetId: 'VOID_FLARE',
    totalStars: 2500,
    totalDiamonds: 80,
    totalStarDust: 800,
  }));
});

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/char-login.png`, fullPage: true });

const guest = page.getByRole('button', { name: /Play as Guest/i });
if (await guest.count()) {
  await guest.first().click({ force: true });
  await page.waitForTimeout(600);
}

// If login overlay is still blocking, detach it
await page.evaluate(() => {
  const roots = Array.from(document.querySelectorAll('#login-screen-root, [class*="Login"]'));
  for (const el of roots) el.remove();
  document.querySelectorAll('div').forEach((d) => {
    const t = d.textContent || '';
    if (t.includes('Play as Guest') && t.includes('Starfleet') && d.childElementCount > 8) {
      d.remove();
    }
  });
});

await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/char-menu.png`, fullPage: true });

const hangar = page.getByText('Hangar', { exact: false }).first();
if (await hangar.count()) {
  await hangar.click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/char-wardrobe.png`, fullPage: true });
  const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
  const xBtn = page.getByRole('button').filter({ hasText: '' });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const closer = buttons.find((b) => b.getAttribute('title') === 'Close' || b.innerHTML.includes('lucide-x') || b.getAttribute('aria-label') === 'Close');
    closer?.click();
  });
  await page.waitForTimeout(400);
}

const upgradesBtn = page.getByText('Upgrades', { exact: false }).first();
if (await upgradesBtn.count()) {
  await upgradesBtn.click({ force: true });
} else {
  await page.getByText('Workshop', { exact: false }).first().click({ force: true }).catch(() => {});
}
await page.waitForTimeout(500);
const gadgetsTab = page.getByText('Gadgets', { exact: true }).first();
if (await gadgetsTab.count()) {
  await gadgetsTab.click({ force: true });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT}/char-gadgets.png`, fullPage: true });
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const closer = buttons.find((b) => b.innerHTML.includes('lucide-x'));
  closer?.click();
});
await page.waitForTimeout(400);

const play = page.getByText('Solo Voyage', { exact: false }).first();
if (await play.count()) {
  await play.click({ force: true });
} else {
  await page.getByRole('button', { name: /^Play$/i }).click({ force: true }).catch(() => {});
}
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/char-play.png`, fullPage: true });

const gadgetHud = await page.getByText(/Void/i).count();
const jetpackHud = await page.getByText(/Jetpack/i).count();
console.log(JSON.stringify({ gadgetHud, jetpackHud, url: page.url() }));

await browser.close();
