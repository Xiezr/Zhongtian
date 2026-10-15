# -*- coding: utf-8 -*-
"""v89.134 补丁 4 —— smoke-test.js：
  ① 更新 '#4 缩放档位已定义'（ZOOM_LEVELS 退役 → 新出口口径）
  ② 新增 §115 数据表梳理断言（死表/单一来源/RES_ORDER/INITIAL_EXT/PERK清单/导航文档）
"""
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT+p, 'r', encoding='utf-8', newline='').read()
def wr(p,s): io.open(ROOT+p, 'w', encoding='utf-8', newline='').write(s)

s = rd('smoke-test.js')

# ---------- ① 更新 ZOOM 断言 ----------
old = """  check('#4 缩放档位已定义', Array.isArray(DATA.ZOOM_LEVELS) && DATA.ZOOM_LEVELS.length >= 4);
"""
new = """  /* v89.134（数据表梳理）：DATA.ZOOM_LEVELS 退役（连续滑块时代）——
     唯一出口 ui.ZOOM_MIN / ui.ZOOM_MAX。 */
  check('#4 缩放档位：旧表已删，唯一出口 ui.ZOOM_MIN/MAX', typeof DATA.ZOOM_LEVELS === 'undefined'
    && /ui\\.ZOOM_MIN = 80/.test(uS16) && /ui\\.ZOOM_MAX = 120/.test(uS16));
"""
assert s.count(old) == 1, '① ZOOM 锚点'
s = s.replace(old, new)

# ---------- ② 插入 §115 ----------
anchor = """    G.state = keep114;
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
"""
assert s.count(anchor) == 1, '② 插入锚点 = ' + str(s.count(anchor))

