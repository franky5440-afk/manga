// check_home_picks.mjs — 首頁第二排「書庫精選」契約（spec.md §11.1）
// 執行：node tools/check_home_picks.mjs
// 前半段驗 library.js 的 dailyPicks() 純函式；後半段用 node:vm 跑首頁 render，驗兩排書架的結構。
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── dailyPicks 純函式 ─────────────────────────────────────
const ctx = vm.createContext({});
vm.runInContext(read('assets/js/ranking.js') + '\n' + read('assets/js/library.js'), ctx);
const pool = JSON.parse(read('data/manga.json'));
const ids = (list) => Array.from(list, (b) => b.id);
// 規格的參考算法：依 xfnv1a(id + seed) 由小到大、同值依 id，排除 excludeIds 後取前 n 本
function expected(list, exclude, seed, n) {
  const ex = new Set(exclude || []);
  return list.filter((b) => !ex.has(b.id))
    .map((b) => ({ id: b.id, h: ctx.xfnv1a(b.id + seed) }))
    .sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n).map((x) => x.id);
}
const TOP = ['bleach', 'frieren', 'attack-on-titan', 'jujutsu-kaisen', 'demon-slayer', 'one-piece', 'my-hero-academia', 'haikyu', 'naruto', 'chainsaw-man'];

await test('dailyPicks 是 library.js 的全域函式', () => {
  ok(typeof ctx.dailyPicks === 'function', 'library.js 沒有 dailyPicks');
});
await test('dailyPicks：排除前 10 名後依 xfnv1a(id + seed) 取 10 本', () => {
  const got = ids(ctx.dailyPicks(pool, TOP, '2026-09-14', 10));
  ok(same(got, expected(pool, TOP, '2026-09-14', 10)), '實際 ' + got.join(','));
  ok(got.every((id) => !TOP.includes(id)), '混入了前 10 名的書');
});
await test('dailyPicks：同一個 seed 結果固定，換日期會換一批', () => {
  const a = ids(ctx.dailyPicks(pool, TOP, '2026-09-14', 10));
  ok(same(a, ids(ctx.dailyPicks(pool, TOP, '2026-09-14', 10))), '同 seed 兩次結果不同');
  ok(!same(a, ids(ctx.dailyPicks(pool, TOP, '2026-09-15', 10))), '換日期結果完全相同');
});
await test('dailyPicks：回傳複本並帶 src="manga" 與布林 ended，不改動輸入', () => {
  const before = JSON.stringify(pool);
  const got = ctx.dailyPicks(pool, TOP, '2026-09-14', 10);
  ok(Array.from(got).every((b) => b.src === 'manga' && typeof b.ended === 'boolean'), '缺 src 或 ended');
  got[0].title = '被改掉';
  ok(JSON.stringify(pool) === before, '輸入陣列或物件被改動');
});
await test('dailyPicks：可用數量不足 n 時全給；excludeIds 為 null 時不排除；空書池回傳空陣列', () => {
  const small = pool.slice(0, 12);
  ok(ctx.dailyPicks(small, TOP, '2026-09-14', 10).length === small.filter((b) => !TOP.includes(b.id)).length, '數量不足時應全部回傳');
  ok(same(ids(ctx.dailyPicks(pool, null, 'x', 5)), expected(pool, [], 'x', 5)), 'excludeIds 為 null 時結果不符');
  ok(ctx.dailyPicks(null, TOP, 'x', 10).length === 0, '空書池應回傳空陣列');
});

// ── 首頁 render ───────────────────────────────────────────
await test('index.html：第二排書架結構與「不是排名」說明', () => {
  const html = read('index.html');
  ok(/id="shelfViewport2"/.test(html) && /<ol class="shelf[^"]*" id="shelf2"/.test(html), '缺少 #shelfViewport2 或 <ol class="shelf" id="shelf2">');
  ok((html.match(/class="plank"/g) || []).length === 2, '兩排各要一條 .plank，實際 ' + (html.match(/class="plank"/g) || []).length);
  const i1 = html.indexOf('id="shelf"'), i2 = html.indexOf('id="shelf2"');
  ok(i1 > -1 && i2 > i1, '#shelf2 要排在 #shelf 後面');
  ok(html.includes('書庫精選') && html.includes('不是排名'), '缺少「書庫精選」標題或「不是排名」說明');
});

const src = read('assets/js/ranking.js') + '\n' + read('assets/js/library.js') + '\n' + read('assets/js/app.js');
async function renderIndex() {
  const idsEl = ['dateBadge', 'heroDate', 'shelf', 'shelf2', 'rankList', 'globalList', 'rankNote', 'genreChips'];
  const els = Object.fromEntries(idsEl.map((id) => [id, { textContent: '', innerHTML: '', children: [], addEventListener: () => {} }]));
  const sandbox = {
    console, URLSearchParams,
    document: {
      body: { getAttribute: () => 'index', setAttribute: () => {} },
      getElementById: (id) => els[id] || null,
      querySelectorAll: () => [],
      querySelector: () => ({ classList: { toggle: () => {} }, offsetHeight: 0 }),
      title: ''
    },
    location: { search: '', pathname: '/index.html' },
    history: { replaceState: () => {} },
    window: { addEventListener: () => {}, scrollY: 0, matchMedia: () => ({ matches: true }) },
    fetch: (url) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(read(url))) })
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  await sleep(60);
  return els;
}
const hrefIds = (html) => [...html.matchAll(/href="manga\.html\?id=([^"&]+)/g)].map((m) => m[1]);

await test('index render：第一排維持熱門前 10 名、有名次', async () => {
  const els = await renderIndex();
  ok((els.shelf.innerHTML.match(/class="book-card"/g) || []).length === 10, '第一排書卡數量不是 10');
  ok(els.shelf.innerHTML.includes('class="rank"'), '第一排應顯示名次');
});
await test('index render：第二排 10 本、與第一排不重複、順序等於 dailyPicks、不顯示名次', async () => {
  const els = await renderIndex();
  const row1 = hrefIds(els.shelf.innerHTML);
  const row2 = hrefIds(els.shelf2.innerHTML);
  ok(row2.length === 10, '第二排書卡數量=' + row2.length);
  ok(row2.every((id) => !row1.includes(id)), '第二排混入第一排的書');
  const live = JSON.parse(read('data/ranking.json'));
  const seed = live.cjk.dataDate.slice(0, 4) + '-' + live.cjk.dataDate.slice(4, 6) + '-' + live.cjk.dataDate.slice(6, 8);
  ok(same(row2, expected(pool, row1, seed, 10)), '第二排順序不等於 dailyPicks(manga, 前10名, ' + seed + ', 10)：' + row2.join(','));
  ok(!els.shelf2.innerHTML.includes('class="rank"'), '第二排不可顯示名次');
  ok((els.shelf2.innerHTML.match(/data-genre="/g) || []).length === 10, '第二排每本要帶 data-genre，類型篩選才作用得到');
});

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
