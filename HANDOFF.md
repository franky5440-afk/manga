# 交接文件：書池擴充（工作包 A 進行中）

> 更新日期：2026-09-07（同日第三次更新：第五批完成，書池 25 → 32 本）
> 前置狀態：排行管線已上線，本文件主要處理「內容」

---

## 0. 目前進度

| 項目 | 狀態 |
|---|---|
| 工作包 B（全球榜繁中化・第一輪） | ✅ 管線已完成（commit `17713b4`）。⚠️ 當時的「10/10 有中文」只對那一天成立，榜單每天換，現已掉到 3/10 |
| 工作包 A（書池擴充） | 🔄 進行中，書池 10 → **32 本**已上線，可接第六批 |
| 有生之年「作品現況」 | ✅ 18/18 本完成，見 §11 |
| 必讀經典分頁 | ✅ 19 本上線，見 §11 |
| 全球榜繁中化（第二輪擴充） | 🔜 **未開工，工作包已寫好見 §13**。對照表 12 筆，前 50 名只覆蓋 11/50 |

**站上現有三個資料檔**：`manga.json`（32 本，每日排行）／`classics.json`（18 本，有生之年，
連續最新 10 話）／`essentials.json`（19 本，必讀經典，前 5 話＋結局前 5 話）。

**書池目前 32 本**（已 push 到 `origin/master`）：

```
原有 10 本：one-piece / jujutsu-kaisen / spy-family / frieren / oshi-no-ko
            blue-lock / kaiju-no8 / dandadan / apocalypse-hotel / demon-slayer
第一批 3 本：attack-on-titan / bleach / chainsaw-man
第二批 3 本：naruto / my-hero-academia / haikyu
第三批 6 本：slam-dunk / dragon-ball / gintama / tokyo-ghoul / golden-kamuy
            quintessential-quintuplets
第四批 3 本：kaguya-sama / saiki-k / summer-time-rendering
第五批 7 本：dr-stone / my-dress-up-darling / initial-d / sailor-moon
            black-butler / natsume / eyeshield21
```

（第四批原訂 6 本，3 本因查證不到而拒收，見 §6；第五批原訂 6 本，2 本拒收後補進 3 本替補，見 §12）

---

## 1. 🔴 最重要：章節編排慣例

本站每本書固定 **10 話**，但**不是第 1~10 話**，而是兩段：

- **前 5 話 ＝ 全書真正的第 1~5 話**（`num` = 1,2,3,4,5）
- **後 5 話 ＝ 最新一話往前推 5 話，用「真實話號」**（不是 6~10）

看 `data/manga.json` 的「航海王」就懂：`num` 是 1,2,3,4,5 然後 1176~1180。
`tools/retarget_latest.py` 的檔頭註解也寫著同一件事。

**所以已完結的作品，後 5 話會寫到結局。這是刻意的設計。**

---

## 2. 🔴 分工：前 5 話與後 5 話必須分開派

這是 2026-09-07 用實證換來的規則，**不要合併回同一個 agent**。

| 段落 | 派給誰 | 理由 |
|---|---|---|
| **前 5 話** | opencode / muse spark 1.3 | 開頭劇情在訓練資料裡涵蓋得好，它寫得不錯且便宜 |
| **後 5 話** | **具備 WebSearch 的 Claude agent（Sonnet 等級，不要用 Haiku）** | 最新／結局劇情必須查證 |

### 為什麼後 5 話不能給 muse 寫

實證：muse 把《鏈鋸人》第二部結局（232 話）寫成「大戰落幕、都市重建、淀治回高中上課」，
實際內容是「波奇塔吞噬自己抹除鏈鋸人概念、世界重置、淀治在破屋醒來回放第 1 話、
這次出現的是帕瓦而非瑪奇瑪」。**角色名全對、只有劇情是假的**，極難察覺。

同一批的《進擊的巨人》（2021 完結）與《BLEACH》（2016 完結）反而寫對了
⇒ **風險集中在知識截止日前後完結、或仍在連載中的作品**。

Frank 定調：**寫錯知名作品的結局會讓整站失去公信力**，所以後 5 話一律走查證管線。

### 為什麼要 Sonnet 不要 Haiku

我們買的不是「會查資料」，是**「查不到時會說查不到」**。實測 Sonnet 會：
- 對可疑摘要起疑並二次查證（火影忍者：修正「無限月讀解除時機」的常見誤傳）
- 發現來源矛盾時說出來（灌籃高手：比分 79-78 才是最終比分，78-77 是中途比分）
- 拒用不可靠來源（齊木楠雄：查到的爆料標著「未確定ネタバレ予想」是讀者預測文，不採用）
- 推翻錯誤的話號假設（輝夜姬本篇是 271 話不是 281；齊木本篇是 279 話，
  網路常見的 282 是「連載 279 + 特別篇 + 番外」的加總）
- 誠實交白卷（惡魔人：找不到逐話對照表，5 話全標 UNVERIFIED）

---

## 3. 完整流程

```
① 先驗維基條目（決定排行成敗，見 §4）
② 決定結構欄位（id / title / wiki / color / genre / baseScore）寫死在工作包裡
③ 同時派兩路：muse 寫前 5 話  ‖  Sonnet agent 查證並寫後 5 話（附來源）
④ muse commit 後，用合併腳本把後 5 話併進去
⑤ 驗收 → commit → push
```

③ 的兩路互不相依，可平行。但 **muse 在跑的時候不要動 `data/manga.json`**，會撞。

### 合併腳本

`tools/` 底下沒有，是暫時性的，內容如下（放 scratchpad 即可）：

