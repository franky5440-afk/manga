// check_library_page.mjs — v2.0 第二階段契約：書庫頁 library.html ＋ 必讀經典合併書池完結書
// 執行：node tools/check_library_page.mjs
// 互動（點類型／切換完結）靠 review 端開瀏覽器驗，這裡釘「初次載入的 render 結果」與「頁面結構」。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const PAGES = ['index.html', 'library.html', 'essentials.html', 'timeless.html', 'manga.html', 'chapter.html'];
const count = (html, re) => (html.match(re) || []).length;
const cards = (html) => count(html, /class="book-card"/g);
const cardOf = (html, id) => html.split('<li').find((s) => s.includes('id=' + id + '"') || s.includes('id=' + id + '&')) || '';
const TOTAL = ['manga', 'essentials', 'classics'].reduce((n, f) => n + JSON.parse(read('data/' + f + '.json')).length, 0);
const ESS = JSON.parse(read('data/essentials.json')).length + JSON.parse(read('data/manga.json')).filter((b) => b.ended === true).length;

// ── 頁面結構 ──────────────────────────────────────────────
await test('library.html 存在，data-page="library"，導覽列標示書庫為目前分頁', () => {
  ok(exists('library.html'), 'library.html 不存在');
  const html = read('library.html');
  ok(/<body data-page="library">/.test(html), 'body 要 data-page="library"');
  ok(/<a href="library\.html" data-nav="library" aria-current="page">書庫<\/a>/.test(html), '書庫連結要 aria-current="page"');
  ok(html.includes('<meta name="color-scheme" content="dark">'), '缺少 color-scheme meta');
  ok(/<form class="site-search" action="library\.html" role="search">/.test(html), '缺少導覽列搜尋表單');
});
await test('library.html 書庫專用元件齊全', () => {
  const html = read('library.html');
  ok(/<input[^>]*id="libSearch"[^>]*>/.test(html) && /<input[^>]*id="libSearch"[^>]*type="search"|<input[^>]*type="search"[^>]*id="libSearch"/.test(html), '缺少 <input type="search" id="libSearch">');
  ok(/<label[^>]*for="libSearch"|id="libSearch"[^>]*aria-label="|aria-label="[^"]+"[^>]*id="libSearch"/.test(html), 'libSearch 要有 label 或 aria-label');
  for (const id of ['libChips', 'libStatus', 'libCount', 'libList']) ok(html.includes('id="' + id + '"'), '缺少 #' + id);
  ok(/id="libCount"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="libCount"/.test(html), '#libCount 要 aria-live="polite"，篩選結果數才讀得出來');
});
for (const p of PAGES) {
  await test(p + '：依序載入 ranking.js → library.js → app.js', () => {
    const html = read(p);
    const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    ok(JSON.stringify(order) === JSON.stringify(['assets/js/ranking.js', 'assets/js/library.js', 'assets/js/app.js']), '實際順序 ' + JSON.stringify(order));
  });
}

// ── render（沿用 check_pages.mjs 的 stub，另加 library.js 與書庫元件）──
const src = read('assets/js/ranking.js') + '\n' + read('assets/js/library.js') + '\n' + read('assets/js/app.js');
async function render(page, search) {
  const ids = ['dateBadge', 'heroDate', 'shelf', 'rankList', 'fixedList', 'detail', 'chList', 'chapter', 'chNav',
    'crumbTitle', 'crumbCh', 'crumbHome', 'crumbBook', 'libList', 'libCount', 'libChips', 'libStatus', 'libSearch', 'siteSearch'];
  const els = Object.fromEntries(ids.map((id) => [id, {
    textContent: '', innerHTML: '', href: '', value: '', children: [],
    addEventListener: () => {}, setAttribute: () => {}, getAttribute: () => null, classList: { toggle: () => {}, add: () => {}, remove: () => {} }
  }]));
  const sandbox = {
    console, URLSearchParams,
    document: {
      body: { getAttribute: () => page, setAttribute: () => {} },
      getElementById: (id) => els[id] || null,
      querySelectorAll: () => [],
      querySelector: () => ({ classList: { toggle: () => {} }, offsetHeight: 0 }),
      title: ''
    },
    location: { search, pathname: '/' + page + '.html' },
    history: { replaceState: () => {} },
    window: { addEventListener: () => {}, scrollY: 0, matchMedia: () => ({ matches: true }) },
    fetch: (url) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(read(url))) })
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  await sleep(60);
  return els;
}

