import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('trang chủ tải đủ điều khiển chính', async ({ page }) => {
  await expect(page).toHaveTitle(/Bông/i);
  await expect(page.getByRole('button', { name: /15 phút/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /20 phút/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /phụ huynh/i })).toBeVisible();
  await expect(page.locator('.bh-step')).toHaveCount(10);
});

test('hồ sơ Bông được tạo và lưu cục bộ', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Bông/i })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome_state_v2')));
  expect(state.profiles.some((profile) => profile.name === 'Bông')).toBeTruthy();
});

test('bắt đầu phiên 15 phút và hiển thị đồng hồ', async ({ page }) => {
  await page.getByRole('button', { name: /15 phút/i }).click();
  await expect(page).toHaveURL(/game1\.html\?session=/);
  await expect(page.getByRole('button', { name: /Kết thúc buổi chơi/i })).toBeVisible();
  await expect(page.locator('.bh-session')).toContainText(/14:|15:/);
});

test('kết thúc sớm hiển thị tổng kết nhẹ nhàng', async ({ page }) => {
  await page.getByRole('button', { name: /15 phút/i }).click();
  await page.getByRole('button', { name: /Kết thúc buổi chơi/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/buổi chơi|hoàn thành|nghỉ/i);
});

test('trang phụ huynh hiển thị tiến độ và lịch sử', async ({ page }) => {
  await page.goto('/parent.html');
  await expect(page.getByRole('heading', { name: /phụ huynh/i })).toBeVisible();
  await expect(page.locator('.bh-step')).toHaveCount(10);
});

test('không có cuộn ngang ở viewport hiện tại', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
});
