#!/usr/bin/env python3
"""資料整理包的契約測試：manga.json 加 ended、classics.json 標籤歸位。

執行：python3 tools/test_data_status.py
比對基準是 git HEAD 的版本，確保「除了指定欄位，其他一個字都沒動」。
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOCAB = {'冒險', '劇情', '喜劇', '奇幻', '懸疑', '戀愛', '戰鬥', '治癒', '熱血', '科幻',
         '競技', '運動', '超自然', '諜戰', '演藝圈'}

# 連載中 9 本（2026-09-16 主對話查證：handoff 紀錄＋中文維基資訊框），其餘 30 本已完結
ONGOING = {'one-piece', 'spy-family', 'frieren', 'blue-lock', 'dandadan',
           'apocalypse-hotel', 'black-butler', 'natsume', 'blue-exorcist'}

# 有生之年規格外標籤的歸位對照（只列要改的 14 本；未列的書 genre 不可變）
CLASSICS_GENRE = {
    'berserk': ['奇幻', '戰鬥'],
    'vagabond': ['劇情', '戰鬥'],
    'nana': ['戀愛', '演藝圈'],
    'glass-mask': ['演藝圈', '劇情'],
    'five-star-stories': ['科幻', '戰鬥'],
    'golgo-13': ['諜戰', '戰鬥'],
    'detective-conan': ['懸疑', '劇情'],
    'jojo-lands': ['冒險', '超自然'],
    'kingdom': ['劇情', '戰鬥'],
    'baki': ['戰鬥', '熱血'],
    'd-gray-man': ['超自然', '奇幻'],
    'x-clamp': ['超自然', '奇幻'],
    'one-punch-man': ['戰鬥', '喜劇'],
    'made-in-abyss': ['冒險', '奇幻'],
}

failed = 0


def check(name, ok, detail=''):
    global failed
    if ok:
        print('PASS', name)
    else:
        failed += 1
        print('FAIL', name, ('\n    ' + str(detail)) if detail else '')


def head(rel):
    out = subprocess.run(['git', '-C', str(ROOT), 'show', 'HEAD:' + rel],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def raw(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def fmt_ok(rel):
    """存檔格式必須維持 indent=2、ensure_ascii=False、結尾換行，否則 diff 會整檔變動。"""
    text = raw(rel)
    return text == json.dumps(json.loads(text), ensure_ascii=False, indent=2) + '\n'


# ── manga.json ─────────────────────────────────────────────
manga, manga0 = json.loads(raw('data/manga.json')), head('data/manga.json')
check('manga.json 本數與 id 順序不變',
      [b['id'] for b in manga] == [b['id'] for b in manga0])
check('manga.json 每本都有布林 ended',
      all(isinstance(b.get('ended'), bool) for b in manga),
      [b['id'] for b in manga if not isinstance(b.get('ended'), bool)])
wrong = [(b['id'], b.get('ended')) for b in manga
         if isinstance(b.get('ended'), bool) and b['ended'] != (b['id'] not in ONGOING)]
check('manga.json ended 值與查證清單一致（連載中 9 本、完結 30 本）', not wrong, wrong)
check('manga.json ended 為 true 的正好 30 本',
      sum(1 for b in manga if b.get('ended') is True) == 30)
changed = [b['id'] for b, b0 in zip(manga, manga0)
           if {k: v for k, v in b.items() if k != 'ended'} != b0]
check('manga.json 除了 ended 之外沒有任何欄位被改', not changed, changed)
check('manga.json 存檔格式維持 indent=2／不轉義中文／結尾換行', fmt_ok('data/manga.json'))

# ── classics.json ──────────────────────────────────────────
cl, cl0 = json.loads(raw('data/classics.json')), head('data/classics.json')
check('classics.json 本數與 id 順序不變', [b['id'] for b in cl] == [b['id'] for b in cl0])
bad = [(b['id'], b['genre'], CLASSICS_GENRE[b['id']]) for b in cl
       if b['id'] in CLASSICS_GENRE and b['genre'] != CLASSICS_GENRE[b['id']]]
check('classics.json 14 本標籤依對照表歸位', not bad, bad)
moved = [b['id'] for b, b0 in zip(cl, cl0)
         if b['id'] not in CLASSICS_GENRE and b['genre'] != b0['genre']]
check('classics.json 未列入對照表的書標籤不變', not moved, moved)
other = [b['id'] for b, b0 in zip(cl, cl0)
         if {k: v for k, v in b.items() if k != 'genre'} != {k: v for k, v in b0.items() if k != 'genre'}]
check('classics.json 除了 genre 之外沒有任何欄位被改', not other, other)
check('classics.json 不可加 ended 欄位', all('ended' not in b for b in cl))
check('classics.json 存檔格式維持 indent=2／不轉義中文／結尾換行', fmt_ok('data/classics.json'))

# ── 三檔共同 ───────────────────────────────────────────────
es = json.loads(raw('data/essentials.json'))
check('essentials.json 完全未動', es == head('data/essentials.json'))
out = [(f, b['id'], g) for f, d in (('manga', manga), ('classics', cl), ('essentials', es))
       for b in d for g in b['genre'] if g not in VOCAB]
check('三檔 genre 全部在 AGENTS.md §10.2 詞彙表內', not out, out)

print(f'\n{failed} FAIL' if failed else '\nALL PASS')
sys.exit(1 if failed else 0)
