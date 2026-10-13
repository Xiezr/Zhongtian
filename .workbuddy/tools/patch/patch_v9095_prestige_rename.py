# -*- coding: utf-8 -*-
"""
v90.95 · 「爵位」旧称呼退役 → 统一「威望」
老板 2026-10-14：「我说的爵位就是威望，不再用爵位这个旧称呼了。」

范围：
  A. 全文替换（爵位→威望）：活代码 3 + 测试 2 + 活文档 2 + 在岗/复用审计 2
  B. 限域替换：数据字典 §5.1（本作口径；第七章参考区不动）
  C. 待确认注记 → 已确认：需求档案 v90.94 段 + 台账 v90.94 段
  D. 语义微调：domain 拒绝文案去冗余尾；ui「每升高 N 个威望」→「威望档」
不改：老板原话引用、docs/_史料/**、docs/_参考/**、patch 归档、历史探针、
      需求档案/项目地图/台账的历史版本行（当时原述，保留）。
铁律：先备份 → 内存替换（锚点计数断言）→ 原子写回 → node --check → 写后自检。
"""
import os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
assert os.path.exists(os.path.join(ROOT, 'index.html')), 'ROOT 推导错误: ' + ROOT
os.chdir(ROOT)
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.95-prestige')
NODE = r'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-6/node.exe'

# (path, expected_replace_count)  expected = 该文件中「爵位」出现次数（全文替换；0 = 已替换过，续跑跳过）
FULL = [
    ('js/data.js', 5),
    ('js/domain.js', 5),
    ('js/ui.js', 4),
    ('smoke-test.js', 22),
    ('e2e-test.js', 6),
    ('docs/设计规范.md', 10),
    ('docs/v89125-建筑建造时间表.md', 6),
    ('.workbuddy/tools/audit/audit_v89206_systemmatrix.js', 2),
    ('.workbuddy/tools/audit/audit_v89208_systemmatrix.js', 3),
]

# (path, old, new, expected_count)  锚点唯一性/计数断言
ANCHOR = [
    # B. 数据字典 §5.1 本作口径（第七章参考区不动）
    ('docs/数值系统数据字典.md',
     '忠诚/进贡/招降/爵位晋升核心消耗品',
     '忠诚/进贡/招降/威望晋升核心消耗品', 1),
    ('docs/数值系统数据字典.md',
     '进贡朝廷、招降将领、爵位晋升消耗、野地采集产出',
     '进贡朝廷、招降将领、威望晋升消耗、野地采集产出', 8),
    # C1. 需求档案 v90.94 待确认块 → 已确认（锚点 = 整块原文）
    ('需求档案.md',
     '> ⚠️ **口径待老板确认**：本轮把「爵位」理解为**威望档**（`s.rank`，幸存者 → 队长 → … → 废土之王 共 22 档），\n'
     '> 依据是项目 `§241B 爵位晋升` 用例本身即把「威望晋升」写作「爵位晋升」。若指英雄资质档，可整体回退重做。',
     '> ✅ **口径已确认**（2026-10-14 老板原话：「我说的爵位就是威望，不再用爵位这个旧称呼了」）——\n'
     '> 突破门槛 = **威望档**（`s.rank`）；「爵位」为旧称呼，产品与现行口径一律称**威望**（v90.95 全量改名）。\n'
     '> 本档案历史版本行与老板原话引用里的「爵位」为当时原述，按史料原则保留不改。',
     1),
    # C2. 台账 v90.94 段待确认注记
    ('docs/需求台账-v9012-13.md',
     '（口径待老板确认：爵位 = 威望档）',
     '（口径已确认：爵位 = 威望档 · 2026-10-14 老板拍板，旧称呼「爵位」v90.95 全量退役为「威望」）', 1),
    # D1. domain.js 拒绝文案：替换后为「威望不足（需 X 档，现 Y 档）—— 先晋升威望」→ 去冗余尾
    ('js/domain.js',
     "'威望不足（需 ' + need + ' 档，现 ' + curRank + ' 档）—— 先晋升威望'",
     "'威望不足（需 ' + need + ' 档，现 ' + curRank + ' 档）—— 先晋升威望档'", 1),
    # D2. ui.js：「每升高 3 个威望可突破一次」→「威望档」
    ('js/ui.js',
     "' 个威望可突破一次，段顶须突破方可续升'",
     "' 个威望档可突破一次，段顶须突破方可续升'", 1),
]

