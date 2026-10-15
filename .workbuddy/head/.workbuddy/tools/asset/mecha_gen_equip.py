# -*- coding: utf-8 -*-
"""为每套机甲装备生成缺失的 7 槽件（右臂/右前臂/右脚 + 左·右大腿 + 左·右小腿）。
镜像右侧=左侧；双腿参考臂件量级新建。输出可插入 data.js 的 JS 块。"""
import re

SRC = r"E:/Deepseekdb/js/data.js"
txt = open(SRC, encoding="utf-8").read()

def body_of(header):
    i = txt.find(header)
    if i < 0: return ""
    j = txt.find("\n  };", i)
    if j < 0: j = txt.find("};", i)
    return txt[i:j]

bodies = body_of("DATA.EQUIP = {") + "\n" + body_of("var NEW_EQUIP = {")

# 关键：q 后面可能是逗号或 ' }'；tail 抓剩余含逗号内容
pat = re.compile(
    r"\{ *id: *'([^']+)' *, *name: *'([^']+)' *(?:, *set: *'([^']+)')? *, *slot: *'([^']+)' *, *q: *(\d+) *,(?P<tail>[^}]*)")
entries = []
for mm in pat.finditer(bodies):
    tail = mm.group("tail").strip().strip(",").strip()
    entries.append({"id": mm.group(1), "name": mm.group(2), "set": mm.group(3),
                    "slot": mm.group(4), "q": int(mm.group(5)),
                    "tail": (", " + tail) if tail else ""})
print("parsed", len(entries))
by_set = {}
for e in entries:
    if e["set"]:
        by_set.setdefault(e["set"], {})[e["slot"]] = e

SET_ZH = {"yitian": "陨锋", "mingjiang": "佣兵", "shenwu": "军魂",
          "youxia": "游猎", "xianzhen": "冲锋", "shouyu": "壁垒", "tiance": "智囊"}
NEW_SLOTS = [("arm_up_r", "arm_up_l", "r", "右驱动臂"),
             ("arm_low_r", "arm_low_l", "r", "右操作臂"),
             ("foot_r", "foot_l", "r", "右抓地足"),
             ("thigh_l", "arm_up_l", "tl", "左承载腿"),
             ("thigh_r", "arm_up_l", "tr", "右承载腿"),
             ("shin_l", "arm_low_l", "sl", "左支撑腿"),
             ("shin_r", "arm_low_l", "sr", "右支撑腿")]

lines = []
for sid in sorted(by_set):
    bag = by_set[sid]
    base = SET_ZH.get(sid, sid)
    for newslot, srcslot, sfx, zh in NEW_SLOTS:
        if newslot in bag: continue
        src = bag.get(srcslot)
        if not src:
            print("  !! %s missing %s" % (sid, srcslot)); continue
        eid = src["id"] + "_" + sfx
        nm = base + zh
        lines.append("    %-12s{ id: '%s', name: '%s', set: '%s', slot: '%s', q: %d%s }," %
                     (eid + ":", eid, nm, sid, newslot, src["q"], src["tail"]))

block = ("  /* v90.11：机甲 19 槽 —— 为每套补齐**右臂/右前臂/右脚 + 双腿（大小腿各左右）**七件。\n"
         "     右侧 = 左侧同件镜像；双腿量级参考同套臂件（大腿≈上臂、小腿≈前臂）。 */\n"
         "  (function () {\n    var MECHA_EXTRA = {\n"
         + "\n".join(lines) +
         "\n    };\n    for (var me in MECHA_EXTRA) DATA.EQUIP[me] = MECHA_EXTRA[me];\n  })();\n")
open(r"E:/Deepseekdb/.workbuddy/tmp/mecha_extra_equip.js", "w", encoding="utf-8").write(block)
print("generated", len(lines), "entries")
print(block[:600])
