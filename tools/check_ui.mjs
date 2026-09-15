// check_ui.mjs — 2026-09 改版（胡桃木書房配色）的介面契約測試，本機執行：node tools/check_ui.mjs
// 靜態檢查 HTML／CSS，並沿用 check_pages.mjs 的 node:vm 手法跑 app.js 看 render 結果。
// 外觀好不好看不在這裡驗（review 端截圖），這裡只釘「結構與規則」。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const PAGES = ['index.html', 'library.html', 'essentials.html', 'timeless.html', 'manga.html', 'chapter.html'];
const EXISTING = PAGES.filter((p) => p !== 'library.html');   // library.html 是第二階段才新增

// ── CSS ───────────────────────────────────────────────────
const css = read('assets/css/style.css');
await test('style.css 定義胡桃木書房色票', () => {
  const tokens = {
    '--ground': '#1b1411', '--surface': '#2a2019', '--ink': '#f0e4cc', '--muted': '#ad9a7e',
    '--line': '#3d2f25', '--accent': '#86b89a', '--plank-top': '#7a5130', '--plank': '#4a2f1b'
  };
  for (const [k, v] of Object.entries(tokens)) {
    ok(new RegExp(k + '\\s*:\\s*' + v + '\\s*;', 'i').test(css), '缺少 ' + k + ': ' + v);
  }
});
await test('style.css 固定深色：不跟系統切換、宣告 color-scheme: dark', () => {
  ok(!/prefers-color-scheme/.test(css), '仍有 prefers-color-scheme 區塊');
  ok(/color-scheme\s*:\s*dark\s*;/.test(css), '缺少 color-scheme: dark');
});
await test('style.css 標題字體只用系統楷體堆疊，不載入外部字體', () => {
  const m = css.match(/--display\s*:\s*([^;]+);/);
  ok(m, '缺少 --display 字體變數');
  for (const f of ['Kaiti TC', 'DFKai-SB']) ok(m[1].includes(f), '--display 缺少 ' + f);
  ok(/serif\s*$/.test(m[1].trim()), '--display 最後要退回 serif');
  ok(!/@import|@font-face|url\(\s*['"]?https?:/i.test(css), 'style.css 不可載入外部資源或自訂字型');
});

// ── HTML 殼 ───────────────────────────────────────────────
for (const p of EXISTING) {
  await test(p + '：導覽列、搜尋框、深色宣告', () => {
    const html = read(p);
    ok(html.includes('<meta name="color-scheme" content="dark">'), '缺少 color-scheme meta');
    ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), '不可引用 Google Fonts');
    const nav = (html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/) || [])[0];
    ok(nav, '找不到 <nav class="site-nav">');
    const links = [...nav.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2], m[3].trim()]);
    const want = [['index.html', 'index', '每日熱門'], ['library.html', 'library', '書庫'], ['essentials.html', 'essentials', '必讀經典'], ['timeless.html', 'timeless', '有生之年']];
    ok(JSON.stringify(links) === JSON.stringify(want), '導覽連結應為 ' + JSON.stringify(want) + '，實際 ' + JSON.stringify(links));
    const form = (html.match(/<form class="site-search"[^>]*>[\s\S]*?<\/form>/) || [])[0];
    ok(form, '找不到 <form class="site-search">');
    ok(/action="library\.html"/.test(form) && /role="search"/.test(form), '搜尋表單要 action="library.html" role="search"');
    ok(/<input[^>]*type="search"[^>]*>/.test(form) && /name="q"/.test(form) && /id="siteSearch"/.test(form), '搜尋框要 type="search" name="q" id="siteSearch"');
    ok(/<label[^>]*for="siteSearch"/.test(form) || /aria-label="[^"]+"/.test(form), '搜尋框要有 label 或 aria-label');
    ok(!/Top 10/.test(html.match(/<a class="brand"[\s\S]*?<\/a>/)?.[0] || ''), '品牌字不再帶「Top 10」');
  });
}

// ── render（沿用 check_pages.mjs 的 stub）───────────────────
const rankingSrc = read('assets/js/ranking.js');
const appSrc = read('assets/js/app.js');
async function render(page, search) {
  const ids = ['dateBadge', 'heroDate', 'shelf', 'rankList', 'fixedList', 'detail', 'chList', 'chapter', 'chNav', 'crumbTitle', 'crumbCh', 'crumbHome', 'crumbBook'];
  const els = Object.fromEntries(ids.map((id) => [id, { textContent: '', innerHTML: '', href: '' }]));
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
    window: { addEventListener: () => {}, scrollY: 0, matchMedia: () => ({ matches: true }) },
    fetch: (url) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(read(url))) })
  };
  vm.createContext(sandbox);
  vm.runInContext(rankingSrc + '\n' + appSrc, sandbox);
  await sleep(50);
  return els;
}
// 以 <li 切段，找出含某書連結的那一段
function cardOf(html, id) {
  return html.split('<li').find((s) => s.includes('id=' + id + '"') || s.includes('id=' + id + '&')) || '';
}
const cardCount = (html) => (html.match(/class="book-card"/g) || []).length;

await test('index：書架 10 張正面書卡，含書名／作者／類型', async () => {
  const els = await render('index', '');
  ok(cardCount(els.shelf.innerHTML) === 10, 'book-card 數量=' + cardCount(els.shelf.innerHTML));
  for (const c of ['bc-title', 'bc-author', 'bc-genre', 'bc-num', 'bc-status']) {
    ok((els.shelf.innerHTML.match(new RegExp('class="' + c + '[ "]', 'g')) || []).length === 10, c + ' 不是每張卡都有');
  }
  ok((els.rankList.innerHTML.match(/<li/g) || []).length === 10, '華文圈榜仍須 10 本');
});
await test('index：書卡依 ended 顯示完結／連載中與話數', async () => {
  const els = await render('index', '');
  const bleach = cardOf(els.shelf.innerHTML, 'bleach');
  ok(bleach.includes('完結') && bleach.includes('全 686 話'), 'BLEACH 卡應含「完結」「全 686 話」：' + bleach.slice(0, 200));
  const op = cardOf(els.shelf.innerHTML, 'one-piece');
  ok(op.includes('連載中') && op.includes('最新 1180 話'), '航海王卡應含「連載中」「最新 1180 話」：' + op.slice(0, 200));
});
await test('timeless：18 張書卡、標示未完結、連結帶 src=classics', async () => {
  const els = await render('timeless', '');
  ok(cardCount(els.fixedList.innerHTML) === 18, 'book-card 數量=' + cardCount(els.fixedList.innerHTML));
  ok(els.fixedList.innerHTML.includes('未完結'), '缺少「未完結」');
  ok(els.fixedList.innerHTML.includes('src=classics'), '缺少 src=classics');
});
await test('essentials：書卡標示完結與全話數', async () => {
  const els = await render('essentials', '');
  const fma = cardOf(els.fixedList.innerHTML, 'fullmetal-alchemist');
  ok(fma.includes('class="book-card"') && fma.includes('完結') && fma.includes('全 108 話'), '鋼之鍊金術師卡應含「完結」「全 108 話」：' + fma.slice(0, 200));
});
await test('書卡文字一律經過 esc()：app.js 裡組 book-card 的地方不可直接拼 m.title / m.author', () => {
  const block = appSrc.match(/function cardHTML[\s\S]*?\n  }\n/);
  ok(block, 'app.js 要有 function cardHTML(...) 集中產生書卡（首頁與固定收藏共用）');
  ok(!/\+\s*m\.(title|author|synopsis)\b/.test(block[0]), 'cardHTML 內有未經 esc() 的欄位');
});

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
