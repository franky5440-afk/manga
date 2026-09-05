// app.js — 各頁 render + 3D 書本封面（排序只用 ranking.js）
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
  // 書本物件：封面圖載入失敗就拿掉 img，露出直排書名的佔位封面
  function coverHTML(m, size) {
    var color = m.color || '#3b4a6b';
    var img = m.cover
      ? '<img src="' + esc(m.cover) + '" alt="' + esc(m.title) + '封面" loading="lazy" onerror="this.parentNode.classList.add(\'no-img\');this.remove()">' +
        '<span class="cover-band"><b>' + esc(m.title) + '</b><small>' + esc(m.author) + '</small></span>'
      : '';
    return '<span class="book-obj ' + size + '" data-title="' + esc(m.title) + '" style="--c:' + color + '">' +
      '<span class="book-face' + (m.cover ? '' : ' no-img') + '">' + img +
      '<span class="cover-ph" aria-hidden="true"><b>' + esc(m.title) + '</b><small>' + esc(m.author) + '</small></span>' +
      '</span></span>';
  }
  function errBox(msg) {
    return '<div class="error"><p>' + esc(msg) + '</p><p><a class="btn" href="index.html">回到首頁</a></p></div>';
  }

  // classics 讀得到就用，讀不到不影響 Top 10 首頁
  function loadJSON(url) {
    return fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  Promise.all([loadJSON('data/manga.json'), loadJSON('data/classics.json'), loadJSON('data/ranking.json')]).then(function (res) {
    var data = res[0] || [];
    var classics = res[1] || [];
    var live = res[2];
    // 正式排序用真實瀏覽量；讀不到（例如離線直接開檔）才退回本機 hash 排序
    var rank = getLiveRank(data, live);
    var diff;
    if (rank) {
      diff = liveDiff(rank.list);
    } else {
      rank = getTodayRank(data);
      diff = rankDiff(rank.list, getRankBySeed(data, seedPlus(rank.seed, -1)).list);
    }
    var badge = document.getElementById('dateBadge');
    if (page === 'timeless') {
      if (badge) badge.textContent = '固定收藏 ' + classics.length + ' 本';
    } else if (badge) {
      badge.textContent = rank.seed + (rank.live ? ' 熱度榜' : ' 今日排行');
    }
    if (page === 'index') {
      var hd = document.getElementById('heroDate');
      if (hd) hd.textContent = rank.seed;
    }

    if (page === 'index') renderIndex(rank, diff, live);
    else if (page === 'timeless') renderTimeless(classics);
    else if (page === 'manga') renderManga(data, classics, rank);
    else if (page === 'chapter') renderChapter(data, classics);
  }).catch(function () {
    ['shelf', 'rankList', 'globalList', 'fixedList', 'detail', 'chList', 'chapter', 'chNav'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = errBox('資料載入失敗，請確認已用 http.server 開站後重整。');
    });
  });

  // 與昨日相比的升降標示（正=上升）
  function diffHTML(d) {
    if (d === null || d === undefined) return '<span class="diff flat">新進榜</span>';
    if (d > 0) return '<span class="diff up">▲' + d + '</span>';
    if (d < 0) return '<span class="diff down">▼' + (-d) + '</span>';
    return '<span class="diff flat">持平</span>';
  }

  // 真實榜顯示瀏覽次數，fallback 才是算出來的分數 — 兩者意義不同，文字不能共用
  function scoreText(m) {
    if (m.views === undefined) return m.todayScore + ' 分';
    return (Number(m.views) || 0).toLocaleString('zh-Hant') + ' 次';
  }

  // 首頁：書架 hero + 完整榜單
  function renderIndex(res, diff, live) {
    var shelf = document.getElementById('shelf');
    shelf.innerHTML = res.list.map(function (m, i) {
      return '<li style="--i:' + i + '" data-genre="' + esc(m.genre.join('|')) + '">' +
        '<a class="book" href="manga.html?id=' + esc(m.id) + '">' +
        coverHTML(m, 'big') +
        '<span class="book-meta"><span class="rank">' + m.rank + '</span>' +
        '<span class="book-t">' + esc(m.title) + '</span>' + diffHTML(diff[m.id]) + '</span></a></li>';
    }).join('');
    var list = document.getElementById('rankList');
    list.innerHTML = res.list.map(function (m) {
      return '<li><a class="card" href="manga.html?id=' + esc(m.id) + '">' +
        coverHTML(m, 'sm') +
        '<span class="card-body">' +
        '<span class="card-head"><span class="rank">' + m.rank + '</span>' + diffHTML(diff[m.id]) + '<span class="score">' + scoreText(m) + '</span></span>' +
        '<b>' + esc(m.title) + '</b>' +
        '<small>' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + '</small>' +
        '<span class="syn">' + esc(m.synopsis.slice(0, 40)) + '…</span></span></a></li>';
    }).join('');
    initShelfMotion(shelf);
    renderChips(res.list, shelf);
    renderRankNote(res);
    renderGlobal(live);
  }

  // 榜單依據要寫在畫面上，不然使用者無從判斷這個排名是怎麼來的
  function renderRankNote(res) {
    var el = document.getElementById('rankNote');
    if (!el) return;
    el.textContent = res.live
      ? '依中文維基百科 ' + res.seed + ' 單日條目瀏覽量排序，資料來自 Wikimedia 官方 API，每日自動更新。'
      : '離線模式：讀不到 data/ranking.json，暫以本機演算法排序，非真實熱度。';
  }

  // 全球榜：AniList trending 前 10，不限本站書池，所以純展示不可點
  function renderGlobal(live) {
    var box = document.getElementById('globalList');
    if (!box) return;
    var rows = live && live.global && live.global.list;
    if (!rows || !rows.length) {
      box.innerHTML = '<li class="global-empty">全球榜資料暫時無法載入。</li>';
      return;
    }
    var COUNTRY = { JP: '日本', KR: '韓國', CN: '中國', TW: '台灣' };
    box.innerHTML = rows.map(function (m) {
      // 有繁中譯名就當主標，原文退為副標；沒有就照原文顯示，不阻擋當日榜單
      var main = m.titleZh || m.title;
      var alt = m.titleZh ? m.title : (m.romaji !== m.title ? m.romaji : '');
      // 類型優先用人工譯過的繁中，沒有才退回 AniList 的英文分類
      var tags = (m.genreZh && m.genreZh.length ? m.genreZh : (m.genres || [])).slice(0, 3);
      var sub = [COUNTRY[m.country] || m.country].concat(tags).filter(Boolean).join(' · ');
      var body = m.synopsisZh
        ? '<span class="g-syn">' + esc(m.synopsisZh) + '</span>'
        : '<span class="g-syn pending">中文簡介準備中</span>';
      // ranking.json 的內容源自外部 API，數值欄位一律轉數字再輸出，不直接拼進 HTML
      return '<li><span class="g-head"><span class="g-rank">' + (Number(m.rank) || 0) + '</span>' +
        '<span class="g-heat">' + (Number(m.trending) || 0) + '</span></span>' +
        '<span class="g-body"><b>' + esc(main) + '</b>' +
        (alt ? '<small>' + esc(alt) + '</small>' : '') +
        '<small class="g-tags">' + esc(sub) + (m.authorZh ? ' · ' + esc(m.authorZh) : '') + '</small>' +
        body + '</span></li>';
    }).join('');
  }

  // 有生之年：固定排序，不經 ranking.js，直接按 fixedRank 排成一面書牆
  function renderTimeless(classics) {
    var list = document.getElementById('fixedList');
    if (!classics.length) {
      list.innerHTML = errBox('固定收藏載入失敗，請確認已用 http.server 開站後重整。');
      return;
    }
    var ordered = classics.slice().sort(function (a, b) { return a.fixedRank - b.fixedRank; });
    list.innerHTML = ordered.map(function (m, i) {
      var nums = m.chapters.map(function (c) { return c.num; }).sort(function (a, b) { return a - b; });
      return '<li style="--i:' + i + '"><a class="book" href="manga.html?id=' + esc(m.id) + '&src=classics">' +
        coverHTML(m, 'wall') +
        '<span class="book-meta"><span class="rank">' + m.fixedRank + '</span>' +
        '<span class="book-t">' + esc(m.title) + '</span>' +
        '<span class="book-a">第 ' + nums[0] + '-' + nums[nums.length - 1] + ' 話</span></span></a></li>';
    }).join('');
  }

  // 詳情頁（src=classics 時讀固定收藏，顯示固定名次，不顯示今日分數）
  function renderManga(data, classics, res) {
    var src = qs('src') === 'classics' ? 'classics' : 'top10';
    var dataset = src === 'classics' ? classics : data;
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
      rankLine = '固定收藏第 ' + m.fixedRank + ' 名，共 ' + dataset.length + ' 本。收錄最新 10 話大綱';
    } else {
      var ranked = res.list.find(function (x) { return x.id === m.id; });
      document.title = m.title + '｜台漫榜 Top 10';
      rankLine = ranked
        ? '今日第 ' + ranked.rank + ' 名，共 ' + res.list.length + ' 本。' + scoreText(ranked)
        : '本日未進入前 ' + res.list.length + ' 名';
    }
    document.getElementById('crumbTitle').textContent = m.title;
    detail.innerHTML = '<div class="detail-top">' + coverHTML(m, 'big') +
      '<div><h1>' + esc(m.title) + '</h1>' +
      '<p class="meta">' + esc(m.author) + ' · ' + m.genre.map(esc).join(' / ') + '</p>' +
      '<p class="meta rankline">' + esc(rankLine) + '</p>' +
      '<p class="synopsis">' + esc(m.synopsis) + '</p></div></div>';
    var chs = m.chapters.slice().sort(function (a, b) { return a.num - b.num; });
    chList.innerHTML = chs.map(function (c) {
      return '<li><a href="chapter.html?id=' + esc(m.id) + '&ch=' + c.num + suffix + '">' +
        '<span class="ch-num">第 ' + c.num + ' 話</span><span class="ch-title">' + esc(c.title) + '</span></a></li>';
    }).join('');
  }

  // 章節頁（src=classics 時讀固定收藏，連結帶回 src）
  function renderChapter(data, classics) {
    var src = qs('src') === 'classics' ? 'classics' : 'top10';
    var dataset = src === 'classics' ? classics : data;
    var suffix = src === 'classics' ? '&src=classics' : '';
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
    box.innerHTML = '<p class="book-label">' + esc(m.title) + '</p>' +
      '<h1><span class="ch-num">第 ' + c.num + ' 話</span>' + esc(c.title) + '</h1>' +
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

  // 首頁書列：無縫漂移 + 拖曳慣性。漂移與拖曳只動 <ol> 的 transform，
  // hover 轉正動 .book-obj、鄰居讓位動 <li>，三層各自獨立才不會互相蓋掉。
  function initShelfMotion(shelf) {
    var viewport = document.getElementById('shelfViewport');
    if (!viewport) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 複製一組接在後面做無縫循環；複製的那組不入無障礙樹也不吃 Tab
    var originals = Array.prototype.slice.call(shelf.children);
    originals.forEach(function (li) {
      var c = li.cloneNode(true);
      c.classList.add('clone');
      c.style.setProperty('--i', String(originals.length + originals.indexOf(li)));
      c.setAttribute('aria-hidden', 'true');
      var a = c.querySelector('a');
      if (a) a.setAttribute('tabindex', '-1');
      shelf.appendChild(c);
    });

    // 一組的寬度用 offsetWidth 量（不含 transform），漂移超過就整組歸位
    var groupW = 0;
    function measure() {
      groupW = originals.reduce(function (sum, li) {
        return sum + li.offsetWidth + parseFloat(getComputedStyle(li).marginRight || 0);
      }, 0);
    }
    measure();
    window.addEventListener('resize', measure);

    var x = 0, vel = -28, drift = 0, last = 0;
    var hovering = false, dragging = false, pauseUntil = 0;

    function frame(t) {
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      if (!dragging) {
        if (Math.abs(drift) > 2) {
          x += drift * dt;                    // 放手後的慣性，約每秒衰減到 5%
          drift *= Math.pow(0.046, dt);
        } else if (!hovering && t > pauseUntil) {
          x += vel * dt;
        }
      }
      if (groupW > 0) {
        while (x <= -groupW) x += groupW;
        while (x > 0) x -= groupW;
      }
      shelf.style.transform = 'translate3d(' + x + 'px,0,0)';
      requestAnimationFrame(frame);
    }
    if (!reduce) requestAnimationFrame(frame);

    viewport.addEventListener('mouseenter', function () { hovering = true; });
    viewport.addEventListener('mouseleave', function () { hovering = false; });
    viewport.addEventListener('focusin', function () { hovering = true; });
    viewport.addEventListener('focusout', function () { hovering = false; });
    // 類型篩選後讓畫面定格一下，看清楚剩哪幾本
    shelf.pauseDrift = function (ms) { pauseUntil = performance.now() + ms; };

    // 拖曳：位移小於 6px 視為點擊，照常進詳情頁；超過就擋掉那一次 click
    var startX = 0, lastX = 0, lastT = 0, moved = 0, dragEndAt = 0;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; moved = 0; drift = 0;
      startX = lastX = e.clientX; lastT = performance.now();
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var now = performance.now();
      x += dx;
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      if (now > lastT) drift = dx / ((now - lastT) / 1000);
      lastX = e.clientX; lastT = now;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      // 用時間窗而不是留一個旗標，旗標若沒被下一次 click 清掉會誤擋真正的點擊
      if (moved > 6) dragEndAt = performance.now();
      if (performance.now() - lastT > 120) drift = 0;   // 停手太久就不要甩出去
      viewport.classList.remove('dragging');
      if (e && e.pointerId !== undefined && viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', function (e) {
      if (performance.now() - dragEndAt < 300) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  // 類型 chips：15 種類型全放會排到天邊，只取最常出現的前 6 種
  function renderChips(list, shelf) {
    var box = document.getElementById('genreChips');
    if (!box) return;
    var count = {};
    list.forEach(function (m) {
      m.genre.forEach(function (g) { count[g] = (count[g] || 0) + 1; });
    });
    var top = Object.keys(count).sort(function (a, b) {
      return count[b] - count[a] || a.localeCompare(b, 'zh-Hant');
    }).slice(0, 6);

    box.innerHTML = ['全部'].concat(top).map(function (g, i) {
      return '<button type="button" class="chip" data-g="' + esc(g) + '"' +
        ' aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' + esc(g) + '</button>';
    }).join('');

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      var g = btn.getAttribute('data-g');
      Array.prototype.forEach.call(box.children, function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      // 只改亮暗，不重排也不動 ranking 結果
      Array.prototype.forEach.call(shelf.children, function (li) {
        var hit = g === '全部' || (li.getAttribute('data-genre') || '').split('|').indexOf(g) > -1;
        li.classList.toggle('dim', !hit);
      });
      if (shelf.pauseDrift) shelf.pauseDrift(1200);
    });
  }

  // 頁首在黑舞台上是透明的，捲出 hero 後才變成實底，不然榜單區沒有導覽可用
  if (page === 'index') {
    var header = document.querySelector('.site-header');
    var hero = document.querySelector('.hero');
    var onScroll = function () {
      var edge = (hero ? hero.offsetHeight : window.innerHeight) - header.offsetHeight;
      header.classList.toggle('solid', window.scrollY > edge);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
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
