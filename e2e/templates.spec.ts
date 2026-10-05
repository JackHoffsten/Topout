import { test, expect } from '@playwright/test';
import { navigate } from './navigation';

test('template CRUD persists targets, supports keyboard reordering and protects referenced exercises', async ({
  page,
}, info) => {
  await page.goto('/templates');
  await expect(page).toHaveURL(/login/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Template tester');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`templates-${Date.now()}-${info.project.name}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await navigate(page, 'Templates');
  await expect(page.getByText('No templates', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New template' }).click();
  await page.getByLabel('Template name', { exact: true }).fill('Pull');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Select Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Barbell Row set 1 reps', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Add set to Barbell Row', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 2 reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Barbell Row set 1 max reps (optional)', { exact: true }).fill('12');
  await page.getByLabel('Barbell Row set 1 weight (kg, optional)', { exact: true }).fill('30.5');
  await page.getByRole('switch', { name: 'Barbell Row set 1 warm-up', exact: true }).click();
  await page.getByRole('switch', { name: 'Barbell Row set 1 AMRAP', exact: true }).click();
  await page.getByLabel('Barbell Row set 2 reps', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Move Barbell Row set 2 up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveValue('6');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await expect(page.getByLabel('Barbell Row set 1 reps', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Back Squat');
  await page.getByRole('button', { name: 'Select Back Squat', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Move Back Squat up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.screenshot({ path: test.info().outputPath('template-editor.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await expect(page.getByText('2 exercises · 4 sets')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit Pull', exact: true })).toHaveCount(0);
  await page.getByLabel('Search templates', { exact: true }).fill('Barbell Row');
  await page.getByRole('button', { name: 'Name Z–A', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: 'Filter muscle group: Biceps', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('No templates match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: 'Filter muscle group: Back', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Filter muscle group: Biceps', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Filter muscle group: Back', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Expand template Pull', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByLabel('Search templates', { exact: true })).toHaveValue('Barbell Row');
  await expect(
    page.getByRole('button', { name: 'Expand template Pull', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Expand template Pull', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Collapse template Pull', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Edit Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Barbell Row', exact: true }).click();
  await expect(
    page.getByLabel('Barbell Row set 2 weight (kg, optional)', { exact: true }),
  ).toHaveValue('30.5');
  await expect(
    page.getByRole('switch', { name: 'Barbell Row set 2 AMRAP', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Move Back Squat up', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Template name', { exact: true }).fill('Pull updated');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pull updated', exact: true })).toBeVisible();
  await navigate(page, 'Exercises');
  await page.getByRole('button', { name: 'Delete Barbell Row', exact: true }).click();
  await page.getByRole('button', { name: 'Delete exercise', exact: true }).click();
  await expect(
    page.getByText('This exercise is used by a workout template or log.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep exercise', exact: true }).click();
  await navigate(page, 'Templates');
  await page.getByRole('button', { name: 'Expand template Pull updated', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Pull updated', exact: true }).click();
  await page.getByRole('button', { name: 'Delete template', exact: true }).click();
  await expect(page.getByText('No templates', { exact: true })).toBeVisible();
});
