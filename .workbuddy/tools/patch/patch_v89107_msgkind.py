# -*- coding: utf-8 -*-
"""v89.107 消息分类打标：把"发射点声明类别"落到 GAME.log 调用点上。

手法：**命名空间重命名**（`GAME.log(` → `GAME.log.war(`），不动括号 ——
多行拼接的消息若用"加第二参数"的写法要切语句边界，极易改坏（v89.105 的教训）。
未列出的调用点保持 `GAME.log(...)` = 系统消息（默认值，见 state.js）。

另：删掉侦查的 3 行重复日志（报告正文已含「顺手所得 / 意外发现」，第二份真相）。
"""
import io, os, re, shutil, subprocess

R = r'E:/Deepseekdb'
BAK = os.path.join(R, '.workbuddy', 'backup', 'v89107_msgkind')
os.makedirs(BAK, exist_ok=True)
NODE = 'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'

# 文件 → {类别: [行号]}（行号 = 改动前当前文件）
PLAN = {
    'state.js':  {'beacon': [2760, 2776, 2786, 3033], 'war': [3002]},
    'domain.js': {'war': [212, 1251, 2392, 5584], 'task': [4885, 5022, 5070]},
    'story.js':  {'task': [200, 245]},
}
BATTLE_SYS = (2081, 2089, 2092, 2116)      # 将领升级 / 经验 —— 成长类，归系统消息
BATTLE_DEL = (1379, 1380, 1381)           # 侦查重复日志：报告已承载


def check(path):
    r = subprocess.run([NODE, '--check', path], capture_output=True)
    if r.returncode != 0:
        raise SystemExit('!! 语法检查失败：' + path + '\n' + r.stderr.decode('utf-8', 'ignore'))


def atomic(path, text, tag):
    shutil.copyfile(path, os.path.join(BAK, os.path.basename(path) + '.' + tag))
    tmp = path + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(text)   # 先写临时
    os.replace(tmp, path)                                          # 再原子替换
    check(path)


def renames(path, kinds):
    lines = io.open(path, encoding='utf-8').read().split('\n')
    hit = []
    for kind, nums in kinds.items():
        for n in nums:
            if 'GAME.log(' not in lines[n - 1]:
                raise SystemExit('!! %s:%d 没有 GAME.log( —— 行号漂了，中止' % (path, n))
            lines[n - 1] = lines[n - 1].replace('GAME.log(', 'GAME.log.' + kind + '(', 1)
            hit.append('%d→%s' % (n, kind))
    return '\n'.join(lines), hit


log = []

# ---- battle.js：逐行过一遍（原行号判 sys / 删行；其余 GAME.log → war） ----
bp = os.path.join(R, 'js', 'battle.js')
raw = io.open(bp, encoding='utf-8').read().split('\n')
out, war_n, sys_n = [], 0, 0
for i, l in enumerate(raw):
    n = i + 1
    if n in BATTLE_DEL:
        if 'GAME.log(' not in l:
            raise SystemExit('!! battle.js:%d 不是日志行' % n)
        continue                                     # 删（报告已含同样内容）
    if 'GAME.log(' in l and not re.match(r'^\s*(\*|//)', l):
        if n in BATTLE_SYS:
            out.append(l.replace('GAME.log(', 'GAME.log.sys(', 1)); sys_n += 1
        else:
            out.append(l.replace('GAME.log(', 'GAME.log.war(', 1)); war_n += 1
        continue
    out.append(l)
atomic(bp, '\n'.join(out), 'orig')
log.append('battle.js：%d 处→war · %d 处→sys（将领升级/经验）· 删 %d 行侦查重复日志'
           % (war_n, sys_n, len(BATTLE_DEL)))

# ---- 其余文件按行号 ----
for f, kinds in PLAN.items():
    p = os.path.join(R, 'js', f)
    txt, hit = renames(p, kinds)
    atomic(p, txt, 'orig')
    log.append('%s：%s' % (f, ' · '.join(hit)))

print('\n'.join(log))
rest = {}
for f in ['state', 'domain', 'battle', 'systems', 'story', 'ui', 'main']:
    s = io.open(os.path.join(R, 'js', f + '.js'), encoding='utf-8').read()
    n = len(re.findall(r'GAME\.log\(', s))
    if n:
        rest[f + '.js'] = n
print('仍走默认（系统消息）的调用点：' + (str(rest) if rest else '无'))
