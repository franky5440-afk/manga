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
├── handoff/            # 交接文件，一天一檔：HANDOFF-YYYY-MM-DD.md（見 §3.1）
├── index.html          # 首頁：Top 10 榜單（每日刷新）
├── timeless.html       # 有生之年分頁：長期停更／未完之作，固定 18 本
├── essentials.html     # 必讀經典分頁：已完結名作，固定收藏
├── manga.html          # 詳情頁：?id=xxx（&src=classics|essentials 讀固定收藏）顯示章節列表
├── chapter.html        # 章節頁：?id=xxx&ch=1（&src=classics|essentials 讀固定收藏）顯示文字劇情
├── assets/css/style.css
├── assets/js/app.js
├── assets/js/ranking.js
├── data/manga.json
├── data/classics.json  # 有生之年固定收藏（唯一真相來源之二）
├── data/essentials.json # 必讀經典固定收藏（唯一真相來源之三）
├── data/ranking.json   # 每日排行結果（由 tools/fetch_ranking.py 產生，勿手改）
├── data/global_zh.json # 全球榜外文作品的繁中資料：譯名／作者／類型／簡介（人工維護）
├── tools/                # 資料維護與驗證腳本
└── .github/workflows/daily-ranking.yml  # 每日自動更新 ranking.json
```

新增檔案時必須放在上述位置，不可自創目錄（除非更新本檔與 spec.md）。

### 3.1 🔴 交接文件的檔名規則（一天一檔，不可無限加長）

- 交接文件放 `handoff/`，檔名一律 **`HANDOFF-YYYY-MM-DD.md`**（日期為台灣時區）。
- **不可持續在同一個檔案上追加**。要寫交接內容時先看今天日期：
  - 當天已有檔 → 改那一份。
  - **跨日了 → 複製成新日期的檔名再改，不要動舊檔**。舊檔保留當成歷史快照。
- 接手時**讀 `handoff/` 裡日期最新的那一份**（`ls handoff/ | sort | tail -1`）。
- 交接文件**只寫狀態、歷史、待辦**。規則一律寫進本檔或 `CLAUDE.md`，
  **同一條規則不可在兩處各有一套說法**；發現交接文件裡混進規則，就搬進來並在原處刪掉。

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
- `baseScore` 0~100，僅作為 `ranking.json` 讀不到時的離線 fallback 基準分（僅 `manga.json` 用；
  `classics.json` 與 `essentials.json` 改用 `fixedRank` 固定排序，不參與每日刷新）
- `status`（僅 `classics.json`）：作品現況與停更原因，顯示為詳情頁簡介的第二段。
  內容須經查證，原因類敘述要標明是普遍說法或官方說明，不可寫成既定事實
- **章節編排慣例**：`manga.json` 與 `essentials.json` 的每本固定 10 話，
  前 5 話是真正的第 1～5 話，後 5 話是**最終話往前推 5 話的真實話號**（不是 6～10）。
  `classics.json` 因作品尚未完結，收錄的是連續的最新 10 話
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

## 10. 內容生產規範（章節劇情：`manga.json` / `classics.json` / `essentials.json`）

本節是章節內容的**唯一規則來源**。工作包只需引用本節，不要另抄一份。

### 10.1 選書：先驗維基條目，再談其他

華文圈榜的名次 ＝ 該書**中文維基條目的單日瀏覽量**，條目對不上就永遠抓到 0。
**派工前一律實測，不可憑書名猜**：

```bash
python3 - <<'PY'
import sys, datetime
sys.path.insert(0, 'tools')
from fetch_ranking import resolve_wiki_titles, fetch_pageviews
cands = ["候選書名1", "候選書名2"]
r = resolve_wiki_titles(cands)
end = datetime.date.today() - datetime.timedelta(days=1)
start = end - datetime.timedelta(days=7)
f = "%Y%m%d"
for t in cands:
    a = r.get(t)
    if not a:
        print("✗ 無條目", t); continue
    s = fetch_pageviews(a, start.strftime(f), end.strftime(f))
    print(("✓" if s else "✗"), (s[-1][1] if s else 0), t, "→", a)
