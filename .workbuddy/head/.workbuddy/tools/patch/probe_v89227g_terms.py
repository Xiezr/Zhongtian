# -*- coding: utf-8 -*-
"""v89.227 探针 G：百炼 / 藏珍阁 全量逐行（五文件）—— 分类：界面词 / 老板引述 / 历史注释 / 代码符号。"""
import io

BASE = 'E:/Deepseekdb/'
FILES = ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/systems.js', 'js/state.js', 'index.html', 'smoke-test.js', 'e2e-test.js']

for w in ['百炼', '藏珍阁']:
    print('################ %s ################' % w)
    for f in FILES:
        try:
            t = io.open(BASE + f, encoding='utf-8', newline='').read()
        except Exception:
            continue
        for i, ln in enumerate(t.split('\n'), 1):
            if w in ln:
                print('  %s:%d  %s' % (f, i, ln.strip()[:190]))
    print()