def read(p):
    with open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def write_atomic(p, s):
    d = os.path.dirname(p) or '.'
    fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
    os.replace(tmp, p)

def main():
    # ① 备份（已存在的备份 = 改前版本，绝不覆盖）
    os.makedirs(BK, exist_ok=True)
    all_files = [p for p, _ in FULL] + sorted({p for p, *_ in ANCHOR})
    for p in all_files:
        dst = os.path.join(BK, p.replace('/', '__'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst):
            shutil.copy2(p, dst)
    print('① 备份 %d 个文件 → %s（已有备份不覆盖）' % (len(all_files), os.path.relpath(BK, ROOT)))

    # ② 全文替换（可续跑：计数 0 = 上轮已替换，跳过）
    n_full = 0
    for p, expect in FULL:
        s = read(p)
        c = s.count('爵位')
        if c == 0:
            assert '威望' in s, p + ' 既无「爵位」也无「威望」，异常'
            print('   · %s：已替换过，跳过' % p)
            continue
        assert c == expect, '%s 爵位计数 %d != 预期 %d' % (p, c, expect)
        s2 = s.replace('爵位', '威望')
        assert '爵位' not in s2, p + ' 替换后仍有残留'
        write_atomic(p, s2)
        n_full += c
        print('   ✓ %s：%d 处 → 威望' % (p, c))

    # ③ 锚点替换（全文替换后的文件里，锚点用「替换后」文本 —— 见 ANCHOR 定义；可续跑）
    for p, old, new, expect in ANCHOR:
        s = read(p)
        c = s.count(old)
        if c == 0:
            assert new in s, '%s 锚点消失且新文本不在，异常：%r' % (p, old[:50])
            print('   · %s：锚点已替换过，跳过' % p)
            continue
        assert c == expect, '%s 锚点计数 %d != 预期 %d\n锚点=%r' % (p, c, expect, old[:60])
        s2 = s.replace(old, new)
        write_atomic(p, s2)
        n_full += c
        print('   ✓ %s：锚点 %d 处' % (p, c))

    # ④ node --check（js 文件）
    for p in FULL + ANCHOR:
        path = p[0]
        if path.endswith('.js'):
            r = subprocess.run([NODE, '--check', path], capture_output=True, text=True)
            assert r.returncode == 0, '%s node --check 失败：%s' % (path, r.stderr)
    print('④ node --check ×7 全过')

    # ⑤ 写后自检
    for p, expect in FULL:
        assert '爵位' not in read(p), p + ' 写后仍有「爵位」'
    # 全仓残留核查（活文件应为 0；史料/参考/patch/档案历史行除外）
    r = subprocess.run(['git', 'grep', '-l', '爵位', '--',
                        'js/', 'index.html', 'smoke-test.js', 'e2e-test.js',
                        'docs/设计规范.md', 'docs/v89125-建筑建造时间表.md',
                        'docs/数值系统数据字典.md', 'docs/需求台账-v9012-13.md'],
                       capture_output=True, text=True)
    hits = [l for l in r.stdout.splitlines() if l.strip()]
    # 台账历史段允许保留（v90.87b 行等），数据字典参考区允许保留
    print('⑤ 写后自检：活文件残留 = %s' % (hits if hits else '无 ✅'))
    print('done: 共替换 %d 处' % n_full)

if __name__ == '__main__':
    main()
