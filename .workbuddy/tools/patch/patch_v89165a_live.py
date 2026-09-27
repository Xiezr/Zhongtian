# -*- coding: utf-8 -*-
"""v89.165 patch：**实时读秒全量排查** —— 五处漏网接入每秒刷新。
   铁律：newline='' 保 LF（§42.2）；分段落盘（§57.3）；幂等守卫查"落盘后文本"（§72.3）。
   运行：python .workbuddy/tools/patch/patch_v89165a_live.py"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def rep(p, tag, old, new, guard):
    s = rd(p)
    if guard in s:
        print('  [skip] ' + tag + '（新特征已在）')
        return
    c = s.count(old)
    assert c == 1, '%s 锚点计数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(p, s)                      # 分段落盘：每段替换后立即写（§57.3）
    print('  [ ok ] ' + tag)


# ════════════════ A1. openBattleList：接入 live（老板报的那处） ════════════════
rep('js/ui.js', 'A1 指挥战斗清单 live',
    """    ui.openModal(ui.battleListHTML(), { size: 'md' });""",
    """    /* v89.165（老板：「指挥战斗界面的行军读秒和进度条不动」）：行军段含
       pbar + 「余 X」读秒 —— 与「行军队列」（openMarches）同口径接入 live
       每秒重开：读秒/进度条逐秒跳动；战斗段的行数增减也随之即时可见。 */
    ui.openModal(ui.battleListHTML(), {
      size: 'md',
      live: function () { ui.openBattleList(); },
    });""",
    guard="live: function () { ui.openBattleList(); }")

# ════════════════ A2. openTrainBoost：接入 live（剩余变短可见 + 完成即关窗） ════════════════
rep('js/ui.js', 'A2 提速小窗 live',
    """    ui.openShell({
      title: '', sub: '',
      size: 'md',
      body: head + body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });""",
    """    ui.openShell({
      title: '', sub: '',
      size: 'md',
      body: head + body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165（老板：「查看所有类似实时读秒设置」）：本窗上文写着「剩余变短看得见」
         —— 但此前没接 live，读秒是静止的。现补上：逐秒重开（剩余/进度实时走）；
         队列走完（trainRushRemain ≤ 0）→ 自动关窗（v89.138 原意，覆盖"开着等自然完成"）。 */
      live: function () {
        if (ui.queueDone138(bIdx)) ui.closeModal();
        else ui.openTrainBoost(bIdx);
      }
    });""",
    guard="if (ui.queueDone138(bIdx)) ui.closeModal();\n        else ui.openTrainBoost(bIdx);")

# ════════════════ A3. openPanel：troops/tech/ext 三子视图接入 live ════════════════
rep('js/ui.js', 'A3a 通用面板 o165 声明',
    """    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +""",
    """    /* v89.165（老板：「查看所有类似实时读秒设置」）：含读秒/进度的子视图接入
       live 每秒重开 —— troops（募兵队列「余 X」+ 队列条）/ tech（研究中 X%）/
       ext（城外施工总览）。纯静态子视图（equip / rank / story）不接，省每秒重建。 */
    var o165 = size ? { size: size } : {};
    if (view === 'troops' || view === 'tech' || view === 'ext') {
      o165.live = function () { ui.openPanel(view, title, size); };
    }
    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +""",
    guard="o165.live = function () { ui.openPanel(view, title, size); };")

rep('js/ui.js', 'A3b 通用面板 opts',
    """      size ? { size: size } : null
    );
  };

  ui.openEquipPanel""",
    """      (o165.size || o165.live) ? o165 : null
    );
  };

  ui.openEquipPanel""",
    guard="(o165.size || o165.live) ? o165 : null")

# ════════════════ A4. openArtifacts：接入 live（供奉值随游戏时间累积） ════════════════
rep('js/ui.js', 'A4 神器面板 live',
    """      rows +
      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城池与爵位晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });""",
    """      rows +
      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城池与爵位晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165：供奉值随游戏时间累积（3 点/游戏小时）—— 接入 live 每秒重开，
         总量与进度条随秒推进（120× 下约每 10 秒 +1 点，肉眼可见）。 */
      { size: 'xl', live: function () { ui.openArtifacts(); } });""",
    guard="live: function () { ui.openArtifacts(); }")

# ════════════════ B1. main.js：军务「烽火」页同样逐秒刷新 ════════════════
rep('js/main.js', 'B1 烽火页逐秒刷新',
    """        /* v89.135（老板 7）：军务总览逐秒刷新（在途行军倒计时）—— 带滚动保持 */
        if (ui.view === 'marches' && (ui._marchTab || 'over') === 'over') {""",
    """        /* v89.135（老板 7）：军务总览逐秒刷新（在途行军倒计时）—— 带滚动保持
           v89.165（老板：「查看所有类似实时读秒设置」）：**烽火页同样逐秒刷新** ——
           「下次来袭」是现实时间口径的分钟级读秒（invDueText），静止会像"没在计时"。
           其余军务页（expand/act/exp/def/affairs）无读秒，保持不逐秒重建。 */
        if (ui.view === 'marches' && ['over', 'beacon'].indexOf(ui._marchTab || 'over') >= 0) {""",
    guard="['over', 'beacon'].indexOf(ui._marchTab || 'over')")

print('\n补丁 A~B 完成')
