# spec.md — 台灣 Top 10 熱門漫畫網站規格

版本：v1.0（2026-09-03）｜ 狀態：待實作

## 1. 背景與目標

做一個輕量靜態網站，收錄台灣當前前 10 大熱門漫畫，提供榜單瀏覽與章節文字劇情閱讀。無後端、無資料庫，任何靜態託管或本機 `http.server` 即可運行。

非目標：線上看漫畫圖片、會員、留言、搜尋、後台管理。

## 2. 收錄 10 本漫畫（初始名單）

| # | id | 書名 | 作者 |
|---|----|------|------|
| 1 | `one-piece` | 航海王 | 尾田榮一郎 |
| 2 | `jujutsu-kaisen` | 咒術迴戰 | 芥見下下 |
| 3 | `spy-family` | SPY×FAMILY 間諜家家酒 | 遠藤達哉 |
| 4 | `frieren` | 葬送的芙莉蓮 | 山田鐘人 / 阿部司 |
| 5 | `oshi-no-ko` | 【我推的孩子】 | 赤坂明 / 橫槍萌果 |
| 6 | `blue-lock` | BLUE LOCK 藍色監獄 | 金城宗幸 / 野村優介 |
| 7 | `kaiju-no8` | 怪獸 8 號 | 松本直也 |
| 8 | `dandadan` | 膽大黨 | 龍幸伸 |
| 9 | `apocalypse-hotel` | 天國大魔境 | 石黑正數 |
| 10 | `demon-slayer` | 鬼滅之刃 | 吾峠呼世晴 |

> 名單為初始版本，日後換書只需改 `data/manga.json`，不動程式碼。

## 3. 頁面規格

### 3.1 `index.html`（首頁榜單）

- 標題：`台灣熱門漫畫 Top 10`
- 副標：`{YYYY-MM-DD} 今日排行 · 每日自動更新`（台灣時區，見 §4）
- 列表每項顯示：排名數字（1~10）、與昨日相比升降（▲N / ▼N / 持平）、封面（或佔位色首字）、書名、作者、類型 tag、今日分數（整數）、簡介前 40 字
- 點擊整卡進 `manga.html?id={id}`
- 頁尾：`資料為介紹用途，劇情為摘要文字。`

### 3.2 `manga.html?id=xxx`（詳情頁）

- 顯示：封面、書名、作者、類型、完整簡介、今日排名（`今日第 N 名 / 共 10 本`）
- 章節列表：按 `num` 升序，每列 `第 N 話 — {title}`，點擊進 `chapter.html?id={id}&ch={num}`
- 無效 `id`：顯示 `找不到這本漫畫，回到首頁` + 首頁連結，不白屏

### 3.3 `chapter.html?id=xxx&ch=N`（章節頁）

- 顯示：書名、`第 N 話 — {title}`、麪包屑（首頁 / 書名 / 本話）
- 內文：`plot` 純文字分段顯示，結尾固定一行：`本頁為劇情介紹，非漫畫原文，支持正版。`
- 導航：上一話 / 章節列表 / 下一話（首話無上一話、末話無下一話，按鈕置灰 disabled）
- 無效 `id` / `ch`：顯示友善錯誤 + 返回連結

## 4. 每日刷新排序（核心邏輯）

檔案：`assets/js/ranking.js`，匯出 `getTodayRank(list)`。

```
1. seed = 以 Asia/Taipei 時區取當日 YYYY-MM-DD
2. 對每本：score = baseScore + (xfnv1a(id + seed) % 20) - 10
3. 按 score 降序；同分按 title 筆畫/字串 compare（localeCompare 'zh-Hant'）保穩定
4. 回傳 [{...manga, todayScore, rank}]
```

- 禁用 `Math.random()`、`Date.now()` 直接參與排序（僅用於取當日日期）
- 升降標示：`seedPlus(seed, -1)` 算出昨日 seed，`rankDiff(今日榜, 昨日榜)` 得每本升降值，正數為上升
- 單元驗證：同 seed 跑 100 次順序一致；換 seed 順序大概率不同
- 日期顯示格式：`2026-09-03 今日排行`

