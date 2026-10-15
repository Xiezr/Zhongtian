# -*- coding: utf-8 -*-
"""v89.209 · 补丁 B：版本号 + §199④ 随轮升级 + smoke/e2e 新增 §209 段
   B1 main.js: GAME.VERSION v89.207 -> v89.209
   B2 smoke §199④: 版本正则随轮升级
   B3 smoke: 文件末尾插 §209 段（6 条：源码级 / 坏档矩阵 / 原子回滚 / seq 守卫 / 真档零误杀 / 档案在册）
   B4 e2e: main 层 return finish() 之前插 §209e 块（3 条 · 真实 localStorage）
"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


# ══════════ B1: main.js 版本号 ══════════
p = R + 'js/main.js'
s = rd(p)
if "GAME.VERSION = 'v89.209';" in s:
    print('[skip] B1 版本号已是 v89.209')
else:
    old = "GAME.VERSION = 'v89.207';"
    assert s.count(old) == 1, 'B1 count=' + str(s.count(old))
    s = s.replace(old, "GAME.VERSION = 'v89.209';", 1)
    wr(p, s)
    print('[ok] B1 版本号 v89.207 -> v89.209')

# ══════════ B2: smoke §199④ 版本正则 ══════════
p = R + 'smoke-test.js'
s = rd(p)
if "/GAME\\.VERSION = 'v89\\.209'/" in s:
    print('[skip] B2 §199④ 已升级')
else:
    old = "      return /GAME\\.VERSION = 'v89\\.207'/.test(mS199)   /* v89.207：版本号每轮迭代更新（本条随轮升级） */"
    assert s.count(old) == 1, 'B2 count=' + str(s.count(old))
    new = "      return /GAME\\.VERSION = 'v89\\.209'/.test(mS199)   /* v89.209：版本号每轮迭代更新（本条随轮升级） */"
    s = s.replace(old, new, 1)
    wr(p, s)
    print('[ok] B2 §199④ 升级 v89.209')

# ══════════ B3: smoke §209 段 ══════════
p = R + 'smoke-test.js'
s = rd(p)
if '§209① 形状抽检唯一出口' in s:
    print('[skip] B3 §209 段已落盘')
else:
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(anchor) == 1, 'B3 anchor count=' + str(s.count(anchor))
    SEC = r"""  /* ============================================================
   * §209（v89.209）· v89.208 评估缺陷链修复
   *   （并发评估会话 docs/v89208-实证评估-新发现.md 的三个缺陷）
   *   ① 存档形状抽检（唯一出口 saveShapeChk · importText/adoptState 双闸）
   *   ② adoptState 原子回滚（失败不留半迁移态）
   *   ③ syncSeq / nextGenId 非数组守卫（坏档不再连锁锁死「新游戏」）
   * ============================================================ */
  (function () {
    /* ① 源码级：唯一出口 + 双闸 + 回滚形态在册 */
    check('§209① 形状抽检唯一出口 saveShapeChk（双闸 + 回滚形态在册）', (function () {
      var fs209 = require('fs'), path209 = require('path');
      var s209 = stripComment(fs209.readFileSync(path209.join(__dirname, 'js', 'state.js'), 'utf8'));
      var d209 = codeOf(s209, 'GAME.saveShapeChk = function');
      var im209 = codeOf(s209, 'GAME.importText = function');
      var ad209 = codeOf(s209, 'GAME.adoptState = function');
      return d209.length > 400
        && im209.indexOf('GAME.saveShapeChk(pack.state)') >= 0
        && ad209.indexOf('GAME.saveShapeChk(st)') >= 0
        && ad209.indexOf('GAME.state = _prev209;') >= 0
        && ad209.indexOf('throw e209;') >= 0;
    })());

    /* ② 行为：坏档矩阵（5 类 × 两形态 = 10 发）+ 真档对照 */
    var R209b = (function () {
      var bk = G.state;
      try {
        G.newGame({ name: 'v209s', cityName: '许都' });
        var good = JSON.parse(G.savePayload());
        var mk = function (mut) { var x = JSON.parse(JSON.stringify(good)); mut(x); return x; };
        var packOf = function (st, wc) {
          var p = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
          if (wc) p._check = G.checksum(JSON.stringify(st));
          return JSON.stringify(p);
        };
        var bads = [
          mk(function (x) { x.cities = [{}]; }),
          mk(function (x) { x.cities = [null]; }),
          (function () { var x = mk(function () { }); x.cities = new Array(5000); for (var i = 0; i < 5000; i++) x.cities[i] = {}; return x; })(),
          mk(function (x) { x.generals = 'oops'; }),
          mk(function (x) { x.map = null; })
        ];
        var acc = 0, thrown = 0;
        [true, false].forEach(function (wc) {
          bads.forEach(function (b) {
            try { if (G.importText(packOf(b, wc), 's3').ok === true) acc++; }
            catch (e) { thrown++; }
          });
        });
        var rOk = G.importText(packOf(good, true), 's3');
        return { acc: acc, thrown: thrown, ok: rOk.ok === true };
      } catch (e0) { return { err: String(e0 && e0.message) }; }
      finally { G.dropSlot('s3'); G.state = bk; }
    })();
    check('§209② 坏档矩阵 10 发全拒（含/省校验和两形态）+ 真档仍通',
      R209b.acc === 0 && R209b.thrown === 0 && R209b.ok === true, JSON.stringify(R209b));

    /* ③ 行为：adoptState 原子（形状坏早拒不触碰 / 深链坏回滚不留半迁移） */
    var R209c = (function () {
      var bk = G.state;
      try {
        G.newGame({ name: 'v209c1', cityName: '许都' });
        var goodRef = G.state;
        var badA = JSON.parse(JSON.stringify(goodRef));
        badA.cities = [{}];
        var threwA = false;
        try { G.adoptState(badA); } catch (e) { threwA = true; }
        var earlyOK = threwA && G.state === goodRef;
        G.newGame({ name: 'v209c2', cityName: '许都' });
        var goodRef2 = G.state;
        var badB = JSON.parse(G.savePayload());
        badB.queues.train = 'oops';
        var threwB = false;
        try { G.adoptState(badB); } catch (e) { threwB = true; }
        var rollbackOK = threwB && G.state === goodRef2 && G.state !== badB
          && !!(G.state.cities && G.state.cities.length === goodRef2.cities.length);
        return { earlyOK: earlyOK, rollbackOK: rollbackOK, threwA: threwA, threwB: threwB };
      } catch (e0) { return { err: String(e0 && e0.message) }; }
      finally { G.state = bk; }
    })();
    check('§209③ adoptState 原子：形状坏早拒（不触碰 GAME.state）+ 深链坏回滚（不留半迁移）',
      R209c.earlyOK === true && R209c.rollbackOK === true, JSON.stringify(R209c));

    /* ④ 行为：seq 守卫（generals 非数组 / 含 null） */
    var R209d = (function () {
      var bk = G.state;
      try {
        G.newGame({ name: 'v209d', cityName: '许都' });
        G.state.inn = {};
        G.state.generals = 'oops';
        var maxD = null, idD = null, errD = null;
        try { maxD = G.syncSeq(); idD = G.nextGenId(); } catch (e) { errD = String(e && e.message); }
        var a209 = errD === null && maxD === 0 && /^g\d+$/.test(idD || '');
        G.state.generals = [null, { id: 'g7', name: 'x', level: 1 }];
        var maxE = null, errE = null;
        try { maxE = G.syncSeq(); } catch (e) { errE = String(e && e.message); }
        return { a: a209, b: errE === null && maxE === 7, errD: errD, errE: errE };
      } catch (e0) { return { err: String(e0 && e0.message) }; }
      finally { G.state = bk; }
    })();
    check('§209④ seq 守卫：generals 非数组 / 含 null 均不崩（max 归位 0 / 7）',
      R209d.a === true && R209d.b === true, JSON.stringify(R209d));

    /* ⑤ 行为：真档零误杀 + 「新游戏」连锁解开 */
    var R209e = (function () {
      var bk = G.state;
      try {
        G.newGame({ name: 'v209e', cityName: '许都' });
        var r1 = G.saveShapeChk(JSON.parse(G.savePayload()));
        G.state.generals = 'oops';
        var errF = null;
        try { G.newGame({ name: 'v209e2', cityName: '许都' }); } catch (e) { errF = String(e && e.message); }
        return { okShape: r1.ok === true, chainOK: errF === null, errF: errF };
      } catch (e0) { return { err: String(e0 && e0.message) }; }
      finally { G.state = bk; }
    })();
    check('§209⑤ 真档产出一律过检（零误杀）+ 坏 generals 不再锁死「新游戏」',
      R209e.okShape === true && R209e.chainOK === true, JSON.stringify(R209e));

    /* ⑥ 需求档案在册 */
    check('§209⑥ 需求档案在册（v89.209 · 修复出处 v89.208 评估）', (function () {
      var a209 = require('fs').readFileSync(require('path').join(__dirname, '需求档案.md'), 'utf8');
      return a209.indexOf('| v89.209 |') >= 0 && a209.indexOf('saveShapeChk') >= 0;
    })());
  })();

