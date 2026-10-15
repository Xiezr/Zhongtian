# -*- coding: utf-8 -*-
"""v67 存档系统 · 破坏测试：逐类注入故障，确认新断言**真的会红**。

判据（本项目的老规矩）：
  · 每类注入都备份原文件、跑完**必须 md5 一致地还原**；
  · "变红 0 条"要区分两种情况：断言守不住 / 断言根本不在文件里 ——
    所以注入前先确认**目标断言确实存在**，否则报"锚点错"而不是"通过"。
  · 注入脚本一律写成 .py（内联 -c 的反斜杠会被 shell 层吃掉，看着像"零输出"）。
"""
import io, os, shutil, hashlib, subprocess, sys

ROOT = r'E:\Deepseekdb'
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
BAK = os.path.join(ROOT, '.workbuddy', 'tmp', 'break_bak_v67s')
SMOKE = os.path.join(ROOT, 'smoke-test.js')


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def run_smoke():
    r = subprocess.run([NODE, 'smoke-test.js'], cwd=ROOT, stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=600)
    out = r.stdout.decode('utf-8', 'replace')
    fails = [l.strip() for l in out.split('\n') if '❌' in l]
    tail = [l for l in out.split('\n') if l.startswith('结果：')]
    return fails, (tail[0] if tail else '（无结果行）'), out


def patch(rel, old, new):
    p = os.path.join(ROOT, rel)
    t = io.open(p, encoding='utf-8', newline='').read()
    if t.count(old) != 1:
        raise RuntimeError('锚点 %d 次：%s' % (t.count(old), old[:60]))
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace(old, new, 1))
    return p


CASES = [
    ('① 存档不写索引摘要（面板要靠索引，不解析主档）', 'js/state.js',
     "      GAME._setSlotIndex(slot.id, GAME.state, json.length);",
     "      /* 注入：不写索引 */"),
    ('② 导入不校验校验和（坏档照收）', 'js/state.js',
     "    if (pack._check && GAME.checksum(JSON.stringify(pack.state)) !== pack._check)\n      return { ok: false, msg: '存档校验失败：内容被改动过或复制时掉字了' };",
     "    /* 注入：跳过校验和 */"),
    ('③ 轮换顺序写反（坏档会盖掉好档）', 'js/state.js',
     "      for (var i = 3; i >= 1; i--) {",
     "      for (var i = 1; i <= 3; i++) {"),
    ('④ 槽位读档不走 adoptState（迁移只对新档生效）', 'js/state.js',
     "      return GAME.adoptState(st);      // 与 loadGame 同一套后处理",
     "      return st;                       // 注入：绕过后处理"),
    ('⑤ saveGame 又自己 stringify（序列化两个出口）', 'js/state.js',
     "      var json = GAME.savePayload();\n      localStorage.setItem(SAVE_KEY, json);",
     "      var json = JSON.stringify(GAME.state);\n      localStorage.setItem(SAVE_KEY, json);"),
    ('⑥ 导出不带校验和', 'js/state.js',
     "      _check: GAME.checksum(JSON.stringify(st)), state: st",
     "      state: st"),
    ('⑦ 面板只渲染前 6 个槽位（偷工减料）', 'js/ui.js',
     "    '<div class=\"sv-list\">' + list.map(ui.svRowHTML).join('') + '</div>' +",
     "    '<div class=\"sv-list\">' + list.slice(0, 6).map(ui.svRowHTML).join('') + '</div>' +"),
    ('⑧ 自动存档不走 autoSave（备份轮换失效）', 'js/main.js',
     "      if (GAME.autoSave().ok) GAME._lastAutoSave = GAME.utils.now();",
     "      if (GAME.saveGame()) GAME._lastAutoSave = GAME.utils.now();"),
]

print('=== 注入前：确认目标断言都在 smoke 里 ===')
sm = io.open(SMOKE, encoding='utf-8', newline='').read()
need = ['存入手动槽 → 成功，且索引里有摘要', '导入被篡改的存档 → 校验和拦住',
        '轮换顺序：a3←a2←a1←main', '从槽位读档 → 复现同一份',
        '序列化只有 savePayload 一个出口', '导出文本自描述', '槽位表：主档 + 3 手动 + 3 自动备份',
        '自动存档走 autoSave', '面板逐行渲染']
miss = [n for n in need if n not in sm]
if miss:
    print('   ❌ 断言不在文件里，先补断言再谈注入：', miss)
    sys.exit(2)
print('   ✅ 9 条目标断言都在')

# 备份
if os.path.isdir(BAK):
    shutil.rmtree(BAK)
os.makedirs(BAK)
FILES = sorted(set(c[1] for c in CASES))
ORIG = {}
for rel in FILES:
    src = os.path.join(ROOT, rel)
    dst = os.path.join(BAK, rel.replace('/', '__'))
    shutil.copy2(src, dst)
    ORIG[rel] = md5(src)
print('   备份 %d 个文件，md5 已记录' % len(FILES))

red_ok, zero = [], []
for desc, rel, old, new in CASES:
    for r2 in FILES:                       # 每类前先还原，避免叠加
        shutil.copy2(os.path.join(BAK, r2.replace('/', '__')), os.path.join(ROOT, r2))
    try:
        patch(rel, old, new)
    except RuntimeError as e:
        print('⛔ %-42s 注入失败（%s）' % (desc, e))
        zero.append(desc + '（锚点错）')
        continue
    fails, tail, _ = run_smoke()
    if fails:
        red_ok.append(desc)
        print('✅ 变红 %-2d 条  %s' % (len(fails), desc))
        for f in fails[:2]:
            print('        %s' % f[:100])
    else:
        zero.append(desc)
        print('⚠️ 变红  0 条  %s   ← 断言没守住！' % desc)

# 还原 + md5 校验
print()
bad = []
for rel, h in ORIG.items():
    shutil.copy2(os.path.join(BAK, rel.replace('/', '__')), os.path.join(ROOT, rel))
    now = md5(os.path.join(ROOT, rel))
    if now != h:
        bad.append(rel)
print('还原：%d 个文件 md5 %s' % (len(ORIG), '全部一致 ✅' if not bad else '❌ 不一致 ' + str(bad)))
shutil.rmtree(BAK, ignore_errors=True)

fails, tail, _ = run_smoke()
print('还原后复跑：%s' % tail)
print()
print('破坏测试：%d/%d 变红 · 零反应 %d %s' % (len(red_ok), len(CASES), len(zero),
      ('→ ' + '；'.join(zero)) if zero else ''))
sys.exit(0 if (not zero and not bad and '0 失败' in tail) else 1)