PY
rm -rf tools/__pycache__
```

已知陷阱：
- **半形／全形驚嘆號**：`孤獨搖滾!` 查無條目、`孤獨搖滾！` 才過；`排球少年!!` 要寫 `排球少年！！`
- **顯示名 ≠ 條目名**：`死神 (漫畫)` 無條目，實際是 `BLEACH`
- **部分中文維基條目名是簡體**（灌篮高手、七龙珠、银魂、蜡笔小新、死亡笔记、浪客剑心、
  城市猎人、寄生兽）→ `title` 寫繁體給網站顯示，另加 `wiki` 欄位填簡體條目名給腳本查
  （`fetch_ranking.py` 取 `b.get("wiki")` 優先，見 §4）
- **同名陷阱**：`排球` 抓到運動條目、`浦澤直樹` 抓到作者條目、`藍色時期` 抓到畢卡索

**不適合收錄的類型**（先排除，不要浪費查證額度）：
- 1970 年代以前的老作品：逐話網路資料往往不存在，且連載版／文庫版／復刻版分話方式不同
- 無連貫話號的長壽作（哆啦A夢、蠟筆小新）
- 系列分多部或本篇完結但續篇仍連載的（話號會混）

### 10.2 內容硬規則

1. **所有 `synopsis` / `plot` / `status` 必須自行撰寫**（§7 版權紅線）。不可翻譯、改寫、摘錄或
   複製原作官方簡介、維基條目內文、任何既有中文簡介。
2. **章節 `plot` 長度**：`manga.json` / `essentials.json` 的**合併閘門是 200~300 字**（含標點），
   但**派工時一律要求 235~285 字**——留緩衝，因為模型幾乎必然寫不到下限。
   `classics.json`（有生之年，最新 10 話）沿用較短的 150~250 字。
   這是硬規定，不足會被合併腳本退回重寫；**用具體情節把字數填滿**，不可用形容詞灌水。
3. **嚴禁評論句**：讀者感受／作品地位／銷量人氣／氣氛／留白／餘韻／經典／津津樂道。
   查不到就標 `UNVERIFIED`，**不可用評論句填字數**。
4. **標點一律全形**（`，；：`），合併腳本會自動轉，但工作包仍須寫明。
5. **全篇繁體中文**，不可出現簡體字。唯一例外：`wiki` 欄位與 `global_zh.json` 的 key 是查詢鍵，
   照抄原文（可能是簡體或外文）。
6. **`genre` 只能用既有詞彙**：冒險／劇情／喜劇／奇幻／懸疑／戀愛／戰鬥／治癒／熱血／科幻／
   競技／運動／超自然／諜戰／演藝圈。自創新詞會讓首頁篩選標籤碎裂。
7. **角色譯名採台灣官方譯名**，且前 5 話與後 5 話必須一致（兩段由不同 agent 寫，合併前 grep 主要角色名）。

### 10.3 查證強度（後 5 話與所有完結／最新劇情）

- **每話至少兩個獨立來源交叉驗證**，不是做完再補。實測單一來源的內容錯誤率極高。
- **不可信 WebFetch／搜尋摘要**：實測出現過話號整體錯位、以及整組虛構的角色人名。
  關鍵資料要 `curl` 抓原始 HTML／wikitext 自己解析。可用手法：
  - MediaWiki API 通常沒被 Cloudflare 擋：
    `https://<wiki>.fandom.com/api.php?action=parse&page=Chapter_XXX&prop=wikitext&format=json`
  - `https://r.jina.ai/<url>` reader proxy 可繞過 Fandom 的 HTTP 402（對人機驗證頁無效）
  - 老部落格宣告 `charset=euc-jp` 但嚴格 decode 會中斷，用 `errors='replace'` 硬解
- **單元劇／每話獨立故事的作品，前 5 話也必須查證**（話次極易被排錯）。
  開頭是連續劇情的作品才可由知識型模型直接寫。
- ⚠️ **動畫話數 ≠ 漫畫話數**，不可用動畫集數推漫畫話號。
- 版本不同會導致話號不同（新裝版／完全版／連載版），採用哪個版本要在資料裡註記清楚。

### 10.4 退書判準（🔴 一章不確定就整本不收）

