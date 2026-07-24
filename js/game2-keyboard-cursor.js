(() => {
  'use strict';

  const STEP = 20;
  const MIN = 10;
  const MAX = 290;
  const CURSOR_CLASS = 'bh-game2-keyboard-cursor';

  function init() {
    const pictures = [document.getElementById('tranhA'), document.getElementById('tranhB')].filter(Boolean);
    if (pictures.length !== 2) return;

    const instructions = document.createElement('p');
    instructions.id = 'bhGame2KeyboardInstructions';
    instructions.className = 'bh-visually-hidden';
    instructions.textContent = 'Dùng các phím mũi tên để di chuyển vòng tròn. Nhấn Enter hoặc phím cách để chọn vị trí.';
    document.body.appendChild(instructions);

    const status = document.createElement('div');
    status.id = 'bhGame2KeyboardStatus';
    status.className = 'bh-visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    document.body.appendChild(status);

    const style = document.createElement('style');
    style.textContent = `
      .bh-visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      .${CURSOR_CLASS} {
        fill: rgba(255, 255, 255, 0.32);
        stroke: #5B3C62;
        stroke-width: 4;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .${CURSOR_CLASS} { transition: none !important; }
      }
    `;
    document.head.appendChild(style);

    pictures.forEach((svg, pictureIndex) => {
      const state = { x: 150, y: 150, visible: false };
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('aria-describedby', instructions.id);

      function ensureCursor() {
        let cursor = svg.querySelector(`.${CURSOR_CLASS}`);
        if (!cursor) {
          cursor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          cursor.setAttribute('class', CURSOR_CLASS);
          cursor.setAttribute('r', '13');
          cursor.setAttribute('aria-hidden', 'true');
          svg.appendChild(cursor);
        }
        cursor.setAttribute('cx', String(state.x));
        cursor.setAttribute('cy', String(state.y));
        cursor.style.display = state.visible ? '' : 'none';
        return cursor;
      }

      function announce() {
        const column = Math.round((state.x - MIN) / STEP) + 1;
        const row = Math.round((state.y - MIN) / STEP) + 1;
        status.textContent = `Tranh ${pictureIndex + 1}, cột ${column}, hàng ${row}`;
      }

      function move(dx, dy) {
        state.x = Math.min(MAX, Math.max(MIN, state.x + dx));
        state.y = Math.min(MAX, Math.max(MIN, state.y + dy));
        ensureCursor();
        announce();
      }

      function choose() {
        const rect = svg.getBoundingClientRect();
        const clientX = rect.left + (state.x / 300) * rect.width;
        const clientY = rect.top + (state.y / 300) * rect.height;
        svg.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          view: window
        }));
      }

      svg.addEventListener('focus', () => {
        state.visible = true;
        ensureCursor();
        announce();
      });
      svg.addEventListener('blur', () => {
        state.visible = false;
        ensureCursor();
      });
      svg.addEventListener('keydown', (event) => {
        const actions = {
          ArrowLeft: () => move(-STEP, 0),
          ArrowRight: () => move(STEP, 0),
          ArrowUp: () => move(0, -STEP),
          ArrowDown: () => move(0, STEP),
          Enter: choose,
          ' ': choose
        };
        const action = actions[event.key];
        if (!action) return;
        event.preventDefault();
        action();
      });

      new MutationObserver(() => ensureCursor()).observe(svg, { childList: true });
      ensureCursor();
    });

    window.BongGame2KeyboardCursor = Object.freeze({ step: STEP, min: MIN, max: MAX });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
