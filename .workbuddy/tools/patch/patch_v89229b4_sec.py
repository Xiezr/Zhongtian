# -*- coding: utf-8 -*-
# v89.229 批 b4：main.js 漏网修复 + smoke §229b 守卫段
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    tmp = BASE + p + '.tmp229b4'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

# ---------- ① main.js 文案漏网 ----------
p1 = 'js/main.js'
s = rd(p1)
old = "        '（共 ' + (b.extN || 0) + ' 块：集水场 / 木料场 / 碎石场 / 废铁场）</span></div>' +"
new = "        '（共 ' + (b.extN || 0) + ' 块：净化厂 / 水培温室 / 发电站 / 电弧熔炉）</span></div>' +"
assert s.count(old) == 1, 'main 锚点 %d' % s.count(old)
if not DRY:
    wr(p1, s.replace(old, new)); print('[OK] main.js 1 处')
else:
    print('[DRY] main.js 1 处命中')

# ---------- ② smoke §229b 段 ----------
p2 = 'smoke-test.js'
s = rd(p2)
ANCHOR = """      bad10.length === 0, bad10.join(' ') || (ok10 + '/16 ≥4.5'));
  })();"""
assert s.count(ANCHOR) == 1, 'smoke 锚点 %d' % s.count(ANCHOR)
assert '§229b⑪' not in s, 'already inserted'
SEC = """      bad10.length === 0, bad10.join(' ') || (ok10 + '/16 ≥4.5'));
  })();

  /* ============================================================
   * §229b（v89.229 批 b）：资源四类重定义 —— 生物质 / 净水 / 电能 / 废钢
   * ------------------------------------------------------------
   * 老板原话：「结合废土背景和兵种，资源类型可以分为生物质（水培温室），
   *   净水（净化厂），电能（发电站），废钢（电弧熔炉）」
   * key 与机制零变化、老档零迁移（只换显示名与产地建筑名）。
   * ============================================================ */
  console.log('\\n===== §229b 资源四类换代（生物质/净水/电能/废钢）=====');
  (function () {
    var fs229b = require('fs'), path229b = require('path');
    var d9 = fs229b.readFileSync(path229b.join(__dirname, 'js', 'data.js'), 'utf8');
    var u9 = fs229b.readFileSync(path229b.join(__dirname, 'js', 'ui.js'), 'utf8');
    var q9 = fs229b.readFileSync(path229b.join(__dirname, 'js', 'questdata.js'), 'utf8');
    var m9 = fs229b.readFileSync(path229b.join(__dirname, 'js', 'main.js'), 'utf8');
    var st9 = fs229b.readFileSync(path229b.join(__dirname, 'js', 'state.js'), 'utf8');
    function strip229b(s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); }

    /* ⑪ 资源四类换代（逐表核 · key 不动 = 老档零迁移） */
    check('§229b⑪ 资源四类换代：净水/生物质/电能/废钢 + 产地建筑 净化厂/水培温室/发电站/电弧熔炉（key 不动）', (function () {
      var rn = {}; (DATA.RESOURCES || []).forEach(function (r) { rn[r.key] = r; });
      var eb = DATA.EXT_BUILDINGS;
      return rn.grain.name === '净水' && rn.wood.name === '生物质' && rn.stone.name === '电能' && rn.iron.name === '废钢'
        && rn.grain.icon === '\\u{1F4A7}' && rn.wood.icon === '\\u{1F33F}' && rn.stone.icon === '\\u26A1' && rn.iron.icon === '\\u{1F529}'
        && eb.farm.name === '净化厂' && eb.forest.name === '水培温室'
        && eb.quarry.name === '发电站' && eb.mine.name === '电弧熔炉'
        && eb.farm.res === 'grain' && eb.forest.res === 'wood'
        && eb.quarry.res === 'stone' && eb.mine.res === 'iron';
    })());

    /* ⑫ 旧词剥注释零残留（五文件）——沿革注释豁免（剥注释后查） */
    check('§229b⑫ 旧词剥注释零残留（木料场/碎石场/废铁场/集水场/「木料」写法 · 五文件）', (function () {
      var bad = [];
      [['data', d9], ['ui', u9], ['quest', q9], ['main', m9], ['state', st9]].forEach(function (it) {
        var src = strip229b(it[1]);
        ['木料场', '碎石场', '废铁场', '集水场', "'木料'"].forEach(function (w) {
          if (src.indexOf(w) >= 0) bad.push(it[0] + ':' + w);
        });
      });
      return bad.length === 0;
    })(), '五文件剥注释后零残留（沿革注释豁免）');

    /* ⑬ ui.RES_NAME / RES_ICON 与资源换代同源（单字层跟随：水/生/电/钢） */
    check('§229b⑬ ui.RES_NAME/RES_ICON 与资源换代同源（水/生/电/钢 · 四图标）', (function () {
      var uu = strip229b(u9);
      return /ui\\.RES_NAME = \\{ grain: '水', wood: '生', stone: '电', iron: '钢', gold: '金' \\}/.test(uu)
        && /ui\\.RES_ICON = \\{ grain: '\\u{1F4A7}', wood: '\\u{1F33F}', stone: '\\u26A1', iron: '\\u{1F529}', gold: '\\u{1F4B0}' \\}/.test(uu);
    })());
  })();"""
if not DRY:
    wr(p2, s.replace(ANCHOR, SEC))
    t = rd(p2)
    assert '§229b⑪' in t and '§229b⑬' in t
    print('[OK] smoke §229b 段已插入（3 断）')
else:
    print('[DRY] smoke §229b 段锚点命中')
print('B4 DONE%s' % ('（DRY）' if DRY else ''))
