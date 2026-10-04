import { test, expect } from '@playwright/test';
import { navigate } from './navigation';

test('public policies, password-confirmed deletion, and cleared browser sessions', async ({
  page,
  context,
}, info) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy', exact: true })).toBeVisible();
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();
  await expect(
    page.getByText('For help with Topout, contact jack.hoffsten@hotmail.se.'),
  ).toBeVisible();
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Review tester');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`delete-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await navigate(page, 'Account');
  await page.getByLabel('Current password', { exact: true }).fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page.getByText('Your password could not be verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    (await context.cookies()).some((cookie) => cookie.name === '__Secure-topout-refresh'),
  ).toBe(false);
  await page.goto('/account');
  await expect(page).toHaveURL(/login/);
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy', exact: true })).toBeVisible();
});
