"""v156.26b：给 gate.py 接上 `--update-baseline`（人工显式更新基线）。

两种用法：
    python .workbuddy/tools/git/gate.py --update-baseline
        真跑 smoke，把当前失败写进基线（约 8 分钟）
    python .workbuddy/tools/git/gate.py --update-baseline --from-out .workbuddy/tmp_smoke_n.out
        读已有输出建基线（0 秒）—— 本次就用这个，避免为建基线再等一轮

⚠️ 基线只能在"确认这些红跟本次改动无关"时更新。它是判据的一部分，
   不是"把红刷绿"的开关 —— 更新时脚本会把每一条打印出来，请逐条看过。
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
GATE = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')

src = io.open(GATE, encoding='utf-8').read()
if 'do_update_baseline' in src:
    print('SKIP: 已打过补丁')
    sys.exit(0)

anchor = "def main():"
if anchor not in src:
    print('ANCHOR main NOT FOUND')
    sys.exit(1)

fn = '''def do_update_baseline(node, node_path, from_out, script_name):
    """把某脚本的当前失败写进基线（人工显式调用）。"""
    out = None
    if from_out:
        with io.open(from_out, encoding='utf-8', errors='replace') as f:
            out = f.read()
        print(f'   读数来源：{from_out}（未重跑）')
    else:
        env = dict(os.environ)
        if node_path:
            env['NODE_PATH'] = node_path
        print(f'   正在跑 {script_name} …（约 8 分钟）')
        r = subprocess.run([node, script_name], cwd=ROOT, capture_output=True,
                           env=env, timeout=_gate_timeout())
        out = r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')

    m = re.search(r'结果：\\s*(\\d+)\\s*通过\\s*/\\s*(\\d+)\\s*失败', out)
    if not m:
        print('✗ 输出里没有「结果：N 通过 / M 失败」，无法建基线')
        return 2
    ok_n, fail_n = int(m.group(1)), int(m.group(2))
    titles = parse_fail_titles(out)

    b = load_baseline()
    ent = {}
    for t in titles:
        ent[t] = ent.get(t, 0) + 1
    key = _script_key(script_name)
    if ent:
        b.setdefault('entries', {})[key] = ent
    else:
        b.setdefault('entries', {}).pop(key, None)
    b['note'] = ('已知失败基线 —— 门禁只报「不在此表」的新增失败。'
                 '更新方式：gate.py --update-baseline（请逐条确认与本次改动无关）')
    save_baseline(b)

    print(f'\\n   {script_name}: {ok_n} 通过 / {fail_n} 失败')
    if ent:
        print(f'   入基线 {len(ent)} 条：')
        for t, c in sorted(ent.items()):
            print(f'     · {t}' + ('' if c == 1 else f'  ×{c}'))
    else:
        print('   本次无失败 —— 该脚本的基线已清空')
    print(f'\\n   已写入 {BASELINE}')
    return 0


'''

src = src.replace(anchor, fn + anchor, 1)

old_head = """def main():
    args = sys.argv[1:]
    full = '--full' in args
    staged = '--staged' in args
    quiet = '--quiet' in args
"""
new_head = """def main():
    args = sys.argv[1:]
    full = '--full' in args
    staged = '--staged' in args
    quiet = '--quiet' in args

    # v156.26b：基线更新是**独立路径**，不进常规门禁流程
    if '--update-baseline' in args:
        from_out = None
        if '--from-out' in args:
            _i = args.index('--from-out')
            if _i + 1 < len(args):
                from_out = args[_i + 1]
        _sn = 'smoke-test.js'
        if '--script' in args:
            _j = args.index('--script')
            if _j + 1 < len(args):
                _sn = args[_j + 1]
        if '--files' in args:          # 避免 --files 把 --from-out 的值当文件名
            pass
        _node = _find_node()
        if not _node:
            print('✗ 找不到 node', file=sys.stderr)
            return 2
        print('━━ 更新已知失败基线 ━━')
        return do_update_baseline(_node, _find_node_path(), from_out, _sn)
"""
if old_head not in src:
    print('ANCHOR main-head NOT FOUND')
    sys.exit(1)
src = src.replace(old_head, new_head, 1)

io.open(GATE, 'w', encoding='utf-8', newline='\n').write(src)
print('gate.py: --update-baseline 已接上')
