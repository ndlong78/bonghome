(() => {
  'use strict';

  function applyHarderLevels() {
    const group = document.getElementById('mucDo');
    const board = document.getElementById('sanBai');
    if (!group || !board || group.dataset.harderLevels === 'true') return;

    const buttons = [...group.querySelectorAll('button')];
    if (buttons.length < 3) return;

    const levels = [
      { pairs: 4, label: 'Dễ · 8 lá' },
      { pairs: 6, label: 'Vừa · 12 lá' },
      { pairs: 8, label: 'Khó · 16 lá' }
    ];

    buttons.slice(0, 3).forEach((button, index) => {
      button.dataset.cap = String(levels[index].pairs);
      button.textContent = levels[index].label;
    });

    const instruction = document.querySelector('.huong-dan');
    if (instruction) {
      instruction.textContent = 'Bé lật 2 lá bài để tìm cặp giống nhau. Mức Khó có tới 16 lá nhé!';
    }

    group.dataset.harderLevels = 'true';

    // Ván mặc định cũ có 6 lá. Chọn lại mức Dễ mới để dựng ván 8 lá.
    if (board.querySelectorAll('.la-bai').length === 6) {
      buttons[0].click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHarderLevels, { once: true });
  } else {
    applyHarderLevels();
  }
})();