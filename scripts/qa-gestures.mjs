import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(25000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.addInitScript(() => {
  localStorage.setItem('COSMIC_EXPLORER_SESSION', JSON.stringify({
    uid: 'guest_qa_gestures',
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
    unlockedGadgetIds: ['VOID_FLARE', 'STAR_BURST', 'ICE_SHELL'],
    equippedGadgetId: 'VOID_FLARE',
    totalStars: 2500,
    totalDiamonds: 80,
    equippedGear: {
      helmetId: 'HELMET_ASTRAL',
      suitId: 'SUIT_CELESTIAL',
      thrusterId: 'THRUSTER_DARK_MATTER',
      relicId: 'RELIC_CHRONOS',
      accessoryId: 'GEAR_PRISMATIC_CAPE',
    },
    upgrades: { magnetLevel: 2, cometLevel: 2, multiplierLevel: 2, jetpackLevel: 3, ricochetLevel: 2, rewindLevel: 3 },
  }));
});

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);

// If login still showing, try guest then hard-remove after setting a dummy user via storage
if (await page.locator('#login-screen-root').count()) {
  const guest = page.locator('#login-screen-root button', { hasText: /Play as Guest/i });
  if (await guest.count()) {
    await guest.first().scrollIntoViewIfNeeded().catch(() => {});
    await guest.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

await page.waitForFunction(() => !document.getElementById('login-screen-root') || !!document.body.innerText.match(/Solo Voyage/), { timeout: 8000 }).catch(() => {});

if (await page.locator('#login-screen-root').count()) {
  await page.evaluate(() => document.getElementById('login-screen-root')?.remove());
  await page.waitForTimeout(200);
}

await page.screenshot({ path: `${OUT}/gest-menu.png` });
console.log('MENU TEXT', (await page.locator('body').innerText()).slice(0, 400).replace(/\s+/g, ' '));

const voyage = page.getByRole('button', { name: /Solo Voyage/i });
if (await voyage.count()) {
  await voyage.first().click({ force: true });
} else {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /Solo Voyage/i.test(x.textContent || ''));
    b?.click();
  });
}
await page.waitForTimeout(1600);

await page.screenshot({ path: `${OUT}/gest-play.png` });

const hudBusy = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    jetpackBtn: /Jetpack \(/i.test(txt),
    rewindBtn: /Rewind \(/i.test(txt),
    starGaze: /Star Gaze/i.test(txt),
    pause: !!document.querySelector('button[aria-label="Pause"], button[title="Pause"]'),
    mode: window.__controlsTest?.getMode?.(),
    moons: window.__controlsTest?.getMoonCount?.(),
    secrets: window.__controlsTest?.getSecretCount?.(),
    zoom: window.__controlsTest?.getZoom?.(),
  };
});
console.log('PLAY', hudBusy);

const canvas = page.locator('canvas').first();
const box = await canvas.boundingBox();

if (hudBusy.mode === 'PLAYING' && box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.45;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(90);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(800);
}

let exploring = await page.evaluate(() => !!window.__controlsTest?.isExploring?.());
if (!exploring) {
  await page.evaluate(() => window.__controlsTest?.enterExplore?.());
  await page.waitForTimeout(900);
}
exploring = await page.evaluate(() => !!window.__controlsTest?.isExploring?.());
const zoom = await page.evaluate(() => window.__controlsTest?.getZoom?.());
await page.screenshot({ path: `${OUT}/gest-explore.png` });

const walk = await page.evaluate(async () => {
  const t = window.__controlsTest;
  if (!t) return { ok: false };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const y0 = t.getYaw();
  t.setKeys(['KeyD']);
  await new Promise((r) => setTimeout(r, 500));
  const yD = t.getYaw();
  t.setKeys(['KeyA']);
  await new Promise((r) => setTimeout(r, 500));
  const yA = t.getYaw();
  t.setKeys([]);
  return { ok: true, dD: wrap(yD - y0), dA: wrap(yA - yD), facing: t.getFacing(), exploring: t.isExploring?.() };
});
await page.screenshot({ path: `${OUT}/gest-walk.png` });

await page.evaluate(() => window.__controlsTest?.exitExplore?.());
await page.waitForTimeout(400);

const pauseBtn = page.locator('button[aria-label="Pause"], button[title="Pause"]').first();
if (await pauseBtn.count()) await pauseBtn.click({ force: true });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/gest-pause.png` });
const pauseText = await page.evaluate(() => document.body.innerText);

const resume = page.getByRole('button', { name: /Resume/i });
if (await resume.count()) await resume.first().click({ force: true });
await page.waitForTimeout(500);

await page.evaluate(() => window.__controlsTest?.beginRewind?.());
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/gest-rewind.png` });

const mag = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { pct: -1, n: 0 };
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  let img;
  try { img = ctx.getImageData(0, 0, w, h).data; } catch (e) { return { pct: -2, n: 0, err: String(e) }; }
  let mag = 0, n = 0;
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
    if (a < 20) continue;
    n++;
    if (r > 180 && b > 160 && g < 80 && Math.abs(r - b) < 40) mag++;
  }
  return { pct: n ? (100 * mag) / n : 0, n };
});

const report = {
  hudBusy,
  exploring,
  zoom,
  walk,
  pauseHasGestures: /Gestures/i.test(pauseText),
  pauseHasCharges: /Jetpack/i.test(pauseText) && /Rewind/i.test(pauseText),
  mag,
};
fs.writeFileSync(`${OUT}/gest-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
