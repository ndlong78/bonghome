const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

/*
 * Nâng cấp phiên bản thật: bản phát hành trước (lấy từ lịch sử git) chạy trên thiết bị
 * với dữ liệu của bé, rồi bản hiện tại được deploy lên cùng origin. Kiểm tra dữ liệu còn
 * nguyên sau khi bấm "Cập nhật" và app mở được khi mất mạng hoặc mạng chập chờn.
 */

const ROOT = path.resolve(__dirname, '..');
const VERSION_PATTERN = /const PHIEN_BAN = "([^"]+)";/;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const versionAt = (ref) => {
  try { return VERSION_PATTERN.exec(git('show', `${ref}:sw.js`))?.[1] || null; }
  catch (error) { return null; }
};

/** Commit cha của commit đã đưa PHIEN_BAN hiện tại vào: đó là bản phát hành trước. */
function findPreviousRelease(currentVersion) {
  const commits = git('log', '-G', 'const PHIEN_BAN', '--format=%H', 'HEAD', '--', 'sw.js').split('\n').filter(Boolean);
  for (const commit of commits) {
    if (versionAt(commit) !== currentVersion) continue;
    const previous = versionAt(`${commit}^`);
    if (previous && previous !== currentVersion) return { ref: `${commit}^`, version: previous };
  }
  return null;
}

