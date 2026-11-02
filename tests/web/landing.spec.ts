import { expect, test } from '@playwright/test';
import { watch } from './helpers';

test('landing: name, line, facts, privacy link, favicon, no errors, no third party', async ({ page, request }, info) => {
  const seen = watch(page);
  await page.goto('./');
  await expect(page).toHaveTitle('Holdline');
  await expect(page.locator('.wordmark')).toHaveText('Holdline');
  await expect(page.locator('.tagline')).toHaveText('One wildfire a day, on your real table.');
  await expect(page.locator('.facts li')).toHaveText(['Hands only.', 'Seated.', '5 minutes.']);
  await expect(page.locator('a.link')).toHaveAttribute('href', './privacy.html');
  for (const href of ['./favicon.svg', './favicon.ico', './icon-192.png', './hero.webp']) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
  if (info.project.name === 'prod') {
    // A desktop browser cannot start mixed reality: one line says where to open the page.
    await expect(page.locator('.note')).toHaveText('Open this page in the Meta Quest browser.', { timeout: 30000 });
  } else {
    // The dev server injects the emulator: the button is ready instead.
    await expect(page.locator('.enter')).toBeEnabled({ timeout: 60000 });
  }
  await page.waitForTimeout(2000);
  expect(seen.errors).toEqual([]);
  expect(seen.foreign).toEqual([]);
});