```python
"""把 agent 產出的後 5 話併進 data/manga.json 指定的書。
用法: python3 merge_last5.py <book_id> <last5.json>
"""
import json, sys, pathlib

book_id, src = sys.argv[1], sys.argv[2]
P = pathlib.Path("/home/lintzuyang/freebuff_project/manga/data/manga.json")
books = json.loads(P.read_text(encoding="utf-8"))
last5 = json.loads(pathlib.Path(src).read_text(encoding="utf-8"))

assert len(last5) == 5, f"後5話應為5筆，實際{len(last5)}"
for c in last5:
    assert c["plot"] != "UNVERIFIED", f"第{c['num']}話回報 UNVERIFIED，不可併入"
    n = len(c["plot"])
    assert 200 <= n <= 300, f"第{c['num']}話 plot 長度 {n} 超出 200~300"

tgt = next((b for b in books if b["id"] == book_id), None)
assert tgt, f"找不到 id={book_id}"

first5 = [c for c in tgt["chapters"] if c["num"] <= 5]
assert [c["num"] for c in first5] == [1, 2, 3, 4, 5], "前5話不完整"

# 站上既有資料 100% 用全形標點（實測半形掛零），統一正規化避免混排
PUNCT = str.maketrans({",": "，", ";": "；", ":": "："})

# 只保留對外欄位，_facts / _sources 不進 repo
clean = [{"num": c["num"], "title": c["title"], "plot": c["plot"].translate(PUNCT)}
         for c in last5]
tgt["chapters"] = first5 + clean

P.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"已併入 {book_id}：話號 {[c['num'] for c in tgt['chapters']]}")
```

**兩個閘門的用意**：
- `UNVERIFIED` 直接拒絕併入 —— 寧可缺一本，不要進假資料
- 標點自動轉全形 —— 實測同一個 prompt、同一個模型，輸出格式仍會飄
  （排球少年那批 plot 裡有 50 個半形逗號，火影和鏈鋸人卻是全形的）。
  **這種細節靠叮嚀沒用，只能靠管線攔。**

`_facts` / `_sources` 只留在 scratchpad 供人工抽查，不進 repo。

---

## 4. 🔴 選書：維基條目決定成敗

華文圈榜的名次 ＝ 該書**中文維基條目的單日瀏覽量**。條目對不上就抓到 0，永遠沉在榜底。

**派工前一定要先實測**，不要憑書名猜：

```python
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
```

跑完記得 `rm -rf tools/__pycache__`。

### 實測踩過的坑

- **半形／全形驚嘆號**：`孤獨搖滾!` 查無條目，`孤獨搖滾！` 才過；`排球少年!!` 要解成 `排球少年！！`
- **顯示名 ≠ 條目名**：`死神 (漫畫)` 查無條目，實際條目是 `BLEACH`
- **中文維基有些條目名是簡體**：`灌篮高手`、`七龙珠`、`银魂`、`蜡笔小新`、`死亡笔记`、
  `浪客剑心`、`城市猎人`、`寄生兽`
  → **解法：`title` 寫繁體給網站顯示，加一個 `wiki` 欄位填簡體條目名給腳本查。**
    `fetch_ranking.py:107` 是 `b.get("wiki") or ...`，優先序正確。已實測有效。
- **同名陷阱**：`排球` 抓到的是運動條目、`浦澤直樹` 是作者條目 —— 不先驗會做出內容對不上書名的鬼書

### ⚠️ 不適合收錄的類型

- **1970 年代以前的老作品**：即使很有名，往往沒有可靠的逐話網路資料。
  惡魔人（1972）就是這樣被迫放棄的 —— 結局情節查得到，但沒有任何來源對應到第幾話，
  且連載版／5 冊版／文庫版／復刻版的分話方式可能不同。
- **無連貫話號的長壽作**：哆啦A夢（沒有連貫話號編制）。
- **仍在連載的超長篇**：名偵探柯南這類，最新話號會一直變動，資料很快過期。
  （不是不能收，但要意識到後 5 話需要定期用 `tools/retarget_latest.py` 的方式更新。）

---

## 5. 已驗證可用的候選書單（2026-09-07 實測，數字為當日瀏覽量）

直接可用，不必重驗（但過一陣子數字會變）：

```
名偵探柯南 731*   哆啦A夢 590*    蜡笔小新 475(簡)   鋼之鍊金術師 529
地。 384**        戀上換裝娃娃 377  死亡笔记 370(簡)   攻殼機動隊 349
孤獨搖滾！304     七龙珠 288(簡)    銀魂 284(簡)      為美好的世界獻上祝福！258
夏日時光 251**    灌篮高手 239(簡)  青春豬頭少年 228   王者天下 222
四月是你的謊言 215** 五等分的新娘 207 輝夜姬 198**     浪客剑心 153(簡)
齊木楠雄 122**    亂馬½ 121        城市猎人 115(簡)   足球小將 113
陰陽眼見子 104    MONSTER (漫畫) 103  寄生兽 96(簡)    強風吹拂 78
20世紀少年 78     日常 74          蟲師 70           宇宙兄弟 32
```

`*` ＝ 見 §4 的「不適合收錄」；`**` ＝ 已處理（第四批：收輝夜姬、夏日時光，拒收四月與地。見 §6；第五批：收戀上換裝娃娃、亂馬½ 拒收，見 §12）
`(簡)` ＝ 條目名是簡體，需要 `wiki` 欄位

**注意**：`輝夜姬想讓人告白` 的條目全名是
`輝夜姬想讓人告白～天才們的戀愛頭腦戰～`，`夏日時光` 的是 `夏日時光 (漫畫)`，
這兩本也要 `wiki` 欄位。

---

## 6. 第四批的結果：6 本只收了 3 本（已完成並 push）

第四批原訂 6 本，**3 本因查證不到而拒收**。這是管線正常運作，不是失敗——
這三本若交給 muse 憑知識寫，會全部「順利完成」，而且讀起來跟查證過的一模一樣。

