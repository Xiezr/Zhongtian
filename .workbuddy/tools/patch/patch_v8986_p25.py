# -*- coding: utf-8 -*-
"""v89.86 整改 · P0 竞态：P-25 行军抵达「军账守恒」
   问题：600× 发兵占领据点时偶发"战斗/战报未生成 + 军队去向异常"。
   实测根因（探针复现）：`march.arrive` → `expedition` → `prepare` 在抵达时
   重新解析目标，若目标在途中熄灭（据点当日被拔除 / 城池被夺），返回 !ok 后
   **dispatch 时已扣的兵没有任何归还路径** —— 兵凭空消失、无日志无战报。
   同类洞：侦查带兵不归还（带兵侦查=丢兵）；结算抛异常直接炸穿 tick。
   修法：`_expArmySettled` 军账标记 + arrive 失败兜底折返（防双重回补）。
"""
import io
import os
import sys

B = r'E:\Deepseekdb\js\battle.js'
M = r'E:\Deepseekdb\js\main.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① 文件级军账标记
edit(B, r"""  GAME.battle = {};
""",
     r"""  GAME.battle = {};

  /* v89.86（整改 P-25）：行军队列抵达结算的「军账守恒」标记 ——
     dispatch 时兵力已扣离本城；此后无论结算成功、目标熄灭还是中途异常，
     兵力都必须有去向（归城 / 驻军 / 伤兵营）。
     `GAME.march.arrive` 在结算前置 false；`GAME.battle.expedition` 在归还点置 true；
     arrive 的失败兜底读它决定是否把兵原路退回（防双重回补）。
     全链路同步执行，不存在跨帧残留。 */
  var _expArmySettled = true;
""",
     'P-25 · 军账标记定义')

# ② 侦查分支：抵达时随行兵力归城
edit(B, r"""      })();
      return {
        ok: true, mode: mode.id, result: { winner: 'scout' },""",
     r"""      })();
      /* v89.86（整改 P-25）：行军队列抵达的侦查 —— dispatch 时随行兵力已扣离本城，
         而侦查不接战，随行者须原路归城（修复前"带兵侦查 = 凭空丢兵"）。 */
      if (opts.arrived) {
        var _cS = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
        var _aS = 0;
        for (var _kS in atkArmy) _aS += (atkArmy[_kS] || 0);
        if (_cS && _aS > 0) GAME.battle.returnArmy(_cS, atkArmy, { atkRemain: _aS });
        _expArmySettled = true;      /* 军账已结（随行者归城 / 本就无兵） */
      }
      return {
        ok: true, mode: mode.id, result: { winner: 'scout' },""",
     'P-25 · 侦查随行兵力归城')

# ③ 派遣（station）分支：军账已结
edit(B, r"""      GAME.log('🛡️ ' + t.name + '：' + _stMsg
        + (_ga.overflow && Object.keys(_ga.overflow).length ? '；超出驻军上限者已回城' : ''));
      return {""",
     r"""      GAME.log('🛡️ ' + t.name + '：' + _stMsg
        + (_ga.overflow && Object.keys(_ga.overflow).length ? '；超出驻军上限者已回城' : ''));
      _expArmySettled = true;      /* v89.86（P-25）：军账已结（驻军 / 溢出均已落地） */
      return {""",
     'P-25 · 派遣分支军账结清')

# ④ 战斗路径：returnArmy 之后军账已结
edit(B, r"""        _stAdd = _gb.add || 0;
      } : null);
    }
    var backN = 0, woundN = 0;""",
     r"""        _stAdd = _gb.add || 0;
      } : null);
    }
    _expArmySettled = true;      /* v89.86（P-25）：军账已结（幸存者 / 伤兵均已入账） */
    var backN = 0, woundN = 0;""",
     'P-25 · 战斗路径军账结清')

# ⑤ march.arrive：失败/异常兜底折返
edit(B, r"""    var r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
      { arrived: true, cityId: m.cityId, scheme: m.scheme || null });
    if (gen.status === 'march') gen.status = 'idle';
    if (r && r.result && r.result.winner === 'scout') {
      GAME.log('🔭 ' + gen.name + ' 侦察归来：' + m.name);
    }
    if (GAME.onMarchArrive) GAME.onMarchArrive(m, r);
    return r;
  };""",
     r"""    /* v89.86（整改 P-25）：军账守恒护栏 —— 详见 `_expArmySettled` 定义。
       抵达结算失败（目标在途中熄灭：据点当日已拔除 / 城池被夺 …）或抛异常时，
       把仍挂在行军账上的兵力原路退回，绝不让"派出去的兵"凭空消失。 */
    _expArmySettled = false;
    var r = null, err = null;
    try {
      r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
        { arrived: true, cityId: m.cityId, scheme: m.scheme || null });
    } catch (e) { err = e; }
    if (gen.status === 'march') gen.status = 'idle';
    if (err || !r || r.ok === false) {
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in m.army) city.army[aR] = (city.army[aR] || 0) + m.army[aR];
        rolled = true;
      }
      _expArmySettled = true;
      var whyR = err ? '结算异常' : ((r && r.msg) || '目标已不存在');
      GAME.log('⚠️ ' + m.name + ' 方向进军中止（' + whyR + '）：'
        + (rolled ? '大军原路折返 ' + city.name : '军账已结，兵已入城 / 伤兵营'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[march.arrive] 抵达结算异常：', err);
      if (GAME.onMarchArrive) {
        GAME.onMarchArrive(m, { ok: false, rolled: rolled, msg: whyR, err: err ? String((err && err.message) || err) : null });
      }
      return { ok: false, rolled: rolled, msg: whyR };
    }
    if (r.result && r.result.winner === 'scout') {
      GAME.log('🔭 ' + gen.name + ' 侦察归来：' + m.name);
    }
    if (GAME.onMarchArrive) GAME.onMarchArrive(m, r);
    return r;
  };""",
     'P-25 · arrive 失败兜底折返')

# ⑥ main.js：失败折返给一条可见回执
edit(M, r"""    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    }""",
     r"""    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    } else if (r.rolled) {
      /* v89.86（整改 P-25）：抵达结算失败、兵力已折返 —— 给玩家一条看得见的回执
         （此前这条路径完全静默，玩家只会发现"兵不见了"） */
      ui.toast('⚠️ ' + m.name + '：' + (r.msg || '目标已不存在') + '，大军折返');
    }""",
     'P-25 · 折返回执 toast')

src = read(B)
print('battle.js: _expArmySettled 出现 %d 次' % src.count('_expArmySettled'))
