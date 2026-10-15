# -*- coding: utf-8 -*-
"""v67 · 存档系统 补丁 3/3：修 audit 死函数 · 更新受影响的断言 · 补新护栏。

为什么要动 3 条老断言（都是本轮改动的**正当后果**，不是"改测试迁就代码"）：
  1. `读档路径真的调了归一化` —— 后处理整段搬进了 adoptState（为了不让"读档"有两个版本），
     断言锚在 loadGame 函数体上自然失效。**改成同时看两段**（loadGame 必须转交 adoptState，
     且 adoptState 里确实调了两个归一化）—— 比原来更强。
  2. `12 张地图素材文件都在` —— 老板已下令删除这 12 张未接线图标，
     地图地形改为**程序化绘制回退**（map.js 里 blitArtRect 返回 false 就落 drawTerrainArt）。
     断言改成护"回退路径存在"，防止将来有人把地形又写成硬依赖。
  3. `原图已备份（可回退）` —— 它护的是 recolor_buildings.py 的备份目录 `_gold_backup`，
     该目录本轮被删（老板要删的无用图标）。改成护真正的原图来源 `assets/icons/raw`。
"""
import io, os, re

ROOT = r'E:\Deepseekdb'
FAIL, REPORT = [], []


def rd(p):
    return io.open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)


def patch(path, old, new, must=1, label=''):
    t = rd(path)
    n = t.count(old)
    if n != must:
        FAIL.append('%s ← [%s] 锚点 %d 次（应 %d）' % (path, label, n, must))
        return False
    wr(path, t.replace(old, new))
    REPORT.append('   ✓ %s [%s]' % (path, label))
    return True


# =====================================================================
# ① main.js：事件处理器改用 addEventListener（audit 把 inp.onchange 当死函数）
# =====================================================================
patch('js/main.js',
      """    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var r = GAME.importText(String(reader.result), null);
        ui.toast(r.ok ? ('📥 ' + r.msg) : ('导入失败：' + r.msg));
        if (r.ok) { ui._svPaste = false; ui.openSaveManager(); }
      };
      reader.onerror = function () { ui.toast('文件读取失败'); };
      reader.readAsText(f);
    };""",
      """    /* ⚠️ 用 addEventListener 而不是 `inp.onchange = …`：audit.js 把
       "赋给对象属性的函数"记成一个具名函数（inp.onchange / reader.onerror），
       然后报"无任何引用"→ 死函数 +2。这俩是**事件处理器**不是死代码。 */
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.addEventListener('load', function () {
        var r = GAME.importText(String(reader.result), null);
        ui.toast(r.ok ? ('📥 ' + r.msg) : ('导入失败：' + r.msg));
        if (r.ok) { ui._svPaste = false; ui.openSaveManager(); }
      });
      reader.addEventListener('error', function () { ui.toast('文件读取失败'); });
      reader.readAsText(f);
    });""",
      1, '导入改 addEventListener')

# =====================================================================
# ② 三条老断言：按改动的正当后果改写
# =====================================================================
patch('smoke-test.js',
      """    check('读档路径真的调了归一化（旧档不靠玩家重新任命）', (function () {
      var stSrc = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8'));
      var i = stSrc.indexOf('GAME.loadGame = function');
      var seg = stSrc.slice(i, stSrc.indexOf('\\n  };', i));
      return seg.length > 500 && /GAME\\.normalizeGuards\\(\\)/.test(seg);
    })());""",
      """    /* v67：后处理整段搬进了 GAME.adoptState（主档读档与槽位读档**共用同一个出口**）。
       判据跟着改成"两段合起来看"：loadGame 必须**转交** adoptState，
       且 adoptState 段里确实调了两个归一化 —— 只断言前半段会退化成装饰。 */
    check('读档路径真的调了归一化（旧档不靠玩家重新任命）', (function () {
      var stSrc = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8'));
      var i = stSrc.indexOf('GAME.loadGame = function');
      var segL = i < 0 ? '' : stSrc.slice(i, stSrc.indexOf('\\n  };', i));
      var j = stSrc.indexOf('GAME.adoptState = function');
      var segA = j < 0 ? '' : stSrc.slice(j, stSrc.indexOf('\\n  };', j));
      return segL.length > 100 && /GAME\\.adoptState\\(st\\)/.test(segL)
        && segA.length > 3000
        && /GAME\\.normalizeGuards\\(\\)/.test(segA)
        && /GAME\\.normalizeGenCities\\(\\)/.test(segA);
    })(), 'loadGame 转交 adoptState；后处理段 ' + (function () {
      var t = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'state.js'), 'utf8'));
      var j = t.indexOf('GAME.adoptState = function');
      return j < 0 ? 0 : (t.indexOf('\\n  };', j) - j);
    })() + ' 字符');""",
      1, '断言1 读档归一化')

