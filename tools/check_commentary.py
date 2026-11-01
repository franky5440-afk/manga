#!/usr/bin/env python3
"""評論句清理契約（AGENTS.md §10.2 第 3 條）。用法：python3 tools/check_commentary.py classics [manga essentials]

只允許改「基準版含禁用詞的章節」的 plot；清理後不得殘留禁用詞、不得新增情節。
例外清單 tools/commentary_exceptions_<檔名>.json，鍵為 "<id>#<話號>"：
  {"kind": "in-story", "words": ["人氣"], "reason": "..."}   詞本身是劇情事實（角色票選、作中讀者等），可改寫其他句子
  {"kind": "needs-research", "words": [...], "reason": "..."} 不新增情節就補不回字數，該話必須維持原文，留待查證後重寫
"""
import copy, difflib, json, os, re, subprocess, sys

BASE = '183ec32'  # 清理前基準，固定不隨 commit 移動
WORDS = ['讀者', '這部作品', '本作', '餘韻', '津津樂道', '留白', '經典', '銷量', '人氣', '氣氛', '氛圍']
RANGE = {'manga': (200, 300), 'essentials': (200, 300), 'classics': (150, 250)}
MIN_SIMILARITY = 0.55  # 低於這個比例代表整段重寫，不是刪改
TOKEN = re.compile(r'[0-9０-９]+|[A-Za-z]{2,}|「[^」]+」|《[^》]+》')


def hits(text):
    return [w for w in WORDS if w in text]


def without_hits(text):
    sentences = re.findall(r'[^。！？]+[。！？」]*', text)
    return ''.join(x for x in sentences if not hits(x))


def strip_plots(book):
    b = copy.deepcopy(book)
    for c in b['chapters']:
        c.pop('plot', None)
    return b


def check(name):
    bad = []
    path = f'data/{name}.json'
    old = json.loads(subprocess.check_output(['git', 'show', f'{BASE}:{path}']))
    new = json.load(open(path, encoding='utf-8'))
    ex_path = f'tools/commentary_exceptions_{name}.json'
    ex = json.load(open(ex_path, encoding='utf-8')) if os.path.exists(ex_path) else {}
    lo, hi = RANGE[name]
    if [b['id'] for b in old] != [b['id'] for b in new]:
        return [f'{name}: 書目或順序被改動']
    changed = 0
    residual = 0
    for ob, nb in zip(old, new):
        if strip_plots(ob) != strip_plots(nb):
            bad.append(f"{ob['id']}: plot 以外的欄位被改動")
            continue
        for oc, nc in zip(ob['chapters'], nb['chapters']):
            key = f"{ob['id']}#{oc['num']}"
            op, np = oc['plot'], nc['plot']
            e = ex.get(key)
            if e and e.get('kind') not in ('in-story', 'needs-research'):
                bad.append(f'{key}: 例外 kind 不合法')
            if e and not e.get('reason'):
                bad.append(f'{key}: 例外缺 reason')
            if e and e.get('kind') == 'needs-research' and op != np:
                bad.append(f'{key}: needs-research 必須維持原文')
            if e and e.get('kind') == 'needs-research' and len(without_hits(op)) >= lo:
                bad.append(f'{key}: 整句刪掉含禁用詞的句子後仍有 {len(without_hits(op))} 字，不是 needs-research，應直接清理')
            if op == np:
                left = [w for w in hits(np) if not (e and w in e.get('words', []))]
                if left:
                    residual += 1
                    bad.append(f'{key}: 殘留禁用詞 {left}')
                continue
            changed += 1
            if not hits(op):
                bad.append(f'{key}: 基準版沒有禁用詞，不可改動')
            left = [w for w in hits(np) if not (e and e.get('kind') == 'in-story' and w in e.get('words', []))]
            if left:
                residual += 1
                bad.append(f'{key}: 殘留禁用詞 {left}')
            if not lo <= len(np) <= hi:
                bad.append(f'{key}: 長度 {len(np)} 不在 {lo}~{hi}')
            for c in ',;:':
                if c in np:
                    bad.append(f'{key}: 半形標點 {c}')
            added = [t for t in TOKEN.findall(np) if t not in op]
            if added:
                bad.append(f'{key}: 出現原文沒有的數字／英文／引號內容 {added}')
            sim = difflib.SequenceMatcher(None, op, np, autojunk=False).ratio()
            if sim < MIN_SIMILARITY:
                bad.append(f'{key}: 與原文相似度 {sim:.2f} < {MIN_SIMILARITY}，疑似整段重寫')
    for key in ex:
        bid, _, num = key.partition('#')
        b = next((x for x in old if x['id'] == bid), None)
        c = next((c for c in (b['chapters'] if b else []) if str(c['num']) == num), None)
        if c is None:
            bad.append(f'{key}: 例外指向不存在的章節')
    print(f'{name}: 改動 {changed} 話、殘留 {residual} 話、例外 {len(ex)} 筆、問題 {len(bad)} 條')
    return bad


def main():
    names = sys.argv[1:]
    if not names or any(n not in RANGE for n in names):
        sys.exit('用法：check_commentary.py classics|manga|essentials ...')
    bad = [b for n in names for b in check(n)]
    for b in bad:
        print('FAIL', b)
    print('結果:', 'PASS' if not bad else f'{len(bad)} FAIL')
    sys.exit(1 if bad else 0)


main()
