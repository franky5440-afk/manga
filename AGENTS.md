# AGENTS.md — manga 熱門漫畫網站

> 工作目錄：`/home/lintzuyang/freebuff_project/manga`
> 回覆語言：一律繁體中文。程式碼、檔名、變數維持英文。

## 1. 專案目標

建立一個靜態網站，展示台灣前 10 大熱門漫畫：
- 首頁列出 10 本漫畫，每日刷新排序
- 每本漫畫有獨立詳情頁，可瀏覽各章節文字劇情
- 無後端，純前端 + JSON 資料檔即可跑

## 2. 技術棧（鎖定）

- 純 HTML + CSS + Vanilla JS，不引入框架（React/Vue/Tailwind 皆不用）
- 資料層：`data/manga.json` 為唯一真相來源
- 不使用 npm / bundler / SSR，直接用瀏覽器開啟或 `python3 -m http.server` 即可
- 樣式：單一 `assets/css/style.css`，RWD，手機優先

## 3. 目錄結構（必須遵守）

```
/
├── AGENTS.md
├── README.md
├── spec.md
├── index.html          # 首頁：Top 10 榜單（每日刷新）
├── timeless.html       # 有生之年分頁：固定 18 本收藏榜單
├── manga.html          # 詳情頁：?id=xxx（&src=classics 讀固定收藏）顯示章節列表
├── chapter.html        # 章節頁：?id=xxx&ch=1（&src=classics 讀固定收藏）顯示文字劇情
├── assets/css/style.css
├── assets/js/app.js
├── assets/js/ranking.js
├── data/manga.json
├── data/classics.json  # 有生之年固定收藏（唯一真相來源之二）
├── data/ranking.json   # 每日排行結果（由 tools/fetch_ranking.py 產生，勿手改）
├── data/global_zh.json # 全球榜外文作品的繁中資料：譯名／作者／類型／簡介（人工維護）
├── tools/                # 資料維護與驗證腳本
└── .github/workflows/daily-ranking.yml  # 每日自動更新 ranking.json
```

新增檔案時必須放在上述位置，不可自創目錄（除非更新本檔與 spec.md）。

## 4. 資料規範

`data/manga.json` 格式：

```json
[
  {
    "id": "one-piece",
    "title": "航海王",
    "author": "尾田榮一郎",
    "cover": "assets/covers/one-piece.jpg",
    "genre": ["冒險", "熱血"],
    "synopsis": "簡介 50~150 字",
    "baseScore": 95,
    "chapters": [
      { "num": 1, "title": "ROMANCE DAWN", "plot": "文字劇情 200~800 字" }
    ]
  }
]
```

- `id` 全小寫英文 + 連字號，不可重複，不可改（URL 依賴）
- 每本至少 3 個章節，每章節 `plot` 為純文字，不放圖片
- `wiki`（可選）：中文維基的正式條目名。只有在自動解析對不上時才需要手動指定
- `baseScore` 0~100，僅作為 `ranking.json` 讀不到時的離線 fallback 基準分（僅 `manga.json` 用；`classics.json` 改用 `fixedRank` 固定排序，不參與每日刷新）
- 封面圖若缺檔，必須用 CSS 佔位色 + 書名首字，不可破圖

## 5. 每日排行規則（2026-09-05 起改用真實資料）

首頁有兩個榜，資料都來自官方公開 API，由 `tools/fetch_ranking.py` 產生 `data/ranking.json`：

**華文圈熱門**（本站書池內，取前 10）
- 依據：中文維基百科**單日條目瀏覽量**（Wikimedia REST API，免金鑰）
- 書名對照由 MediaWiki 的 `redirects=1` 自動解（航海王 → ONE PIECE），查不到會再用去空格版重試；
  仍解不到的可在 `manga.json` 補 `wiki` 欄位手動指定條目名
- 升降箭頭比對 `ranking.json` 上一次的名次，不是重算昨日排序
- Wikimedia 資料延遲 1~2 天，畫面顯示的是**資料日期**而非今天，不可謊稱即時