await test('library：無查詢時列出三檔全部書（' + TOTAL + ' 本），計數文字含總數', async () => {
  const els = await render('library', '');
  ok(cards(els.libList.innerHTML) === TOTAL, 'book-card 數量=' + cards(els.libList.innerHTML));
  ok(els.libCount.textContent.includes(String(TOTAL)), 'libCount=' + JSON.stringify(els.libCount.textContent));
});
await test('library：連結規則——書池不帶 src、固定收藏帶 src', async () => {
  const html = (await render('library', '')).libList.innerHTML;
  ok(/href="manga\.html\?id=bleach"/.test(html), 'bleach 應連到 manga.html?id=bleach');
  ok(/href="manga\.html\?id=fullmetal-alchemist&amp;src=essentials"|href="manga\.html\?id=fullmetal-alchemist&src=essentials"/.test(html), '鋼之鍊金術師應帶 src=essentials');
  ok(/href="manga\.html\?id=berserk&amp;src=classics"|href="manga\.html\?id=berserk&src=classics"/.test(html), '烙印勇士應帶 src=classics');
});
await test('library：?q= 帶入搜尋框並套用 searchBooks 排序', async () => {
  const els = await render('library', '?q=' + encodeURIComponent('死'));
  ok(els.libSearch.value === '死', 'libSearch.value=' + JSON.stringify(els.libSearch.value));
  const html = els.libList.innerHTML;
  const order = [...html.matchAll(/href="manga\.html\?id=([^"&]+)/g)].map((m) => m[1]);
  ok(order.length > 0, '「死」應該有結果');
  // 書名含「死」的必須全部排在只有簡介含「死」的前面
  const titled = new Set(['bleach', 'death-note']);
  const firstOther = order.findIndex((id) => !titled.has(id));
  ok(order.slice(0, 2).every((id) => titled.has(id)) && (firstOther === -1 || firstOther >= 2), '書名命中未排前面：' + order.slice(0, 5).join(','));
});
await test('library：全形查詢可命中（ＢＬＥＡＣＨ）', async () => {
  const html = (await render('library', '?q=' + encodeURIComponent('ＢＬＥＡＣＨ'))).libList.innerHTML;
  ok(cards(html) === 1 && html.includes('id=bleach'), '應只找到 BLEACH，實際 ' + cards(html) + ' 張');
});
await test('library：查無結果顯示友善訊息，且查詢字串經過跳脫', async () => {
  const q = '<img src=x onerror=alert(1)>';
  const els = await render('library', '?q=' + encodeURIComponent(q));
  ok(cards(els.libList.innerHTML) === 0, '不應有書卡');
  const shown = els.libList.innerHTML + els.libCount.innerHTML;
  ok((els.libList.innerHTML + els.libCount.textContent).includes('找不到'), '缺少「找不到」訊息');
  ok(!shown.includes('<img'), '查詢字串未跳脫就寫進 innerHTML');
});
await test('library：類型按鈕由 genreCounts 產生，第一顆是「全部」且預設按下', async () => {
  const html = (await render('library', '')).libChips.innerHTML;
  const btns = [...html.matchAll(/<button[^>]*data-g="([^"]*)"[^>]*aria-pressed="(true|false)"/g)];
  ok(btns.length >= 2, '類型按鈕數=' + btns.length);
  ok(btns[0][1] === '全部' && btns[0][2] === 'true', '第一顆應為「全部」且 aria-pressed="true"');
  ok(btns.slice(1).every((b) => b[2] === 'false'), '其他按鈕預設不按下');
});
await test('library：完結狀態切換有三顆（全部／已完結／連載中），預設全部', async () => {
  const html = (await render('library', '')).libStatus.innerHTML;
  const btns = [...html.matchAll(/<button[^>]*data-s="([^"]*)"[^>]*aria-pressed="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2], m[3]]);
  ok(JSON.stringify(btns) === JSON.stringify([['all', 'true', '全部'], ['ended', 'false', '已完結'], ['ongoing', 'false', '連載中']]), '實際 ' + JSON.stringify(btns));
});

await test('essentials：固定收藏＋書池完結書，共 ' + ESS + ' 本，badge 同步', async () => {
  const els = await render('essentials', '');
  ok(cards(els.fixedList.innerHTML) === ESS, 'book-card 數量=' + cards(els.fixedList.innerHTML));
  ok(els.dateBadge.textContent.includes(ESS + ' 本'), 'badge=' + JSON.stringify(els.dateBadge.textContent));
});
await test('essentials：合併進來的書池書連到 manga.html（不帶 src）、標完結與全話數', async () => {
  const html = (await render('essentials', '')).fixedList.innerHTML;
  const b = cardOf(html, 'bleach');
  ok(/href="manga\.html\?id=bleach"/.test(b), 'bleach 連結應不帶 src：' + b.slice(0, 160));
  ok(b.includes('完結') && b.includes('全 686 話'), 'bleach 卡應含完結與全 686 話');
  ok(!/href="manga\.html\?id=one-piece/.test(html), '連載中的航海王不可出現在必讀經典');
  const fma = cardOf(html, 'fullmetal-alchemist');
  ok(/src=essentials/.test(fma), '原本的固定收藏仍帶 src=essentials');
});
await test('essentials：固定收藏排在前面（依 fixedRank），書池完結書接在後面', async () => {
  const html = (await render('essentials', '')).fixedList.innerHTML;
  const order = [...html.matchAll(/href="manga\.html\?id=([^"&]+)/g)].map((m) => m[1]);
  const essIds = JSON.parse(read('data/essentials.json')).sort((a, b) => a.fixedRank - b.fixedRank).map((b) => b.id);
  ok(JSON.stringify(order.slice(0, essIds.length)) === JSON.stringify(essIds), '前 ' + essIds.length + ' 本順序不符');
});
await test('manga：從必讀經典點進書池完結書（不帶 src）可正常顯示', async () => {
  const els = await render('manga', '?id=bleach');
  ok(els.detail.innerHTML.includes('BLEACH') && !els.detail.innerHTML.includes('找不到'), '詳情頁異常');
});

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