"""
    s = s.replace(anchor, SEC + anchor, 1)
    wr(p, s)
    print('[ok] B3 smoke §209 段已插入')

# ══════════ B4: e2e §209 块 ══════════
p = R + 'e2e-test.js'
s = rd(p)
if '§209e①' in s:
    print('[skip] B4 e2e §209 已落盘')
else:
    anchor = "\n  return finish();"
    assert s.count(anchor) == 1, 'B4 anchor count=' + str(s.count(anchor))
    BLK = r"""
  /* ---- §209（v89.209）：存档缺陷链修复（真实 localStorage · 域层真调） ---- */
  {
    const _bk209e = G.state;
    try {
      G.newGame({ name: 'e209', cityName: '许都' });
      const _base209e = JSON.parse(G.savePayload());
      const _pack209e = (st, wc) => {
        const p = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
        if (wc) p._check = G.checksum(JSON.stringify(st));
        return JSON.stringify(p);
      };
      const _mk209e = (mut) => { const x = JSON.parse(JSON.stringify(_base209e)); mut(x); return x; };
      const _rA = G.importText(_pack209e(_mk209e((x) => { x.cities = [{}]; }), true), 's3');
      const _rB = G.importText(_pack209e(_mk209e((x) => { x.generals = 'oops'; }), true), 's3');
      const _rC = G.importText(_pack209e(_mk209e((x) => { x.map = null; }), false), 's3');
      check('§209e① 坏档三例（cities[{}] / generals:oops / map:null）全拒',
        _rA.ok === false && _rB.ok === false && _rC.ok === false,
        _rA.msg + ' | ' + _rB.msg + ' | ' + _rC.msg);
      const _rG = G.importText(_pack209e(_base209e, true), 's3');
      const _lr = _rG.ok ? G.loadFrom('s3') : null;
      check('§209e② 真档导入→读回仍通（形状门不误伤合法档）',
        _rG.ok === true && !!_lr && _lr.cities.length >= 1, _rG.msg);
      check('§209e③ saveShapeChk 唯一出口在册', typeof G.saveShapeChk === 'function');
    } catch (_e209e) {
      check('§209e 存档缺陷链修复', false, String(_e209e && _e209e.message || _e209e));
    } finally {
      try { G.dropSlot('s3'); } catch (_e2) { }
      G.state = _bk209e;
    }
  }
"""
    s = s.replace(anchor, BLK + anchor, 1)
    wr(p, s)
    print('[ok] B4 e2e §209 块已插入')

print('B 批完成')
