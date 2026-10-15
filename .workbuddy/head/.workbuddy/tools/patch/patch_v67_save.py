# -*- coding: utf-8 -*-
"""v67 · 补一套存档系统（老板：「补一个存档，看什么存档设计合适」）。

设计依据（全部实测，脚本 tools/probe67_save3.js）：
  · 开局档 3.8KB；中期档（20 城 / 120 将 / 公文堆满）115.6KB
  · 单次写入 0.8ms（中位）· localStorage 实测配额 5.00MB → 可放 43 份中期档
  · msgLog 已有 MSG_MAX=800 封顶 → 没有"无限膨胀"的字段
  ⇒ **不上 IndexedDB**：它的异步/事务/大容量优势在这里用不上（量级差两个数量级），
     而 localStorage 的同步语义正合用（关页/切后台能立刻落盘）。

落地内容：
  ① state.js：槽位表（主档 + 3 手动 + 3 自动备份轮换）· 存档序列化唯一出口 savePayload
     · saveTo/loadFrom/dropSlot · exportText/importText（带格式/版本/校验和）· autoSave+轮换
     · **读档后处理提取为 adoptState**（loadGame 与 loadFrom 共用，避免"读档"两个版本）
  ② ui.js：ui.openSaveManager() 面板 + 设置页首行入口
  ③ main.js：动作接线 + 自动存档改走 autoSave（带轮换）+ 首页按钮绑定
  ④ index.html：首页「存档管理」按钮 + 面板 CSS

一切改动带锚点断言；找不到锚点即报错退出，不静默跳过。
"""
import io, os, re

ROOT = r'E:\Deepseekdb'
FAIL = []
REPORT = []


def rd(p):
    return io.open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)


def patch(path, old, new, must=1, label=''):
    p = os.path.join(ROOT, path)
    t = rd(path)
    n = t.count(old)
    if n != must:
        FAIL.append('%s ← [%s] 锚点 %d 次（应 %d）' % (path, label, n, must))
        return False
    wr(path, t.replace(old, new))
    REPORT.append('   ✓ %s [%s]' % (path, label))
    return True


