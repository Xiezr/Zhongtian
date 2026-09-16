# -*- coding: utf-8 -*-
"""v89.1 修补：① e2e 两处「精力严格相等」断言改容差版（浮点再生脆弱点）
   ② smoke §75 增加第六条：markup 用到的 sxf-* 类全部有样式接线。探针幂等。"""
import io

def sub(path, old, new, tag, probe):
    d = io.open(path, encoding='utf-8', newline='').read()
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, '%s 锚点命中 %d 处' % (tag, c)
    d = d.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(d)
    print('OK ' + tag)

# ============ ① e2e：免费退出断言 ============
sub(r'E:\Deepseekdb\e2e-test.js',
"""    check('v89：免费退出后可再入（energy 未扣 · 锁未落）', (function () {
      return lg89.energy === e089 && G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok;
    })());""",
"""    check('v89：免费退出后可再入（energy 未扣 · 锁未落）', (function () {
      /* ⚠ 精力是「连续再生值（浮点）」：只能断言"未减少"，不能严格相等 ——
         毫秒级再生会在两次读取之间加出小数（v89.1 实测 85.0666 抓出的脆弱点） */
      return lg89.energy >= e089 - 0.01 && G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok;
    })());""",
    'e2e 免费退出断言容差化', 'lg89.energy >= e089 - 0.01')

# ============ ① e2e：首选定扣断言 ============
sub(r'E:\Deepseekdb\e2e-test.js',
"""    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(200);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(160);
    check('v89：首次选择即扣精力（15）', lg89.energy === e089 - 15);""",
"""    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(200);
    const ePre89 = lg89.energy;
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(160);
    /* 同上：按「扣费前后差 ≈ 15」断言（容差 3 —— 再生量远小于此；双扣 30 / 未扣 0 必被抓住） */
    check('v89：首次选择即扣精力（15）', Math.abs((ePre89 - lg89.energy) - 15) < 3);""",
    'e2e 首选定扣容差化', 'Math.abs((ePre89 - lg89.energy) - 15) < 3')

# ============ ② smoke §75 第六条 ============
SUB6 = r"""  check('v89.1：样式与动效齐（.sxf-* 五类 + sxfIn / sxfPop）', (function () {
    return ['.sxf-wrap {', '.sxf-hero {', '.sxf-emblem {', '.sxf-timeline {', '.sxf-bdg {'].every(function (t) {
      return css1.indexOf(t) >= 0;
    }) && /@keyframes sxfIn/.test(css1) && /@keyframes sxfPop/.test(css1);
  })());"""

SUB6_NEW = SUB6 + r"""
  check('v89.1：markup 用到的 sxf-* 类全部有样式接线（防漏字）', (function () {
    /* 注意：ui.js 里有的类是「字符串拼接」出来的（class="sxf-dot' + (…) + '"），
       so 抓到的 token 先按 /^sxf-[a-z-]+$/ 过滤，脏 token（带引号/加号）不算数 */
    var cls = {};
    (uS1.match(/class="sxf-[^"]*"/g) || []).forEach(function (m) {
      m.replace(/class="([^"]+)"/, '$1').split(/\s+/).forEach(function (c) {
        if (/^sxf-[a-z-]+$/.test(c)) cls[c] = 1;
      });
    });
    var keys = Object.keys(cls);
    var miss = keys.filter(function (c) { return css1.indexOf('.' + c) < 0; });
    return keys.length >= 30 && miss.length === 0;
  })());"""

sub(r'E:\Deepseekdb\smoke-test.js', SUB6, SUB6_NEW, 'smoke §75 第六条', '防漏字')

print()
print('完成。')
