// library.js — 書庫搜尋／篩選純函式（無 DOM 操作，瀏覽器載入後為全域函式）
function copyBook(b, src, ended) {
  var m = {};
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k)) m[k] = b[k];
  }
  if (Array.isArray(m.genre)) m.genre = m.genre.slice();
  if (Array.isArray(m.chapters)) m.chapters = m.chapters.slice();
  m.src = src;
  m.ended = ended;
  return m;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

// 三個資料檔合併：manga → essentials → classics，各自保留原順序
function allBooks(data) {
  var d = data || {};
  var out = [];
  var manga = asArray(d.manga);
  var essentials = asArray(d.essentials);
  var classics = asArray(d.classics);
  var i;
  for (i = 0; i < manga.length; i++) {
    out.push(copyBook(manga[i], 'manga', manga[i].ended === true));
  }
  for (i = 0; i < essentials.length; i++) {
    out.push(copyBook(essentials[i], 'essentials', true));
  }
  for (i = 0; i < classics.length; i++) {
    out.push(copyBook(classics[i], 'classics', false));
  }
  return out;
}

// 必讀經典：固定收藏依 fixedRank，接著書池中 ended === true 的書（依書池順序）
function essentialsList(essentials, manga) {
  var fixed = asArray(essentials).map(function (b) { return copyBook(b, 'essentials', true); });
  fixed.sort(function (a, b) {
    var ra = (typeof a.fixedRank === 'number') ? a.fixedRank : 9999;
    var rb = (typeof b.fixedRank === 'number') ? b.fixedRank : 9999;
    return ra - rb;
  });
  var pool = asArray(manga);
  var i;
  for (i = 0; i < pool.length; i++) {
    if (pool[i].ended === true) fixed.push(copyBook(pool[i], 'manga', true));
  }
  return fixed;
}

// 為什麼要先 NFKC：全形英文／全形驚嘆號與半形視為相同；為什麼去空白：書名與查詢的空格都忽略
function normText(s) {
  return String(s === undefined || s === null ? '' : s).normalize('NFKC').toLowerCase().replace(/\s/g, '');
}

function searchBooks(list, query) {
  var books = asArray(list);
  var nq = normText(query);
  if (!nq) return books.slice();
  var scored = [];
  var i;
  for (i = 0; i < books.length; i++) {
    var b = books[i];
    var tier = -1;
    if (normText(b.title).indexOf(nq) !== -1) {
      tier = 0;
    } else if (normText(b.author).indexOf(nq) !== -1) {
      tier = 1;
    } else {
      var hit = normText(b.synopsis).indexOf(nq) !== -1;
      if (!hit && Array.isArray(b.genre)) {
        for (var g = 0; g < b.genre.length; g++) {
          if (normText(b.genre[g]).indexOf(nq) !== -1) { hit = true; break; }
        }
      }
      if (hit) tier = 2;
    }
    if (tier !== -1) scored.push({ b: b, tier: tier, idx: i });
  }
  scored.sort(function (a, b) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.idx - b.idx;
  });
  return scored.map(function (s) { return s.b; });
}

function filterBooks(list, opts) {
  var books = asArray(list);
  var o = opts || {};
  var genre = o.genre;
  var status = o.status;
  return books.filter(function (b) {
    if (genre && genre !== '全部') {
      if (!Array.isArray(b.genre) || b.genre.indexOf(genre) === -1) return false;
    }
    if (status === 'ended') {
      if (b.ended !== true) return false;
    } else if (status === 'ongoing') {
      if (b.ended === true) return false;
    }
    return true;
  });
}

// 為什麼同數量再按字串排：讓 genreCounts 結果穩定可預期
function genreCounts(list) {
  var books = asArray(list);
  var counts = {};
  var i, g;
  for (i = 0; i < books.length; i++) {
    var gs = books[i].genre;
    if (!Array.isArray(gs)) continue;
    for (g = 0; g < gs.length; g++) {
      counts[gs[g]] = (counts[gs[g]] || 0) + 1;
    }
  }
  var out = Object.keys(counts).map(function (k) { return { genre: k, count: counts[k] }; });
  out.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.genre.localeCompare(b.genre, 'zh-Hant');
  });
  return out;
}

function bookHref(book) {
  var b = book || {};
  var href = 'manga.html?id=' + encodeURIComponent(String(b.id));
  if (b.src === 'essentials' || b.src === 'classics') href += '&src=' + b.src;
  return href;
}

// 為什麼直接用 ranking.js 的 xfnv1a：頁面保證 ranking.js 先載入，自帶複本會造成兩份雜湊不同步
function dailyPicks(pool, excludeIds, seed, n) {
  var books = asArray(pool);
  var ex = asArray(excludeIds);
  var kept = [];
  var i;
  for (i = 0; i < books.length; i++) {
    if (ex.indexOf(books[i].id) === -1) kept.push(books[i]);
  }
  var s = (seed === undefined || seed === null) ? '' : String(seed);
  kept.sort(function (a, b) {
    var ha = xfnv1a(a.id + s);
    var hb = xfnv1a(b.id + s);
    if (ha !== hb) return ha - hb;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
  return kept.slice(0, n).map(function (b) { return copyBook(b, 'manga', b.ended === true); });
}