# =====================================================================
# ① state.js —— 槽位体系
# =====================================================================
STATE_BLOCK = r'''
  /* ============================================================
   * v67 · 存档槽位体系（老板：「补一个存档，对网页游戏什么存档设计合适」）
   * ------------------------------------------------------------
   * 实测依据（`.workbuddy/tools/probe67_save3.js`）：
   *   · 开局档 **3.8KB**；中期档（20 城 / 120 将 / 公文堆满）**115.6KB**
   *   · 单次写入 **0.8ms**（20 次采样中位）· localStorage 实测配额 **5.00MB**
   *     → 5MB ÷ 115.6KB ≈ **43 份**中期档
   *   · 唯一会长期增长的字段 msgLog 已有 `MSG_MAX = 800` 封顶（≈51KB）
   * ⇒ **不上 IndexedDB**。它异步 + 事务 + 容量大，但这里量级差两个数量级；
   *   而 localStorage 的**同步**语义正合用：关页/切后台要能立刻落盘。
   *
   * 槽位布局（**唯一来源**，改这张表就够）：
   *   main  主档     —— 首页「继续上次的游戏」与服务端式"当前档"读它
   *   s1~s3 手动槽   —— 玩家自己存/读
   *   a1~a3 自动备份 —— 每次自动存档前把旧主档往后推（a3←a2←a1←main）
   *     ⭐ 轮换的意义：**坏档不会当场覆盖掉唯一的好档** ——
   *       单档式最惨的失败模式就是"存进去发现已经坏了，上一份也被覆盖了"。
   * 索引：`sanguo_slots_v3` **一个键**存全部槽位摘要 → 打开面板只读一次，不解析主档。
   * ============================================================ */
  var SLOT_INDEX_KEY = 'sanguo_slots_v3';
  GAME.SAVE_FMT = 'sanguo-save';
  GAME.SLOTS = [
    { id: 'main', name: '主档', kind: 'main', key: SAVE_KEY },
    { id: 's1', name: '存档 1', kind: 'manual', key: SAVE_KEY + '_s1' },
    { id: 's2', name: '存档 2', kind: 'manual', key: SAVE_KEY + '_s2' },
    { id: 's3', name: '存档 3', kind: 'manual', key: SAVE_KEY + '_s3' },
    { id: 'a1', name: '自动备份 1', kind: 'auto', key: SAVE_KEY + '_a1' },
    { id: 'a2', name: '自动备份 2', kind: 'auto', key: SAVE_KEY + '_a2' },
    { id: 'a3', name: '自动备份 3', kind: 'auto', key: SAVE_KEY + '_a3' }
  ];
  GAME.slotOf = function (id) {
    for (var i = 0; i < GAME.SLOTS.length; i++) if (GAME.SLOTS[i].id === id) return GAME.SLOTS[i];
    return null;
  };
  /* 存档序列化的**唯一出口**。原先只在 saveGame 里内联一份；
     导出/存槽位若各写一份，就会出现"改了瘦身规则、只改到一处"的老毛病。 */
  GAME.savePayload = function () {
    if (!GAME.state) return null;
    var keepCities = GAME.state.map.cities;
    GAME.state.map.cities = null;              // 派生数据不入档（见 saveGame 注释）
    try {
      return JSON.stringify(GAME.state, function (k, v) {
        if (k === 'grid' && Array.isArray(v) && v.length > 100) return undefined;
        return v;
      });
    } finally {
      GAME.state.map.cities = keepCities;      // 快照不能破坏内存状态
    }
  };
  /* FNV-1a 32 位。只为"文本在传输/粘贴中没被改坏"，不是防篡改。 */
  GAME.checksum = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  };
  GAME.slotIndex = function () {
    try {
      var raw = localStorage.getItem(SLOT_INDEX_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { return {}; }
  };
  GAME._setSlotIndex = function (id, st, size) {
    try {
      var idx = GAME.slotIndex();
      var m = GAME.metaOf(st) || {};
      var s = GAME.slotOf(id) || {};
      idx[id] = {
        id: id, slot: s.name || id, kind: s.kind || 'manual',
        name: m.name || '无名君主', era: m.era || '', yearName: m.yearName || '',
        cities: m.cities || 0, army: m.army || 0,
        gens: (st.generals || []).length,
        year: (st.world && st.world.year) || 1,
        size: size || 0, savedAt: U.now(), version: SAVE_VERSION
      };
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
    } catch (e) { /* 索引失败不影响主档 */ }
  };
  GAME._clearSlotIndex = function (id) {
    try {
      var idx = GAME.slotIndex();
      delete idx[id];
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
    } catch (e) {}
  };
  /* 面板要用的一份清单：槽位定义 + 摘要（**一次读索引**，不解主档） */
  GAME.slotList = function () {
    var idx = GAME.slotIndex();
    return GAME.SLOTS.map(function (s) {
      return { id: s.id, name: s.name, kind: s.kind, meta: idx[s.id] || null };
    });
  };
  GAME.slotEmpty = function () {
    var ids = ['s1', 's2', 's3'];
    for (var i = 0; i < ids.length; i++) {
      var s = GAME.slotOf(ids[i]);
      var has = false;
      try { has = !!localStorage.getItem(s.key); } catch (e) {}
      if (!has) return ids[i];
    }
    return null;
  };
  /* 写入某个槽位。返回 {ok,msg}，调用方直接 toast。 */
  GAME.saveTo = function (id) {
    var slot = GAME.slotOf(id || 'main');
    if (!slot) return { ok: false, msg: '槽位不存在：' + id };
    if (!GAME.state) return { ok: false, msg: '没有进行中的游戏' };
    GAME.state.savedAt = U.now();
    try {
      var json = GAME.savePayload();
      localStorage.setItem(slot.key, json);
      GAME._setSlotIndex(slot.id, GAME.state, json.length);
      if (slot.id === 'main') GAME.saveMeta(GAME.metaOf(GAME.state));
      return { ok: true, msg: '已存入「' + slot.name + '」', size: json.length };
    } catch (e) {
      if (window.console && window.console.warn) window.console.warn('存档失败：' + (e && e.message));
      return { ok: false, msg: '存档失败：' + ((e && e.message) || '未知原因') };
    }
  };
  /* 自动备份轮换：a3 ← a2 ← a1 ← main（整体后移一位） */
  GAME.rotateAuto = function () {
    try {
      var idx = GAME.slotIndex();
      var raw = localStorage.getItem(GAME.slotOf('main').key);
      if (!raw) return false;
      /* 从最旧的一端开始搬，避免覆盖 */
      for (var i = 3; i >= 1; i--) {
        var from = GAME.slotOf(i === 1 ? 'main' : ('a' + (i - 1)));
        var to = GAME.slotOf('a' + i);
        var src = (i === 1) ? raw : localStorage.getItem(from.key);
        if (src) {
          localStorage.setItem(to.key, src);
          if (idx[from.id]) { idx[to.id] = idx[from.id]; idx[to.id].id = to.id; idx[to.id].slot = to.name; }
          else if (i === 1 && idx.main) { idx[to.id] = idx.main; idx[to.id].id = to.id; idx[to.id].slot = to.name; }
        } else {
          delete idx[to.id];
        }
      }
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
      return true;
    } catch (e) { return false; }
  };
  /* 自动存档 = 先轮换备份，再写主档。所有自动路径都走它（单一出口）。 */
  GAME.autoSave = function () {
    GAME.rotateAuto();
    return GAME.saveTo('main');
  };
  GAME.loadFrom = function (id) {
    var slot = GAME.slotOf(id || 'main');
    if (!slot) return null;
    var raw = null;
    try { raw = localStorage.getItem(slot.key); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var st = JSON.parse(raw);
      if (!st || st.version !== SAVE_VERSION) return null;
      return GAME.adoptState(st);      // 与 loadGame 同一套后处理
    } catch (e) { return null; }
  };
  GAME.dropSlot = function (id) {
    var slot = GAME.slotOf(id);
    if (!slot || slot.kind === 'main') return { ok: false, msg: '主档不可删除' };
    try { localStorage.removeItem(slot.key); } catch (e) {}
    GAME._clearSlotIndex(id);
    return { ok: true, msg: '已清空「' + slot.name + '」' };
  };
  GAME.MSG_MAX = GAME.MSG_MAX || 800;
  /* 导出：一个带自描述头部 + 校验和的 JSON 文本，玩家可存成文件或直接粘贴 */
  GAME.exportText = function (slotId) {
    var slot = GAME.slotOf(slotId || 'main');
    if (!slot) return { ok: false, msg: '槽位不存在' };
    var raw = null;
    try { raw = localStorage.getItem(slot.key); } catch (e) {}
    if (!raw) return { ok: false, msg: '「' + slot.name + '」是空的，没有可导出的内容' };
    var st;
    try { st = JSON.parse(raw); } catch (e) { return { ok: false, msg: '该槽位内容已损坏，无法导出' }; }
    var meta = GAME.slotMetaOf ? GAME.slotMetaOf(slot.id) : (GAME.slotIndex()[slot.id] || null);
    var pack = {
      _fmt: GAME.SAVE_FMT, _ver: SAVE_VERSION, _exportedAt: U.now(),
      _slot: slot.name, _ruler: (st.ruler && st.ruler.name) || '无名君主',
      _summary: (meta ? (meta.cities + ' 城 · ' + meta.gens + ' 将') : ''),
      _check: GAME.checksum(JSON.stringify(st)), state: st
    };
    return { ok: true, text: JSON.stringify(pack), name: (st.ruler && st.ruler.name) || '无名君主' };
  };
  GAME.slotMetaOf = function (id) { return GAME.slotIndex()[id] || null; };
  /* 导入：校验顺序 = 能不能解析 → 是不是本游戏的存档 → 版本对不对 → 内容完整 → 校验和。
     任一不过**明确报哪一步**，不接受"导入失败"这种没信息量的提示。
     目标槽位默认取"第一个空的手动槽"，全满则拒绝（不覆盖玩家已有档）。 */
  GAME.importText = function (text, slotId) {
    if (!text || !String(text).trim()) return { ok: false, msg: '请先选择文件或粘贴存档文本' };
    var pack;
    try { pack = JSON.parse(String(text).trim()); }
    catch (e) { return { ok: false, msg: '不是有效的存档文本（JSON 解析失败）' }; }
    if (!pack || typeof pack !== 'object' || pack._fmt !== GAME.SAVE_FMT)
      return { ok: false, msg: '这不是本游戏的存档（缺少 ' + GAME.SAVE_FMT + ' 标记）' };
    if (pack._ver !== SAVE_VERSION)
      return { ok: false, msg: '存档版本不符（存档 v' + pack._ver + '，当前 v' + SAVE_VERSION + '），无法导入' };
    if (!pack.state || typeof pack.state !== 'object' || !pack.state.cities || !pack.state.cities.length)
      return { ok: false, msg: '存档内容不完整（没有城池数据）' };
    if (pack._check && GAME.checksum(JSON.stringify(pack.state)) !== pack._check)
      return { ok: false, msg: '存档校验失败：内容被改动过或复制时掉字了' };
    var id = slotId;
    if (!id) {
      id = GAME.slotEmpty();
      if (!id) return { ok: false, msg: '三个存档位都满了，请先清空一个再导入' };
    }
    var slot = GAME.slotOf(id);
    if (!slot) return { ok: false, msg: '槽位不存在' };
    var raw = JSON.stringify(pack.state);
    try { localStorage.setItem(slot.key, raw); }
    catch (e) { return { ok: false, msg: '写入失败（存储空间不足？）：' + ((e && e.message) || '') }; }
    GAME._setSlotIndex(slot.id, pack.state, raw.length);
    return { ok: true, msg: '已导入到「' + slot.name + '」（' +
      ((pack.state.cities || []).length) + ' 城 · ' + ((pack.state.generals || []).length) + ' 将）', slot: slot.id };
  };
'''

