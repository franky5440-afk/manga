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

## 11. v2.0 改版：胡桃木書房、書庫與搜尋（2026-09-16，Frank 核定）

> 本節**取代** §1 非目標裡的「搜尋」、§6 的配色／亮暗模式／3D 書本描述、§9 的「搜尋、類型篩選」。

**起因**：書池擴充到 39 本後，首頁只顯示前 10 名，其餘書沒有入口；已完結的書也沒有進必讀經典。

### 11.1 視覺

- **固定深色**，不跟系統切換亮暗（`color-scheme: dark`）。色票（`assets/css/style.css` 的 `:root`）：
  `--ground #1b1411`（底）、`--surface #2a2019`（面板）、`--ink #f0e4cc`（主字）、`--muted #ad9a7e`（次要字）、
  `--line #3d2f25`（分隔線）、`--accent #86b89a`（玉綠點綴）、`--plank-top #7a5130`／`--plank #4a2f1b`（木頭層板）
- 字體：內文沿用系統黑體堆疊；標題 `--display` 用**系統楷體堆疊**（`"Kaiti TC", "BiauKai", "DFKai-SB", "AR PL UKai TW", serif`），
  **不載入任何外部或自訂字型**（§8「無 CDN 依賴」仍有效），沒有楷體的裝置退回明體是可接受的
- 書本改為**正面書卡**（`.book-card`）：狀態標籤（完結／連載中／未完結）、話數（完結「全 N 話」、其餘「最新 N 話」，N＝該書最大話號）、
  書名、作者、類型；底色取各書 `color` 欄位。首頁書架、必讀經典、有生之年共用同一個 `cardHTML()`
- 首頁移除巨大品牌字 hero，改為一行標題＋資料日期；書架下方加木頭層板
- **首頁兩排書架（2026-09-16 Frank 選 B）**，上下反向漂移，各自一條木頭層板：
  - 第一排 `#shelf`：華文圈熱門前 10 名（名次＋升降，行為不變）
  - 第二排 `#shelf2`「書庫精選」：從**書池 `manga.json`** 挑出**不在今天前 10 名**的 10 本，不顯示名次，標題旁寫明「每日從書池挑選，不是排名」。
    挑法 `dailyPicks(pool, excludeIds, seed, n)`（`library.js`）：依 `xfnv1a(id + seed)` 由小到大排序、同值依 id 排序，取前 n 本；
    `seed` 用首頁當日的資料日期（`rank.seed`），同一天所有人看到的一樣、每天換一批
  - 類型篩選按鈕同時作用在兩排

### 11.2 導覽與搜尋

- 每頁導覽列固定四個分頁：每日熱門（`index.html`）／書庫（`library.html`）／必讀經典／有生之年
- 每頁導覽列有搜尋框：`<form class="site-search" action="library.html" role="search">`＋`<input type="search" name="q" id="siteSearch">`，
  送出後到書庫頁帶 `?q=`
- 搜尋與篩選邏輯集中在 `assets/js/library.js`（純函式、無 DOM，契約見 `tools/test_library.mjs`）：
  搜書名／作者／簡介（角色名）／類型，不分大小寫與全半形；排序為書名命中 → 作者命中 → 其他

### 11.3 書庫頁 `library.html`

- 列出三個資料檔的全部書（書池＋必讀經典＋有生之年，不重複），可用搜尋、類型、完結狀態篩選
- 連結規則：書池的書 `manga.html?id=x`，固定收藏帶 `&src=essentials|classics`（`bookHref()`）

### 11.4 必讀經典合併

- `manga.json` 新增必填布林欄位 `ended`（完結＝true）
- 必讀經典頁顯示 `essentials.json`（依 `fixedRank`）＋ 書池中 `ended === true` 的書，同一本書可同時出現在首頁熱門與必讀經典
- 書池的完結書點進去讀的仍是 `manga.json`（不帶 `src`），資料不複製

### 11.5 3D 精裝書、全站書色統一、書架牆面（2026-09-21，Frank 核定原型 C）

> 本節**修改** §11.1「書本改為正面書卡」的外觀與「底色取各書 `color` 欄位」；卡片內容與 `cardHTML()` 結構不變。
> 契約：`tools/check_book3d.mjs`（真 Chrome 量測）、`tools/check_card_contrast.mjs`（對比，已改寫為先調和再混底色）。

- **3D 精裝書**：書卡靜止時往右轉 20~45 度；每本書下方有往左後方拖的**地面陰影**。
  滑鼠移上去或鍵盤聚焦時**轉正**（|rotateY| ≤ 12 度），方便閱讀。
- **書脊（第二版，2026-09-21 上線後修正）**：`::before` 是**書卡盒子內**左側的色帶（`left ≥ 0`、不再往後折 90 度），
  寬度桌機（≥ 720px）≥ 28px、手機 ≥ 20px（Frank：第一版「太薄、看起來很單薄」）；書卡文字從書脊右緣 6px 以後開始。
  書脊畫在盒子內，書牆最左排才不會超出牆面（第一版往後折的書脊會甩出框）。
- **摺痕**：`::after` 緊貼書脊右緣、寬 3~10px，由暗溝（alpha ≥ 0.45）過渡到亮稜，讓書脊與封面之間有一道看得見的折線。
- **封面**：`background-color: var(--tone)` 純色，疊 `linear-gradient(180deg, rgba(27, 20, 17, a), rgba(27, 20, 17, b))`
  做**上亮下暗**（上方書名、下方作者類型小字，下暗才讀得清楚），alpha 相差 ≥ 0.30。
- **算圖相容性禁令**（2026-09-21 iMac Chrome 實測）：**漸層裡不可有 `color-mix()`**（顏色會畫錯，紅書變金黃）；
  **不可用 `transform-style: preserve-3d`**（書卡文字會被斜切）。驗收以 iPad Safari 為準（Frank 裁示 iMac Chrome 版本過舊不算數），但這兩條寫法一律避開。
- **書名英文單字不可從中間斷行**（例：「SPY×FAMILY」不可拆成「SPY×FAMI／LY」）。
- **全站書色統一**：各書 `color` 欄位一律先經 `--tone: color-mix(in srgb, var(--c) 45%, var(--leather))`（`--leather #6b4a33`）調和成皮革色系，
  書卡、書脊、華文圈小封面、詳情頁大封面**全部用 `--tone`，不可直接用 `var(--c)`**。
  理由：資料裡的 `color` 是高飽和色（桃紅、天藍、亮紫），與胡桃木底色衝突；在 CSS 端調和，日後新增的書也自動統一，不必改資料。
- **書架區牆面**：首頁兩排 `.shelf-viewport` 與書牆 `.book-wall` 的背景改為 `--wall-top #4a3526` → `--wall #3d2c20` 的垂直漸層，
  讓陰影看得出來。**整站底色 `--ground` 不變**（書卡混色以它為準），導覽列與閱讀頁維持深色。
  牆面上書卡以外的文字對 `--wall-top` 對比須 ≥ 4.5（原 `--muted` 只有 4.21，不夠）。