sec115 = '''    G.state = keep114;
  })();

  /* ═══════════════════════════════════════════════════════════
   * §115（v89.134）：数据表梳理 —— 卫生与接线
   *   需求原文：「梳理各种数据表，代码块和引用关系，不止要存在，
   *   还需要清晰，便于修改和模块化管理」
   *   ① 死表已删（5 张 · 墓碑在位）；② QUESTS 单一来源；
   *   ③ RES_ORDER 唯一数据源；④ INITIAL_EXT 接线（实调）；
   *   ⑤ CITY_PERK_KEYS 活清单；⑥ 分区导航与索引文档在位。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs115 = require('fs'), path115 = require('path');
    var dS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'data.js'), 'utf8');
    var qS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'questdata.js'), 'utf8');
    var sS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'state.js'), 'utf8');
    var uS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'ui.js'), 'utf8');
    var bS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'battle.js'), 'utf8');
    var gS115 = fs115.readFileSync(path115.join(__dirname, 'js', 'domain.js'), 'utf8');

    console.log('\\n===== 115. v89.134：数据表梳理（卫生 / 接线 / 单一来源）=====');

    /* ---------- ① 死表退役 ---------- */
    console.log('  --- ① 死表退役 ----------');
    check('§115① 五张死表已删（EQUIP_QUALITY / GENERAL_NAMES / ZOOM_LEVELS / WILD_ADD / QUEST_TYPE_ORDER）',
      typeof DATA.EQUIP_QUALITY === 'undefined' && typeof DATA.GENERAL_NAMES === 'undefined'
      && typeof DATA.ZOOM_LEVELS === 'undefined' && typeof DATA.WILD_ADD === 'undefined'
      && typeof DATA.QUEST_TYPE_ORDER === 'undefined');

    check('§115① 墓碑在位（改表的人能找到去向与理由）',
      dS115.indexOf('v89.134 移除') >= 0
      && dS115.indexOf('唯一来源是 questdata.js') >= 0
      && qS115.indexOf('v89.134 移除') >= 0);

    /* ---------- ② QUESTS 单一来源 ---------- */
    console.log('  --- ② QUESTS 单一来源（旧双定义陷阱清除）---');
    check('§115② DATA.QUESTS 唯一写点 = questdata.js（data.js 无写点 · 旧版 q1 已清零）',
      dS115.indexOf('DATA.QUESTS = ') < 0
      && qS115.indexOf('DATA.QUESTS = ') >= 0
      && dS115.indexOf("id: 'q1'") < 0
      && (DATA.QUESTS || []).length >= 50
      && DATA.QUESTS.every(function (q) { return !!q.metric; }));

    /* ---------- ③ RES_ORDER 唯一数据源 ---------- */
    console.log('  --- ③ RES_ORDER = 资源集唯一数据源（字面量清零）---');
    check('§115③ 四个模块内 5 键字面量数组清零（battle/state/domain/ui）',
      bS115.indexOf("['grain', 'wood', 'stone', 'iron', 'gold']") < 0
      && sS115.indexOf("['grain', 'wood', 'stone', 'iron', 'gold']") < 0
      && gS115.indexOf("['grain', 'wood', 'stone', 'iron', 'gold']") < 0
      && uS115.indexOf("['grain', 'wood', 'stone', 'iron', 'gold']") < 0);

    check('§115③ GAME.RES_KEYS / TRANSPORT_KEYS 派生自 RES_ORDER（运行时同值）', (function () {
      return G.RES_KEYS.join(',') === DATA.RES_ORDER.concat(['pop']).join(',')
        && G.TRANSPORT_KEYS.join(',') === DATA.RES_ORDER.join(',')
        && DATA.RES_ORDER.indexOf('pop') < 0;
    })());

    /* ---------- ④ INITIAL_EXT 接线（实调） ---------- */
    console.log('  --- ④ INITIAL_EXT 接线（首城模板实调比对）---');
    check('§115④ 首城外城模板 = DATA.INITIAL_EXT（逐格实调）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: '梳', cityName: '许都', region: '豫州', mapSeed: 20260927 });
        G.state = st;
        var c = st.cities[0];
        var types = (c.extGrid || []).slice(0, DATA.INITIAL_EXT.length)
          .map(function (g) { return g.type; });
        return types.join(',') === DATA.INITIAL_EXT.join(',')
          && DATA.INITIAL_EXT.join(',') === 'farm,farm,forest,quarry,mine';
      } finally { G.state = keep; }
    })());

    /* ---------- ⑤ CITY_PERK_KEYS 活清单 ---------- */
    console.log('  --- ⑤ CITY_PERK_KEYS 从孤儿变活清单 ---');
    check('§115⑤ CITY_PERK_KEYS 与 CITY_PERK 表数值键一致（防「加属性忘进清单」）', (function () {
      var keys = DATA.CITY_PERK_KEYS || [];
      if (keys.length < 5) return false;
      var tiers = Object.keys(DATA.CITY_PERK);
      /* 清单每键都在每档存在（防清单写了不存在的键） */
      var listedOk = keys.every(function (k) {
        return tiers.every(function (t) { return DATA.CITY_PERK[t][k] != null; });
      });
      /* 每档数值键（除展示键 name/desc 与 NPC 结算键 npcResMul）都在清单（防新属性漏登记） */
      var covered = tiers.every(function (t) {
        return Object.keys(DATA.CITY_PERK[t]).every(function (k) {
          if (k === 'name' || k === 'desc' || k === 'npcResMul') return true;
          return keys.indexOf(k) >= 0;
        });
      });
      return listedOk && covered;
    })());

    /* ---------- ⑥ 导航与索引文档 ---------- */
    console.log('  --- ⑥ 修改入口：分区导航 + 索引文档 ---');
    check('§115⑥ data.js 顶部【分区导航】在位（16 区 · 指向索引文档）',
      dS115.indexOf('【分区导航】') >= 0 && dS115.indexOf('docs/数据表索引.md') >= 0
      && dS115.indexOf('RES_ORDER') >= 0);

    check('§115⑦ 数据表索引文档在位（gen_tables_index.js 产物 · 勿手改）', (function () {
      try {
        var t = fs115.readFileSync(path115.join(__dirname, 'docs', '数据表索引.md'), 'utf8');
        return t.indexOf('自动生成 · 勿手改') >= 0 && t.indexOf('三、表清单') >= 0
          && t.indexOf('四、卫生审计结论') >= 0;
      } catch (e) { return false; }
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
'''
s = s.replace(anchor, sec115)

# ---------- 写后自检 ----------
assert '§115' in s and "§115⑦" in s, '§115 未插入'
assert 'DATA.ZOOM_LEVELS.length >= 4' not in s, '旧断言未更新'
wr('smoke-test.js', s)
print('OK · smoke-test.js', len(s))