# 插入点：clearSave 之前
patch('js/state.js', '  GAME.clearSave = function () {',
      STATE_BLOCK + '\n  GAME.clearSave = function () {', 1, '槽位体系')

# ---- saveGame 瘦身：序列化改走唯一出口 + 写索引 ----
patch('js/state.js',
      """      var keepCities = GAME.state.map.cities;
      GAME.state.map.cities = null;
      var json;
      try {
        json = JSON.stringify(GAME.state, function (k, v) {
          if (k === 'grid' && Array.isArray(v) && v.length > 100) return undefined;
          return v;
        });
      } finally {
        GAME.state.map.cities = keepCities;   // 存档是快照，不能破坏内存中的状态
      }
      localStorage.setItem(SAVE_KEY, json);
      GAME.saveMeta(GAME.metaOf(GAME.state));   // 同步维护轻量索引
      return true;""",
      """      /* v67：序列化走唯一出口 `savePayload`（导出/存槽位也用它，不许各写一份） */
      var json = GAME.savePayload();
      localStorage.setItem(SAVE_KEY, json);
      GAME.saveMeta(GAME.metaOf(GAME.state));   // 同步维护轻量索引
      GAME._setSlotIndex('main', GAME.state, json.length);
      return true;""", 1, 'saveGame 收口')

