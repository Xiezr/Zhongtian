# -*- coding: utf-8 -*-
"""v89.137 补丁 J：
 ① index.html：战场回合记录区「下移到底 + 16 行」（原 max-height 196px ≈ 10 行）
 ② ui.js：兵种悬停显示最终属性（读 GAME.battle.unitFinalOf 唯一出口）+ BT_LOG_MAX 40→64
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

# ══════════ ① index.html：CSS ══════════
p1 = os.path.join(ROOT, 'index.html')
s1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
n1 = len(s1)

old = """  .bt-log { max-height: 196px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-body);
    margin-top: var(--sp-2); }"""
new = """  /* v89.137（老板 3）：「军队战斗界面下方空间未用完，回合记录下移到底。
     回合记录目前提供了 10 行的空间，可以考虑提供 16 行空间」——
     ① `#bt-wrap` 撑满面板正文（flex 列 + min-height:100%）；
     ② `.bt-log` 撤掉 196px 上限、改 `flex:1` 吃掉下方全部剩余空间（"下移到底"），
        并以 `min-height:336px` 保底 —— 实测行高 ≈21px × 16 行（原 196px ≈ 10 行）；
     ③ 极端载荷（兵种多、上方顶高）下由 `.inner-panel` 的既有滚动兜底。 */
  #bt-wrap { display: flex; flex-direction: column; min-height: 100%; }
  .bt-log { flex: 1 1 auto; max-height: none; min-height: 336px; overflow-y: auto;
    background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-body);
    margin-top: var(--sp-2); }"""
if os.environ.get('SKIP_HTML') == '1' or '#bt-wrap { display: flex' in s1:
    print('⏭  index.html 段跳过（SKIP_HTML=1 或已落盘）')
else:
  if s1.count(old) != 1:
    print('❌ index.html 锚点命中 %d 次' % s1.count(old)); sys.exit(1)
  s1 = s1.replace(old, new)
  if '#bt-wrap { display: flex' not in s1:
    print('❌ 替换未生效'); sys.exit(1)
  assert '\r\n' not in s1, '行尾混入 CRLF'
  tmp = p1 + '.tmp137'
  io.open(tmp, 'w', encoding='utf-8', newline='').write(s1)
  os.replace(tmp, p1)
  chk1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
  assert '#bt-wrap { display: flex' in chk1 and 'min-height: 336px' in chk1, '未落盘'
  ok.append('index.html 战场记录区')
  print('✅ index.html：%d → %d 字节' % (n1, len(chk1)))

# ══════════ ② ui.js：兵种悬停最终属性 + BT_LOG_MAX ══════════
p2 = os.path.join(ROOT, 'js', 'ui.js')
s2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
n2 = len(s2)

def rep(old, new, tag):
    global s2
    if s2.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s2.count(old))); sys.exit(1)
    s2 = s2.replace(old, new)
    ok.append(tag)

# 1) 新出口：ui.btUnitTip（最终属性文本 · 唯一读 GAME.battle.unitFinalOf）
rep(
"""  ui.btGenTip = function (g) {""",
"""  /* ============================================================
   * v89.137（老板 2）：「军队战斗界面，鼠标悬停兵种时，显示其**最终属性**
   *   （各种科技，将领等加成后）」——
   * 唯一出口 = GAME.battle.unitFinalOf（它再读引擎的 perAtk / perDef / perHp，
   * 悬停与结算同一把尺）；本函数只负责"取该单位所属方的将领 + 排版"。
   * 将领来源与 btGenLine 同源：我方 = rec.genId；敌方 = rec.sim.scGen。
   * ============================================================ */
  ui.btUnitTip = function (u, side) {
    if (!u) return '';
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var gen = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) gen = x; });
      } else {
        gen = (rec.sim && rec.sim.scGen) || null;
      }
    }
    var f = GAME.battle.unitFinalOf ? GAME.battle.unitFinalOf(u, gen) : null;
    if (!f) return u.name || '';
    var lines = [f.name + '　' + U.fmt(f.count) + ' 名（含科技 / 将领 / 装备加成）'];
    lines.push('攻 ' + U.fmt(f.atk) + (f.atk !== f.baseAtk ? '（基础 ' + f.baseAtk + '）' : ''));
    lines.push('防 ' + U.fmt(f.def) + (f.def !== f.baseDef ? '（基础 ' + f.baseDef + '）' : ''));
    lines.push('血 ' + U.fmt(f.hp) + (f.hp !== f.baseHp ? '（基础 ' + f.baseHp + '）' : ''));
    lines.push('射程 ' + U.fmt(f.range) + '　速度 ' + U.fmt(f.spd));
    lines.push('全军合计：攻 ' + U.fmt(f.totalAtk) + '　血 ' + U.fmt(f.totalHp));
    if (gen) lines.push('带队：' + gen.name + '（Lv' + (gen.level || 1) + '）');
    else lines.push('（无将领带队）');
    lines.push('相克 / 攻城等对局因子随目标变化，见兵种说明');
    return lines.join('\\n');
  };

  ui.btGenTip = function (g) {""",
'btUnitTip 出口')

# 2) 两侧列表：兵种行的 title 换完整属性
rep(
"""      return '<div class="bt-rrow' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-ric" title="' + U.escape(u.name) + '">' +""",
"""      return '<div class="bt-rrow' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        /* v89.137（老板 2）：悬停兵种 → 最终属性（唯一出口 ui.btUnitTip） */
        '<span class="bt-ric" title="' + U.escape(ui.btUnitTip(u, side)) + '">' +""",
'侧栏行 title')

# 3) 战场兵牌：同样的 title
rep(
"""      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'title="' + U.escape(u.name) + '" ' +""",
"""      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        /* v89.137（老板 2）：战场兵牌同享"最终属性"悬停（同一出口） */
        'title="' + U.escape(ui.btUnitTip(u, side)) + '" ' +""",
'兵牌 title')

# 4) BT_LOG_MAX 40 → 64（16 行 × 4 回合规整）
rep(
"""  /* 播报窗行数上限：一场 6 兵种 ≈ 8 行/回合，40 行 ≈ 看得见 5 个回合；
     与 .bt-log 的 196px 视高配套。倒叙后**最旧的在最下**，裁剪从末尾删。 */
  ui.BT_LOG_MAX = 40;""",
"""  /* 播报窗行数上限：一场 6 兵种 ≈ 8 行/回合，64 行 ≈ 看得见 7~8 个回合；
     与 .bt-log 的 336px 视高（16 行 · v89.137 老板 3）配套。
     倒叙后**最旧的在最下**，裁剪从末尾删。 */
  ui.BT_LOG_MAX = 64;""",
'BT_LOG_MAX')

assert '\r\n' not in s2, '行尾混入 CRLF'
tmp2 = p2 + '.tmp137'
io.open(tmp2, 'w', encoding='utf-8', newline='').write(s2)
os.replace(tmp2, p2)
chk2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
assert 'ui.btUnitTip = function' in chk2, '未落盘'
assert chk2.count('{') == chk2.count('}'), 'ui 花括号不配平 %d/%d' % (chk2.count('{'), chk2.count('}'))
print('✅ ui.js：%d → %d 字节' % (n2, len(chk2)))
print('完成：' + ' / '.join(ok))
