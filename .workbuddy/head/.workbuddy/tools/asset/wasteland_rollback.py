# -*- coding: utf-8 -*-
"""一键回滚 —— 把 assets/icons/ui/ 全部还原到换皮开工前的快照。

用法：
  python .workbuddy/tools/asset/wasteland_rollback.py            # 干跑：只列会改哪些
  python .workbuddy/tools/asset/wasteland_rollback.py --apply    # 真还原
  python .workbuddy/tools/asset/wasteland_rollback.py --apply --batch W-B3  # 只还原某批（用装前备份）

两级回滚：
  ① 全量：从 .workbuddy/backup/v89222_wasteland_bitmaps_ui/（开工前 103 张快照）
  ② 分批：从 .workbuddy/backup/pre_wasteland/<批号>/（每批装机前的旧图）
"""
import os, io, sys, shutil, argparse

BASE = r"E:/Deepseekdb"
UI = os.path.join(BASE, "assets", "icons", "ui")
SNAP = os.path.join(BASE, ".workbuddy", "backup", "v89222_wasteland_bitmaps_ui")
PRE = os.path.join(BASE, ".workbuddy", "backup", "pre_wasteland")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--batch")
    a = ap.parse_args()

    if a.batch:
        src = os.path.join(PRE, a.batch)
        if not os.path.isdir(src):
            print("没有该批的装前备份: " + src); return
    else:
        src = SNAP
        if not os.path.isdir(src):
            print("没有开工前快照: " + src); return

    files = [f for f in os.listdir(src) if f.endswith(".png")]
    print("回滚源: %s（%d 张）" % (src, len(files)))
    changed = 0
    for f in sorted(files):
        dst = os.path.join(UI, f)
        same = os.path.exists(dst) and open(dst, "rb").read() == open(os.path.join(src, f), "rb").read()
        if not same:
            changed += 1
            print("  " + ("还原 " if a.apply else "将还原 ") + f)
            if a.apply:
                shutil.copy2(os.path.join(src, f), dst)
    if not changed:
        print("  无需改动（当前 = 快照）")
    print(("\n✅ 已还原 %d 张" if a.apply else "\n（干跑）共 %d 张待还原；加 --apply 执行") % changed)


if __name__ == "__main__":
    main()
