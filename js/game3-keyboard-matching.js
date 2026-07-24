(() => {
  'use strict';

  const PIECE_SELECTOR = '.mieng-hinh:not(.xong)';
  const SHADOW_SELECTOR = '.o-bong:not(.dung)';
  let selectedPiece = null;

  function ensureLiveRegion() {
    let status = document.getElementById('bhGame3KeyboardStatus');
    if (status) return status;
    status = document.createElement('div');
    status.id = 'bhGame3KeyboardStatus';
    status.className = 'bh-visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    document.body.appendChild(status);
    return status;
  }

  function ensureInstructions() {
    let instructions = document.getElementById('bhGame3KeyboardInstructions');
    if (instructions) return instructions;
    instructions = document.createElement('p');
    instructions.id = 'bhGame3KeyboardInstructions';
    instructions.className = 'bh-visually-hidden';
    instructions.textContent = 'Nhấn Enter hoặc phím cách để chọn một hình màu. Sau đó Tab tới một cái bóng và nhấn Enter hoặc phím cách để thả hình.';
    document.body.appendChild(instructions);
    return instructions;
  }

  function announce(message) {
    const status = ensureLiveRegion();
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = message; });
  }

  function labelOf(element, fallback) {
    return element.getAttribute('aria-label') || fallback;
  }

  function centerOf(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function dispatchPointerMatch(piece, shadow) {
    const start = centerOf(piece);
    const end = centerOf(shadow);
    const pointerId = 91;
    piece.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'mouse',
      clientX: start.x,
      clientY: start.y,
      buttons: 1
    }));
    piece.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'mouse',
      clientX: end.x,
      clientY: end.y,
      buttons: 0
    }));
  }

  function clearSelection() {
    if (selectedPiece) selectedPiece.setAttribute('aria-pressed', 'false');
    selectedPiece = null;
    document.querySelectorAll('.o-bong').forEach((shadow) => shadow.classList.remove('gan-toi'));
  }

  function selectPiece(piece) {
    clearSelection();
    selectedPiece = piece;
    piece.setAttribute('aria-pressed', 'true');
    document.querySelectorAll(SHADOW_SELECTOR).forEach((shadow) => shadow.classList.add('gan-toi'));
    announce(`${labelOf(piece, 'Hình màu')} đã được chọn. Hãy Tab tới một cái bóng và nhấn Enter hoặc phím cách.`);
  }

  function activateShadow(shadow) {
    if (!selectedPiece) {
      announce('Bé hãy chọn một hình màu trước.');
      return;
    }
    const piece = selectedPiece;
    dispatchPointerMatch(piece, shadow);
    queueMicrotask(() => {
      const matched = piece.classList.contains('xong');
      const pieceLabel = labelOf(piece, 'Hình màu');
      clearSelection();
      syncControls();
      announce(matched ? `${pieceLabel} đã ghép đúng.` : `${pieceLabel} chưa đúng với bóng này. Bé thử lại nhé.`);
      if (!matched) piece.focus();
    });
  }

  function onKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const piece = event.target.closest(PIECE_SELECTOR);
    const shadow = event.target.closest(SHADOW_SELECTOR);
    if (!piece && !shadow) return;
    event.preventDefault();
    if (piece) selectPiece(piece);
    if (shadow) activateShadow(shadow);
  }

  function syncControls() {
    const instructions = ensureInstructions();
    document.querySelectorAll('.mieng-hinh').forEach((piece) => {
      const done = piece.classList.contains('xong');
      piece.setAttribute('role', 'button');
      piece.setAttribute('tabindex', done ? '-1' : '0');
      piece.setAttribute('aria-pressed', piece === selectedPiece ? 'true' : 'false');
      piece.setAttribute('aria-describedby', instructions.id);
      if (done) piece.setAttribute('aria-disabled', 'true');
      else piece.removeAttribute('aria-disabled');
    });
    document.querySelectorAll('.o-bong').forEach((shadow, index) => {
      const done = shadow.classList.contains('dung');
      shadow.setAttribute('role', 'button');
      shadow.setAttribute('tabindex', done ? '-1' : '0');
      shadow.setAttribute('aria-label', done ? `Bóng ${index + 1}, đã ghép đúng` : `Bóng ${index + 1}`);
      shadow.setAttribute('aria-describedby', instructions.id);
      if (done) shadow.setAttribute('aria-disabled', 'true');
      else shadow.removeAttribute('aria-disabled');
    });
  }

  function init() {
    const tray = document.getElementById('khay');
    const shadows = document.getElementById('hangBong');
    if (!tray || !shadows) return;
    ensureInstructions();
    ensureLiveRegion();
    syncControls();
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(() => {
      if (selectedPiece && selectedPiece.classList.contains('xong')) clearSelection();
      syncControls();
    });
    observer.observe(tray, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    observer.observe(shadows, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.BongGame3KeyboardMatching = { syncControls, clearSelection };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();