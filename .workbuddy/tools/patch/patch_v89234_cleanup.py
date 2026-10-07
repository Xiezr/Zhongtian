# -*- coding: utf-8 -*-
"""patch_v89234_cleanup.py —— v89.234 清账轮

X 产品/测试/版本：
  X1 装备成长面板 tong 行「统帅」→「指挥」（异形词漏网：v89.224d 换代按"统率"匹配，
     扫不到"统帅"；全产品其它 4 处映射均已是"指挥"）
  X2 smoke 断言样本同步  X3 e2e 注释同步
  X4 main.js 版本 v89.233 → v89.234
  X5 §199④（逐轮锁当前版本号）
  X6 §233⑤ 放宽（当前版本由 §199④ 锁；本条只查 v89.233 档案在册 —— §139.5 口径）

Y 工具面六维词/宝物旧名换代（10 文件）：
  Y1-4 v89.224 六维词（内政/统率/勇武/智谋 → 治理/指挥/武力/谋略）—— 实时验证脚本词面换代
  Y5-7 宝物旧名（玉犀符/铜雀令/八卦羽扇 → 避难所徽章/旧军号令/作战地图）
  Y8-9 check_v89160/162 沿革注（读历史截图的时称）
  Y10 portrait_gallery 输出标签同步

用法：python patch_v89234_cleanup.py          # dry-run
      python patch_v89234_cleanup.py --apply  # 落盘
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
LOG, FAIL = [], []


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
    LOG.append('ok %s | %s ×%d' % (p, tag, cnt))


# ==================== X 产品 / 测试 / 版本 ====================
rep('js/ui.js', 'X1 统帅→指挥',
    "['tong', '统帅']", "['tong', '指挥']")
rep('smoke-test.js', 'X2 断言样本',
    "&& /'统帅'/.test(body) && /'武力'/.test(body)",
    "&& /'指挥'/.test(body) && /'武力'/.test(body)")
rep('e2e-test.js', 'X3 注释',
    '逐行清单 .eq-grow（统帅/武力/… 各一行）',
    '逐行清单 .eq-grow（指挥/武力/… 各一行）')
rep('js/main.js', 'X4 版本',
    "GAME.VERSION = 'v89.233';", "GAME.VERSION = 'v89.234';")
rep('smoke-test.js', 'X5 §199④',
    r"return /GAME\.VERSION = 'v89\.233'/.test(mS199)",
    r"return /GAME\.VERSION = 'v89\.234'/.test(mS199)")
rep('smoke-test.js', 'X6 §233⑤放宽',
    r"""      var ok = /GAME\.VERSION = 'v89\.233'/.test(raw['main.js'])
        && arc.indexOf('v89.233') >= 0
        && arc.indexOf('语义描述改') >= 0;
      window.__r233e = 'ver=' + /GAME\.VERSION = 'v89\.233'/.test(raw['main.js'])
        + ' 档案=' + (arc.indexOf('v89.233') >= 0);""",
    r"""      /* v89.234：「当前版本号」由 §199④ 逐轮锁（§139.5 口径）；
         本条只查「v89.233 的交付档案在册」（历史记录不许丢）。 */
      var ok = /GAME\.VERSION = 'v89\.\d+'/.test(raw['main.js'])
        && arc.indexOf('v89.233') >= 0
        && arc.indexOf('语义描述改') >= 0;
      window.__r233e = 'ver=' + /GAME\.VERSION = 'v89\.\d+'/.test(raw['main.js'])
        + ' 档案=' + (arc.indexOf('v89.233') >= 0);""")

# ==================== Y 工具面 ====================
PH = '.workbuddy/tools/show/'
PA = '.workbuddy/tools/asset/'

rep(PH + 'shot_v89113_mayor_inv.js', 'Y1 城池面板旁证',
    'hasFn:tx.indexOf("内政·智谋")>=0', 'hasFn:tx.indexOf("治理·谋略")>=0')
rep(PH + 'shot_v89133_march_pane.js', 'Y2 攻防行 title',
    r"&& /＝|=\s*勇武/.test(atkRow.title) === false ? (/勇武/.test(atkRow.title) && /智谋/.test(defRow.title)) : true,",
    r"&& /＝|=\s*武力/.test(atkRow.title) === false ? (/武力/.test(atkRow.title) && /谋略/.test(defRow.title)) : true,")
rep(PH + 'shot_v89136_wide.js', 'Y3a chk 名',
    '悬停含六维：统率/勇武/…', '悬停含六维：指挥/武力/…')
rep(PH + 'shot_v89136_wide.js', 'Y3b 断言',
    'v3a.n === 2 && /统率/.test(v3a.tip) && /勇武/.test(v3a.tip),',
    'v3a.n === 2 && /指挥/.test(v3a.tip) && /武力/.test(v3a.tip),')
rep(PH + 'shot_v89162_mayor.js', 'Y4a 内政→治理', '内政', '治理', 14)
rep(PH + 'shot_v89162_mayor.js', 'Y4b 智谋→谋略', '智谋', '谋略', 4)
rep(PH + 'shot_v89186_gates.js', 'Y5a',
    'genAttrs 统率 +6', 'genAttrs 指挥 +6')
rep(PH + 'shot_v89186_gates.js', 'Y5b',
    "mtxt.indexOf('玉犀符') >= 0", "mtxt.indexOf('避难所徽章') >= 0")
rep(PH + 'shot_v89186_gates.js', 'Y5c',
    "mtxt.indexOf('统率 +6') >= 0", "mtxt.indexOf('指挥 +6') >= 0")
rep(PH + 'shot_v89186_gates.js', 'Y5d',
    '回显「当前：玉犀符（统率 +6）」', '回显「当前：避难所徽章（指挥 +6）」')
rep(PH + 'shot_v89205_gates.js', 'Y6a 头注',
    '已佩态「当前：玉犀符」+ 卸下按钮（截图）', '已佩态「当前：避难所徽章」+ 卸下按钮（截图）')
rep(PH + 'shot_v89205_gates.js', 'Y6b',
    "cur: t.indexOf('当前：') >= 0 && t.indexOf('玉犀符') >= 0,",
    "cur: t.indexOf('当前：') >= 0 && t.indexOf('避难所徽章') >= 0,")
rep(PH + 'shot_v89205_gates.js', 'Y6c',
    "eff: t.indexOf('统率 +6') >= 0,", "eff: t.indexOf('指挥 +6') >= 0,")
rep(PH + 'shot_v89205_gates.js', 'Y6d',
    '回显「当前：玉犀符（统率 +6）」', '回显「当前：避难所徽章（指挥 +6）」')
rep(PH + 'shot_v89187_gates.js', 'Y7 造局注释',
    '/* 造宝具库存：低×2（玉犀符）+ 低×2（铜雀令）+ 中×2（八卦羽扇） */',
    '/* 造宝具库存：低×2（避难所徽章）+ 低×2（旧军号令）+ 中×2（作战地图） */')

rep(PA + 'check_v89160_shots.js', 'Y8 沿革注',
    """/* v89.160 像素体检：仓库面板折损行（琥珀警示）· 公文灾种行（内政青主题色）· 自动化面板说明
   运行：""",
    """/* v89.160 像素体检：仓库面板折损行（琥珀警示）· 公文灾种行（内政青主题色）· 自动化面板说明
   ⚠️ 历史截图体检（时称）：本脚本读 v89.160 时代的历史截图，"内政"是当时六维名
   （v89.224 换代后为「治理」）。像素判据与名称无关，历史正文保留。
   运行：""")
rep(PA + 'check_v89162_shots.js', 'Y9 沿革注',
    """/* v89.162 像素体检：三张图（六维表 / 城池面板 / 旧币 tip）
   —— 逐行亮度投影数「文字行组」（版式指纹）+ 金色高亮像素（标题/数值）
   运行：""",
    """/* v89.162 像素体检：三张图（六维表 / 城池面板 / 旧币 tip）
   —— 逐行亮度投影数「文字行组」（版式指纹）+ 金色高亮像素（标题/数值）
   ⚠️ 历史截图体检（时称）：本脚本读 v89.162 时代的历史截图，"内政"是当时六维名
   （v89.224 换代后为「治理」）。像素判据与名称无关，历史正文保留。
   运行：""")

rep(PA + 'portrait_gallery.js', 'Y10a 注释',
    '// 不同四维主色（统率 vs 勇武 vs 智谋 vs 内政）',
    '// 不同四维主色（指挥 vs 武力 vs 谋略 vs 治理 · v89.224 六维换代后现名）')
rep(PA + 'portrait_gallery.js', 'Y10b', "label: '勇武主'", "label: '武力主'")
rep(PA + 'portrait_gallery.js', 'Y10c', "label: '智谋主'", "label: '谋略主'")
rep(PA + 'portrait_gallery.js', 'Y10d', "label: '统率主'", "label: '指挥主'")
rep(PA + 'portrait_gallery.js', 'Y10e', "label: '内政主'", "label: '治理主'")

# ==================== 报告 ====================
print('== %s ==' % ('APPLY' if APPLY else 'DRY-RUN'))
for x in LOG:
    print(' ', x)
if FAIL:
    print('!! FAILURES:')
    for x in FAIL:
        print(' ', x)
    sys.exit(1)
print('共 %d 处，全部命中。' % len(LOG))