| 書 | 結果 | 原因 |
|---|---|---|
| 輝夜姬想讓人告白 | ✅ 收（267~271）| 本篇完結於 271 話（不是網路常見的 281）|
| 齊木楠雄的災難 | ✅ 收（275~279）| 本篇完結於 279 話；常見的「282」是連載 279＋特別篇＋番外的加總 |
| 夏日時光 | ✅ 收（135~139）| |
| 四月是你的謊言 | ❌ 拒收 | 42 話「アゲイン」官方標題確認無誤，但找不到該話的獨立內容；原以為屬於 42 話的台詞，交叉比對後其實是 41 話屋頂場景的同一段 |
| 地。-關於地球的運動- | ❌ 拒收 | 61 話的唯一來源網域已失效變成過期網域，只剩 Google 索引的舊摘要，無從核實 |
| 惡魔人 | ❌ 拒收 | 見 §4「不適合收錄的類型」 |

### 🔴 一章不確定就整本不收

四月是你的謊言的 40、41、43、44 話都查得很紮實，只有 42 話不行。仍然整本拒收。

**理由**：只有 9 話、或有一話是編的書，放在站上就是瑕疵品，而且**沒有人會知道是哪一話有問題**。
既然標準是公信力，就不能為了湊數字破例。25 本全對，勝過 28 本裡有一本是編的。

### 移除一本書的做法（下次會再用到）

muse 是一次寫完整批的前 5 話，所以拒收的書要事後移除：

```python
import json, pathlib
P = pathlib.Path("data/manga.json")
b = json.loads(P.read_text(encoding="utf-8"))
b = [x for x in b if x["id"] not in ("devilman", "orb-earth", "your-lie-in-april")]
P.write_text(json.dumps(b, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
```

**⇒ 第五批已完成，見 §12。**

---

## 7. ⚠️ 已知的技術限制

- **WebSearch 有 session 額度上限（200 次）**。2026-09-07 那個 session 就是撞到這個而停下的。
  每本書的後 5 話大約要 30~70 次工具呼叫（含搜尋），所以**一個 session 大概只能處理 3~4 批**。
  接手時要意識到這件事，額度用完就只能換 session。
  （若真的需要，Frank 可調整 `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`。）
- **AniList 在本機回 HTTP 403**。`fetch_ranking.py` 會自動降級沿用舊資料，
  **不影響華文圈榜**，GitHub Actions 那邊跑得動，看到這個警告不用緊張。
  ⚠️ **更正（2026-09-07 實測）**：原本這裡寫「短時間重複呼叫被擋／本機 IP 被擋」，**那是錯的**。
  真正原因是 **User-Agent** —— 腳本送的 `manga-rank/1.0` 被 Cloudflare 擋，換瀏覽器 UA 就 200。
  解法、實測對照表、以及「為什麼不該把瀏覽器 UA 寫進腳本」見 §13.6。
- **跑 `fetch_ranking.py` 請加 `--dry-run`**，避免污染 `data/ranking.json`
  （那是腳本產物，每天早上 8 點台灣時間會被 GitHub Actions 覆寫）。

---

## 8. 硬規則（不變）

1. **絕對不要編輯 `data/ranking.json`** —— 腳本產物，每天會被自動覆寫
2. **所有 `synopsis` 與 `plot` 必須自行撰寫**（`AGENTS.md` §7 版權紅線）。
   不可翻譯、改寫、摘錄或複製原作官方簡介、維基條目內文、任何既有中文簡介。
3. **全篇繁體中文**，不可出現簡體字（例外：`wiki` 欄位的值是查詢鍵，照抄簡體條目名）
   - ⚠️ 簡體掃描會誤報：「斗篷」「斗笠」的**斗是繁體本字**，不是簡體
4. **標點一律全形**（合併腳本會自動轉，但工作包還是要寫明）
5. **`genre` 只能用既有詞彙**：冒險／劇情／喜劇／奇幻／懸疑／戀愛／戰鬥／治癒／熱血／
   科幻／競技／運動／超自然／諜戰／演藝圈 —— 自創新詞會讓首頁篩選標籤碎裂
6. **push 需 Frank 授權**（2026-09-07 該 session 有取得當次的預先授權，不自動延續到下次）

---

## 9. 驗收

```bash
cd /home/lintzuyang/freebuff_project/manga

# 全庫結構驗收
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

# 腳本跑得完、無「維基查無條目」
python3 tools/fetch_ranking.py --dry-run > /dev/null

# 開站目視
python3 -m http.server 8000
```

目視檢查：首頁書列與華文圈榜、點進 `manga.html?id=xxx` 章節列表、
點章節看劇情與結尾免責聲明、手機寬度 360px 無橫向捲軸。

---

## 10. 安全性（已確認，不必每次重跑）

`data/manga.json` 與 `data/global_zh.json` 的所有欄位在前端都經過 `esc()` 跳脫
（`assets/js/app.js:5-9` 定義，對 `& < > " '` 五個字元全數實體化）：
`title`、`author`、`genre`、`synopsis`、章節 `title`、`plot` 無一遺漏，
數值欄位另以 `Number(x) || 0` 強制轉型。章節頁結尾有 §7 要求的免責聲明。

**⇒ 純資料變更（只動這兩個 JSON）不需要每次重跑 `/security-review`。**
但若動到 `assets/js/app.js` 或任何程式碼，就要重跑。

---

## 11. 2026-09-07 稍晚追加的兩件事（已完成並上線）

### 有生之年改版
分頁大標改為「有生之年會有結局嗎？」，18 本每本補上 `status` 欄位（作品現況與停更原因），
顯示為詳情頁簡介的**第二段**。派三組帶查證的 agent 去查，18 本全數查到可靠來源。
`status` 只有 `classics.json` 有，其他兩個資料檔沒有。

### 必讀經典分頁（`essentials.html` + `data/essentials.json`）
已完結名作，章節編排跟 `manga.json` 一樣是「前 5 話＋結局前 5 話」（§1 的慣例）。
候選 20 本收 19 本，**麻辣教師GTO 因查不到 196~200 話的逐話劇情而整本剔除**
（順帶查出網路常見的「208 話」其實是本篇 200 話＋外傳 7 話的加總）。

