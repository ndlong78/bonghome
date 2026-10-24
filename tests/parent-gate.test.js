const assert = require('node:assert/strict');

const createStorage = require('../js/storage.js');
const createParentDataControls = require('../js/parent-data-controls.js');

const controls = createParentDataControls(createStorage(null), null);

// Câu hỏi luôn là phép nhân hai số 6-9, kể cả ở hai đầu của rng.
for (const value of [0, 0.24, 0.25, 0.5, 0.75, 0.999999]) {
  const question = controls.createGateQuestion(() => value);
  assert.match(question.text, /^[6-9] × [6-9]$/);
  const [left, right] = question.text.split(' × ').map(Number);
  assert.equal(question.answer, left * right);
  assert.ok(question.answer >= 36 && question.answer <= 81);
}

const question = controls.createGateQuestion(() => 0.5);
assert.equal(question.text, '8 × 8');
assert.equal(controls.isGateAnswer('64', question), true);
assert.equal(controls.isGateAnswer(' 64 ', question), true);
for (const wrong of ['', '63', '64.0', '6 4', '0x40', '1e2', 'sáu tư', null, undefined]) {
  assert.equal(controls.isGateAnswer(wrong, question), false, String(wrong));
}
assert.equal(controls.isGateAnswer('64', null), false, 'chưa có câu hỏi thì không mở khóa');

console.log('Parent gate checks passed.');