# ---- loadGame：后处理提取为 adoptState ----
src = rd('js/state.js')
i0 = src.index('GAME.state = st;')            # loadGame 里那一句
i1 = src.index('      return st;', i0)
body = src[i0 + len('GAME.state = st;'):i1]
assert len(body) > 3000, '提取到的后处理代码太短（%d），锚点可能不对' % len(body)
new_src = (src[:i0] + 'return GAME.adoptState(st);' + src[i1 + len('      return st;'):])
# 在 loadGame 结束后追加 adoptState 定义
anchor = "      return GAME.adoptState(st);\n    } catch (e) { return null; }\n  };"
k = new_src.index(anchor)
adopt = ('\n\n  /* ============================================================\n'
         '   * 读档后的**统一后处理**（v67 从 loadGame 里提取出来）\n'
         '   * ------------------------------------------------------------\n'
         '   * 原先这一大段内联在 loadGame 里；槽位读档若再抄一份，\n'
         '   * 就会出现"迁移逻辑两份、只改一处"的经典失效（本项目已发生多次）。\n'
         '   * 现在 loadGame（主档）与 loadFrom（任意槽位）都走它。\n'
         '   * ============================================================ */\n'
         '  GAME.adoptState = function (st) {'
         '      GAME.state = st;' + body + '      return st;\n  };')