同一本書只要有一話查不到，**整本退掉**，不可只收 9 話或編一話湊數。理由：站上不會有人知道
是哪一話有問題，公信力一旦破口就整站受損。25 本全對勝過 28 本裡有一本是編的。

除了「查不到內容」，以下兩種更早觸發退書：
- **官方最終話不帶數字**（只標「最終話」）→ 退。本站把話號直接顯示在頁面上，不接受推定號碼。
- **只能靠官方標題語意去切整卷摘要** → 退。內容是真的但可能擺錯話。
  ⚠️ 但**不要一發現就直接退，先逼一次「換方法再查」**，實測成功率不低
  （改查當週逐話心得部落格，不但補齊證據還修正了實質錯誤）。

反過來，Fandom 章節頁的 `==Summary==` 底下字面寫著 `''To be added''`，
是**「這一話全網真的沒人寫過」的硬證據**，可以放心整本退掉，不必再往下挖。

### 10.5 合併閘門（腳本必須擋掉的，不靠人工叮嚀）

寫入資料檔一律經合併腳本，腳本必須實作以下閘門（實測同一個 prompt、同一個模型輸出格式仍會飄，
這種細節靠叮嚀沒用）：

- `plot == "UNVERIFIED"` → 整本拒收，不併入
- `plot` 長度不在該檔規定區間（§10.2 第 2 條）→ 退回重寫
- 半形 `,;:` 自動轉全形
- `genre` 不在 §10.2 詞彙表 → 拒收
- `id` 重複 → 拒收
- 前 5 話話號必須是 `[1,2,3,4,5]`，後 5 話必須遞增
- 禁用評論詞掃描
- 剔除書之後 `fixedRank` 重新編號，不留空號（`classics.json` / `essentials.json`）

`_facts` / `_sources` 等查證欄位只留在 scratchpad 供人工抽查，**不進 repo**。
合併腳本本身屬暫時性工具，放 scratchpad 即可，不必進 `tools/`。

### 10.6 錯字掃描（繁化過頭與日文新字體）

- **簡體掃描的判準**：「s2t 會變、且 t2s 不會變」再扣白名單。直接用 OpenCC s2t 誤報率極高——
  台／臺、群／羣、祕／秘、布／佈、才／纔、里／裡、床／牀、吃／喫、占／佔、峰／峯、
  斗（斗篷、斗笠）、雇、凶、栗、征 **都是繁體本字**。
- **日文新字體會混進來**：五条→五條、心寿→心壽、紗寿叶→紗壽葉。簡體掃描抓得到。
- **繁化過頭的錯字簡體掃描抓不到**，要用固定詞表 grep：
  `髮表 髮生 髮現 髮出 髮動 髮言 頭發 后來 之后 然后 干淨 麵對 公裡 曆史`

## 11. `data/global_zh.json`（全球榜繁中對照表）

格式與規則（榜單來源與顯示行為見 §5）：

```json
"전지적 독자 시점": {
  "titleZh": "全知讀者視角",
  "author": "싱숑／슬리피-C",
  "genre": ["奇幻", "冒險"],
  "synopsis": "自行撰寫的介紹文字。"
}
```

- 🔴 **key ＝ AniList 的原文書名（優先 native），永遠不可改成中文**。key 是查表比對鍵，
  改了整筆再也查不到，而且原文書名會就此消失。繁中譯名是「加上去」的欄位 `titleZh`，不是替換。
- 🔴 **畫面上原文與繁中並存**：`app.js` 的 `main = m.titleZh || m.title` ／
  `alt = m.titleZh ? m.title : ...`，有譯名時是繁中大標＋原文小標。
  **不可改成「有繁中就不顯示原文」。**
- 開頭是底線的 key（如 `_說明`）會被腳本跳過，可放註記。
- `synopsis` **65~80 字**（比章節 `plot` 短很多），其餘文體規則同 §10.2（自行撰寫、全形標點、
  繁體、嚴禁評論句、`genre` 限既有詞彙、通常給 2 個）。
- `author`：日文作品用漢字原名；韓國網漫保留韓文原名；中國網漫用中文。
  原作／作畫兩人時用**全形斜線 ／** 分隔。**查不到就留空字串 `""`，不可編造。**
