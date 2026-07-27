(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.document) {
    root.BongGame3DragStability = factory(root);
    root.BongGame3DragStability.init();
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame3DragStability(root) {
  'use strict';

  let destroyCurrent = null;

  function init() {
    if (destroyCurrent) return destroyCurrent;

    const tray = root.document?.getElementById('khay');
    if (!tray) return null;

    let layoutLocked = false;
    const nextFrame = typeof root.requestAnimationFrame === 'function'
      ? root.requestAnimationFrame.bind(root)
      : (callback) => root.setTimeout(callback, 0);

    function lockLayout(event) {
      const piece = event.target?.closest?.('.mieng-hinh');
      if (!piece || !tray.contains(piece) || piece.classList.contains('xong')) return;

      const height = Math.ceil(tray.getBoundingClientRect().height);
      if (!height) return;

      tray.style.minHeight = `${height}px`;
      tray.dataset.bhDragLayoutLocked = 'true';
      layoutLocked = true;
    }

    function unlockLayout() {
      if (!layoutLocked) return;
      nextFrame(() => {
        tray.style.removeProperty('min-height');
        delete tray.dataset.bhDragLayoutLocked;
        layoutLocked = false;
      });
    }

    root.document.addEventListener('pointerdown', lockLayout, true);
    root.document.addEventListener('pointerup', unlockLayout);
    root.document.addEventListener('pointercancel', unlockLayout);
    root.addEventListener('blur', unlockLayout);

    destroyCurrent = function destroy() {
      root.document.removeEventListener('pointerdown', lockLayout, true);
      root.document.removeEventListener('pointerup', unlockLayout);
      root.document.removeEventListener('pointercancel', unlockLayout);
      root.removeEventListener('blur', unlockLayout);
      tray.style.removeProperty('min-height');
      delete tray.dataset.bhDragLayoutLocked;
      layoutLocked = false;
      destroyCurrent = null;
    };

    return destroyCurrent;
  }

  function isReady() {
    return Boolean(destroyCurrent);
  }

  return Object.freeze({ init, isReady });
});