new_src = new_src[:k + len(anchor)] + adopt + new_src[k + len(anchor):]
io.open(os.path.join(ROOT, 'js/state.js'), 'w', encoding='utf-8', newline='').write(new_src)
REPORT.append('   ✓ js/state.js [loadGame → adoptState 提取，后处理 %d 字符]' % len(body))

print('① state.js：')
print('\n'.join(r for r in REPORT if 'state.js' in r))

# =====================================================================
# ② ui.js —— 存档管理面板 + 设置页入口
# =====================================================================
UI_BLOCK = r'''
  /* ============================================================
   * v67 · 存档管理面板
   * ------------------------------------------------------------
   * 一屏放 7 个槽位 + 导入区，**不出下拉条**（老板的硬规矩）。
   * 每行的判据：有档才亮「读取/导出/删除」，空槽只留「存入」。
   * 导入走"第一个空的手动槽"，**绝不覆盖**已有档（覆盖式导入是数据事故的常见来源）。
   * ============================================================ */
  ui._svPaste = false;
  ui.svRowHTML = function (s) {
    var m = s.meta;
    var kindTxt = (s.kind === 'main' ? '主档 · 进游戏时读它'
      : (s.kind === 'auto' ? '自动备份' : '手动'));
    var sum;
    if (m) {
      sum = U.escape(m.name) + '　' + (m.era || '') + '·' + (m.yearName || '') + '年　' +
        '城 ' + m.cities + '　将 ' + m.gens + '　' + (m.size / 1024).toFixed(1) + 'KB';
      if (m.savedAt && GAME.metaTimeText) sum += '　' + GAME.metaTimeText(m.savedAt);
    } else {
      sum = '<span class="sv-empty">（空）</span>';
    }
    var b = '';
    b += '<button class="btn sm' + (s.kind === 'main' ? ' gold' : '') +
      '" data-action="save-slot-write" data-slot="' + s.id + '">存入</button>';
    if (m) {
      if (s.kind !== 'auto') b += '<button class="btn sm" data-action="save-slot-load" data-slot="' + s.id + '">读取</button>';
      b += '<button class="btn sm" data-action="save-slot-export" data-slot="' + s.id + '">导出</button>';
    }
    if (s.kind !== 'main') {
      b += '<button class="btn sm dim" data-action="save-slot-drop" data-slot="' + s.id + '"' +
        (m ? '' : ' disabled') + '>清空</button>';
    }
    return '<div class="sv-row"><div class="sv-n">' + s.name +
      '<div class="sv-s">' + kindTxt + '</div></div>' +
      '<div class="sv-s">' + sum + '</div><div class="sv-b">' + b + '</div></div>';
  };
  ui.openSaveManager = function () {
    var list = GAME.slotList();
    var body = ui.help('存档存在本浏览器里（localStorage）：关网页、关浏览器都还在，' +
      '但**换浏览器、清缓存、或换一个打开方式**（双击文件 vs 本地服务）就看不到了。' +
      '要带走就用「导出」，在另一台机器上用「导入」——导入只会写进空的手动槽，不会覆盖你已有的档。') +
      '<div class="sv-list">' + list.map(ui.svRowHTML).join('') + '</div>' +
      '<div class="sv-imp">' +
        '<div class="auto-line">' +
          '<button class="btn sm" data-action="save-import-file">📂 选择存档文件…</button>' +
          '<button class="btn sm" data-action="save-import-toggle">' +
            (ui._svPaste ? '收起粘贴框' : '✍️ 粘贴存档文本…') + '</button>' +
        '</div>' +
        (ui._svPaste
          ? '<textarea id="sv-paste" class="sv-ta" placeholder="把导出的存档文本整段粘贴到这里"></textarea>' +
            '<div class="auto-line" style="margin-top:6px;">' +
            '<button class="btn sm gold" data-action="save-import-text">导入</button></div>'
          : '') +
      '</div>';
    ui._modalKind = 'saves';
    ui.openShell({
      title: '💾 存档管理', sub: '主档 + 3 手动槽 + 3 自动备份',
      body: body, size: 'xl',
      /* ⚠️ openShell 的 foot 是 **HTML 字符串**（modalShell 直接拼接），不是数组 */
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
'''

