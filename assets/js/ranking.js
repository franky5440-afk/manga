// ranking.js — 每日排序唯一真相來源（無 DOM 操作）
// 正式排序讀 data/ranking.json（中文維基每日瀏覽量，由 tools/fetch_ranking.py 產生）。
// 讀不到時退回本機 hash 排序，確保離線直接開檔仍能運作。
// fallback 規則：score = baseScore + (xfnv1a(id + seed) % 20) - 10，seed = 台灣時區當日 YYYY-MM-DD
function xfnv1a(str) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todaySeed(date) {
  var d = date || new Date();
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  var y = '', m = '', day = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') y = parts[i].value;
    if (parts[i].type === 'month') m = parts[i].value;
    if (parts[i].type === 'day') day = parts[i].value;
  }
  return y + '-' + m + '-' + day;
}

function scoreOf(manga, seed) {
  return manga.baseScore + (xfnv1a(manga.id + seed) % 20) - 10;
}

function getRankBySeed(list, seed) {
  var ranked = list.map(function (m) {
    return {
      id: m.id,
      title: m.title,
      author: m.author,
      cover: m.cover,
      color: m.color,
      genre: m.genre,
      synopsis: m.synopsis,
      baseScore: m.baseScore,
      chapters: m.chapters,
      todayScore: scoreOf(m, seed)
    };
  });
  ranked.sort(function (a, b) {
    if (b.todayScore !== a.todayScore) return b.todayScore - a.todayScore;
    return a.title.localeCompare(b.title, 'zh-Hant');
  });
  ranked.forEach(function (m, i) { m.rank = i + 1; });
  return { seed: seed, list: ranked };
}

function getTodayRank(list, date) {
  return getRankBySeed(list, todaySeed(date));
}

// seed 加減天數（台灣無日光節約，用 UTC 日期加減即可）
function seedPlus(seed, delta) {
  var p = seed.split('-');
  var t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + delta * 86400000);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
}

// 與昨日相比的升降：正數=上升，負數=下降，0=持平
function rankDiff(todayList, ydayList) {
  var prev = {};
  ydayList.forEach(function (m) { prev[m.id] = m.rank; });
  var diff = {};
  todayList.forEach(function (m) { diff[m.id] = prev[m.id] - m.rank; });
  return diff;
}

// ── 真實排行：讀 data/ranking.json ──────────────────────────────
// 20260904 → 2026-09-04
function formatDataDate(s) {
  if (!s || s.length !== 8) return s || '';
  return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
}

// 把 ranking.json 的名次套回書本資料；資料不可用時回 null，由呼叫端退回 fallback
function getLiveRank(books, live) {
  var rows = live && live.cjk && live.cjk.list;
  if (!rows || !rows.length) return null;
  var byId = {};
  books.forEach(function (b) { byId[b.id] = b; });

  var list = [];
  rows.forEach(function (r) {
    var b = byId[r.id];
    if (!b) return;  // 書池移除過的書就跳過，不要讓榜單出現查不到的項目
    var m = {};
    for (var k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) m[k] = b[k]; }
    m.rank = list.length + 1;  // 重新編號，避免跳過的書留下空號
    m.views = r.views;
    m.prevRank = r.prevRank;
    list.push(m);
  });
  if (!list.length) return null;

  return {
    seed: formatDataDate(live.cjk.dataDate),
    dataDate: live.cjk.dataDate,
    source: live.cjk.source,
    list: list,
    live: true
  };
}

// 真實榜的升降：直接用 ranking.json 帶來的前次名次，不必再算一次昨日排序
function liveDiff(list) {
  var diff = {};
  list.forEach(function (m) {
    diff[m.id] = (m.prevRank === null || m.prevRank === undefined) ? null : m.prevRank - m.rank;
  });
  return diff;
}