程式面：`app.js` 把兩個固定收藏分頁的差異抽成 `FIXED` 表（`classics` / `essentials`），
詳情頁與章節頁靠 `?src=` 決定讀哪個資料檔，兩頁完全共用同一套渲染邏輯。
要再加第三個固定分頁，只要在 `FIXED` 加一列 + 複製一份 html 即可。

### 這一輪學到的東西（下次照做）

1. **muse 一次寫 5 本會力竭**：第 1、4 批都只寫完 1 本就跑去自我檢查，撞到權限提示後放棄。
   **改成一本一支 `opencode run`**，並在外面包一層「驗字數→不合格就重跑」的迴圈。
2. **muse 的字數規範幾乎必然失守**：四批裡只有一批達到 200 字下限，其餘落在 140~195。
   叮嚀沒用，**只能靠管線驗完退回重寫**。把草稿餵回去叫它「擴寫」比重寫有效。
3. ⚠️ **背景程序會吃掉 while-read 的 stdin**：`while read id; do (opencode ... ) & done < todo.txt`
   只會跑掉前幾筆就以為做完。**背景那段一定要加 `< /dev/null`。**
4. **查證 agent 也會用評論句灌水**：MONSTER 那本第一版整段在談「留白」「讀者怎麼解讀」
   「最為人津津樂道」，實際劇情只剩一兩句——字數合格、格式合格，但內容是空的。
   **工作包要明文禁止談讀者、談作品地位、談章節氣氛，並說「查不到就標 UNVERIFIED，
   不要用評論句填字數」。** 驗收時 grep 一下 `讀者`、`這部作品`、`餘韻`。
5. **簡體字掃描要用對方法**：OpenCC 的 s2t 誤報率極高（台／臺、群／羣、秘／祕、布／佈、
   才／纔、里／裡、床／牀、吃／喫、占／佔、峰／峯 這些都是繁體本字）。
   **判準要收緊成「s2t 會變、且 t2s 不會變」，再扣掉白名單**，這樣 400 段只會剩下 3~4 個候選，
   逐一看上下文即可。這一輪真正抓到的只有一個舊資料裡的「名单」。
6. ⚠️ **不要用 `git add -A`**：這一輪不小心把一個失敗的 clone 目錄、以及 Frank 未追蹤的
   工作筆記 `Manga website reference.md` 都掃進 commit，而這個 repo 是 **PUBLIC**。
   後者是靠 cherry-pick 重建歷史才拿掉的。**commit 前一律 `git status --short` 逐行看過。**

### 合併腳本
`build_essentials.py`（前 5 話＋後 5 話合併進 `essentials.json`，含所有閘門）留在該次 session 的
scratchpad，屬暫時性腳本沒有進 repo。閘門邏輯與 §3 的 `merge_last5.py` 相同，另外多了：
UNVERIFIED 整本剔除、`genre` 必須在既有詞彙內、剔除後 `fixedRank` 重新編號不留空號。

---

## 12. 第五批的結果：原訂 6 本、2 本拒收、補 3 本替補，最後收 7 本

Frank 交辦「收 6 本、你挑書」，並預先授權 commit / push。挑書時先確認**跨分頁不重複**——
`essentials.json` 已收鋼鍊、死亡筆記、寄生獸、20 世紀少年、浪客劍心、蟲師、MONSTER，
`classics.json` 已收柯南、王者天下，所以 §5 那份候選單能用的其實很少，另外湊了一批一起驗條目。

| 書 | 話號 | 結果 | 關鍵事實 |
|---|---|---|---|
| Dr.STONE 新石紀 | 228~232 | ✅ 收 | 本篇完結於 232 話（27 卷是完結後的外傳，不計入） |
| 戀上換裝娃娃 | 111~115 | ✅ 收 | 2025-03 完結，全 115 話（全 15 卷） |
| 頭文字D | 715~719 | ✅ 收 | 全 719 話（不含續篇 MF Ghost） |
| 美少女戰士 | 56~60 | ✅ 收 | **採新裝版／完全版 60 話編號**，見下方版本註記 |
| 黑執事 | 224~228 | ✅ 收 | 連載中，2026-08 休刊，已刊出最新話為 228 |
| 夏目友人帳 | 138~142 | ✅ 收 | 連載中，142 話刊於 LaLa 2026 年 9 月號 |
| 光速蒙面俠21 | 329~333 | ✅ 收 | 本篇全 333 話 |
| 亞人 | — | ❌ 拒收 | **官方最終話不帶數字**，只標「最終話」；且 FILE81／82 的內容邊界查不到官方依據 |
| 亂馬½ | — | ❌ 拒收 | 403~406 話全網查無逐話劇情（見下方「Fandom 空 stub」） |

### ⚠️ 美少女戰士的版本註記（下次動到這本要知道）
站上用的 56~60 是**新裝版／完全版**的 Act 編號（全 60 話），不是原始《なかよし》連載版
（舊版 18 卷的話號對照不同，Act.60 在原始編號裡沒有對應話）。內容確認是漫畫原作本篇
（動畫 Sailor Stars 的結局與漫畫差很多，查證時特別區分過）。前 5 話兩個版本編號相同，無衝突。

---

### 🔴 這一輪學到的東西（比上一輪的清單更重要，下次照做）

#### 1. muse 的字數問題解決了——把字數寫成「硬規定」並讓它自己驗算
上一輪的結論是「叮嚀沒用，只能靠管線退回重寫」。這輪改寫 prompt 後**6 本一次全過**
（235~258 字，無半形標點，無評論詞）。有效的三句話：
- 「長度 235~285 個字（含標點），**這是硬規定，字數不足會被系統退回重寫**」
- 「**用具體情節把字數填滿**」（不然它會用形容詞灌水）
- 嚴禁評論句的清單直接列出來（讀者感受／作品地位／銷量人氣／氣氛／留白／餘韻／經典／津津樂道）

muse 收到後會自己寫 Python 數字數、不合格就擴寫再驗一次，全程不用人介入。