patch('smoke-test.js',
      """  check('12 张地图素材文件都在', (function () {
    var miss = ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .filter(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); });
    return miss.length === 0;
  })(), '缺 ' + ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
    'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
    .filter(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }).length + ' 张');""",
      """  /* ⚠️ v67：老板下令删除那 12 张未接线图标（ai_terrain_* / ai_city_* / ai_fort），
     地图地形因此**落到程序化绘制**。原断言"12 张都要在"已与决定冲突，
     改成护**回退路径本身** —— 地形绝不允许再写成对素材的硬依赖（那会白屏）。 */
  check('地图地形不依赖素材文件（位图缺席时走程序化绘制）', (function () {
    var m = MP;
    /* ① blitArtRect 拿不到图必须返回 false（不是抛错、不是画半张） */
    var i = m.indexOf('function blitArtRect');
    var seg = i < 0 ? '' : m.slice(i, m.indexOf('\\n  function', i + 10));
    var bail = seg.indexOf('if (!c) return false;') >= 0;
    /* ② 位图成功就 return，失败继续往下画矢量 */
    var callIdx = m.indexOf("blitArtRect(ctx, 'terrain_'");
    var after = callIdx < 0 ? '' : m.slice(callIdx, callIdx + 200);
    var fallback = /return;/.test(after) && /drawTerrainArt\\(ctx, d\\.terrain/.test(m.slice(callIdx, callIdx + 900));
    return seg.length > 300 && bail && fallback;
  })());
  check('已按决定删除：12 张未接线图标不再存在于 ui/',
    ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));""",
      1, '断言2 地图素材')

patch('smoke-test.js',
      """  check('原图已备份（可回退）',
    fs.existsSync(path.join(AIDIR, '_gold_backup', 'ai_junying.png')));""",
      """  /* v67：`_gold_backup` 属老板要删的无用图标（也是 recolor_buildings.py 的备份目录），
     已清掉。真正的"可回退来源"是 **AI 图集原图** `assets/icons/raw`（38MB，2×2 原图），
     断言改为护它 —— 它才是重新切图的原料。
     注：recolor_buildings.py 下次调色时会自行 `makedirs(BAK)` 重建 _gold_backup。 */
  check('图标原图仍在（assets/icons/raw，可重新切图）', (function () {
    var raw = path.join(__dirname, 'assets', 'icons', 'raw');
    return fs.existsSync(raw) && fs.readdirSync(raw).length > 0;
  })(), (function () {
    try { return fs.readdirSync(path.join(__dirname, 'assets', 'icons', 'raw')).length + ' 张原图'; }
    catch (e) { return '目录缺失'; }
  })());""",
      1, '断言3 原图备份')

# =====================================================================
# ③ smoke 桩：补 removeItem（存档清槽位要用）
# =====================================================================
t = rd('smoke-test.js')
m = re.search(r"global\.localStorage = \{[^\n]*\n?", t)
if not m:
    FAIL.append('smoke-test.js ← [localStorage 桩] 未匹配')
elif 'removeItem' in m.group(0):
    REPORT.append('   · smoke 桩已有 removeItem（跳过）')
else:
    old = m.group(0)
    new = old.replace('setItem:', 'removeItem: function (k) { delete this._d[k]; }, setItem:')
    wr('smoke-test.js', t.replace(old, new, 1))
    REPORT.append('   ✓ smoke-test.js [localStorage 桩 + removeItem]')

