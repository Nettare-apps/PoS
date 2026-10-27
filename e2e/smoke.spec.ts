import { expect, test } from '@playwright/test';

test('the library boots, loads the seed and prices it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pour Register' })).toBeVisible();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
  // the seed loads: search finds Bank Note, whose 1 oz at 15% of $21.70 is $6
  await page.getByLabel('Search products').fill('Bank Note');
  await page.getByRole('button', { name: /Bank Note 5yr Peated/ }).click();
  await expect(page.getByRole('cell', { name: '$6', exact: true })).toBeVisible();
  // no horizontal scroll on the target devices
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