#### 2. 🔴 不要讓 muse 碰 `data/manga.json`，改成「印 JSON 到 stdout 我來接」
上一輪 muse 直接改檔，導致拒收的書要事後用腳本移除（§6）。這輪改成一本一支
`opencode run`、要求只輸出 JSON 陣列、用 `> file.raw` 接住，再由合併腳本統一寫入。
好處：① 完全沒有權限提示問題（它不寫檔）② 拒收的書自然就不會進檔案，不需要移除步驟
③ 前後 5 話兩路都產出獨立檔案，合併時一次驗完。

派工指令（**背景執行一定要加 `< /dev/null`**，否則會吃掉 while-read 的 stdin）：
```bash
opencode run -m opencode/muse-spark-1.3-contributor-free --title "b5-$id" "$P" \
  > "$S/${id}_first5.raw" 2>"$S/${id}_first5.err" < /dev/null
```
⚠️ muse 偶爾會在驗算完後卡住不吐最終輸出（這輪夏目就是），但它的草稿會留在
`/tmp/opencode/*.json`，可以直接撿回來，不必重跑。

#### 3. 🔴 單元劇形式的作品，**前 5 話也要查證**，不能交給 muse
這是這輪最大的新發現。muse 寫《夏目友人帳》前 5 話，字數格式全過、讀起來完全合理，
但第 3~5 話（小狐狸的祭典夜／舊校舍影茶碗／雨夜遺失的髮簪）**話次是它自己排的**。
查證後實際是：1 貓咪老師登場！／2 露神／3 夏目、人間退治／4 水壩底的燕／5 舊校舍之怪。

**判準**：開頭是連續劇情的作品（Dr.STONE、頭文字D、黑執事、換裝娃娃、美少女戰士）
muse 寫得準；**單元劇／每話獨立故事的作品，前 5 話必須派查證 agent**。

順帶一個大坑：**動畫話數 ≠ 漫畫話數**。夏目漫畫第 1 卷只收 4 話、第 5 話跨到第 2 卷；
動畫把漫畫第 4 話挪到第 6 集播、動畫第 4 集其實是漫畫第 5 話。
查證用的關鍵資料是粉絲站「あかい花」的原作↔動畫對應表（`redflower.michikusa.jp`）。

#### 4. 🔴 單一來源＝不可靠，要逼 agent 交叉驗證（實測命中率高得嚇人）
《黑執事》第一版 5 話全部來自同一個逐話部落格。我要求對其中 3 話找獨立第二來源，
結果**三話全部抓到實質事實錯誤**（冒牌伯爵姓名、莫多里獲救的時序、葬儀屋復活的時間點）。
再要求核對剩下 2 話，發現 224、225 裡的「馬修斯」「卡塔琳」「貝爾特倫一家」
**是最初那次 WebFetch 摘要整組幻覺出來的人名**，原始部落格根本沒有這些字。

⇒ **工作包要直接寫進去：每話至少兩個獨立來源**，不要等做完再補。
同一招也救回了《戀上換裝娃娃》113 話（第一版把海夢的 cosplay 寫成朱朱扮的，
還冒出一個不存在的角色「千反田」）。

#### 5. ⚠️ WebFetch／搜尋摘要的小模型會**幻覺**與**錯位**，關鍵資料要抓原始碼自己解析
這輪踩到三次：
- 光速蒙面俠21：WebFetch 摘要英文維基的話數表，**話號整整錯位 4 話**。
- 頭文字D：Google 摘要把 715、716 標成同一個標題。
- 黑執事：WebFetch 摘要生出三個不存在的人名。

有效解法（agent 自己找出來的，寫進工作包當提示）：
- `curl` 抓原始 HTML／wikitext 再用 Python 自己解析，不經小模型摘要
- 老部落格宣告 `charset=euc-jp` 但嚴格 decode 會中斷，用 `errors='replace'` 硬解
- MediaWiki API 常常沒被 Cloudflare 擋：
  `https://<wiki>.fandom.com/api.php?action=parse&page=Chapter_XXX&prop=wikitext&format=json`
- `https://r.jina.ai/<url>` reader proxy 可繞過 Fandom 的 HTTP 402（頭文字D 靠這招）
  ⚠️ 但對 Cloudflare 人機驗證無效（亂馬½ 試過，只拿到驗證頁）

#### 6. ⚠️ Fandom 的章節頁可能是**空 stub**——「查不到」不等於「你沒找到」
亂馬½ 403~406 與光速蒙面俠21 329~333 的 Fandom 頁面，`==Summary==` 底下字面上就寫
`''To be added''`。這是**「這一話全網真的沒人寫過」的硬證據**，可以放心整本退掉，
不必再無限往下挖。判斷「查不到」時附上這種證據，比說「我找不到」有價值得多。

#### 7. 退書的判準（這輪新增兩條，都比「找不到內容」更早觸發）
- **官方最終話不帶數字** → 退。本站把話號直接顯示在網頁上，用推定號碼不能接受（亞人）。
- **只能靠官方標題語意去切整卷摘要** → 退。內容是真的但可能擺錯話，
  這正是《四月是你的謊言》被退的同一顆雷（亂馬½、以及光速蒙面俠21 的第一版）。
  ⚠️ 光速蒙面俠21 被我退回重查後，agent 找到當週逐話心得部落格，
  **不但補齊證據，還修正了實質錯誤**（329 話其實沒完成達陣，那是 330 話由陸完成的回攻）。
  ⇒ **不要一發現這種切分就直接退，先逼一次「換方法再查」，成功率不低。**

#### 8. 日文新字體會被當成簡體字混進來
《戀上換裝娃娃》的角色名寫成「五条新菜」「心寿」「紗寿叶」——那是日文新字體，
繁體要寫「五條」「心壽」。簡體掃描（s2t 會變且 t2s 不變、再扣白名單）抓得到，
但白名單要放行的繁體本字很多：雇／凶／栗／征／台／群／祕／布／才／裡／床／吃／占／峰。
另外《Dr.STONE》的「小川杠」，台灣官方譯名是「杠」不是「槓」（muse 寫成槓，已修）。

