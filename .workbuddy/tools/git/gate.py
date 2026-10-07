# -*- coding: utf-8 -*-
"""三件套门禁 —— 提交前跑 audit / smoke / e2e，红了就不许提交。

**唯一出口**：pre-commit 钩子与 git/sync.py 都调本文件，判据只此一份。

分级判据（实测耗时：audit 2.0s · smoke 2.3s · e2e 42.3s，全量 46.5s）：
  index.html 或 js/** 变动 → 三件套全跑（代码改了才跑重活）
  其余（docs / tools / assets）→ 只跑 audit（结构与 js 有关，2 秒兜底）

用法：
  python gate.py                # 自动判断改动范围
  python gate.py --full         # 强制三件套全跑
  python gate.py --staged       # 只看已暂存的文件（pre-commit 用）
  python gate.py --files a b c  # 指定改动清单（测试用）

退出码：0 通过 / 1 门禁不通 / 2 环境错误
"""
import io
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# gate.py 在 .workbuddy/tools/git/ → 上溯 4 层得 E:\Deepseekdb

NODE_CANDIDATES = [
    r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe',
]
NODE_PATH_CANDIDATES = [
    r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules',
]

# 改了这些才值得跑 smoke / e2e（它们测的是游戏本身）
CODE_PATHS = ('index.html', 'js/')

TESTS = [
    ('audit.js',      '结构审计', True),
    ('smoke-test.js', '逻辑断言', False),
    ('e2e-test.js',   '真实 DOM', False),
]

# v89.136（老板「盘点器进入 gate」）：数据表卫生四查（跨文件写 / 重复定义 / 孤儿 / 悬空）。
# 秒级成本 → 与 audit 同属"轻量级"：未触及代码时也跑（结构漂移越早抓越便宜）。
TABLES = ('.workbuddy/tools/audit/audit_v89134_tables.js', '数据表卫生', True)

# v89.179c（老板第 1 条 `data-scope` 丢失的同类病）：`el.dataset.X` 读取必须有对应的
# `data-X` 发射（静态模板或运行时赋值）。这类 bug **不报错、只是行为悄悄变错**，
# 所以放进 gate 常跑（只读源码，~1 秒）。
DATASET = ('.workbuddy/tools/audit/audit_v89179c_dataset_refs.js', 'dataset 引用', True)

# v89.230（兵种链路批）：兵种链体检 —— 一个兵种从数据表链到六组节点（形态/图标三链/解锁/
# 被引表/派生出口/退役残留）。**唯一实现**（smoke §230② 也调它）；gate 里直跑一遍更早报红。
TROOPCHAIN = ('.workbuddy/tools/audit/audit_v89229b_troopchain.js', '兵种链体检', True)


def _find_node():
    for p in NODE_CANDIDATES:
        if os.path.isfile(p):
            return p
    import shutil
    return shutil.which('node')


def _find_node_path():
    for p in NODE_PATH_CANDIDATES:
        if os.path.isdir(p):
            return p
    return os.environ.get('NODE_PATH', '')


def _git(args):
    r = subprocess.run(['git', '-C', ROOT] + args, capture_output=True)
    return r.returncode, r.stdout.decode('utf-8', 'replace')


def changed_files(staged_only=False):
    """改动清单。staged_only 时只看已暂存（pre-commit 场景）。"""
    if staged_only:
        _, out = _git(['diff', '--cached', '--name-only'])
    else:
        _, out = _git(['status', '--porcelain'])
        files = []
        for line in out.splitlines():
            if len(line) > 3:
                f = line[3:].strip()
                if ' -> ' in f:          # 重命名：取新名
                    f = f.split(' -> ', 1)[1]
                files.append(f.strip('"'))
        return [f for f in files if f]
    return [l.strip() for l in out.splitlines() if l.strip()]


def needs_full(files):
    for f in files:
        n = f.replace('\\', '/')
        for pre in CODE_PATHS:
            if n == pre or n.startswith(pre):
                return True
    return False


def _dump_fail(script, out, err):
    """v89.192：失败时把**全量输出**落盘（原先只留尾部 400 字符 —— 一次 flaky 后
    红名无从查证，只能盲重跑）。路径：.workbuddy/tmp/gate_fail_<script>.log。"""
    try:
        d = os.path.join(ROOT, '.workbuddy', 'tmp')
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'gate_fail_' + os.path.basename(script) + '.log')
        with io.open(p, 'w', encoding='utf-8') as f:
            f.write('=== stdout ===\n' + out + '\n=== stderr ===\n' + err)
    except Exception:
        pass


