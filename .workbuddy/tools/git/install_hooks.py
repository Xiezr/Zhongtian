# -*- coding: utf-8 -*-
"""安装 / 卸载 / 检查本仓的两个 git 钩子。

为什么需要安装器：`.git/hooks/` **不被 git 跟踪**，换台机器克隆下来钩子就没了。
所以钩子本体存在 `.workbuddy/tools/git/hooks/`（进版本库），用本脚本装到位。

用法
    python install_hooks.py            # 安装（幂等，可反复跑）
    python install_hooks.py --check    # 只看状态，不改动
    python install_hooks.py --uninstall

安全约定
    · 只动带 Deepseekdb-managed-hook 标记的文件；
      遇到**别人装的**同名钩子一律不覆盖，直接报错退出（保护已有配置）
    · 一律以 LF 写入 —— 钩子行尾若是 CRLF，`#!/bin/sh` 会挂
    · 幂等：内容一致就不重写，只报告
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(HERE, 'hooks')
DEST = os.path.join(ROOT, '.git', 'hooks')
MARKER = 'Deepseekdb-managed-hook v1'
HOOKS = ['pre-commit', 'post-commit']


def read_lf(p):
    """读文本并强制 LF —— 钩子行尾必须是 LF。"""
    with open(p, 'rb') as f:
        return f.read().replace(b'\r\n', b'\n').replace(b'\r', b'\n')


def status_of(name):
    """返回 'missing' | 'foreign' | 'current' | 'stale'。"""
    dst = os.path.join(DEST, name)
    if not os.path.exists(dst):
        return 'missing'
    body = read_lf(dst).decode('utf-8', 'replace')
    if MARKER not in body:
        return 'foreign'
    src = os.path.join(SRC, name)
    if os.path.exists(src) and read_lf(src) == read_lf(dst):
        return 'current'
    return 'stale'


def main():
    do_uninstall = '--uninstall' in sys.argv
    check_only = '--check' in sys.argv

    if not os.path.isdir(os.path.join(ROOT, '.git')):
        print('✗ 找不到 .git —— 这里不是 git 仓库根目录')
        return 2
    os.makedirs(DEST, exist_ok=True)

    st = {h: status_of(h) for h in HOOKS}

    if check_only:
        print(f'钩子状态（{DEST}）：')
        label = {'missing': '未安装', 'foreign': '⚠ 是别人装的（不归我们管）',
                 'current': '已安装且是最新', 'stale': '已安装但内容落后'}
        for h in HOOKS:
            print(f'  {h:<12} {label[st[h]]}')
        return 0

    if do_uninstall:
        removed = []
        for h in HOOKS:
            if st[h] in ('current', 'stale'):
                os.remove(os.path.join(DEST, h))
                removed.append(h)
            elif st[h] == 'foreign':
                print(f'  · {h} 是别人装的，未动')
        print('已卸载：' + ('、'.join(removed) if removed else '（本来就没装）'))
        return 0

    # ---------- 安装 ----------
    changed, skipped = [], []
    for h in HOOKS:
        if st[h] == 'foreign':
            print(f'✗ {DEST}\\{h} 已存在且不是本项目安装的 —— 拒绝覆盖。')
            print('  要接管请先自行备份并删除它，再重跑本脚本。')
            return 2
        if st[h] == 'current':
            skipped.append(h)
            continue
        src = os.path.join(SRC, h)
        if not os.path.exists(src):
            print(f'✗ 源文件缺失 {src}')
            return 2
        payload = read_lf(src)
        if MARKER.encode() not in payload:
            print(f'✗ 源文件 {h} 缺少标记行（{MARKER}）—— 拒绝安装，以免日后无法辨认归属')
            return 2
        dst = os.path.join(DEST, h)
        with open(dst, 'wb') as f:
            f.write(payload)
        try:
            os.chmod(dst, 0o755)
        except OSError:
            pass
        changed.append(h)

    print(f'钩子目录：{DEST}')
    for h in HOOKS:
        if h in changed:
            print(f'  ✅ 已安装 {h}')
        else:
            print(f'  ·  {h} 已是最新，未改动')
    print()
    print('本次做了什么：')
    print(f'  · 安装/更新 {len(changed)} 个钩子' + (f'（{"、".join(changed)}）' if changed else '（无变化）'))
    print(f'  · 跳过 {len(skipped)} 个已最新的钩子')
    print()
    print('生效后：')
    print('  · git commit 前自动跑三件套门禁（红了拦住）—— 跳过用 SKIP_GATE=1')
    print('  · git commit 后自动推送到 GitHub —— 关闭用 GIT_NO_AUTOPUSH=1')
    return 0


if __name__ == '__main__':
    sys.exit(main())
