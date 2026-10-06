# -*- coding: utf-8 -*-
"""v89.202 批次D：新增 §202 段落（smoke 结构+行为 · e2e 真渲染+真点）"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# ============================================================
# D1 · smoke：§202 段落（插在 §201 段与结果打印之间）
# ============================================================
D1_ANCHOR = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"

D1_NEW = r'''  })();

  /* ============================================================
   * §202（v89.202）蕴养同款 · 侦查可下拉 · 收藏峰值（达到过即永久解锁）
   * ============================================================ */
  (function () {
    console.log('  --- §202 蕴养同款 / 侦查可下拉 / 收藏峰值 ---');
    var fs202 = require('fs'), path202 = require('path');
    var uS202 = fs202.readFileSync(path202.join(__dirname, 'js/ui.js'), 'utf8');
    var mS202 = fs202.readFileSync(path202.join(__dirname, 'js/main.js'), 'utf8');
    var dS202 = fs202.readFileSync(path202.join(__dirname, 'js/domain.js'), 'utf8');
    var stS202 = fs202.readFileSync(path202.join(__dirname, 'js/state.js'), 'utf8');
    var hS202 = fs202.readFileSync(path202.join(__dirname, 'index.html'), 'utf8');

    /* ① 蕴养同款：网格卡 + 筛选 + 底键 + 分页 + 旧单列零残留 */
    check('§202① 蕴养专属界面（网格卡 + 筛选 + 底键 + 分页；旧单列退役）', (function () {
      var fn = codeOf(uS202, 'ui.openLingTemper = function');
      return /enh-card/.test(fn) && /enh-rows/.test(fn) && /ling-filter/.test(fn)
        && /ui\.LING_PER_PAGE/.test(fn) && /ling-pick/.test(fn)
        && /ui\.modalPage\('ling'/.test(fn)
        /* 负向用完整形态（照 §201⑦ 教训：裸 enh-row 会撞 enh-rows） */
        && !/class="enh-row"/.test(fn) && !/class="enh-list"/.test(fn)
        && /size: 'xxl'/.test(fn) && /live: function/.test(fn)
        && /case 'ling-pick': ui\.lingPick\(el\.dataset\.key\); break;/.test(mS202)
        && /case 'ling-filter': ui\.setLingFilter\(el\.dataset\.k\); break;/.test(mS202)
        && /ui\.reopenKeepScroll\(ui\.openLingTemper\)/.test(mS202);
    })());
    check('§202② 蕴养三出口（key 复用 enhKeyOf · 筛选重置页号 · 点选 toggle）', (function () {
      var pick = codeOf(uS202, 'ui.lingPick = function');
      var filt = codeOf(uS202, 'ui.setLingFilter = function');
      var open = codeOf(uS202, 'ui.openLingTemper = function');
      return /ui\._lingSel = \(ui\._lingSel === key\) \? '' : key/.test(pick)
        && /ui\.reopenKeepScroll\(ui\.openLingTemper\)/.test(pick)
        && /ui\._pages\['ling'\] = 1/.test(filt)
        && /ui\.enhKeyOf\(x\) === ui\._lingSel/.test(open)
        && !/ui\.lingKeyOf/.test(uS202);      /* 不另造第二把尺 */
    })());
    check('§202③ CSS：旧单列家族退役（墓碑在 · 规则零残留）', (function () {
      var h = hS202;
      return h.indexOf('v89.202（老板 1「蕴养同款」）') >= 0
        && !/\.enh-row \{ display: flex; align-items: center/.test(h)
        && !/\.enh-list \{ display: flex; flex-direction: column; \}/.test(h)
        && /\.enh-rows \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/.test(h);
    })());

    /* ② 侦查可下拉：滚动机制在册（.inner-panel overflow-y:auto）+ 档位不变 + 裁决留档 */
    check('§202④ 侦查可下拉：滚动容器规则在册（机制来源）· 面板 xxl+tall 不变', (function () {
      var panel = codeOf(mS202, 'ui.openScoutResult = function');
      return /\.modal \.inner-panel \{ flex: 1; min-height: 0; overflow-y: auto; \}/.test(hS202)
        && /ui\.openModal\(html, \{ size: 'xxl', tall: true \}\)/.test(panel)
        && /采纳\*\*可下拉\*\*/.test(mS202)               /* 裁决留档在注释里（含分页备选） */
        && /分页备选（以板块名称为页码）未实施/.test(mS202);
    })());

    /* ③ 收藏峰值：结构 + 行为（真造"回落"场景） */
    check('§202⑤ 收藏峰值结构：collectPeakOf / Sweep 出口 + tickOnce 挂钩 + 文案口径', (function () {
      return /GAME\.collectPeakOf = function/.test(dS202)
        && /GAME\.collectPeakSweep = function/.test(dS202)
        && /if \(GAME\.collectPeakSweep\) GAME\.collectPeakSweep\(\);/.test(stS202)
        && /return GAME\.collectPeakOf\(type, cur\);/.test(dS202)
        && /<i>最高 ' \+ U\.fmt\(cd\.cur\)/.test(uS202)
        && uS202.indexOf('解锁按历史最高判定') >= 0
        && /（最高 ' \+ U\.fmt\(_cd196\.cur\)/.test(dS202);
    })());
    check('§202⑥ 收藏峰值行为：品种回落 → 条件保持解锁（对照：现值确实回落）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'peak202', cityName: '许都' });
        G.state = st;
        var target = null;
        ((G.DATA.COLLECT || {}).series || []).forEach(function (sr) {
          (sr.items || []).forEach(function (it) {
            var cd = G.collectCondOf(it.id);
            if (cd && cd.type === 'itemKind' && !target) target = { id: it.id, n: cd.n };
          });
        });
        if (!target) return false;
        st.items = {};
        for (var i = 0; i < target.n + 2; i++) st.items['pk202_' + i] = 1;
        var met0 = G.collectCondMetOf(target.id);          /* 达成（并记录峰值） */
        var keys = Object.keys(st.items);
        for (var j = 1; j < keys.length; j++) delete st.items[keys[j]];
        var rawNow = Object.keys(st.items).length;          /* 真实现值（防平凡解） */
        var met1 = G.collectCondMetOf(target.id);           /* 峰值口径 → 保持解锁 */
        return met0 === true && rawNow < target.n && met1 === true
          && G.collectCondValOf('itemKind') >= target.n;
      } finally { G.state = keep; }
    })());
    check('§202⑦ 收藏峰值：老档无 collectPeak 字段 → 首读以现值初始化（非零值验证）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'peak202b', cityName: '许都' });
        G.state = st;
        delete st.collectPeak;
        st.rank = 3;                                   /* 非零 · 防 0===0 平凡解 */
        var v = G.collectCondValOf('rank');
        return v === 3 && st.collectPeak && st.collectPeak.rank === 3;
      } finally { G.state = keep; }
    })());

    /* ④ 档案在册（本仓纪律） */
    check('§202⑧ 需求档案在册（v89.202 · 老板原文关键句）', (function () {
      var a = fs202.readFileSync(path202.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.202') >= 0 && a.indexOf('蕴养同款') >= 0
        && a.indexOf('可下拉') >= 0 && a.indexOf('按建议进行') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');'''

rep('D1 smoke §202 段', R + 'smoke-test.js', D1_ANCHOR, D1_NEW, '§202① 蕴养专属界面')

# ============================================================
# D2 · e2e：§202 段落（插在 §201 段后、return finish() 前）
# ============================================================
D2_ANCHOR = "  }\n\n  return finish();"

D2_NEW = r'''  }

  /* ============================================================
   * §202（v89.202）蕴养同款（真渲染 + 真点）· 收藏峰值（回落场景 DOM 对照）
   * ============================================================ */
  console.log('\n--- §202. v89.202 蕴养同款 / 收藏峰值（真实 DOM） ---');
  {
    const _bkS202 = G.state;
    /* ① 蕴养专属界面：真渲染 → 真点卡片 → 真点蕴养键 → 该件 +1 */
    try {
      const st202 = G.newGame({ name: 'e202a', cityName: '许都' });
      G.state = st202;
      G.ui._cityId = st202.cities[0].id;
      ['lg_weapon_1', 'lg_weapon_4', 'lg_head_2'].forEach((id) => { try { G.addEquip(id); } catch (e) { } });
      st202.items = st202.items || {};
      st202.items.lingsui = 500;
      G.ui._lingSel = null; G.ui._lingFilter = 'all'; G.ui._pages['ling'] = 1;
      G.ui.closeAllModals();
      G.ui.openLingTemper();
      await sleep(170);
      const cards202 = document.querySelectorAll('#modal-root .enh-card');
      const chips202 = document.querySelectorAll('#modal-root [data-action="ling-filter"]');
      check('§202① 蕴养专属界面真渲染（网格卡 ≥2 + 筛选 chips ×3 + 网格容器）',
        cards202.length >= 2 && chips202.length === 3
        && !!document.querySelector('#modal-root .enh-rows')
        && !document.querySelector('#modal-root .enh-list'),
        'cards=' + cards202.length + ' chips=' + chips202.length);
      cards202[0].click();
      await sleep(170);
      const sel202 = String(G.ui._lingSel || '');
      const btn202 = document.querySelector('#modal-root [data-action="ling-temper-item"]');
      check('§202② 真点卡片 → 选中（底键「' + (btn202 ? btn202.textContent.trim() : 'none') + '」）',
        sel202.length > 0 && !!btn202 && btn202.textContent.indexOf('蕴养') >= 0,
        'sel=' + sel202);
      let lv0_202 = -1;
      G.lingTemperList().forEach((x) => { if (String(G.ui.enhKeyOf(x)) === sel202) lv0_202 = G.eqEnhOf(x); });
      btn202.click();
      await sleep(220);
      let lv1_202 = -1;
      G.lingTemperList().forEach((x) => { if (String(G.ui.enhKeyOf(x)) === sel202) lv1_202 = G.eqEnhOf(x); });
      check('§202③ 真点蕴养 → 该件 +' + lv0_202 + '→+' + lv1_202 + '（选中保留）',
        lv0_202 >= 0 && lv1_202 === lv0_202 + 1 && String(G.ui._lingSel) === sel202,
        'lv0=' + lv0_202 + ' lv1=' + lv1_202);
      G.ui.setLingFilter('done');
      await sleep(160);
      const donePanel202 = document.querySelector('#modal-root .inner-panel');
      check('§202④ 筛选「圆满」：三件未满 → 空态文案在册',
        !!donePanel202 && donePanel202.textContent.indexOf('还没有圆满的修炼装备') >= 0, '');
      G.ui.closeAllModals();
    } finally { G.state = _bkS202; }

    /* ② 收藏峰值 DOM：造回落 → 该卡保持解锁；清峰值（现值不变）→ 同卡回锁（对照） */
    try {
      const st202b = G.newGame({ name: 'e202b', cityName: '许都' });
      G.state = st202b;
      let tgt = null;
      ((G.DATA.COLLECT || {}).series || []).forEach((sr) => {
        (sr.items || []).forEach((it) => {
          const cd = G.collectCondOf(it.id);
          if (cd && cd.type === 'itemKind' && !tgt) tgt = { id: it.id, name: it.name, n: cd.n, sid: sr.id };
        });
      });
      if (!tgt) { check('§202⑤ 收藏峰值 DOM（造局失败：无 itemKind 条件件）', false, ''); }
      else {
        st202b.collectPeak = {};
        st202b.items = {};
        for (let i = 0; i < tgt.n + 2; i++) st202b.items['pk202_' + i] = 1;
        G.collectCondMetOf(tgt.id);                      /* 达成（记录峰值） */
        const ks = Object.keys(st202b.items);
        for (let j = 1; j < ks.length; j++) delete st202b.items[ks[j]];
        G.ui._colCat = tgt.sid; G.ui.setView('collection');
        await sleep(160);
        const findCard = () => {
          let c0 = null;
          Array.from(document.querySelectorAll('#view-container .col-card')).forEach((c) => {
            if (c.textContent.indexOf(tgt.name) >= 0) c0 = c;
          });
          return c0;
        };
        const cardA = findCard();
        check('§202⑤ 回落后期望保持解锁（卡非 locked · 判据读的就是峰值）',
          !!cardA && !cardA.classList.contains('locked'), 'card=' + !!cardA);
        /* 对照：清峰值（真实现值仍=1）→ 同卡重新锁上 —— 证明"解锁靠峰值"不是别的因素 */
        st202b.collectPeak = {};
        G.ui.renderCollect();
        await sleep(130);
        const cardB = findCard();
        check('§202⑥ 对照：清峰值后同卡回锁（现值未变 → 唯一变量是峰值）',
          !!cardB && cardB.classList.contains('locked'), 'card=' + !!cardB);
      }
      G.ui.closeAllModals();
    } finally { G.state = _bkS202; }
  }

  return finish();'''

rep('D2 e2e §202 段', R + 'e2e-test.js', D2_ANCHOR, D2_NEW, '§202① 蕴养专属界面真渲染')

print('批次D 完成')
