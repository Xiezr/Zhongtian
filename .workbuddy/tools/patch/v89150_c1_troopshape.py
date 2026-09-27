# -*- coding: utf-8 -*-
# v89.150（老板 1）：兵牌外框按兵种三档（步/骑/器械）+ 战场背景稍淡
import io

def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in segs:
        # ✅ mark 必须是"落盘后唯一、且当前 count<=1"的长行 ——
        #    不能取通用分隔线（`* ====` 这类在文件里遍地都是）
        import re as _re
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and _re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到可用的幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + '] mark=' + mark[:60])
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        s_local[0] = s
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)
    return s

s_local = [None]

# ============ ① domain.js：形态唯一出口 ============
patch('E:/Deepseekdb/js/domain.js', [
("""  GAME.troopAbOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return '';
    return t.ab || (t.name || '').charAt(0);
  };""",
 """  GAME.troopAbOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return '';
    return t.ab || (t.name || '').charAt(0);
  };
  /* ============================================================
   * v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，
   *   骑兵比目前稍窄但比步兵宽，如果是器械兵种如床弩等则维持目前方块大小，
   *   使兵种便于区分」——
   * **兵种形态的唯一出口**（战场兵牌与断言都读它，不各判一份）：
   *   · 'siege' 器械（craft = true：床弩 / 冲车 / 投石车）→ 维持原方块尺寸；
   *   · 'cav'   骑兵（cat = 'cav'）→ 比原稍窄、比步兵宽；
   *   · 'inf'   步兵（其余，含民夫/斥候）→ 窄。
   * 判定只读数据表字段（`cat` / `craft`），不写死 id 名单 —— 以后加兵种自动归类。
   * ============================================================ */
  GAME.troopShapeOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return 'inf';
    if (t.craft) return 'siege';
    if (t.cat === 'cav') return 'cav';
    return 'inf';
  };""",
 '① troopShapeOf 唯一出口'),
])

# ============ ② ui.js：兵牌挂形态类 ============
patch('E:/Deepseekdb/js/ui.js', [
("""      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +""",
 """      /* v89.150（老板 1）：兵牌外框按兵种三档（步 / 骑 / 器械）—— 形态走唯一出口
         GAME.troopShapeOf（界面只回显；宽度差由 CSS 的 --u-w 三档实现）。 */
      var _sh150 = (GAME.troopShapeOf ? GAME.troopShapeOf(u.id) : 'inf');
      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +""",
 '② 兵牌挂形态类'),
])

# ============ ③ index.html：三档宽度 + dense 档 + 背景稍淡 ============
patch('E:/Deepseekdb/index.html', [
("""  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    height: 30px; top: calc((100% - 30px) * var(--rel, 0));
    padding: var(--sp-0) var(--sp-1); border-radius: var(--r-lg); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }""",
 """  /* v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，骑兵比目前稍窄但
     比步兵宽，如果是器械兵种如床弩等则维持目前方块大小，使兵种便于区分」——
     宽度三档（图标 26px **不变**，变的是**框的留白**：窄框贴图标 = 步兵；宽框留白 = 器械）：
       · .inf   步兵（含民夫/斥候）— 28px（贴边窄框）
       · .cav   骑兵              — 32px（比改前的 36 稍窄、比步兵宽 4px）
       · .siege 器械（床弩/冲车/投石）— 36px（**维持改前的方块尺寸**）
     形态由 `GAME.troopShapeOf` 判定（唯一出口，读数据表的 cat / craft 字段）。 */
  .bt-unit { --u-w: 36px; position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    height: 30px; width: var(--u-w); justify-content: center;
    top: calc((100% - 30px) * var(--rel, 0));
    padding: var(--sp-0) 0; border-radius: var(--r-lg); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit.inf { --u-w: 28px; }
  .bt-unit.cav { --u-w: 32px; }
  .bt-unit.siege { --u-w: 36px; }""",
 '③-1 兵牌三档宽度'),

("""  .bt-field.dense .bt-unit { height: 24px; top: calc((100% - 24px) * var(--rel, 0)); }""",
 """  /* dense 档：高缩一档时宽度同比缩（0.8）——`--u-w` 从上面的三档继承，不是自引用 */
  .bt-field.dense .bt-unit { height: 24px; width: calc(var(--u-w) * .8); top: calc((100% - 24px) * var(--rel, 0)); }""",
 '③-2 dense 档宽度'),

("""    background: linear-gradient(90deg, rgba(var(--gold-soft-rgb), .06), rgba(var(--sh-rgb), .42) 50%, rgba(190, 84, 74, .08)); }""",
 """    /* v89.150（老板 1）：「战场背景色稍淡一点」—— 中间那道深色带 .42 → .26（−38%），
       两端色标同降一档：战场更亮，兵牌与地形画得更清楚。 */
    background: linear-gradient(90deg, rgba(var(--gold-soft-rgb), .05), rgba(var(--sh-rgb), .26) 50%, rgba(190, 84, 74, .07)); }""",
 '③-3 战场背景稍淡'),
])

print('ALL OK')