def run_one(node, node_path, script, label):
    """跑一个测试，返回 (ok, 摘要行, 详情)。必须连「是否中断」一起看 —— 项目铁律。"""
    env = dict(os.environ)
    if node_path:
        env['NODE_PATH'] = node_path
    try:
        r = subprocess.run([node, script], cwd=ROOT, capture_output=True, env=env, timeout=600)
    except subprocess.TimeoutExpired:
        return False, f'{script} 超时 600 秒', ''

    out = r.stdout.decode('utf-8', 'replace')
    err = r.stderr.decode('utf-8', 'replace')
    tail = (out[-400:] + err[-200:]).strip()

    # 兵种链体检（v89.230 进 gate）：先于通用退出码判 —— 它的红是"体检项不达标"，
    # 不是异常中断（通用分支会把退出码 1 误报成"异常中断"）。
    # ⚠ 判据必须**按脚本名限定**：smoke 的输出里也含"兵种链体检"字样（§230② 的标题），
    #   若只按输出串判，smoke 的红会被错误地走这条分支。
    if os.path.basename(script) == 'audit_v89229b_troopchain.js':
        m = re.search(r'错误\s*(\d+)\s*条', out)
        if r.returncode == 0 and m and int(m.group(1)) == 0:
            return True, f'{script} 兵种链错误 0（14 兵种 × 依赖/被引）', tail
        _dump_fail(script, out, err)
        return False, f'{script} 兵种链有错误（退出码 {r.returncode}，详见输出尾部）', tail

    if r.returncode != 0:
        _dump_fail(script, out, err)
        return False, f'{script} 退出码 {r.returncode}（异常中断）', tail

    # ① 显式失败数
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    if m:
        ok_n, fail_n = int(m.group(1)), int(m.group(2))
        if fail_n > 0:
            _dump_fail(script, out, err)
            return False, f'{script} {ok_n} 通过 / {fail_n} 失败', tail
        # ② 分母为 0 的绿 = 什么都没测
        if ok_n == 0:
            return False, f'{script} 0 通过 —— 什么都没测，不算绿', tail
        return True, f'{script} {ok_n} 通过 / 0 失败', tail

    # 数据表卫生盘点器（v89.136 进 gate）：四查全过 = 绿；需处理 = 红。
    # （退出码已由盘点器给出：全过 0 / 需处理 1 —— 上面 returncode 分支先兜底）
    if '卫生四查全过' in out:
        return True, f'{script} 四查全过（跨文件写/重复定义/孤儿/悬空）', tail
    if '需处理' in out:
        return False, f'{script} 四查未过（详见输出尾部）', tail

    # audit.js 无「结果：」行，用它的汇总特征
    if '死函数' in out and '孤儿按钮' in out:
        bad = re.search(r'死函数\s*(\d+)\s*·\s*孤儿按钮\s*(\d+)\s*·\s*重复定义\s*(\d+)\s*·\s*零引用字段\s*(\d+)', out)
        if bad:
            nums = [int(x) for x in bad.groups()]
            if sum(nums) == 0:
                return True, f'{script} 死函数/孤儿/重复/零引用 全 0', tail
            return False, f'{script} 四项计数 {nums} 非全 0', tail
        return False, f'{script} 找不到汇总行（判据失效）', tail

    # ③ 有失败迹象
    if '失败' in out and '0 失败' not in out:
        return False, f'{script} 输出含「失败」但无标准汇总行', tail
    return False, f'{script} 输出无标准汇总行（判据失效，按不通处理）', tail


def main():
    args = sys.argv[1:]
    full = '--full' in args
    staged = '--staged' in args
    quiet = '--quiet' in args

    if '--files' in args:
        i = args.index('--files')
        files = [a for a in args[i + 1:] if not a.startswith('--')]
    else:
        files = changed_files(staged_only=staged)

    node = _find_node()
    if not node:
        print('✗ 门禁环境错误：找不到 node', file=sys.stderr)
        return 2
    node_path = _find_node_path()

    if full:
        plan = list(TESTS) + [TABLES, DATASET, TROOPCHAIN]
        why = '--full 强制三件套 + 数据表卫生全跑'
    elif needs_full(files):
        plan = list(TESTS) + [TABLES, DATASET, TROOPCHAIN]
        why = '改动了代码（index.html 或 js/**）→ 三件套 + 数据表卫生全跑'
    else:
        plan = [TESTS[0], TABLES, DATASET, TROOPCHAIN]
        why = '未触及代码 → 只跑 audit + 数据表卫生 + dataset 引用（各 1~2 秒兜底）'

    print(f'━━ 三件套门禁 ━━ {why}')
    if files:
        print(f'   改动 {len(files)} 个文件')
    print()

    failed = []
    for script, label, _ in plan:
        ok, summary, detail = run_one(node, node_path, script, label)
        print(('  ✅ ' if ok else '  ❌ ') + summary)
        if not ok:
            failed.append((script, summary, detail))

    print()
    if failed:
        print('✗ 门禁不通 —— 提交已被拦下。')
        for script, summary, detail in failed:
            print(f'\n--- {script} 尾部输出 ---\n{detail}')
        print('\n确需跳过（不推荐）：SKIP_GATE=1 git commit ...')
        return 1

    print('✓ 门禁通过。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
