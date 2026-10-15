# -*- coding: utf-8 -*-
"""patch_v89235c_smoke.py —— smoke 按新口径重写（§0.7）

S1 升级净化厂用例：先抬政务厅（闸门本体由 §235 专测）
S2 giveRes21 全境（自动升级 v89.167 全境遍历的真作用域）
S3 au4 清资源全境（与 S2 同口径）
S4 宫殿进度条断言：距离判据 → 结构判据（对注释长度免疫）

用法：python patch_v89235c_smoke.py [--apply]
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
P = 'smoke-test.js'
s = io.open(R + P, encoding='utf-8', newline='').read()
LOG, FAIL = [], []


def rep(tag, old, new, mark, cnt=1):
    global s
    if s.count(mark) >= 1:
        LOG.append('[skip] ' + tag)
        return
    c = s.count(old)
    if c != cnt:
        FAIL.append('!! %s count=%d want=%d' % (tag, c, cnt))
        return
    s = s.replace(old, new, cnt)
    LOG.append('[ok] ' + tag)


# ---- S1 升级净化厂：先抬政务厅 ----
rep('S1 抬政务厅',
    """  var r2 = G.upgradeExt(emptyIdx);
  check('升级净化厂地块', r2.ok === true, r2.msg);""",
    """  /* v89.235（老板）规则变更：城外资源建筑等级 ≤ 政务厅等级 ——
     本用例验的是**城外地块升级状态机**，先抬政务厅到 Lv2 解锁（闸门本体由 §235 专测）。 */
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { s.res[k] += 500000; });
  var _gi235 = s.cities[0].cells.findIndex(function (cc) { return cc.build && cc.build.id === 'guanfu'; });
  var _ru235 = G.upgradeAt(s.cities[0].id, _gi235);
  check('（§235 造局）政务厅升至 Lv2', _ru235.ok === true, _ru235.msg);
  for (var _iq235 = 0; _iq235 < 120 && s.queues.build.length; _iq235++) G.tickOnce();
  check('（§235 造局）政务厅到位 Lv2', G.buildingLevel(s.cities[0], 'guanfu') >= 2);
  var r2 = G.upgradeExt(emptyIdx);
  check('升级净化厂地块', r2.ok === true, r2.msg);""",
    '（§235 造局）政务厅升至 Lv2')

# ---- S2 giveRes21 全境 ----
rep('S2 giveRes21 全境',
    """  function giveRes21() {
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { S21.res[k] = 5000000; });
    S21.res.gold = 5000000;
  }""",
    """  function giveRes21() {
    /* v89.235（老板）规则变更配套：城外资源建筑等级 ≤ 政务厅等级 后，
       "确定可升项"可能落在别的城（该城政务厅未到顶）—— 自动升级 v89.167 起本就
       遍历全境，"资源恢复"按其真实作用域取**全境**（原只给当前城）。 */
    (S21.cities || []).forEach(function (ct) {
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { ct.res[k] = 5000000; });
      ct.res.gold = 5000000;
    });
  }""",
    '"确定可升项"可能落在别的城')

# ---- S3 au4 清资源全境 ----
rep('S3 au4 清全境',
    """  /* 资源不足 → 暂停 */
  S21.queues.build.length = 0;
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { S21.res[k] = 0; });""",
    """  /* 资源不足 → 暂停（v89.235：与 giveRes21 同口径 —— 全境清） */
  S21.queues.build.length = 0;
  (S21.cities || []).forEach(function (ct) {
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { ct.res[k] = 0; });
  });""",
    '资源不足 → 暂停（v89.235：与 giveRes21 同口径')

# ---- S4 宫殿进度条断言重写 ----
rep('S4 宫殿断言',
    "  check('施工中宫殿显示进度条', /gov-palace[\\s\\S]{0,40}busy[\\s\\S]{0,600}tile-pbar/.test(uS36));",
    """  check('施工中宫殿显示进度条', (function () {
    /* v89.235：原判据赌"busy 到 tile-pbar 的距离 ≤600 字符"—— 对无关注释敏感
       （本轮给渲染块加注释即假红）。改结构判据：① busy 类在 gov-palace 上；
       ② 同一渲染块（到函数尾）里有进度条三件（pbar / bar / pct）。 */
    var _i0 = uS36.indexOf('gov-palace');
    var _seg = uS36.slice(_i0, uS36.indexOf('\\n  };', _i0));
    return /' busy'/.test(_seg) && /tile-pbar/.test(_seg) && /data-build-bar="city:/.test(_seg);
  })());""",
    'v89.235：原判据赌"busy 到 tile-pbar 的距离')

if FAIL:
    print('== FAIL ==')
    for x in FAIL:
        print(' ', x)
    sys.exit(1)
if APPLY:
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s)
    print('== APPLIED ==')
else:
    print('== DRY-RUN ==')
for x in LOG:
    print(' ', x)
