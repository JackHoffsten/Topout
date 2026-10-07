import { test, expect } from '@playwright/test';

test('unfinished projects can be resumed, completed, filtered, and reopened', async ({
  page,
}, info) => {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Project tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`project-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/calendar');
  await page.getByRole('button', { name: 'Mark climbing day', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove climbing day', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add rest day', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Remove climbing day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark climbing day', exact: true })).toBeVisible();
  await page.goto('/climbs/new?returnTo=climbs');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-03');
  await page.getByRole('button', { name: 'Mark climb as project', exact: true }).click();
  await page.getByRole('radio', { name: 'Outcome: Attempted', exact: true }).click();
  await page.getByLabel('Attempts this day', { exact: true }).fill('3');
  await page.getByLabel('Search grades', { exact: true }).fill('7A');
  await page.getByRole('button', { name: 'Choose grade 7A', exact: true }).click();
  await page.getByLabel('Route name (optional)', { exact: true }).fill('Blue project');
  await page.getByRole('button', { name: 'Save climb', exact: true }).click();
  await page.waitForURL('**/climbs');
  await expect(page.getByText('Project · Unfinished', { exact: true })).toBeVisible();
  await page.goto('/calendar?date=2026-10-03');
  await expect(
    page.getByRole('link', { name: 'View climb Blue project', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark climbing day', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove climbing day', exact: true })).toHaveCount(
    0,
  );
  await page.goto('/climbs/new?returnTo=climbs');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-04');
  await page.getByRole('button', { name: 'Choose unfinished project', exact: true }).click();
  await page.getByLabel('Search projects', { exact: true }).fill('blue');
  await page.getByRole('button', { name: 'Choose project Blue project', exact: true }).click();
  await page.getByRole('radio', { name: 'Attempt count: Unknown', exact: true }).click();
  await expect(page.getByLabel('Attempts this day', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save climb', exact: true }).click();
  await page.waitForURL('**/climbs');
  await expect(page.getByText('3+ attempts total · Not sent', { exact: true })).toBeVisible();
  await page.goto('/climbs/new?returnTo=climbs');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-05');
  await page.getByRole('button', { name: 'Choose unfinished project', exact: true }).click();
  await page.getByRole('button', { name: 'Choose project Blue project', exact: true }).click();
  await expect(page.getByLabel('Route name (optional)', { exact: true })).toHaveValue(
    'Blue project',
  );
  await expect(page.getByRole('heading', { name: '7A', exact: true })).toBeVisible();
  await expect(
    page.getByText('Flash and onsight are unavailable after previous project attempts.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Outcome: Flash', exact: true })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Outcome: Onsight', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Outcome: Day flash', exact: true }).click();
  await expect(page.getByLabel('Attempts this day', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save climb', exact: true }).click();
  await page.waitForURL('**/climbs');
  await expect(page.getByText('Project · Completed', { exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page
    .getByRole('button', { name: 'Filter projects: Unfinished projects', exact: true })
    .click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('No climbs match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page
    .getByRole('button', { name: 'Filter projects: Completed projects', exact: true })
    .click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('Project · Completed', { exact: true })).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Expand climb Blue project', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Delete climb Blue project', exact: true }).click();
  await page.getByRole('button', { name: 'Delete climb', exact: true }).click();
  await page.goto('/climbs/new?returnTo=climbs');
  await page.getByRole('button', { name: 'Choose unfinished project', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose project Blue project', exact: true }),
  ).toBeVisible();
});
