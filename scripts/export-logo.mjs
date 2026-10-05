import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Generate app assets from the vector master. Store icons must be opaque;
// the operating system supplies their corner mask.
const assets = new URL('../apps/app/assets/', import.meta.url);
const svg = await readFile(new URL('topout-icon.svg', assets), 'utf8');
const browser = await chromium.launch();
try {
  for (const [name, size, color, square] of [
    ['topout-icon.png', 512, '#297AA0', false],
    ['topout-icon-light.png', 512, '#0069CC', false],
    ['topout-ios-icon.png', 1024, '#297AA0', true],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const source = svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)
      .replace('#297AA0', color).replace('rx="4"', square ? 'rx="0"' : 'rx="4"');
    await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${source}`);
    await page.screenshot({ path: fileURLToPath(new URL(name, assets)), omitBackground: !square });
    await page.close();
  }
} finally {
  await browser.close();
}
