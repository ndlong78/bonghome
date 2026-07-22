(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.BongDailyJourney = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDailyJourney() {
  'use strict';

  const CONTENT_URL = './content/daily/index.json';
  const SCHEMA_VERSION = 1;
  const GAME_ID_PATTERN = /^game(?:10|[1-9])$/;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function validateContent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION) return null;
    if (typeof value.title !== 'string' || !value.title.trim()) return null;
    if (typeof value.description !== 'string' || !value.description.trim()) return null;
    if (!Array.isArray(value.plans) || value.plans.length < 1) return null;

    const planIds = new Set();
    for (const plan of value.plans) {
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.id || '') || planIds.has(plan.id)) return null;
      if (!Array.isArray(plan.activities) || plan.activities.length !== 3) return null;
      planIds.add(plan.id);

      const gameIds = new Set();
      for (const activity of plan.activities) {
        if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return null;
        if (!GAME_ID_PATTERN.test(activity.gameId || '') || gameIds.has(activity.gameId)) return null;
        if (typeof activity.title !== 'string' || !activity.title.trim()) return null;
        if (typeof activity.skill !== 'string' || !activity.skill.trim()) return null;
        if (typeof activity.icon !== 'string' || !activity.icon.trim()) return null;
        if (activity.href !== `./${activity.gameId}.html`) return null;
        gameIds.add(activity.gameId);
      }
    }
    return clone(value);
  }

  function localDayNumber(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Date must be valid');
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function selectPlan(content, date = new Date()) {
    const valid = validateContent(content);
    if (!valid) throw new TypeError('Nội dung Hôm nay của Bông không hợp lệ');
    return clone(valid.plans[localDayNumber(date) % valid.plans.length]);
  }

  function createActivityLink(root, activity, index) {
    const link = root.document.createElement('a');
    link.className = 'bh-daily-activity';
    link.href = activity.href;
    link.setAttribute('aria-label', `${index + 1}. ${activity.title}, luyện ${activity.skill}`);

    const number = root.document.createElement('span');
    number.className = 'bh-daily-number';
    number.textContent = String(index + 1);

    const icon = root.document.createElement('span');
    icon.className = 'bh-daily-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = activity.icon;

    const text = root.document.createElement('span');
    text.className = 'bh-daily-text';
    const title = root.document.createElement('strong');
    title.textContent = activity.title;
    const skill = root.document.createElement('small');
    skill.textContent = activity.skill;
    text.append(title, skill);

    link.append(number, icon, text);
    return link;
  }

  function render(root, content, date = new Date()) {
    const existing = root.document.getElementById('homNayCuaBong');
    if (existing) return existing;
    const main = root.document.getElementById('sanTruong');
    if (!main) return null;

    const valid = validateContent(content);
    if (!valid) throw new TypeError('Nội dung Hôm nay của Bông không hợp lệ');
    const plan = selectPlan(valid, date);

    const section = root.document.createElement('section');
    section.id = 'homNayCuaBong';
    section.className = 'bh-daily';
    section.setAttribute('aria-labelledby', 'bhDailyTitle');

    const heading = root.document.createElement('h2');
    heading.id = 'bhDailyTitle';
    heading.textContent = `🌤️ ${valid.title}`;

    const description = root.document.createElement('p');
    description.textContent = valid.description;

    const list = root.document.createElement('div');
    list.className = 'bh-daily-list';
    plan.activities.forEach((activity, index) => list.appendChild(createActivityLink(root, activity, index)));

    const note = root.document.createElement('p');
    note.className = 'bh-daily-note';
    note.textContent = 'Bé có thể chọn một hoạt động, chơi cả ba hoặc chọn trò khác nhé.';

    section.append(heading, description, list, note);
    main.parentNode.insertBefore(section, main);
    return section;
  }

  async function init(root, fetchImpl = root.fetch?.bind(root), date = new Date()) {
    if (!fetchImpl) throw new Error('Fetch không khả dụng');
    const response = await fetchImpl(CONTENT_URL, { cache: 'no-cache' });
    if (!response?.ok) throw new Error(`Không tải được Hôm nay của Bông: HTTP ${response?.status || 0}`);
    const content = await response.json();
    render(root, content, date);
    return { content: validateContent(content), plan: selectPlan(content, date) };
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    contentUrl: CONTENT_URL,
    validateContent,
    localDayNumber,
    selectPlan,
    render,
    init
  });
});