**全球熱門**（不限書池，純展示）
- 依據：AniList `TRENDING_DESC`（GraphQL，免金鑰）
- 這一區的作品多半不在本站書池內，**只顯示不可點**，不做詳情頁連結
- 外文作品的繁中資料（譯名／作者／類型／**中文簡介**）放在 `data/global_zh.json`：
  ```json
  { "原文書名": { "titleZh": "繁中譯名", "author": "作者", "genre": ["類型"], "synopsis": "簡介" } }
  ```
- 全球榜每天換一批書，這些資料**不可**寫進 `ranking.json`（那是腳本產物、隔天會被覆蓋）
- 腳本依 native → romaji → english 順序查表；查不到就只顯示原名並標「中文簡介準備中」，
  不會擋住當日榜單。跑完會列出尚無中文簡介的書名
- 採**累積式**：榜上出現過的作品逐步補齊，覆蓋率隨時間提高，不需要（也不可能）事先寫完
- 🔴 `synopsis` 同樣受 §7 版權紅線約束：必須自行撰寫，**不可翻譯或複製原作官方簡介**

**共同要求**
- 排序邏輯集中在 `assets/js/ranking.js`，不可散落各頁（有生之年固定按 `fixedRank`，不經過它）
- `ranking.json` 讀不到時必須退回本機 hash 排序（`baseScore + xfnv1a(id + seed) % 20 - 10`，
  seed 為台灣時區當日 `YYYY-MM-DD`），確保離線直接開檔仍可運作，
  且畫面要明講「非真實熱度」，不可讓使用者誤以為是真排行
- **畫面上必須寫明排名依據與資料日期**（`#rankNote`），這是誠實性要求，不是可選裝飾
- 🔴 `data/ranking.json` 由腳本產生，**不可手動編輯**

## 6. 程式碼準則

- KISS：只寫 spec.md 定的功能，不加搜尋、留言、會員、後台
- 外科手術式修改：只碰必要的檔案，沿用既有命名與縮排（2 空格）
- 註解只寫「為什麼」，不寫流水帳
- 不引入外部 CDN（字體、框架皆不引入），離線可開
- 所有文字內容為繁體中文

## 7. 版權與內容紅線

- 章節 `plot` 必須是自行撰寫的劇情摘要/介紹文字，不可整篇複製漫畫原文或翻譯
- 每章節結尾加一行：「本頁為劇情介紹，非漫畫原文，支持正版。」
- 不爬蟲、不盜連官方或盜版站圖片，封面可用佔位色或自行繪製 SVG
- 「不爬蟲」指的是不抓取網頁 HTML。**呼叫官方公開 API（Wikimedia、AniList）取得數據不在此限**，
  但必須：① 帶可辨識的 User-Agent；② 在畫面上標明來源；③ 不轉存對方的圖片或全文

## 8. 驗證標準（完工前必跑）

1. `python3 -m http.server 8000` 能開首頁
2. 首頁顯示 10 本，順序符合當日 `ranking.js` 計算結果
3. 點任一本進 `manga.html?id=xxx` 章節列表正常
4. 點任一章節進 `chapter.html?id=xxx&ch=N` 文字正常顯示
5. 不存在的 id / ch 顯示友善錯誤頁，不白屏
6. 手機寬度 360px 無橫向捲軸
7. `python3 tools/fetch_ranking.py` 可跑完且不出現「維基查無條目」警告
8. 把 `data/ranking.json` 暫時移走後重整首頁，仍顯示 10 本、不白屏，
   且依據說明會切換成「離線模式…非真實熱度」
9. 首頁華文圈榜的順序等於 `ranking.json` 的 `cjk.list` 順序

## 9. Git 規範

- 本機操作自由（add / commit / pull / 開分支直接做）
- `git push` 一律不可自行執行，commit 完就停，等授權
- ⚠️ **唯一例外：`.github/workflows/daily-ranking.yml`**（Frank 於 2026-09-05 明確授權）。
  它每天自動 commit + push，但**只被允許改 `data/ranking.json`**，動到任何其他檔案就會中止並報錯。
  這個例外不擴及人或其他 agent——你仍然不可自行 push，也不可放寬那個 workflow 的檔案白名單
- commit 前跑機密掃描（見全域規範），訊息用繁體中文簡述改動
