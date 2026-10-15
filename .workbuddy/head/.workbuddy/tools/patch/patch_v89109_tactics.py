# -*- coding: utf-8 -*-
"""v89.109：domain.js 战术段重写 —— 分侧（atk/def）+ sortie（出城迎战）+ 老档迁移"""
import io, os, shutil
p = r'E:/Deepseekdb/js/domain.js'
BK = r'E:/Deepseekdb/.workbuddy/backup'
shutil.copy2(p, os.path.join(BK, 'domain.v89108.js'))
s = io.open(p, encoding='utf-8').read()

i = s.index('  /* ============================================================\n   * 出征战术（v59')
j2mark = "msg: '已恢复默认战术（全军前进）'"
# ⚠️ 不能找第一个 '};' —— clearTactics 体内 `GAME.state.tactics = {};` 就含 `};`，
#    会切早、留下残片（本轮真踩：语法报 Unexpected token ';'）。
#    必须找"函数结尾"的带缩进形态：'\n  };'
_j = s.index(j2mark)
j2 = s.index('\n  };', _j) + len('\n  };')

new = '''  /* ============================================================
   * 战术（v59 出征 · v89.109 分侧：出征战术 + **防守战术**）
   * ------------------------------------------------------------
   * 每兵种：动作（前进/防御/后退）+ 目标（敌方兵种 id 或 `_tower` = 箭塔）
   *   + **防守侧专属**「是否出城迎战」（sortie）—— 出城迎战 = 前出到城墙之外迎敌，
   *     把前线前移、阻敌近墙（战场引擎里 adv 前移到 `T.SORTIE_ADV`）。
   * · 攻方：读玩家「军务 · 出征 / 校场 → 出征战术」的设置（side='atk'）；
   * · 守方：**我方城池被攻打时**读玩家「军务 · 防守」的设置（side='def'，ctx.playerDef）；
   *   NPC 守方仍用默认动作（攻城固守 / 野地迎击）—— 与 v59 口径一致。
   * 非法值一律回落默认 —— 否则单位行位会变成 NaN，整场战斗静默跑坏。
   * ⚠️ 老档迁移：v89.109 前 `s.tactics` 是**单一表**（只服务出征）→ 归入 atk 侧，
   *   由 `tacticsOf` 惰性完成（首次访问时迁移；不另写启动钩子）。
   * ============================================================ */
  GAME.tacticsOf = function (side) {
    var s = GAME.state;
    if (!s) return {};
    var T = s.tactics || {};
    if (!T.atk && !T.def) {                      /* 老档（{兵种:{s,t}}）→ 归 atk 侧 */
      var legacy = {};
      Object.keys(T).forEach(function (k) {
        if (T[k] && typeof T[k] === 'object') legacy[k] = T[k];
      });
      s.tactics = { atk: legacy, def: {} };
      T = s.tactics;
    }
    T.atk = T.atk || {};
    T.def = T.def || {};
    return side === 'def' ? T.def : T.atk;
  };
  GAME.tacticOf = function (side, troopId, ctx) {
    var d = (DATA.STANCE_DEFAULT || {})[side] || 'advance';
    if (side === 'def') {
      if (ctx && ctx.sieging) d = (DATA.STANCE_DEFAULT || {}).siege || 'hold';
      /* v89.109：**我方城**作守方（ctx.playerDef）→ 用玩家的防守战术；
         NPC 守方仍走默认（不读玩家设置，否则"我的战术给别人用"）。 */
      var mD = (ctx && ctx.playerDef && troopId) ? GAME.tacticsOf('def')[troopId] : null;
      if (mD) {
        var sidD = null;
        (DATA.STANCES || []).forEach(function (x) { if (mD.s === x.id) sidD = x.id; });
        return { s: sidD || d, t: (typeof mD.t === 'string') ? mD.t : '', sortie: !!mD.sortie };
      }
      return { s: d, t: '', sortie: false };
    }
    var m = GAME.tacticsOf('atk')[troopId];
    var sid = null;
    (DATA.STANCES || []).forEach(function (x) { if (m && m.s === x.id) sid = x.id; });
    return { s: sid || d, t: (m && typeof m.t === 'string') ? m.t : '',
      sortie: !!(m && m.sortie) };
  };
  /* 写战术 —— 双签名（v89.109 起支持按侧；旧调用一字不改）：
       setTactic(troopId, patch)          出征战术（v59 旧签名）
       setTactic('def', troopId, patch)   按侧写入 */
  GAME.setTactic = function (a, b, c) {
    var side = 'atk', troopId, patch;
    if (a === 'atk' || a === 'def') { side = a; troopId = b; patch = c; }
    else { troopId = a; patch = b; }
    if (!DATA.TROOPS[troopId]) return { ok: false, msg: '兵种不存在' };
    patch = patch || {};
    var T = GAME.tacticsOf(side);
    var cur = T[troopId] || {};
    if (patch.s !== undefined) {
      var ok = false;
      (DATA.STANCES || []).forEach(function (x) { if (x.id === patch.s) ok = true; });
      if (ok) cur.s = patch.s;
    }
    if (patch.t !== undefined) cur.t = String(patch.t || '');
    if (patch.sortie !== undefined) cur.sortie = !!patch.sortie;    /* v89.109：出城迎战 */
    T[troopId] = cur;
    return { ok: true };
  };
  /* 当前战术的一句话摘要（页面/弹窗用）—— 与"设了什么"一一对应，不是固定文案 */
  GAME.tacticSummary = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var m = GAME.tacticsOf(side);
    var ids = Object.keys(m);
    if (!ids.length) return side === 'def' ? '未设（默认：迎击 / 攻城固守）' : '全体前进（默认）';
    var n = {};
    var defS = (DATA.STANCE_DEFAULT || {})[side] || 'advance';
    ids.forEach(function (id) {
      var mD = m[id], sid = null;
      (DATA.STANCES || []).forEach(function (x) { if (mD && mD.s === x.id) sid = x.id; });
      var sr = sid || defS;
      n[sr] = (n[sr] || 0) + 1;
    });
    var parts = [];
    (DATA.STANCES || []).forEach(function (x) { if (n[x.id]) parts.push(n[x.id] + ' 种' + x.name); });
    if (side === 'def') {
      var sc = 0;
      ids.forEach(function (id) { if (m[id] && m[id].sortie) sc++; });
      if (sc) parts.push(sc + ' 种出城迎战');
    }
    return parts.join(' · ');
  };
  GAME.clearTactics = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var T = GAME.tacticsOf(side);
    /* 原地清空（别换对象 —— 别处可能持有引用） */
    Object.keys(T).forEach(function (k) { delete T[k]; });
    return { ok: true,
      msg: side === 'def'
        ? '已恢复默认防守战术（全体迎击 / 攻城固守）'
        : '已恢复默认战术（全军前进）' };
  };'''

s = s[:i] + new + s[j2:]
io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('domain.js 战术段已重写；新段行数 =', new.count('\n') + 1)
