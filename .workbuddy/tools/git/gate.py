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

    if r.returncode != 0:
        return False, f'{script} 退出码 {r.returncode}（异常中断）', tail

    # ① 显式失败数
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    if m:
        ok_n, fail_n = int(m.group(1)), int(m.group(2))
        if fail_n > 0:
            return False, f'{script} {ok_n} 通过 / {fail_n} 失败', tail
        # ② 分母为 0 的绿 = 什么都没测
        if ok_n == 0:
            return False, f'{script} 0 通过 —— 什么都没测，不算绿', tail
        return True, f'{script} {ok_n} 通过 / 0 失败', tail

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
        plan = list(TESTS)
        why = '--full 强制三件套全跑'
    elif needs_full(files):
        plan = list(TESTS)
        why = '改动了代码（index.html 或 js/**）→ 三件套全跑'
    else:
        plan = [TESTS[0]]
        why = '未触及代码 → 只跑 audit（2 秒兜底）'

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
