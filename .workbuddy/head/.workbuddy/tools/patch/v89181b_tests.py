# v89181b 补丁：smoke §181（虎豹新值 / 两向胜 / 血量护栏哨兵 / 档案）
import io

p = 'E:/Deepseekdb/smoke-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()
anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);"""
assert s.count(anchor) == 1, 'anchor'
sec = '''  /* ============================================================
   * §181（v89.181）—— 虎豹加强 + 血量合理性复核 + 拍板存档
   * 老板原话：「1.弓箭兵不提速 2.虎豹稍微加强 3.不要 4.为啥现在兵种的血量
   *   这么高，确认是否是合理的数值设计，是就算了」
   * 标定证据：probe_v89180e（血量复核）· probe_v89180f（虎豹候选扫描）
   * 存档（拍板，不锁测试值，仅供后人检索）：弓 spd 250 不提速 · 拆械 vsMech 3 不加码
   * ============================================================ */
  (function () {
    console.log('  --- §181 虎豹加强与血量基线 ---');
    var fs181 = require('fs'), p181 = require('path');

    check('§181① 虎豹骑新值：hp 5400 / def 280（血防 +12% · 攻速人口不动）', (function () {
      var t = DATA.TROOPS.hubaoqi;
      return t.hp === 5400 && t.def === 280 && t.atk === 510 && t.spd === 850 && t.pop === 3;
    })());

    check('§181② 同人口 虎豹 vs 轻骑：两向皆虎豹胜（口径修正 —— "平手"系误读）', (function () {
      /* ⚠️ 正确读法 = "胜者"（行动序 = 速度序，交换攻守的两局是同场镜像，数字天然一致）：
         r1 虎豹当攻 → 虎豹胜；r2 轻骑当攻 → 虎豹（守）胜。 */
      var r1 = G.battle.simulate({ hubaoqi: 1333 }, null, { qingji: 2000 }, 0, null, { kind: 'wild' });
      var r2 = G.battle.simulate({ qingji: 2000 }, null, { hubaoqi: 1333 }, 0, null, { kind: 'wild' });
      var ok1 = r1.winner === 'atk' && r1.atkLoss <= 1333 * 0.55;
      var ok2 = r2.winner === 'def' && r2.defLoss <= 1333 * 0.55;
      return ok1 && ok2;
    })(), '虎损 ≤55% · 两向胜');

    check('§181③ 血量护栏哨兵：主流对局不秒杀（≥3 回合）不拖死（≤24）', (function () {
      /* 无将口径（稳定、不依赖将领构造）—— 守护"血量标定（原值 ×6）"的核心目的：
         防"1 回合清场"回归（若 hp 被改回原值 → rounds 1~2 → 红）。 */
      var a = G.battle.simulate({ gongjian: 6000 }, null, { changqiang: 6000 }, 0, null, { kind: 'wild' });
      var b = G.battle.simulate({ qingji: 6000 }, null, { changqiang: 6000 }, 0, null, { kind: 'wild' });
      return a.rounds >= 3 && a.rounds <= 24 && b.rounds >= 2 && b.rounds <= 24;
    })(), '弓vs枪 14 / 骑vs枪 4（2026-09-28 读数）');

    check('§181③b 小规模必收敛（义兵 20v20 · round 取整口径）', (function () {
      var r = G.battle.simulate({ yibing: 20 }, null, { yibing: 20 }, 0, null, { kind: 'wild' });
      return r.rounds >= 2 && r.rounds < 30;
    })());

    var arc181 = '';
    try { arc181 = fs181.readFileSync(p181.join(__dirname, '需求档案.md'), 'utf8'); } catch (e) { }
    check('§181④ 需求档案在册（v89.181 · 老板原文关键句 + 误读修正留痕）',
      arc181.indexOf('v89.181') >= 0
      && arc181.indexOf('虎豹稍微加强') >= 0
      && arc181.indexOf('血量这么高') >= 0);
  })();

'''
s = s.replace(anchor, sec + anchor)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('smoke §181 OK')
