# -*- coding: utf-8 -*-
"""
素材对照脚本：源图工作区  vs  已落位 ui/  vs  bitmaps.js 登记
------------------------------------------------------------
用法：
  python .workbuddy/tools/asset/scan_asset_vs_source.py            # 打印对照
  python .workbuddy/tools/asset/scan_asset_vs_source.py -o 报告.md # 落盘 markdown

判据（项目地图第二节 + js/bitmaps.js 头注释）：
  · 运行期只认 assets/icons/ui/ 下的 ai_*.png（1024×1024 透明 PNG / 已抠底）
  · bitmaps.js 是**自动生成**的登记表，落位唯一判据 = 文件进了 ui/ 且被登记
  · 其余分类目录（城内建筑 / 野地 / 其他种族兵种 …）= 出图源图工作区，**不参与运行**
"""
import io, os, re, struct, sys, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
# ↑ 脚本在 .workbuddy/tools/asset/ → 上溯 3 层 = 项目根 E:\Deepseekdb
ICONS = os.path.join(ROOT, 'assets', 'icons')
UI = os.path.join(ICONS, 'ui')
BITMAPS = os.path.join(ROOT, 'js', 'bitmaps.js')

# 建筑 id ↔ 源图中文名（源 data.js DATA.BUILDINGS 的 name；标 ? = 映射待确认）
BLD_MAP = [
    ('guanfu',          '政务厅',    ''),
    ('minfang',         '居所',      ''),
    ('shuyuan',         '研习所',    'data 名=科研中心'),
    ('junying',         '招募站',    '? 与「训练营」二选一'),
    ('xiaochang',       '练兵场',    ''),
    ('shichang',        '交易站',    ''),
    ('cangku',          '货仓',      'data 名=战储仓'),
    ('chengqiang',      '',          '**源图缺**'),
    ('yizhan',          '传送站',    '旧名=补给站（已删）'),
    ('fenghuotai',      '瞭望塔',    ''),
    ('majiu',           '车库',      'data 名=载具研究所'),
    ('kezhan',          '酒馆',      'data 名=征召大厅'),
    ('zhaoxianguan',    '',          '**源图缺**'),
    ('honglusi',        '基因实验室', ''),
    ('tiejiangpu',      '工厂',      '? data 名=制造厂'),
    ('gongjiangzuofang', '精密制造厂', ''),
]


def img_size(p):
    """读 PNG / JPEG 头取 (w, h)；失败返回 (0, 0)。不依赖 PIL。"""
    try:
        with open(p, 'rb') as f:
            head = f.read(32)
        if head[:8] == b'\x89PNG\r\n\x1a\n':
            w, h = struct.unpack('>II', head[16:24])
            return w, h
        if head[:2] == b'\xff\xd8':
            with open(p, 'rb') as f:
                f.read(2)
                while True:
                    b = f.read(1)
                    if not b:
                        return 0, 0
                    if b != b'\xff':
                        continue
                    m = f.read(1)
                    while m == b'\xff':
                        m = f.read(1)
                    if m in (b'\xc0', b'\xc1', b'\xc2', b'\xc3', b'\xc5',
                             b'\xc6', b'\xc7', b'\xc9', b'\xca', b'\xcb',
                             b'\xcd', b'\xce', b'\xcf'):
                        f.read(3)
                        h, w = struct.unpack('>HH', f.read(4))
                        return w, h
                    ln = struct.unpack('>H', f.read(2))[0]
                    f.read(ln - 2)
    except Exception:
        pass
    return 0, 0


def kb(n):
    return '%.0fKB' % (n / 1024.0) if n < 1024 * 1024 else '%.1fMB' % (n / 1048576.0)


def scan_dir(d):
    out = []
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        p = os.path.join(d, fn)
        if not os.path.isfile(p):
            continue
        w, h = img_size(p)
        out.append({'name': fn, 'path': p, 'size': os.path.getsize(p),
                    'ext': os.path.splitext(fn)[1].lower(), 'w': w, 'h': h,
                    'mt': os.path.getmtime(p)})
    return out


def registered():
    s = io.open(BITMAPS, encoding='utf-8').read()
    return set(re.findall(r'F\["([^"]+)"\] = 1;', s))


