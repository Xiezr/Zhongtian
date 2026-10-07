# -*- coding: utf-8 -*-
"""v89.224b9：smoke §224 守卫段 + 需求档案补录。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b9'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, BASE + p)

# ---------- 1) smoke §224 守卫段 ----------
SEC = '''  /* ============================================================
   * §224（v89.224）：废土根脉改造 —— 英雄/游商 · 实验室迁移 · 装备双轨 · 资质/六维 · 资源 · 依赖链
   *   老板：「必须是从根子上是废土，不能只改个表面……建立映射避免混乱无法追溯，分批验证」
   *   映射源：docs/废土术语映射表.md（唯一）
   * ============================================================ */
  console.log('\\n===== §224 废土根脉改造（映射表 · 分批验证） =====');
  (function () {
    var fs224 = require('fs'), path224 = require('path');
    var RAW224 = {};
    ['data', 'domain', 'battle', 'state', 'ui', 'systems', 'main'].forEach(function (f) {
      RAW224[f] = fs224.readFileSync(path224.join(__dirname, 'js', f + '.js'), 'utf8');
    });
    RAW224.html = fs224.readFileSync(path224.join(__dirname, 'index.html'), 'utf8');
    var CLEAN224 = {};
    Object.keys(RAW224).forEach(function (f) { CLEAN224[f] = stripComment(RAW224[f]); });

    /* ① 英雄 / 游商（改名批） */
    var bad224a = [];
    Object.keys(CLEAN224).forEach(function (f) {
      if (CLEAN224[f].indexOf('将领') >= 0) bad224a.push(f + ':将领');
      if (CLEAN224[f].indexOf('商城') >= 0) bad224a.push(f + ':商城');
    });
    check('§224① 英雄/游商：剥注释零残留（js 七文件 + index）· 页签与视角在册',
      bad224a.length === 0
        && RAW224.html.indexOf('>英雄</div>') >= 0 && RAW224.html.indexOf('>游商</div>') >= 0
        && RAW224.html.indexOf('将领') < 0 && RAW224.html.indexOf('商城') < 0,
      '残留=' + bad224a.join(','));

    /* ② 建筑→基因实验室 + 实验室迁移 + 种子体系退役 */
    check('§224② 基因实验室：建筑格载体在册 · 实验室入口迁建筑格 · 播种/种子链已断', (function () {
      return RAW224.data.indexOf("name: '基因实验室'") >= 0
        && RAW224.data.indexOf("icon: '🧬',") >= 0
        && CLEAN224.ui.indexOf('open-lab') >= 0
        && CLEAN224.ui.indexOf('open-farm') < 0
        && CLEAN224.ui.indexOf('openFarmSeeds') < 0
        && CLEAN224.systems.indexOf('播种') < 0
        && CLEAN224.domain.indexOf('grantSeedDrop') < 0
        && RAW224.data.indexOf('DATA.SEED_DROP = ') < 0
        && RAW224.data.indexOf('DATA.BUILD_PREREQ_INIT') >= 0
        && RAW224.data.indexOf('DATA.BUILD_UP_DEPS') >= 0;
    })());

    /* ③ 装备双轨（机甲 / 基因 · 器官化） */
    check('§224③ 装备双轨：机甲部件 / 基因强化（12 部位器官化 + 品质工业档）', (function () {
      var L = DATA.LING_SLOT_NAMES || {};
      var head = null;
      (DATA.LING_SLOTS || []).forEach(function (x) { if (x.id === 'head') head = x; });
      return CLEAN224.ui.indexOf('⚙ 机甲') >= 0 && CLEAN224.ui.indexOf('🧬 基因') >= 0
        && CLEAN224.ui.indexOf('部件栏（') >= 0
        && L.head === '颅脑强化' && L.pelvis === undefined && L.weapon === '利刃强化' && L.mount === '机动强化'
        && DATA.Q_NAME[1] === '粗制' && DATA.Q_NAME[4] === '原型'
        && head && head.names[0] === '颅骨补片' && head.names[5] === '遗世天目'
        && CLEAN224.data.indexOf('军装') < 0 && CLEAN224.domain.indexOf('改造装备') < 0;
    })());

    /* ④ 资质五档 + 六维四改 */
    check('§224④ 资质（凡人→天启体）· 六维（指挥/治理/武力/谋略）', (function () {
      var R = DATA.GEN_RANK_BY_ID || {};
      return (R.fan || {}).name === '凡人' && (R.liang || {}).name === '突变体'
        && (R.ying || {}).name === '进化体' && (R.ming || {}).name === '觉醒体'
        && (R.tian || {}).name === '天启体'
        && RAW224.data.indexOf("'凡品'") < 0 && RAW224.data.indexOf("'良材'") < 0
        && CLEAN224.systems.indexOf("tong: '指挥'") >= 0 && CLEAN224.systems.indexOf("nz: '治理'") >= 0
        && CLEAN224.systems.indexOf("yw: '武力'") >= 0 && CLEAN224.systems.indexOf("zm: '谋略'") >= 0
        && CLEAN224.ui.indexOf("tong: '指挥'") >= 0
        && CLEAN224.data.indexOf("'统率'") < 0 && CLEAN224.data.indexOf("'内政'") < 0;
    })());

    /* ⑤ 资源四材 */
    check('§224⑤ 资源：净水 / 木料 / 碎石 / 废铁（建材退役）', (function () {
      var rn = {};
      (DATA.RESOURCES || []).forEach(function (r) { rn[r.key] = r.name; });
      return rn.grain === '净水' && rn.wood === '木料' && rn.stone === '碎石' && rn.iron === '废铁'
        && RAW224.data.indexOf("name: '建材'") < 0;
    })());

    /* ⑥ 建筑依赖链（初始前置 7 · 升级依赖 13 · 收敛无环 · 真调拦放） */
    var dep224 = (function () {
      var INIT = DATA.BUILD_PREREQ_INIT || {}, UP = DATA.BUILD_UP_DEPS || {};
      var out = { err: 'unset' };
      if (Object.keys(INIT).length !== 7 || Object.keys(UP).length !== 13) { out.err = '表行数不符'; return out; }
      var okWalk = true;
      Object.keys(UP).forEach(function (b) {
        var cur = b, depth = 0;
        while (UP[cur]) { cur = UP[cur].dep; if (++depth > 20) { okWalk = false; break; } }
      });
      if (!okWalk || UP.minfang) { out.err = '收敛环'; return out; }   /* 根不得有依赖（否则误配成环） */
      var bk = G.state;
      try {
        var st = G.newGame({ name: 'dep224', region: '烬环', mapSeed: 20261024 });
        var c = st.cities[0];
        var free = -1;
        for (var i = 0; i < c.cells.length; i++) {
          if (!c.cells[i].build && !c.cells[i].pending && !c.cells[i].official) { free = i; break; }
        }
        if (free < 0) throw new Error('无空格');
        c.res.grain = 9e8; c.res.wood = 9e8; c.res.stone = 9e8; c.res.iron = 9e8;
        var r1 = G.buildAt(c.id, free, 'shichang');
        out.blocked = !r1.ok && /居所/.test(r1.msg || '');
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 5; });
        var r2 = G.buildAt(c.id, free, 'shichang');
        out.pass = r2.ok === true;
        var pre9 = G.buildPrereqOf(c, 'junying', 9, null);
        out.hooked = (pre9.list || []).some(function (x) { return x.bid === 'minfang' && x.need === 7; });
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 9; });
        var pre9b = G.buildPrereqOf(c, 'junying', 9, null);
        out.released = !(pre9b.list || []).some(function (x) { return x.bid === 'minfang'; });
        out.ok = out.blocked && out.pass && out.hooked && out.released;
      } catch (e) { out.err = String(e && e.message || e); }
      finally { G.state = bk; }
      return out;
    })();
    check('§224⑥ 依赖链：初始前置 7 条 · 升级依赖 13 条 · 单向追赶无死锁 · 真调拦截与放行',
      dep224.ok === true, JSON.stringify(dep224));

    /* ⑦ 版本与档案 + 映射表落盘 */
    check('§224⑦ 版本与档案在册（v89.224 · 老板原话 + 映射表）', (function () {
      var m = RAW224.main;
      var a = fs224.readFileSync(path224.join(__dirname, '需求档案.md'), 'utf8');
      var mp = fs224.readFileSync(path224.join(__dirname, 'docs', '废土术语映射表.md'), 'utf8');
      return /GAME\\.VERSION = 'v89\\.224'/.test(m)
        && a.indexOf('v89.224') >= 0 && a.indexOf('英雄') >= 0 && a.indexOf('基因实验室') >= 0
        && a.indexOf('机甲部件') >= 0 && a.indexOf('从根子上是废土') >= 0
        && mp.indexOf('唯一映射源') >= 0 && mp.indexOf('颅脑强化') >= 0;
    })());
  })();

'''
s = rd('smoke-test.js')
anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1
wr('smoke-test.js', s.replace(anchor, SEC + anchor))
print('[b9] smoke §224 段已插入')

# ---------- 2) 需求档案补录 ----------
arc = rd('需求档案.md')

ROW = ('| v89.224 | 2026-10-07 | 6 | **废土根脉改造（术语映射总表 · 分批落地）**：① 英雄/游商全站换代 ② 建筑「派系驻地」→「基因实验室」'
       '（实验室迁入建筑格 · 去播种化 · 种子体系整体退役 · 血清与研发项目更名）③ 装备双轨换代（军中→机甲部件 · 改造→基因强化'
       '· 12 部位器官化 · 链/槽/品质名同步）④ 资质五档（凡人/突变体/进化体/觉醒体/天启体）+ 六维四项（指挥/治理/武力/谋略）'
       '⑤ 资源四材重定义（净水/木料/碎石/废铁 + 推荐清单）⑥ 建筑依赖链（初始前置 7 条 + 升级依赖 13 条 · 单向追赶无死锁）'
       '——建 `docs/废土术语映射表.md` 为唯一映射源（老板：「必须是从根子上是废土……建立映射避免混乱无法追溯，分批验证」） | 已完成（详见 docs/v89224-废土根脉改造.md） |')

# 总览行：插在 v89.223 行之后
lines = arc.split('\n')
row_idx = None
for i, ln in enumerate(lines):
    if ln.startswith('| v89.223 |'):
        row_idx = i
assert row_idx is not None
lines.insert(row_idx + 1, ROW)
arc = '\n'.join(lines)

DETAIL = '''
---

## v89.224（2026-10-07）· 废土根脉改造（术语映射总表 · 六批落地）

**老板原话（本轮 6 条，逐字）**：

> 0.仪器目录方式同意
> 1.建筑变更：派系驻地现在直接改成基因实验室，作为现政务厅的基因实验室的建筑载体，不再放在政务厅那了。
> 2.政务厅的基因实验室里边就不要整播种啊，种子的这种了。你就搞各种材料研发，基因调试和产物，相应的产物名称也应该更新更新了。
> 3.将领也不叫将领了，叫英雄。其他目录也考虑下， 商城改成游商等等
> 4.所有类似的，说法应该替换城末日废土风格的命名和陈述。包括各种名称，目录栏名称，备注。再比如那个装备，为啥不整成机甲部件，为啥叫军中；改造下为啥不是各身体部位改造，比如头颈胸肩各器官基因强化之类。六维名称要不要改，等等。必须是从根子上是废土，不能只改个表面。总的来说，任何代码库文字和界面展示，均需要废土化调整并达成一致性。建立映射避免混乱无法追溯，分批验证。
> 5.重新定义4种资源，看看哪些是废土时代适用的资源类型，列个推荐清单
> 6.建筑依赖链再完善，务必使所有可以合理关联的建筑建立初始建造和后续升级的等级依赖。避免就1个孤立等级直接无障碍升级

**映射源**：`docs/废土术语映射表.md`（唯一 —— 先改表、再改代码；内部 id 一律不动，老档零迁移）。
**分批**：224a 英雄/游商 → 224b 建筑+实验室 → 224c 装备双轨 → 224d 资质/六维 → 224e 资源 → 224f 依赖链（各批独立验证）。

**关键口径**：
- 建筑 `honglusi`：显示名「派系驻地」→「基因实验室」（图标 🧬）；政务厅要务段的实验室按钮撤出，入口迁入本建筑格面板（「⚔️ 派系」入口保留）。
- 实验室：播种/种子/灵田体系**整体退役**（5 种种子道具、DATA.SEED_DROP、grantSeedDrop、游商种子货架、选定弹窗一并删除；老档种子由 adoptState 清出）；六座培养舱直接「立项研发」（材料研发 ×6 + 基因调试 Ⅰ~Ⅳ），完成即提取产物。
- 装备双轨：sha 侧=「机甲部件」（原军中装备，槽位名保留）；ling 侧=「基因强化」（原改造装备，12 部位器官化：颅脑/颈髓/肩胛/心肺/脊背/腰腹/臂力/下肢/手部/心脉/利刃/机动 强化）；品质名 4 档 → 粗制/标准/精良/原型。
- 资质五档：凡人 / 突变体 / 进化体 / 觉醒体 / 天启体（id fan/liang/ying/ming/tian 不动）；血清：激活 / 蜕变 / 觉醒 / 天启。
- 六维：统率→指挥 · 内政→治理 · 勇武→武力 · 智谋→谋略（速度/体力为现代通用词，评估保留）。
- 资源：净水 / 木料 / 碎石 / 废铁（建材→碎石）；黄金→旧币 · 人口→幸存者 列为下批评估。
- 依赖链：初始前置 7 条（kezhan/junying/shuyuan/cangku/shichang/tiejiangpu/fenghuotai ← 居所或军务线）+ 升级依赖 13 条（N−2 单向追赶，链条收敛于「居所」根，无死锁）；hiLv 宽限与科技闸同口径。

**验证**：smoke（§224×7）· e2e · audit · 官方门禁 —— 见交付文档与门禁日志。

**未完成清单（延续挂账）**：材料 24 名与六大系列 use 文案（批次二）· docs 活文档同步（批次三）· 黄金/人口更名评估 · 「百炼/藏珍阁」等专名逐件评估。
'''

# 详情段：追加到文件末尾（先补上一行空行）
arc = arc.rstrip('\n') + '\n' + DETAIL
wr('需求档案.md', arc)
print('[b9] 档案总览行 + 详情段已补录')
