# -*- coding: utf-8 -*-
"""v89.107 打标 · 第二批（行号按 state.js 插入后的新编号重取）。"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
BAK = os.path.join(R, '.workbuddy', 'backup', 'v89107_msgkind')
os.makedirs(BAK, exist_ok=True)
NODE = 'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'
PLAN = {
    'state.js':  {'beacon': [2760, 2776, 2786, 3058], 'war': [3027]},
    'domain.js': {'war': [212, 1251, 2392, 5584], 'task': [4885, 5022, 5070]},
    'story.js':  {'task': [200, 245]},
}


def check(path):
    r = subprocess.run([NODE, '--check', path], capture_output=True)
    if r.returncode != 0:
        raise SystemExit('!! 语法检查失败：' + path + '\n' + r.stderr.decode('utf-8', 'ignore'))


for f, kinds in PLAN.items():
    p = os.path.join(R, 'js', f)
    lines = io.open(p, encoding='utf-8').read().split('\n')
    hit = []
    for kind, nums in kinds.items():
        for n in nums:
            if 'GAME.log(' not in lines[n - 1]:
                raise SystemExit('!! %s:%d 没有 GAME.log( —— %s' % (p, n, lines[n - 1][:60]))
            lines[n - 1] = lines[n - 1].replace('GAME.log(', 'GAME.log.' + kind + '(', 1)
            hit.append('%d→%s' % (n, kind))
    shutil.copyfile(p, os.path.join(BAK, f + '.orig2'))
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
    os.replace(tmp, p)
    check(p)
    print('%s：%s' % (f, ' · '.join(hit)))
print('完成')
