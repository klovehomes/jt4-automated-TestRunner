import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://jprom.jt4llc.com/SpecialPay_3');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Special Pay/);
});

test('see approval page', async ({ page }) => {
  await page.goto('https://jprom.jt4llc.com/SpecialPay_3/Approval.aspx');

  // Click the get started link.
  await page.getByRole('button', { name: 'Deny' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Approval' })).toBeVisible();
});