def main():
    reg = registered()
    ui = scan_dir(UI)
    ui_names = set(x['name'] for x in ui)
    L = []
    A = L.append

    A('# 素材对照：源图工作区 vs 已落位 ui/ vs bitmaps.js 登记')
    A('')
    A('> 生成：%s · 脚本 `.workbuddy/tools/asset/scan_asset_vs_source.py`' %
      datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))
    A('> 判据：运行期只认 `assets/icons/ui/ai_*.png`；bitmaps.js 为自动生成登记表。')
    A('')

    # ── ① 一致性：ui/ 与登记表 ──
    A('## 一、ui/ 落位 vs bitmaps.js 登记')
    A('')
    A('| 项 | 数 |')
    A('|---|---|')
    A('| ui/ 实际文件 | %d |' % len(ui))
    A('| bitmaps.js 登记 | %d |' % len(reg))
    A('| 登记了但 ui/ 缺文件 | %d |' % len(reg - ui_names))
    A('| ui/ 有但**未登记** | %d |' % len(ui_names - reg))
    A('')
    miss = sorted(reg - ui_names)
    unreg = sorted(ui_names - reg)
    if miss:
        A('**登记了但文件缺失**（会走矢量回退）：')
        for m in miss:
            A('- `%s`' % m)
        A('')
    if unreg:
        A('**在 ui/ 但没登记**（永不生效）：')
        for m in unreg:
            A('- `%s`' % m)
        A('')
    if not miss and not unreg:
        A('✅ 两者**完全一致**，无死登记、无漏登记。')
        A('')

    # ── ② 源图工作区总览 ──
    A('## 二、源图工作区总览（不参与运行）')
    A('')
    A('| 目录 | 文件 | PNG | JPEG | 合计体积 |')
    A('|---|---:|---:|---:|---:|')
    cats = []
    for d in sorted(os.listdir(ICONS)):
        full = os.path.join(ICONS, d)
        if not os.path.isdir(full) or d == 'ui':
            continue
        fs = scan_dir(full)
        if not fs:
            continue
        cats.append((d, fs))
        png = len([x for x in fs if x['ext'] == '.png'])
        jpg = len([x for x in fs if x['ext'] in ('.jpg', '.jpeg')])
        tot = sum(x['size'] for x in fs)
        A('| `%s/` | %d | %d | %d | %s |' % (d, len(fs), png, jpg, kb(tot)))
    A('')
    bad = []
    for d, fs in cats:
        for x in fs:
            if x['ext'] in ('.jpg', '.jpeg'):
                bad.append(x)
    if bad:
        A('⚠️ **JPEG 源图 %d 个** —— JPEG 无 alpha 通道，而落位规格要求'
          '「1024×1024 透明 PNG（已抠底）」，这些**不能直接落位**，需先抠底转 PNG。' % len(bad))
        A('')

    # ── ③ 城内建筑 三级图对照 ──
    A('## 三、城内建筑：源图 → 建筑 id → 落位状态')
    A('')
    A('> 源图命名 `<中文名><1|2|3>`；落位命名 `ai_<id>.png` / `_t2` / `_t3`。')
    A('')
    A('| 建筑 id | data 中文名 | 源图名 | 源 1/2/3 | ui/ 落位 1/2/3 | 状态 |')
    A('|---|---|---|---|---|---|')
    for bid, cn, note in BLD_MAP:
        src = {}
        for x in (scan_dir(os.path.join(ICONS, '城内建筑'))):
            m = re.match(r'^(.+?)([123])\.(png|jpe?g)$', x['name'], re.I)
            if m:
                src.setdefault(m.group(1), {})[m.group(2)] = x
        files = src.get(cn, {}) if cn else {}
        s1 = '✅' if '1' in files else ('—' if not cn else '❌')
        s2 = '✅' if '2' in files else ('—' if not cn else '❌')
        s3 = '✅' if '3' in files else ('—' if not cn else '❌')
        u = {
            '1': 'ai_%s.png' % bid,
            '2': 'ai_%s_t2.png' % bid,
            '3': 'ai_%s_t3.png' % bid,
        }
        u1 = '✅' if u['1'] in ui_names else '❌'
        u2 = '✅' if u['2'] in ui_names else '❌'
        u3 = '✅' if u['3'] in ui_names else '❌'
        if not cn:
            st = '⚠️ 源图缺失'
        elif len(files) == 3 and u['1'] in ui_names and u['2'] in ui_names and u['3'] in ui_names:
            st = '✅ 源齐 + 已落位'
        elif len(files) == 3:
            st = '🔧 源齐，待落位' if u['1'] not in ui_names else '🔧 部分落位'
        else:
            st = '⚠️ 源不齐'
        A('| `%s` | %s | %s | %s%s%s | %s%s%s | %s |' %
          (bid, cn or '—', cn or '—', s1, s2, s3, u1, u2, u3,
           st + (' · ' + note if note else '')))
    A('')

    # ── ④ 未接入的新源图 ──
    A('## 四、源图有、但运行期完全无对应（未接入）')
    A('')
    A('| 目录 | 文件 | 体积 | 尺寸 | 说明 |')
    A('|---|---|---:|---|---|')
    orphan = []
    for d, fs in cats:
        if d == '城内建筑':
            continue
        for x in fs:
            orphan.append((d, x))
    for d, x in orphan:
        if d == '其他种族兵种':
            note = '数据层无「巢族/晶族」定义（grep 全 js 无命中）'
        elif d == '野地':
            note = 'ui/ 有 ai_terrain_*，命名需映射'
        else:
            note = ''
        A('| `%s/` | %s | %s | %dx%d | %s |' % (d, x['name'], kb(x['size']), x['w'], x['h'], note))
    A('')

    # ── ⑤ 本次更新：最近动过的源图 vs 对应落位图 ──
    A('## 五、本次更新的源图 → 落位状态（按修改时间倒序）')
    A('')
    A('> 判据：**源图 mtime 晚于落位图 mtime = 落位图是旧版，需重新处理覆盖**。')
    A('')
    rec = []
    for d, fs in cats:
        for x in fs:
            rec.append((d, x))
    rec.sort(key=lambda t: -t[1]['mt'])
    top = rec[:15]
    A('| 目录 | 源图 | 源图时间 | 体积 | 对应落位文件 | 落位时间 | 判定 |')
    A('|---|---|---|---:|---|---|---|')
    ui_mt = {x['name']: x for x in ui}
    for d, x in top:
        placed, note = '', ''
        if d == '城内建筑':
            m = re.match(r'^(.+?)([123])\.(png|jpe?g)$', x['name'], re.I)
            if m:
                cn2, lv = m.group(1), m.group(2)
                bid = ''
                for b, c, _n in BLD_MAP:
                    if c == cn2:
                        bid = b
                        break
                if bid:
                    placed = 'ai_%s.png' % bid if lv == '1' else 'ai_%s_t%s.png' % (bid, lv)
        elif d == '其他种族兵种':
            note = '数据层无「巢族/晶族」→ **未接入**'
        pm = ui_mt.get(placed)
        pmt = datetime.datetime.fromtimestamp(pm['mt']).strftime('%m-%d %H:%M') if pm else '—'
        if placed and pm:
            judge = '🔴 源图更新，落位图是旧版' if x['mt'] > pm['mt'] else '✅ 落位已是新版'
        elif placed:
            judge = '⚪ 未落位'
        else:
            judge = note or '⚪ 无对应落位'
        A('| `%s/` | %s | %s | %s | %s | %s | %s |' %
          (d, x['name'],
           datetime.datetime.fromtimestamp(x['mt']).strftime('%m-%d %H:%M'),
           kb(x['size']), ('`%s`' % placed) if placed else '—', pmt, judge))
    A('')

    # ── ⑥ 落位链路 ──
    A('## 六、落位链路（源图 → 运行期）')
    A('')
    A('```')
    A('源图（assets/icons/<分类>/，jpeg/png，未抠底）')
    A('  ↓ ① 抠底 / 裁切 1024×1024 透明 PNG    .workbuddy/tools/asset/matte.js')
    A('  ↓ ② 落位到 assets/icons/ui/ai_<id>[_t2|_t3].png')
    A('  ↓ ③ 重生成登记表                       .workbuddy/tools/gen/gen_bitmaps.js')
    A('  ↓ ④ 三门禁 + 人眼验收（.workbuddy/shots/）')
    A('```')
    A('')
    A('⚠️ 登记表 `js/bitmaps.js` 是**自动生成**的（头注释写明"请勿手改"），'
      '落位后必须跑 ③，否则新图不会被 `BITMAPS.src()` 命中。')
    A('')

    txt = '\n'.join(L)
    out = None
    if '-o' in sys.argv:
        out = sys.argv[sys.argv.index('-o') + 1]
        io.open(out, 'w', encoding='utf-8', newline='').write(txt)
        print('written:', out)
    else:
        print(txt)


if __name__ == '__main__':
    main()
