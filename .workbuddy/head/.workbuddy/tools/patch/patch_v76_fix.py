# -*- coding: utf-8 -*-
"""v76 修 · 三处真机验收抓出的偏差（均已落盘，本脚本留档；重跑全跳过）

F1  左栏铺满链挂错层：.auth-side > .side-block 匹配不到（两段是 .lord-card 的子级）
    → 改挂 .auth-side .lord-card 起的四级链
F2  关闭按钮内容短时浮在中间（离底 284px）→ .inner-panel:has(> .bldg-foot) 纵向 flex
    + 关闭 margin-top:auto 钉底（实测 6px）
B5  openDemolishConfirm 城内文案（主脚本曾在 B4b 处中断，B5 未执行）：补跑
"""
import io, sys

HTML = r'E:\Deepseekdb\index.html'
UI = r'E:\Deepseekdb\js\ui.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    c = t.count(old)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次，拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old, new, 1))
    print('  ✓ %s' % tag)


patch(
    HTML,
    """    display: flex; flex-direction: column; }
  .auth-side > .side-block:last-child { flex: 1 1 auto; display: flex; flex-direction: column; }
  .auth-side > .side-block:last-child .garrison-bar { flex: 1 1 auto; display: flex; flex-direction: column; }""",
    """    display: flex; flex-direction: column; }
  /* ⚠️ 左栏的"框"是那口**大卡**（.lord-card 里装着 君主头 + 城池属性段 + 资源段）——
     铺满链必须从 lord-card 起（作者第一版挂在 .auth-side > .side-block 上，
     选择器压根匹配不到，真机一量才发现驻军框纹丝不动）。 */
  .auth-side .lord-card { flex: 1 1 auto; display: flex; flex-direction: column; }
  .auth-side .lord-card > .side-block:last-child { flex: 1 1 auto; display: flex; flex-direction: column; }
  .auth-side .lord-card > .side-block:last-child .garrison-bar { flex: 1 1 auto; display: flex; flex-direction: column; }""",
    'F1 flex 链改挂 lord-card',
)

patch(
    HTML,
    """  .bldg-foot .btn.sm { font-size: var(--fs-cap); padding: 3px 9px; }""",
    """  .bldg-foot .btn.sm { font-size: var(--fs-cap); padding: 3px 9px; }
  /* v76（老板）：「建筑界面的关闭按钮在弹窗界面的最底部」——
     内容短时关闭浮在中间（实测离弹窗底 284px），这里把带 .bldg-foot 的面板
     改纵向 flex，关闭用 margin-top:auto 吃空档、钉死在面板最下沿；
     内容超长时 sticky（v73）照旧接管。 */
  .modal .inner-panel:has(> .bldg-foot) { display: flex; flex-direction: column; }
  .modal .inner-panel:has(> .bldg-foot) > .bldg-foot { margin-top: auto; }""",
    'F2 关闭钉底',
)

patch(
    UI,
    """    var html = '<div class="gold-heading">拆毁 ' + U.escape(name) + ' Lv' + lv + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">确定拆毁</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';""",
    """    /* v76（老板）：「拆除（1级，只能逐级拆除）」——
       城内是**降 1 级**（Lv1 才整座移除）；城外仍为整座拆毁（未动）。 */
    var isCity = (kind !== 'ext');
    var html = '<div class="gold-heading">' + (isCity
      ? ('拆 1 级 · ' + U.escape(name) + ' Lv' + lv + (lv > 1 ? ' → Lv' + (lv - 1) : '（整座移除）'))
      : ('拆毁 ' + U.escape(name) + ' Lv' + lv)) + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">' + (isCity
      ? '逐级拆除：每次只降 1 级，返还本步投入的 50%；拆到 Lv1 再拆即整座移除（腾出地块）。'
      : '返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。') + '</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">' + (isCity && lv > 1 ? '确定拆 1 级' : '确定拆毁') + '</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';""",
    'B5 openDemolishConfirm',
)

print('\nv76 修复留档检查完成。')
