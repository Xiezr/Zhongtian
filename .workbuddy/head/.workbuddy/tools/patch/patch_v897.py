# -*- coding: utf-8 -*-
"""
v89.7 补丁（2026-09-17 · 老板「头像可更换；供奉+1这个公文不要显示」）

改动清单（每处先断言 old 唯一命中，改后落盘回查）：
  1) js/state.js  : GAME.artGain 重写 —— 小数寄存 st.frac（低倍率不再被取整吃掉）；
                    只有「有缘由」的入账才写公文（时长累积静默，升阶照报）。
  2) js/domain.js : 新增 GAME.setLordAvatar(idx)（只改 portraitSeed，两处同源，越界拒绝）。
  3) js/ui.js     : 新增 ui.openAvatarPick()（5×4 头像池点选面板）；
                    君主面板加「头像」行（缩略图 + 更换入口）。
  4) js/main.js   : 三个动作 case（open-avatar-pick / pick-lord-avatar / close-avatar-pick）。
  5) index.html   : .av-* / .lord-av-mini / 顶栏 hover 样式；顶栏头像挂 data-action。
  6) smoke-test.js: §82 四条断言。
  7) e2e-test.js  : §82 头像更换真实点击（四条）。

用法：python patch_v897.py     （任一锚点未命中即打印 FAIL 并以码 1 退出，不做半截改动）
"""
import io, sys

ROOT = r'E:\Deepseekdb'
FAILS = []


def read(p):
    return io.open(ROOT + '\\' + p, encoding='utf-8', newline='').read()


def write(p, s):
    io.open(ROOT + '\\' + p, 'w', encoding='utf-8', newline='').write(s)


def apply(path, old, new, tag):
    src = read(path)
    n = src.count(old)
    if n != 1:
        FAILS.append('[%s] 锚点命中 %d 次（应为 1）—— 已跳过' % (tag, n))
        return
    src = src.replace(old, new, 1)
    write(path, src)
    back = read(path)
    if new not in back:
        FAILS.append('[%s] 落盘回查失败' % tag)
        return
    print('OK  ' + tag)


# ============================================================
# 1) state.js · GAME.artGain 重写
# ============================================================
OLD = '''  GAME.artGain = function (n, why) {
    n = Math.round(n || 0);
    if (n <= 0) return 0;
    var st = GAME.artStore();
    var lv0 = GAME.artLevelOf();
    st.pts += n;
    var lv1 = GAME.artLevelOf();
    GAME.log('🏺 供奉 +' + U.fmt(n) + (why ? '（' + why + '）' : '') + '　当前 ' + U.fmt(st.pts));
    if (lv1 > lv0) {
      (DATA.ARTIFACTS || []).forEach(function (a) {
        GAME.log('🏺 「' + a.name + '」升至 Lv' + lv1 + ' —— ' + ui77ArtEff(a, lv1));
      });
    }
    return n;
  };'''

NEW = '''  GAME.artGain = function (n, why) {
    /* v89.7（老板「供奉+1这个公文不要显示」）两处：
       ① 只有"有缘由"的入账（攻占城池 / 爵位晋升）才写公文 ——
          时长自然累积一律静默（升阶那条报喜保留）。
       ② 小数寄存在 st.frac 里攒整 —— 低倍率下每秒只有 0.x 点，
          旧写法 Math.round 把它整段吃掉（120× 实测永远 +0）；
          修后各倍率口径一致：3 点 / 游戏小时。 */
    n = n || 0;
    if (n <= 0) return 0;
    var st = GAME.artStore();
    var lv0 = GAME.artLevelOf();
    var add = Math.floor(n);
    st.frac = (st.frac || 0) + (n - add);
    if (st.frac >= 1) { var f = Math.floor(st.frac); add += f; st.frac -= f; }
    if (add <= 0) return 0;                     /* 还没攒够 1 点：静默 */
    st.pts += add;
    var lv1 = GAME.artLevelOf();
    if (why) GAME.log('🏺 供奉 +' + U.fmt(add) + '（' + why + '）　当前 ' + U.fmt(st.pts));
    if (lv1 > lv0) {
      (DATA.ARTIFACTS || []).forEach(function (a) {
        GAME.log('🏺 「' + a.name + '」升至 Lv' + lv1 + ' —— ' + ui77ArtEff(a, lv1));
      });
    }
    return add;
  };'''