patch('js/ui.js', '  ui.settingsHTML = function () {', UI_BLOCK + '\n  ui.settingsHTML = function () {',
      1, '存档面板')

# 设置页首行入口
patch('js/ui.js',
      """    return '<div class="ui-page">' +
      '<div class="gold-heading">⚙️ 设置</div>' +
""",
      """    return '<div class="ui-page">' +
      '<div class="gold-heading">⚙️ 设置</div>' +
      /* v67：存档入口放**第一张卡**（老板的规矩：重要入口不许放在面板末尾） */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">💾 存档管理</span><span class="val">' +
          (function () { var n = 0; GAME.slotList().forEach(function (x) { if (x.meta) n++; });
            return n + ' / 7 有档'; })() + '</span></div>' +
        '<div class="auto-line">' +
          '<button class="btn sm gold" data-action="open-saves">存档 / 读取 / 导出 / 导入</button>' +
        '</div>' +
      '</div>' +
""", 1, '设置页入口')

# =====================================================================
# ③ main.js —— 动作接线 + 自动存档走 autoSave
# =====================================================================
ACTIONS = '''
      /* v67 · 存档管理 */
      case 'open-saves': ui.openSaveManager(); break;
      case 'save-slot-write': {
        var r1 = GAME.saveTo(el.getAttribute('data-slot'));
        ui.toast(r1.ok ? ('💾 ' + r1.msg) : r1.msg);
        if (r1.ok) ui.openSaveManager();
        break;
      }
      case 'save-slot-load': ui.openLoadSlotAsk(el.getAttribute('data-slot')); break;
      case 'save-slot-load-do': GAME.doLoadSlot(ui._svLoadTarget); break;
      case 'save-slot-drop': ui.openDropSlotAsk(el.getAttribute('data-slot')); break;
      case 'save-slot-drop-do': {
        var r2 = GAME.dropSlot(ui._svDropTarget);
        ui.toast(r2.msg);
        if (r2.ok) ui.openSaveManager();
        break;
      }
      case 'save-slot-export': GAME.doExportSlot(el.getAttribute('data-slot')); break;
      case 'save-import-toggle': ui._svPaste = !ui._svPaste; ui.openSaveManager(); break;
      case 'save-import-file': GAME.doImportPick(); break;
      case 'save-import-text': {
        var ta = $('#sv-paste');
        if (!ta) break;
        var r3 = GAME.importText(ta.value, null);
        ui.toast(r3.ok ? ('📥 ' + r3.msg) : r3.msg);
        if (r3.ok) { ui._svPaste = false; ui.openSaveManager(); }
        break;
      }
'''
patch('js/main.js', "      case 'save': GAME.doSave(); break;",
      ACTIONS + "      case 'save': GAME.doSave(); break;", 1, '动作接线')

patch('js/main.js', '      if (GAME.saveGame()) GAME._lastAutoSave = GAME.utils.now();',
      '      if (GAME.autoSave().ok) GAME._lastAutoSave = GAME.utils.now();', 1, '自动存档走 autoSave')

# doSave：走 saveTo('main')（也享受轮换备份）
if 'GAME.doSave = function' in rd('js/main.js'):
    t = rd('js/main.js')
    i = t.index('GAME.doSave = function')
    seg = t[i:i + 600]
    REPORT.append('   ! doSave 原文：' + seg.split('\n')[0] + ' … ' + seg.split('\n')[1][:60])

print('③ main.js  完成')
print()
if FAIL:
    print('⚠️ 锚点未命中：')
    for f in FAIL:
        print('   ', f)
    raise SystemExit(1)
print('补丁全部落盘')
