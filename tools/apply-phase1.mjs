import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = ['index.html', ...Array.from({ length: 10 }, (_, i) => `game${i + 1}.html`)];
const canonicalBase = 'https://bong.no.id.vn/';
const description = 'Bông Home’s – 10 trò chơi vui giúp bé luyện trí nhớ, quan sát và tư duy.';
const ogImage = `${canonicalBase}icon-512.png`;

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const canonical = file === 'index.html' ? canonicalBase : `${canonicalBase}${file}`;
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1] || "Bông Home's";

  if (!html.includes('name="description"')) {
    html = html.replace(
      /(<title>[^<]+<\/title>)/i,
      `$1\n<meta name="description" content="${description}">\n<link rel="canonical" href="${canonical}">\n<meta property="og:locale" content="vi_VN">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Bông Home's">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${description}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${ogImage}">\n<meta property="og:image:width" content="512">\n<meta property="og:image:height" content="512">\n<meta name="twitter:card" content="summary_large_image">`
    );
  }

  if (!html.includes('shared-ui.js')) {
    html = html.replace('</head>', '<script src="./shared-ui.js" defer></script>\n</head>');
  }

  html = html.replace(
    /function batLoa\(\)\s*\{/g,
    'function batLoa(){\n  if(window.BongSound && !window.BongSound.isEnabled()) return null;'
  );

  html = html.replace(
    /const ctx = batLoa\(\);\s*\n\s*const bd/g,
    'const ctx = batLoa();\n  if(!ctx) return;\n  const bd'
  );

  html = html.replace(/<div class="muc-do"([^>]*)>/g, '<div class="muc-do"$1 role="group" aria-label="Chọn mức độ">');
  html = html.replace(/<button([^>]*class="dang-chon"[^>]*)>/g, '<button$1 aria-pressed="true">');
  html = html.replace(/<button((?!aria-pressed)[^>]*data-cap[^>]*)>/g, '<button$1 aria-pressed="false">');

  html = html.replace(
    /<div class="man-thang" id="manThang">/g,
    '<div class="man-thang" id="manThang" role="dialog" aria-modal="true" aria-labelledby="tieuDeThang" aria-describedby="loiKhen">'
  );
  html = html.replace(/<h2>Bé giỏi quá!<\/h2>/g, '<h2 id="tieuDeThang">Bé giỏi quá!</h2>');
  html = html.replace(/<p class="loi">/g, '<p class="loi" id="loiKhen">');

  if (file === 'index.html') {
    html = html.replace(/setTimeout\(\(\) => \{ window\.location\.href = lop\.file; \}, 430\);/, 'setTimeout(() => { window.location.href = lop.file; }, 220);');
    html = html.replace(/10 trò chơi rèn trí não cho bé 6 tuổi/g, '10 trò chơi vui giúp bé luyện trí nhớ, quan sát và tư duy');
  }

  fs.writeFileSync(filePath, html);
}

const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.description = '10 trò chơi vui giúp bé luyện trí nhớ, quan sát và tư duy';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const readmePath = path.join(root, 'README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  readme = readme.replace(/10 trò chơi rèn trí não/g, '10 trò chơi vui giúp bé luyện trí nhớ, quan sát và tư duy');
  fs.writeFileSync(readmePath, readme);
}

const sw = `/* BÔNG HOME'S - Service Worker */
const PHIEN_BAN = "bonghome-v6";
const DANH_SACH_LUU = [
  "./", "./index.html",
  ${Array.from({ length: 10 }, (_, i) => `"./game${i + 1}.html"`).join(', ')},
  "./shared-ui.js", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-512.png", "./apple-touch-icon.png"
];

async function baoChoTatCa(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PHIEN_BAN);
    const results = await Promise.allSettled(
      DANH_SACH_LUU.map(async (url) => {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!response.ok) throw new Error(\`\${url}: HTTP \${response.status}\`);
        await cache.put(url, response);
        return url;
      })
    );
    const failed = results
      .map((result, index) => result.status === "rejected" ? DANH_SACH_LUU[index] : null)
      .filter(Boolean);
    if (failed.length) {
      await caches.delete(PHIEN_BAN);
      await baoChoTatCa({ type: "CACHE_FAILED", failed });
      throw new Error(\`Không tải đủ tệp offline: \${failed.join(', ')}\`);
    }
    await baoChoTatCa({ type: "CACHE_READY" });
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== PHIEN_BAN).map((name) => caches.delete(name)));
    await self.clients.claim();
    await baoChoTatCa({ type: "CACHE_READY" });
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response?.ok && response.type === "basic") {
        const cache = await caches.open(PHIEN_BAN);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (event.request.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 503, statusText: "Không có mạng" });
    }
  })());
});
`;
fs.writeFileSync(path.join(root, 'sw.js'), sw);

console.log('Đã áp dụng đầy đủ cải tiến Giai đoạn 1.');
