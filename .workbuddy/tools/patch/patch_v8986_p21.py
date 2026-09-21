# -*- coding: utf-8 -*-
"""v89.86 整改 · P-21 门派任务连做（×10 / 一键做完）
   背景：40 次/日的每日限额逐次单点（实测连做 40 次杂役全程手动）。
   修法：doSectTaskBulk 复用单次出口逐次调用（不预检、以实际结算为准），
        汇总一条 toast；次数/日额/资源三重停止条件。
"""
import io
import os
import sys

DO = r'E:\Deepseekdb\js\domain.js'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'


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


# ① domain：批量入口
edit(DO, r"""    if (nx && st.rep >= nx.rep) up = '　🎉 晋升「' + nx.name + '」';
    return { ok: true, msg: def.name + '　声望 +' + gain + '（共 ' + U.fmt(st.rep) + '）' + up, rep: gain };
  };""",
     r"""    if (nx && st.rep >= nx.rep) up = '　🎉 晋升「' + nx.name + '」';
    return { ok: true, msg: def.name + '　声望 +' + gain + '（共 ' + U.fmt(st.rep) + '）' + up, rep: gain };
  };

  /* v89.86（整改 P-21）：门派任务**连做**入口 —— 复用单次出口逐次调用，
     停止条件三重：次数用尽（n）/ 日额用尽 / 资源不够（以实际结算为准，不预检保证口径一致）。
     n <= 0 视为「一键做完」= 按当前剩余日额。 */
  GAME.doSectTaskBulk = function (tid, n) {
    var left0 = GAME.sectTaskLeftToday();
    var max = (Number(n) > 0) ? Math.min(Math.floor(Number(n)), left0) : left0;
    if (max <= 0) return { ok: false, count: 0, rep: 0, msg: '今日门派任务已满 ' + DATA.SECT_TASK_PER_DAY + ' 件，明日再来' };
    var done = 0, rep = 0, stopReason = '', promo = '';
    for (var i = 0; i < max; i++) {
      var r = GAME.doSectTask(tid);
      if (!r.ok) { stopReason = r.msg; break; }
      done++; rep += (r.rep || 0);
      if (r.msg.indexOf('晋升') >= 0) {
        var pm = r.msg.match(/🎉\s*晋升「([^」]+)」/);
        if (pm) promo = '🎉 晋升「' + pm[1] + '」';
      }
    }
    var def = null;
    (DATA.SECT_TASKS || []).forEach(function (x) { if (x.id === tid) def = x; });
    var name = def ? def.name : tid;
    if (!done) return { ok: false, count: 0, rep: 0, msg: stopReason || '未能完成' };
    return { ok: true, count: done, rep: rep, stopped: !!stopReason, stopReason: stopReason,
      msg: name + ' ×' + done + '　声望 +' + rep
        + (promo ? '　' + promo : '')
        + (stopReason ? '（' + stopReason + '）' : '') };
  };""",
     'P-21 · doSectTaskBulk')

# ② ui：任务行加两颗连做按钮
edit(UI, r"""        html += '<div class="op-row" style="display:block;">' +
          '<div><b>' + U.escape(t.name) + '</b>　<span class="ui-sub">声望 +' + gain +
            '　·　' + GAME.costString(t.cost) + '</span></div>' +
          '<div class="op-hint">' + U.escape(t.desc) + '</div>' +
          '<button class="btn' + (can ? ' gold' : '') + '" data-action="sect-task" data-v="' + t.id + '"' +
            (can ? '' : ' disabled') + '>去做</button>' +
          '</div>';""",
     r"""        html += '<div class="op-row" style="display:block;">' +
          '<div><b>' + U.escape(t.name) + '</b>　<span class="ui-sub">声望 +' + gain +
            '　·　' + GAME.costString(t.cost) + '</span></div>' +
          '<div class="op-hint">' + U.escape(t.desc) + '</div>' +
          /* v89.86（整改 P-21）：连做 —— 复用「去做」同一出口逐次调用，结算汇总一条 toast */
          '<span style="display:inline-flex;gap:6px;align-items:center;">' +
          '<button class="btn' + (can ? ' gold' : '') + '" data-action="sect-task" data-v="' + t.id + '"' +
            (can ? '' : ' disabled') + '>去做</button>' +
          '<button class="btn sm" data-action="sect-task-bulk" data-v="' + t.id + '" data-n="10"' +
            (can ? '' : ' disabled') + '>连做 ×10</button>' +
          '<button class="btn sm" data-action="sect-task-bulk" data-v="' + t.id + '" data-n="0"' +
            (can ? '' : ' disabled') + ' title="按今日剩余次数连续执行，直到日额用尽或资源不够">一键做完</button>' +
          '</span>' +
          '</div>';""",
     'P-21 · 任务行连做按钮')

# ③ main：处理
edit(MA, r"""      case 'sect-task': {
        var _sk = GAME.doSectTask(el.dataset.v); ui.toast(_sk.msg);
        if (_sk.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }""",
     r"""      case 'sect-task': {
        var _sk = GAME.doSectTask(el.dataset.v); ui.toast(_sk.msg);
        if (_sk.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }
      /* v89.86（整改 P-21）：门派任务连做（×10 / 一键做完）—— 汇总一条 toast，面板重开刷次数 */
      case 'sect-task-bulk': {
        var _rb = GAME.doSectTaskBulk(el.dataset.v, Number(el.dataset.n) || 0);
        ui.toast((_rb.ok ? '✅ ' : '⏸ ') + _rb.msg);
        if (_rb.ok) GAME.refreshAll();
        ui.openSect();
        break;
      }""",
     'P-21 · main 处理')

print('DONE')
