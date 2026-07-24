(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.document) root.BongRewardCollection = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function createRewardCollection(root) {
  'use strict';

  function normalizeCatalog(input) {
    const source = input && typeof input === 'object' ? input : {};
    if (source.schemaVersion !== 1 || !Array.isArray(source.stickers) || !Array.isArray(source.badges)) {
      throw new Error('Reward catalog is invalid');
    }
    return source;
  }

  function normalizeAvatarCatalog(input) {
    const source = input && typeof input === 'object' ? input : {};
    if (source.schemaVersion !== 1 || !Array.isArray(source.avatars) || !source.avatars.length) {
      throw new Error('Avatar catalog is invalid');
    }
    return source;
  }

  function createCard(document, reward, unlocked) {
    const card = document.createElement('article');
    card.className = 'bh-reward-card';
    card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');

    const icon = document.createElement('span');
    icon.className = 'bh-reward-card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = unlocked ? reward.icon : '❔';

    const name = document.createElement('strong');
    name.textContent = unlocked ? reward.name : 'Chưa mở khóa';

    const status = document.createElement('small');
    status.textContent = unlocked ? 'Đã có trong bộ sưu tập' : 'Bé sẽ nhận khi hoàn thành thử thách phù hợp';

    card.append(icon, name, status);
    return card;
  }

  function renderProfile(document, profile, avatarCatalog) {
    const title = document.getElementById('collectionTitle');
    const intro = document.getElementById('collectionIntro');
    const avatar = document.getElementById('collectionAvatar');
    if (!title || !intro || !avatar) return false;

    const current = profile || { displayName: 'Bông', avatarId: avatarCatalog.defaultAvatarId };
    const avatarItem = avatarCatalog.avatars.find((item) => item.id === current.avatarId)
      || avatarCatalog.avatars.find((item) => item.id === avatarCatalog.defaultAvatarId)
      || avatarCatalog.avatars[0];
    const displayName = String(current.displayName || 'Bông').trim() || 'Bông';

    title.textContent = `Bộ sưu tập của ${displayName}`;
    intro.textContent = `Mỗi phần thưởng là một lời khen nhẹ nhàng dành cho ${displayName}.`;
    avatar.textContent = avatarItem.icon;
    document.title = `Bộ sưu tập của ${displayName}`;
    return true;
  }

  function render(document, catalog, summary) {
    const stars = document.getElementById('collectionStars');
    const stickers = document.getElementById('collectionStickers');
    const badges = document.getElementById('collectionBadges');
    if (!stars || !stickers || !badges) return false;

    const stickerIds = new Set(summary?.stickerIds || []);
    const badgeIds = new Set(summary?.badgeIds || []);
    stars.textContent = `⭐ Bé đã nhận ${Math.max(0, Number(summary?.stars) || 0)} sao`;

    stickers.replaceChildren(...catalog.stickers.map((reward) => createCard(document, reward, stickerIds.has(reward.id))));
    badges.replaceChildren(...catalog.badges.map((reward) => createCard(document, reward, badgeIds.has(reward.id))));
    return true;
  }

  async function init() {
    if (!root?.document) return false;
    const modules = await root.BongModulesReady;
    if (!modules?.rewards || !modules?.profile) throw new Error('BongRewards or BongProfile is unavailable');
    const [rewardResponse, avatarResponse] = await Promise.all([
      root.fetch('./content/rewards/catalog.json'),
      root.fetch('./content/profile/avatars.json')
    ]);
    if (!rewardResponse.ok) throw new Error(`Reward catalog HTTP ${rewardResponse.status}`);
    if (!avatarResponse.ok) throw new Error(`Avatar catalog HTTP ${avatarResponse.status}`);

    const rewardCatalog = normalizeCatalog(await rewardResponse.json());
    const avatarCatalog = normalizeAvatarCatalog(await avatarResponse.json());
    renderProfile(root.document, modules.profile.getProfile(), avatarCatalog);
    return render(root.document, rewardCatalog, modules.rewards.getSummary());
  }

  if (root?.document) {
    root.addEventListener('DOMContentLoaded', () => {
      init().catch((error) => {
        console.error('[Bông Home] Không tải được bộ sưu tập', error);
        const stars = root.document.getElementById('collectionStars');
        if (stars) stars.textContent = 'Bộ sưu tập đang tạm nghỉ. Bé thử mở lại nhé!';
      });
    }, { once: true });
  }

  return Object.freeze({ normalizeCatalog, normalizeAvatarCatalog, createCard, renderProfile, render, init });
});
