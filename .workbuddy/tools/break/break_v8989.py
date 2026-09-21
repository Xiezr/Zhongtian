# -*- coding: utf-8 -*-
"""v89.89 破坏测试：对「v6 期待清单八条（A2/A3/A4/B1/C3/C4/D4/E3）」的 §89 断言逐一注入，
确认**变红**。跑法：python .workbuddy/tools/break/break_v8989.py
"""
import io
import os
import re
import subprocess
import sys
import hashlib

ROOT = r'E:\Deepseekdb'
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
SMOKE = os.path.join(ROOT, 'smoke-test.js')

DA = os.path.join(ROOT, 'js', 'data.js')
DM = os.path.join(ROOT, 'js', 'domain.js')
ST = os.path.join(ROOT, 'js', 'state.js')
UI = os.path.join(ROOT, 'js', 'ui.js')
MJ = os.path.join(ROOT, 'js', 'main.js')
BA = os.path.join(ROOT, 'js', 'battle.js')


def md5(p):
    return hashlib.md5(io.open(p, 'rb').read()).hexdigest()


def run_smoke():
    env = dict(os.environ)
    env['NODE_PATH'] = NODE_PATH
    r = subprocess.run([NODE, 'smoke-test.js'], cwd=ROOT, capture_output=True, env=env, timeout=900)
    out = r.stdout.decode('utf-8', 'replace')
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    return r.returncode, (m.groups() if m else None), re.findall(r'❌ (.+)', out)


INJECTIONS = [
    # ---- C3：门派晋升（门槛 + 占城来源 + 唯一出口） ----
    ('C3①：长老门槛回退 60000 → 300000', DA,
     "    { id: 'r5', name: '长老',     rep: 60000 },",
     "    { id: 'r5', name: '长老',     rep: 300000 },",
     'v89.89（C3）：门派声望来源扩容（占城分档）+ 门槛重估（长老 60000）'),
    ('C3②：占城分档清零（县 → 0）', DA,
     "  DATA.SECT_CONQUER_REP = { county: 1500, jun: 4000, zhou: 12000, capital: 30000 };",
     "  DATA.SECT_CONQUER_REP = { county: 0, jun: 4000, zhou: 12000, capital: 30000 };",
     'v89.89（C3）：门派声望来源扩容（占城分档）+ 门槛重估（长老 60000）'),
    ('C3③：未入派守卫删除（无门派也发声望）', DM,
     "    if (!st.id || !n) return { ok: false, gain: 0, rankUp: null };",
     "    if (!n) return { ok: false, gain: 0, rankUp: null };",
     'v89.89（C3）：门派声望来源扩容（占城分档）+ 门槛重估（长老 60000）'),
    # ---- A2：离线归来报告 ----
    ('A2①：归集段改名（快照失效）', ST,
     "    GAME._offlineReport = {",
     "    GAME._offlineReportX = {",
     'v89.89（A2）：离线归来报告（快照归集 · 分类弹窗 · 载入即弹）'),
    # ---- A3：歼敌值解释 ----
    ('A3①：解释文案被改（口径不明）', BA,
     "title=\"歼敌值 = 按歼灭敌军的资源造价折算（与将领经验同一口径）\"",
     "title=\"歼敌值 = 资源造价折算\"",
     'v89.89（A3）：战报「歼敌值」口径悬停解释'),
    # ---- A4：材料产地跳转 ----
    ('A4①：🗺️ 跳转动作改名（孤儿化）', UI,
     "'<span class=\"mat-go\" data-action=\"mat-go\" data-mat=\"' + mk +",
     "'<span class=\"mat-go\" data-action=\"mat-gox\" data-mat=\"' + mk +",
     'v89.89（A4）：材料产地悬停（data-tip）+ 🗺️ 跳转（州治解析）'),
    # ---- B1：任务一键全领 ----
    ('B1①：一键全领分发失效', MJ,
     "      case 'quest-claim-all': GAME.doClaimAllQuests(); break;",
     "      case 'quest-claim-all-x': GAME.doClaimAllQuests(); break;",
     'v89.89（B1）：任务一键全领（复用 claimQuest / claimRandomQuest 出口）'),
    # ---- D4：战报筛选收藏 ----
    ('D4①：收藏分发失效', MJ,
     "      case 'rep-fav': ui.toggleRepFav(Number(el.dataset.i)); break;",
     "      case 'rep-fav-x': ui.toggleRepFav(Number(el.dataset.i)); break;",
     'v89.89（D4）：战报筛选（胜/败/收藏）+ 行内收藏（随档字段）'),
    # ---- C4：故事集 ----
    ('C4①：重读分发失效（故事集入口死）', MJ,
     "      case 'story-read-at': ui.openStory(el.dataset.sid, false); break;",
     "      case 'story-read-at-x': ui.openStory(el.dataset.sid, false); break;",
     'v89.89（C4）：故事集（已读显名可重读 · 未读？？？ · 分类进度）'),
    # ---- E3：人口三段条 ----
    ('E3①：人口增势公式漂移（0.05% → 0.08%）', DM,
     "    return Math.max(1, maxPop * 0.0005);",
     "    return Math.max(1, maxPop * 0.0008);",
     'v89.89（E3）：募兵面板人口三段条（可征/上限/增势 · 唯一出口）'),
]


