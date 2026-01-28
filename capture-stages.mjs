import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const outDir = './docs/screenshots/setup-flow';
await mkdir(outDir, { recursive: true });

console.log('Launching browser...');
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 900 });

const htmlPath = `file://${process.cwd()}/tools/setup-flow-simulator/index.html`;
console.log('Loading:', htmlPath);
await page.goto(htmlPath);
await page.waitForSelector('.screen');

const stages = ['01-flash', '02-wifi', '03-register', '04-config', '05-dashboard'];

for (let i = 0; i < 5; i++) {
  if (i > 0) {
    await page.click('.btn-p');
    await new Promise(r => setTimeout(r, 500));
  }
  const path = join(outDir, `${stages[i]}.png`);
  await page.screenshot({ path });
  console.log('Captured:', stages[i] + '.png');
}

await browser.close();
console.log('Done! Screenshots in:', outDir);
