// app.js — 各頁 render + 封面 fallback（排序只用 ranking.js）
(function () {
  var page = document.body.getAttribute('data-page');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  // 封面：有 cover 檔就用 img（破圖時換佔位），否則直接佔位色 + 首字
  function coverHTML(m, size) {
    var first = esc(m.title.charAt(0));
    var color = m.color || '#1d4ed8';
    if (m.cover) {
      return '<span class="cover ' + size + '" style="--c:' + color + '">' +
        '<img src="' + esc(m.cover) + '" alt="' + esc(m.title) + '封面" loading="lazy" onerror="this.remove()">' +
        '<span class="cover-ph" aria-hidden="true">' + first + '</span></span>';
    }
    return '<span class="cover ' + size + '" style="--c:' + color + '">' +
      '<span class="cover-ph" aria-hidden="true">' + first + '</span></span>';
  }
  function errBox(msg) {
    return '<div class="error"><p>' + esc(msg) + '</p><p><a class="btn" href="index.html">回到首頁</a></p></div>';
  }

  fetch('data/manga.json').then(function (r) { return r.json(); }).then(function (data) {
    var res = getTodayRank(data);
    var badge = document.getElementById('dateBadge');
    if (badge) badge.textContent = res.seed + ' 今日排行';
    if (page === 'index') {
      var hd = document.getElementById('heroDate');
      if (hd) hd.textContent = res.seed;
    }

    if (page === 'index') renderIndex(res, rankDiff(res.list, getRankBySeed(data, seedPlus(res.seed, -1)).list));
    else if (page === 'manga') renderManga(data, res);
    else if (page === 'chapter') renderChapter(data);
  }).catch(function () {
    ['shelf', 'rankList', 'detail', 'chList', 'chapter', 'chNav'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = errBox('資料載入失敗，請確認已用 http.server 開站後重整。');
    });
  });

  // 與昨日相比的升降標示（正=上升）
  function diffHTML(d) {
    if (d > 0) return '<span class="diff up">▲' + d + '</span>';
    if (d < 0) return '<span class="diff down">▼' + (-d) + '</span>';
    return '<span class="diff flat">— 持平</span>';
  }

  // 首頁：書架 hero + 完整榜單
  function renderIndex(res, diff) {
    var shelf = document.getElementById('shelf');
    shelf.innerHTML = res.list.map(function (m) {
      return '<li><a class="book" href="manga.html?id=' + esc(m.id) + '">' +
        '<span class="rank">' + m.rank + '</span> ' + diffHTML(diff[m.id]) +
        coverHTML(m, 'big') +
        '<span class="book-t">' + esc(m.title) + '</span>' +
        '<span class="book-a">' + esc(m.author) + '</span></a></li>';
    }).join('');
    var list = document.getElementById('rankList');
    list.innerHTML = res.list.map(function (m) {
      return '<li><a class="card" href="manga.html?id=' + esc(m.id) + '">' +
        '<span class="rank">No.' + m.rank + '</span>' + coverHTML(m, 'sm') +
        '<span class="card-body"><b>' + esc(m.title) + ' ' + diffHTML(diff[m.id]) + '</b>' +
        '<small>' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + ' · ' + m.todayScore + ' 分</small>' +
        '<span>' + esc(m.synopsis.slice(0, 40)) + '…</span></span></a></li>';
    }).join('');
  }

  // 詳情頁
  function renderManga(data, res) {
    var m = data.find(function (x) { return x.id === qs('id'); });
    var detail = document.getElementById('detail');
    var chList = document.getElementById('chList');
    if (!m) {
      document.getElementById('crumbTitle').textContent = '找不到';
      detail.innerHTML = errBox('找不到這本漫畫，回到首頁看看今日榜單吧。');
      chList.innerHTML = '';
      return;
    }
    var ranked = res.list.find(function (x) { return x.id === m.id; });
    document.title = m.title + '｜台漫榜 Top 10';
    document.getElementById('crumbTitle').textContent = m.title;
    detail.innerHTML = '<div class="detail-top">' + coverHTML(m, 'big') +
      '<div><h1>' + esc(m.title) + '</h1>' +
      '<p class="meta">' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + '</p>' +
      '<p class="meta">今日第 ' + ranked.rank + ' 名 / 共 10 本 · ' + ranked.todayScore + ' 分</p>' +
      '<p>' + esc(m.synopsis) + '</p></div></div>';
    varchs = m.chapters.slice().sort(function (a, b) { return a.num - b.num; });
    chList.innerHTML = varchs.map(function (c) {
      return '<li><a href="chapter.html?id=' + esc(m.id) + '&ch=' + c.num + '">第 ' + c.num + ' 話 — ' + esc(c.title) + '</a></li>';
    }).join('');
  }

  // 章節頁
  function renderChapter(data) {
    var m = data.find(function (x) { return x.id === qs('id'); });
    var box = document.getElementById('chapter');
    var nav = document.getElementById('chNav');
    var ch = parseInt(qs('ch'), 10);
    if (!m || !ch) {
      box.innerHTML = errBox('找不到這一話，回到首頁或章節列表吧。');
      nav.innerHTML = '<a class="btn" href="index.html">回到首頁</a>';
      return;
    }
    var c = m.chapters.find(function (x) { return x.num === ch; });
    if (!c) {
      document.getElementById('crumbBook').textContent = m.title;
      document.getElementById('crumbBook').href = 'manga.html?id=' + encodeURIComponent(m.id);
      box.innerHTML = errBox('沒有第 ' + ch + ' 話。');
      nav.innerHTML = '<a class="btn" href="manga.html?id=' + esc(m.id) + '">回章節列表</a>';
      return;
    }
    document.title = '第 ' + c.num + ' 話 ' + c.title + '｜' + m.title;
    var cb = document.getElementById('crumbBook');
    cb.textContent = m.title;
    cb.href = 'manga.html?id=' + encodeURIComponent(m.id);
    document.getElementById('crumbCh').textContent = '第 ' + c.num + ' 話';
    box.innerHTML = '<h1>' + esc(m.title) + '</h1>' +
      '<h2>第 ' + c.num + ' 話 — ' + esc(c.title) + '</h2>' +
      '<p class="plot">' + esc(c.plot) + '</p>' +
      '<p class="disclaimer">本頁為劇情介紹，非漫畫原文，支持正版。</p>';
    var nums = m.chapters.map(function (x) { return x.num; }).sort(function (a, b) { return a - b; });
    var i = nums.indexOf(ch);
    var prev = i > 0 ? nums[i - 1] : null;
    var next = i < nums.length - 1 ? nums[i + 1] : null;
    nav.innerHTML =
      (prev ? '<a class="btn" href="chapter.html?id=' + esc(m.id) + '&ch=' + prev + '">上一話</a>' : '<span class="btn off">上一話</span>') +
      '<a class="btn ghost" href="manga.html?id=' + esc(m.id) + '">章節列表</a>' +
      (next ? '<a class="btn" href="chapter.html?id=' + esc(m.id) + '&ch=' + next + '">下一話</a>' : '<span class="btn off">下一話</span>');
  }
})();
