# -*- coding: utf-8 -*-
"""v89.196 批次E3/E4：藏珍阁三态 UI（老板 7）
E3a ui.js cards：未解锁（条件+进度）/ 已解锁（激活）/ 已入藏 三态
E3b ui.js help 文案改两段式说明（纯文本 · 无 markdown）
E3c ui.js 一键集齐按钮：有未解锁件时禁用 + 原因
E4  index.html 加 .col-card.locked / .col-lock 样式（全令牌）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- E3a 卡片三态 ----------------
E3A_OLD = """    var cards = slice.map(function (x) {
      var have = GAME.collectHaveOf(x.it.id);
      var can = (GAME.goldOf() || 0) >= x.it.price;
      return '<div class="col-card' + (have ? ' owned' : '') + '">' +
        '<div class="col-ico">' + (x.sr.icon || '🏺') + '</div>' +
        '<div class="col-nm">' + U.escape(x.it.name) +
          (x.it.sub ? '<span class="col-sub">' + U.escape(x.it.sub) + '</span>' : '') + '</div>' +
        '<div class="col-sr">' + U.escape(x.sr.name) + '</div>' +
        (have
          ? '<div class="col-own">✓ 已入藏</div>'
          : '<div class="col-buy"><span class="col-price">' + U.fmt(x.it.price) + ' 金</span>' +
            '<button class="btn sm' + (can ? ' gold' : ' dim') + '" data-action="collect-buy" data-item="' + x.it.id + '"' +
            (can ? '' : ' disabled data-why="黄金不足：需 ' + U.fmt(x.it.price) + ' 金"') + '>购买</button></div>') +
        '</div>';
    }).join('');"""
E3A_NEW = """    var cards = slice.map(function (x) {
      /* v89.196（老板 7）：成就型三态 —— 未解锁（🔒 条件+进度）/ 已解锁待激活（花金）/ 已入藏。 */
      var have = GAME.collectHaveOf(x.it.id);
      var cd = GAME.collectCondOf(x.it.id);
      var unlocked = !cd || cd.met;
      var can = (GAME.goldOf() || 0) >= x.it.price;
      var tail;
      if (have) {
        tail = '<div class="col-own">✓ 已入藏</div>';
      } else if (!unlocked) {
        tail = '<div class="col-lock">🔒 ' + U.escape(cd.name) + ' ≥ ' + U.fmt(cd.n) +
          '<i>' + U.fmt(cd.cur) + ' / ' + U.fmt(cd.n) + '</i></div>';
      } else {
        tail = '<div class="col-buy"><span class="col-price">' + U.fmt(x.it.price) + ' 金</span>' +
          '<button class="btn sm' + (can ? ' gold' : ' dim') + '" data-action="collect-buy" data-item="' + x.it.id + '"' +
          (can ? '' : ' disabled data-why="黄金不足：需 ' + U.fmt(x.it.price) + ' 金"') + '>激活</button></div>';
      }
      return '<div class="col-card' + (have ? ' owned' : (unlocked ? '' : ' locked')) + '">' +
        '<div class="col-ico">' + (x.sr.icon || '🏺') + '</div>' +
        '<div class="col-nm">' + U.escape(x.it.name) +
          (x.it.sub ? '<span class="col-sub">' + U.escape(x.it.sub) + '</span>' : '') + '</div>' +
        '<div class="col-sr">' + U.escape(x.sr.name) + '</div>' +
        tail +
        '</div>';
    }).join('');"""
rep('js/ui.js', 'E3a 卡片三态', E3A_OLD, E3A_NEW, "tail = '<div class=\"col-lock\">🔒 '")

# ---------------- E3b help 文案 ----------------
E3B_OLD = """        ui.help('通过购买成系列的收藏品，消耗后期金币。\\n' +
          '藏品纯为荣誉（不给战斗属性）；**集齐一系**得该系声望，' +
          '全 ' + stat.seriesTotal + ' 系集齐另得 ' + U.fmt(C.allRep || 0) + ' 声望。\\n' +
          '卡上金额为**金**（全境通用池）；已入藏的藏品不再出售（一物一藏）。') +"""
E3B_NEW = """        ui.help('成就型收藏：完成特定任务后藏品【解锁】，再花金币【激活】入藏。\\n' +
          '藏品纯为荣誉（不给战斗属性）；集齐一系得该系声望，' +
          '全 ' + stat.seriesTotal + ' 系集齐另得 ' + U.fmt(C.allRep || 0) + ' 声望。\\n' +
          '卡上金额为金（全境通用池）；已入藏的藏品不再出售（一物一藏）。') +"""
rep('js/ui.js', 'E3b help 文案', E3B_OLD, E3B_NEW, '成就型收藏：完成特定任务后藏品【解锁】')

# ---------------- E3c 一键集齐按钮态 ----------------
E3C_OLD = """    var curMissing = cur ? (cur.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); }) : [];"""
E3C_NEW = """    var curMissing = cur ? (cur.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); }) : [];
    /* v89.196（老板 7）：一键集齐也要过解锁闸 —— 有未解锁件时禁用并给出原因（不做半套）。 */
    var curLocked = curMissing.filter(function (it) {
      var cd = GAME.collectCondOf(it.id);
      return cd && !cd.met;
    });"""
rep('js/ui.js', 'E3c curLocked', E3C_OLD, E3C_NEW, 'var curLocked = curMissing.filter(function (it) {')

E3D_OLD = """        (cur
          ? '<button class="btn sm' + (curMissing.length ? ' gold' : ' dim') + '" data-action="collect-series" data-s="' + cur.id + '"' +
            (curMissing.length ? '' : ' disabled data-why="本系列已集齐"') +
            '>一键集齐本系（' + curMissing.length + ' 件）</button>'
          : '') +"""
E3D_NEW = """        (cur
          ? '<button class="btn sm' + (curMissing.length && !curLocked.length ? ' gold' : ' dim') +
            '" data-action="collect-series" data-s="' + cur.id + '"' +
            (curMissing.length && !curLocked.length ? '' : ' disabled data-why="'
              + (curLocked.length ? ('还有 ' + curLocked.length + ' 件未解锁') : '本系列已集齐') + '"') +
            '>一键集齐本系（' + curMissing.length + ' 件）</button>'
          : '') +"""
rep('js/ui.js', 'E3d 集齐按钮态', E3D_OLD, E3D_NEW, "curLocked.length ? ('还有 ' + curLocked.length + ' 件未解锁')")

# ---------------- E4 CSS ----------------
E4_OLD = """  .col-own { color: var(--green-ok); font-weight: 700; margin-top: auto; }"""
E4_NEW = """  .col-own { color: var(--green-ok); font-weight: 700; margin-top: auto; }
  /* v89.196（老板 7）：成就型 —— 未解锁卡片（条件 + 进度） */
  .col-card.locked { opacity: .55; }
  .col-lock { font-size: var(--fs-sub); color: var(--text-dim); text-align: center;
    margin-top: auto; line-height: var(--lh-tight); }
  .col-lock i { font-style: normal; display: block; color: var(--red-light); font-size: var(--fs-cap); }"""
rep('index.html', 'E4 CSS', E4_OLD, E4_NEW, '.col-lock i { font-style: normal; display: block;')

print('批次E3/E4 完成')
