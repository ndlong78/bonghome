'use strict';

/*
 * Quy tắc dạng lint cho mọi trang HTML: không có <script> inline, thuộc tính sự kiện (onclick=…) hay URL
 * javascript:, và CSP trong _headers không cho phép script inline/eval. CSP chặn mọi script không nằm trong tệp
 * cùng origin, nên một đoạn script inline mới thêm vào sẽ không chạy trên production; test này báo sớm từ lúc sửa.
 * Trang vẫn chạy đủ dưới CSP thật: e2e/security-headers.spec.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter((file) => file.endsWith('.html')).sort();

test('mọi trang HTML chỉ nạp script từ tệp riêng', () => {
  assert.ok(pages.length >= 16, `chỉ tìm thấy ${pages.length} trang`);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes, body]) => !/\bsrc=/.test(attributes) || body.trim());
    assert.deepEqual(inline.map(([tag]) => tag.slice(0, 60)), [], `${page} có <script> inline`);
    assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i, `${page} có thuộc tính sự kiện inline`);
    assert.doesNotMatch(html, /javascript:/i, `${page} có URL javascript:`);
  }
});

test('CSP trong _headers không cho phép script inline hay eval', () => {
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  const csp = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1] || '';
  const scriptSrc = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src'));
  assert.ok(scriptSrc, 'CSP cần khai báo script-src');
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'|'unsafe-eval'/, scriptSrc);
});
