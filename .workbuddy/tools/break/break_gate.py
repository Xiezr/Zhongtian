# -*- coding: utf-8 -*-
"""破坏测试：确认 git/gate.py 的判据**真的会红**（红不了的就是装饰）。

注入手法：往 js/ui.js 末尾追加一行语法错误 → node 加载即抛 → 三件套全部异常中断。
预期 gate.py 返回 1（门禁不通），且摘要出现「异常中断」。

铁律：md5 比对还原（成功失败都要还原，收尾必须打印核对结果）。
用法：python break_gate.py
"""
import hashlib, os, subprocess, sys

ROOT = r'E:\Deepseekdb'
TARGET = os.path.join(ROOT, 'js', 'ui.js')
GATE = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')
PY = r'C:\Users\18811\.workbuddy\binaries\python\versions\3.13.12\python.exe'
POISON = '\nfunction __breaktest__( ) { \n'   # 不闭合 → SyntaxError

bak = TARGET + '.breakbak'


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def restore():
    if os.path.exists(bak):
        os.replace(bak, TARGET)
    return md5(TARGET)


if not os.path.exists(TARGET):
    print('✗ 找不到注入目标', TARGET)
    sys.exit(2)

before = md5(TARGET)
print(f'注入前 js/ui.js md5 = {before}')

# ① 备份（用 os.replace 还原，避免残留副本）
with open(TARGET, 'rb') as s, open(bak, 'wb') as d:
    d.write(s.read())

try:
    # ② 注入
    with open(TARGET, 'a', encoding='utf-8', newline='') as f:
        f.write(POISON)
    print(f'已注入语法错误（{len(POISON)} 字节）')

    # ③ 跑门禁，强制全量
    r = subprocess.run([PY, GATE, '--full'], cwd=ROOT, capture_output=True)
    out = r.stdout.decode('utf-8', 'replace')

    print('\n--- gate.py 输出 ---')
    print(out)

    # ④ 判据：必须返回 1，且摘要里出现「异常中断」
    got_red = (r.returncode == 1)
    saw_interrupt = '异常中断' in out
    print('=' * 46)
    print(f'门禁返回码     : {r.returncode}   期望 1  → {"✅" if got_red else "❌ 零反应！"}')
    print(f'识别为异常中断 : {saw_interrupt}  → {"✅" if saw_interrupt else "❌ 未识别"}')
    verdict = got_red and saw_interrupt
    print(f'破坏测试结论   : {"✅ 判据真的会红（不是装饰）" if verdict else "❌ 判据是装饰，必须修"}')
finally:
    after = restore()

print(f'\n还原后 js/ui.js md5 = {after}')
print(f'md5 比对：{"✅ 与注入前完全一致，已还原" if after == before else "❌ 未还原干净！"}')
sys.exit(0 if verdict else 1)
