# -*- coding: utf-8 -*-
"""v89.155 补丁 C+D：main.js（召回上膛三态 case）+ domain.js（extStoreCapOneOf + 采集消息归位）。
分段落盘 + 显式幂等守卫 + strip 自检。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
def strip_js(t):
    t = t.replace('\\(', '').replace('\\)', '').replace('\\{', '').replace('\\}', '')
    t = re.sub(r'/\*[\s\S]*?\*/', '', t)
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)
    t = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return t
def seg_apply(P, tag, old, new, guard):
    s = rd(P)
    if guard in s:
        print(tag, 'skip'); return
    assert s.count(old) == 1, tag + ' anchor count=' + str(s.count(old))
    s = s.replace(old, new)
    wr(P, s)
    assert guard in rd(P), tag + ' write failed'
    print(tag, 'OK')

# ================= C：main.js =================
MC_OLD = u"""      case 'wild-withdraw': {
        /* ============================================================
         * v89.138（老板 0/2）：全站「召回」= **撤回驻军（军队回城）**，
         * 且改**两段确认**（上膛式）—— 召回会让采集进度作废、驻军清空，
         * 是"点下去就回不去"的动作；先上膛（改文案 + 警告），再点一次才执行。
         * ============================================================ */
        var _wx138 = Number(el.dataset.x), _wy138 = Number(el.dataset.y);
        var _wk138 = _wx138 + ',' + _wy138;
        if (ui._wdArm138 !== _wk138) {
          ui._wdArm138 = _wk138;
          el.innerHTML = '⚠️ 再点一次 —— 撤军回城（采集中断）';
          ui.toast('⚠️ 撤回驻军：兵与将随之回城，采集进度作废 —— 再点一次执行');
          break;
        }
        ui._wdArm138 = null;
        var wr = GAME.doWildWithdraw(_wx138, _wy138);
        ui.toast(wr.msg);
        if (wr.ok) { ui.openLandModal(_wx138, _wy138); GAME.refreshAll(); }
        break;
      }"""
MC_NEW = u"""      case 'wild-withdraw': {
        /* ============================================================
         * v89.155（老板 2）：召回改「**第一次变黄 → 第二次执行 → 变无驻军绿**」，
         *   2 秒内无第二次点击则自动回落红色（DATA.WD_ARM_MS）。
         *   · 第一次点击只上膛（按钮变黄），**不弹任何说明/文字窗**（老板：
         *     「就不要显示一大段说明或者文字弹窗了」）—— 旧版的长 toast 退役；
         *   · 执行后**不再弹地块面板**（老板：「召回后不要弹窗己方小野地界面，
         *     直接执行召回即可」）—— 列表/面板的 live 逐秒刷新自然切到无驻军形态，
         *     按钮经 wdRepaint 就地变绿；
         *   · 按钮三态渲染唯一出口 = ui.wildWdBtnHTML（本处只改状态 + 触发重绘）。
         * ============================================================ */
        var _wx155 = Number(el.dataset.x), _wy155 = Number(el.dataset.y);
        var _wk155 = _wx155 + ',' + _wy155;
        if (ui._wdArm138 !== _wk155) {
          ui._wdArm138 = _wk155;
          if (ui._wdArmTimer155) clearTimeout(ui._wdArmTimer155);
          ui._wdArmTimer155 = setTimeout(function () {
            if (ui._wdArm138 !== _wk155) return;
            ui._wdArm138 = null; ui._wdArmTimer155 = null;
            ui.wdRepaint(_wx155, _wy155);        /* 2 秒无第二次点击 → 回落（红 / 绿） */
          }, DATA.WD_ARM_MS || 2000);
          ui.wdRepaint(_wx155, _wy155);          /* 立即变黄（就地重绘，唯一出口） */
          break;
        }
        if (ui._wdArmTimer155) { clearTimeout(ui._wdArmTimer155); ui._wdArmTimer155 = null; }
        ui._wdArm138 = null;
        var wr = GAME.doWildWithdraw(_wx155, _wy155);
        ui.toast(wr.msg);
        if (wr.ok) { ui.wdRepaint(_wx155, _wy155); GAME.refreshAll(); }
        break;
      }"""
seg_apply('js/main.js', 'C', MC_OLD, MC_NEW, u'ui._wdArmTimer155')

# ================= D：domain.js =================
DD_OLD = u"""    return Math.round(lvSum * (DATA.BASE_STORE || 2000000) / DIV);
  };

  /* --------- 市场：等级与交易折损"""
DD_NEW = u"""    return Math.round(lvSum * (DATA.BASE_STORE || 2000000) / DIV);
  };
  /* 单块堆场贡献（**显示用**，v89.155 老板 5）—— 城外面板「另加仓储上限 +Y」。
     口径与总量（extStoreCapOf）同尺：单块 = 等级 × BASE_STORE ÷ DIV。
     ⚠️ 总量在"总和"上取整一次、本函数逐块取整 —— 多块相加与总量可能差几（≤块数），
     只用于**展示**；结算唯一出口仍是 extStoreCapOf。 */
  GAME.extStoreCapOneOf = function (e) {
    var DIV = DATA.EXT_STORE_DIV || 0;
    if (DIV <= 0 || !e || !e.type) return 0;
    return Math.round(Math.max(0, e.lv || 0) * (DATA.BASE_STORE || 2000000) / DIV);
  };

  /* --------- 市场：等级与交易折损"""
seg_apply('js/domain.js', 'D1', DD_OLD, DD_NEW, u'GAME.extStoreCapOneOf = function')

D2_OLD = u"    GAME.log('🌾 自动采集/收获：' + msg, 'war');"
D2_NEW = u"    /* v89.155（老板 1）：采集类消息归「采集收获」主题 —— 原先误标 'war'（军情）→\n       老板在系统页看到\"采集收获与军情两处重合\"的根源，此处归位。 */\n    GAME.log('🌾 自动采集/收获：' + msg, 'sys', 'gather');"
seg_apply('js/domain.js', 'D2', D2_OLD, D2_NEW, u"('🌾 自动采集/收获：' + msg, 'sys', 'gather')")

