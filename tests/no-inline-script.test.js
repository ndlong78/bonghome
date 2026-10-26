'use strict';

/*
 * Quy tắc dạng lint cho mọi trang HTML và mã JS: không có <script>/<style> inline, thuộc tính sự kiện (onclick=…),
 * thuộc tính style="…" hay URL javascript:; JS không tự tạo thẻ <style> hay gán thuộc tính style (dùng CSSOM:
 * element.style.x, setProperty); CSP trong _headers không cho phép script/style inline hay eval. CSP chặn mọi thứ
 * không nằm trong tệp cùng origin, nên đoạn inline mới thêm vào sẽ không có hiệu lực trên production; test này báo
 * sớm từ lúc sửa. Trang vẫn chạy đủ dưới CSP thật: e2e/security-headers.spec.js.
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
    assert.doesNotMatch(html, /<style\b/i, `${page} có <style> inline`);
    assert.doesNotMatch(html, /<[^>]+\sstyle\s*=/i, `${page} có thuộc tính style="…"`);
  }
});

test('mã JS không tạo <style>, không gán thuộc tính style và không chèn style="…" vào HTML', () => {
  const files = [
    ...fs.readdirSync(root).filter((file) => file.endsWith('.js') && file !== 'playwright.config.js'),
    ...fs.readdirSync(path.join(root, 'js')).filter((file) => file.endsWith('.js')).map((file) => `js/${file}`)
  ];
  assert.ok(files.length > 40, `chỉ tìm thấy ${files.length} tệp JS`);
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /createElement\(\s*['"]style['"]\s*\)/, `${file} tạo thẻ <style>`);
    assert.doesNotMatch(source, /setAttribute\(\s*['"]style['"]/, `${file} gán thuộc tính style`);
    assert.doesNotMatch(source, /<[a-z][^<>`]*\sstyle\s*=\s*["'\\]/i, `${file} chèn style="…" vào HTML`);
  }
});

test('CSP trong _headers không cho phép script/style inline hay eval', () => {
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  const csp = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1] || '';
  for (const name of ['script-src', 'style-src']) {
    const directive = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
    assert.ok(directive, `CSP cần khai báo ${name}`);
    assert.doesNotMatch(directive, /'unsafe-inline'|'unsafe-eval'/, directive);
  }
});
