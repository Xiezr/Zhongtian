# -*- coding: utf-8 -*-
"""v89.100-B：冒烟第 100 节（道具寄售验收钉子）"""
import io, subprocess

BASE = 'E:/Deepseekdb/'
P = BASE + 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()

KEY = '100. v89.100 道具寄售'
if KEY in s:
    print('SKIP: 第 100 节已存在')
else:
    ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);"""
    assert ANCHOR in s, 'MISS: smoke 尾部锚点'

    SEC = u"""  console.log('\\n===== 100. v89.100 道具寄售：按购买价 75% 回收 =====');
  (function () {
    var oldState100 = G.state;
    var S100 = G.newGame({ name: 'v100', cityName: '许都' });
    if (!S100.map.grid) G.map.generate();
    G.state = S100;
    G.ui._cityId = S100.cities[0].id;
    S100.res.gold = 1000;

    console.log('  --- A 价格与资格：唯一出口 systems.consign* ---');
    var rate100 = (DATA.ITEM_SELL || {}).rate;
    check('A1 配置：回收率 0.75（DATA.ITEM_SELL.rate）', rate100 === 0.75, 'rate=' + rate100);
    check('A2 单价 = price×100×rate（珍珠 2 → 150）',
      G.systems.consignPriceOf('zhenzhu') === Math.floor(2 * 100 * 0.75),
      'zhenzhu=' + G.systems.consignPriceOf('zhenzhu'));
    check('A3 无购买价道具不可寄售（灵气精华 price 0）',
      G.systems.consignPriceOf('lingsui') === 0, 'lingsui=' + G.systems.consignPriceOf('lingsui'));
    check('A4 未知 id 返回 0', G.systems.consignPriceOf('no_such_item') === 0);

    console.log('  --- B 单件寄售：金入账 / 库存出账 ---');
    S100.items = S100.items || {};
    S100.items.zhenzhu = 2;
    var g100 = S100.res.gold;
    var rB100 = G.systems.consignItem('zhenzhu', 1);
    check('B1 寄售 1 件珍珠：金 +150', rB100.ok === true && S100.res.gold === g100 + 150,
      'gold ' + g100 + ' → ' + S100.res.gold);
    check('B2 库存 2 → 1', S100.items.zhenzhu === 1);
    var rB2 = G.systems.consignItem('zhenzhu', 0);        /* 0 = 全部 */
    check('B3 数量 0 = 全部寄售（1 → 清空）', rB2.ok === true && !S100.items.zhenzhu,
      'gold=' + S100.res.gold);
    var rB3 = G.systems.consignItem('zhenzhu', 1);
    check('B4 无库存拒绝', rB3.ok === false, rB3.msg);

    console.log('  --- C 一键寄售与保留名单 ---');
    S100.items.yunlingcao = 3;                            /* price 0 → 不可售，应保留 */
    S100.items.fatie = 4;                                 /* 可售 */
    S100.items.seed_fan = 2;                              /* 可售 */
    var listC = G.systems.consignList();
    check('C1 清单只含可售且有货（含凡铁/凡植种子，不含灵草）',
      listC.some(function (x) { return x.id === 'fatie'; })
        && listC.some(function (x) { return x.id === 'seed_fan'; })
        && !listC.some(function (x) { return x.id === 'yunlingcao'; }),
      '清单 ' + listC.length + ' 项');
    var keepC = G.systems.consignAll({ keep: ['seed_fan'] });
    check('C2 一键寄售（保留 seed_fan）→ 保留项未卖、灵草未动、凡铁清空',
      keepC.ok === true && S100.items.seed_fan === 2 && S100.items.yunlingcao === 3 && !S100.items.fatie,
      keepC.msg);
    var expGoldC = 0;
    listC.forEach(function (x) { if (x.id !== 'seed_fan') expGoldC += x.total; });
    check('C3 对账：本次寄售入账 = 清单小计之和', keepC.gold === expGoldC,
      'got=' + keepC.gold + ' want=' + expGoldC);
    S100.items.seed_fan = 0;
    var rC4 = G.systems.consignAll();
    check('C4 无货时返回"没有可寄售"', rC4.ok === false, rC4.msg);

    console.log('  --- D 边界：装备实例不入列 / UI 出口存在 ---');
    check('D1 装备实例（cr_ 前缀伪 id）不进入寄售清单', (function () {
      S100.items.cr_weapon_q1 = 1;
      var has = G.systems.consignList().some(function (x) { return x.id === 'cr_weapon_q1'; });
      delete S100.items.cr_weapon_q1;
      return !has;
    })());
    check('D2 UI：市场面板挂有寄售按钮且 main 有处理器（源码判据）', (function () {
      var _fs100 = require('fs');
      var _p100 = require('path');
      var src = _fs100.readFileSync(_p100.join(__dirname, 'js/ui.js'), 'utf8');
      var srcM = _fs100.readFileSync(_p100.join(__dirname, 'js/main.js'), 'utf8');
      return src.indexOf('data-action="consign-all"') >= 0
        && src.indexOf('data-action="consign-sell"') >= 0
        && srcM.indexOf('case ' + "'" + 'consign-sell' + "'" + ': GAME.doConsign') >= 0;
    })());

    G.state = oldState100;
  })();

"""
    s = s.replace(ANCHOR, SEC + ANCHOR, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK: 第 100 节插入')

r = subprocess.run(['node', '--check', P], capture_output=True)
print('check: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:400]))
