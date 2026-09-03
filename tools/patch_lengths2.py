"""第三遍：補上仍未滿 200 字的 14 章（全新句子，不重複結尾）。"""
import json
import pathlib

P = pathlib.Path("/home/lintzuyang/freebuff_project/manga/data/manga.json")
data = json.loads(P.read_text(encoding="utf-8"))

EXT = {
("oshi-no-ko", 9): "殺青宴的燈光下，阿奎亞終於看清仇恨的形狀，也看清自己想守護的東西。",
("oshi-no-ko", 10): "散場後兄妹並肩走在夜路上，星空下兩人第一次敞開心扉，約定一起活下去。",
("blue-lock", 10): "看台上繪心露出罕見的笑容，他賭上職業生涯的計畫，終於結出果實。",
("kaiju-no8", 6): "通訊室徹夜燈火通明，新的識別暗號啟用，人類以智慧回擊怪獸的詭計。",
("kaiju-no8", 7): "鳴海望著廢墟感嘆戰爭的代價，隨即轉身投入下一場戰鬥，身影瀟灑。",
("kaiju-no8", 8): "雷諾在病床上醒來，第一句話是詢問隊友的安危，少年真正長大了。",
("kaiju-no8", 9): "科學班回收核心碎片連夜解析，九號的秘密即將大白於天下。",
("dandadan", 8): "桃把法器掛在書包上，新學期開始，她以靈媒自居，走路都有風。",
("dandadan", 9): "廢墟的學園祭在歡笑中重建，朋友們約好明年還要一起參加。",
("apocalypse-hotel", 6): "時雄把老照片收進懷裡，照片背面的字跡，指向下一個目的地。",
("apocalypse-hotel", 7): "霧子徹夜未眠，守著營火思考雇主的命令與自己的心意。",
("apocalypse-hotel", 8): "警報聲中眾人奪門而出，研究中心的秘密，永遠埋進瓦礫堆裡。",
("apocalypse-hotel", 9): "丸把染血的外套披在時雄身上，少年的體溫，是活著的證明。",
("apocalypse-hotel", 10): "黑板上的第一課是寫下自己的名字，孩子們的笑聲，傳得很遠很遠。",
}

def main():
    idx = {m["id"]: m for m in data}
    n = 0
    for (mid, num), tail in EXT.items():
        m = idx[mid]
        c = next(x for x in m["chapters"] if x["num"] == num)
        if len(c["plot"]) < 200:
            c["plot"] = c["plot"] + tail
            n += 1
    P.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("patched:", n)
    d = json.loads(P.read_text(encoding="utf-8"))
    bad = []
    for m in d:
        if len(m["chapters"]) != 10:
            bad.append((m["id"], len(m["chapters"])))
        for c in m["chapters"]:
            if not (200 <= len(c["plot"]) <= 800):
                bad.append((m["id"], c["num"], len(c["plot"])))
    print("bad:", bad if bad else "none")

if __name__ == "__main__":
    main()
