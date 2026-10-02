/* Draws the home-screen PNGs from favicon.svg, so there is one icon. The
   phone masks the corners itself, so the PNGs are the full square. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const svg = readFileSync(pub + 'favicon.svg', 'utf8').replace('rx="14"', 'rx="0"');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: pub + name, omitBackground: false });
  await page.close();
}
await browser.close();
console.log('icons drawn');
