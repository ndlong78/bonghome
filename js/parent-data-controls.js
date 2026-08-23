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
   * Kỷ lục cá nhân được 10 game ghi thẳng vào localStorage bằng khóa riêng
   * ("kyluc_game6", "kyluc_game1_de", "kyluc_game8_3"...) nên nằm ngoài tài liệu
   * `bonghome:data`. Chúng vẫn là dữ liệu chơi của bé, phải bị xóa cùng lịch sử.
   */
  const RECORD_KEY_PATTERN = /^kyluc_/;
  const isRecordKey = (key) => RECORD_KEY_PATTERN.test(key);

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
      rawKeyFilter: isRecordKey,
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

  function init() {
    const document = root?.document;
    if (!document || !isParentPage(root.location?.pathname || '')) return null;

    const dialog = document.getElementById('parentDataDialog');
    const title = document.getElementById('parentDataDialogTitle');
    const description = document.getElementById('parentDataDialogDescription');
    const confirmButton = document.getElementById('parentDataConfirm');
    const cancelButton = document.getElementById('parentDataCancel');
    const status = document.getElementById('parentDataStatus');
    if (!dialog || !title || !description || !confirmButton || !cancelButton) return null;

    let pendingScope = null;

    function closeDialog() {
      pendingScope = null;
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

    confirmButton.addEventListener('click', () => {
      const scope = SCOPES[pendingScope];
      if (!scope) return;
      clearScope(pendingScope);
      if (status) status.textContent = scope.success;
      closeDialog();
      root.setTimeout(() => root.location.reload(), 50);
    });

    return Object.freeze({ clearScope, scopes: SCOPES });
  }

  return Object.freeze({ SCOPES, RECORD_KEY_PATTERN, isRecordKey, clearScope, init, isParentPage });
});