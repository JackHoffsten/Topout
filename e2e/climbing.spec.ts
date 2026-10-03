import { test, expect } from '@playwright/test';

test('logs multiple climbs, restores, edits and deletes them from the calendar', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Climbing tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`climbing-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await expect(page.getByText('No climbs logged.', { exact: true })).toBeVisible();
  for (const grade of ['7A', '7B']) {
    await page.getByRole('button', { name: 'Log climb', exact: true }).click();
    await expect(page).toHaveURL(/\/climbs\/new\?date=/);
    await expect(page.getByRole('heading', { name: 'Log climb', exact: true })).toBeVisible();
    await expect(page.getByLabel('Date', { exact: true })).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    await page.getByLabel('Search grades', { exact: true }).fill(grade);
    await page.getByRole('button', { name: `Choose grade ${grade}`, exact: true }).click();
    await page.getByRole('radio', { name: 'Environment: Board', exact: true }).click();
    await page.getByRole('radio', { name: 'Wall angle: Overhang', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Crimpy', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Slopy', exact: true }).click();
    await page.getByLabel('Attempts this day', { exact: true }).fill('3');
    await page.getByLabel('Route name (optional)', { exact: true }).fill(`Problem ${grade}`);
    await page.getByLabel('Location (optional)', { exact: true }).fill('Training board');
    if (grade === '7A') {
      await page
        .getByRole('radio', { name: 'Climbing type: Bouldering', exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('climb-editor.png') });
    }
    await page.getByRole('button', { name: 'Save climb', exact: true }).click();
    await expect(
      page.getByRole('link', { name: `View climb Problem ${grade}`, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /2 climbs logged/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByText('No climbs logged.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /2 climbs logged/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add rest day', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('link', { name: 'Climbs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Climbs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log climb', exact: true }).click();
  await expect(page).toHaveURL(/\/climbs\/new\?returnTo=climbs/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Climbs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hardest', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Expand climb/ }).first()).toHaveAccessibleName(
    'Expand climb Problem 7B',
  );
  await page.getByRole('button', { name: 'Easiest', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Expand climb/ }).first()).toHaveAccessibleName(
    'Expand climb Problem 7A',
  );
  await page.getByLabel('Search name or location', { exact: true }).fill('7B');
  await expect(page.getByRole('button', { name: /^Expand climb/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page
    .getByRole('button', { name: 'Filter Grade system: Fontainebleau', exact: true })
    .click();
  await page.getByRole('button', { name: 'Select grade filter', exact: true }).click();
  await page.getByLabel('Search filter grades', { exact: true }).fill('7B');
  await page.getByRole('button', { name: 'Filter grade: 7B', exact: true }).click();
  await page.getByLabel('Search filter grades', { exact: true }).fill('7A');
  await page.getByRole('button', { name: 'Filter grade: 7A', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filter grade: 7A', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Filter Environment: Board', exact: true }).click();
  await page.getByRole('button', { name: 'Filter Environment: Indoor', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Expand climb/ })).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Expand climb Problem 7B', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Expand climb/ })).toHaveCount(1);
  await page.getByLabel('Search name or location', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: /^Expand climb/ })).toHaveCount(2);
  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await page.getByRole('link', { name: 'View climb Problem 7A', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Climbs', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Collapse climb Problem 7A', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Edit climb Problem 7A', exact: true }).click();
  await expect(page.getByLabel('Attempts this day', { exact: true })).toHaveValue('3');
  await expect(page.getByRole('checkbox', { name: 'Crimpy', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Crimpy', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: 'Crimpy', exact: true })).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: 'Crimpy', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Climbing type: Sport', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('radio', { name: 'Grade system: French', exact: true }),
  ).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('radio', { name: 'Climbing type: Top rope', exact: true }),
  ).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('radio', { name: 'Climbing type: Sport', exact: true }),
  ).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Environment: Board', exact: true })).toHaveCount(0);
  await page.getByLabel('Search grades', { exact: true }).fill('7a');
  await page.getByRole('button', { name: 'Choose grade 7a', exact: true }).click();
  await page.getByRole('radio', { name: 'Outcome: Onsight', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Sport · French · Indoor', { exact: true })).toBeVisible();
  await expect(page.getByText('1 attempt · Onsighted', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand climb Problem 7B', exact: true }).click();
  await page.getByRole('button', { name: 'Edit climb Problem 7B', exact: true }).click();
  await page.getByRole('radio', { name: 'Outcome: Attempted', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('3 attempts · Not sent', { exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
  for (const grade of ['7A', '7B']) {
    const expand = page.getByRole('button', { name: `Expand climb Problem ${grade}`, exact: true });
    if (await expand.count()) await expand.click();
    await page.getByRole('button', { name: `Delete climb Problem ${grade}`, exact: true }).click();
    await page.getByRole('button', { name: 'Delete climb', exact: true }).click();
    await expect(
      page.getByRole('button', { name: `Delete climb Problem ${grade}`, exact: true }),
    ).toHaveCount(0);
  }
  await expect(page.getByText('No climbs logged.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Add rest day', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log climb', exact: true })).toBeDisabled();
  await expect(
    page.getByText('Remove the rest day to log a climb.', { exact: true }),
  ).toBeVisible();
});
