import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

await page.addInitScript(() => {
  const key = 'LITTLE_GALAXY_SAVED_DATA_V1';
  localStorage.setItem(key, JSON.stringify({
    hasSeenOnboarding: true,
    hasCompletedTutorial: true,
    unlockedGadgetIds: ['VOID_FLARE'],
    equippedGadgetId: 'VOID_FLARE',
    unlockedCostumes: ['ASTRONAUT', 'PIRATE', 'NINJA'],
    activeCostumeId: 'ASTRONAUT',
    totalStars: 2500,
    totalDiamonds: 80,
  }));
});

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(700);

const guest = page.getByRole('button', { name: /Play as Guest/i });
if (await guest.count()) {
  await guest.first().click({ force: true });
  await page.waitForTimeout(700);
}

await page.evaluate(() => {
  document.querySelectorAll('div').forEach((d) => {
    const t = d.textContent || '';
    if (t.includes('Play as Guest') && t.includes('Starfleet') && d.childElementCount > 8) d.remove();
  });
});
await page.waitForTimeout(400);

const hangar = page.getByText('Hangar', { exact: false }).first();
await hangar.click({ force: true });
await page.waitForTimeout(900);

await page.getByText('Run', { exact: true }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(200);

for (let i = 0; i < 4; i++) {
  await page.screenshot({ path: `${OUT}/walk-hangar-${i}.png` });
  await page.waitForTimeout(220);
}

await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  buttons.find((b) => b.innerHTML.includes('lucide-x'))?.click();
});
await page.waitForTimeout(400);

const play = page.getByText('Solo Voyage', { exact: false }).first();
if (await play.count()) await play.click({ force: true });
await page.waitForTimeout(1400);
for (let i = 0; i < 3; i++) {
  await page.screenshot({ path: `${OUT}/walk-play-${i}.png` });
  await page.waitForTimeout(250);
}

const gadget = await page.getByText(/Void/i).count();
console.log(JSON.stringify({ gadgetHud: gadget, url: page.url() }));
await browser.close();
