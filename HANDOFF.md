# 交接文件：書池擴充（工作包 A 進行中）

> 更新日期：2026-09-07（取代原本 2026-09-05 的版本，工作包 B 已完成並上線）
> 前置狀態：排行管線已上線，本文件只處理「內容」，**不需要改任何程式碼**

---

## 0. 目前進度

| 項目 | 狀態 |
|---|---|
| 工作包 B（全球榜繁中化） | ✅ 已完成並 push（commit `17713b4`），當日榜單 10/10 全部有中文 |
| 工作包 A（書池擴充） | 🔄 進行中，書池 10 → **25 本**已上線，可接第五批 |

**書池目前 25 本**（已 push 到 `origin/master`）：

```
原有 10 本：one-piece / jujutsu-kaisen / spy-family / frieren / oshi-no-ko
            blue-lock / kaiju-no8 / dandadan / apocalypse-hotel / demon-slayer
第一批 3 本：attack-on-titan / bleach / chainsaw-man
第二批 3 本：naruto / my-hero-academia / haikyu
第三批 6 本：slam-dunk / dragon-ball / gintama / tokyo-ghoul / golden-kamuy
            quintessential-quintuplets
第四批 3 本：kaguya-sama / saiki-k / summer-time-rendering
```

（第四批原訂 6 本，3 本因查證不到而拒收，見 §6）

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

`*` ＝ 見 §4 的「不適合收錄」；`**` ＝ 第四批已處理（收了輝夜姬、夏日時光；四月與地。拒收，見 §6）
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

**⇒ 接手時書池是 25 本，可直接開第五批。** 候選書單見 §5。

---

## 7. ⚠️ 已知的技術限制

- **WebSearch 有 session 額度上限（200 次）**。2026-09-07 那個 session 就是撞到這個而停下的。
  每本書的後 5 話大約要 30~70 次工具呼叫（含搜尋），所以**一個 session 大概只能處理 3~4 批**。
  接手時要意識到這件事，額度用完就只能換 session。
  （若真的需要，Frank 可調整 `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`。）
- **AniList 在本機常回 HTTP 403**（短時間重複呼叫被擋）。
  `fetch_ranking.py` 會自動降級沿用舊資料，**不影響華文圈榜**，
  GitHub Actions 從自己的 IP 跑不會撞到。看到這個警告不用緊張。
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