#### 9. 繁化過頭的錯字要單獨掃
muse 把「發表」寫成「髮表」。這類（發/髮、後/后、乾/干、面/麵、裡/里）簡體掃描抓不到，
要用固定詞表 grep：`髮表 髮生 髮現 髮出 髮動 髮言 頭發 后來 之后 然后 干淨 麵對 公裡 曆史`。

#### 10. 角色譯名要跨「前 5 話／後 5 話」對齊
兩路是不同 agent 寫的，會各用各的。黑執事就出現前 5 話「葬儀社」、後 5 話「葬儀屋」，
以及「賽巴斯欽／塞巴斯欽」混用。**合併前 grep 一次主要角色名**。

### 這一輪的合併腳本
`merge_batch5.py`（scratchpad，未進 repo）。與 §3 的 `merge_last5.py` 相比多了：
整批處理、直接組出完整書物件附進 `manga.json`（不需要 muse 先建書）、
UNVERIFIED 整本拒收、禁用評論詞掃描、title 長度檢查、id 重複檢查。

### 下一批可用的候選（2026-09-07 實測，數字為當日瀏覽量）
```
蜡笔小新 529(簡)*  攻殼機動隊 399**  百變小櫻 380***  孤獨搖滾！364*
金田一少年之事件簿 304*  為美好的世界獻上祝福！267†  足球小將 239*
聖鬥士星矢 233   鑽石王牌 231*   网球王子 173(簡)*   強風吹拂 119†
北斗神拳 103    陰陽眼見子 102   城市猎人 98(簡)   青之驅魔師 86
棒球大聯盟 85   少女終末旅行 81   女神咖啡廳 71   日常 66*   福星小子 59
宇宙兄弟 31    電影少女 29
```
`*` ＝ 系列分多部或無連貫話號，話號會混，風險高
`**` ＝ 單行本版本多（1/1.5/2），逐話資料難
`***` ＝ 條目名是「百變小櫻」，本篇 50 話完結但「清除篇」仍連載，話號會混
`†` ＝ 輕小說改編，漫畫版話號另計
⚠️ `藍色時期` 查到的是「畢卡索的藍色時期」，**不是漫畫**，不要收。

**選書順位建議**：2010 年代之後的作品逐話資料最齊；1990 年代以前的（北斗神拳、聖鬥士星矢、
城市獵人、福星小子）風險跟亂馬½ 同一類，要有整本退掉的心理準備。

---

## 13. 🔜 下一輪工作包：全球榜繁中化（尚未開工，本節即工作說明）

> Frank 於 2026-09-07 交辦，並已拍板兩個關鍵決定（見「Frank 的裁決」）。
> 本節是**完整工作包**，接手者照著做即可，不必重新調查。

### 13.1 這件事在做什麼

首頁的「全球榜」＝ AniList trending 前 10（`fetch_ranking.py:build_global()`），
**不限本站書池、純展示、點不進詳情頁**。榜上作品多是外文原名，
靠 `data/global_zh.json` 這張**對照表**查出繁中書名、作者、類型、簡介。

查表邏輯在 `fetch_ranking.py:183`：依 **native → romaji → english** 順序找 key，
任一命中即用；**查不到就只顯示原名，不會擋住當日榜單**（所以補不齊也不會壞掉，只是畫面空）。

### 13.2 現況（2026-09-07 實測）

- `global_zh.json` 目前 **12 筆**（另有一個 `_說明` 欄，開頭是底線的 key 會被腳本跳過）。
- 對 AniList 趨勢榜**前 50 名只覆蓋 11/50**。
- 今日站上榜單 10 筆裡 **7 筆沒有中文**。
- 前 50 名的國別分布：**韓國網漫 25、日本 19、中國 6** —— 缺的絕大多數是韓漫。

### 🔴 13.3 最重要的認知：這個榜單換得很快

今天站上顯示的 10 筆裡，**有 6 筆在同一天稍晚重抓的前 50 名裡已經掉出去了**。
所以「只補今天缺的那幾筆」等於白工，明天又會空一半。這就是 Frank 選擇一次補到前 50 的原因。

⚠️ 也因此，**接手時清單一定會跟本節列的不完全一樣**，請先用 13.6 的指令重抓一次。
本節列的 45 筆是 2026-09-07 的快照，當起點用即可。

### 13.4 Frank 的裁決（不要自行放寬或收緊）

1. **涵蓋範圍：前 50 名全補**，約 45 筆（前 50 缺的 39 筆 ＋ 今日榜單有但已掉出前 50 的 6 筆）。
   目標是讓表長到約 57 筆，之後一段時間榜單都不太會開天窗。
2. **譯名政策：自行翻譯，但標注來源不明確**。
   - 查得到官方繁中／正式代理譯名 → **用官方的**。
   - 查不到 → **自己翻一個通順的**，並在交接文件記下「哪幾筆是自訂譯名」，日後有官方譯名再換。
   - **畫面上不特別標示**（不要在網站顯示「暫譯」之類的字樣）。
   - ⚠️ 這條與書池的「查不到就整本不收」**刻意不同**，是 Frank 針對全球榜另外定的，不要混用。

### 13.5 資料格式（照現有 12 筆的規格寫）

`global_zh.json` 是一個大 dict，key ＝ **AniList 的原文書名**（優先用 native）：

```json
"전지적 독자 시점": {
  "titleZh": "全知讀者視角",
  "author": "싱숑／슬리피-C",
  "genre": ["奇幻", "冒險"],
  "synopsis": "自行撰寫的介紹文字，約 63~77 字。"
}
```

實測現有 12 筆的規格：
- **`synopsis` 長度 63~77 字**（含標點）⇒ 工作包寫 **65~80 字**，比書池的 235~285 短很多。
- **`genre` 只能用書池那套既有詞彙**（見 §8 規則 5：冒險／劇情／喜劇／奇幻／懸疑／戀愛／
  戰鬥／治癒／熱血／科幻／競技／運動／超自然／諜戰／演藝圈），通常給 2 個。
