import { expect, test } from '@playwright/test';

// Needs the IWSDK emulator, which only the dev server injects.
test('enter mixed reality starts a session in the emulator', async ({ page }, info) => {
  test.skip(info.project.name !== 'dev', 'emulator is dev only');
  await page.goto('./');
  const enter = page.locator('.enter');
  await expect(enter).toBeEnabled({ timeout: 60000 });
  await enter.click();
  await expect(page.locator('#landing')).toBeHidden({ timeout: 30000 });
});
