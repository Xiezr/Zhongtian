# -*- coding: utf-8 -*-
"""v89.166 patch：「进入城池」→ 菜单全关 + 直接显示城内大界面（两入口统一出口）。
   运行：python .workbuddy/tools/patch/patch_v89166a_enter.py"""
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
    wr(p, s)
    print('  [ ok ] ' + tag)


# ═══ A. case 'city-enter'（老板报的 · 改前关闭调用 0 次）═══
rep('js/main.js', 'A city-enter 全关回视图',
    """      case 'city-enter': {
        var ceId = el.dataset.city, ceC = GAME.cityById(ceId);
        if (!ceC) { ui.toast('城池不存在'); break; }
        ui.setCity(ceId);""",
    """      case 'city-enter': {
        var ceId = el.dataset.city, ceC = GAME.cityById(ceId);
        if (!ceC) { ui.toast('城池不存在'); break; }
        /* v89.166（老板）：「城市菜单界面应关闭，直接显示城内大界面」——
           改前本 case **没有任何关闭调用**（取证：closeModal x0），点了"进入城池"
           弹窗仍盖在城内视图上，玩家得手动再关一次。
           出口用 closeAllModals（清栈 + 完整关闭 · 与「种田秘境关闭键 / 开校场」同款）——
           "进入城池"的语义 = 离开全部菜单回主界面，单层/多层栈都关干净。 */
        ui.closeAllModals();
        ui.setCity(ceId);""",
    guard="v89.166（老板）：「城市菜单界面应关闭")

# ═══ B. case 'lord-city-enter'（同语义对照 · closeModal → closeAllModals 统一出口）═══
rep('js/main.js', 'B lord-city-enter 统一出口',
    """      case 'lord-city-enter': (function () {
        ui.closeModal();
        ui.setCity(el.dataset.city);""",
    """      case 'lord-city-enter': (function () {
        /* v89.166：与「城池面板 · 进入城池」**统一出口**（同一语义同一手法）——
           改前用 closeModal（有上级时只弹一层 → 仍停在别的菜单里）；全关才等于"进入"。 */
        ui.closeAllModals();
        ui.setCity(el.dataset.city);""",
    guard="v89.166：与「城池面板 · 进入城池」**统一出口**")

print('\n补丁 A~B 完成')