# =====================================================================
# ④ smoke 新增第 52 节：存档槽位体系
# =====================================================================
SMOKE_SECTION = r'''
  /* ============================================================
   * v67 · 存档槽位体系（老板：「补一个存档」）
   * ------------------------------------------------------------
   * 分两层：**结构断言**（唯一出口是否真的唯一）+ **行为断言**（存→导出→导入→读→清）。
   * 行为那半边必须能翻转：篡改一个字就该被校验和拦住。
   * ============================================================ */
  console.log('  --- v67：存档槽位 / 导出导入 ---');
  (function () {
    var fsSv = require('fs'), pathSv = require('path');
    var stSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'state.js'), 'utf8'));
    var mainSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'main.js'), 'utf8'));
    var hSrc = fsSv.readFileSync(pathSv.join(__dirname, 'index.html'), 'utf8');

    check('槽位表：主档 + 3 手动 + 3 自动备份（共 7，键名规则唯一）', (function () {
      var ids = G.SLOTS.map(function (x) { return x.id; });
      return G.SLOTS.length === 7 && ids.join(',') === 'main,s1,s2,s3,a1,a2,a3'
        && G.SLOTS[0].key === 'sanguo_save_v3'
        && G.SLOTS.filter(function (x) { return x.kind === 'auto'; }).length === 3
        && G.SLOTS.every(function (x) { return /^sanguo_save_v3/.test(x.key); });
    })(), G.SLOTS.map(function (x) { return x.id; }).join(','));

    check('序列化只有 savePayload 一个出口（saveGame/saveTo 都不许自己 stringify）', (function () {
      var a = codeOf(stSrc, 'GAME.saveGame = function');
      var b = codeOf(stSrc, 'GAME.saveTo = function');
      var c = codeOf(stSrc, 'GAME.savePayload = function');
      return a.length > 80 && b.length > 300 && c.length > 200
        && a.indexOf('GAME.savePayload()') >= 0
        && b.indexOf('GAME.savePayload()') >= 0
        && a.indexOf('JSON.stringify(GAME.state') < 0
        && b.indexOf('JSON.stringify(GAME.state') < 0
        && c.indexOf('JSON.stringify(GAME.state') >= 0;
    })());

    check('读档后处理只有 adoptState 一个出口（主档与槽位共用）', (function () {
      var a = codeOf(stSrc, 'GAME.loadGame = function');
      var b = codeOf(stSrc, 'GAME.loadFrom = function');
      var d = codeOf(stSrc, 'GAME.adoptState = function');
      return a.length > 100 && b.length > 200 && d.length > 3000
        && a.indexOf('GAME.adoptState(st)') >= 0
        && b.indexOf('GAME.adoptState(st)') >= 0
        && d.indexOf('GAME.normalizeGuards()') >= 0
        && d.indexOf('GAME.syncSeq()') >= 0;
    })());

    check('自动存档走 autoSave（先轮换备份，再写主档）',
      /GAME\.autoSave\(\)/.test(mainSrc) && /GAME\.rotateAuto\(\)/.test(stSrc));

    check('面板 7 行槽位且**样式不带给自身滚动条**（老板的硬规矩）',
      /\.sv-row\b/.test(hSrc) && !/sv-list[^}]*overflow/.test(hSrc));

    check('首页也有存档入口（换台机器导入存档要从这里开始）',
      /id="create-saves"/.test(hSrc) && /data-action="open-saves"/.test(hSrc));

    /* ---------- 行为：存 → 导出 → 导入 → 读 → 清 ---------- */
    var stBackup = G.state;
    if (!G.state) G.state = G.newGame({ name: '存档校验', gender: 'male' });
    if (!G.state.map.grid && G.map.generate) G.map.generate();

    var w = G.saveTo('s1');
    check('存入手动槽 → 成功，且索引里有摘要（面板不必解析主档）',
      w.ok === true && (function () { var m = G.slotMetaOf('s1'); return !!m && m.cities === G.state.cities.length && m.size > 1000; })(),
      w.msg + ' · ' + (w.size || 0) + ' 字节');

    var ex = G.exportText('s1');
    var pack = ex.ok ? JSON.parse(ex.text) : null;
    check('导出文本自描述：格式标记 + 版本 + 8 位校验和',
      !!pack && pack._fmt === 'sanguo-save' && pack._ver === pack.state.version
      && pack._check === G.checksum(JSON.stringify(pack.state)) && pack._check.length === 8,
      ex.ok ? ('校验和 ' + pack._check) : ex.msg);

    check('校验和能翻转（不是恒真装饰）',
      G.checksum('a') !== G.checksum('b') && G.checksum('abc') === G.checksum('abc'));

    var bad = JSON.parse(ex.text);
    bad.state.ruler.name = bad.state.ruler.name + '！';   // 只改一个字
    var rBad = G.importText(JSON.stringify(bad), 's2');
    check('导入被篡改的存档 → 校验和拦住', rBad.ok === false && /校验/.test(rBad.msg), rBad.msg);

    check('导入非本游戏 / 版本不符 → 各自给出明确原因', (function () {
      var r1 = G.importText('这不是 JSON');
      var r2 = G.importText('{"_fmt":"other"}');
      var r3 = G.importText('{"_fmt":"sanguo-save","_ver":99,"state":{}}');
      return r1.ok === false && /JSON/.test(r1.msg)
        && r2.ok === false && /本游戏/.test(r2.msg)
        && r3.ok === false && /版本/.test(r3.msg);
    })());

    var rOk = G.importText(ex.text, 's2');
    check('导入正常存档 → 落到指定槽位', rOk.ok === true && rOk.slot === 's2' && !!G.slotMetaOf('s2'), rOk.msg);

    var back = G.loadFrom('s2');
    check('从槽位读档 → 复现同一份（城池数一致、地形已重建）',
      !!back && back.cities.length === pack.state.cities.length && !!back.map,
      back ? (back.cities.length + ' 城') : '读取失败');

    var rd = G.dropSlot('s2');
    check('清空槽位 → 内容没了、索引也清干净',
      rd.ok === true && G.slotMetaOf('s2') === null && G.loadFrom('s2') === null, rd.msg);
    check('主档不可删除（防手滑把当前档清掉）', G.dropSlot('main').ok === false);

    check('轮换顺序：a3←a2←a1←main（坏档不会当场盖掉唯一好档）', (function () {
      var k = function (id) { return G.slotOf(id).key; };
      G.saveTo('s1');
      try { localStorage.setItem(k('main'), 'M1'); localStorage.setItem(k('a1'), 'A1'); localStorage.setItem(k('a2'), 'A2'); } catch (e) { return false; }
      G.rotateAuto();
      var okOrder = localStorage.getItem(k('a1')) === 'M1'
        && localStorage.getItem(k('a2')) === 'A1'
        && localStorage.getItem(k('a3')) === 'A2';
      return okOrder;
    })());

    ['s1', 's2', 's3', 'a1', 'a2', 'a3'].forEach(function (id) { G.dropSlot(id); });
    try { localStorage.removeItem('sanguo_slots_v3'); } catch (e) {}
    G.state = stBackup;
  })();
'''
patch('smoke-test.js',
      "})();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
      SMOKE_SECTION + "\n})();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
      1, 'smoke 第 52 节')

