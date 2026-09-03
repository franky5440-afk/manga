# manga — 台灣前 10 大熱門漫畫榜

每日自動刷新排序的靜態漫畫介紹網站。點任一漫畫可看章節文字劇情。

## 功能

- 首頁 Top 10 榜單，每日（台灣時區）自動換序
- 有生之年分頁（`timeless.html`）：固定 18 本經典收藏，不每日更新，每本收錄最新 10 話大綱
- 漫畫詳情頁：簡介、作者、類型、章節列表
- 章節頁：文字劇情 + 上一章 / 下一章導航
- 無後端，離線可開，手機優先 RWD

## 快速開始

```bash
cd /home/lintzuyang/freebuff_project/manga
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000/
```

> 直接雙擊 `index.html` 也能開，但建議用上面的 http.server，避免 fetch JSON 被瀏覽器擋掉。

## 目錄

```
index.html          首頁榜單
timeless.html       有生之年固定收藏（?無參數，固定排序）
manga.html          詳情頁 (?id=xxx，&src=classics 讀固定收藏)
chapter.html        章節頁 (?id=xxx&ch=N，&src=classics 讀固定收藏)
assets/css/style.css
assets/js/app.js
assets/js/ranking.js  每日排序邏輯
data/manga.json       全部漫畫資料（唯一真相來源）
data/classics.json    有生之年 18 本固定收藏（真相來源之二，fixedRank 排序）
```

## 每日排序怎麼算

見 `spec.md §4`。簡單說：

```
今日分數 = baseScore + hash(id + YYYY-MM-DD) % 20 - 10
```

同一天內所有人看到的順序一致，換日自動變化，無需手動更新。

## 資料維護

- 加漫畫 / 加章節：只改 `data/manga.json`，照 `AGENTS.md §4` 格式
- `id` 一旦上線不可改（URL 依賴）
- 章節 `plot` 寫劇情摘要即可，不可貼漫畫原文，結尾加正版聲明

## 開發規範

詳見 `AGENTS.md` 與 `spec.md`。重點：

- 不用框架、不引 CDN、不加搜尋留言會員
- 繁體中文內容，2 空格縮排
