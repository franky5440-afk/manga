// test_library.mjs — assets/js/library.js 的契約測試（純函式，不碰 DOM）
// 執行：node tools/test_library.mjs
// library.js 跟 ranking.js 一樣是「頂層宣告函式、瀏覽器當全域用」，所以用 node:vm 載入，不用 import。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.join(root, 'assets/js/library.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '\n   ', e.message.split('\n').join('\n    ')); }
}

// 沒有 document / window：library.js 必須能在沒有 DOM 的環境載入
const ctx = vm.createContext({});
test('library.js 存在且可在無 DOM 環境載入', () => {
  assert.ok(fs.existsSync(file), 'assets/js/library.js 不存在');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
});
const L = ctx;
const ids = (list) => Array.from(list, (b) => b.id);
// vm 內外的 Array 不同源，deepStrictEqual 會因原型不同而失敗，一律轉成外部陣列再比
const arr = (x) => JSON.parse(JSON.stringify(x));

function fixtures() {
  return {
    manga: [
      { id: 'm1', title: '航海王', author: '尾田榮一郎', genre: ['冒險', '熱血'], synopsis: '魯夫出海尋找大秘寶，途中與死神擦身而過', ended: false, chapters: [{ num: 1 }, { num: 1180 }] },
      { id: 'm2', title: 'BLEACH 死神', author: '久保帶人', genre: ['戰鬥', '超自然'], synopsis: '一護獲得死神之力', ended: true, chapters: [{ num: 1 }, { num: 686 }] },
      { id: 'm3', title: '排球少年！！', author: '古館春一', genre: ['運動'], synopsis: '日向翔陽加入烏野', ended: true, chapters: [{ num: 1 }, { num: 402 }] },
      { id: 'm4', title: '舊資料書', author: '某作者', genre: ['劇情'], synopsis: '沒有 ended 欄位的書', chapters: [{ num: 1 }] }
    ],
    essentials: [
      { id: 'e2', title: '死亡筆記', author: '大場鶇、小畑健', genre: ['懸疑'], synopsis: '夜神月拾獲筆記', fixedRank: 2, chapters: [{ num: 108 }] },
      { id: 'e1', title: '鋼之鍊金術師', author: '荒川弘', genre: ['奇幻'], synopsis: '愛德華兄弟踏上旅程', fixedRank: 1, chapters: [{ num: 108 }] }
    ],
    classics: [
      { id: 'c1', title: 'HUNTER×HUNTER', author: '冨樫義博', genre: ['冒險', '戰鬥'], synopsis: '小傑尋找父親', fixedRank: 1, chapters: [{ num: 400 }] }
    ]
  };
}

test('匯出六個函式', () => {
  for (const f of ['allBooks', 'essentialsList', 'searchBooks', 'filterBooks', 'genreCounts', 'bookHref']) {
    assert.equal(typeof L[f], 'function', f + ' 不是函式');
  }
});

