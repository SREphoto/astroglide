import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(25000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.split('\n')[0]));

await page.addInitScript(() => {
  localStorage.setItem('COSMIC_EXPLORER_SESSION', JSON.stringify({
    uid: 'guest_qa_cast',
    displayName: 'QA Pilot',
    photoURL: null,
    email: null,
    isAnonymous: true,
  }));
  localStorage.setItem('LITTLE_GALAXY_SAVED_DATA_V1', JSON.stringify({
    hasSeenOnboarding: true,
    hasCompletedTutorial: true,
    unlockedCostumes: ['ASTRONAUT', 'LUNA', 'MIRA', 'KAIA', 'NOVA'],
    activeCostumeId: 'LUNA',
    unlockedGadgetIds: ['VOID_FLARE'],
    equippedGadgetId: 'VOID_FLARE',
    totalStars: 4000,
    totalDiamonds: 120,
    inventory: [],
    unlockedJetpackModules: [],
    upgrades: { magnetLevel: 2, cometLevel: 2, multiplierLevel: 2, jetpackLevel: 3, ricochetLevel: 2, rewindLevel: 3 },
  }));
});

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1600);
await page.evaluate(() => document.getElementById('login-screen-root')?.remove());
await page.waitForTimeout(300);

await page.screenshot({ path: `${OUT}/cast-menu.png` });

// Start voyage without opening other modals
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => /Solo Voyage/i.test(x.textContent || ''));
  b?.click();
});
await page.waitForFunction(() => window.__controlsTest && window.__controlsTest.getMode && window.__controlsTest.getMode() === 'PLAYING', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/cast-play.png` });

const play = await page.evaluate(async () => {
  const t = window.__controlsTest;
  if (!t) return { error: 'no controlsTest', mode: null };
  const before = {
    mode: t.getMode?.(),
    npcs: t.getNpcCount?.(),
    planets: t.getPlanetSummary?.(),
  };
  t.grantVectorFins?.();
  t.spawnRareNearPlayer?.();
  await new Promise((r) => setTimeout(r, 900));
  return {
    ...before,
    hasAirSteer: t.hasAirSteer?.(),
    inventory: t.getInventory?.(),
    modeAfter: t.getMode?.(),
  };
});
console.log('PLAY', JSON.stringify(play));
await page.screenshot({ path: `${OUT}/cast-rare.png` });

await page.evaluate(() => window.__controlsTest?.openNearestTrader?.());
await page.waitForTimeout(700);
const traderOpen = await page.evaluate(() => /Vector Fins|Jetpack Refuel|Magnet Shot|Field mechanic|Wandering merchant/i.test(document.body.innerText));
console.log('TRADER_OPEN', traderOpen, (await page.evaluate(() => document.body.innerText)).slice(0, 280).replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/cast-trader.png` });

await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => (x.getAttribute('aria-label') || '') === 'Close trader');
  b?.click();
});
await page.waitForTimeout(300);
await page.evaluate(() => window.__controlsTest?.resume?.());
await page.waitForTimeout(200);

const steer = await page.evaluate(async () => {
  const t = window.__controlsTest;
  if (!t) return { error: 'no test' };
  t.resume?.();
  if (t.isAttached?.()) t.launch?.();
  await new Promise((r) => setTimeout(r, 250));
  const vx0 = t.getVx?.();
  t.setKeys?.(['KeyD']);
  await new Promise((r) => setTimeout(r, 400));
  const vx1 = t.getVx?.();
  t.setKeys?.(['KeyA']);
  await new Promise((r) => setTimeout(r, 400));
  const vx2 = t.getVx?.();
  t.setKeys?.([]);
  return {
    attached: t.isAttached?.(),
    vx0,
    vx1,
    vx2,
    dIncreases: (vx1 ?? 0) > (vx0 ?? 0),
    aDecreases: (vx2 ?? 0) < (vx1 ?? 0),
    hasAirSteer: t.hasAirSteer?.(),
    speed: t.getSpeed?.(),
  };
});
console.log('STEER', JSON.stringify(steer));
await page.screenshot({ path: `${OUT}/cast-steer.png` });

await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/cast-pause.png` });
const pauseTxt = await page.evaluate(() => document.body.innerText);
console.log('PAUSE_HAS_INV', /Relic inventory|Jetpack work|Vector Fins/i.test(pauseTxt));

const magenta = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return -1;
  const ctx = c.getContext('2d');
  const { width, height } = c;
  const data = ctx.getImageData(0, 0, width, height).data;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a > 80 && r > 200 && b > 200 && g < 40) n++;
  }
  return n;
});
console.log('MAGENTA', magenta);

await browser.close();