apply('js/state.js', OLD, NEW, 'state.js · artGain 重写')

# ============================================================
# 2) domain.js · GAME.setLordAvatar
# ============================================================
OLD = '''    GAME.log('君主更名：' + name);
    return { ok: true, msg: '君主已更名为 ' + name };
  };'''

NEW = OLD + '''

  /* --------- 君主换头像（v89.7 · 老板「头像可更换」） ---------
   * 只改一处事实源：`s.ruler.portraitSeed`（头像池下标，一个整数）。
   * v70 口径「君主与君主将领同脸」—— 两处同源一起改（同改名：两处同更）。
   * 可用池按性别：m / f 各 20 张；越界拒绝，不动任何字段。 */
  GAME.setLordAvatar = function (idx) {
    var s = GAME.state;
    if (!s || !s.ruler) return { ok: false, msg: '尚未开局' };
    var pool = (GAME.portraits && GAME.portraits.POOL
      && GAME.portraits.POOL[s.ruler.gender === 'female' ? 'f' : 'm']) || [];
    if (!pool.length) return { ok: false, msg: '头像池不可用（assets/portraits/pool 缺失）' };
    idx = Math.floor(Number(idx));
    if (!(idx >= 0 && idx < pool.length)) return { ok: false, msg: '头像编号越界（0 ~ ' + (pool.length - 1) + '）' };
    s.ruler.portraitSeed = idx;
    var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (lg) lg.portraitSeed = idx;   /* v70：两处同源（顶栏立绘 + 将领页的脸） */
    return { ok: true, msg: '已更换头像（第 ' + (idx + 1) + ' 张）' };
  };'''

apply('js/domain.js', OLD, NEW, 'domain.js · setLordAvatar')

# ============================================================
# 3) ui.js · openAvatarPick + 君主面板头像行
# ============================================================
OLD = '''      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城池与爵位晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };'''

NEW = OLD + '''

  /* ============================================================
   * 头像更换面板（v89.7 · 老板「头像可更换」）
   * ------------------------------------------------------------
   * 与创建界面 / 麾下将领同一套头像池（assets/portraits/pool，按性别 20 张）。
   * 点选即换：改的是唯一事实源 `s.ruler.portraitSeed`（GAME.setLordAvatar）——
   * 顶栏立绘、君主面板预览、将领页的脸全部同源生效。
   * 「完成」回君主面板（与改名同一套流程：动作后回到原面板）。
   * ============================================================ */
  ui.openAvatarPick = function () {
    var s = GAME.state;
    var gender = (s.ruler && s.ruler.gender === 'female') ? 'f' : 'm';
    var pool = (GAME.portraits && GAME.portraits.POOL && GAME.portraits.POOL[gender]) || [];
    var seed = (s.ruler && s.ruler.portraitSeed) || 0;
    var cur = pool.length ? (seed % pool.length) : 0;
    var body;
    if (!pool.length) {
      body = '<div class="q-empty">头像池不可用（assets/portraits/pool 缺失）。</div>';
    } else {
      body = '<div class="ui-sub" style="text-align:center;">共 ' + pool.length +
          ' 张 · 与麾下将领同一套画师　—— 点一张即换，换错再点一张就行。</div>' +
        '<div class="av-grid">' +
        pool.map(function (file, i) {
          return '<div class="av-cell' + (i === cur ? ' cur' : '') +
            '" data-action="pick-lord-avatar" data-idx="' + i + '" title="第 ' + (i + 1) + ' 张">' +
            '<img src="' + GAME.portraits.DIR + 'pool/' + file + '" alt="头像 ' + (i + 1) + '"></div>';
        }).join('') +
        '</div>';
    }
    var sh = ui.modalShell({
      title: '👤 更换头像', sub: '点选即换 · 随档保存',
      body: body, size: 'lg',
      foot: '<div class="m-foot"><button class="btn" data-action="close-avatar-pick">完成</button></div>'
    });
    /* noClose：底部由本面板自管（「完成」要回君主面板，不是单纯关窗） */
    ui.openModal(sh.html, { size: 'lg', noClose: true });
  };'''