// ── allBooks ──────────────────────────────────────────────
test('allBooks：順序為 manga → essentials → classics，各自保留檔案原順序', () => {
  assert.deepEqual(ids(L.allBooks(fixtures())), ['m1', 'm2', 'm3', 'm4', 'e2', 'e1', 'c1']);
});
test('allBooks：每本加上 src 與布林 ended', () => {
  const all = L.allBooks(fixtures());
  assert.deepEqual(arr(all.map((b) => b.src)), ['manga', 'manga', 'manga', 'manga', 'essentials', 'essentials', 'classics']);
  // essentials 一律完結、classics 一律未完結、manga 只有 ended === true 才算完結（缺欄位＝false，不猜）
  assert.deepEqual(arr(all.map((b) => b.ended)), [false, true, true, false, true, true, false]);
});
test('allBooks：回傳複本，不改動輸入', () => {
  const fx = fixtures();
  const all = L.allBooks(fx);
  all[0].title = '被改掉';
  assert.equal(fx.manga[0].title, '航海王');
  assert.equal('src' in fx.manga[0], false);
  assert.equal('ended' in fx.manga[3], false);
});
test('allBooks：缺少的資料集當空陣列', () => {
  assert.deepEqual(ids(L.allBooks({ manga: fixtures().manga })), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(ids(L.allBooks({ essentials: null, classics: undefined })), []);
});

// ── essentialsList ────────────────────────────────────────
test('essentialsList：固定收藏依 fixedRank，接著書池中 ended===true 的書（依書池順序）', () => {
  const fx = fixtures();
  const list = L.essentialsList(fx.essentials, fx.manga);
  assert.deepEqual(ids(list), ['e1', 'e2', 'm2', 'm3']);
  assert.deepEqual(arr(list.map((b) => b.src)), ['essentials', 'essentials', 'manga', 'manga']);
  assert.ok(list.every((b) => b.ended === true));
});
test('essentialsList：不改動輸入順序，null 參數當空陣列', () => {
  const fx = fixtures();
  L.essentialsList(fx.essentials, fx.manga);
  assert.deepEqual(ids(fx.essentials), ['e2', 'e1']);
  assert.deepEqual(ids(L.essentialsList(null, null)), []);
  assert.deepEqual(ids(L.essentialsList(null, fx.manga)), ['m2', 'm3']);
});

// ── searchBooks ───────────────────────────────────────────
const all = () => L.allBooks(fixtures());
test('searchBooks：空字串或空白回傳全部（新陣列、原順序）', () => {
  const list = all();
  const r = L.searchBooks(list, '   ');
  assert.notEqual(r, list);
  assert.deepEqual(ids(r), ids(list));
  assert.deepEqual(ids(L.searchBooks(list, undefined)), ids(list));
});
test('searchBooks：英文不分大小寫', () => {
  assert.deepEqual(ids(L.searchBooks(all(), 'bleach')), ['m2']);
});
test('searchBooks：全形／半形視為相同（NFKC）', () => {
  assert.deepEqual(ids(L.searchBooks(all(), 'ＢＬＥＡＣＨ')), ['m2']);
  assert.deepEqual(ids(L.searchBooks(all(), '排球少年!!')), ['m3']);
});
test('searchBooks：忽略查詢與書名中的空白', () => {
  assert.deepEqual(ids(L.searchBooks(all(), ' 航海 王 ')), ['m1']);
  assert.deepEqual(ids(L.searchBooks(all(), 'bleach死神')), ['m2']);
});
test('searchBooks：可搜作者、簡介（角色名）、類型', () => {
  assert.deepEqual(ids(L.searchBooks(all(), '荒川')), ['e1']);
  assert.deepEqual(ids(L.searchBooks(all(), '夜神月')), ['e2']);
  assert.deepEqual(ids(L.searchBooks(all(), '懸疑')), ['e2']);
});
test('searchBooks：排序為 書名命中 → 作者命中 → 其他（簡介／類型），同層維持原順序', () => {
  // m1 在清單最前面，但只有簡介含「死」，要排在兩本書名含「死」的後面
  assert.deepEqual(ids(L.searchBooks(all(), '死')), ['m2', 'e2', 'm1']);
  // e2 作者含「大」、m1 簡介含「大」→ 作者層優先
  assert.deepEqual(ids(L.searchBooks(all(), '大')), ['e2', 'm1']);
});
test('searchBooks：查無結果回傳空陣列', () => {
  assert.deepEqual(ids(L.searchBooks(all(), '不存在的書名xyz')), []);
});

// ── filterBooks ───────────────────────────────────────────
test('filterBooks：依類型', () => {
  assert.deepEqual(ids(L.filterBooks(all(), { genre: '戰鬥' })), ['m2', 'c1']);
});
test('filterBooks：genre 為空、「全部」或未給時不篩', () => {
  for (const g of ['', '全部', undefined]) {
    assert.deepEqual(ids(L.filterBooks(all(), { genre: g })), ids(all()));
  }
  assert.deepEqual(ids(L.filterBooks(all())), ids(all()));
});
test('filterBooks：依完結狀態（ended / ongoing / 其他值＝全部）', () => {
  assert.deepEqual(ids(L.filterBooks(all(), { status: 'ended' })), ['m2', 'm3', 'e2', 'e1']);
  assert.deepEqual(ids(L.filterBooks(all(), { status: 'ongoing' })), ['m1', 'm4', 'c1']);
  assert.deepEqual(ids(L.filterBooks(all(), { status: 'all' })), ids(all()));
});
test('filterBooks：類型與狀態同時生效', () => {
  assert.deepEqual(ids(L.filterBooks(all(), { genre: '冒險', status: 'ongoing' })), ['m1', 'c1']);
});

// ── genreCounts ───────────────────────────────────────────
test('genreCounts：回傳 {genre, count}，數量遞減', () => {
  const r = arr(L.genreCounts(all()));
  assert.equal(r.length, 8);
  assert.deepEqual(new Set(r.slice(0, 2).map((x) => x.genre)), new Set(['冒險', '戰鬥']));
  assert.deepEqual(r.slice(0, 2).map((x) => x.count), [2, 2]);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].count >= r[i].count, '未依數量遞減');
  assert.deepEqual(Object.keys(r[0]).sort(), ['count', 'genre']);
});

// ── bookHref ──────────────────────────────────────────────
test('bookHref：書池不帶 src，固定收藏帶 src', () => {
  const [m1, , , , e2, , c1] = all();
  assert.equal(L.bookHref(m1), 'manga.html?id=m1');
  assert.equal(L.bookHref(e2), 'manga.html?id=e2&src=essentials');
  assert.equal(L.bookHref(c1), 'manga.html?id=c1&src=classics');
});
test('bookHref：id 要 URL 編碼，未知 src 不帶參數', () => {
  assert.equal(L.bookHref({ id: 'a b&c', src: 'manga' }), 'manga.html?id=a%20b%26c');
  assert.equal(L.bookHref({ id: 'x', src: '__proto__' }), 'manga.html?id=x');
  assert.equal(L.bookHref({ id: 'y' }), 'manga.html?id=y');
});

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
