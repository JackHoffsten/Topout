import { test, expect } from '@playwright/test';

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
  await page.getByRole('link', { name: 'Templates', exact: true }).click();
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Pull');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Select Barbell Row', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pull', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Plan workout', exact: true }).click();
  await page.getByRole('button', { name: 'Schedule Pull', exact: true }).click();
  await page.getByRole('link', { name: 'Log workout', exact: true }).click();
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
  await page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 1', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('9');
  await expect(page.getByLabel('Barbell Row set 2 reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Barbell Row set 2 reps', { exact: true }).fill('7');
  await page.getByLabel('Barbell Row set 2 weight (kg)', { exact: true }).fill('42.5');
  await page.getByRole('button', { name: 'Log Barbell Row set 2', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Log Barbell Row set 2', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Workout notes (optional)', { exact: true }).fill('Training notes');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Workout log', exact: true })).toBeVisible();
  await expect(page.getByText('Training notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('11');
  await page.getByLabel('Workout notes (optional)', { exact: true }).fill('Updated notes');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('11');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('workout-log.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add rest day', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /workout logged/ })).toBeVisible();
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: info.outputPath('logged-calendar.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Remove Pull', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View workout log', exact: true }).click();
  await expect(page.getByText('Updated notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await page.getByRole('button', { name: 'Remove log for Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Keep log', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
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
