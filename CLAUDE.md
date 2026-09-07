# CLAUDE.md — manga 專案脈絡（給主對話：派工與 review）

> 本檔只寫「`AGENTS.md`、`spec.md` 與程式碼裡都沒有的東西」。
> **內容規範、資料格式、驗收指令一律以 `AGENTS.md` 為唯一來源**，本檔不複述。
> 進度、批次歷史、候選書單在 `handoff/` 裡**日期最新的那一份**（狀態檔，不是規則檔；
> 一天一檔的規則見 `AGENTS.md §3.1`）。

## 1. 這個專案是什麼

靜態漫畫介紹網站，**repo 為 PUBLIC**（`franky5440-afk/manga`），
**GitHub Pages 吃 `master` 分支根目錄，push 即部署上線**：
<https://franky5440-afk.github.io/manga/>

⇒ **push ＝ 直接對外公開**，不是「先進 staging」。commit 前一律 `git status --short` 逐行看過，
**絕對不要用 `git add -A` / `git add .`**（曾誤把 Frank 未追蹤的工作筆記
`Manga website reference.md` 掃進 PUBLIC repo，靠 cherry-pick 重建歷史才拿掉）。

站上三個內容資料檔（規格見 `AGENTS.md §4`）：

| 檔案 | 分頁 | 章節編排 |
|---|---|---|
| `data/manga.json` | 首頁每日排行 | 前 5 話＋最新／結局前 5 話 |
| `data/classics.json` | 有生之年（`timeless.html`） | 連續最新 10 話，另有 `status` 欄 |
| `data/essentials.json` | 必讀經典（`essentials.html`） | 前 5 話＋結局前 5 話 |

⚠️ **封面圖全部是空的**，所有書靠 CSS 直排書名佔位。設計提案不可押在封面圖上。

## 2. 內容生產的派工分工（🔴 這是實證換來的，不要合併回同一個 agent）

| 段落 | 派給誰 | 理由 |
|---|---|---|
| 連續劇情作品的**前 5 話** | opencode / muse spark（本專案特例，不走全域 codex/luna） | 開頭劇情在訓練資料裡涵蓋得好，便宜又寫得不錯 |
| **後 5 話**（最新／結局） | **帶 WebSearch 的 Claude agent，Sonnet 等級，不可用 Haiku** | 必須查證 |
| **單元劇作品的前 5 話** | 同上，也要查證 | 話次極易被排錯，見 `AGENTS.md §10.3` |
| **全球榜繁中對照表** | 同上，一支包 6~8 筆 | 韓漫／中國網漫 muse 知識極弱 |

**為什麼後 5 話不能給 muse**：實測它把《鏈鋸人》第二部結局（232 話）寫成「大戰落幕、都市重建、
淀治回高中上課」，實際是「波奇塔吞噬自己抹除鏈鋸人概念、世界重置」——**角色名全對、只有劇情是假的**，
極難察覺。同批的《進擊的巨人》《BLEACH》反而寫對 ⇒ **風險集中在知識截止日前後完結、或仍在連載的作品**。
Frank 定調：寫錯知名作品的結局會讓整站失去公信力。

**為什麼要 Sonnet 不要 Haiku**：買的不是「會查資料」，是**「查不到時會說查不到」**。
實測 Sonnet 會對可疑摘要起疑、發現來源矛盾時說出來、拒用讀者預測文、推翻錯誤的話號假設、
查不到時誠實交白卷。

## 3. 派 muse 的操作要點

- 🔴 **不要讓 muse 碰 `data/*.json`**，要求它**只把 JSON 陣列印到 stdout**，我用 `> file.raw` 接住，
  再由合併腳本統一寫入。好處：沒有寫檔權限提示、拒收的書自然不會進檔案（不需事後移除步驟）。
- **一本一支 `opencode run`**，不要一次餵 5 本——實測它會只寫完 1 本就跑去自我檢查然後放棄。
- 派工指令（**背景執行一定要加 `< /dev/null`**，否則會吃掉外層 `while read` 的 stdin，
  只跑掉前幾筆就以為做完）：

  ```bash
  opencode run -m opencode/muse-spark-1.3-contributor-free --title "b6-$id" "$P" \
    > "$S/${id}_first5.raw" 2>"$S/${id}_first5.err" < /dev/null
  ```

- 字數要求要寫成**硬規定**並讓它自己驗算，實測有效的三句話：
  「長度 235~285 個字（含標點），**這是硬規定，字數不足會被系統退回重寫**」／
  「**用具體情節把字數填滿**」／把嚴禁的評論詞清單直接列出來。
  這樣寫它會自己寫 Python 數字數、不合格就擴寫再驗，全程不用人介入。
- ⚠️ muse 偶爾會在驗算完後卡住不吐最終輸出，但草稿會留在 `/tmp/opencode/*.json`，
  可以直接撿回來，不必重跑。

## 4. 工作包必寫條款（每次派內容工作包都要抄進去）

規則本身在 `AGENTS.md §10`，但**工作包必須明文寫出**這幾條，否則 agent 會漏：

1. 每話／每筆**至少兩個獨立來源交叉驗證**，不要等做完再補。
2. **不要信 WebFetch／搜尋摘要**，關鍵資料抓原始 HTML／wikitext 自己解析。
3. 字數硬規定 ＋ 嚴禁評論句清單（查不到就標 `UNVERIFIED`，不可用評論句填字數）。
4. 查不到就說查不到，**不要編**。
5. 全球榜另加：查不到官方譯名可自行翻譯，但**要列出哪幾筆是自訂譯名**（Frank 要記錄）。

## 5. Review 要抓什麼

- **讀 diff，不信自述**：agent 的回報、commit message 都是 Inference 層。
- 跑 `AGENTS.md §12` 的驗收指令（結構、字數、半形標點、genre 越界、評論句抽查）。
- **評論句灌水**是最難抓的失敗模式——字數合格、格式合格，但實際劇情只剩一兩句。
  grep `讀者`、`這部作品`、`餘韻`、`津津樂道`。
- **簡體／錯字掃描**照 `AGENTS.md §10.6` 的判準，不要直接用 OpenCC s2t（誤報率極高）。
- **角色譯名跨前後 5 話對齊**（不同 agent 寫的，會各用各的：葬儀社／葬儀屋、賽巴斯欽／塞巴斯欽）。
- **純資料變更（只動 `data/*.json`）不必重跑 `/security-review`**：
  所有欄位在前端都經過 `esc()`（`assets/js/app.js:5-9`，對 `& < > " '` 全數實體化），
  數值欄位以 `Number(x) || 0` 強制轉型，已於 2026-09-07 核實。
  **但只要動到 `assets/js/*.js` 或任何程式碼就要重跑。**

## 6. 環境限制（影響排程，不是規則）

- **WebSearch 每個 session 有 200 次上限**。每本書的後 5 話約 30~70 次工具呼叫，
  所以**一個 session 大概只能處理 3~4 批**，額度用完只能換 session。
  （必要時 Frank 可調 `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`。）
- AniList 本機 403 的原因與唯讀繞法見 `AGENTS.md §13`。
- `python3 -m http.server 8000` 開站目視：首頁書列與華文圈榜、`manga.html?id=xxx` 章節列表、
  章節頁劇情與結尾免責聲明、手機寬度 360px 無橫向捲軸。

## 7. Push 閘門

`AGENTS.md §9` 已寫死「不可自行 push」。實務上：review 全過後只回報「可推哪幾個 commit」，
**等 Frank 逐次授權**。某次 session 取得的預先授權不延續到下次。
