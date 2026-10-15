# -*- coding: utf-8 -*-
# v89.150（老板 3）：战报正文三块（战斗总结 / 战斗收获 / 兵种损耗）——
#   删「分回合回放」「回合纪要」两板块 + 整条退役回放控制函数
import io, re

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()


def cut(i, j, tag, expect=None):
    """按字符区间切除（配平/锚点定位后使用）——切除后立刻落盘"""
    global s
    assert 0 < i < j <= len(s), '区间非法 [' + tag + ']'
    dead = s[i:j]
    if expect:
        assert expect in dead, '区间不含预期特征 [' + tag + ']'
    s = s[:i] + s[j:]
    assert '\r\n' not in s, 'CRLF [' + tag + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('CUT ' + tag + '  (-' + str(len(dead)) + ')')
    return dead


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    assert '\r\n' not in s, 'CRLF [' + tag + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK ' + tag)


# ============ ① 删回放控制块（ui._repId … ui.replayJump 的整段） ============
A = """  /* ============================================================
   * v89.94（B2 · E3）：战报**分回合回放** —— 逐帧 / 播放 / 关键帧跳转"""
B = """  /* ============================================================
   * v89.102（老板需求 2）：战报**沙盘**（固定沙盘 · 逐兵种逐帧）"""
i = s.find(A); j = s.find(B, i)
if i < 0:
    print('SKIP(已落) ① 回放控制块')
else:
    assert j > i
    cut(i, j, '① 回放控制块', expect='ui.replayToggle = function')

# ============ ② 删三处调用 ============
rep("""    if (ui.btTeardown) ui.btTeardown();
    if (ui.replayStop) ui.replayStop();      /* v89.94：关窗即停战报回放（不留空转定时器） */
    if (ui.sdStop) ui.sdStop();              /* v89.102：沙盘播放同样关窗即停 */""",
    """    if (ui.btTeardown) ui.btTeardown();
    /* ⛔ v89.150（老板 3）：`ui.replayStop()`（关窗即停战报回放）随「分回合回放」板块一并退役 */
    if (ui.sdStop) ui.sdStop();              /* v89.102：沙盘播放同样关窗即停 */""",
    '②-1 closeModal 钩子')

rep("""    if (!rep) return;
    ui.replayStop();
    ui.sdStop();
    ui._repId = rid;""",
    """    if (!rep) return;
    ui.sdStop();
    ui._repId = rid;""",
    '②-2 openSandbox 钩子')

