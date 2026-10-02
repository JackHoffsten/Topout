import { test, expect } from '@playwright/test';
test('registration, restoration, exercise CRUD, keyboard access, and logout', async ({
  page,
  context,
}, info) => {
  const email = `web-${Date.now()}-${info.project.name}@example.com`;
  await page.goto('/exercises');
  await expect(page).toHaveURL(/login/);
  const emailField = page.getByRole('textbox', { name: 'Email', exact: true });
  await expect(emailField).toHaveCSS('font-size', info.project.name === 'phone' ? '16px' : '14px');
  await emailField.focus();
  await emailField.blur();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.fonts).some(
          (font) => font.family.replace(/["']/g, '') === 'CascadiaMono' && font.status === 'loaded',
        ),
      ),
    )
    .toBe(true);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Climber');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exercises', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  await expect(
    page.getByTestId(info.project.name === 'phone' ? 'phone-navigation' : 'desktop-navigation'),
  ).toBeVisible();
  const refresh = (await context.cookies()).find((c) => c.name === '__Secure-topout-refresh');
  expect(refresh).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/auth/web',
  });
  expect(await page.evaluate(() => document.cookie)).not.toContain('__Secure-topout-refresh');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto('/exercises');
  await expect(otherTab.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  await Promise.all([page.reload(), otherTab.reload()]);
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  await expect(otherTab.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /New exercise/ }).click();
  await page.getByLabel('Exercise name', { exact: true }).fill('Test pull-up');
  await page.getByRole('checkbox', { name: 'Back', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Biceps', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Create exercise', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Search exercises', { exact: true }).fill('Test pull-up');
  await expect(page.getByLabel('Search exercises', { exact: true })).toHaveCSS(
    'font-size',
    info.project.name === 'phone' ? '16px' : '14px',
  );
  await expect(page.getByLabel('Search exercises', { exact: true })).toHaveCSS(
    'outline-width',
    '0px',
  );
  await expect(page.getByLabel('Search exercises', { exact: true })).toHaveCSS(
    'outline-style',
    'none',
  );
  expect(
    await page
      .getByLabel('Search exercises', { exact: true })
      .evaluate((element) => getComputedStyle(element.parentElement!).borderTopWidth),
  ).toBe('1px');
  await expect(page.getByRole('button', { name: 'Refresh exercises' })).toHaveCount(0);
  await expect(page.getByText('Test pull-up', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit Test pull-up' }).click();
  await expect(page.getByRole('checkbox', { name: 'Back', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Biceps', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Back', exact: true }).click();
  await page.getByLabel('Exercise name', { exact: true }).fill('Updated pull-up');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Updated pull-up');
  await expect(page.getByText('Updated pull-up', { exact: true })).toBeVisible();
  await expect(page.getByText('Biceps', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('exercise-library.png'), fullPage: true });
  await page.bringToFront();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(
    page.getByTestId(info.project.name === 'phone' ? 'phone-navigation' : 'desktop-navigation'),
  ).toHaveCSS('background-color', 'rgb(25, 26, 27)');
  await page.screenshot({
    path: test.info().outputPath('exercise-library-dark.png'),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Delete Updated pull-up' }).click();
  await page.getByRole('button', { name: 'Delete exercise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No exercises found' })).toBeVisible();
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login/);
  await expect(otherTab).toHaveURL(/login/);
  await page.goto('/exercises/new');
  await expect(page).toHaveURL(/login/);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .filter({ visible: true })
    .fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exercises', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exercises', exact: true })).toBeVisible();
  await expect(page.getByText('Updated pull-up', { exact: true })).toHaveCount(0);
});
