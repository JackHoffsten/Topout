import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(readFileSync('apps/app/src/ui/mobileInputFocus.ts', 'utf8'));

async function setup(page: Page, placement = 'visible', trailing = 300) {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; } body { margin: 0; }
      #root { position: fixed; top: 0; height: 844px; width: 100%; display: flex; flex-direction: column; }
      header { height: 70px; flex-shrink: 0; }
      #scroll { overflow-y: auto; flex: 1; min-height: 0; }
      #content { padding: 24px 24px 40px; }
      input { font-size: 16px; height: 44px; width: 100%; }
      label { display: block; height: 24px; }
    </style>
    <div id="root"><header>Navigation</header><div id="scroll"><div id="content">
      <div style="height: 600px"></div>
      <div id="field" data-keyboard-placement="${placement}"><label for="input">Field</label><input id="input"></div>
      <div style="height: ${trailing}px">Results</div>
    </div></div></div>
  `);
  await page.evaluate(async (code) => {
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    const module = await import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    (window as any).disposeFocus = module.installMobileInputFocus(document.getElementById('root'));
  }, source);
}

async function keyboard(page: Page, height: number, top = 0, scale = 1) {
  await page.evaluate(
    ({ height, top, scale }) => {
      Object.assign(window.visualViewport!, { height, offsetTop: top, scale });
      const root = document.getElementById('root')!;
      root.style.height = `${height}px`;
      root.style.top = `${top}px`;
      window.visualViewport!.dispatchEvent(new Event('resize'));
    },
    { height, top, scale },
  );
}

test('ordinary field stays above the keyboard through resizing and browser panning', async ({
  page,
}) => {
  await setup(page);
  await page.locator('#input').focus();
  await keyboard(page, 380, 80);
  await expect
    .poll(async () => (await page.locator('#field').boundingBox())!.y + 68)
    .toBeLessThanOrEqual(448);
  await keyboard(page, 300, 120);
  await expect
    .poll(async () => (await page.locator('#field').boundingBox())!.y + 68)
    .toBeLessThanOrEqual(408);
  expect((await page.locator('#field').boundingBox())!.y).toBeGreaterThanOrEqual(202);
});

test('short search results can align at the top, without scrolling on typing or manual scrolling', async ({
  page,
}) => {
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(82);
  expect(
    await page.locator('#content').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
  ).toBeGreaterThan(40);
  await page.locator('#scroll').evaluate((el) => {
    el.scrollTop -= 70;
  });
  const position = await page.locator('#scroll').evaluate((el) => el.scrollTop);
  await page.locator('#input').pressSequentially('squat');
  await page.waitForTimeout(300);
  expect(await page.locator('#scroll').evaluate((el) => el.scrollTop)).toBe(position);
  await page.locator('#input').evaluate((el) => (el as HTMLInputElement).blur());
  await keyboard(page, 844);
  await expect
    .poll(() => page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom))
    .toBe('');
});

test('an already visible ordinary field is not moved unnecessarily', async ({ page }) => {
  await setup(page);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await page.waitForTimeout(350);
  const position = await page.locator('#scroll').evaluate((el) => el.scrollTop);
  await keyboard(page, 420);
  await page.waitForTimeout(300);
  expect(await page.locator('#scroll').evaluate((el) => el.scrollTop)).toBe(position);
});

test('pinch zoom and desktop focus do not receive mobile alignment', async ({ page }) => {
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400, 0, 2);
  await page.waitForTimeout(300);
  expect(
    await page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom),
  ).toBe('');
  await page.setViewportSize({ width: 1200, height: 844 });
  await keyboard(page, 400);
  await page.waitForTimeout(300);
  expect(
    await page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom),
  ).toBe('');
});

test('unmount cancels pending focus work and restores temporary space', async ({ page }) => {
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await page.evaluate(() => (window as any).disposeFocus());
  await page.waitForTimeout(300);
  expect(
    await page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom),
  ).toBe('');
});

test('dismissing the keyboard while the query retains focus removes trailing space', async ({
  page,
}) => {
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(82);
  await keyboard(page, 844);
  await expect
    .poll(() => page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom))
    .toBe('');
  await expect(page.locator('#input')).toBeFocused();
});

test('switching fields before the keyboard settles only reveals the latest field', async ({
  page,
}) => {
  await setup(page, 'results', 20);
  await page.locator('#content').evaluate((el) => {
    el.insertAdjacentHTML(
      'afterbegin',
      '<div id="second" data-keyboard-placement="visible"><label>Second</label><input id="second-input"></div>',
    );
  });
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await page.locator('#second-input').focus();
  await page.waitForTimeout(350);
  await expect(page.locator('#second-input')).toBeFocused();
  const second = (await page.locator('#second').boundingBox())!;
  // Browsers reveal newly focused inputs differently; the contract is that the
  // latest field stays inside the visible area, not an identical scroll offset.
  expect(second.y).toBeGreaterThanOrEqual(82);
  expect(second.y + second.height).toBeLessThanOrEqual(388);
  expect(
    await page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom),
  ).toBe('');
});

test('nested pickers align inside both scroll containers', async ({ page }) => {
  await setup(page, 'results', 20);
  await page.locator('#field').evaluate((field) => {
    const nested = document.createElement('div');
    nested.style.cssText = 'height: 180px; overflow-y: auto';
    const content = document.createElement('div');
    field.before(nested);
    nested.append(content);
    content.append(field);
    content.insertAdjacentHTML('afterbegin', '<div style="height:200px"></div>');
  });
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(94);
});

test('smooth scrolling reaches the same target without repeated corrections', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(82);
});

test('removing a focused picker cleans up its temporary space', async ({ page }) => {
  await setup(page, 'results', 20);
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(82);
  await page.locator('#field').evaluate((el) => el.remove());
  await expect
    .poll(() => page.locator('#content').evaluate((el) => (el as HTMLElement).style.paddingBottom))
    .toBe('');
});

test('works when React Native Web overrides the scroll node imperative method', async ({
  page,
}) => {
  await setup(page, 'results', 20);
  await page.locator('#scroll').evaluate((el) => {
    el.scrollTo = () => {
      throw new Error('React Native scrollTo expects x/y, not DOM top/left');
    };
  });
  await page.locator('#input').focus();
  await keyboard(page, 400);
  await expect
    .poll(async () => Math.round((await page.locator('#field').boundingBox())!.y))
    .toBe(82);
});