# ============ ③ 重写正文页（stripBodyDup + viewReportText → 新三块） ============
NEW = '''  /* ============================================================
   * v89.150（老板 3）：「战报正文里不要**分回合回放**、**回合纪要**这 2 个板块。
   *   保留/设置：**战斗总结，战斗收获，兵种损耗**。其中目前的战斗总结和收获太杂乱了，
   *   组织一下分类分行呈现」
   * ------------------------------------------------------------
   * 改前：正文是一整块灰底文本（主文＋经验＋声望＋事件＋战利品全混在一起），
   *   下面接「分回合回放」「回合纪要」「兵种损耗」三块 —— 前两块逐回合刷屏。
   * 改后只剩**三块**，且前两块分类分行：
   *   ① 战斗总结 —— 每行一条（胜负 / 将领 / 回合 / 双方损失 + 斗将·计谋·撤退·围攻）
   *   ② 战斗收获 —— **两列网格（类别 │ 内容）**：经验 / 声望 / 战利品 / 材料 / 军械 /
   *      俘虏 / 运力 / 备注 —— 一行一类，扫读即可
   *   ③ 兵种损耗 —— 结构化表（原样保留）
   * 分段走唯一出口 `ui.reportSectOf`（正文格式由 battle.js 的 reportText/report 一处生成，
   * 新档旧档同一把尺 —— 不解析结构化字段之外的任何东西）。
   * ============================================================ */
  /* 一行 → { label, body }：前缀形式「XXX：内容」拆两列；声望这类带 HTML 的行按文本判类。
     ⚠️ 前缀正则排除 `<` 与 `：`，保证只吃**纯文本前缀**（不误吞 HTML 标签里的冒号）。 */
  ui.reportSplitLine = function (t) {
    var s2 = String(t || '');
    var m = s2.match(/^([^：:<]{1,8})：\\s*([\\s\\S]*)$/);
    if (m) return { label: m[1], body: m[2] };
    var plain = s2.replace(/<[^>]+>/g, '');
    if (/声望/.test(plain)) return { label: '声望', body: s2 };
    if (/经验/.test(plain)) return { label: '经验', body: s2 };
    return { label: '', body: s2 };
  };
  /* 正文 → 四段（唯一出口）：
       summary = 主文（胜负/将领/回合/损失）+ 不带标记的续行
       events  = 【斗将】【计谋】【撤退】【围攻】（分行、带标记）
       loss    = 【兵种损耗】段（渲染另有结构化表，此处只做归类）
       gain    = 【战利品】段（按「；」拆行）+ 经验/声望两行 */
  ui.reportSectOf = function (r) {
    var raw = String((r && r.body) || '');
    var segs = raw.split(/<br\\s*\\/?>/i);
    var out = { summary: [], events: [], loss: [], gain: [] };
    var cur = 'summary';
    segs.forEach(function (seg) {
      var t = String(seg || '').trim();
      if (!t) return;
      var m = t.match(/^【([^】]+)】([\\s\\S]*)$/);
      if (m) {
        var tag = m[1], rest = m[2];
        cur = (tag === '兵种损耗') ? 'loss' : (tag === '战利品' ? 'gain' : 'events');
        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行" */
          rest.split('；').forEach(function (x) { if (String(x).trim()) out.gain.push(String(x).trim()); });
        } else if (cur === 'loss') {
          out.loss.push(rest);
        } else {
          out.events.push('【' + tag + '】' + rest);
        }
        return;
      }
      /* 经验 / 声望两行（reportText 的 line4/line5）不带【】标记 → 按文本特征归**收获** */
      if (cur === 'summary' && (/^经验：/.test(t) || /声望<\\/span> \\+/.test(t))) { out.gain.unshift(t); return; }
      out[cur].push(t);
    });
    return out;
  };
  ui.reportLinesHTML = function (lines, cls) {
    return '<div class="rp-lines ' + (cls || '') + '">' + (lines || []).map(function (t) {
      return '<div class="rp-line">' + t + '</div>';
    }).join('') + '</div>';
  };
  ui.reportGainHTML = function (lines) {
    if (!lines || !lines.length) {
      return '<div class="rp-lines"><div class="rp-line" style="color:var(--text-dim);">（此役无收获）</div></div>';
    }
    return '<div class="rp-gain">' + lines.map(function (t) {
      var sp = ui.reportSplitLine(t);
      return '<div class="rp-glabel">' + U.escape(sp.label) + '</div>' +
        '<div class="rp-gtext">' + sp.body + '</div>';
    }).join('') + '</div>';
  };

  ui.viewReportText = function (rid) {
    var r = GAME.repByRid(rid);              /* v89.120：按稳定身份取（数组位移不再错位） */
    if (!r) return;
    /* v89.102：正文页是"沙盘不可用"时的落脚点 —— 把原因写在最上面，
       不让玩家以为"回放功能坏了"（旧档战报没有配方 / 重跑与史实不一致）。 */
    var _sbNow = null;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      try { _sbNow = GAME.battle.sandboxOf(r); } catch (e) { _sbNow = null; }
    }
    ui._repId = rid;
    var _sect150 = ui.reportSectOf(r);
    var html = (_sbNow ? '' : (r.sandbox ? ui.sdUnavailable(r) : '')) +
      '<div class="gold-heading">' + U.escape(r.title) + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        new Date(r.t).toLocaleString() + '</div>';

    /* v89.94（B2 · E3）：以少胜多（以弱胜强才值得晒）+ 围攻战果（还差多少） */
    if (r.underdog) html += '<div class="rp-under">🏅 以少胜多 —— 此役以弱胜强，宜入简册</div>';
    if (r.siege) {
      html += '<div class="rp-under">🧱 围攻：本波破防 ' + r.siege.chip + '% → 守备余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）</div>';
    }

    /* ---- ① 战斗总结（分类分行） ---- */
    html += ui.sealH('战斗总结', '胜负 · 将领 · 回合 · 双方兵力');
    html += ui.reportLinesHTML(_sect150.summary, 'rp-sum');
    if (_sect150.events.length) html += ui.reportLinesHTML(_sect150.events, 'rp-evts');

    /* ---- ② 战斗收获（两列：类别 │ 内容） ---- */
    html += ui.sealH('战斗收获', '经验 · 声望 · 战利品');
    html += ui.reportGainHTML(_sect150.gain);

    /* ---- ③ 兵种损耗表（初始 → 剩余，逐项核对） ---- */
    var bk = ui._reportLoss(r);
    if (bk) {
      html += ui.sealH('兵种损耗', '初始 → 剩余（损失）');
      html += '<table class="tbl rp-tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
        '<th>我方剩余</th><th>敌军初始</th><th>敌军损失</th><th>敌军剩余</th></tr></thead><tbody>';
      bk.ids.forEach(function (id) {
        var nm = DATA.TROOPS[id] ? DATA.TROOPS[id].name : id;
        html += '<tr><td>' + nm + '</td>' +
          '<td class="num">' + U.numText(bk.as[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--red-light);">' + (bk.al[id] ? '−' + U.numText(bk.al[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.as[id] || 0) - (bk.al[id] || 0), 0) + '</td>' +
          '<td class="num">' + U.numText(bk.ds[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--green-ok);">' + (bk.dl[id] ? '−' + U.numText(bk.dl[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.ds[id] || 0) - (bk.dl[id] || 0), 0) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    /* v89.102（老板「侦查报告不要自动冒出来」）：侦查公文里留一个**手动入口** ——
       自动弹窗退役了，但"当场那份分层情报"（已解锁的准确值 + 未解锁的锁定行）
       必须还能一键看全，否则等于把功能删了。 */
    if (r.type === 'scout' && r.scout) {
      html += '<div style="text-align:center;margin-top:12px;">' +
        '<button class="btn gold" data-action="scout-open">🔭 展开侦查面板（分层情报）</button></div>';
    }

    /* v89.102（老板「战斗报告的界面大一点」）：沙盘入口摆在最上面（一仗打完先看怎么打的），
       正文页也升到 xxl 档 */
    if (r.sandbox) {
      html = '<div style="text-align:center;margin:0 0 8px;">' +
        '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>' +
        '</div>' + html;
    }
    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    /* v89.112（老板：「小小弹窗，一堆右侧下拉条」）：战报详情**一律 xxl** ——
       旧逻辑只对 war 用 xxl，defense/scout 落在默认 md(660×620)：
       防战报（总结 + 收获 + 损耗表）在 md 里溢出且**双层滚动**。
       v89.150（老板 3）：删掉回放/纪要两块后信息量下降，但仍保留 tall（长战报不挤）。 */
    ui.openModal(html, { size: 'xxl', tall: true });
  };

'''
i = s.find('  ui.stripBodyDup = function')
j = s.find('  /* v89.102：战报入口路由', i)
assert i > 0 and j > i, (i, j)
old_len = j - i
s = s[:i] + NEW + s[j:]
assert '\r\n' not in s
_code = re.sub(r'/\*[\s\S]*?\*/', '', s)      # 剥块注释（墓碑里写着旧函数名，§62.4）
assert 'ui.stripBodyDup' not in _code, '旧 stripBodyDup 残留'
assert s.count('ui.reportSectOf = function') == 1
assert s.count('ui.viewReportText = function') == 1
assert 'ui.replayStop' not in _code and 'ui.replaySectionHTML' not in _code
assert 'ui.replaySet' not in _code and 'ui.replayToggle' not in _code
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK ③ 正文页重写  (-' + str(old_len) + ' +' + str(len(NEW)) + ')')

print('ALL OK · len=' + str(len(s)))
