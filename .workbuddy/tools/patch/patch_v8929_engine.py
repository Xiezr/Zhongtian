# -*- coding: utf-8 -*-
"""v89.29 逸闻入口改版：列表菜单 → 概率奇遇

老板 2026-09-18：「完整的一个故事作为一个独立asset，入口改为概率触发，
点击建筑/地块时随机选择其中一个」。

改动（三文件）：
  ① js/state.js：GAME.SG.TRIG / candidates / roll（候选池 · 掷骰 · 冷却 · pin 钩子）
  ② js/ui.js：移除 SG_BLOCK / openStoryList；openStory 支持 keepModal（叠层）；
               新增 ui.sgTryTrigger；建筑/城外弹窗尾部挂掷骰
  ③ js/main.js：移除 story-list / story-open 动作；城池/地块点击处挂掷骰
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def read(rel):
    return io.open(os.path.join(R, rel), encoding='utf-8', newline='').read()


def write(rel, src):
    p = os.path.join(R, rel)
    tmp = p + '.tmp8929'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, p)


def edit(rel, pairs):
    src = read(rel)
    for old, new, name in pairs:
        n = src.count(old)
        if n != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (rel, name, n))
            sys.exit(1)
        src = src.replace(old, new, 1)
    write(rel, src)
    back = read(rel)
    for _, new, name in pairs:
        assert new in back, '%s / %s' % (rel, name)
    print('OK  ' + rel + '（%d 处）' % len(pairs))


# ============================================================ ① state.js
TRIG_BLOCK = '''  GAME.SG.close = function () { GAME.SG._run = null; };
  /* ============================================================
   * v89.29 · 逸闻奇遇（概率触发入口）
   * ------------------------------------------------------------
   * 入口从「列表菜单」改为「概率奇遇」：点击建筑 / 地块时掷骰，
   * 命中则从该锚点的故事池（每篇 = 一份独立资产）随机抽一篇，
   * 直接在弹窗之上开卷（叠层语义：掩卷后回到原面板）。
   *   · 优先抽「还有未读结局的」；池内全部读毕后转为低概率重读；
   *   · 冷却期内（TRIG.cooldownMs）不再触发 —— 防连点刷屏；
   *   · TRIG.rng / TRIG.pin 为测试与调试钩子（pin 指定必中篇目）。
   * 运行态 _lastAt 不入档（会话级即可）。
   * ============================================================ */
  GAME.SG.TRIG = {
    chance: 0.35,        /* 有未读故事时的触发概率 */
    chanceDone: 0.12,    /* 全部读毕后的重读概率（低） */
    cooldownMs: 60 * 1000,
    rng: Math.random,    /* 返回 [0,1)；可注入（测试） */
    pin: null,           /* 调试/测试：指定命中篇目（须在该锚点池内） */
    _lastAt: 0           /* 上次被抽走的时刻（运行态，不入档） */
  };
  /* 触发池：fresh = 还有未读结局的（优先）；done = 已读全的（重读用） */
  GAME.SG.candidates = function (kind, id) {
    var rows = GAME.SG.anchor(kind, id), fresh = [], done = [];
    rows.forEach(function (r) {
      var total = (r.st.endings || []).length;
      if ((r.done || []).length < total) fresh.push(r); else done.push(r);
    });
    return { fresh: fresh, done: done, total: rows.length };
  };
  /* 掷骰：返回 { fire, why, sid }；why ∈ empty / cool / roll / pin-miss */
  GAME.SG.roll = function (kind, id, at) {
    var cands = GAME.SG.candidates(kind, id);
    if (!cands.total) return { fire: false, why: 'empty' };
    var now = (at == null ? Date.now() : at);
    if (now - GAME.SG.TRIG._lastAt < GAME.SG.TRIG.cooldownMs) return { fire: false, why: 'cool' };
    var pool = cands.fresh.length ? cands.fresh : cands.done;
    var pick = null;
    if (GAME.SG.TRIG.pin) {
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].st.id === GAME.SG.TRIG.pin) { pick = pool[i]; break; }
      }
      if (!pick) return { fire: false, why: 'pin-miss' };
    } else {
      var chance = cands.fresh.length ? GAME.SG.TRIG.chance : GAME.SG.TRIG.chanceDone;
      if (GAME.SG.TRIG.rng() >= chance) return { fire: false, why: 'roll' };
      pick = pool[Math.min(pool.length - 1, Math.floor(GAME.SG.TRIG.rng() * pool.length))];
    }
    GAME.SG.TRIG._lastAt = now;
    return { fire: true, sid: pick.st.id, st: pick.st };
  };'''

edit('js/state.js', [(
    '  GAME.SG.close = function () { GAME.SG._run = null; };',
    TRIG_BLOCK,
    'TRIG 引擎'
)])

# ============================================================ ② ui.js
edit('js/ui.js', [
    # 2.1 建筑弹窗：撤 SG_BLOCK 块
    ('''        /* v89.9（铺量接线）：逸闻块移出「功能」三元 —— 无功能面板的建筑（民房 / 驿站 /
           烽火台 / 鸿胪寺）此前被整个漏掉；现在所有建筑统一渲染，与野地 / 城池入口同构。 */
        ui.SG_BLOCK('building', b.id, b.name) +''',
     '''        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰，
           命中随机抽一篇完整故事直接在面板之上开卷（见本函数尾部）。 */''',
     'building 撤块'),
    # 2.2 建筑弹窗尾：挂掷骰
    ('''          (b.id === 'guanfu' ? ''
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      );
    } else {''',
     '''          (b.id === 'guanfu' ? ''
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      );
      ui.sgTryTrigger('building', b.id);   /* v89.29 · 概率奇遇 */
    } else {''',
     'building 挂掷骰'),
    # 2.3 城外弹窗：撤块
    ('''        /* v89.27（故事库铺量）：城外建筑补齐逸闻入口 —— 与城内/野地/城池三处同规格。
           此前只有 building / wild / city 三处挂点，城外四类（农田/伐木场/采石场/铁矿场）
           的故事全无入口，等于写完读不到。 */
        ui.SG_BLOCK('ext', e.type, eb.name) +''',
     '''        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰（见本函数尾部）。 */''',
     'ext 撤块'),
    # 2.4 城外弹窗尾：挂掷骰
    ('''          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>'
      );
      return;
    }''',
     '''          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>'
      );
      ui.sgTryTrigger('ext', e.type);   /* v89.29 · 概率奇遇 */
      return;
    }''',
     'ext 挂掷骰'),
    # 2.5 城池面板：撤块
    ('''        })() : '') + ui.SG_BLOCK('city', city.type, city.name),''',
     '''        })() : ''),''',
     'city 撤块'),
    # 2.7 撤 SG_BLOCK / openStoryList 定义
    ('''  /* entry block: returns '' when the anchor has no story (no empty shell) */
  ui.SG_BLOCK = function (kind, id, name) {
    if (!GAME.SG) return '';
    var rows = GAME.SG.anchor(kind, id);
    if (!rows.length) return '';
    var done = 0;
    rows.forEach(function (r) { if (r.done.length) done++; });
    return '<div class="op-zone">' +
      '<div class="op-zone-t">逸闻 · 此地故事（' + done + ' / ' + rows.length + '）</div>' +
      '<div class="op-row">' +
        '<button class="btn gold" data-action="story-list" data-kind="' + kind + '" data-id="' + id +
          '" data-name="' + U.escape(name || '') + '">📖 听一段故事</button>' +
        '<span class="op-hint">纯叙事 · 走到结局即得赏赐，不影响战斗与数值结算</span>' +
      '</div></div>';
  };

  /* story list (modal, reuses openShell) */
  ui.openStoryList = function (kind, id, name) {
    var rows = GAME.SG ? GAME.SG.anchor(kind, id) : [];
    var body = rows.length ? rows.map(function (r) {
      var total = (r.st.endings || []).length;
      var tag = r.done.length ? ('已读 ' + r.done.length + ' / ' + total) : '未读';
      return '<div class="res-line" style="align-items:center;gap:10px;">' +
        '<span class="lbl" style="flex:0 0 auto;">' + U.escape(r.st.title) + '</span>' +
        '<span class="ui-sub" style="flex:0 0 auto;">' + tag + '</span>' +
        '<span style="flex:1 1 auto;color:var(--text-dim);font-size:var(--fs-sub);">' +
          U.escape(r.st.hook || '') + '</span>' +
        '<button class="btn gold sm" data-action="story-open" data-sid="' + r.st.id + '">' +
          (r.done.length ? '再读' : '阅读') + '</button></div>';
    }).join('') : '<div class="q-empty">此处暂无故事（故事库按锚点铺开，逐步补齐）。</div>';
    ui.openShell({
      title: '📖 ' + U.escape(name || '逸闻'),
      sub: (ui.SG_KIND[kind] || '') + '　共 ' + rows.length + ' 篇　·　走到任一结局即得赏赐',
      size: 'xl',
      body: body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* open one story (full-screen reader) */''',
     '''  /* v89.29（入口改版）：逸闻入口从「列表菜单」改为「概率奇遇」——
     点开建筑 / 地块时由 ui.sgTryTrigger 掷骰（GAME.SG.roll），命中即随机抽一篇
     完整故事（每篇 = 一份独立资产），在弹窗之上直接开卷；掩卷后回到原面板。
     v89.29 起移除：SG_BLOCK 入口块 / openStoryList 列表弹窗 / story-list · story-open 动作。 */

  /* open one story (full-screen reader) */''',
     '撤块定义'),
    # 2.8 openStory 支持 keepModal + 新增 sgTryTrigger
    ('''  ui.openStory = function (sid) {
    var r = GAME.SG.begin(sid);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui.closeModal();
    ui.sgRender();
  };''',
     '''  ui.openStory = function (sid, keepModal) {
    var r = GAME.SG.begin(sid);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!keepModal) ui.closeModal();
    ui.sgRender();
  };
  /* 概率奇遇：点开建筑 / 地块后掷骰；命中则在面板之上开卷（弹窗不关） */
  ui.sgTryTrigger = function (kind, id) {
    if (!GAME.SG || !GAME.SG.roll || !id) return false;
    var r = GAME.SG.roll(kind, id);
    if (!r.fire) return false;
    ui.openStory(r.sid, true);
    return true;
  };''',
     'openStory + sgTryTrigger'),
])
# 2.6 野地两处：撤块（同串两处，单独以 count==2 处理）
src = read('js/ui.js')
OLD_W = "      wsurvLine + ui.jianghuHTML(x, y) + ui.SG_BLOCK('wild', tile.terrain, ter.name) +"
n_w = src.count(OLD_W)
if n_w != 2:
    print('FAIL [ui.js -> wild 撤块] 命中 %d 次（应为 2）' % n_w)
    sys.exit(1)
src = src.replace(OLD_W, "      wsurvLine + ui.jianghuHTML(x, y) +")
write('js/ui.js', src)
assert "ui.SG_BLOCK('wild'" not in read('js/ui.js')
print('OK  js/ui.js（wild 撤块 ×2）')

# ============================================================ ③ main.js
edit('js/main.js', [
    ('''          ui.openCityPanel(hit.city);
        } else if (hit.kind === 'fort') {''',
     '''          ui.openCityPanel(hit.city);
          /* v89.29：概率奇遇 —— 点城池掷骰（命中随机抽一篇，悬于面板之上） */
          ui.sgTryTrigger('city', hit.city.type);
        } else if (hit.kind === 'fort') {''',
     'city 挂掷骰'),
    ('''        } else if (hit.kind === 'wild') {
          /* v23（需求 1）：已占野地不再是"只弹一句提示"，直接进管理面板 */
          ui.openLandModal(hit.x, hit.y);
        } else {
          ui.openLandModal(hit.x, hit.y);
        }''',
     '''        } else if (hit.kind === 'wild') {
          /* v23（需求 1）：已占野地不再是"只弹一句提示"，直接进管理面板 */
          ui.openLandModal(hit.x, hit.y);
          /* v89.29：概率奇遇 —— 点地块掷骰（命中随机抽一篇，悬于面板之上） */
          var _t89a = G.tile(hit.x, hit.y);
          ui.sgTryTrigger('wild', _t89a && _t89a.terrain);
        } else {
          ui.openLandModal(hit.x, hit.y);
          var _t89b = G.tile(hit.x, hit.y);
          ui.sgTryTrigger('wild', _t89b && _t89b.terrain);
        }''',
     '地块挂掷骰'),
    ('''      case 'story-list': ui.openStoryList(el.dataset.kind, el.dataset.id, el.dataset.name); break;
      case 'story-open': ui.openStory(el.dataset.sid); break;
      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;''',
     '''      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;''',
     '撤动作'),
])

print('ALL OK')
