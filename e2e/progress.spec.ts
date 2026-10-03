import { test, expect } from '@playwright/test';

test('progress overview and exercise/climbing graphs work on phone and desktop', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Progress tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`progress-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  const [registration] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/web/register') && response.status() === 201,
    ),
    page.getByRole('button', { name: 'Create account', exact: true }).click(),
  ]);
  const { accessToken } = await registration.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('No logged activity in this period.', { exact: true })).toBeVisible();
  const exerciseResponse = await page.request.post('/api/exercises', {
    headers,
    data: { name: 'Progress curl', muscleGroups: ['Biceps'] },
  });
  expect(exerciseResponse.status()).toBe(201);
  const exercise = await exerciseResponse.json();
  const templateResponse = await page.request.post('/api/workout-templates', {
    headers,
    data: {
      name: 'Progress day',
      exercises: [{ exerciseId: exercise.id, sets: [] }],
    },
  });
  expect(templateResponse.status()).toBe(201);
  const template = await templateResponse.json();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i) * 7);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    dates.push(date);
    const planResponse = await page.request.post('/api/workout-schedule', {
      headers,
      data: { date, templateId: template.id },
    });
    expect(planResponse.status()).toBe(201);
    const plan = await planResponse.json();
    for (const side of ['Left', 'Right']) {
      const result = await page.request.put(`/api/workout-schedule/${plan.id}/log/sets`, {
        headers,
        data: {
          exerciseId: exercise.id,
          order: 1,
          side,
          reps: 8 + i,
          weightKg: 10 + i * 2 + (side === 'Right' ? 2 : 0),
          isWarmup: false,
          notes: null,
        },
      });
      expect(result.status()).toBe(200);
    }
    const climbResponse = await page.request.post('/api/climb-logs', {
      headers,
      data: {
        date,
        climbingType: 'Bouldering',
        gradeSystem: 'Font',
        grade: ['6A', '6A+', '6B', '6B+', '6C', '6C+', '7A'][i],
        environment: 'Indoor',
        attempts: i % 2 ? 3 : 1,
        outcome: i % 2 ? 'Redpoint' : 'Flash',
        wallAngle: 'Overhang',
        styles: [],
        name: null,
        location: null,
      },
    });
    expect(climbResponse.status()).toBe(201);
  }
  await page.reload();
  await expect(page.getByText('Weekly activity', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('progress-overview.png') });
  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('curl');
  await page
    .getByRole('button', { name: 'Select progress exercise Progress curl', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Volume', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('button', {
      name: `Progress curl · Volume, Left, ${dates[6]}, 308 kg`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Heaviest weight', exact: true }).click();
  const latestLeft = page.getByRole('button', {
    name: `Progress curl · Heaviest weight, Left, ${dates[6]}, 22 kg`,
    exact: true,
  });
  await expect(latestLeft).toBeVisible();
  await page
    .getByRole('button', { name: 'Previous point in Progress curl · Heaviest weight', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(`${dates[5]} · Left: 20 kg · Right: 22 kg`, { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('progress-exercise.png') });
  await page.getByRole('button', { name: 'Left', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Progress curl · Heaviest weight, Right/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: `Progress curl · Volume, Left, ${dates[6]}, 308 kg`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show values', exact: true }).click();
  await expect(page.getByText(`${dates[0]} · Left: 80 kg`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Climbing', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: `Hardest grade sent, Fontainebleau, ${dates[6]}, 7A`,
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('progress-climbing.png') });
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByText('No sends for this selection.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sport', exact: true }).click();
  await expect(page.getByRole('button', { name: 'French', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: info.outputPath('progress-dark.png') });
  if (info.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(page.getByRole('link', { name: 'Progress', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    await page.screenshot({ path: info.outputPath('progress-narrow.png') });
  }
  expect(errors).toEqual([]);
});
