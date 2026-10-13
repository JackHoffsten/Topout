import { test, expect } from '@playwright/test';
import { navigate } from './navigation';

test('logs actual sets, completes the calendar plan, and restores the workout record', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Workout tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`logging-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await navigate(page, 'Templates');
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Pull');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Select Barbell Row', exact: true }).click();
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await page.getByLabel('Barbell Row set 2 reps', { exact: true }).fill('8');
  await page
    .getByRole('button', { name: 'Split Barbell Row set 2 left/right', exact: true })
    .click();
  await page.getByLabel('Barbell Row set 2 left weight (kg, optional)', { exact: true }).fill('20');
  await page.getByLabel('Barbell Row set 2 right reps', { exact: true }).fill('9');
  await page
    .getByLabel('Barbell Row set 2 right weight (kg, optional)', { exact: true })
    .fill('22.5');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pull', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand template Pull', exact: true }).click();
  await expect(page.getByText('Left: 8 reps (20 kg)', { exact: true })).toBeVisible();
  await expect(page.getByText('Right: 9 reps (22.5 kg)', { exact: true })).toBeVisible();
  await navigate(page, 'Calendar');
  await page.getByRole('button', { name: 'Plan workout', exact: true }).click();
  await page.getByRole('button', { name: 'Schedule Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Log workout', exact: true }).click();
  await page
    .getByRole('button', { name: 'Unsplit Barbell Row set 2 left/right', exact: true })
    .click();
  await expect(page.getByLabel('Barbell Row set 2 reps', { exact: true })).toHaveValue('');
  await page
    .getByRole('button', { name: 'Split Barbell Row set 2 left/right', exact: true })
    .click();
  await expect(page.getByLabel('Barbell Row set 2 right reps', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(
    page.getByText('Enter reps and weight for each set, or remove sets you did not complete.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('9');
  await page.getByLabel('Barbell Row set 1 weight (kg)', { exact: true }).fill('40');
  await page.getByRole('button', { name: 'Barbell Row set 1 toggle warm-up', exact: true }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/log/sets') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }).click(),
  ]);
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('9');
  await expect(page.getByLabel('Barbell Row set 2 left reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Barbell Row set 2 left reps', { exact: true }).fill('7');
  await page.getByLabel('Barbell Row set 2 left weight (kg)', { exact: true }).fill('20');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/log/sets') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Log Barbell Row set 2 left', exact: true }).click(),
  ]);
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 2 left', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Barbell Row set 2 left reps', { exact: true })).toHaveValue('7');
  await expect(page.getByLabel('Barbell Row set 2 right reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Barbell Row set 2 right reps', { exact: true }).fill('9');
  await page.getByLabel('Barbell Row set 2 right weight (kg)', { exact: true }).fill('22.5');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/log/sets') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Log Barbell Row set 2 right', exact: true }).click(),
  ]);
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 2 right', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Workout notes (optional)', { exact: true }).fill('Training notes');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Workout log', exact: true })).toBeVisible();
  await expect(page.getByText('Training notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 2 left reps', { exact: true })).toHaveValue('7');
  await expect(page.getByLabel('Barbell Row set 2 right reps', { exact: true })).toHaveValue('9');
  await page.getByLabel('Barbell Row set 2 right reps', { exact: true }).fill('10');
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('11');
  await page.getByLabel('Workout notes (optional)', { exact: true }).fill('Updated notes');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/log$/.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Save changes', exact: true }).click(),
  ]);
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('11');
  await expect(page.getByLabel('Barbell Row set 2 right reps', { exact: true })).toHaveValue('10');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/log$/.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Save changes', exact: true }).click(),
  ]);
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('workout-log.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Calendar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View workout log', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add rest day', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /workout logged/ })).toBeVisible();
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: info.outputPath('logged-calendar.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Remove Pull', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'View workout log', exact: true }).click();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Remove log for Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Keep log', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View workout log', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove log for Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Remove workout log', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Pull', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /workout logged/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove Pull', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Remove plan', exact: true }).click();
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add rest day', exact: true })).toBeEnabled();
});

test('replaces an unlogged exercise and restores its split set structure', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Replacement tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`replacement-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/web/register') && response.status() === 201,
      { timeout: 60000 },
    ),
    page.getByRole('button', { name: 'Create account', exact: true }).click(),
  ]);
  await navigate(page, 'Templates');
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Replacement plan');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Select Barbell Row', exact: true }).click();
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('8');
  await page
    .getByRole('button', { name: 'Split Barbell Row set 1 left/right', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Replacement plan', exact: true })).toBeVisible();
  await navigate(page, 'Calendar');
  await page.getByRole('button', { name: 'Plan workout', exact: true }).click();
  await page.getByRole('button', { name: 'Schedule Replacement plan', exact: true }).click();
  await page.getByRole('button', { name: 'Log workout', exact: true }).click();
  await page.getByLabel('Barbell Row set 1 left reps', { exact: true }).fill('99');
  await page.getByLabel('Barbell Row set 1 left weight (kg)', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Replace Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Search exercises', { exact: true })).toBeFocused();
  await page.getByLabel('Search exercises', { exact: true }).fill('Bench Press');
  await page.getByRole('button', { name: 'Replace with Bench Press', exact: true }).click();
  await expect(page.getByLabel('Bench Press set 1 left reps', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Bench Press set 1 left reps', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Bench Press set 1 left weight (kg)', { exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByLabel('Bench Press set 1 left reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '',
  );
  await page.reload();
  await expect(page.getByLabel('Bench Press set 1 left reps', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Bench Press set 1 right reps', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace Barbell Row', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Add set to Bench Press', exact: true }).click();
  await page.getByLabel('Bench Press set 2 reps', { exact: true }).fill('11');
  await page.getByLabel('Bench Press set 2 weight (kg)', { exact: true }).fill('10');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/log/sets') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Log Bench Press set 2', exact: true }).click(),
  ]);
  await expect(
    page.getByRole('button', { name: 'Log Bench Press set 2', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Bench Press set 2 reps', { exact: true })).toHaveValue('11');
  await expect(page.getByLabel('Bench Press set 1 right reps', { exact: true })).toBeVisible();
});

test('replacement preserves recorded results, confirms changes, retries errors, and uses its own history', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const csrf = await (await page.request.get('/api/auth/web/csrf')).json();
  const registration = await page.request.post('/api/auth/web/register', {
    headers: { Origin: 'https://localhost:8443', 'X-CSRF-Token': csrf.csrfToken },
    data: {
      displayName: 'Replacement history tester',
      email: `replacement-history-${Date.now()}-${info.project.name}@example.com`,
      password: 'StrongPassword123!',
    },
  });
  expect(registration.ok(), await registration.text()).toBe(true);
  const { accessToken } = await registration.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const library = await (await page.request.get('/api/exercises', { headers })).json();
  const row = library.find((e: { name: string }) => e.name === 'Barbell Row');
  const bench = library.find((e: { name: string }) => e.name === 'Bench Press');
  const squat = library.find((e: { name: string }) => e.name === 'Back Squat');
  const planSet = {
    targetRepsMin: 8,
    targetRepsMax: null,
    targetWeightKg: 40,
    isWarmup: false,
    isAmrap: false,
    rightTarget: null,
  };
  const template = await (
    await page.request.post('/api/workout-templates', {
      headers,
      data: {
        name: 'Replacement history plan',
        exercises: [
          {
            exerciseId: row.id,
            sets: [
              planSet,
              {
                ...planSet,
                rightTarget: { targetRepsMin: 9, targetRepsMax: null, targetWeightKg: 22 },
              },
            ],
          },
          { exerciseId: squat.id, sets: [planSet] },
        ],
      },
    })
  ).json();
  const today = new Date();
  const date = (day: Date) =>
    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const prior = await (
    await page.request.post('/api/workout-schedule', {
      headers,
      data: { date: date(yesterday), templateId: template.id },
    })
  ).json();
  expect(
    (
      await page.request.post(`/api/workout-schedule/${prior.id}/log`, {
        headers,
        data: {
          notes: null,
          exercises: [
            {
              exerciseId: bench.id,
              sets: [
                { order: 1, side: 'Both', reps: 12, weightKg: 30, isWarmup: false, notes: null },
                { order: 2, side: 'Left', reps: 13, weightKg: 14, isWarmup: false, notes: null },
                { order: 2, side: 'Right', reps: 15, weightKg: 16, isWarmup: false, notes: null },
              ],
            },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  const schedule = await (
    await page.request.post('/api/workout-schedule', {
      headers,
      data: { date: date(today), templateId: template.id },
    })
  ).json();
  await page.goto(`/workouts/${schedule.id}`);
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('7');
  await page.getByLabel('Barbell Row set 1 weight (kg)', { exact: true }).fill('20');
  await page.getByLabel('Barbell Row set 1 notes', { exact: true }).fill('Recorded note');
  await page.getByRole('button', { name: 'Barbell Row set 1 toggle warm-up', exact: true }).click();
  await page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Replace Barbell Row', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Replace with Back Squat', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close exercise picker', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('7');
  await page.getByRole('button', { name: 'Replace Barbell Row', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Bench Press');
  await page.getByRole('button', { name: 'Replace with Bench Press', exact: true }).click();
  await expect(page.getByText('Logged sets will be relabelled', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Keep original exercise', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('7');
  await page.getByRole('button', { name: 'Replace Barbell Row', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Bench Press');
  await page.getByRole('button', { name: 'Replace with Bench Press', exact: true }).click();
  await page.route(
    '**/replacement',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'Please retry replacement.' }),
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm replacement', exact: true }),
  ).toBeEnabled();
  await expect(page.getByText('Please retry replacement.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await expect(page.getByLabel('Bench Press set 1 reps', { exact: true })).toHaveValue('7');
  await expect(page.getByLabel('Bench Press set 1 weight (kg)', { exact: true })).toHaveValue('20');
  await expect(page.getByLabel('Bench Press set 1 notes', { exact: true })).toHaveValue(
    'Recorded note',
  );
  await expect(
    page.getByRole('button', { name: 'Bench Press set 1 toggle warm-up', exact: true }),
  ).toHaveText('Warm-up: on');
  await expect(page.getByLabel('Bench Press set 2 left reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '13',
  );
  await expect(
    page.getByLabel('Bench Press set 2 right weight (kg)', { exact: true }),
  ).toHaveAttribute('placeholder', '16');
  await expect(page.getByLabel('Back Squat set 1 reps', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Bench Press set 1 reps', { exact: true })).toHaveValue('7');
  await expect(page.getByLabel('Bench Press set 2 right reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '15',
  );
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout log', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update template', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Back Squat', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(page.getByLabel('Back Squat set 1 reps', { exact: true })).toHaveCount(0);
  await page.getByLabel('Bench Press set 2 left notes', { exact: true }).fill('Unsaved note');
  await page.getByRole('button', { name: 'Replace Bench Press', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Replace with Barbell Row', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 2 left notes', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Barbell Row set 2 left reps', { exact: true })).toHaveValue('13');
  await expect(page.getByLabel('Barbell Row set 2 right weight (kg)', { exact: true })).toHaveValue(
    '16',
  );
  await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/log$/.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: 'Save changes', exact: true }).click(),
  ]);
  await page.reload();
  await expect(page.getByText('Recorded note', { exact: true })).toBeVisible();
  await navigate(page, 'Templates');
  await page
    .getByRole('button', { name: 'Expand template Replacement history plan', exact: true })
    .click();
  await expect(page.getByText('Left: 8 reps (40 kg)', { exact: true })).toBeVisible();
});