D3_OLD = u"    if (n) GAME.log('🧭 老档采集队迁移完成：' + n + ' 支（兵力已归驻军，采集照常 · 原地开工）', 'war');"
D3_NEW = u"    /* v89.155（老板 1）：老档迁移提示 = 一次性系统通知 → 归「系统」（原 'war' 会混进军情） */\n    if (n) GAME.log('🧭 老档采集队迁移完成：' + n + ' 支（兵力已归驻军，采集照常 · 原地开工）', 'sys');"
seg_apply('js/domain.js', 'D3', D3_OLD, D3_NEW, u"支（兵力已归驻军，采集照常 · 原地开工）', 'sys')")

# 自检
for P, bk, checks in [
    ('js/main.js', 'backup/v89155/main.js.before', [(u'ui._wdArmTimer155', 7), (u'DATA.WD_ARM_MS || 2000', 1)]),
    ('js/domain.js', 'backup/v89155/domain.js.before', [(u'GAME.extStoreCapOneOf = function', 1), (u"('🌾 自动采集/收获：' + msg, 'sys', 'gather')", 1)]),
]:
    s2 = rd(P)
    _bk = strip_js(rd(bk)); _sa = strip_js(s2)
    assert (_sa.count(u'{') - _sa.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), P + ' brace'
    assert (_sa.count(u'(') - _sa.count(u')')) == (_bk.count(u'(') - _bk.count(u')')), P + ' paren'
    for chk, n in checks:
        assert s2.count(chk) == n, P + ' :: ' + chk + ' = ' + str(s2.count(chk)) + ' != ' + str(n)
print('C+D all done')
