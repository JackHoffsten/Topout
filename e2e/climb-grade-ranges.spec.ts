import { test, expect } from '@playwright/test';

test('two distinct grades save as an ordered range and restore for editing', async ({
  page,
}, info) => {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Range tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`range-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.goto('/climbs/new?returnTo=climbs');
  await expect(page.getByText('No grade selected', { exact: true })).toBeVisible();
  const search = page.getByLabel('Search grades', { exact: true });
  await search.fill('6C');
  await page.getByRole('button', { name: 'Choose grade 6C', exact: true }).click();
  await search.fill('6B');
  await page.getByRole('button', { name: 'Choose grade 6B', exact: true }).click();
  await expect(page.getByRole('heading', { name: '6B - 6C', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose grade 6B+', exact: true })).toBeDisabled();
  await page.getByLabel('Route name (optional)', { exact: true }).fill('Range climb');
  await page.getByRole('button', { name: 'Save climb', exact: true }).click();
  await page.waitForURL('**/climbs');
  await page.reload();
  await page.getByRole('button', { name: 'Expand climb Range climb', exact: true }).click();
  await page.getByRole('button', { name: 'Edit climb Range climb', exact: true }).click();
  await expect(page.getByRole('heading', { name: '6B - 6C', exact: true })).toBeVisible();
  for (const grade of ['6B', '6C']) {
    await expect(
      page.getByRole('button', { name: `Choose grade ${grade}`, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'Choose grade 6C', exact: true }).click();
  await expect(page.getByRole('heading', { name: '6B', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit climb Range climb', exact: true }),
  ).toBeVisible();
});
