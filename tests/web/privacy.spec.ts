import { expect, test } from '@playwright/test';
import { watch } from './helpers';

test('privacy: four promises and the way back', async ({ page }) => {
  const seen = watch(page);
  await page.goto('./privacy.html');
  await expect(page).toHaveTitle('Holdline privacy');
  await expect(page.locator('h2')).toHaveText(['No account', 'No tracking', 'Progress stays on this device', 'No camera access']);
  await expect(page.locator('a.back')).toHaveAttribute('href', './');
  expect(seen.errors).toEqual([]);
  expect(seen.foreign).toEqual([]);
});
