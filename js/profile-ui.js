(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongProfile) root.BongProfileUI = factory(root.BongProfile, root);
})(typeof window !== 'undefined' ? window : globalThis, function createProfileUI(profile, root) {
  'use strict';

  function isHomePage(pathname) {
    return /(?:^|\/)index\.html$/.test(pathname) || /\/$/.test(pathname);
  }

  async function loadCatalog(fetchImpl) {
    const response = await fetchImpl('./content/profile/avatars.json');
    if (!response.ok) throw new Error(`Avatar catalog HTTP ${response.status}`);
    const catalog = await response.json();
    if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.avatars) || !catalog.avatars.length) {
      throw new Error('Avatar catalog is invalid');
    }
    return catalog;
  }

  function init() {
    if (!root?.document || !profile || !isHomePage(root.location.pathname)) return Promise.resolve(null);
    if (root.document.getElementById('bhProfileButton')) return Promise.resolve(null);

    return loadCatalog(root.fetch.bind(root)).then((catalog) => {
      const avatarMap = new Map(catalog.avatars.map((item) => [item.id, item]));
      const header = root.document.querySelector('.khung > header') || root.document.querySelector('header');
      if (!header) return null;

      const actions = root.document.createElement('div');
      actions.className = 'bh-profile-home-actions';

      const button = root.document.createElement('button');
      button.id = 'bhProfileButton';
      button.type = 'button';
      button.className = 'bh-profile-button';

      const parentLink = root.document.createElement('a');
      parentLink.className = 'bh-parent-link';
      parentLink.href = './parents.html';
      parentLink.textContent = '👨‍👩‍👧 Dành cho phụ huynh';
      parentLink.setAttribute('aria-label', 'Mở Góc phụ huynh');

      const dialog = root.document.createElement('div');
      dialog.className = 'bh-profile-dialog';
      dialog.hidden = true;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'bhProfileTitle');
      dialog.innerHTML = `
        <form class="bh-profile-card">
          <h2 id="bhProfileTitle">Hồ sơ của bé</h2>
          <p>Chỉ lưu trên thiết bị này. Không dùng ảnh thật hay thông tin riêng tư.</p>
          <label class="bh-profile-name">Tên hiển thị
            <input name="displayName" maxlength="20" autocomplete="off" inputmode="text">
          </label>
          <fieldset>
            <legend>Chọn hình đại diện</legend>
            <div class="bh-profile-avatars"></div>
          </fieldset>
          <div class="bh-profile-actions">
            <button type="button" data-action="cancel">Đóng</button>
            <button type="submit">Lưu hồ sơ</button>
          </div>
        </form>`;
      root.document.body.appendChild(dialog);
      actions.append(button, parentLink);
      header.appendChild(actions);

      const form = dialog.querySelector('form');
      const input = form.elements.displayName;
      const avatarList = dialog.querySelector('.bh-profile-avatars');
      catalog.avatars.forEach((avatar) => {
        const label = root.document.createElement('label');
        label.className = 'bh-profile-avatar-option';
        label.innerHTML = `<input type="radio" name="avatarId" value="${avatar.id}"><span aria-hidden="true">${avatar.icon}</span><small>${avatar.name}</small>`;
        avatarList.appendChild(label);
      });

      function render() {
        const current = profile.getProfile();
        const avatar = avatarMap.get(current.avatarId) || avatarMap.get(catalog.defaultAvatarId) || catalog.avatars[0];
        button.innerHTML = `<span aria-hidden="true">${avatar.icon}</span><strong>${current.displayName}</strong>`;
        button.setAttribute('aria-label', `Mở hồ sơ của ${current.displayName}`);
      }

      function open() {
        const current = profile.getProfile();
        input.value = current.displayName;
        const selected = form.querySelector(`input[name="avatarId"][value="${current.avatarId}"]`) || form.querySelector('input[name="avatarId"]');
        if (selected) selected.checked = true;
        dialog.hidden = false;
        input.focus();
      }

      function close() {
        dialog.hidden = true;
        button.focus();
      }

      button.addEventListener('click', open);
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog || event.target.closest('[data-action="cancel"]')) close();
      });
      root.document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !dialog.hidden) close();
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new root.FormData(form);
        profile.updateProfile({ displayName: data.get('displayName'), avatarId: data.get('avatarId') });
        render();
        root.dispatchEvent(new root.CustomEvent('bonghome:profilechange', { detail: profile.getProfile() }));
        close();
      });

      render();
      return { button, parentLink, dialog };
    }).catch((error) => {
      console.warn('[Bông Home] Không tải được hồ sơ cục bộ', error);
      return null;
    });
  }

  return Object.freeze({ isHomePage, loadCatalog, init });
});