hash 參考實作（xfnv1a 32-bit）：

```js
function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

## 5. 資料規格 `data/manga.json`

- 陣列，共 10 筆，欄位見 `AGENTS.md §4`
- 每本 10 章：前 5 話（`num` 1~5）為開頭劇情，後 5 話為最新話往前倒推 5 話，
  `num` 採用原作真實話數（如完結作取最終 5 話），`plot` 200~800 字繁體中文摘要
- `baseScore` 建議 80~98，讓每日擾動（±10）有感但不至於墊底衝頂太離譜
- JSON 必須可被 `fetch('./data/manga.json')` 直接解析，編碼 UTF-8 無 BOM

## 6. 樣式與版面

- 單一 `assets/css/style.css`，手機優先，斷點 720px
- 首頁列表：手機單欄、桌面雙欄的格子，每格一本小書 + 名次；有生之年為 3 欄（桌面 6 欄）書牆
- 封面：`aspect-ratio: 3/4`，缺圖時佔位背景色 + 書名首字（JS 設 `onerror` 隱藏 img 顯示佔位）
- 360px 寬無橫向捲軸；字級：內文 16px、行高 1.8
- 配色與物件：依 taste-skill（反 AI 樣板）原則。冷灰中性底、只用一個焦橙 accent（亮 `#de6f36`／暗 `#e8874f`），亮暗模式跟 `prefers-color-scheme`；每本書以 CSS 3D 實體書呈現（正面、書背、依封面色的陰影、hover 立起），封面圖放 `assets/covers/<id>.jpg`（3:4），缺圖時以直排書名當封面；全站禁用全形破折號（—／–），圓角統一 14px，無外部字體

## 7. 前端 JS 分工

- `assets/js/ranking.js`：日期 seed、hash、計分、排序（無 DOM 操作，方便測試）
- `assets/js/app.js`：fetch JSON、路由參數解析、各頁 render、錯誤頁、封面 fallback
- 兩頁共用 `app.js`，用 `location.pathname` 判斷目前是 index / manga / chapter

## 8. 驗收清單

- [ ] `python3 -m http.server 8000` 開站，首頁 10 本齊全
- [ ] 當日排序與 `ranking.js` 手算一致（開 console 跑 `getTodayRank` 對照）
- [ ] 詳情頁、章節頁、上下話導航正常
- [ ] 亂輸 `?id=nope`、`&ch=999` 有友善錯誤
- [ ] DevTools 360px 無橫向捲軸
- [ ] 拔網線（offline）重整仍可開（無 CDN 依賴）

## 9. 後續可擴充（v1 不做）

搜尋、類型篩選、閱讀進度 localStorage、RSS/JSON feed。想做先開 issue 更新本檔，不直接寫碼。

## 10. 有生之年固定收藏分頁（v1.1，2026-09-04）

- 新頁 `timeless.html`：固定 18 本經典（不每日更新、不經 `ranking.js`），按 `data/classics.json` 的 `fixedRank` 排序
- 資料 `data/classics.json`：欄位同 `manga.json`，但以 `fixedRank`（1~18）取代 `baseScore`；每本收錄最新 10 話（`num` 為真實話數，休刊作取最後刊載 10 話），`plot` 為 150~250 字原創大綱
- 詳情/章節頁共用：`manga.html?id=xxx&src=classics`、`chapter.html?id=xxx&ch=N&src=classics` 讀固定收藏；詳情頁顯示「固定收藏第 N 名 / 共 18 本」，麵包屑首層連回 `timeless.html`
- 站內導覽：各頁 header 下方 `site-nav`（每日 Top 10 / 有生之年），當前分頁 `aria-current="page"`
- 18 本名單：獵人、烙印勇士、浪客行、NANA、千面女郎、強殖裝甲、五星物語、骷髏13、名偵探柯南、JOJOLands、王者天下、第一神拳、刃牙道、驅魔少年、X 戰記、七龍珠超、一拳超人、來自深淵