# =====================================================================
# ⑤ e2e 新增：存档面板（真实 localStorage + 真实 DOM）
# =====================================================================
E2E_SECTION = r'''
/* ==================== v67 · 存档管理面板（真实 DOM） ==================== */
G.ui.setView('settings');
await sleep(80);
const svBtn = document.querySelector('[data-action="open-saves"]');
check('设置页第一张卡就是存档入口', !!svBtn);
if (svBtn) {
  svBtn.click();
  await sleep(120);
  const rootHtml = document.querySelector('#modal-root').innerHTML;
  const rows = (rootHtml.match(/class="sv-row"/g) || []).length;
  check('存档面板：7 个槽位一屏放完（7 行）', rows === 7, '实测 ' + rows + ' 行');
  check('面板无内部滚动条（老板硬规矩：弹窗内禁止下拉条）', rootHtml.indexOf('sv-list') >= 0
    && !/sv-list[^"]*"[^>]*style="[^"]*overflow/.test(rootHtml));

  const wBtn = document.querySelector('[data-action="save-slot-write"][data-slot="s1"]');
  check('空槽只给「存入」（不给读取/导出）', !!wBtn
    && !document.querySelector('[data-action="save-slot-load"][data-slot="s1"]'));
  if (wBtn) {
    wBtn.click();
    await sleep(150);
    const m = G.slotMetaOf('s1');
    check('点击「存入」→ 槽位写入成功且索引有摘要', !!m && m.cities === G.state.cities.length,
      m ? (m.cities + ' 城 / ' + (m.size / 1024).toFixed(1) + 'KB') : '无摘要');
    /* 有档之后应该出现「读取」，点它要弹二次确认（不可逆操作必须问） */
    const lBtn = document.querySelector('[data-action="save-slot-load"][data-slot="s1"]');
    check('有档之后才出现「读取」', !!lBtn);
    if (lBtn) {
      lBtn.click();
      await sleep(120);
      const ask = document.querySelector('#modal-root').innerHTML;
      check('读取前有二次确认（写清"当前进度会被替换"）',
        ask.indexOf('save-slot-load-do') >= 0 && ask.indexOf('替换') >= 0);
      const cancel = document.querySelector('#modal-root [data-action="close-modal"]');
      if (cancel) cancel.click();
      await sleep(80);
    }
    /* 导出：只验证文本（文件下载由浏览器接管，headless 里不点它） */
    const ex = G.exportText('s1');
    check('面板背后的导出文本可解析且自描述', ex.ok && JSON.parse(ex.text)._fmt === 'sanguo-save');
    G.dropSlot('s1');
  } else {
    check('点击「存入」→ 槽位写入成功且索引有摘要', false, '未找到存入按钮');
    check('有档之后才出现「读取」', false, '未找到存入按钮');
    check('读取前有二次确认（写清"当前进度会被替换"）', false, '未找到存入按钮');
  }
  G.ui.closeModal();
  await sleep(60);
}
G.ui.setView('city');
await sleep(60);

'''
patch('e2e-test.js', 'G.ui.setView(\'city\');\nawait sleep(60);\nreturn finish();',
      E2E_SECTION + "return finish();", 1, 'e2e 存档面板')

print('\n'.join(REPORT))
print()
if FAIL:
    print('⚠️ 未命中：')
    for f in FAIL:
        print('   ', f)
    raise SystemExit(1)
print('补丁 3/3 全部落盘')
