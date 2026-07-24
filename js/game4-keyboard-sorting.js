(() => {
  'use strict';

  const ITEM_SELECTOR = '.do-vat:not(.xong)';
  const BASKET_SELECTOR = '.gio';
  let selectedItem = null;

  function ensureHiddenText(id, text, role) {
    let element = document.getElementById(id);
    if (element) return element;
    element = document.createElement(role === 'status' ? 'div' : 'p');
    element.id = id;
    element.className = 'bh-visually-hidden';
    element.textContent = text || '';
    if (role === 'status') {
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'true');
    }
    document.body.appendChild(element);
    return element;
  }

  function announce(message) {
    const status = ensureHiddenText('bhGame4KeyboardStatus', '', 'status');
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = message; });
  }

  function centerOf(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function dispatchPointerSort(item, basket) {
    const start = centerOf(item);
    const end = centerOf(basket);
    const pointerId = 94;
    const originalSetPointerCapture = item.setPointerCapture;
    item.setPointerCapture = () => {};
    try {
      item.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId, pointerType: 'mouse',
        clientX: start.x, clientY: start.y, buttons: 1
      }));
      item.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId, pointerType: 'mouse',
        clientX: end.x, clientY: end.y, buttons: 0
      }));
    } finally {
      item.setPointerCapture = originalSetPointerCapture;
    }
  }

  function clearSelection() {
    if (selectedItem) selectedItem.setAttribute('aria-pressed', 'false');
    selectedItem = null;
    document.querySelectorAll(BASKET_SELECTOR).forEach((basket) => basket.classList.remove('gan-toi'));
  }

  function selectItem(item) {
    clearSelection();
    selectedItem = item;
    item.setAttribute('aria-pressed', 'true');
    document.querySelectorAll(BASKET_SELECTOR).forEach((basket) => basket.classList.add('gan-toi'));
    announce(`${item.getAttribute('aria-label') || 'Đồ vật'} đã được chọn. Hãy Tab tới một giỏ và nhấn Enter hoặc phím cách.`);
  }

  function activateBasket(basket) {
    if (!selectedItem) {
      announce('Bé hãy chọn một đồ vật trước.');
      return;
    }
    const item = selectedItem;
    const label = item.getAttribute('aria-label') || 'Đồ vật';
    dispatchPointerSort(item, basket);
    queueMicrotask(() => {
      const sorted = item.classList.contains('xong');
      clearSelection();
      syncControls();
      announce(sorted ? `${label} đã vào đúng giỏ.` : `${label} chưa đúng với giỏ này. Bé thử lại nhé.`);
      if (!sorted) item.focus();
    });
  }

  function onKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest(ITEM_SELECTOR);
    const basket = event.target.closest(BASKET_SELECTOR);
    if (!item && !basket) return;
    event.preventDefault();
    if (item) selectItem(item);
    else activateBasket(basket);
  }

  function syncControls() {
    const instructions = ensureHiddenText(
      'bhGame4KeyboardInstructions',
      'Nhấn Enter hoặc phím cách để chọn một đồ vật. Sau đó Tab tới giỏ cùng màu và nhấn Enter hoặc phím cách để thả.'
    );
    document.querySelectorAll('.do-vat').forEach((item) => {
      const done = item.classList.contains('xong');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', done ? '-1' : '0');
      item.setAttribute('aria-pressed', item === selectedItem ? 'true' : 'false');
      item.setAttribute('aria-describedby', instructions.id);
      if (done) item.setAttribute('aria-disabled', 'true');
      else item.removeAttribute('aria-disabled');
    });
    document.querySelectorAll(BASKET_SELECTOR).forEach((basket) => {
      const colorName = basket.querySelector('.ten-gio')?.textContent?.trim() || 'Giỏ';
      basket.setAttribute('role', 'button');
      basket.setAttribute('tabindex', '0');
      basket.setAttribute('aria-label', colorName);
      basket.setAttribute('aria-describedby', instructions.id);
    });
  }

  function init() {
    const field = document.getElementById('sanDo');
    const baskets = document.getElementById('hangGio');
    if (!field || !baskets) return;
    ensureHiddenText('bhGame4KeyboardInstructions', '');
    ensureHiddenText('bhGame4KeyboardStatus', '', 'status');
    syncControls();
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(() => {
      if (selectedItem && selectedItem.classList.contains('xong')) clearSelection();
      syncControls();
    });
    observer.observe(field, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    observer.observe(baskets, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.BongGame4KeyboardSorting = { syncControls, clearSelection };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();