apply('js/ui.js', OLD, NEW, 'ui.js · openAvatarPick')

OLD = '''          '<tr><td class="k">君主姓名</td><td><b>' + U.escape(s.ruler.name) + '</b>　' +
            '<button class="btn sm" data-action="open-rename-lord">改名</button></td></tr>' +'''

NEW = OLD + '''
          /* v89.7（老板「头像可更换」）：头像行 —— 现脸缩略图 + 更换入口 */
          '<tr><td class="k">头像</td><td>' + (function () {
            var face = GAME.portraits ? GAME.portraits.poolFile({
              gender: s.ruler.gender, portraitSeed: s.ruler.portraitSeed }) : '';
            return (face ? '<img class="lord-av-mini" src="' + face + '" alt="君主头像">' : '') +
              '<button class="btn sm" data-action="open-avatar-pick">更换</button></td></tr>' +'''

apply('js/ui.js', OLD, NEW, 'ui.js · 君主面板头像行')

# ============================================================
# 4) main.js · 三个动作 case
# ============================================================
OLD = "      case 'open-artifacts': ui.openArtifacts(); break;"

NEW = OLD + '''
      /* v89.7（老板）：「头像可更换」—— 顶栏头像 / 君主面板「更换」都开这面板；
         点选即换（GAME.setLordAvatar 改 portraitSeed，两处同源）；
         「完成」回君主面板（与改名同一套流程）。 */
      case 'open-avatar-pick': ui.openAvatarPick(); break;
      case 'pick-lord-avatar': (function () {
        var avr = GAME.setLordAvatar(el.dataset.idx);
        if (avr.ok) {
          ui.syncHeader();      /* 顶栏立绘立刻换，不等下一拍 */
          ui.openAvatarPick();  /* 面板原地重绘：高亮跟到新脸 */
        }
        ui.toast(avr.msg);
      })(); break;
      case 'close-avatar-pick': ui.openLordInfo(); break;'''

apply('js/main.js', OLD, NEW, 'main.js · 三个 case')

# ============================================================
# 5) index.html · 顶栏头像可点 + 样式
# ============================================================
OLD = '             该行退役、君主名并入信息表首行；旧的头像旁名称列一并撤除。 -->'
NEW = '''             该行退役、君主名并入信息表首行；旧的头像旁名称列一并撤除。
             v89.7（老板「头像可更换」）：头像本身成为更换入口（点它进头像池点选）。 -->'''
apply('index.html', OLD, NEW, 'index.html · 顶栏注释')

OLD = '          <div class="lord-portrait" id="lord-avatar"></div>'
NEW = '          <div class="lord-portrait" id="lord-avatar" data-action="open-avatar-pick" title="点击更换头像"></div>'
apply('index.html', OLD, NEW, 'index.html · 顶栏头像挂动作')

OLD = '  .art-side { color: var(--text-dim); font-size: var(--fs-cap); white-space: nowrap; }'
NEW = OLD + '''

  /* v89.7（老板「头像可更换」）：头像更换面板 —— 5×4 一屏 20 张，点选即换。
     尺寸按 .modal-lg（860×600）反推：格子 96px、网格总高约 414px，不出下拉条。 */
  .av-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
    max-width: 520px; margin: 12px auto 2px; }
  .av-cell { aspect-ratio: 1 / 1; border: 2px solid var(--line-strong); border-radius: 8px;
    overflow: hidden; cursor: pointer; background: #24242e; }
  .av-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .av-cell:hover { border-color: var(--teal-light); }
  .av-cell.cur { border-color: var(--gold); box-shadow: 0 0 10px rgba(201,162,75,.45); }
  /* 君主面板「头像」行的现脸缩略图（与顶栏同源） */
  .lord-av-mini { width: 32px; height: 32px; border: 1px solid var(--gold); border-radius: 5px;
    object-fit: cover; vertical-align: middle; margin-right: 6px; }
  /* 顶栏头像成为更换入口（data-action 挂外层 —— syncHeader 每秒只换内部立绘） */
  .lord-portrait[data-action] { cursor: pointer; }
  .lord-portrait[data-action]:hover { border-color: var(--gold-light); box-shadow: 0 0 10px rgba(201,162,75,.45); }'''

