#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_smoke2.py -- fix smoke 81 assertion semantics

Bug: `first` in GAME.SG.settle means "this ENDING is newly read", not "this story is
re-read". The original assertion expected first===false on a brand-new ending.
Fix: assert first===true for a new ending, then re-read the SAME ending and assert false.

No backslash escapes (no regex, no chr-escapes needed).
Idempotent: skips when the fixed marker is present.
"""
import io

P = r'E:\Deepseekdb\smoke-test.js'

OLD_LABEL = u"check('故事库：入档进度（done 累积 · 重读换结局 → 首次标记为假）', (function () {"
NEW_LABEL = u"check('故事库：入档进度（新结局记首次 · 同结局重读 → 首次标记为假）', (function () {"

OLD_TAIL = u"""    if (!c.ok || c.run.phase !== 'end' || c.run.ending.id !== 'e1') return false;
    var rec1 = GAME.SG.progress()['bld-guanfu-01'];
    return c.run.got.first === false && (rec1.n || 0) === n0 + 1 && rec1.done.length >= 2;"""

NEW_TAIL = u"""    if (!c.ok || c.run.phase !== 'end' || c.run.ending.id !== 'e1') return false;
    var rec1 = GAME.SG.progress()['bld-guanfu-01'];
    if (!(c.run.got.first === true && (rec1.n || 0) === n0 + 1 && rec1.done.length >= 2)) return false;
    GAME.SG.begin('bld-guanfu-01');
    GAME.SG.choose(1);
    var c2 = GAME.SG.choose(1);                        /* 再走一遍 → e2（已读过） */
    var rec2 = GAME.SG.progress()['bld-guanfu-01'];
    return c2.ok && c2.run.ending.id === 'e2' && c2.run.got.first === false && (rec2.n || 0) === n0 + 2;"""

src = io.open(P, encoding='utf-8', newline='').read()
if u'新结局记首次' in src:
    print('already fixed -- skip (idempotent)')
    raise SystemExit(0)

for i, (old, new) in enumerate([(OLD_LABEL, NEW_LABEL), (OLD_TAIL, NEW_TAIL)], 1):
    n = src.count(old)
    if n != 1:
        print('edit %d matched %d times (expected 1) -- aborted' % (i, n))
        raise SystemExit(1)
    src = src.replace(old, new)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
chk = io.open(P, encoding='utf-8', newline='').read()
ok = (u'新结局记首次' in chk) and (u'c2.run.got.first === false' in chk)
print('smoke-test.js fixed (%d chars) -- verify %s' % (len(chk), 'PASS' if ok else 'FAIL'))
raise SystemExit(0 if ok else 1)
