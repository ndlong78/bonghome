const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const swPath = path.join(__dirname, '..', 'sw.js');
const source = fs.readFileSync(swPath, 'utf8');

for (let game = 1; game <= 10; game += 1) {
  const asset = `./game${game}.html`;
  assert.match(source, new RegExp(`"${asset.replace('.', '\\.') }"`), `${asset} phải nằm trong offline cache`);
}

console.log('✓ 10 trang game đều được khai báo trong offline cache');
