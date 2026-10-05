import { test, expect } from '@playwright/test';

test('templates preserve unset reps and exercises without planned sets', async ({ page }, info) => {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Optional targets tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`optional-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.goto('/templates/new');
  await page.getByLabel('Template name', { exact: true }).fill('Optional');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Select Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await page.waitForURL('**/templates');
  await page.getByRole('button', { name: 'Expand template Optional', exact: true }).click();
  await expect(page.getByText('Reps not planned', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit Optional', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Remove Barbell Row set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL('**/templates');
  await page.getByRole('button', { name: 'Expand template Optional', exact: true }).click();
  await expect(page.getByText('No sets', { exact: true })).toBeVisible();
});
