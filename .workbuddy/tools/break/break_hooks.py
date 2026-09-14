# -*- coding: utf-8 -*-
"""端到端破坏测试：确认 pre-commit 钩子**真的会拦住**坏提交（拦不住就是装饰）。

手法：
  ① 备份 js/ui.js 并记 md5
  ② 注入语法错误 → git add
  ③ 真跑 git commit（会触发 .git/hooks/pre-commit）
  ④ 期望：commit 被拒（返回非 0）、HEAD 未前进、钩子打印门禁不通
  ⑤ 无论成败都还原：git restore --staged + 文件还原 + md5 比对

用法：python break_hooks.py
"""
import hashlib, os, re, subprocess, sys

ROOT = r'E:\Deepseekdb'
TARGET = os.path.join(ROOT, 'js', 'ui.js')
BAK = TARGET + '.hookbak'
POISON = '\nfunction __hooktest__( ) { \n'


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def git(*a, **kw):
    r = subprocess.run(['git', '-C', ROOT] + list(a), capture_output=True, timeout=kw.get('timeout', 300))
    return r.returncode, r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace')


if not os.path.exists(TARGET):
    print('✗ 找不到注入目标')
    sys.exit(2)

before = md5(TARGET)
head_before = git('rev-parse', 'HEAD')[1].strip()
print(f'注入前 js/ui.js md5 = {before}')
print(f'注入前 HEAD        = {head_before[:12]}')

with open(TARGET, 'rb') as s, open(BAK, 'wb') as d:
    d.write(s.read())

verdict = False
try:
    # ② 注入 + 暂存
    with open(TARGET, 'a', encoding='utf-8', newline='') as f:
        f.write(POISON)
    rc, _, err = git('add', 'js/ui.js')
    if rc != 0:
        print('✗ git add 失败:', err)
        sys.exit(2)
    print('已注入语法错误并暂存 js/ui.js')

    # ③ 真跑 commit（触发 pre-commit 钩子）
    print('\n--- git commit 输出 ---')
    sys.stdout.flush()
    rc, out, err = git('commit', '-m', '【破坏测试】不该被提交', timeout=300)
    print(out)
    print(err)
    print('--- 输出结束 ---\n')

    # ④ 判据
    head_after = git('rev-parse', 'HEAD')[1].strip()
    blocked = (rc != 0)
    head_same = (head_after == head_before)
    saw_gate = ('门禁' in out + err)
    saw_fail = ('门禁不通' in out + err) or ('异常中断' in out + err)

    print('=' * 46)
    print(f'commit 返回码   : {rc}            期望非 0 → {"✅" if blocked else "❌ 没拦住！"}')
    print(f'HEAD 是否未动   : {head_same}   期望 True → {"✅" if head_same else "❌ HEAD 前进了，坏提交入库！"}')
    print(f'钩子打印了门禁  : {saw_gate}    → {"✅" if saw_gate else "❌ 钩子没跑？"}')
    print(f'明确指出不通    : {saw_fail}    → {"✅" if saw_fail else "❌"}')
    verdict = blocked and head_same and saw_gate and saw_fail
    print(f'结论            : {"✅ 钩子真的会拦（不是装饰）" if verdict else "❌ 钩子失效，必须修"}')
finally:
    git('restore', '--staged', 'js/ui.js')
    if os.path.exists(BAK):
        os.replace(BAK, TARGET)

after = md5(TARGET)
print(f'\n还原后 md5 = {after}')
print(f'md5 比对：{"✅ 与注入前完全一致" if after == before else "❌ 未还原干净"}')
print(f'工作区：{git("status", "--porcelain")[1].strip() or "(干净)"}')
sys.exit(0 if (verdict and after == before) else 1)
