import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

async function app(page: Page, mode: 'template' | 'log', count = 3) {
  const exercises = [
    { id: 1, name: 'Row', muscleGroups: ['Back'], isCustom: false },
    { id: 2, name: 'Curl', muscleGroups: ['Biceps'], isCustom: false },
    { id: 3, name: 'Squat', muscleGroups: ['Quads'], isCustom: false },
  ];
  for (let id = 4; id <= count; id++)
    exercises.push({ id, name: `Exercise ${id}`, muscleGroups: ['Back'], isCustom: false });
  let order = exercises.map((e) => e.id);
  const state = {
    saves: [] as number[][],
    fail: false,
    hold: undefined as Promise<void> | undefined,
  };
  const template = () => ({
    id: 1,
    name: 'Pull',
    exercises: order.map((id) => ({ exercise: exercises[id - 1], sets: [] })),
  });
  const workout = () => ({
    scheduleId: 2,
    date: '2026-10-01',
    templateName: 'Pull',
    template: template(),
    log: {
      id: 1,
      date: '2026-10-01',
      notes: null,
      completedAt: null,
      exerciseOrder: order,
      exercises: order.map((id) => ({ exercise: exercises[id - 1], sets: [] })),
    },
    previousSets: [],
  });
  await page.route('**/*', async (route) => {
    const name = new URL(route.request().url()).pathname;
    if (name.startsWith('/api/')) {
      let status = 200;
      let body: unknown;
      if (name.endsWith('/csrf')) body = { csrfToken: 'reorder-test' };
      else if (name.endsWith('/refresh'))
        body = { accessToken: 'test', accessTokenExpiresAt: '2099-01-01T00:00:00Z' };
      else if (name.endsWith('/exercises/order')) {
        const ids = route.request().postDataJSON().exerciseIds as number[];
        state.saves.push(ids);
        await state.hold;
        if (state.fail) {
          status = 503;
          body = { title: 'Temporarily unavailable' };
          state.fail = false;
        } else {
          order = ids;
          body = mode === 'template' ? template() : workout();
        }
      } else if (name.startsWith('/api/workout-templates/')) body = template();
      else if (name.endsWith('/log')) body = workout();
      else if (name === '/api/exercises') body = exercises;
      else body = [];
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
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
  await page.goto(`https://topout.test/${mode === 'template' ? 'templates/1/edit' : 'workouts/2'}`);
  if (mode === 'log') {
    for (const { name } of exercises)
      await page.getByRole('button', { name: `Collapse ${name}`, exact: true }).click();
  }
  await page
    .getByRole('button', { name: 'Drag Row to reorder', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Drag Row to reorder', exact: true }),
  ).toBeVisible();
  return state;
}

async function drag(page: Page, from: string, to: string, cancel = false) {
  const handle = page.getByRole('button', { name: `Drag ${from} to reorder`, exact: true });
  const target = page.getByRole('button', { name: `Drag ${to} to reorder`, exact: true });
  await handle.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!;
  const end = (await target.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: dragging suppresses text selection and restores it after cancellation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await app(page, mode);
    const handle = page.getByRole('button', { name: 'Drag Row to reorder', exact: true });
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    const preview = page.getByTestId('drag-preview');
    await expect(preview).toBeVisible();
    const canSelect = () =>
      page
        .getByText('Row', { exact: true })
        .first()
        .evaluate((node) =>
          node.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })),
        );
    await expect.poll(canSelect).toBe(false);
    await expect
      .poll(() =>
        preview
          .getByText('Row', { exact: true })
          .evaluate((node) => getComputedStyle(node).userSelect),
      )
      .toBe('none');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect.poll(canSelect).toBe(true);
  });

  for (const short of [false, true]) {
    test(`${mode}: reveals ${short ? 'oversized' : 'clipped'} placeholder without changing destination`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1100, height: 900 });
      const state = await app(page, mode, 8);
      if (short) {
        await page.setViewportSize({ width: 1100, height: 130 });
        await expect
          .poll(async () => (await page.getByTestId('page-scroll').boundingBox())!.height)
          .toBeLessThanOrEqual(130);
      }
      const scroll = page.getByTestId('page-scroll');
      const bounds = (await scroll.boundingBox())!;
      const handle = page.getByRole('button', { name: 'Drag Row to reorder', exact: true });
      const initial = (await handle.boundingBox())!;
      await scroll.evaluate(
        (node, delta) => {
          node.scrollTop += delta;
        },
        initial.y - bounds.y - 30,
      );
      const start = (await handle.boundingBox())!;
      const before = await scroll.evaluate((node) => node.scrollTop);
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      const placeholder = page.getByTestId('drag-placeholder');
      await expect(placeholder).toContainText('Drop in position 1');
      await expect
        .poll(async () => (await placeholder.boundingBox())!.y)
        .toBeGreaterThanOrEqual(bounds.y + 10);
      if (!short)
        await expect
          .poll(async () => {
            const box = (await placeholder.boundingBox())!;
            return box.y + box.height;
          })
          .toBeLessThanOrEqual(bounds.y + bounds.height - 10);
      else expect((await placeholder.boundingBox())!.height).toBeGreaterThan(bounds.height - 24);
      await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeLessThan(before - 10);
      const offset = await scroll.evaluate((node) => node.scrollTop);
      await page.waitForTimeout(200);
      expect(Math.abs((await scroll.evaluate((node) => node.scrollTop)) - offset)).toBeLessThan(2);
      await expect(placeholder).toContainText('Drop in position 1');
      await page.mouse.up();
      expect(state.saves).toEqual([]);
    });
  }

  test(`${mode}: placeholder matches a collapsed exercise and closes the expanded source gap`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 1600 });
    const state = await app(page, mode);
    const handle = page.getByRole('button', { name: 'Drag Row to reorder', exact: true });
    const next = page.getByRole('button', { name: 'Drag Curl to reorder', exact: true });
    const collapse = page.getByRole('button', { name: 'Collapse Row', exact: true });
    if (await collapse.count()) await collapse.click();
    const collapsedCard = (await handle.locator('..').locator('..').locator('..').boundingBox())!;
    await page.getByRole('button', { name: 'Expand Row', exact: true }).click();
    const before = (await next.boundingBox())!;
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('drag-placeholder')).toBeVisible();
    await expect
      .poll(async () => {
        const placeholder = (await page.getByTestId('drag-placeholder').boundingBox())!;
        return (
          Math.abs(collapsedCard.height + 4 - placeholder.height) +
          Math.abs(collapsedCard.width + 4 - placeholder.width)
        );
      })
      .toBeLessThan(2);
    await expect.poll(async () => (await next.boundingBox())!.y).toBeLessThan(before.y - 20);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect
      .poll(async () => Math.abs((await next.boundingBox())!.y - before.y))
      .toBeLessThan(2);
    await expect(page.getByRole('button', { name: 'Collapse Row', exact: true })).toBeVisible();
    expect(state.saves).toEqual([]);
  });

  test(`${mode}: pointer drag saves, restores after reload, and rolls back failed moves`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 1200 });
    const state = await app(page, mode);
    await drag(page, 'Row', 'Squat');
    await expect.poll(() => state.saves).toEqual([[2, 3, 1]]);
    await expect(page.getByRole('button', { name: 'Move Row down', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Move Row down', exact: true })).toBeDisabled();
    if (mode === 'log')
      for (const name of ['Row', 'Curl', 'Squat'])
        await page.getByRole('button', { name: `Collapse ${name}`, exact: true }).click();
    state.fail = true;
    await drag(page, 'Row', 'Curl');
    await expect(page.getByText(/Could not save exercise order/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move Row down', exact: true })).toBeDisabled();
    await drag(page, 'Row', 'Curl');
    await expect(page.getByRole('button', { name: 'Move Row up', exact: true })).toBeDisabled();
    await expect.poll(() => state.saves.length).toBe(3);
  });

  test(`${mode}: cancelled and unchanged drags do not save; keyboard arrows remain usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 1200 });
    const state = await app(page, mode);
    await drag(page, 'Row', 'Squat', true);
    await drag(page, 'Row', 'Row');
    expect(state.saves).toEqual([]);
    const down = page.getByRole('button', { name: 'Move Row down', exact: true });
    await down.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => state.saves).toEqual([[2, 1, 3]]);
  });
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: touch dragging uses the same order save`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP supplies real touch input in Chromium.');
    await page.setViewportSize({ width: 390, height: 1200 });
    const state = await app(page, mode);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const start = (await page
      .getByRole('button', { name: 'Drag Row to reorder', exact: true })
      .boundingBox())!;
    const end = (await page
      .getByRole('button', { name: 'Drag Squat to reorder', exact: true })
      .boundingBox())!;
    const x = start.x + start.width / 2;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: start.y + start.height / 2 }],
    });
    // Holding the handle must remain a drag rather than a text-selection gesture.
    await page.waitForTimeout(650);
    await expect(page.getByTestId('drag-preview')).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    expect(
      await page
        .getByTestId('drag-preview')
        .evaluate((node) =>
          node.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })),
        ),
    ).toBe(false);
    for (let step = 1; step <= 12; step++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: start.y + start.height / 2 + ((end.y - start.y) * step) / 12 }],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => state.saves).toEqual([[2, 3, 1]]);
    await expect(page.getByRole('button', { name: 'Move Row down', exact: true })).toBeDisabled();
  });
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: floating feedback and edge auto-scroll keep the indicated drop accurate`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const state = await app(page, mode, 16);
    const scroll = page.getByTestId('page-scroll');
    const bounds = (await scroll.boundingBox())!;
    const start = (await page
      .getByRole('button', { name: 'Drag Row to reorder', exact: true })
      .boundingBox())!;
    const x = start.x + start.width / 2;
    await page.mouse.move(x, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, bounds.y + bounds.height - 8, { steps: 10 });
    await expect(page.getByTestId('drag-preview')).toBeVisible();
    await expect(page.getByTestId('drag-preview')).toContainText('Row');
    await expect(page.getByTestId('drag-insertion-line')).toBeAttached();
    await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(500);
    await expect(page.getByTestId('drag-placeholder')).toContainText('Drop in position 16', {
      timeout: 15000,
    });
    await expect
      .poll(async () => {
        const placeholder = (await page.getByTestId('drag-placeholder').boundingBox())!;
        return Math.max(
          bounds.y + 10 - placeholder.y,
          placeholder.y + placeholder.height - (bounds.y + bounds.height - 10),
        );
      })
      .toBeLessThanOrEqual(0);
    expect(state.saves).toEqual([]);
    await page.mouse.move(x, bounds.y + bounds.height / 2, { steps: 4 });
    const stopped = await scroll.evaluate((node) => node.scrollTop);
    await page.waitForTimeout(150);
    expect(Math.abs((await scroll.evaluate((node) => node.scrollTop)) - stopped)).toBeLessThan(4);
    const position = Number(
      (await page.getByTestId('drag-placeholder').innerText()).match(/\d+/)![0],
    );
    await page.mouse.up();
    await expect.poll(() => state.saves.length).toBe(1);
    expect(state.saves[0]!.indexOf(1)).toBe(position - 1);
    await expect(page.getByTestId('drag-preview')).toHaveCount(0);
    await expect(page.getByText('Exercise order: Saved', { exact: true })).toBeAttached();
  });

  test(`${mode}: save feedback stays pending until the order write completes`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1200 });
    const state = await app(page, mode);
    let release!: () => void;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.getByRole('button', { name: 'Move Curl up', exact: true }).click();
    await expect(page.getByText('Exercise order: Saving…', { exact: true })).toBeVisible();
    await expect(page.getByText('Exercise order: Saved', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Move Row up', exact: true })).toBeDisabled();
    release();
    await expect(page.getByText('Exercise order: Saved', { exact: true })).toBeVisible();
  });
}

test('template save carries success to its destination without delaying navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 1200 });
  await app(page, 'template');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('https://topout.test/templates');
  await expect(page.getByText('Workout template: Saved', { exact: true })).toBeVisible();
});

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: upward edge scrolling stops on cancellation without saving`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    const state = await app(page, mode, 16);
    const scroll = page.getByTestId('page-scroll');
    const handle = page.getByRole('button', { name: 'Drag Exercise 16 to reorder', exact: true });
    await handle.scrollIntoViewIfNeeded();
    const start = (await handle.boundingBox())!;
    const bounds = (await scroll.boundingBox())!;
    const initial = await scroll.evaluate((node) => node.scrollTop);
    const x = start.x + start.width / 2;
    await page.mouse.move(x, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, bounds.y + 8, { steps: 10 });
    await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeLessThan(initial - 250);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    const stopped = await scroll.evaluate((node) => node.scrollTop);
    await page.waitForTimeout(150);
    expect(Math.abs((await scroll.evaluate((node) => node.scrollTop)) - stopped)).toBeLessThan(4);
    expect(state.saves).toEqual([]);
    await expect(page.getByTestId('drag-preview')).toHaveCount(0);
  });
}

