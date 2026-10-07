# -*- coding: utf-8 -*-
# v89.229 批 b 探针：① 旧脚本加失效注 ② 资源名/建筑名消费面全量
import io, re
BASE = 'E:/Deepseekdb/'

# ---------- ① 旧脚本加失效注 ----------
p = BASE + '.workbuddy/tools/show/shot_v89227_family.js'
s = io.open(p, encoding='utf-8', newline='').read()
old = "/* v89.227 实机验证：城内地块 4 族降饱和（官府/民生/军事/城务）+ 实测渲染色\n   跑法：node .workbuddy/tools/show/shot_v89227_family.js */"
new = ("/* v89.227 实机验证：城内地块 4 族降饱和（官府/民生/军事/城务）+ 实测渲染色\n"
       "   ⚠️ v89.229 起族色已从地块迁到「名称文字色块」——本脚本的地块色判据失效（保留为\n"
       "   历史仪器）；现行验证见 shot_v89229_family.js。\n"
       "   跑法：node .workbuddy/tools/show/shot_v89227_family.js */")
if 'v89.229 起族色已从地块迁到' in s:
    print('[skip] 旧脚本已加注')
else:
    assert s.count(old) == 1, '旧脚本锚点 %d' % s.count(old)
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('[ok] 旧脚本失效注已加')

# ---------- ② 消费面 ----------
OUT = BASE + '.workbuddy/tmp/p229b_probe.txt'
def rd(p2):
    try: return io.open(BASE + p2, encoding='utf-8', newline='').read()
    except: return ''

L = []; w = L.append
L.append('=' * 26 + ' B1 RESOURCES name/icon/color 消费面 ' + '=' * 26)
for name, f in [('ui', 'js/ui.js'), ('domain', 'js/domain.js'), ('state', 'js/state.js'),
                ('systems', 'js/systems.js'), ('battle', 'js/battle.js'), ('main', 'js/main.js')]:
    s = rd(f)
    for m in re.finditer(r"[^\n]*(RESOURCES|resName|RES_NAME|resIcon)[^\n]*", s):
        t = m.group(0).strip()
        if len(t) < 175:
            w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, t[:170]))

L.append('')
L.append('=' * 26 + ' B2 PRODUCT 侧「净水/木料/碎石/废铁」逐行 ' + '=' * 26)
for name, f in [('data', 'js/data.js'), ('ui', 'js/ui.js'), ('domain', 'js/domain.js'),
                ('state', 'js/state.js'), ('battle', 'js/battle.js'), ('quest', 'js/questdata.js'),
                ('main', 'js/main.js'), ('html', 'index.html')]:
    s = rd(f)
    for m in re.finditer(r"[^\n]*(净水|木料|碎石|废铁|集水场|木料场|碎石场|废铁场)[^\n]*", s):
        t = m.group(0).strip()
        if len(t) < 185:
            w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, t[:180]))

L.append('')
L.append('=' * 26 + ' B3 data.js 资源链（PROD_H / gatherRes / res 字段关联） ' + '=' * 26)
d = rd('js/data.js')
for key in ['PROD_H', 'DATA.PROD', 'gatherRes', 'RES_LABEL', 'resLabel']:
    for m in re.finditer(r"[^\n]*%s[^\n]*" % re.escape(key), d):
        t = m.group(0).strip()
        if len(t) < 175:
            w('  [data L%d] %s' % (d[:m.start()].count('\n') + 1, t[:170]))

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L), 'lines ->', OUT)
