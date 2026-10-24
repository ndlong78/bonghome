(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.BongParentDataControlsFactory = factory;
})(typeof window !== 'undefined' ? window : globalThis, function createParentDataControls(storage, root) {
  'use strict';

  if (!storage) throw new Error('Parent data controls require BongStorage');

  const FALLBACK_ROUTES = Object.freeze({
    isParentPage(pathname) {
      return /^\/parents(?:\.html)?\/?$/.test(pathname || '');
    }
  });
  const getRoutes = () => root?.BongRoutes || FALLBACK_ROUTES;
  const isParentPage = (pathname) => getRoutes().isParentPage(pathname);

  /**
   * Kỷ lục (`kyluc_*`) và ván đang chơi dở (`bonghome_game<N>_*`) nằm ngoài tài liệu
   * `bonghome:data` nhưng vẫn là dữ liệu chơi của bé; bản sao lưu dữ liệu hỏng thì chỉ
   * đi cùng lệnh xóa toàn bộ. Quy ước khóa đặt một chỗ trong js/storage.js.
   */
  const RECORD_KEY_PATTERN = /^kyluc_/;
  const BACKUP_KEY_PREFIX = storage.BACKUP_KEY_PREFIX || 'bonghome:data:corrupt:';
  const isRecordKey = typeof storage.isActivityRawKey === 'function'
    ? storage.isActivityRawKey
    : (key) => RECORD_KEY_PATTERN.test(key) || /^bonghome_game\d+_[a-z0-9_-]+$/.test(key);
  const isChildDataKey = typeof storage.isChildDataRawKey === 'function'
    ? storage.isChildDataRawKey
    : (key) => isRecordKey(key) || key.startsWith(BACKUP_KEY_PREFIX);

  const SCOPES = Object.freeze({
    activity: Object.freeze({
      title: 'Xóa lịch sử chơi?',
      description: 'Tiến độ đang chơi dở, lịch sử hoàn thành và kỷ lục cá nhân của bé sẽ bị xóa. Hồ sơ, sao, sticker và huy hiệu vẫn được giữ lại.',
      keys: Object.freeze(['progress']),
      rawKeyFilter: isRecordKey,
      success: 'Đã xóa lịch sử chơi và kỷ lục trên thiết bị này.'
    }),
    child: Object.freeze({
      title: 'Xóa toàn bộ dữ liệu của bé?',
      description: 'Hồ sơ, tiến độ, lịch sử chơi, kỷ lục cá nhân, sao, sticker và huy hiệu sẽ bị xóa khỏi thiết bị này. Thao tác này không thể hoàn tác.',
      keys: Object.freeze(['progress', 'rewards', 'profile']),
      rawKeyFilter: isChildDataKey,
      success: 'Đã xóa toàn bộ dữ liệu của bé trên thiết bị này.'
    })
  });

  function clearScope(scopeId) {
    const scope = SCOPES[scopeId];
    if (!scope) throw new TypeError('Unknown parent data control scope');
    const removedKeys = scope.keys.reduce((removed, key) => removed + (storage.remove(key) ? 1 : 0), 0);
    const removedRawKeys = scope.rawKeyFilter && typeof storage.removeRawKeys === 'function'
      ? storage.removeRawKeys(scope.rawKeyFilter)
      : 0;
    return removedKeys + removedRawKeys;
  }

  /**
   * Cổng phụ huynh: phép nhân hai số từ 6 đến 9 (36-81), đủ khó với bé 6 tuổi nhưng
   * người lớn trả lời ngay. `rng` trả số trong [0, 1) như Math.random.
   */
  function createGateQuestion(rng = Math.random) {
    const pick = () => 6 + Math.min(3, Math.floor(rng() * 4));
    const left = pick();
    const right = pick();
    return Object.freeze({ text: `${left} × ${right}`, answer: left * right });
  }

  function isGateAnswer(input, question) {
    const value = String(input ?? '').trim();
    return /^\d{1,3}$/.test(value) && Number(value) === question?.answer;
  }

  function init() {
    const document = root?.document;
    if (!document || !isParentPage(root.location?.pathname || '')) return null;

    const dialog = document.getElementById('parentDataDialog');
    const title = document.getElementById('parentDataDialogTitle');
    const description = document.getElementById('parentDataDialogDescription');
    const confirmButton = document.getElementById('parentDataConfirm');
    const cancelButton = document.getElementById('parentDataCancel');
    const status = document.getElementById('parentDataStatus');
    const gateQuestion = document.getElementById('parentGateQuestion');
    const gateAnswer = document.getElementById('parentGateAnswer');
    if (!dialog || !title || !description || !confirmButton || !cancelButton || !gateQuestion || !gateAnswer) return null;

    let pendingScope = null;
    let question = null;

    function updateGate() {
      const unlocked = isGateAnswer(gateAnswer.value, question);
      confirmButton.disabled = !unlocked;
      gateAnswer.setAttribute('aria-invalid', String(gateAnswer.value.trim() !== '' && !unlocked));
      return unlocked;
    }

    function closeDialog() {
      pendingScope = null;
      question = null;
      gateAnswer.value = '';
      confirmButton.disabled = true;
      if (dialog.open) dialog.close();
    }

    document.querySelectorAll('[data-parent-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const scope = SCOPES[button.dataset.parentDelete];
        if (!scope) return;
        pendingScope = button.dataset.parentDelete;
        title.textContent = scope.title;
        description.textContent = scope.description;
        confirmButton.textContent = scope.title.replace('?', '');
        question = createGateQuestion(root.Math?.random || Math.random);
        gateQuestion.textContent = question.text;
        gateAnswer.value = '';
        updateGate();
        dialog.showModal();
        cancelButton.focus();
      });
    });

    cancelButton.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });

    gateAnswer.addEventListener('input', updateGate);
    gateAnswer.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && updateGate()) confirmButton.click();
    });

    confirmButton.addEventListener('click', () => {
      const scope = SCOPES[pendingScope];
      if (!scope || !updateGate()) return;
      clearScope(pendingScope);
      if (status) status.textContent = scope.success;
      closeDialog();
      root.setTimeout(() => root.location.reload(), 50);
    });

    return Object.freeze({ clearScope, scopes: SCOPES });
  }

  return Object.freeze({ SCOPES, RECORD_KEY_PATTERN, isRecordKey, isChildDataKey, clearScope, createGateQuestion, isGateAnswer, init, isParentPage });
});