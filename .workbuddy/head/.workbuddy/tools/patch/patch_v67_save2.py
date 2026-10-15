# -*- coding: utf-8 -*-
"""v67 · 存档系统 补丁 2/2：对话框 · 导出导入 · 首页入口 · 样式。

（补丁 1/2 = patch_v67_save.py：状态层槽位体系 + 存档面板 + 设置入口 + 动作接线）
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
# ① ui.js —— 二次确认（读取会覆盖当前进度，必须问） + 载入后进入游戏收口
# =====================================================================
UI_DIALOG = r'''
  /* v67 · 读取存档的二次确认。**当前进度会被完全替换**，属于不可逆操作，
     照「放弃野地」同一套写法：把代价写在正文里，让玩家看得见。 */
  ui.openLoadSlotAsk = function (slotId) {
    var s = GAME.slotOf(slotId);
    if (!s) { ui.toast('槽位不存在'); return; }
    var m = GAME.slotMetaOf(slotId);
    ui._svLoadTarget = slotId;
    ui.openModal(
      '<div class="gold-heading">📂 读取「' + s.name + '」</div>' +
      '<div class="note">读取后，**当前进度会被这一份完全替换**。' +
        '如果当前进度还没存过，返回值前先「存入」一个空槽位。</div>' +
      (m ? '<div class="attr"><span class="k">君主</span><span class="v">' + U.escape(m.name) + '</span></div>' +
           '<div class="attr"><span class="k">进度</span><span class="v">' + (m.era || '') + '·' + (m.yearName || '') +
             '年　城 ' + m.cities + '　将 ' + m.gens + '</span></div>' +
           '<div class="attr"><span class="k">存档时间</span><span class="v">' +
             (GAME.metaTimeText ? GAME.metaTimeText(m.savedAt) : m.savedAt) + '</span></div>'
         : '<div class="note">这个槽位是空的。</div>') +
      '<div class="modal-foot">' +
        (m ? '<button class="btn gold" data-action="save-slot-load-do">确定读取</button>' : '') +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };
  ui.openDropSlotAsk = function (slotId) {
    var s = GAME.slotOf(slotId);
    if (!s) return;
    ui._svDropTarget = slotId;
    ui.openModal(
      '<div class="gold-heading">🗑️ 清空「' + s.name + '」</div>' +
      '<div class="note">清空后这个槽位变回空的，<b>无法撤销</b>（主档不在可清空之列）。</div>' +
      '<div class="modal-foot">' +
        '<button class="btn gold" data-action="save-slot-drop-do">确定清空</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };
  /* 载入完成后的统一入口：doContinue（主档）与 doLoadSlot（任意槽位）共用，
     免得"进游戏要做的几件事"写成两份（本项目最忌的失效模式）。 */
  ui.enterLoaded = function (label) {
    if (GAME.map) GAME.map.generate();
    ui.enterGame();
    GAME.refreshAll();
    var off = GAME._offlineSec || 0;
    var offTxt = '';
    if (off >= 60) {
      offTxt = off >= 3600 ? ('离城 ' + (off / 3600).toFixed(1) + ' 时，已补算')
                           : ('离城 ' + Math.round(off / 60) + ' 分，已补算');
    }
    ui.toast((label || '📂 已载入存档') + (GAME._scaleMigrated ? ' · 时间倍率已提升' : '') +
      (offTxt ? '　' + offTxt : ''));
  };
'''

patch('js/ui.js', '  ui.avatarShift = function (dir) {', UI_DIALOG + '\n  ui.avatarShift = function (dir) {',
      1, '存档对话框 + enterLoaded')

# doContinue 改走 enterLoaded（正则定位到函数结尾，避免手抄多行锚点）
t = rd('js/ui.js')
m = re.search(r'  ui\.doContinue = function \(\) \{.*?\n  \};\n', t, re.S)
if not m:
    FAIL.append('js/ui.js ← [doContinue 重构] 未匹配到函数体')
else:
    old = m.group(0)
    new = ("  ui.doContinue = function () {\n"
           "    var st = GAME.loadGame();\n"
           "    if (!st) { ui.toast('存档读取失败'); ui.setCreate(); return; }\n"
           "    ui.enterLoaded('📂 已载入存档');   // v67：进游戏的三件事统一在这里\n"
           "  };\n")
    wr('js/ui.js', t.replace(old, new, 1))
    REPORT.append('   ✓ js/ui.js [doContinue → enterLoaded]')

# =====================================================================
# ② main.js —— 业务动作：读槽位 / 导出文件 / 选文件导入
# =====================================================================
MAIN_API = r'''  /* ============================================================
   * v67 · 存档系统的业务动作（界面只发 data-action，逻辑都在这儿）
   * ============================================================ */
  GAME.doLoadSlot = function (slotId) {
    var st = GAME.loadFrom(slotId);
    if (!st) { ui.toast('读取失败：该槽位为空，或存档版本不符'); return; }
    ui.closeModal();
    var s = GAME.slotOf(slotId);
    ui.enterLoaded('📂 已载入「' + (s ? s.name : slotId) + '」');
  };
  /* 导出为文件。文本本身就是完整存档（含 _fmt/_ver/_check 自描述头），
     所以"另存为文件"与"粘贴文本"是同一份东西 —— 不用维护两种格式。 */
  GAME.doExportSlot = function (slotId) {
    var r = GAME.exportText(slotId);
    if (!r.ok) { ui.toast(r.msg); return; }
    try {
      var d = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var fn = 'sanguo-' + r.name + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
      var blob = new Blob([r.text], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      ui.toast('📤 已导出 ' + fn + '（' + (r.text.length / 1024).toFixed(1) + 'KB）');
    } catch (e) {
      ui.toast('导出失败：' + ((e && e.message) || '浏览器不支持下载'));
    }
  };
  GAME.doImportPick = function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json,text/plain';
    inp.onchange = function () {
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
    };
    inp.click();
  };

'''
patch('js/main.js', '  /* 野外城池出征（三方式） */', MAIN_API + '  /* 野外城池出征（三方式） */',
      1, '业务动作')

# =====================================================================
# ③ index.html —— 首页入口按钮 + 面板样式
# =====================================================================
patch('index.html',
      """            <button class="btn gold lg hidden" id="create-continue" data-action="create-continue">继续上次的游戏</button>
            <button class="btn lg" id="create-start" data-action="create-start">开始新的征程</button>""",
      """            <button class="btn gold lg hidden" id="create-continue" data-action="create-continue">继续上次的游戏</button>
            <button class="btn lg" id="create-start" data-action="create-start">开始新的征程</button>
            <!-- v67：存档管理放**首页**，因为"换台机器要导入存档"正是从首页开始的 -->
            <button class="btn" id="create-saves" data-action="open-saves">💾 存档管理</button>""",
      1, '首页入口')

CSS = """
  /* ============ v67：存档管理面板 ============
     7 个槽位一屏放完，**不出下拉条**（老板的硬规矩）。 */
  .sv-list { border: 1px solid var(--line); border-radius: 6px; margin-top: 8px; }
  .sv-row {
    display: grid; grid-template-columns: 96px 1fr auto;
    align-items: center; gap: 8px; padding: 6px 8px;
    border-bottom: 1px solid var(--line);
  }
  .sv-row:last-child { border-bottom: none; }
  .sv-row .sv-n { font-weight: 700; }
  .sv-row .sv-s { color: var(--text-dim); font-size: var(--fs-sub); }
  .sv-row .sv-b { display: flex; gap: 4px; }
  .sv-empty { opacity: .5; }
  .sv-imp { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
  .sv-ta {
    width: 100%; height: 72px; margin-top: 6px; box-sizing: border-box;
    background: var(--surface-3); color: var(--text); font-size: var(--fs-cap);
    border: 1px solid var(--line); border-radius: 5px; padding: 6px; resize: vertical;
  }
"""
t = rd('index.html')
i = t.rindex('\n</style>') if '\n</style>' in t else t.index('</style>')
wr('index.html', t[:i] + CSS + t[i:])
REPORT.append('   ✓ index.html [面板 CSS]')

print('\n'.join(REPORT))
print()
if FAIL:
    print('⚠️ 锚点未命中：')
    for f in FAIL:
        print('   ', f)
    raise SystemExit(1)
print('补丁 2/2 全部落盘')