apply('index.html', OLD, NEW, 'index.html · 头像样式')

# ============================================================
# 6) smoke-test.js · §82
# ============================================================
OLD = '''
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
'''

NEW = r'''
/* ============================================================
 * 82. v89.7 · 头像可更换 + 供奉公文静默（老板）
 * ============================================================ */
(function () {
  console.log('\n===== 82. 头像可更换 + 供奉公文静默（v89.7） =====');

  var fs82 = require('fs'), path82 = require('path');
  function rd82(f) { return fs82.readFileSync(path82.join(__dirname, 'js', f + '.js'), 'utf8'); }
  var uS82 = rd82('ui'), mS82 = rd82('main'), dmS82 = rd82('domain');
  var hS82 = fs82.readFileSync(path82.join(__dirname, 'index.html'), 'utf8');

  /* 换头像 = 只改 portraitSeed 一处（合法生效 · 越界拒绝 · 君主将领同源） */
  check('头像：换头像只改 portraitSeed（合法生效 · 越界拒绝 · 两处同源）', (function () {
    var s = GAME.state;
    s.ruler = s.ruler || {};
    var lg = GAME.lordGeneralOf();
    var bkR = s.ruler.portraitSeed, bkL = lg ? lg.portraitSeed : null;
    var r1 = GAME.setLordAvatar(5);
    var ok1 = r1.ok === true && s.ruler.portraitSeed === 5 && (!lg || lg.portraitSeed === 5);
    var r2 = GAME.setLordAvatar(999);
    var ok2 = r2.ok === false && s.ruler.portraitSeed === 5;
    var r3 = GAME.setLordAvatar(-1);
    var ok3 = r3.ok === false && s.ruler.portraitSeed === 5;
    s.ruler.portraitSeed = bkR;
    if (lg && bkL != null) lg.portraitSeed = bkL;
    return ok1 && ok2 && ok3;
  })());

  check('头像：接线（君主面板入口 · 顶栏可点 · 点选动作 · 网格样式 · 动作分发）', (function () {
    return /data-action="open-avatar-pick"/.test('' + GAME.ui.openLordInfo)
      && /ui\.openAvatarPick = function/.test(uS82)
      && /GAME\.setLordAvatar = function/.test(dmS82)
      && /data-action="pick-lord-avatar"/.test(uS82)
      && /id="lord-avatar" data-action="open-avatar-pick"/.test(hS82)
      && /\.av-grid \{/.test(hS82) && /\.av-cell\.cur \{/.test(hS82)
      && /\.lord-av-mini \{/.test(hS82)
      && mS82.indexOf("case 'open-avatar-pick'") >= 0
      && mS82.indexOf("case 'pick-lord-avatar'") >= 0
      && mS82.indexOf("case 'close-avatar-pick'") >= 0;
  })());

  /* 供奉：时长累积静默（零新增公文）且小数寄存不再被取整吃掉 */
  check('供奉：时长累积不写公文，零碎小数攒整（120× 15 秒 = +1）', (function () {
    var s = GAME.state;
    var bk = s.artifacts;
    s.artifacts = { pts: 0, frac: 0 };
    var top0 = s.log[0];
    for (var i = 0; i < 15; i++) GAME.artTick(120);   /* 120×：每秒 0.1 点 */
    var noLog = (s.log[0] === top0);                  /* 一条公文都没新增 */
    var pts1 = s.artifacts.pts;                       /* 旧实现：永远 0（被 round 吃掉） */
    var frac1 = s.artifacts.frac;
    s.artifacts = bk;
    return noLog && pts1 === 1 && frac1 > 0.3 && frac1 < 0.7;
  })());

  /* 供奉：有缘由的入账照写公文（占城 / 晋升一类） */
  check('供奉：有缘由的入账照写公文（数额整数 · 带缘由）', (function () {
    var s = GAME.state;
    var bk = s.artifacts;
    s.artifacts = { pts: 0, frac: 0 };
    GAME.artGain(40, '验收 · 开疆拓土');
    var hit = false;
    for (var i = 0; i < Math.min(6, s.log.length); i++) {
      if (String(s.log[i].msg).indexOf('供奉 +40（验收 · 开疆拓土）') >= 0) { hit = true; break; }
    }
    s.artifacts = bk;
    return hit;
  })());
})();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
'''

