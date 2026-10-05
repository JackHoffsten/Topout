import { test, expect } from '@playwright/test';

test('climb photo uploads, restores when expanded, and can be removed', async ({ page }, info) => {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Photo tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`photo-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.goto('/climbs/new?returnTo=climbs');
  await page.getByLabel('Search grades', { exact: true }).fill('7A');
  await page.getByRole('button', { name: 'Choose grade 7A', exact: true }).click();
  await page.getByLabel('Route name (optional)', { exact: true }).fill('Photo climb');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add photo', exact: true }).click();
  await (await chooser).setFiles('apps/app/assets/topout-icon.png');
  await expect(page.getByRole('img', { name: 'Climb photo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save climb', exact: true }).click();
  await page.waitForURL('**/climbs');
  await page.goto('/climbs');
  await page.getByRole('button', { name: 'Expand climb Photo climb', exact: true }).click();
  const image = page.getByRole('img', { name: 'Climb photo', exact: true });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => {
        const img = element instanceof HTMLImageElement ? element : element.querySelector('img');
        return img?.naturalWidth ?? 0;
      }),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Edit climb Photo climb', exact: true }).click();
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit climb Photo climb', exact: true }),
  ).toBeVisible();
  await expect(image).toHaveCount(0);
});
