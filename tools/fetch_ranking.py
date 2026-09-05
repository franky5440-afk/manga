"""產生 data/ranking.json：華文圈榜（中文維基每日瀏覽量）+ 全球榜（AniList trending）。

兩個榜的來源都是官方公開 API，不爬蟲、不需金鑰，符合 AGENTS.md §7。
只用標準庫，GitHub Actions 不必安裝任何套件。

用法：
  python3 tools/fetch_ranking.py            # 產生 data/ranking.json
  python3 tools/fetch_ranking.py --dry-run  # 只印結果不寫檔
"""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANGA = ROOT / "data" / "manga.json"
OUT = ROOT / "data" / "ranking.json"
ZH = ROOT / "data" / "global_zh.json"

TOP_N = 10
# Wikimedia 要求可辨識的 UA，用預設值會被擋
UA = "manga-rank/1.0 (https://github.com/franky5440-afk/manga)"
TZ8 = timezone(timedelta(hours=8))


def fetch(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def _query_titles(titles):
    """一批標題丟給 MediaWiki 解重定向，回傳 {送出的標題: 正式條目名 or None}。"""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        url = ("https://zh.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles="
               + urllib.parse.quote("|".join(batch)))
        q = fetch(url).get("query", {})
        # normalized/redirects 記錄「原標題 → 實際標題」的每一跳，串起來才對得回原書名
        hop = {}
        for key in ("normalized", "redirects"):
            for r in q.get(key, []):
                hop[r["from"]] = r["to"]
        missing = {p.get("title") for p in q.get("pages", {}).values() if "missing" in p}
        for t in batch:
            cur = t
            for _ in range(5):
                if cur not in hop:
                    break
                cur = hop[cur]
            out[t] = None if cur in missing else cur
        time.sleep(0.2)
    return out


def resolve_wiki_titles(titles):
    """把書名解成中文維基的正式條目名（航海王 → ONE PIECE）。

    MediaWiki 的 redirects=1 會自己處理重定向，不必手工維護對照表。
    本站書名習慣加空格（「怪獸 8 號」），維基條目多半沒有（「怪獸8號」），
    所以第一輪查不到的再用去空格版重試一次。
    """
    resolved = _query_titles(titles)
    retry = {t: t.replace(" ", "").replace("　", "")
             for t, v in resolved.items() if v is None}
    retry = {t: alt for t, alt in retry.items() if alt != t}
    if retry:
        second = _query_titles(sorted(set(retry.values())))
        for orig, alt in retry.items():
            if second.get(alt):
                resolved[orig] = second[alt]
    return resolved


def fetch_pageviews(article, start, end):
    """回傳 [(YYYYMMDD, views)]；查無條目回空list，不讓單一失敗拖垮整批。"""
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
           "zh.wikipedia/all-access/user/"
           + urllib.parse.quote(article, safe="") + f"/daily/{start}/{end}")
    try:
        d = fetch(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    return [(x["timestamp"][:8], x["views"]) for x in d.get("items", [])]


def build_cjk(books, prev_rank):
    """華文圈榜：取每本書最新一天有資料的瀏覽量排序。

    Wikimedia 的資料會延遲 1~2 天，所以往回抓 8 天再取最新可用的那天，
    而不是直接假設「昨天」一定有資料。
    """
    today = datetime.now(TZ8).date()
    end = today - timedelta(days=1)
    start = end - timedelta(days=7)
    fmt = "%Y%m%d"

    titles = [b["title"] for b in books]
    wiki = resolve_wiki_titles(titles)

    rows = []
    for b in books:
        article = b.get("wiki") or wiki.get(b["title"]) or b["title"]
        series = fetch_pageviews(article, start.strftime(fmt), end.strftime(fmt))
        views, day = (series[-1][1], series[-1][0]) if series else (0, None)
        rows.append({
            "id": b["id"],
            "wiki": article,
            "views": views,
            "day": day,
            "found": bool(series),
        })
        time.sleep(0.2)

    # 同分用書名排序，確保同一份資料每次跑出來的順序一致
    title_of = {b["id"]: b["title"] for b in books}
    rows.sort(key=lambda r: (-r["views"], title_of[r["id"]]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
        r["prevRank"] = prev_rank.get(r["id"])

    days = [r["day"] for r in rows if r["day"]]
    return {
        "source": "zh.wikipedia pageviews",
        "sourceUrl": "https://wikimedia.org/api/rest_v1/",
        "dataDate": max(days) if days else None,
        "missing": [r["id"] for r in rows if not r["found"]],
        "list": rows[:TOP_N],
    }


def load_zh_data():
    """全球榜外文作品的繁中資料（譯名、作者、類型、簡介）。

    全球榜每天換一批書，這些資料不能寫進 ranking.json（那是腳本產物、隔天會被覆蓋），
    所以獨立成一張人工維護的表。採累積式：榜上出現過的書逐步補齊，
    查不到的就只顯示原名，不會擋住當日榜單。
    """
    if not ZH.exists():
        return {}
    try:
        d = json.loads(ZH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {k: v for k, v in d.items()
            if not k.startswith("_") and isinstance(v, dict)}


def build_global():
    """全球榜：AniList trending 前 10，不限本站書池（純展示，點不進詳情頁）。"""
    zh = load_zh_data()
    query = """
    { Page(page:1, perPage:%d) { media(type:MANGA, sort:TRENDING_DESC, isAdult:false) {
        id title { native romaji english } trending popularity genres countryOfOrigin siteUrl
    } } }""" % TOP_N
    d = fetch(
        "https://graphql.anilist.co",
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    def num(v):
        # 外部來源的數值會被前端當 HTML 插入，強制轉型擋掉非預期型別
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    def text(v):
        return v if isinstance(v, str) else ""

    rows = []
    for i, m in enumerate(d["data"]["Page"]["media"]):
        t = m["title"] or {}
        # 原名、羅馬拼音、英文名依序查表，任一命中即用
        info = {}
        for key in (t.get("native"), t.get("romaji"), t.get("english")):
            if key and isinstance(zh.get(key), dict):
                info = zh[key]
                break
        rows.append({
            "titleZh": text(info.get("titleZh")),
            "authorZh": text(info.get("author")),
            "synopsisZh": text(info.get("synopsis")),
            "genreZh": [text(g) for g in (info.get("genre") or []) if isinstance(g, str)],
            "rank": i + 1,
            "anilistId": num(m.get("id")),
            "title": text(t.get("native") or t.get("romaji") or t.get("english")),
            "romaji": text(t.get("romaji")),
            "trending": num(m.get("trending")),
            "popularity": num(m.get("popularity")),
            "genres": [text(g) for g in (m.get("genres") or []) if isinstance(g, str)],
            "country": text(m.get("countryOfOrigin")),
            "siteUrl": text(m.get("siteUrl")),
        })
    return {
        "source": "AniList trending",
        "sourceUrl": "https://anilist.co",
        "list": rows,
    }


def main():
    dry = "--dry-run" in sys.argv
    books = json.loads(MANGA.read_text(encoding="utf-8"))

    # 升降箭頭要跟「上一次產出的榜」比，所以先把舊名次讀出來
    prev_rank = {}
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
            prev_rank = {r["id"]: r["rank"] for r in old.get("cjk", {}).get("list", [])}
        except (json.JSONDecodeError, KeyError):
            pass

    # 任一來源掛掉就沿用上一份，不要讓半份資料覆蓋掉整個檔
    try:
        cjk = build_cjk(books, prev_rank)
    except Exception as e:
        print(f"[warn] 華文圈榜抓取失敗，沿用舊資料：{e}", file=sys.stderr)
        cjk = old.get("cjk")
        if cjk is None:
            raise

    try:
        glob = build_global()
    except Exception as e:
        print(f"[warn] 全球榜抓取失敗，沿用舊資料：{e}", file=sys.stderr)
        glob = old.get("global")
        if glob is None:
            raise

    out = {
        "generatedAt": datetime.now(TZ8).isoformat(timespec="seconds"),
        "cjk": cjk,
        "global": glob,
    }

    if dry:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已寫入 {OUT.relative_to(ROOT)}")
    print(f"  華文圈榜（{cjk.get('dataDate')}）：" +
          "、".join(f"{r['rank']}.{r['id']}({r['views']})" for r in cjk["list"][:5]) + " …")
    if cjk.get("missing"):
        print(f"  ⚠ 維基查無條目：{cjk['missing']}")
    print("  全球榜：" + "、".join(f"{r['rank']}.{r.get('titleZh') or r['title']}" for r in glob["list"][:5]) + " …")
    todo = [r["title"] for r in glob["list"] if not r.get("synopsisZh")]
    if todo:
        print(f"  ⚠ 尚無中文簡介（{len(todo)} 筆，請補進 data/global_zh.json）：")
        for t in todo:
            print(f"      {t}")


if __name__ == "__main__":
    main()
