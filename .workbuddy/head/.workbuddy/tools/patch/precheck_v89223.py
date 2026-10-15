# -*- coding: utf-8 -*-
"""v89.223 锚点预检：所有补丁锚点逐条计数 + repr（逐字节）。
运行: python precheck_v89223.py
"""
import io, os, re

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

OUT = []
def w(x=''):
    OUT.append(str(x))

def chk(f, sub, exp):
    t = rd(f)
    c = t.count(sub)
    flag = 'OK ' if c == exp else '!!!!'
    w('%s %-58s exp=%d got=%d' % (flag, sub[:58].replace('\n', '\\n'), exp, c))
    if c != exp:
        i = t.find(sub[:24]) if len(sub) > 24 else t.find(sub)
        if i >= 0:
            w('     repr: ' + repr(t[max(0, i - 50):i + 120]))
        else:
            # 试更短前缀
            for L in (16, 10, 6):
                j = t.find(sub[:L])
                if j >= 0:
                    w('     repr(前%d字): %s' % (L, repr(t[max(0, j - 50):j + 120])))
                    break
    return c

w('===== A) ab 步骤（data.js） =====')
for c in ['民', '义', '枪', '弩', '弓', '轻', '铁', '辎', '冲', '投', '青', '藤', '虎', '西', '象']:
    chk('js/data.js', "ab: '%s'" % c, 1)
w('')

w('===== B) 产品杂项 =====')
chk('js/data.js', '[攻]弓箭兵前进454', 1)
chk('js/data.js', '民兵→枪→盾→弓→摩托游骑→', 1)
chk('js/data.js', '③ 史书纪事（记账式 · 非事件选项）', 1)
chk('js/icons.js', '/* 战象 */', 1)
chk('js/questdata.js', "title: '弓弩扩充'", 1)
chk('js/questdata.js', '补足弓手', 1)
chk('js/questdata.js', "title: '弓弩之利'", 1)
chk('js/questdata.js', '强弓劲弩', 1)
chk('js/state.js', '史册记账 + 年号纪元', 1)
chk('index.html', '④ 记录：史册 / 公文', 1)
chk('index.html', '深金分隔线（史册条目左缘）', 1)
chk('js/tactic.js', '（弓 220 + 装备 8000 = ×37）', 1)
chk('js/tactic.js', '（射程 ≥ 500 的弓/弩/投）', 1)
chk('js/tactic.js', '（v89.149「弓打弓」）', 1)
chk('js/domain.js', '（搬运工 2 / 枪盾 4 / 弓 5 / 摩托游骑 6', 1)
chk('js/main.js', "GAME.VERSION = 'v89.222';", 1)
w('')

w('===== C) smoke 修正 =====')
chk('smoke-test.js', "=== '枪' && G.troopAbOf('nanjiangxiangbing') === '象'", 1)
chk('smoke-test.js', 'data-tip-el="1">枪<span class="tip-src">', 1)
chk('smoke-test.js', "GAME\\.VERSION = 'v89\\.222'", 1)
chk('smoke-test.js', "console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');", 1)
for k in ['MAP223', 'OLD223', 'fs223', 'rd223', '_r223a', '§223']:
    chk('smoke-test.js', k, 0)
w('')

w('===== E) 工具夹具 =====')
tools = [
    ('audit/audit_v89105_chains.js', [("cityName: '许都'", 1), ('义兵', 3), ('民夫', 4), ('辎重车', 1)]),
    ('audit/audit_v89105_modals.js', [("cityName: '许都'", 1)]),
    ('audit/audit_v89112_pressure.js', [("cityName: '许都'", 1)]),
    ('audit/diag_v89105_overflow.js', [("cityName: '许都'", 1)]),
    ('audit/ladder_audit.js', [('义兵', 5), ('铁骑', 1)]),
    ('asset/check_v89174_shots.js', [("cityName: '许都'", 1)]),
    ('asset/verify_v89106_screen.js', [("cityName: '许都'", 1)]),
    ('play/lifecycle_v89121.js', [("cityName: '许都'", 1)]),
    ('play/repro_v89174_builddone.js', [("cityName: '许都'", 1)]),
    ('play/repro_v89174b_window.js', [("cityName: '许都'", 1)]),
    ('play/repro_v89174c_zero.js', [("cityName: '许都'", 1)]),
    ('playtest/play_600x.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
    ('playtest/play_farm2_600x.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
    ('playtest/play_gold_600x.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
    ('playtest/play_strat_600x.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
    ('playtest/play_rush_1x.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
    ('playtest/play_v89118.js', [("cityName: '许都'", 1), ('「许都」', 1), ('· 豫州 ·', 1)]),
]
for rel, subs in tools:
    f = '.workbuddy/tools/' + rel
    for sub, exp in subs:
        chk(f, sub, exp)
w('')

w('===== F) 抽样 repr =====')
def rp(f, sub, back=60, fwd=140):
    t = rd(f)
    i = t.find(sub)
    if i < 0:
        w('!! %s 未命中 [%s]' % (f, sub[:40]))
        return
    w('%s  @%d  %s' % (f, i, repr(t[max(0, i - back):i + fwd])))
rp('js/data.js', '民兵→枪→盾')
rp('js/data.js', '③ 史书纪事')
rp('js/questdata.js', "title: '弓弩扩充'")
rp('js/questdata.js', "title: '弓弩之利'")
rp('js/state.js', '史册记账')
rp('js/tactic.js', '（弓 220')
rp('js/tactic.js', '的弓/弩/投')
rp('js/tactic.js', '「弓打弓」')
rp('js/domain.js', '枪盾 4')
rp('smoke-test.js', "=== '枪' &&")
rp('smoke-test.js', 'data-tip-el="1">枪')
rp('smoke-test.js', "v89\\.222")
rp('index.html', '④ 记录：史册')
rp('index.html', '史册条目左缘')
rp('js/main.js', "GAME.VERSION")
rp('.workbuddy/tools/playtest/play_600x.js', '· 豫州 ·')
rp('.workbuddy/tools/audit/audit_v89105_chains.js', '民夫')
rp('.workbuddy/tools/audit/ladder_audit.js', '铁骑')
w('')

w('===== G) 资产位图文件名扫描 =====')
d = sorted(os.listdir('assets/icons/ui')) if os.path.isdir('assets/icons/ui') else []
w('assets/icons/ui 文件数: %d' % len(d))
bad = [x for x in d if any(k in x for k in ['枪', '骑', '象', '虎', '弓', '铁', '青', '藤', '投', '义', '民夫', '刀盾', '马'])]
w('文件名含旧词字样: %s' % (bad[:30] if bad else '（无）'))
bm = rd('js/bitmaps.js')
w('bitmaps.js 中 ai_ 引用: %d 处；示例: %s' % (len(re.findall('ai_', bm)), re.findall(r"'[^']{0,40}ai_[^']{0,40}'", bm)[:6]))
w('')

io.open('.workbuddy/tmp/precheck223.txt', 'w', encoding='utf-8', newline='').write('\n'.join(OUT))
print('precheck223.txt lines=%d' % len(OUT))
