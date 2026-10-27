import { expect, test } from '@playwright/test';

test('the shell boots, loads the seed and prices it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pour Register' })).toBeVisible();
  await expect(page.getByText('377 products (256 pours, 121 menu items)')).toBeVisible();
  // Bank Note 5yr Peated, 1 oz at 15% of frontline $21.70 → $6 (prototype-confirmed)
  const row = page.getByRole('row', { name: /1 oz/ });
  await expect(row).toContainText('$6');
  // no horizontal scroll on the target devices
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
