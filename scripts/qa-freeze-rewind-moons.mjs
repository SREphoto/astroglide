import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(25000);
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGEERROR', e.message.split('\n')[0]);
});

await page.addInitScript(() => {
  localStorage.setItem('COSMIC_EXPLORER_SESSION', JSON.stringify({
    uid: 'guest_qa_freeze',
    displayName: 'QA Pilot',
    photoURL: null,
    email: null,
    isAnonymous: true,
  }));
  const key = 'LITTLE_GALAXY_SAVED_DATA_V1';
  let existing = {};
  try { existing = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  localStorage.setItem(key, JSON.stringify({
    ...existing,
    hasSeenOnboarding: true,
    hasCompletedTutorial: true,
    unlockedGadgetIds: ['VOID_FLARE'],
    equippedGadgetId: 'VOID_FLARE',
    totalStars: 100,
    totalDiamonds: 10,
    upgrades: { magnetLevel: 2, cometLevel: 2, multiplierLevel: 2, jetpackLevel: 1, ricochetLevel: 2, rewindLevel: 3 },
  }));
});

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);

if (await page.locator('#login-screen-root').count()) {
  const guest = page.locator('#login-screen-root button', { hasText: /Play as Guest/i });
  if (await guest.count()) {
    await guest.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
}
await page.waitForFunction(() => !document.getElementById('login-screen-root') || !!document.body.innerText.match(/Solo Voyage/), { timeout: 8000 }).catch(() => {});
if (await page.locator('#login-screen-root').count()) {
  await page.evaluate(() => document.getElementById('login-screen-root')?.remove());
}

const voyage = page.getByRole('button', { name: /Solo Voyage/i });
if (await voyage.count()) {
  await voyage.first().click({ force: true });
} else {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /Solo Voyage/i.test(x.textContent || ''));
    b?.click();
  });
}

await page.waitForFunction(() => window.__controlsTest?.getMode?.() === 'PLAYING', { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/play-moons.png` });

const layout = await page.evaluate(() => {
  const t = window.__controlsTest;
  if (!t) return { missing: true };
  return {
    mode: t.getMode?.(),
    freeze: t.getFreeze?.(),
    moons: t.getMoonCount?.(),
    secrets: t.getSecretCount?.(),
    summary: t.getPlanetSummary?.(),
    layout: t.getMoonLayout?.(),
  };
});
console.log('LAYOUT', JSON.stringify(layout, null, 2));

await page.evaluate(() => window.__controlsTest?.setFreeze?.(0.35));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/freeze-early.png` });

await page.evaluate(() => window.__controlsTest?.setFreeze?.(0.7));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/freeze-mid.png` });

await page.evaluate(() => window.__controlsTest?.setFreeze?.(0.95));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/freeze-full.png` });

await page.evaluate(() => window.__controlsTest?.setFreeze?.(0));
await page.keyboard.press('KeyR');
await page.waitForTimeout(800);
const afterRewind = await page.evaluate(() => document.body.innerText);
console.log('AFTER_REWIND', afterRewind.replace(/\s+/g, ' ').slice(0, 400));
await page.screenshot({ path: `${OUT}/rewind-safe.png` });

const hudHasScrubber = await page.evaluate(() => /rewind point|scrub|confirm rewind/i.test(document.body.innerText));
console.log('SCRUBBER_VISIBLE', hudHasScrubber);
console.log('ERRORS', errors.length ? errors.map((e) => e.split('\n')[0]) : 'none');

await browser.close();
