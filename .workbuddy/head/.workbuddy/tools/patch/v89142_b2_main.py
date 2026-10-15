# v89.142 B2：main.js —— 目标下拉落库（exp-act-pick）+ 进入军事行动读唯一出口
# 跑法：python .workbuddy/tools/patch/v89142_b2_main.py
import io
P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/main.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

rep(
    """      case 'exp-act-target': ui._actTarget = Number(el.value) || 0; break;
      case 'exp-act-go': {
        var _atl = ui.actTargetsOf(GAME.currentCity());
        var _at = _atl[Number(ui._actTarget) || 0];
        if (!_at) { ui.toast('请先选择目标'); break; }
        ui.openExpModal(_at.tg);
        break;
      }""",
    """      /* v89.142（老板 2）：目标分 5 类、每类一个下拉 —— 选中项**落库**（ui._actPick），
         提交端读同一个出口（ui.actPickOf）—— 不许"看着像选中、提交时另算一个"。 */
      case 'exp-act-pick': ui._actPick = { grp: el.dataset.grp || '', idx: Number(el.value) || 0 }; break;
      case 'exp-act-go': {
        var _pk142 = ui.actPickOf();
        if (!_pk142) { ui.toast('请先选择目标'); break; }
        ui.openExpModal(_pk142.tg);
        break;
      }""",
    '目标下拉/进军事行动')

rep(
    """         「进入军队行动」（exp-act-go，经 ui.actTargetsOf 覆盖 fort/city/own/wild""",
    """         「进入军事行动」（exp-act-go，经 ui.actTargetGroups/actPickOf 覆盖 5 类目标""",
    '注释')

assert "case 'exp-act-target'" not in s
assert s.count("case 'exp-act-pick'") == 1
assert 'ui.actPickOf()' in s
assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}'))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE main.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
