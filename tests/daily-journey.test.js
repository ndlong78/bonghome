const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/daily/index.json'));
const daily = require('../js/daily-journey.js');
const themePicker = require('../js/theme-picker.js');
const serviceWorker = read('sw.js');
const css = read('css/daily-journey.css');

const valid = daily.validateContent(content);
assert.ok(valid, 'Daily journey content must be valid');
assert.equal(valid.schemaVersion, 1);
assert.equal(valid.plans.length, 4);
assert.ok(valid.plans.every((plan) => plan.activities.length === 3));
assert.ok(valid.plans.every((plan) => new Set(plan.activities.map((item) => item.gameId)).size === 3));
assert.ok(valid.plans.flatMap((plan) => plan.activities).every((item) => item.href === `./${item.gameId}.html`));

const firstDate = new Date(2026, 6, 22);
const sameDate = new Date(2026, 6, 22, 23, 59);
const nextDate = new Date(2026, 6, 23);
assert.deepEqual(daily.selectPlan(content, firstDate), daily.selectPlan(content, sameDate), 'Same local date must keep the same plan');
assert.notEqual(daily.selectPlan(content, firstDate).id, daily.selectPlan(content, nextDate).id, 'Next date should rotate to the next plan');
assert.throws(() => daily.localDayNumber(new Date('invalid')), TypeError);
assert.equal(daily.validateContent({ ...content, plans: [] }), null);

assert.equal(themePicker.isHomePage('/'), true);
assert.equal(themePicker.isHomePage('/bonghome/'), true);
assert.equal(themePicker.isHomePage('/bonghome/index.html'), true);
assert.equal(themePicker.isHomePage('/bonghome/game1.html'), false);
assert.ok(serviceWorker.includes('./js/daily-journey.js'));
assert.ok(serviceWorker.includes('./content/daily/index.json'));
assert.ok(serviceWorker.includes('./css/daily-journey.css'));
assert.match(serviceWorker, /bonghome-v21-daily-journey/);
assert.match(css, /min-height:\s*72px/);
assert.match(css, /prefers-reduced-motion/);

console.log('Daily journey checks passed.');
