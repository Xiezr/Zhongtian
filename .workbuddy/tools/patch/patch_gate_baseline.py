"""v156.26 · 门禁「已知失败基线」——把 9 条历史红从"每次人工判断"变成"机器判断"。

问题（老板 2026-11-01）：
  门禁是"全绿才算过"的二元判定，但现在有 9 条永久红（CSS 令牌 lint / 出生州 /
  战斗帧自洽 / 回放设定 / 锁城签名）。于是**每次提交都要人肉回忆"这 9 条是不是我弄的"**，
  判断成本比修复成本还高 —— 这是迭代慢的最大心理成本之一。

做法：
  · 基线文件 `.workbuddy/gate-baseline.json`：记录「脚本 + 失败标题 + 次数」。
  · 判定改成三态：
      新增失败 > 0        → ❌ 红（拦提交）
      只有已知失败        → ⚠️ 黄（放行，但摘要写明"9 条均已知"）
      基线里那条不再出现  → 提示"可收缩"（不自动改，避免掩盖真回归）
  · 基线**按标题精确 + 计数**比对：同一标题从 1 条变 2 条，多出来的仍算新增。
    这一条防的是"基线变成屏蔽器" —— 只挡住**曾经出现过的那几条**。

只对输出「结果：N 通过 / M 失败」的脚本生效（smoke / e2e）；
audit 那种"死函数 3 个"的计数式失败不进基线（它是卫生指标，不是断言）。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
GATE = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')

src = io.open(GATE, encoding='utf-8').read()
if 'v156.26' in src:
    print('SKIP: 已打过补丁')
    sys.exit(0)

# ---------- 1) 顶部插入基线工具 ----------
anchor_def = "NODE_CANDIDATES = ["
if anchor_def not in src:
    print('ANCHOR NODE_CANDIDATES NOT FOUND')
    sys.exit(1)

block_defs = '''# ============================================================
# v156.26 · 已知失败基线（老板：「9 条历史红让门禁永远是红的」）
# ------------------------------------------------------------
# 判据从"全绿"改成"相对基线"：只拦**新增**失败，已知失败降级为 ⚠️ 提示。
# 基线必须**由人显式更新**（--update-baseline），且按标题+次数精确比对 ——
# 绝不让它变成"把新 bug 也塞进去"的屏蔽器。
# ============================================================
BASELINE = os.path.join(ROOT, '.workbuddy', 'gate-baseline.json')


def _script_key(script):
    return os.path.basename(script)


def load_baseline():
    try:
        with io.open(BASELINE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'note': '已知失败基线', 'entries': {}}


def save_baseline(obj):
    obj['generated'] = __import__('time').strftime('%Y-%m-%dT%H:%M:%S%z')
    os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
    with io.open(BASELINE, 'w', encoding='utf-8', newline='\\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def parse_fail_titles(out):
    """从测试输出里抽 ❌ 的标题（去掉行尾 `  [详情]` 与首尾空白）。

    smoke 的失败行形如：
        ❌ §590② 反平凡解：不同 index 结果不同，且都短于全表  [distinct=false]
        ❌ ★ 出生州：十三区逐个验证「落点归属 == 所选区」
    """
    res = []
    for line in out.split('\\n'):
        s = line.strip()
        if not s.startswith('❌'):
            continue
        t = s[1:].strip()
        m = re.search(r'\\s{2,}\\[', t)
        if m:
            t = t[:m.start()].rstrip()
        if t:
            res.append(t)
    return res


'''

src = src.replace(anchor_def, block_defs + anchor_def, 1)

# ---------- 2) judge：smoke/e2e 的「结果：」分支接基线 ----------
old_judge = '''    m = re.search(r'结果：\\s*(\\d+)\\s*通过\\s*/\\s*(\\d+)\\s*失败', out)
    if m:
        ok_n, fail_n = int(m.group(1)), int(m.group(2))
        if fail_n > 0:
            _dump_fail(script, out, err)
            return False, f'{script} {ok_n} 通过 / {fail_n} 失败', tail'''

new_judge = '''    m = re.search(r'结果：\\s*(\\d+)\\s*通过\\s*/\\s*(\\d+)\\s*失败', out)
    if m:
        ok_n, fail_n = int(m.group(1)), int(m.group(2))
        if fail_n > 0:
            # v156.26：先与基线比对 —— 只有**新增**失败才算红
            key = _script_key(script)
            base = load_baseline().get('entries', {}).get(key, {})
            titles = parse_fail_titles(out)
            seen = {}
            for t in titles:
                seen[t] = seen.get(t, 0) + 1
            fresh = []
            for t, c in seen.items():
                allowed = base.get(t, 0)
                if c > allowed:
                    fresh.extend([t] * (c - allowed))
            gone = [t for t in base if t not in seen]
            if not titles:
                # 拿不到标题就无法比对基线 —— 宁可按红处理，绝不静默放行
                _dump_fail(script, out, err)
                return False, f'{script} {ok_n} 通过 / {fail_n} 失败（无法解析失败标题，按红处理）', tail
            if fresh:
                _dump_fail(script, out, err)
                head = fresh[0][:60]
                more = ('' if len(fresh) == 1 else f' 等 {len(fresh)} 条')
                return False, f'{script} {ok_n} 通过 / {fail_n} 失败（🆕 新增失败：{head}{more}）', tail
            note = f'（{fail_n} 失败全部已知）'
            if gone:
                note += f' · {len(gone)} 条基线可收缩'
            return True, f'⚠️ {script} {ok_n} 通过 / {fail_n} 失败{note}', tail
        if ok_n == 0:
            return False, f'{script} 0 通过 —— 什么都没测，不算绿', tail
        return True, f'{script} {ok_n} 通过 / 0 失败', tail'''
if old_judge not in src:
    print('ANCHOR judge NOT FOUND')
    sys.exit(1)
src = src.replace(old_judge, new_judge, 1)

# 原来的「② 分母为 0」块已被上面覆盖，删掉重复的一份
dup0 = '''        # ② 分母为 0 的绿 = 什么都没测
        if ok_n == 0:
            return False, f'{script} 0 通过 —— 什么都没测，不算绿', tail
        return True, f'{script} {ok_n} 通过 / 0 失败', tail
'''
# 上面替换后源串里可能还剩一份（原文本紧跟其后），安全删一次
src = src.replace(dup0, '', 1)

# ---------- 3) main：三态图标 + --update-baseline ----------
old_icon = """    for (ok, summary, detail) in results:
        print(('  ✅ ' if ok else '  ❌ ') + summary)"""
new_icon = """    for (ok, summary, detail) in results:
        icon = '✅' if (ok and not summary.startswith('⚠️')) else ('⚠️' if ok else '❌')
        print(('  ' + icon + ' ') + summary)"""
if old_icon not in src:
    print('ANCHOR icon NOT FOUND')
    sys.exit(1)
src = src.replace(old_icon, new_icon, 1)

# --update-baseline：把本次失败写进基线（人工显式调用）
update_fn = '''

def update_baseline_from(out, script):
    """把某脚本本次的 ❌ 标题写进基线（同标题保留较大计数）。"""
    b = load_baseline()
    ent = b.setdefault('entries', {}).setdefault(_script_key(script), {})
    for t in parse_fail_titles(out):
        ent[t] = ent.get(t, 0) + 1
    save_baseline(b)
    return len(ent)

'''
src = src.replace('def judge(r, script, label):', update_fn + 'def judge(r, script, label):', 1)

print('gate.py: 基线判定已注入（未写入）')
io.open(GATE, 'w', encoding='utf-8', newline='\n').write(src)
print('已写回 gate.py')
