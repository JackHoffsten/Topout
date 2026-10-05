import { test, expect } from '@playwright/test';

test('location suggestions survive real click and touch blur ordering', async ({ page }, info) => {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Location tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`locations-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.route('**/api/log-locations?**', (route) => route.fulfill({ json: ['Central Gym'] }));
  await page.goto('/climbs/new');
  const field = page.getByLabel('Location (optional)', { exact: true });
  await field.fill('Cent');
  const suggestion = page.getByRole('button', { name: 'Use location Central Gym', exact: true });
  await expect(suggestion).toBeVisible();
  if (info.project.name === 'phone') await suggestion.tap();
  else await suggestion.click();
  await expect(field).toHaveValue('Central Gym');
  await expect(suggestion).toBeHidden();
  await field.fill('Cent');
  await expect(suggestion).toBeVisible();
  await page.getByLabel('Route name (optional)', { exact: true }).click();
  await expect(suggestion).toBeHidden();
});
