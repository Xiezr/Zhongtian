# -*- coding: utf-8 -*-
"""patch_v89233s_map_sync.py —— v89.233 封样轮：菱形域断言同步

源：并行批次（v89.226 老板）四处产品改动（js/map.js）：
  ① HH cell/4 → cell/3（拉高顶面）
  ② ELEV_PX 八档归零 + ELEV_PX_MAX=0（只要地平面，不要立体侧壁）
  ③ USE 0.45 → 1.0（全用整张素材）
  ④ texVariant 固定返回 0（限制逐格镜像）
原则：§0.7 三件套 —— 不删、不放宽、按新口径重写。

用法：python patch_v89233s_map_sync.py          # dry-run（只读，打印每处命中）
      python patch_v89233s_map_sync.py --apply  # 落盘
"""
import io, sys

R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
LOG = []
FAIL = []


def rd(p):
    return io.open(R + p, encoding='utf-8', newline='').read()


def wr(p, s):
    if APPLY:
        io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def rep(p, tag, old, new, cnt=1):
    s = rd(p)
    c = s.count(old)
    if c != cnt:
        FAIL.append('!! %s | %s: count=%d want=%d' % (p, tag, c, cnt))
        return
    wr(p, s.replace(old, new, cnt))
    LOG.append('ok %s | %s (%d chars)' % (p, tag, len(new)))


def rep_seg(p, tag, head, tail, new):
    """锚点切片：从 head 到 tail（含）整段替换；head 必须唯一。"""
    s = rd(p)
    i = s.find(head)
    if i < 0:
        FAIL.append('!! %s | %s: head NOT FOUND' % (p, tag))
        return
    if s.find(head, i + 1) >= 0:
        FAIL.append('!! %s | %s: head NOT UNIQUE' % (p, tag))
        return
    j = s.find(tail, i)
    if j < 0:
        FAIL.append('!! %s | %s: tail NOT FOUND' % (p, tag))
        return
    j += len(tail)
    wr(p, s[:i] + new + s[j:])
    LOG.append('ok %s | %s (seg %d→%d chars)' % (p, tag, j - i, len(new)))


# ============ M1. map.js：菱形总注释块陈旧句（漏同步） ============
rep('js/map.js', 'M1 菱形总注释',
    '     * 每块地是宽 cell、高 cell/2 的**菱形**（2:1 等距 = 经典 30° 视角）；',
    '     * 每块地是宽 cell、高 2·cell/3 的**菱形**（v89.226 拉高顶面 = 3:2；原 2:1 等距）；')

# ============ S1. smoke：参数记录 HH===11 → cell/3 ============
rep('smoke-test.js', 'S1 HH 行为锁',
    'vv22 && vv22.cell === 44 && vv22.HW === 22 && vv22.HH === 11 && vv22.iso === true',
    'vv22 && vv22.cell === 44 && vv22.HW === 22 && vv22.HH === vv22.cell / 3 && vv22.iso === true')

# ============ S2. smoke：2:1 菱形 → 3:2 ============
rep_seg('smoke-test.js', 'S2 3:2 标题',
    "check('2:1 菱形（半宽 = cell/2、半高 = cell/4）'",
    'vv22.HH === vv22.cell / 4);',
    '''/* v89.226（老板）：菱形半高 cell/4 → cell/3（拉高顶面，贴近裁切图长宽比）；
     原「2:1 等距」口径退役 —— 半宽不动（cell/2）。 */
  check('3:2 菱形（半宽 = cell/2、半高 = cell/3 · v89.226 拉高顶面）', vv22.HW === vv22.cell / 2
    && vv22.HH === vv22.cell / 3);''')

# ============ S3. smoke：菱形排布（HH 正则 + 注释锁） ============
rep_seg('smoke-test.js', 'S3 排布口径',
    "check('地图为菱形等距排布（v50：不再是正方形网格）'",
    "&& /2:1 等距/.test(mapSrc22)",
    r'''/* v89.226（老板）：半高 cell/4 → cell/3（拉高顶面）—— 判据随新口径；
     注释锁改「拉高顶面」（原「2:1 等距」字样随注释同步退役）。 */
  check('地图为菱形等距排布（v50：不再是正方形网格 · v89.226 半高 cell/3）',
    /var HW = cell \/ 2;/.test(mapSrc22) && /var HH = cell \/ 3;/.test(mapSrc22)
    && /拉高顶面/.test(mapSrc22)''')

# ============ S4. smoke：分档归零（整块重写） ============
rep_seg('smoke-test.js', 'S4 分档归零',
    "check('v50-a：分档仍是「山最高、平地最薄」（幅度压进缝里，但高低差还在）'",
    "&& g('plain') > 0 && g('lake') > 0 && g('city') > 0;",
    r'''check('v89.226：高度分档归零（只要地平面 · 原「山最高、平地最薄」口径随立体侧壁退役）', (function () {
    /* v89.226（老板）：「三维高度全部归零 —— 只要地平面，不要立体侧壁」。
       按新口径重写：八档**逐档钉死为 0**（不是"允许为 0"）+ 硬上限 0
       + 抬升消费链仍在（elevFor/ELEV 未断 —— 侧壁代码保留，供未来恢复）。 */
    var m = mapSrc22.match(/var ELEV_PX = \{([\s\S]*?)\};/);
    if (!m) return false;
    var g = function (k) { var r = m[1].match(new RegExp(k + ':\\s*([\\d.]+)')); return r ? parseFloat(r[1]) : NaN; };
    var ks = ['plain', 'caoyuan', 'zhaoze', 'lake', 'desert', 'forest', 'hill', 'city'];
    for (var i4 = 0; i4 < ks.length; i4++) { if (g(ks[i4]) !== 0) return false; }
    return /var ELEV_PX_MAX = 0;/.test(mapSrc22)
      && /function elevFor\(terrain\)/.test(mapSrc22) && /var ELEV = ELEV_PX_MAX;/.test(mapSrc22);''')

