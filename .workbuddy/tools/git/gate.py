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
import hashlib
import json, os, re, subprocess, sys

# v91.36：Windows 控制台默认 GBK，print 里的 ✅/✗ 等字符会 UnicodeEncodeError 让钩子**崩在最后一步**
# （提交其实已落库，但退出码非 0 + 报错刷屏，看着像失败）。统一把 stdout/stderr 拉成 UTF-8。
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# gate.py 在 .workbuddy/tools/git/ → 上溯 4 层得 E:\Deepseekdb

# ============================================================
# v156.26 · 已知失败基线（老板：「9 条历史红让门禁永远是红的」）
# ------------------------------------------------------------
# 判据从"全绿"改成"相对基线"：只拦**新增**失败，已知失败降级为 ⚠️ 提示。
# 基线必须**由人显式更新**（--update-baseline），且按标题+次数精确比对 ——
# 绝不让它变成"把新 bug 也塞进去"的屏蔽器。
# ============================================================
BASELINE = os.path.join(ROOT, '.workbuddy', 'gate-baseline.json')
# v156.39：--strict 时置 True —— 忽略基线、忽略抖动放行（见 main()）
STRICT = False


def _script_key(script):
    return os.path.basename(script)


def _sig_of(rel):
    """v157.28：给 census 记录绑定版本（smoke-test.js 的 md5 前 12 位）。

    来历：2026-11-10 门禁被 Q3「分片漏跑 3 条」锁死 —— 全量基线 11-08、分片 11-09、
    当前源码 11-10，三份分母来自三个版本，"缺 3 条"是版本差异。
    没有版本签名的集合比对，等于用旧尺子量新代码。"""
    try:
        h = hashlib.md5()
        with io.open(os.path.join(ROOT, rel), 'rb') as f:
            h.update(f.read())
        return h.hexdigest()[:12]
    except Exception:
        return ''


def load_baseline():
    try:
        with io.open(BASELINE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'note': '已知失败基线', 'entries': {}}