test('touch edge scrolling reaches off-screen exercises before committing the drop', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP supplies real touch input in Chromium.');
  await page.setViewportSize({ width: 390, height: 700 });
  const state = await app(page, 'template', 14);
  const scroll = page.getByTestId('page-scroll');
  const bounds = (await scroll.boundingBox())!;
  const start = (await page
    .getByRole('button', { name: 'Drag Row to reorder', exact: true })
    .boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const x = start.x + start.width / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: start.y + start.height / 2 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: bounds.y + bounds.height - 8 }],
  });
  await expect(page.getByTestId('drag-preview')).toBeVisible();
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(300);
  expect(state.saves).toEqual([]);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => state.saves.length).toBe(1);
  expect(state.saves[0]!.indexOf(1)).toBeGreaterThan(1);
});

async function expectRevealed(page: Page, name: string) {
  const header = page.getByRole('button', { name: new RegExp(`^(Expand|Collapse) ${name}$`) });
  await expect
    .poll(async () => {
      const item = (await header.boundingBox())!;
      const viewport = (await page.getByTestId('page-scroll').boundingBox())!;
      return item.y - viewport.y;
    })
    .toBeGreaterThanOrEqual(24);
  await expect
    .poll(async () => {
      const item = (await header.boundingBox())!;
      const viewport = (await page.getByTestId('page-scroll').boundingBox())!;
      return item.y - viewport.y;
    })
    .toBeLessThan(60);
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: button moves immediately reveal the same exercise on every move`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    const state = await app(page, mode, 16);
    let release!: () => void;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.getByRole('button', { name: 'Move Row down', exact: true }).click();
    await expect(page.getByText('Exercise order: Saving…', { exact: true })).toBeVisible();
    await expectRevealed(page, 'Row');
    expect(await page.getByRole('button', { name: 'Expand Row', exact: true }).count()).toBe(1);
    const first = await page.getByTestId('page-scroll').evaluate((node) => node.scrollTop);
    release();
    state.hold = undefined;
    await expect(page.getByText('Exercise order: Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Move Row down', exact: true }).press('Enter');
    await expect.poll(() => state.saves.length).toBe(2);
    await expectRevealed(page, 'Row');
    const second = await page.getByTestId('page-scroll').evaluate((node) => node.scrollTop);
    expect(second).toBeGreaterThan(first + 100);
    await page.getByRole('button', { name: 'Move Row up', exact: true }).click();
    await expect.poll(() => state.saves.length).toBe(3);
    await expectRevealed(page, 'Row');
    expect(await page.getByTestId('page-scroll').evaluate((node) => node.scrollTop)).toBeLessThan(
      second - 100,
    );
  });

  test(`${mode}: dropping reveals the exercise before saving and failure follows it back`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    const state = await app(page, mode, 16);
    let release!: () => void;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.fail = true;
    await drag(page, 'Row', 'Curl');
    await expectRevealed(page, 'Row');
    await expect(page.getByText('Exercise order: Saving…', { exact: true })).toBeVisible();
    release();
    await expect(page.getByText(/Could not save exercise order/)).toBeAttached();
    await expect(page.getByRole('button', { name: 'Move Row up', exact: true })).toBeDisabled();
    await expectRevealed(page, 'Row');
  });

  test(`${mode}: manual wheel scrolling interrupts a smooth reveal`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await app(page, mode, 16);
    const scroll = page.getByTestId('page-scroll');
    await page.getByRole('button', { name: 'Move Row down', exact: true }).click();
    await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(10);
    const bounds = (await scroll.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(100);
    const stopped = await scroll.evaluate((node) => node.scrollTop);
    await page.waitForTimeout(350);
    expect(Math.abs((await scroll.evaluate((node) => node.scrollTop)) - stopped)).toBeLessThan(4);
    const header = (await page
      .getByRole('button', { name: 'Expand Row', exact: true })
      .boundingBox())!;
    expect(header.y - bounds.y).toBeGreaterThan(100);
  });
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: a cancelled new drag does not restart the previous move's reveal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const state = await app(page, mode, 16);
    await page.getByRole('button', { name: 'Move Row down', exact: true }).click();
    await expect.poll(() => state.saves.length).toBe(1);
    const handle = page.getByRole('button', { name: 'Drag Row to reorder', exact: true });
    await handle.scrollIntoViewIfNeeded();
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('drag-preview')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    const scroll = page.getByTestId('page-scroll');
    const stopped = await scroll.evaluate((node) => node.scrollTop);
    await page.waitForTimeout(350);
    expect(Math.abs((await scroll.evaluate((node) => node.scrollTop)) - stopped)).toBeLessThan(4);
    expect(state.saves).toHaveLength(1);
  });

  test(`${mode}: revealing an expanded exercise keeps it expanded`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await app(page, mode, 16);
    await page.getByRole('button', { name: 'Expand Row', exact: true }).click();
    await page.getByRole('button', { name: 'Move Row down', exact: true }).click();
    await expectRevealed(page, 'Row');
    await expect(page.getByRole('button', { name: 'Collapse Row', exact: true })).toBeVisible();
  });
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: a newer move replaces an in-progress smooth reveal`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const state = await app(page, mode, 16);
    await page.getByRole('button', { name: 'Move Row down', exact: true }).press('Enter');
    await expect(page.getByText('Exercise order: Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Move Row down', exact: true }).press('Enter');
    await expect.poll(() => state.saves.length).toBe(2);
    expect(state.saves[1]!.indexOf(1)).toBe(2);
    await expectRevealed(page, 'Row');
  });
}

for (const mode of ['template', 'log'] as const) {
  test(`${mode}: rollback reveals a later exercise together with its retry error`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    const state = await app(page, mode, 16);
    let release!: () => void;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.fail = true;
    await page.getByRole('button', { name: 'Move Exercise 10 down', exact: true }).click();
    await expectRevealed(page, 'Exercise 10');
    release();
    await expect(page.getByText(/Could not save exercise order/)).toBeVisible();
    await expectRevealed(page, 'Exercise 10');
  });
}