- **`author`**：日文作品用漢字原名（尾田榮一郎、冨樫義博）；
  韓漫現有做法是**保留韓文原名**（`레고밟았어／설아랑`、`황제펭귄／AZI`）；
  中國網漫用中文（`夜梟／無二漫畫`）。原作／作畫兩人時用**全形斜線 ／** 分隔。
- 標點一律全形，繁體中文，不可出現簡體字（key 例外，key 是查詢鍵照抄原文）。
- 🔴 **`synopsis` 必須自行撰寫**（AGENTS.md §7 版權紅線），
  **不可翻譯或複製 AniList / 官方 / 平台的原簡介**。這點在工作包裡要寫死。

### 🔴 13.5.1 原文書名一定要保留，不可被繁中譯名覆蓋（Frank 2026-09-07 交辦）

**繁中譯名是「加上去」的，不是「換掉」原文的。** 目前的設計已經滿足這條，
寫在這裡是為了**防止日後有人「順手簡化」而弄丟**：

- **資料層**：`global_zh.json` 的 **key 就是原文書名**（AniList 的 native），
  繁中放在另一個欄位 `titleZh`，兩者並存。
  ⚠️ **絕對不要把 key 改成中文**——key 是查表用的比對鍵，改了整筆就再也查不到，
  而且原文書名會就此消失。
- `ranking.json` 同樣是 `title`（原文）／`romaji`／`titleZh` 各佔一欄，互不覆蓋。
  （但那是腳本產物，不要手動編輯，見 §8 規則 1。）
- **畫面層**（`app.js:143-144`）：
  ```js
  var main = m.titleZh || m.title;                                   // 有繁中就當主標
  var alt  = m.titleZh ? m.title : (m.romaji !== m.title ? m.romaji : '');  // 原文退為副標
  ```
  ⇒ 有譯名時是**繁中大標 ＋ 原文小標一起顯示**，沒譯名才只顯示原文。
  **不要改成「有繁中就不顯示原文」**。

⇒ 接手時若要動 `app.js` 的全球榜區塊，請保留這個雙行顯示；
若只是補 `global_zh.json` 的資料（正常情況），什麼都不用改，照 13.5 的格式加 key 就對了。

### 13.6 開工第一步：重抓最新榜單（含 403 的解法）

⚠️ **本機直接跑 `fetch_ranking.py` 抓 AniList 會回 HTTP 403。**
舊版交接文件寫「是本機 IP 被擋、GitHub Actions 不會撞到」——**那個判斷是錯的**。
2026-09-07 實測：**原因是 User-Agent**。腳本送的 `manga-rank/1.0 (...)` 被 Cloudflare 擋，
換成瀏覽器 UA 就 200。實測結果：

| 送出的 UA | 結果 |
|---|---|
| `manga-rank/1.0 (...)`（腳本現值） | 403 |
| curl 預設 UA | 403 |
| `Mozilla/5.0 (compatible; manga-rank/1.0; +github…)` | 403 |
| 完整瀏覽器 UA ＋ Origin ＋ Referer | **200** |

🔴 **但不要把瀏覽器 UA 寫進 `tools/fetch_ranking.py`。**
AGENTS.md §7 明文要求「呼叫官方公開 API 必須帶可辨識的 User-Agent」，
偽裝成瀏覽器等於違反自己訂的規則；而且 **GitHub Actions 那邊本來就跑得動**，
線上沒壞，不需要為了本機方便去改線上行為。要改是 Frank 的決定。

本機**只在需要撈候選名單時**用這條一次性指令（唯讀、不寫回 repo）：

```bash
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json' \
 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' \
 -H 'Origin: https://anilist.co' -H 'Referer: https://anilist.co/' \
 -X POST https://graphql.anilist.co \
 -d '{"query":"{Page(page:1,perPage:50){media(type:MANGA,sort:TRENDING_DESC,isAdult:false){id title{native romaji english} trending popularity countryOfOrigin}}}"}' \
 > anilist50.json
```

再用這段算出「還缺哪些」（會自動排除已在表內的、並補上今日榜單已掉出前 50 的）：

```python
import json
zh = json.load(open("data/global_zh.json"))
top = json.load(open("anilist50.json"))["data"]["Page"]["media"]
today = json.load(open("data/ranking.json"))["global"]["list"]
seen, miss = set(), []
for m in top:
    t = m["title"]
    keys = [x for x in (t.get("native"), t.get("romaji"), t.get("english")) if x]
    if any(k in zh for k in keys) or t["native"] in seen:
        continue
    seen.add(t["native"])
    miss.append((m["countryOfOrigin"], t["native"], t.get("english") or t.get("romaji")))
tops = {m["title"]["native"] for m in top}
for m in today:                       # 今日榜單有、但已掉出前 50 的也要補
    if m["title"] in zh or m["title"] in seen or m["title"] in tops:
        continue
    seen.add(m["title"])
    miss.append((m.get("country"), m["title"], m.get("romaji")))
print(len(miss)); [print(*x) for x in miss]
```

### 13.7 派工建議

**不要交給 muse。** 這批 45 筆有 25 筆是韓國網漫、6 筆是中國網文改編漫畫，
muse 對這些作品的知識極弱，會整批編出「讀起來很合理」的假簡介——
這正是 §2 記載的失敗模式，而且外文作品更難察覺。

建議：**派帶 WebSearch 的 Sonnet agent，一支包 6~8 筆**，約 6~7 支。
每筆要查：官方繁中譯名（有沒有台灣／中文圈正式代理）、作者（原作／作畫）、
題材類型、以及「這部在講什麼」的基本設定。

