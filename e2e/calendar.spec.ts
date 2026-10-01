import { test, expect } from '@playwright/test';

test('home calendar schedules templates and rest days, restores and removes plans', async ({
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
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Templates', exact: true }).click();
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Push');
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
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
  await page.getByRole('button', { name: 'Remove plan', exact: true }).click();
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Push', exact: true }).click();
  await page.getByRole('button', { name: 'Remove plan', exact: true }).click();
  await expect(page.getByText('No workouts planned.', { exact: true })).toBeVisible();
});