- ⚠️ **譯名政策與 §10.4 刻意不同**（Frank 針對全球榜另訂）：查得到官方繁中／正式代理譯名就用官方的；
  查不到就**自行翻譯**，畫面上不標「暫譯」，但要在回報中列出哪幾筆是自訂譯名。
  這條**不適用於書池**，書池仍是「查不到就整本不收」。

## 12. 資料驗收指令（改動任何資料檔後必跑）

```bash
cd /home/lintzuyang/freebuff_project/manga

# 章節資料結構與文體
python3 -c "
import json;b=json.load(open('data/manga.json'))
bad=[]
for x in b:
    n=[c['num'] for c in x['chapters']]
    if len(n)!=10 or n[:5]!=[1,2,3,4,5] or n[5:]!=sorted(n[5:]): bad.append((x['id'],n))
    for c in x['chapters']:
        if not 200<=len(c['plot'])<=300: bad.append((x['id'],c['num'],len(c['plot'])))
print('結構異常:',bad or '無')
t=''.join(c['plot'] for x in b for c in x['chapters'])
print('半形標點:',{c:t.count(c) for c in ',;:' if t.count(c)} or '無')
print(len(b),'本 ×10話 =',sum(len(x['chapters']) for x in b),'話')
"

# 全球榜對照表
python3 -c "
import json
zh=json.load(open('data/global_zh.json'))
GEN={'冒險','劇情','喜劇','奇幻','懸疑','戀愛','戰鬥','治癒','熱血','科幻','競技','運動','超自然','諜戰','演藝圈'}
bad=[]
for k,v in zh.items():
    if k.startswith('_'): continue
    if not isinstance(v,dict): bad.append((k,'不是物件')); continue
    for f in ('titleZh','author','genre','synopsis'):
        if f not in v: bad.append((k,'缺欄位',f))
    n=len(v.get('synopsis',''))
    if not 60<=n<=90: bad.append((k,'簡介長度',n))
    for g in v.get('genre',[]):
        if g not in GEN: bad.append((k,'genre 越界',g))
    for c in ',;:':
        if c in v.get('synopsis',''): bad.append((k,'半形標點',c))
print('異常:',bad or '無'); print(len([k for k in zh if not k.startswith('_')]),'筆')
"

# 評論句灌水抽查
grep -o '讀者\|這部作品\|餘韻\|津津樂道' data/*.json | sort | uniq -c

# 腳本跑得完、無「維基查無條目」
python3 tools/fetch_ranking.py --dry-run > /dev/null
```

⚠️ `--dry-run` 一定要加，否則會污染 `data/ranking.json`（腳本產物，每天 08:00 台灣時間被覆寫）。
本機跑 `--dry-run` 時全球榜那段會回 HTTP 403 並沿用舊資料，**這是預期行為**，原因見 §13。

## 13. 已知環境限制

- **本機呼叫 AniList 會 HTTP 403**，原因是 **User-Agent**（不是 IP）。腳本送的
  `manga-rank/1.0` 被 Cloudflare 擋，換完整瀏覽器 UA ＋ Origin ＋ Referer 就 200。
  🔴 **不可把瀏覽器 UA 寫進 `tools/fetch_ranking.py`**——§7 明文要求帶可辨識 UA，偽裝成瀏覽器
  等於違反自己訂的規則；且 GitHub Actions 那邊本來就跑得動，線上沒壞。要改是 Frank 的決定。
  本機**只在需要撈候選名單時**用這條一次性唯讀指令：

  ```bash
  curl -s -H 'Content-Type: application/json' -H 'Accept: application/json' \
   -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' \
   -H 'Origin: https://anilist.co' -H 'Referer: https://anilist.co/' \
   -X POST https://graphql.anilist.co \
   -d '{"query":"{Page(page:1,perPage:50){media(type:MANGA,sort:TRENDING_DESC,isAdult:false){id title{native romaji english} trending popularity countryOfOrigin}}}"}' \
   > anilist50.json
  ```

- **Wikimedia 瀏覽量資料延遲 1~2 天**，畫面顯示資料日期而非今天（§5）。
- 改 `global_zh.json` 後**本機看不到中文**，要等 GitHub Actions 下次跑完重產 `ranking.json`，
  這是正常的。
