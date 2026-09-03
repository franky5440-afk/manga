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

  // classics 讀得到就用，讀不到不影響 Top 10 首頁
  function loadJSON(url) {
    return fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  Promise.all([loadJSON('data/manga.json'), loadJSON('data/classics.json')]).then(function (res) {
    var data = res[0] || [];
    var classics = res[1] || [];
    var rank = getTodayRank(data);
    var badge = document.getElementById('dateBadge');
    if (page === 'timeless') {
      if (badge) badge.textContent = '固定收藏 · 共 ' + classics.length + ' 本';
    } else if (badge) {
      badge.textContent = rank.seed + ' 今日排行';
    }
    if (page === 'index') {
      var hd = document.getElementById('heroDate');
      if (hd) hd.textContent = rank.seed;
    }

    if (page === 'index') renderIndex(rank, rankDiff(rank.list, getRankBySeed(data, seedPlus(rank.seed, -1)).list));
    else if (page === 'timeless') renderTimeless(classics);
    else if (page === 'manga') renderManga(data, classics, rank);
    else if (page === 'chapter') renderChapter(data, classics);
  }).catch(function () {
    ['shelf', 'rankList', 'fixedList', 'detail', 'chList', 'chapter', 'chNav'].forEach(function (id) {
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

  // 有生之年：固定排序，不經 ranking.js，直接按 fixedRank
  function renderTimeless(classics) {
    var list = document.getElementById('fixedList');
    if (!classics.length) {
      list.innerHTML = errBox('固定收藏載入失敗，請確認已用 http.server 開站後重整。');
      return;
    }
    var ordered = classics.slice().sort(function (a, b) { return a.fixedRank - b.fixedRank; });
    list.innerHTML = ordered.map(function (m) {
      var nums = m.chapters.map(function (c) { return c.num; }).sort(function (a, b) { return a - b; });
      var range = '第 ' + nums[0] + '–' + nums[nums.length - 1] + ' 話';
      return '<li><a class="card" href="manga.html?id=' + esc(m.id) + '&src=classics">' +
        '<span class="rank">No.' + m.fixedRank + '</span>' + coverHTML(m, 'sm') +
        '<span class="card-body"><b>' + esc(m.title) + '</b>' +
        '<small>' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + ' · ' + range + '</small>' +
        '<span>' + esc(m.synopsis.slice(0, 40)) + '…</span></span></a></li>';
    }).join('');
  }

  // 詳情頁（src=classics 時讀固定收藏，顯示固定名次，不顯示今日分數）
  function renderManga(data, classics, res) {
    var src = qs('src') === 'classics' ? 'classics' : 'top10';
    var dataset = src === 'classics' ? classics : data;
    document.body.setAttribute('data-src', src);
    var m = dataset.find(function (x) { return x.id === qs('id'); });
    var detail = document.getElementById('detail');
    var chList = document.getElementById('chList');
    var home = document.getElementById('crumbHome');
    var suffix = src === 'classics' ? '&src=classics' : '';
    var homeHref = src === 'classics' ? 'timeless.html' : 'index.html';
    var homeText = src === 'classics' ? '有生之年' : '首頁';
    if (home) { home.href = homeHref; home.textContent = homeText; }
    // 站內分頁亮起目前所在的分頁
    markNav(src === 'classics' ? 'timeless' : 'index');
    if (!m) {
      document.getElementById('crumbTitle').textContent = '找不到';
      detail.innerHTML = errBox('找不到這本漫畫，回到首頁看看今日榜單吧。');
      chList.innerHTML = '';
      return;
    }
    var rankLine;
    if (src === 'classics') {
      document.title = m.title + '｜有生之年經典';
      rankLine = '固定收藏第 ' + m.fixedRank + ' 名 / 共 ' + dataset.length + ' 本 · 最新 10 話大綱';
    } else {
      var ranked = res.list.find(function (x) { return x.id === m.id; });
      document.title = m.title + '｜台漫榜 Top 10';
      rankLine = '今日第 ' + ranked.rank + ' 名 / 共 10 本 · ' + ranked.todayScore + ' 分';
    }
    document.getElementById('crumbTitle').textContent = m.title;
    detail.innerHTML = '<div class="detail-top">' + coverHTML(m, 'big') +
      '<div><h1>' + esc(m.title) + '</h1>' +
      '<p class="meta">' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + '</p>' +
      '<p class="meta">' + esc(rankLine) + '</p>' +
      '<p>' + esc(m.synopsis) + '</p></div></div>';
    varchs = m.chapters.slice().sort(function (a, b) { return a.num - b.num; });
    chList.innerHTML = varchs.map(function (c) {
      return '<li><a href="chapter.html?id=' + esc(m.id) + '&ch=' + c.num + suffix + '">第 ' + c.num + ' 話 — ' + esc(c.title) + '</a></li>';
    }).join('');
  }

  // 章節頁（src=classics 時讀固定收藏，連結帶回 src）
  function renderChapter(data, classics) {
    var src = qs('src') === 'classics' ? 'classics' : 'top10';
    var dataset = src === 'classics' ? classics : data;
    var suffix = src === 'classics' ? '&src=classics' : '';
    document.body.setAttribute('data-src', src);
    var m = dataset.find(function (x) { return x.id === qs('id'); });
    var home = document.getElementById('crumbHome');
    if (home) {
      home.href = src === 'classics' ? 'timeless.html' : 'index.html';
      home.textContent = src === 'classics' ? '有生之年' : '首頁';
    }
    markNav(src === 'classics' ? 'timeless' : 'index');
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
      document.getElementById('crumbBook').href = 'manga.html?id=' + encodeURIComponent(m.id) + suffix;
      box.innerHTML = errBox('沒有第 ' + ch + ' 話。');
      nav.innerHTML = '<a class="btn" href="manga.html?id=' + esc(m.id) + suffix + '">回章節列表</a>';
      return;
    }
    document.title = '第 ' + c.num + ' 話 ' + c.title + '｜' + m.title;
    var cb = document.getElementById('crumbBook');
    cb.textContent = m.title;
    cb.href = 'manga.html?id=' + encodeURIComponent(m.id) + suffix;
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
      (prev ? '<a class="btn" href="chapter.html?id=' + esc(m.id) + '&ch=' + prev + suffix + '">上一話</a>' : '<span class="btn off">上一話</span>') +
      '<a class="btn ghost" href="manga.html?id=' + esc(m.id) + suffix + '">章節列表</a>' +
      (next ? '<a class="btn" href="chapter.html?id=' + esc(m.id) + '&ch=' + next + suffix + '">下一話</a>' : '<span class="btn off">下一話</span>');
  }

  // 站內分頁亮起目前所在分頁（靜態 aria-current 為主，此為詳情/章節頁的補強）
  function markNav(name) {
    var links = document.querySelectorAll('.site-nav a');
    for (var k = 0; k < links.length; k++) {
      if (links[k].getAttribute('data-nav') === name) links[k].setAttribute('aria-current', 'page');
      else links[k].removeAttribute('aria-current');
    }
  }
})();
