# -*- coding: utf-8 -*-
"""收尾一键同步 —— 汇总改动 → 过门禁 → 提交 → 推送到 GitHub。

**默认干跑**（只打印将提交什么 / 将推送什么，不落盘）；加 --apply 才真做。
这是本仓「收尾」的**唯一入口**：pre-commit 门禁、post-commit 自动推送都围着它转。

用法
    python sync.py                      # 干跑，先看
    python sync.py --apply              # 真做：门禁 → 提交 → 推送
    python sync.py --apply --tag v68    # 顺带打版本标签
    python sync.py --push-only          # 不提交，只把已有提交推上去
    python sync.py --apply -m "消息"     # 自定义提交信息

选项
    --apply        真正落盘（不加就是干跑）
    --no-gate      跳过三件套门禁（不推荐）
    --full-gate    强制三件套全量（默认按改动范围分级）
    --no-push      只提交，不推送
    -m MSG         自定义提交信息
    --tag NAME     额外打一个注释标签并推送
    --push-only    只推送
    --snapshot     提交信息标为「[每日快照] 日期」（定时任务用）

安全约定
    · 绝不 force push；绝不改远端历史
    · detached HEAD / 合并或变基残留 / 无远端 —— 一律拒绝执行
    · 工作区干净时不造空提交（除非 --push-only 或 --tag）
    · 收尾打印「做了什么」，便于中断后判断进度
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))   # E:\Deepseekdb
GATE = os.path.join(HERE, 'gate.py')
PY = sys.executable

# 改动分区：识别顺序即优先级（先匹配到的算这一类）
AREAS = [
    ('代码',   ('js/',)),
    ('页面',   ('index.html',)),
    ('测试',   ('smoke-test.js', 'e2e-test.js', 'audit.js')),
    ('工具',   ('.workbuddy/tools/',)),
    ('截图',   ('.workbuddy/shots/',)),
    ('素材',   ('assets/',)),
    ('文档',   ('docs/', 'DESIGN.md', '需求档案.md')),
]


def sh(args, cwd=ROOT, env=None, timeout=300):
    """跑命令，返回 (returncode, stdout, stderr)。"""
    try:
        r = subprocess.run(args, cwd=cwd, capture_output=True, timeout=timeout, env=env)
    except FileNotFoundError as e:
        return 127, '', str(e)
    except subprocess.TimeoutExpired:
        return 124, '', 'timeout'
    return (r.returncode,
            r.stdout.decode('utf-8', 'replace'),
            r.stderr.decode('utf-8', 'replace'))


def git(*args, **kw):
    return sh(['git'] + list(args), **kw)


def area_of(path):
    n = path.replace('\\', '/')
    for name, prefixes in AREAS:
        for pre in prefixes:
            if n == pre or n.startswith(pre):
                return name
    return '其他'


def collect_changes():
    """返回 (已暂存, 未暂存清单)。-uall 让新目录里的文件逐个列出，不被折叠成一行。"""
    staged = [l.strip().strip('"') for l in git('diff', '--cached', '--name-only')[1].splitlines() if l.strip()]
    rc, out, _ = git('status', '--porcelain', '-uall')
    work = []
    for line in out.splitlines():
        if len(line) > 3:
            f = line[3:].strip().strip('"')
            if ' -> ' in f:
                f = f.split(' -> ', 1)[1].strip().strip('"')
            if f:
                work.append((line[:2], f))
    return staged, work


def build_message(files, applied_plan):
    """按分区自动生成提交信息。"""
    groups = {}
    for f in files:
        groups.setdefault(area_of(f), []).append(f)

    order = [n for n, _ in AREAS] + ['其他']
    parts = [f'{k} {len(groups[k])}' for k in order if k in groups]
    subject = '收尾：' + ' · '.join(parts) if parts else '收尾：无改动'

    body = []
    for k in order:
        if k not in groups:
            continue
        fs = sorted(groups[k])
        body.append(f'【{k}】{len(fs)} 个')
        for f in fs[:12]:
            body.append(f'  {f}')
        if len(fs) > 12:
            body.append(f'  …另有 {len(fs)-12} 个')
        body.append('')

    if applied_plan:
        body.append('门禁：' + applied_plan)

    return subject, '\n'.join(body).rstrip()


def preflight():
    """执行前自检。返回 (ok, 说明列表)。"""
    notes = []
    ok = True

    rc, out, _ = git('rev-parse', '--is-inside-work-tree')
    if rc != 0 or out.strip() != 'true':
        return False, ['✗ 当前不在 git 仓库内']

    rc, out, _ = git('symbolic-ref', '--short', 'HEAD')
    if rc != 0:
        notes.append('✗ HEAD 处于游离状态（detached）—— 拒绝执行，先 git switch 回分支')
        ok = False
    else:
        notes.append(f'✓ 分支 {out.strip()}')

    gitdir = git('rev-parse', '--git-dir')[1].strip() or '.git'
    gd = gitdir if os.path.isabs(gitdir) else os.path.join(ROOT, gitdir)
    for marker, label in (('MERGE_HEAD', '合并'), ('rebase-merge', '变基'), ('rebase-apply', '变基')):
        if os.path.exists(os.path.join(gd, marker)):
            notes.append(f'✗ 检测到{label}残留（{marker}）—— 拒绝执行，先收尾再同步')
            ok = False

    rc, out, _ = git('remote', 'get-url', 'origin')
    if rc != 0 or not out.strip():
        notes.append('✗ 未配置远端 origin')
        ok = False
    else:
        notes.append(f'✓ 远端 {out.strip()}')

    rc, out, _ = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
    notes.append(f'✓ upstream {out.strip()}' if rc == 0 else '· 尚无 upstream（首次推送会自动建立）')

    return ok, notes


def main():
    args = sys.argv[1:]
    apply = '--apply' in args
    no_gate = '--no-gate' in args
    full_gate = '--full-gate' in args
    no_push = '--no-push' in args
    push_only = '--push-only' in args
    tag = None
    if '--tag' in args:
        i = args.index('--tag')
        tag = args[i + 1] if i + 1 < len(args) else None
        if not tag or tag.startswith('--'):
            print('✗ --tag 后面要跟标签名，例如 --tag v68')
            return 2
    msg = None
    if '-m' in args:
        i = args.index('-m')
        msg = args[i + 1] if i + 1 < len(args) else None

    snapshot = '--snapshot' in args

    mode = '【执行】' if apply else '【干跑】'
    print(f'{mode} 收尾同步 · {ROOT}')
    print('─' * 52)

    ok, notes = preflight()
    for n in notes:
        print('  ' + n)
    if not ok:
        print('\n✗ 前置条件不满足，已中止（未做任何改动）。')
        return 2
    print()

    staged, work = collect_changes()
    pending = sorted({f for _, f in work} | set(staged))

    if not push_only:
        # ---------- 1. 改动盘点 ----------
        print(f'① 改动盘点：{len(pending)} 个文件待提交')
        if pending:
            groups = {}
            for f in pending:
                groups.setdefault(area_of(f), []).append(f)
            for k in [n for n, _ in AREAS] + ['其他']:
                if k in groups:
                    print(f'     {k:<4} {len(groups[k]):>3} 个')
        else:
            print('     （工作区干净，没有需要提交的改动）')
        print()

        # ---------- 2. 门禁 ----------
        gate_note = '未跑'
        if pending and not no_gate:
            cmd = [PY, GATE] + (['--full'] if full_gate else [])
            print('② 三件套门禁')
            sys.stdout.flush()          # 否则门禁的输出会插到表头前面
            g = subprocess.run(cmd, cwd=ROOT)
            if g.returncode != 0:
                print('\n✗ 门禁不通 —— 已中止，未提交。')
                print('  想强行绕过（不推荐）：python sync.py --apply --no-gate')
                return 1
            gate_note = '三件套全量通过' if full_gate else '三件套分级通过'
            print()
        else:
            print('② 三件套门禁：' + ('已跳过（--no-gate）' if no_gate else '无改动，跳过'))
            gate_note = '已跳过' if no_gate else '无改动'
            print()

    # ---------- 3. 提交信息 ----------
    subject, body = build_message(pending, gate_note)
    if snapshot and not msg:
        import datetime
        stamp = datetime.datetime.now().strftime('%Y-%m-%d')
        subject = f'[每日快照] {stamp} · ' + subject.replace('收尾：', '', 1)
        body = '本条由每日定时任务自动生成（可在 git/sync.py 的 --snapshot 处追溯）。\n\n' + body
    print('③ 提交信息')
    print('   ' + (msg if msg else subject))
    if not msg and body:
        for line in body.splitlines()[:8]:
            print('   │ ' + line)
        if len(body.splitlines()) > 8:
            print(f'   │ …（正文共 {len(body.splitlines())} 行）')
    print()

    if not apply:
        print('④ 干跑到此为止 —— 以上命令**均未执行**。')
        print('   确认无误后加 --apply 真做：')
        print(f'     python {os.path.relpath(os.path.abspath(__file__), ROOT).replace(os.sep, "/")} --apply' + (f' --tag {tag}' if tag else ''))
        return 0

    # ---------- 4. 执行 ----------
    # 置两个环境变量给后续所有子进程（含 pre-commit / post-commit 钩子）：
    #   GIT_GATE_PASSED=1 —— 门禁已由本脚本跑过，钩子别再跑一遍（否则 47 秒白等两次）
    #   GIT_SYNC_ACTIVE=1 —— 推送由本脚本负责，post-commit 钩子让位，避免重复推
    # --no-gate 时同样置位：那是老板明确要求本次不设门禁，语义一致。
    os.environ['GIT_GATE_PASSED'] = '1'
    os.environ['GIT_SYNC_ACTIVE'] = '1'

    done = []
    try:
        if not push_only:
            if pending:
                rc, _, err = git('add', '-A')
                if rc != 0:
                    print(f'✗ git add 失败：{err.strip()}')
                    return 1
                if msg:
                    rc, _, err = git('commit', '-m', msg)
                else:
                    rc, _, err = git('commit', '-m', subject, '-m', body)
                if rc != 0:
                    print(f'✗ git commit 失败：{err.strip() or "(无输出)"}')
                    return 1
                sha = git('rev-parse', '--short', 'HEAD')[1].strip()
                print(f'④ 已提交 {sha}')
                done.append(f'提交 {sha}（{len(pending)} 个文件）')
            else:
                print('④ 无改动，未提交')

            if tag:
                rc, _, err = git('tag', '-a', tag, '-m', f'{tag} 收尾同步')
                if rc != 0:
                    print(f'✗ 打标签失败：{err.strip()}')
                    return 1
                print(f'   已打标签 {tag}')
                done.append(f'标签 {tag}')

        # ---------- 5. 推送 ----------
        if no_push:
            print('⑤ 推送：已跳过（--no-push）')
            done.append('未推送（--no-push）')
        else:
            env = dict(os.environ)
            env['GIT_SYNC_ACTIVE'] = '1'      # 让 post-commit 钩子让位，避免重复推
            rc, out, err = git('push', 'origin', 'HEAD', '--follow-tags', env=env, timeout=600)
            if rc != 0:
                print(f'✗ 推送失败：{err.strip() or out.strip()}')
                done.append('推送失败')
                return 1
            print('⑤ 已推送到 origin')
            for line in (err + out).splitlines():
                if line.strip() and ('->' in line or 'new' in line.lower()):
                    print('   ' + line.strip())
            done.append('已推送 origin')
    finally:
        print()
        print('─' * 52)
        print('本次做了什么：')
        for d in done:
            print('  · ' + d)
        if not done:
            print('  · 无')
    return 0


if __name__ == '__main__':
    sys.exit(main())