# ============ S5. smoke：基底断言里的 edgeOf 除法（_eMax） ============
rep('smoke-test.js', 'S5 _eMax 防除零',
    r'''      /* 顶棱高光仍在（菱形版画的是顶面上方那两条棱） */
      && /0\.14 \+ Math\.min\(0\.24, el \/ ELEV_PX_MAX \* 0\.24\)/.test(mapSrc22)''',
    r'''      /* 顶棱高光仍在（菱形版画的是顶面上方那两条棱；v89.226 高度归零后
         除法改走 _eMax = ELEV_PX_MAX || 1 —— 防除零，两条都在才算没断） */
      && /0\.14 \+ Math\.min\(0\.24, el \/ _eMax \* 0\.24\)/.test(mapSrc22)
      && /var _eMax = ELEV_PX_MAX \|\| 1;/.test(mapSrc22)''')

# ============ S6. smoke：USE 45% → 100% ============
rep_seg('smoke-test.js', 'S6 USE 100%',
    "check('v49：cover 的源取用范围收到 45%（实测该档细节最好）'",
    r'''&& /if \(cw > maxSide \|\| ch > maxSide\)/.test(seg);''',
    r'''check('v89.226：源取用范围 100%（全用整张素材 · 原 45% 口径退役）', (function () {
    /* v89.226（老板）：素材改成"只去白、全量保留"的完整景物 →
       采样 45% 只取中心会切掉边缘景物，改为 100% 全用整张。 */
    var i = mapSrc22.indexOf('function blitArtRect');
    var seg = mapSrc22.slice(i, i + 1600);
    return /var USE = 1\.0;/.test(seg)
      && /var maxSide = Math\.min\(c\.width, c\.height\) \* USE;/.test(seg)
      && /if \(cw > maxSide \|\| ch > maxSide\)/.test(seg);''')

# ============ S7. smoke：实测 HH 13 → 52/3 ============
rep('smoke-test.js', 'S7 实测 HH',
    '        && v.HW === 26 && v.HH === 13;',
    '        && v.HW === 26 && v.HH === 52 / 3;      /* v89.226：半高 cell/3（原 13 = cell/4） */')

# ============ S8. smoke：texVariant 镜像停用（原断言过时） ============
rep_seg('smoke-test.js', 'S8 镜像停用',
    "check('v89.42：逐格镜像变体存在、走轴对齐线性变换（不引入旋转 / 仿射）'",
    r'''&& !/ctx\.rotate\(/.test(MP) && !/setTransform/.test(MP);''',
    r'''check('v89.226：逐格镜像停用（固定原样 · scale 备用保留，仍不许旋转/仿射）', (function () {
    /* v89.226（老板）：「限制逐格镜像」—— 直切贴图有方向（光源/纹理朝向），
       逐格镜像让同地形每格朝向乱翻（"图在地图上会旋转"）。texVariant 固定返回 0；
       镜像用的 ctx.scale(±1) 代码保留（备用），旋转/仿射仍禁。 */
    var i = MP.indexOf('function texVariant');
    var seg = i < 0 ? '' : MP.slice(i, i + 700);
    return seg.indexOf('return 0;') >= 0
      && /ctx\.scale\(-1, 1\)/.test(MP) && /ctx\.scale\(1, -1\)/.test(MP)
      && !/ctx\.rotate\(/.test(MP) && !/setTransform/.test(MP);''')

# ============ E1. e2e：菱形等距（HH） ============
rep('e2e-test.js', 'E1 e2e HH',
    '''  check('地图为菱形等距（半宽 = cell/2、半高 = cell/4、视口中心为 vx/vy）',
    G.map._view && G.map._view.HW === G.map._view.cell / 2
    && G.map._view.HH === G.map._view.cell / 4 && G.map._view.iso === true''',
    '''  check('地图为菱形等距（半宽 = cell/2、半高 = cell/3 · v89.226 拉高顶面、视口中心为 vx/vy）',
    G.map._view && G.map._view.HW === G.map._view.cell / 2
    && G.map._view.HH === G.map._view.cell / 3 && G.map._view.iso === true''')

# ============ 报告 ============
print('== %s ==' % ('APPLY' if APPLY else 'DRY-RUN'))
for x in LOG:
    print(' ', x)
if FAIL:
    print('!! FAILURES:')
    for x in FAIL:
        print(' ', x)
    sys.exit(1)
print('共 %d 处，全部命中。' % len(LOG))
