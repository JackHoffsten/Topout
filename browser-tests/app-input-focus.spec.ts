import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

async function app(page: Page, authenticated = false) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 }),
    });
  });
  await page.route('**/*', async (route) => {
    const name = new URL(route.request().url()).pathname;
    if (name.startsWith('/api/')) {
      const body = name.endsWith('/csrf')
        ? { csrfToken: 'keyboard-test' }
        : name.endsWith('/refresh')
          ? { accessToken: 'keyboard-test', accessTokenExpiresAt: '2099-01-01T00:00:00Z' }
          : [{ id: 1, name: 'Squat', muscleGroups: ['Quads'], isCustom: false }];
      return route.fulfill({
        status: name.endsWith('/refresh') && !authenticated ? 401 : 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }
    const file = join(process.cwd(), 'apps/app/dist', name.includes('.') ? name : 'index.html');
    const types: Record<string, string> = {
      '.js': 'text/javascript',
      '.html': 'text/html',
      '.ttf': 'font/ttf',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    await route.fulfill({
      body: readFileSync(file),
      contentType: types[extname(file)] ?? 'application/octet-stream',
    });
  });
}

async function openKeyboard(page: Page) {
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 360 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
}

test('built login keeps its ordinary password field above the keyboard', async ({ page }) => {
  await app(page);
  await page.goto('https://topout.test/login');
  const input = page.getByLabel('Password', { exact: true });
  await input.focus();
  await openKeyboard(page);
  const field = input.locator('xpath=ancestor::*[@data-keyboard-placement][1]');
  await expect(field).toHaveAttribute('data-keyboard-placement', 'visible');
  await expect
    .poll(async () => {
      const rect = (await field.boundingBox())!;
      return rect.y + rect.height;
    })
    .toBeLessThanOrEqual(348.5);
  await expect(input).toBeFocused();
});

test('built exercise search aligns below navigation and leaves results visible', async ({
  page,
}) => {
  await app(page, true);
  await page.goto('https://topout.test/exercises');
  const input = page.getByLabel('Search exercises', { exact: true });
  await input.focus();
  await openKeyboard(page);
  const field = input.locator('xpath=ancestor::*[@data-keyboard-placement][1]');
  await expect(field).toHaveAttribute('data-keyboard-placement', 'results');
  await expect
    .poll(async () => {
      const header = (await page.getByTestId('phone-navigation-header').boundingBox())!;
      return Math.round((await field.boundingBox())!.y - header.y - header.height);
    })
    .toBe(12);
  await input.fill('Squat');
  await expect(page.getByText('Squat', { exact: true })).toBeVisible();
  const result = (await page.getByText('Squat', { exact: true }).boundingBox())!;
  expect(result.y + result.height).toBeLessThanOrEqual(360);
});