function exportTree(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonghome-previous-'));
  const archive = execFileSync('git', ['archive', '--format=tar', ref], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  return dir;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml'
};

/**
 * Máy chủ tĩnh đổi được thư mục phục vụ mà giữ nguyên origin. Header giống Cloudflare
 * static assets (ETag theo nội dung, max-age=0) để trình duyệt luôn hỏi lại máy chủ.
 * mode: 'serve' | 'down' (ngắt kết nối = mất mạng) | 'hang' (không trả lời = mạng chập chờn).
 */
function createSwitchableServer() {
  const state = { root: null, mode: 'serve' };
  const pending = new Set();
  const server = http.createServer((req, res) => {
    if (state.mode === 'down') { req.socket.destroy(); return; }
    if (state.mode === 'hang') { pending.add(res); return; }
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(state.root, pathname);
    if (!file.startsWith(state.root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const body = fs.readFileSync(file);
    const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
    const headers = {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'public, max-age=0, must-revalidate',
      etag
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, headers).end(body);
  });
  return {
    state,
    async start() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      return `http://127.0.0.1:${server.address().port}`;
    },
    setMode(mode) {
      state.mode = mode;
      if (mode !== 'hang') pending.forEach((res) => res.destroy());
      if (mode !== 'hang') pending.clear();
    },
    async stop() {
      pending.forEach((res) => res.destroy());
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function readParentCorner(page, origin) {
  await page.goto(`${origin}/parents.html`);
  await page.evaluate(() => window.BongModulesReady);
  // Chờ Góc phụ huynh render xong (có dòng trò chơi hoặc câu "chưa có hoạt động"),
  // để khi mất dữ liệu thì phép so sánh số liệu bên dưới báo rõ trước/sau.
  await page.waitForFunction(() => {
    const summary = document.getElementById('gameSummary');
    return Boolean(summary?.querySelector('article') || /Chưa có hoạt động nào/.test(summary?.textContent || ''));
  });
  return page.evaluate(() => ({
    completed: document.getElementById('completedCount').textContent,
    stars: document.getElementById('starCount').textContent,
    collection: document.getElementById('collectionCount').textContent
  }));
}

test.describe('Nâng cấp phiên bản trên thiết bị đã có dữ liệu của bé', () => {
  const currentVersion = VERSION_PATTERN.exec(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'))[1];
  let previous = null;
  let previousDir = null;
  const server = createSwitchableServer();
  let origin = '';

  test.beforeAll(async () => {
    previous = findPreviousRelease(currentVersion);
    if (!previous) {
      const probe = (...args) => { try { return git(...args); } catch (error) { return `ERR ${error.message.split('\n')[0]}`; } };
      const shallow = probe('rev-parse', '--is-shallow-repository');
      const diagnostics = {
        cwd: process.cwd(),
        root: ROOT,
        gitDir: probe('rev-parse', '--absolute-git-dir'),
        toplevel: probe('rev-parse', '--show-toplevel'),
        head: probe('log', '-3', '--format=%h %p %s', 'HEAD'),
        commitCount: probe('rev-list', '--count', 'HEAD'),
        versionCommits: probe('log', '-G', 'const PHIEN_BAN', '--format=%h', '-3', 'HEAD', '--', 'sw.js'),
        gitEnv: Object.keys(process.env).filter((key) => key.startsWith('GIT_')).join(',') || 'none'
      };
      throw new Error(
        `Không tìm thấy bản phát hành trước ${currentVersion} trong lịch sử git (shallow=${shallow}). `
        + `Chẩn đoán: ${JSON.stringify(diagnostics)}. `
        + 'Clone nông thì commit ở ranh giới không có commit cha: CI cần checkout fetch-depth: 0 '
        + 'và bước "Ensure full git history"; máy cục bộ chạy "git fetch --unshallow".'
      );
    }
    previousDir = exportTree(previous.ref);
    server.state.root = previousDir;
    origin = await server.start();
  });

  test.afterAll(async () => {
    await server.stop();
    if (previousDir) fs.rmSync(previousDir, { recursive: true, force: true });
  });

  test('dữ liệu còn nguyên qua lần cập nhật và app mở được khi mất mạng', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // 1. Bản trước: cài Service Worker và tạo dữ liệu như sau nhiều ngày chơi.
    await page.goto(`${origin}/index.html`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => window.BongModulesReady);
    await page.evaluate(() => {
      for (let index = 0; index < 40; index += 1) {
        const gameId = `game${(index % 13) + 1}`;
        window.BongProgress.completeGame(gameId, {
          transactionId: `${gameId}-before-${index}`,
          durationSeconds: 60 + index,
          moves: 10 + (index % 5)
        });
        window.BongRewards.awardStars(`${gameId}-before-${index}`, 3, { gameId });
      }
      window.BongRewards.unlockSticker('happy-star', { gameId: 'game1' });
      window.BongRewards.unlockBadge('first-finish', { gameId: 'game1' });
      window.BongProgress.saveGame('game2', { status: 'in_progress', state: { found: [1, 2] } });
      window.BongProfile.updateProfile({ displayName: 'Bông Nhỏ', avatarId: 'rabbit' });
      localStorage.setItem('kyluc_game1_de', '42');
    });
    const before = await readParentCorner(page, origin);
    expect(before).toEqual({ completed: '40', stars: '120', collection: '2' });
    expect(await page.evaluate(() => caches.keys())).toContain(`${previous.version}-shell`);

    // 2. Deploy bản hiện tại trên cùng origin; bé mở app và bấm "Cập nhật".
    server.state.root = ROOT;
    await page.goto(`${origin}/index.html`);
    const toast = page.locator('.bh-update-toast');
    await expect(toast).toBeVisible({ timeout: 30_000 });
    await Promise.all([page.waitForEvent('load'), toast.getByRole('button').click()]);
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 15_000 })
      .toEqual(expect.arrayContaining([`${currentVersion}-shell`, `${currentVersion}-games`, `${currentVersion}-content`]));
    expect((await page.evaluate(() => caches.keys())).filter((name) => name.startsWith(previous.version))).toEqual([]);

    const after = await readParentCorner(page, origin);
    expect(after).toEqual(before);
    await expect(page.locator('#storageHealth')).toBeHidden();
    const kept = await page.evaluate(() => ({
      profile: window.BongProfile.getProfile(),
      inProgress: window.BongProgress.loadGame('game2')?.state,
      record: localStorage.getItem('kyluc_game1_de'),
      health: window.BongStorage.getHealth()
    }));
    expect(kept.profile).toEqual(expect.objectContaining({ displayName: 'Bông Nhỏ', avatarId: 'rabbit' }));
    expect(kept.inProgress).toEqual({ found: [1, 2] });
    expect(kept.record).toBe('42');
    expect(kept.health).toEqual(expect.objectContaining({ persistent: true, recoveryMode: null, pendingWrite: false }));

    // 3. Mất mạng hẳn: trang mở ngay từ bản trong máy.
    server.setMode('down');
    for (const route of ['/game1.html', '/game12.html', '/game13.html', '/parents.html', '/index.html?from=icon']) {
      const started = Date.now();
      await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
      expect(Date.now() - started, `${route} phải mở ngay khi mất mạng`).toBeLessThan(2_500);
      await expect(page).toHaveTitle(/Bông Home/);
    }

    // 4. Mạng chập chờn: chờ tối đa NAVIGATION_TIMEOUT_MS rồi mở bản trong máy.
    server.setMode('hang');
    for (const route of ['/game5.html', '/parents.html']) {
      const started = Date.now();
      await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      const elapsed = Date.now() - started;
      expect(elapsed, `${route} phải chờ mạng trước khi dùng bản trong máy`).toBeGreaterThanOrEqual(2_500);
      expect(elapsed, `${route} không được treo theo mạng`).toBeLessThan(8_000);
      await expect(page).toHaveTitle(/Bông Home/);
    }

    // 5. Có mạng lại, bé thắng thêm một ván: lượt mới được lưu bền.
    server.setMode('serve');
    await page.goto(`${origin}/index.html`);
    await page.evaluate(() => window.BongModulesReady);
    await page.evaluate(() => window.BongProgress.completeGame('game13', {
      transactionId: 'game13-after-update-1', durationSeconds: 30, moves: 5
    }));
    await page.reload();
    expect((await readParentCorner(page, origin)).completed).toBe('41');

    expect(errors).toEqual([]);
  });
});