def save_baseline(obj):
    obj['generated'] = __import__('time').strftime('%Y-%m-%dT%H:%M:%S%z')
    os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
    with io.open(BASELINE, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def parse_fail_titles(out):
    """从测试输出里抽 ❌ 的标题（去掉行尾 `  [详情]` 与首尾空白）。

    smoke 的失败行形如：
        ❌ §590② 反平凡解：不同 index 结果不同，且都短于全表  [distinct=false]
        ❌ ★ 出生州：十三区逐个验证「落点归属 == 所选区」
    """
    res = []
    for line in out.split('\n'):
        s = line.strip()
        if not s.startswith('❌'):
            continue
        t = s[1:].strip()
        m = re.search(r'\s{2,}\[', t)
        if m:
            t = t[:m.start()].rstrip()
        if t:
            res.append(t)
    return res


NODE_CANDIDATES = [
    r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe',
]
NODE_PATH_CANDIDATES = [
    r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules',
]

# 改了这些才值得跑 smoke / e2e（它们测的是游戏本身）
CODE_PATHS = ('index.html', 'js/')
# ============================================================
# v156.40：**改了测试本体，凭什么不跑测试？**
# ------------------------------------------------------------
# 原来只有 index.html / js/** 变动才算"改代码"，于是改 smoke-test.js
# （加 skip 语义、改判据、动分档逻辑）会走"未触及代码 → 只跑 audit"分支 ——
# 测试改了却不跑测试，这是 gate 自己的盲区。
# 这几个文件一律触发全量：测试本体 + 它们依赖的门禁/工具。
# ============================================================
TEST_PATHS = ('smoke-test.js', 'e2e-test.js', 'audit.js',
              'chain-audit.js', 'invariants-test.js', '.workbuddy/tools/git/gate.py')

TESTS = [
    ('audit.js',       '结构审计', True),
    # v91.84（老板「把行为链每一个选项走到头」）：状态推进式链路走查 ——
    # 从派队一路推到落账（奇观六层×五行动 / 自动探索 / 自动出征 / 自动研究 / 战力），
    # 专抓"单点都对、串起来断"的链式缺陷（2.1 秒）。
    ('chain-audit.js', '链路走查', False),
    # v142.3（「smoke 只覆盖人想到的输入」）：守恒律**属性测试** —— 种子随机打五类不变式
    # （战斗兵力不增/账实相符 · 资源加减/take 原子/封顶不削存量 · 背包下界恒 0 ·
    # 战舰扣费精确/属性单调 · 策略层纯函数/输出域闭合），反例自动收缩（~6 秒）。
    # 破坏测试实证：5 个注入（sub 空操作 / 封顶失效 / enh 跳级 / 乱指目标 / 余量注水）全被捕获。
    ('invariants-test.js', '守恒律属性', False),
    ('smoke-test.js',  '逻辑断言', False),
    ('e2e-test.js',    '真实 DOM', False),
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
# v157.30（老板「增加旧币去路」）：旧币出口**行为**体检（扣钱 / 加兵 / 加珠宝 / 冷却）。
# 不塞进 smoke：那要动 4.7 万行的状态剧本与分片生成；这条只需无头真调一遍，1 秒。
GOLDSINK = ('.workbuddy/tools/audit/audit_v15730_goldsink.js', '旧币出口', True)


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
        # v156.40：测试本体 / 门禁脚本变动 = 必须全量（改了测试却不跑测试是盲区）
        if n in TEST_PATHS:
            return True
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


def _gate_timeout():
    try:
        return int(os.environ.get('GATE_TIMEOUT', '1800'))
    except Exception:
        return 1800
def run_one(node, node_path, script, label):
    """跑一个测试，返回 (ok, 摘要行, 详情)。必须连「是否中断」一起看 —— 项目铁律。

    v156.15：超时从写死 600s 改成**可配**（`GATE_TIMEOUT` 环境变量，默认 1800s）。
    v156.19：判定抽成 `judge()`，本函数只负责"起进程 + 收结果" —— 这样才能并发跑。
    """
    env = dict(os.environ)
    if node_path:
        env['NODE_PATH'] = node_path
    _to = _gate_timeout()
    # v156.40：复跑 smoke 也落标题清单（复跑是"同一份代码再跑一次"，
    # 清单一般与首跑一致；不一致本身就说明测试不稳定，值得被记录下来）
    if os.path.basename(script) == 'smoke-test.js':
        env['SMOKE_TITLES'] = os.path.join(ROOT, '.workbuddy', 'smoke-titles-full.json')
    try:
        r = subprocess.run([node, script], cwd=ROOT, capture_output=True, env=env, timeout=_to)
    except subprocess.TimeoutExpired:
        return False, f'{script} 超时 {_to} 秒（GATE_TIMEOUT 可调）', ''
    return judge(r, script, label)


def run_many(node, node_path, plan):
    """v156.19：**把 8 个互相独立的脚本并发跑**。

    来历（2026-10-31 实测）：门禁里 8 个脚本是排队跑的，一次提交 33~40 分钟；
    而机器 16 核，跑 smoke 时只有 1 核在转 —— 排队纯属浪费。
    并发后墙钟 ≈ 最慢那一个（smoke），而不是它们之和。
    判定逻辑一个字没改（都用 `judge()`），失败照样红。
    """
    env = dict(os.environ)
    if node_path:
        env['NODE_PATH'] = node_path
    _to = _gate_timeout()
    procs = []
    for script, label, _opt in plan:
        try:
            # v156.40：串行跑 smoke 时**落一份断言标题清单**（Q3 的分母）。
            # 光有条数发现不了「条数一样但换了两条」—— 而换掉的可能正是关键的。
            _e = dict(env)
            if os.path.basename(script) == 'smoke-test.js':
                _e['SMOKE_TITLES'] = os.path.join(ROOT, '.workbuddy', 'smoke-titles-full.json')
            p = subprocess.Popen([node, script], cwd=ROOT,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=_e)
            procs.append((p, script, label))
        except Exception as e:      # 起不来也要报，不能静默少跑一个
            procs.append((None, script, label, str(e)))
    results = []
    for item in procs:
        if len(item) == 4:
            results.append((False, f'{item[1]} 启动失败：{item[3]}', ''))
            continue
        p, script, label = item
        try:
            out, err = p.communicate(timeout=_to)
        except subprocess.TimeoutExpired:
            p.kill()
            out, err = p.communicate()
            results.append((False, f'{script} 超时 {_to} 秒（GATE_TIMEOUT 可调）', ''))
            continue

        class _R(object):
            pass
        r = _R()
        r.returncode = p.returncode
        r.stdout = out
        r.stderr = err
        results.append(judge(r, script, label))
    return results




def update_baseline_from(out, script):
    """把某脚本本次的 ❌ 标题写进基线（同标题保留较大计数）。"""
    b = load_baseline()
    ent = b.setdefault('entries', {}).setdefault(_script_key(script), {})
    for t in parse_fail_titles(out):
        ent[t] = ent.get(t, 0) + 1
    save_baseline(b)
    return len(ent)

def judge(r, script, label):
    """判定一个测试脚本的结果（从 run_one 里抽出来 —— 并发跑时要分别判定）。"""
    out = r.stdout.decode('utf-8', 'replace')
    err = r.stderr.decode('utf-8', 'replace')
    tail = (out[-400:] + err[-200:]).strip()

    # ============================================================
    # v156.39：**把串行全量的真实条数记进 census**（tier_audit Q3 的依据）
    # ------------------------------------------------------------
    # Q3 要回答「分片有没有静默漏段」，而分母只能由串行跑出来。
    # 顺带存一份完整日志：Q4 要读「跳过 / 待修」的计数，也从这里取。
    # 只对 smoke-test.js 做（e2e 不参与分片）。
    # ============================================================
    if os.path.basename(script) == 'smoke-test.js':
        try:
            _m0 = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败'
                            r'(?:\s*/\s*(\d+)\s*待修[^/]*)?(?:\s*/\s*(\d+)\s*跳过[^)]*)?', out)
            if _m0:
                _pass, _fail = int(_m0.group(1)), int(_m0.group(2))
                _warn = int(_m0.group(3) or 0)
                _skip = int(_m0.group(4) or 0)
                _cf = os.path.join(ROOT, '.workbuddy', 'smoke-census.json')
                _cen = {}
                try:
                    with io.open(_cf, encoding='utf-8') as _f:
                        _cen = json.load(_f)
                except Exception:
                    _cen = {}
                _cen['full'] = _pass + _fail + _warn + _skip
                _cen['fullDetail'] = {'pass': _pass, 'fail': _fail, 'warn': _warn, 'skip': _skip}
                _cen['fullAt'] = __import__('time').strftime('%Y-%m-%dT%H:%M:%S')
                _old_sig = _cen.get('fullSig') or ''
                _new_sig = _sig_of('smoke-test.js')
                # 源码变了 → 旧的标题集合与新分母不是同一份代码，留着会误导 Q3
                if _old_sig and _new_sig and _old_sig != _new_sig:
                    _cen['titles'] = None
                _cen['fullSig'] = _new_sig
                try:
                    with io.open(_cf, 'w', encoding='utf-8', newline='\n') as _f:
                        json.dump(_cen, _f, ensure_ascii=False, indent=1)
                    with io.open(os.path.join(ROOT, '.workbuddy', 'smoke-last.log'),
                                 'w', encoding='utf-8', newline='\n') as _f:
                        _f.write(out)
                except Exception:
                    pass
        except Exception:
            pass

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

    # v156.26d：**先看有没有标准汇总行**。
    # smoke / e2e 的设计是 process.exit(有失败 ? 1 : 0) —— "有失败"和"异常中断"
    # 在退出码上同形，只看退出码会把"9 条已知失败"误报成"崩溃"，基线也就永远走不到。
    # 汇总行比退出码信息量大得多，有它就按它判。
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    if not m and r.returncode != 0:
        _dump_fail(script, out, err)
        return False, f'{script} 退出码 {r.returncode}（异常中断/无汇总行）', tail

    # ① 显式失败数
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

def do_update_baseline(node, node_path, from_out, script_name):
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

    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
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

    print(f'\n   {script_name}: {ok_n} 通过 / {fail_n} 失败')
    if ent:
        print(f'   入基线 {len(ent)} 条：')
        for t, c in sorted(ent.items()):
            print(f'     · {t}' + ('' if c == 1 else f'  ×{c}'))
    else:
        print('   本次无失败 —— 该脚本的基线已清空')
    print(f'\n   已写入 {BASELINE}')
    return 0


def main():
    args = sys.argv[1:]
    full = '--full' in args
    staged = '--staged' in args
    quiet = '--quiet' in args
    # ============================================================
    # v156.39（老板「可以否定自身」）：--strict = **一脚踢开整个豁免体系**
    # ------------------------------------------------------------
    # 把 BASELINE 指到一个不存在的路径 → load_baseline() 返回空表 →
    # **所有失败都算新增**，9 条历史红、5 条实现类待修一律要修。
    # 这不是装饰：体系如果不能被"要求全绿"推翻，它自己就是牢笼。
    # 顺带关掉"并发抖动放行"—— strict 下复跑绿也算失败，因为首跑就该稳定。
    # ============================================================
    global BASELINE, STRICT
    if '--strict' in args:
        STRICT = True
        BASELINE = os.path.join(ROOT, '.workbuddy', '__no_baseline_in_strict__.json')

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
        plan = list(TESTS) + [TABLES, DATASET, TROOPCHAIN, GOLDSINK]
        why = '--full 强制三件套 + 数据表卫生全跑'
    elif needs_full(files):
        plan = list(TESTS) + [TABLES, DATASET, TROOPCHAIN, GOLDSINK]
        why = '改动了代码（index.html 或 js/**）→ 三件套 + 数据表卫生全跑'
    else:
        plan = [TESTS[0], TABLES, DATASET, TROOPCHAIN, GOLDSINK]
        why = '未触及代码 → 只跑 audit + 数据表卫生 + dataset 引用（各 1~2 秒兜底）'

    print(f'━━ 三件套门禁 ━━ {why}')
    if files:
        print(f'   改动 {len(files)} 个文件')

    # ============================================================
    # v156.39 · **影响面提示**：改这个文件，牵动哪几段断言
    # ------------------------------------------------------------
    # 老板「怎么解决牵动谁？」—— 答案不是"让测试能跳段"（切片必崩），
    # 而是改之前就知道责任田在哪。漏改 `#map-info` 白跑 10 分钟那次，缺的就是这一步。
    # 只提示不阻断（它是导航，不是判据），且最多列 3 个文件避免刷屏。
    # ============================================================
    _js = [f for f in files if f.startswith('js/') and f.endswith('.js')][:3]
    if _js and not quiet:
        _imp = os.path.join(ROOT, '.workbuddy', 'tools', 'prof', 'impact_of.js')
        if os.path.exists(_imp):
            try:
                _ri = subprocess.run([node, _imp] + _js, cwd=ROOT, capture_output=True, timeout=60)
                _ti = (_ri.stdout or b'').decode('utf-8', 'replace')
                # 只留「══ 文件 → N 段 / M 条」那几行，明细留给需要时自己查
                for _line in _ti.split('\n'):
                    if _line.startswith('══'):
                        print('   ' + _line.strip())
            except Exception:
                pass
    if STRICT:
        print('   ⚠️ --strict：忽略基线、忽略抖动放行 —— 要求全绿')
    print()

    # ============================================================
    # v156.39 · **元判据**：先审验证体系自己，再审代码
    # ------------------------------------------------------------
    # 老板「复核这套体系完备，是可以否定自身的完备…而不是另一个牢笼」。
    # 顺序很关键：体系有问题时，它给出的"绿"本来就不可信。
    # tier_audit 五问（假绿 / 到期 / 覆盖 / 膨胀 / 可推翻）任一不过 → 直接拦。
    # 耗时 ~0.4 秒，放最前面几乎无成本。
    # ============================================================
    _ta = os.path.join(ROOT, '.workbuddy', 'tools', 'prof', 'tier_audit.js')
    if os.path.exists(_ta):
        # v157.28：GATE_SCOPE=1 —— 告诉自审器"这次判的是串行门禁"。
        # 分片覆盖（Q3）只影响内环加速，不该阻断一条不读分片的链（此前它把门禁锁死）。
        _env_ta = dict(os.environ)
        _env_ta['GATE_SCOPE'] = '1'
        _r = subprocess.run([node, _ta], cwd=ROOT, capture_output=True, timeout=120, env=_env_ta)
        _out = (_r.stdout or b'').decode('utf-8', 'replace')
        _err = (_r.stderr or b'').decode('utf-8', 'replace')
        if _r.returncode != 0:
            print('❌ 元判据：验证体系自身不自洽 —— 先修体系，别信它的结论')
            print(_out or _err)
            print('   （可单独跑：node .workbuddy/tools/prof/tier_audit.js）')
            return 1
        # 通过时只打一行摘要，不刷屏
        _m = re.search(r'(✅ 体系自洽[^\n]*)', _out)
        print('  ✅ 元判据：' + (_m.group(1) if _m else '体系自洽'))
        print()

    import time as _time
    _t0 = _time.time()
    failed = []
    results = run_many(node, node_path, plan)     # v156.19：并发跑（墙钟 ≈ 最慢那个）
    for ((script, label, _opt), (ok, summary, detail)) in zip(plan, results):
        # v156.26e：summary 可能自带 ⚠️（基线判定的"仅已知失败"），先剥掉再统一加图标
        plain = re.sub(r'^⚠️\s*', '', summary)
        icon = '✅' if (ok and not summary.startswith('⚠️')) else ('⚠️' if ok else '❌')
        print(('  ' + icon + ' ') + plain)
        if not ok:
            failed.append((script, summary, detail))
    print(f'   （并发 {len(plan)} 个脚本，墙钟 {_time.time() - _t0:.1f} 秒）')

    print()

    # v156.26e：**失败复跑** —— 把"并发抖动"和"真回归"分开。
    # 由来（2026-11-01 实测）：门禁并发跑 8 个脚本时 e2e 报 1 条红，
    #   同一份代码单独复跑 e2e 是 1106/0 —— jsdom 的定时器在抢 CPU 时会延迟。
    # 原则：复跑绿 → ⚠️ 明确标"不稳定"（**放行但可见**，绝不静默当绿）；
    #       复跑红 → ❌ 真失败，用复跑的输出诊断。
    if failed:
        flaky, real = [], []
        for script, summary, detail in failed:
            print(f'   ↻ 复跑确认：{os.path.basename(script)} …')
            ok2, sum2, det2 = run_one(node, node_path, script, '')
            if ok2:
                flaky.append((script, summary, sum2))
            else:
                real.append((script, summary, det2 or detail))
        for script, old_summary, new_summary in flaky:
            print('  ⚠️ ' + re.sub(r'^⚠️\s*', '', new_summary)
                  + f'   ← 首跑失败、复跑通过＝**不稳定**（并发抖动，非代码回归）')
        if flaky and STRICT:
            print()
            print('✗ --strict：不接受"首跑红、复跑绿"—— 不稳定本身就是缺陷，提交被拦下。')
            return 1
        if flaky:
            print(f'   （{len(flaky)} 个脚本首跑抖动；相关断言依赖固定等待，属已知的并发代价）')
        if real:
            print()
            print('✗ 门禁不通 —— 提交已被拦下。')
            for script, summary, detail in real:
                print(f'\n--- {script} 尾部输出 ---\n{detail}')
            print('\n确需跳过（不推荐）：SKIP_GATE=1 git commit ...')
            return 1
        print()
        print('✓ 门禁通过（含 ' + str(len(flaky)) + ' 个抖动脚本，已在上面标出）。')
        return 0

    print('✓ 门禁通过。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