apply('smoke-test.js', OLD, NEW, 'smoke-test.js · §82')

# ============================================================
# 7) e2e-test.js · §82（真实点击）
# ============================================================
OLD = '''  G.ui.setView('city');
  await sleep(60);
  return finish();
}
'''

NEW = '''  console.log('');
  console.log('--- 82. v89.7 · 头像可更换（真实点击） ---');
  await (async function () {
    var avEl = document.querySelector('#lord-avatar');
    check('★ 顶栏头像可点（data-action 挂外层 · 每秒重绘不丢）',
      !!avEl && avEl.getAttribute('data-action') === 'open-avatar-pick');
    var lgEl = G.lordGeneralOf ? G.lordGeneralOf() : null;
    var seed0 = G.state.ruler.portraitSeed;
    var lgSeed0 = lgEl ? lgEl.portraitSeed : null;
    var cur0 = (seed0 || 0) % 20;
    click(avEl);
    await sleep(30);
    var cells = document.querySelectorAll('#modal-root .av-cell');
    var curEl0 = document.querySelector('#modal-root .av-cell.cur');
    check('★ 开出头像面板（20 张 · 当前脸唯一高亮）', cells.length === 20
      && !!curEl0 && curEl0.dataset.idx === String(cur0));
    var target = null;
    for (var i = 0; i < cells.length; i++) {
      if (Number(cells[i].dataset.idx) !== cur0) { target = cells[i]; break; }
    }
    click(target);
    await sleep(30);
    var seed1 = G.state.ruler.portraitSeed;
    var curEl1 = document.querySelector('#modal-root .av-cell.cur');
    var img1 = document.querySelector('#lord-avatar img');
    check('★ 点选即换（seed 变 · 高亮跟到新脸 · 顶栏立绘同源更新 · 君主将领同源）',
      !!target && seed1 === Number(target.dataset.idx) && seed1 !== seed0
      && !!curEl1 && Number(curEl1.dataset.idx) === seed1
      && !!img1 && String(img1.getAttribute('src')).indexOf('assets/portraits/pool/') === 0
      && (!lgEl || lgEl.portraitSeed === seed1));
    click(document.querySelector('#modal-root [data-action="close-avatar-pick"]'));
    await sleep(30);
    check('★ 「完成」回到君主面板（头像行就位 · 更换入口可再进）',
      !!document.querySelector('#modal-root [data-action="open-avatar-pick"]')
      && !!document.querySelector('#modal-root .lord-av-mini')
      && document.querySelector('#modal-root').textContent.indexOf('头像') >= 0);
    click(document.querySelector('#modal-root [data-action="close-modal"]'));
    await sleep(30);
    /* 还原：不污染后续断言 */
    G.state.ruler.portraitSeed = seed0;
    if (lgEl && lgSeed0 != null) lgEl.portraitSeed = lgSeed0;
    G.ui.syncHeader();
  })();

  G.ui.setView('city');
  await sleep(60);
  return finish();
}
'''

apply('e2e-test.js', OLD, NEW, 'e2e-test.js · §82')

# ============================================================
if FAILS:
    print('\n'.join(['FAIL  ' + x for x in FAILS]))
    sys.exit(1)
print('ALL OK · 7 处改动全部落盘')