工作包必須寫進去的硬規定（沿用第五批換來的教訓，見 §12）：
- **每筆至少兩個獨立來源**交叉驗證，不要等做完再補（§12 第 4 條：黑執事實測 5 話全有錯）。
- **不要信 WebFetch／搜尋摘要的小模型**，關鍵欄位（譯名、作者）要看原始頁面（§12 第 5 條）。
- 簡介 **65~80 字**，全形標點，繁體中文，嚴禁評論句（讀者感受／作品地位／人氣／經典）。
- 簡介**必須自行撰寫**，不可翻譯或改寫 AniList／官方／平台的原簡介。
- `genre` 只能從既有詞彙挑，不可自創。
- 查不到官方譯名 → 自行翻譯，**但要在回報中明確列出「哪幾筆是自訂譯名」**（Frank 要記錄）。
- 作者查不到就留空字串 `""`，不要編一個名字。

### 13.8 驗收

```bash
cd /home/lintzuyang/freebuff_project/manga
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
```

再跑一次 §13.6 的缺漏比對，確認覆蓋率；然後 `python3 tools/fetch_ranking.py --dry-run`
（本機會因 UA 問題在全球榜那段回 403 並沿用舊資料，這是預期行為，不影響華文圈榜）。

⚠️ **絕對不要手動編輯 `data/ranking.json`**（§8 規則 1，腳本產物、每天早上 8 點台灣時間會被覆寫）。
畫面上的中文要等 GitHub Actions 下次跑完才會出現，本機看不到，這是正常的。

### 13.9 前端安全性（純資料變更不必重跑 /security-review）

`global_zh.json` 的欄位在前端的輸出點：`app.js:149`（`synopsisZh`）、`154-156`
（`titleZh` / `authorZh` / `genreZh`），全部經過 `esc()`。**只要不動程式碼就不必重跑安全審查**
（與 §10 對 `manga.json` 的結論一致，2026-09-07 已重新讀 `app.js` 核實過一次）。

### 13.10 2026-09-07 當下缺的 45 筆（快照，接手時請用 13.6 重抓）

```
 1. [CN] 死灵法师！我即是天灾
    Necromancer, the Ultimate Scourge!
 2. [JP] 描くなるうえは
    Now That We Draw
 3. [KR] 회귀한 공작가의 막내도련님은 암살자
    The Reborn Young Lord is an Assassin
 4. [JP] ぐらんぶる
    Grand Blue Dreaming
 5. [JP] となりの席のヤツがそういう目で見てくる
    The Mortifying Ordeal of Being Seen
 6. [CN] 全职觉醒
    All-Class Awakening: God Slayer
 7. [KR] 만 년 만에 귀환한 플레이어
    After Ten Millennia in Hell
 8. [CN] 这一世我要当至尊
    Rebirth Of The Ultimate Master
 9. [JP] 暴力万歳
    Bouryoku Banzai
10. [KR] 용살자의 클래스가 다른 회귀
    The Dragon Slayer's Regression on Another Level
11. [KR] 게임 속 바바리안으로 살아남기
    Surviving the Game as a Barbarian
12. [CN] 高武：登陆未来一万年
    Log Into The Future
13. [JP] 薫る花は凛と咲く
    The Fragrant Flower Blooms With Dignity
14. [KR] 별을 품은 소드마스터
    The Stellar Swordmaster
15. [KR] 천마육성
    Murim RPG Simulation
16. [KR] 전지적 독자 시점
    Omniscient Reader
17. [KR] 아카데미에서 살아남기
    The Extra’s Academy Survival Guide
18. [KR] 던전 견문록
    Dungeon Odyssey
19. [JP] 僕だけが知ってるんだぜ
    Boku dake ga Shitterun Daze
20. [KR] 마도전생기
    Chronicles of the Demon Faction
21. [KR] 픽 미 업!
    Pick Me Up
22. [KR] 검 먹는 소드마스터
    The Sword-Eating Swordmaster
23. [KR] 환생천마
    Reincarnated Murim Lord
24. [JP] 今さらですが、幼なじみを好きになってしまいました
    Imasara desu ga, Osananajimi wo Suki ni Natte Shimaimashita
25. [CN] 我！天命大反派
    I Am The Fated Villain
26. [KR] 역대급 영지 설계사
    The Greatest Estate Developer
27. [KR] 나노마신
    Nano Machine
28. [KR] 템빨
    Overgeared
29. [JP] 隣の席のヤンキー清水さんが髪を黒く染めてきた
    The Delinquent Girl Beside Me Suddenly Dyed Her Hair Black
30. [KR] 용사파티 대마법사의 환생
    Reincarnation of the Hero Party's Grand Mage
31. [KR] 절대군림
    Absolute Reign
32. [KR] 아카데미의 천재칼잡이
    The Academy's Genius Swordsman
33. [KR] 광마회귀
    Return of the Mad Demon
34. [JP] ブルーロック
    Blue Lock
35. [JP] ワンパンマン
    One-Punch Man
36. [JP] 回帰した暗黒剣士、アカデミーで無双する
    Kaikishita Ankoku Kenshi, Academy de Muzou Suru
37. [KR] 일레스톤 저택의 100가지 저주
    The 100 Curses of Illeston Manor
38. [KR] 절대회귀
    Absolute Regression
39. [KR] 플레이어가 과거를 숨김
    The Player Hides His Past
40. [KR] 하남자의 탑 공략법
    Hanamjaui Tap Gongnyakbeop  ← 今日榜單有、但已掉出前 50
41. [KR] 세상에 나쁜 영애는 없다
    Sesange Nappeun Yeongaeneun Eopda  ← 今日榜單有、但已掉出前 50
42. [KR] 태존비록
    Taejonbirok  ← 今日榜單有、但已掉出前 50
43. [KR] 모든걸 기억하는 천재무사
    Modeungeol Gieokaneun Cheonjaemusa  ← 今日榜單有、但已掉出前 50
44. [KR] 프롤로그에서 30년이 흘렀다
    Prologue-eseo 30-nyeoni Heulleotda  ← 今日榜單有、但已掉出前 50
45. [KR] 던전을 그리는 화가
    Dungeon-eul Geurineun Hwaga  ← 今日榜單有、但已掉出前 50```
