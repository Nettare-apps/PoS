/**
 * Library lifecycle flows (SPEC §7/§14): edit → draft → publish → revert,
 * history restore, happy hour rules, and the activity log.
 */
import { expect, test, type Page } from '@playwright/test';

async function openBankNote(page: Page) {
  await page.getByLabel('Search products').fill('Bank Note');
  await page.getByRole('button', { name: /Bank Note 5yr Peated/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
});

test('edit → unsaved → save draft → publish → revert to published', async ({ page }) => {
  await openBankNote(page);
  // raise frontline 21.70 → 25: the derived 1 oz price moves $6 → $7 in the editor
  await page.getByLabel('Frontline $').fill('25');
  await page.getByLabel('Frontline $').blur();
  await expect(page.getByText('Unsaved edits', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$7', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved · not yet published')).toBeVisible();

  // a saved draft survives a reload (and so does the working copy)
  await page.reload();
  await expect(page.getByText('Draft saved · not yet published')).toBeVisible();

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();

  // edit again, then drop everything back to the published library
  await openBankNote(page);
  await page.getByLabel('Frontline $').fill('30');
  await page.getByLabel('Frontline $').blur();
  await expect(page.getByText(/Unsaved edits/)).toBeVisible();
  await page.getByRole('button', { name: 'Revert to published' }).click();
  await expect(page.getByText('Drop every change since the last publish, including the saved draft?')).toBeVisible();
  await page.getByRole('button', { name: 'Revert', exact: true }).click();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
  await openBankNote(page);
  await expect(page.getByLabel('Frontline $')).toHaveValue('25');
});

test('discard edits returns to the saved draft after a two-step confirm', async ({ page }) => {
  await openBankNote(page);
  await page.getByLabel('Size (mL)').fill('700');
  await page.getByLabel('Size (mL)').blur();
  await expect(page.getByText('Unsaved edits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard edits' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
  await openBankNote(page);
  await expect(page.getByLabel('Size (mL)')).toHaveValue('750');
});

test('history keeps every publish and restores an old revision as a new one', async ({ page }) => {
  await openBankNote(page);
  await page.getByLabel('Frontline $').fill('25');
  await page.getByLabel('Frontline $').blur();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('#2')).toBeVisible();
  await expect(page.getByText('#1')).toBeVisible();
  // restore revision 1 → published as revision 3, with a revert badge
  await page.getByRole('listitem').filter({ hasText: '#1' }).getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  // the history panel reopens on its own once the confirm clears
  const rev3 = page.getByRole('listitem').filter({ hasText: '#3' });
  await expect(rev3).toContainText('revert');
  await expect(rev3).toContainText('current');
  await openBankNote(page);
  await expect(page.getByLabel('Frontline $')).toHaveValue('21.7');
});

test('happy hour rules: menu pricing and a midnight-crossing window', async ({ page }) => {
  await page.getByRole('button', { name: 'Happy hour' }).click();
  await page.getByLabel('Cocktails happy hour').selectOption('pct');
  // sub-menus read "Same as <parent>" when unset
  await expect(page.getByLabel('Whisky happy hour')).toContainText('Same as Spirits');
  // a window may cross midnight: flag it inline
  await page.getByLabel('Saturday end').fill('02:00');
  await expect(page.getByText('into Sunday')).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
});

test('the activity log records the lifecycle, committed and taps apart', async ({ page }) => {
  await openBankNote(page);
  await page.getByLabel('Pack').fill('2');
  await page.getByLabel('Pack').blur();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.locator('.evlist').getByText('library_publish').first()).toBeVisible();
  await expect(page.locator('.evlist').getByText('library_save_draft').first()).toBeVisible();
  // taps are recorded too, behind the committed-only filter
  await page.getByLabel('Committed actions only').uncheck();
  await expect(page.locator('.evlist li.tap').first()).toBeVisible();
});

test('modifiers: a group edit flows into the draft', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Library section' }).getByRole('button', { name: 'Modifiers' }).click();
  await page.getByRole('button', { name: /Cocktail styles/ }).click();
  await expect(page.getByRole('cell', { name: 'Old Fashioned', exact: true })).toBeVisible();
  // the wide Depletes selects must not blow the layout past the viewport (phone regression)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(page.getByText('Unsaved edits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved · not yet published')).toBeVisible();
});

test('inventory counts apply immediately, outside the publish cycle', async ({ page }) => {
  await openBankNote(page);
  await page.getByLabel('Bottles').fill('5');
  await page.getByLabel('Bottles').blur();
  // no draft state change — counts are not library data
  await expect(page.getByText('Published · no pending changes')).toBeVisible();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.locator('.evlist').getByText('count_set').first()).toBeVisible();
});