def main():
    smoke_src = io.open(SMOKE, encoding='utf-8', newline='').read()
    missing = []
    for name, _, _, _, watch in INJECTIONS:
        if watch not in smoke_src:
            missing.append((name, watch))
    if missing:
        print('✗ 部分断言不在 smoke-test.js（先同步断言清单）：')
        for n, w in missing:
            print('   -', n, '→', w)
        return 2
    print('① 断言在位校验：%d 条全部命中 ✅' % len(INJECTIONS))

    files = sorted({t for _, t, _, _, _ in INJECTIONS})
    base = {p: md5(p) for p in files}
    origin = {p: io.open(p, encoding='utf-8', newline='').read() for p in files}
    print('② 基线 md5：%d 个文件已记\n' % len(files))

    results = []
    for name, target, old, new, watch in INJECTIONS:
        print('── %s ──' % name)
        try:
            n = origin[target].count(old)
            if n != 1:
                print('   ✗ 锚点出现 %d 次（要求 1 次），未注入\n' % n)
                results.append((name, False, '锚点 %d 次' % n))
                continue
            io.open(target, 'w', encoding='utf-8', newline='').write(
                origin[target].replace(old, new, 1))
            rc, counts, fails = run_smoke()
            red = any(watch in f for f in fails)
            print('   smoke 退出码 %s  计数 %s  失败行 %d' % (rc, counts, len(fails)))
            if counts is None:
                print('   ⚠️ 判据失效：拿不到标准汇总行（疑似中断）')
            for f in [x for x in fails if watch in x][:2]:
                print('   ❌ ' + f.strip()[:78])
            print('   目标断言变红：%s' % ('✅ 是' if red else '❌ 否（零反应！）'))
            results.append((name, red, '失败 %s' % (counts[1] if counts else '?')))
        finally:
            io.open(target, 'w', encoding='utf-8', newline='').write(origin[target])
        print()

    print('=' * 62)
    for name, ok, note in results:
        print(('  ✅ ' if ok else '  ❌ ') + name + '  (' + note + ')')
    allok = all(ok for _, ok, _ in results)
    same = all(md5(p) == base[p] for p in files)
    print('=' * 62)
    print('破坏测试：%d/%d 变红' % (sum(1 for _, ok, _ in results if ok), len(results)))
    print('还原核验：%s' % ('✅ 全部文件与注入前逐字节一致' if same else '❌ 未还原干净！'))
    return 0 if (allok and same) else 1


if __name__ == '__main__':
    sys.exit(main())
