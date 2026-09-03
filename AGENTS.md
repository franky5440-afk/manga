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
├── index.html          # 首頁：Top 10 榜單
├── manga.html          # 詳情頁：?id=xxx 顯示章節列表
├── chapter.html        # 章節頁：?id=xxx&ch=1 顯示文字劇情
├── assets/css/style.css
├── assets/js/app.js
├── assets/js/ranking.js
├── data/manga.json
├── tools/*.py            # 資料維護腳本（章節擴充、字數檢查），僅本機執行
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
- `baseScore` 0~100，作為每日排序的基準分
- 封面圖若缺檔，必須用 CSS 佔位色 + 書名首字，不可破圖

## 5. 每日刷新排序規則

- 排序邏輯集中在 `assets/js/ranking.js`，不可散落在各頁
- Seed = 當日日期字串 `YYYY-MM-DD`（以台灣時區 Asia/Taipei 計算）
- 每本當日分數 = `baseScore + hash(id + seed) % 20 - 10`
- `hash` 用確定性字串 hash（例如 xfnv1a），不可用 `Math.random()`
- 同一日期內排序必須穩定且一致；換日即變化
- 首頁必須顯示「今日日期 + 更新時間」，格式：`2026-09-03 今日排行`

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

## 8. 驗證標準（完工前必跑）

1. `python3 -m http.server 8000` 能開首頁
2. 首頁顯示 10 本，順序符合當日 `ranking.js` 計算結果
3. 點任一本進 `manga.html?id=xxx` 章節列表正常
4. 點任一章節進 `chapter.html?id=xxx&ch=N` 文字正常顯示
5. 不存在的 id / ch 顯示友善錯誤頁，不白屏
6. 手機寬度 360px 無橫向捲軸

## 9. Git 規範

- 本機操作自由（add / commit / pull / 開分支直接做）
- `git push` 一律不可自行執行，commit 完就停，等授權
- commit 前跑機密掃描（見全域規範），訊息用繁體中文簡述改動
