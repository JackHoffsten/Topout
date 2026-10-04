import { test, expect } from '@playwright/test';
import { navigate } from './navigation';

test('square cells and activity badges fit phone, tablet, and desktop widths', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One resizing flow covers all viewports.');
  const csrfResponse = await page.request.get('/api/auth/web/csrf');
  expect(csrfResponse.ok()).toBe(true);
  const csrf = await csrfResponse.json();
  const registration = await page.request.post('/api/auth/web/register', {
    headers: { Origin: 'https://localhost:8443', 'X-CSRF-Token': csrf.csrfToken },
    data: {
      displayName: 'Responsive calendar tester',
      email: `calendar-responsive-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
    },
  });
  expect(registration.ok(), await registration.text()).toBe(true);
  const session = await registration.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const exerciseResponse = await page.request.get('/api/exercises', { headers });
  const exercise = (await exerciseResponse.json())[0];
  const date = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const templateResponse = await page.request.post('/api/workout-templates', {
    headers,
    data: { name: 'Push', exercises: [{ exerciseId: exercise.id, sets: [] }] },
  });
  expect(templateResponse.ok()).toBe(true);
  const template = await templateResponse.json();
  const scheduleResponse = await page.request.post('/api/workout-schedule', {
    headers,
    data: { date, templateId: template.id },
  });
  expect(scheduleResponse.ok()).toBe(true);
  const schedule = await scheduleResponse.json();
  const loggedResponse = await page.request.put(`/api/workout-schedule/${schedule.id}/log/sets`, {
    headers,
    data: {
      exerciseId: exercise.id,
      order: 1,
      reps: 8,
      weightKg: 20,
      isWarmup: false,
      notes: null,
    },
  });
  expect(loggedResponse.ok(), await loggedResponse.text()).toBe(true);
  expect(
    (
      await page.request.post('/api/climb-logs', {
        headers,
        data: {
          date,
          climbingType: 'Bouldering',
          gradeSystem: 'Font',
          grade: '7A',
          environment: 'Indoor',
          attempts: 1,
          outcome: 'Flash',
          wallAngle: null,
          styles: [],
          name: null,
          location: null,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/calendar');
  const cell = page.getByRole('button', { name: /1 climb logged/ });
  for (const width of [320, 390, 400, 800, 1000, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(cell).toBeVisible();
    await expect(async () => {
      const bounds = (await cell.boundingBox())!;
      expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
      const header = (await page.getByTestId(`date-header-${date}`).boundingBox())!;
      const badge = (await page.getByTestId(`plans-${date}`).boundingBox())!;
      const check = (await page.getByTestId(`logged-${date}`).boundingBox())!;
      expect(Math.abs(header.x - badge.x)).toBeLessThan(1);
      expect(
        Math.abs(header.y - bounds.y - (bounds.y + bounds.height - badge.y - badge.height)),
      ).toBeLessThan(1);
      expect(Math.abs(check.x + check.width - (header.x + header.width))).toBeLessThan(1);
      const numberFont = await page
        .getByTestId(`date-number-${date}`)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      if (width === 800 || width === 1000) {
        expect(numberFont).toBeGreaterThanOrEqual(18);
        expect(check.width).toBeGreaterThanOrEqual(18);
      }
      for (const id of [`plans-${date}`, `climbs-${date}`]) {
        const badge = (await page.getByTestId(id).boundingBox())!;
        expect(Math.abs(badge.width - badge.height)).toBeLessThan(1);
        expect(badge.x).toBeGreaterThanOrEqual(bounds.x);
        expect(badge.x + badge.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(badge.y + badge.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        if (width === 800 || width === 1000) expect(badge.width).toBeGreaterThanOrEqual(24);
      }
    }).toPass();
    await cell.screenshot({ path: info.outputPath(`calendar-cell-${width}.png`) });
  }
});

test('calendar schedules templates and rest days, restores and removes plans', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Calendar tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`calendar-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await navigate(page, 'Templates');
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Push');
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
  await navigate(page, 'Calendar');
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plan workout', exact: true }).click();
  await page.getByLabel('Search templates', { exact: true }).fill('Push');
  await page.getByRole('button', { name: 'Schedule Push', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Push', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove Push', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next month', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add rest day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove rest day', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Remove rest day', exact: true }).click();
  await expect(
    page.getByText('This date will no longer be marked as a rest day.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove rest day', exact: true })
    .filter({ visible: true })
    .last()
    .click();
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Push', exact: true }).click();
  await page.getByRole('button', { name: 'Remove plan', exact: true }).click();
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
});
