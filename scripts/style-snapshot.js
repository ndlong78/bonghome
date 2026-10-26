#!/usr/bin/env node
'use strict';

/*
 * Chụp kiểu đã tính (getComputedStyle + kích thước) của mọi phần tử trên cả 16 trang ở 3 viewport (iPhone, iPad,
 * desktop), game 1–10 thêm trạng thái hộp thắng mở; random, đồng hồ và animation được cố định nên hai lần chụp cùng mã cho kết quả
 * giống hệt. Dùng khi dọn CSS: chụp trước, sửa, chụp sau, so sánh phải ra 0 khác biệt.
 *
 *   python3 -m http.server 4181 --bind 127.0.0.1 &
 *   node scripts/style-snapshot.js capture http://127.0.0.1:4181 before.json
 *   # ... sửa CSS ...
 *   node scripts/style-snapshot.js capture http://127.0.0.1:4181 after.json
 *   node scripts/style-snapshot.js compare before.json after.json
 *
 * Chưa cài trình duyệt của Playwright thì trỏ tới Chromium có sẵn: CHROMIUM_PATH=/đường/dẫn/chromium.
 */
const fs = require('node:fs');

const PAGES = ['index', 'parents', 'collection', ...Array.from({ length: 13 }, (_, index) => `game${index + 1}`)];

const VIEWPORTS = [
  { name: 'iphone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'ipad', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', viewport: { width: 1280, height: 800 } }
];

async function capture(base, out) {
  const { chromium } = require('@playwright/test');
  // CHROMIUM_PATH: dùng Chromium có sẵn trên máy khi chưa chạy `npx playwright install`.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const result = {};
  for (const { name, ...options } of VIEWPORTS) {
    for (const pageName of PAGES) {
      const hasWinDialog = /^game([1-9]|10)$/.test(pageName);
      for (const win of hasWinDialog ? [false, true] : [false]) {
        const context = await browser.newContext({ ...options, serviceWorkers: 'block', locale: 'vi-VN' });
        await context.addInitScript(() => {
          let seed = 12345;
          Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
          const fixed = new Date('2026-10-26T08:00:00Z').getTime();
          Date.now = () => fixed;
        });
        const page = await context.newPage();
        await page.goto(`${base}/${pageName}.html`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
        await page.evaluate(() => window.BongModulesReady);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        if (win) {
          await page.evaluate(() => {
            document.querySelector('.man-thang')?.classList.add('hien');
            document.querySelector('.ky-luc-moi')?.classList.add('hien');
          });
        }
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.evaluate(() => document.getAnimations().forEach((animation) => { animation.pause(); animation.currentTime = 0; }));
        result[`${name}/${pageName}${win ? '/win' : ''}`] = await page.evaluate(() => {
          const path = (element) => {
            const parts = [];
            for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
              const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
              parts.unshift(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}:${index}`);
            }
            return parts.join('>');
          };
          const data = {};
          for (const element of document.querySelectorAll('body, body *')) {
            const props = {};
            const style = getComputedStyle(element);
            for (const property of style) if (!property.startsWith('--')) props[property] = style.getPropertyValue(property);
            for (const pseudo of ['::before', '::after']) {
              const pseudoStyle = getComputedStyle(element, pseudo);
              if (pseudoStyle.content && pseudoStyle.content !== 'none' && pseudoStyle.content !== 'normal') {
                for (const property of pseudoStyle) if (!property.startsWith('--')) props[pseudo + property] = pseudoStyle.getPropertyValue(property);
              }
            }
            const rect = element.getBoundingClientRect();
            props.__rect = [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10).join(',');
            data[path(element)] = props;
          }
          return data;
        });
        await context.close();
      }
    }
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result));
  console.log(`Đã chụp ${Object.keys(result).length} trạng thái vào ${out}`);
}

function compare(beforeFile, afterFile) {
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  let differences = 0;
  const shown = {};
  const report = (key, message) => {
    differences += 1;
    shown[key] = (shown[key] || 0) + 1;
    if (shown[key] <= 5) console.log(key, message);
  };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key] || {};
    const b = after[key] || {};
    for (const element of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[element] || !b[element]) { report(key, `phần tử chỉ có ở một bản: ${element.slice(-80)}`); continue; }
      for (const property of new Set([...Object.keys(a[element]), ...Object.keys(b[element])])) {
        if (a[element][property] !== b[element][property]) {
          report(key, `${element.slice(-70)} ${property}: ${JSON.stringify(a[element][property])} → ${JSON.stringify(b[element][property])}`);
        }
      }
    }
  }
  console.log(`Tổng số khác biệt: ${differences}`);
  process.exitCode = differences ? 1 : 0;
}

const [command, ...args] = process.argv.slice(2);
if (command === 'capture' && args.length === 2) capture(...args).catch((error) => { console.error(error); process.exitCode = 1; });
else if (command === 'compare' && args.length === 2) compare(...args);
else {
  console.error('Cách dùng: style-snapshot.js capture <baseURL> <out.json> | compare <before.json> <after.json>');
  process.exitCode = 2;
}
