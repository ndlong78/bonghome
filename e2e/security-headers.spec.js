const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

/*
 * Áp đúng các header trong _headers (khối "/*") lên mọi phản hồi cùng origin, rồi mở từng trang:
 * CSP không được chặn script, style, ảnh, nội dung JSON hay Service Worker nào của app.
 */

function readSecurityHeaders() {
  const lines = fs.readFileSync(path.resolve(__dirname, '..', '_headers'), 'utf8').split('\n');
  const headers = {};
  let inGlobalBlock = false;
  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      inGlobalBlock = line.trim() === '/*';
      continue;
    }
    if (inGlobalBlock) {
      const separator = line.indexOf(':');
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }
  return headers;
}

const SECURITY_HEADERS = readSecurityHeaders();
const PAGES = ['/index.html', '/parents.html', '/collection.html', ...Array.from({ length: 13 }, (_, index) => `/game${index + 1}.html`)];

async function withSecurityHeaders(page) {
  const violations = [];
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  await page.context().route('**/*', async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== new URL(page.url() === 'about:blank' ? 'http://127.0.0.1:4173' : page.url()).origin) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...SECURITY_HEADERS } });
  });
  return violations;
}

test('_headers có CSP và nosniff', () => {
  expect(SECURITY_HEADERS['content-security-policy']).toContain("default-src 'self'");
  expect(SECURITY_HEADERS['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
});

test.describe('CSP không chặn trang nào của app', () => {
  test.use({ serviceWorkers: 'block' });

  for (const pathname of PAGES) {
    test(`${pathname} chạy đủ dưới CSP`, async ({ page }) => {
      const violations = await withSecurityHeaders(page);
      const response = await page.goto(pathname, { waitUntil: 'load' });
      expect(response.headers()['content-security-policy']).toBe(SECURITY_HEADERS['content-security-policy']);
      await page.evaluate(() => window.BongModulesReady);
      await page.waitForLoadState('networkidle');
      const domViolations = await page.evaluate(() => window.__cspViolations);
      expect([...violations, ...domViolations], `${pathname} không được có vi phạm CSP`).toEqual([]);
      expect(await page.evaluate(() => Boolean(window.BongStorage && window.BongProgress && window.BongRewards))).toBe(true);
    });
  }
});

test('Service Worker đăng ký được dưới CSP', async ({ page }) => {
  const violations = await withSecurityHeaders(page);
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const domViolations = await page.evaluate(() => window.__cspViolations);
  expect([...violations, ...domViolations]).toEqual([]);
});
