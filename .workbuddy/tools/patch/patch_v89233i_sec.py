# -*- coding: utf-8 -*-
"""v89.233 批 5：守卫段 §233 插入 + 版本三连升级（v89.231 → v89.233）。"""
import io

R = 'E:/Deepseekdb/'

# ---------- ① smoke §233 段（插在 §231 段收尾与"结果："之间）----------
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '§233' not in s, '已插过'

ANCHOR = """      return ok && self231.length > 100000;
    })(), window.__r231e || '');
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

NEW_SEC = """      return ok && self231.length > 100000;
    })(), window.__r231e || '');
  })();

  /* ============================================================
   * §233（v89.233）：货币统一 · 任务文风 · 语义描述 · 注释压缩（四批守卫）
   * ------------------------------------------------------------
   * 老板（对 v89.232 观察项四项的批复）：「1.统一 · 2.文风改 · 3.语义描述改 · 4.注释改」
   *   ① 货币「金」短语统一（产品 12 文件 · 保护词外零残留）
   *   ② 任务文案废土文风（86 条 · 旧标题零残留）
   *   ③ 语义债（垂钓/行猎顺滑 · 旧钱→旧币 · analyze 正则对齐）
   *   ④ 注释层历史段压缩（重复行清除 · 细表指针化 · 引述保留）
   * ============================================================ */
  console.log('\\n===== §233 货币统一 · 任务文风 · 语义描述 · 注释压缩 =====');
  (function () {
    var fs233 = require('fs'), path233 = require('path');
    var FILES = ['data.js', 'ui.js', 'main.js', 'systems.js', 'domain.js', 'state.js',
      'battle.js', 'story.js', 'questdata.js', 'map.js', 'tactic.js', 'icons.js'];
    var raw = {};
    FILES.forEach(function (f) { raw[f] = fs233.readFileSync(path233.join(__dirname, 'js', f), 'utf8'); });
    var q233 = raw['questdata.js'];
    var d233 = raw['data.js'];

    /* ① 货币统一：保护词以外，「金」零残留（全文 —— 含注释；基数自证防扫描器坏） */
    check('§233① 货币统一：「金」保护外零残留（12 文件 · 保护词基数自证）', (function () {
      var PROTECT = ['金蝉脱壳', '金殿', '金创', '金印', '金声', '金银', '千金', '金玉', '黄金',
        '鸣金', '金城', '合金', '鎏金', '金属', '冶金', '古钱币', '金币', '金琉璃', '金色',
        '金光', '金鳞', '金框', '金边', '金叉', '金头', '金杆', '金匾', '金线', '金实',
        '亮金', '暖金', '暗金', '土金', '深金', '浅金', '柔金', '金点', '金方', '金底',
        '金甲', '金瓦', '金穗', '金饰', '金笔', '金增量', '悬停金', '琥珀金', '主题金',
        '点金', '城池金', 'info 金', '金/火', '（金）', '中枢 · 金', '金滩', '金垒', '金刚',
        '金贵', '金额', '资金', '税金', ' / 金）', '金/青', '金/朱', '金/绿'];
      var left = [], guardN = 0;
      FILES.forEach(function (f) {
        var masked = raw[f];
        PROTECT.forEach(function (w) {
          if (masked.indexOf(w) >= 0) { guardN++; masked = masked.split(w).join(''); }
        });
        var n = (masked.match(/金/g) || []).length;
        if (n > 0) left.push(f + 'x' + n);
      });
      window.__r233a = '残留=' + (left.join(',') || '0') + ' 保护命中=' + guardN;
      return left.length === 0 && guardN >= 30;   /* 基数自证：保护词必须真命中（扫描器坏即 0 → 红） */
    })(), window.__r233a || '');

    /* ② 任务文风：86 条 · 旧标题零残留 · 新标题两两唯一 · 新名抽查 */
    check('§233② 任务文风：86 条在册 · 老标题零残留 · 新标题两两唯一（v89.233 口径）', (function () {
      var titles = (q233.match(/title: '[^']+'/g) || []).map(function (x) { return x.slice(9, -1); });
      var OLD = ['立锥之地', '民居渐稠', '广厦万间', '衙署初立', '一方之治', '雄踞一方', '格物致知',
        '百家之学', '博览群书', '厉兵秣马', '甲兵初成', '铁流三千', '攻城之器', '求贤若渴', '座上之宾',
        '将星璀璨', '逐鹿中原', '列土封疆', '山泽之利', '家给人足', '百战之师', '屯田积谷', '聚财通商',
        '安民抚众', '礼贤下士', '兴学讲艺', '金城汤池', '受衔队长', '学不可以已', '仓廪实而知礼节'];
      var oldLeft = OLD.filter(function (w) { return q233.indexOf(w) >= 0; });
      var uniq = {}, dup = 0;
      titles.forEach(function (t) { if (uniq[t]) dup++; uniq[t] = 1; });
      window.__r233b = 'n=' + titles.length + ' 旧名残留=' + (oldLeft.join(',') || '0') + ' 重复=' + dup;
      return titles.length === 86 && oldLeft.length === 0 && dup === 0
        && q233.indexOf('残垣立命') >= 0 && q233.indexOf('铁壁初成') >= 0
        && q233.indexOf('清源有道') >= 0;
    })(), window.__r233b || '');

    /* ③ 语义描述：垂钓/行猎顺滑在册 · 旧叙述零残留 · analyze 正则与产品日志对齐 */
    check('§233③ 语义描述：垂钓/行猎顺滑 + 旧钱→旧币 + analyze 正则对齐', (function () {
      var an = fs233.readFileSync(path233.join(__dirname, '.workbuddy', 'tools', 'playtest', 'analyze_600.py'), 'utf8');
      var ok1 = d233.indexOf('肥鱼入篓，活水同汲') >= 0
        && d233.indexOf('杂鱼数尾，几瓢活水') >= 0
        && d233.indexOf('猎得野味，寻得山泉') >= 0
        && d233.indexOf('掘出旧币') >= 0;
      var ok2 = d233.indexOf('泽畔垂钓：肥鱼入篓，偶得水中沉物。') < 0
        && d233.indexOf('掘出旧钱') < 0
        && d233.indexOf('亦可得野味') < 0;
      var ok3 = an.indexOf('得旧币') >= 0 && an.indexOf('净水') >= 0
        && an.indexOf('粮食 −') < 0 && an.indexOf('铁锭 −') < 0;
      window.__r233c = '文案=' + ok1 + ' 旧串清=' + ok2 + ' 正则=' + ok3;
      return ok1 && ok2 && ok3;
    })(), window.__r233c || '');

    /* ④ 注释层：重复行清除 · 历史细表压缩为指针 · 压缩声明与引述同帧在册 */
    check('§233④ 注释层：重复行清除 · 历史细表压缩 · 引述保留原貌', (function () {
      var dupLeft = (d233.match(/cat` 退役 —— 本口径现按/g) || []).length;
      var ok = dupLeft === 0
        && d233.indexOf('重弩车/破门车/迫击炮') < 0
        && d233.indexOf('象兵/变异巨兽') < 0
        && d233.indexOf('v89.233（注释批）') >= 0
        && d233.indexOf('旧军残部=长矛手') >= 0;   /* 老板引述保留原貌（引述铁律） */
      window.__r233d = '重复=' + dupLeft + ' 声明=' + (d233.indexOf('v89.233（注释批）') >= 0);
      return ok;
    })(), window.__r233d || '');

    /* ⑤ 版本与档案在册（v89.233） */
    check('§233⑤ 版本与档案在册（v89.233 · 老板四词批复逐字）', (function () {
      var arc = fs233.readFileSync(path233.join(__dirname, '需求档案.md'), 'utf8');
      var ok = /GAME\\.VERSION = 'v89\\.233'/.test(raw['main.js'])
        && arc.indexOf('v89.233') >= 0
        && arc.indexOf('语义描述改') >= 0;
      window.__r233e = 'ver=' + /GAME\\.VERSION = 'v89\\.233'/.test(raw['main.js'])
        + ' 档案=' + (arc.indexOf('v89.233') >= 0);
      return ok;
    })(), window.__r233e || '');
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

assert s.count(ANCHOR) == 1
s = s.replace(ANCHOR, NEW_SEC)

# ---------- ② §199④ 版本锁升级 ----------
old199 = "return /GAME\\.VERSION = 'v89\\.231'/.test(mS199)   /* v89.223：版本号每轮迭代更新（本条随轮升级） */"
new199 = "return /GAME\\.VERSION = 'v89\\.233'/.test(mS199)   /* v89.223：版本号每轮迭代更新（本条随轮升级） */"
assert s.count(old199) == 1
s = s.replace(old199, new199)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('[ok] smoke §233 插入 + §199④ 升级')

# ---------- ③ main.js 版本 ----------
P2 = R + 'js/main.js'
m = io.open(P2, encoding='utf-8', newline='').read()
old = "GAME.VERSION = 'v89.231';"
assert m.count(old) == 1
m = m.replace(old, "GAME.VERSION = 'v89.233';")
io.open(P2, 'w', encoding='utf-8', newline='').write(m)
print('[ok] main.js → v89.233')
