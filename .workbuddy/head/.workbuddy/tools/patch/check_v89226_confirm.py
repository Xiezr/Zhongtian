# -*- coding: utf-8 -*-
"""v89.226 复核：素材层三证复跑（apply 完整性 + 切分确定性）。

① apply 完整性：W-B1 暂存 16 张 vs 线上 UI 16 张 —— md5 应逐张一致（"入库=暂存"）。
② 切分确定性：暂存（无旗）vs backup/v89225（带旗旧版）逐像素差，
   **必须全部落在旗几何范围内**（扩大区外=0）——证明重切=同材质−旗，无材质漂移。
"""
import os, hashlib

from PIL import Image
import numpy as np

BASE = 'E:/Deepseekdb/'
SD = BASE + '.workbuddy/tmp/wasteland/W-B1/'
UI = BASE + 'assets/icons/ui/'
BAK = BASE + '.workbuddy/backup/v89225/icons/'
BOX2 = (0.60, 0.58, 0.90, 0.94)   # 旗完整几何（含杆底/底座）

names = sorted(f for f in os.listdir(SD) if f.endswith('.png'))
print('W-B1 暂存 %d 张' % len(names))

# ---------- ① apply 完整性 ----------
diff_md5 = []
for f in names:
    a = hashlib.md5(open(SD + f, 'rb').read()).hexdigest()
    b = hashlib.md5(open(UI + f, 'rb').read()).hexdigest()
    if a != b:
        diff_md5.append(f)
print('① apply 完整性（md5 stage vs UI）：%s' % ('全部一致 ✓' if not diff_md5 else 'DIFF: ' + ','.join(diff_md5)))

# ---------- ② 切分确定性 ----------
total = out2 = 0
worst = []
for f in names:
    a = np.asarray(Image.open(SD + f).convert('RGBA')).astype(np.int16)
    b = np.asarray(Image.open(BAK + f).convert('RGBA')).astype(np.int16)
    d = (np.abs(a - b).sum(axis=2) > 0)
    h, w = a.shape[:2]
    x0, y0 = int(w * BOX2[0]), int(h * BOX2[1])
    x1, y1 = int(w * BOX2[2]), int(h * BOX2[3])
    mask = np.zeros((h, w), dtype=bool)
    mask[y0:y1, x0:x1] = True
    din = int((d & mask).sum())
    dout = int((d & ~mask).sum())
    total += din + dout
    out2 += dout
    if dout:
        worst.append('%s 区外=%d' % (f, dout))
print('② 切分确定性（stage vs backup 带旗版）：总差=%d · 旗几何外差异=%d' % (total, out2))
if worst:
    print('   ⛔ 区外差异:', ' '.join(worst[:8]))
else:
    print('   ✓ 全部差异落在旗几何内（重切=同材质−旗，无材质漂移）')
