# -*- coding: utf-8 -*-
"""v89.236：smoke 修复（两条连带红按新口径重写）+ 新增 §236 守卫段。
  ① §230④ 交付文档读点随迁（docs/ → docs/_史料/交付/）
  ② §233① 「金」扫描先剥 docs/ 引用路径（路径是元数据）
  ③ §236 五条：文档收敛在册 / 交付记录在册 / 过时材料清理在册 / 引用零悬空 / 版本与档案
"""
import io, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
N0 = len(s)
LOG = []

# ---------- ① §230④ ----------
old1 = "      try { doc = fs230.readFileSync(path230.join(__dirname, 'docs', 'v89230-兵种链路与挂载流程.md'), 'utf8'); }"
new1 = ("      /* v89.236：交付文档分类整合 —— 逐轮交付统一入 docs/_史料/交付/，读点随迁。 */\n"
        "      try { doc = fs230.readFileSync(path230.join(__dirname, 'docs', '_史料', '交付', 'v89230-兵种链路与挂载流程.md'), 'utf8'); }")
assert s.count(old1) == 1, 'A1 count=%d' % s.count(old1)
s = s.replace(old1, new1)
LOG.append('[ok] §230④ 读点随迁')

# ---------- ② §233① ----------
old2 = ("      var left = [], guardN = 0;\n"
        "      FILES.forEach(function (f) {\n"
        "        var masked = raw[f];\n"
        "        PROTECT.forEach(function (w) {")
new2 = ("      var left = [], guardN = 0;\n"
        "      FILES.forEach(function (f) {\n"
        "        var masked = raw[f];\n"
        "        /* v89.236：先剥 docs/ 引用路径（文件名可能含「金」，如 _史料/交付/v89194-营造金藏珍阁…）——\n"
        "           路径是元数据，不计入内容残留。 */\n"
        "        masked = masked.replace(/docs\\/[^\\s\\)）`」』|，。\\]（]+/g, '');\n"
        "        PROTECT.forEach(function (w) {")
assert s.count(old2) == 1, 'A2 count=%d' % s.count(old2)
s = s.replace(old2, new2)
LOG.append('[ok] §233① 路径剥离')

# ---------- ③ §236 守卫段（插在 §235 段之后、文件尾 console.log('结果 之前）----------
anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, 'anchor count=%d' % s.count(anchor)

SEC = r'''  /* ============================================================
   * §236（v89.236）· 文档分类整合与清理（守卫五条）
   *   —— 规则来源：老板「对文档（内容）进行分类，整合。资产类的梳理保留，
   *      其他过时版本，过时风格相关内容去除」。任何一条回退都必须在这里翻红。
   * ============================================================ */
  (function () {
    var fs236 = require('fs');
    var path236 = require('path');

    /* ① docs 顶层收敛：只留活文档（规范/台账/资产）——旧交付物不得回流顶层 */
    check('§236① docs 顶层收敛（活文档在册 · v89* 顶层只剩两张台账 · 旧交付零回流）', (function () {
      var D = path236.join(__dirname, 'docs');
      var must = ['设计规范.md', '项目地图.md', 'AI工作备忘.md', '废土术语映射表.md', '数据表索引.md',
        '图标素材注册表.md', '图标适配流程.md', 'AI图标生成清单-废土版.md', 'AI肖像生成清单.md',
        'game-icons-CREDITS.md', '美术换皮方法论.md', '换皮操作手册-傻瓜版.md', '废土地形生成规格.md',
        '数值系统数据字典.md', '数值系统数据字典.xlsx',
        'v89125-建筑建造时间表.md', 'v89194-道具价格表.md'];
      var miss = must.filter(function (f) { return !fs236.existsSync(path236.join(D, f)); });
      var top = fs236.readdirSync(D).filter(function (f) {
        return /\.md$/.test(f) && /^v89/.test(f);
      });
      /* 顶层逐轮交付（v89xxx-*）应只剩两张脚本台账 */
      var strays = top.filter(function (f) {
        return ['v89125-建筑建造时间表.md', 'v89194-道具价格表.md'].indexOf(f) < 0;
      });
      window.__r236a = 'miss=' + (miss.join(',') || '0') + ' 顶层stray=' + (strays.join(',') || '0');
      return miss.length === 0 && strays.length === 0;
    })());

    /* ② 逐轮交付记录在档（_史料/交付/ · 抽三份实读 + 数量下限） */
    check('§236② 逐轮交付记录在档（_史料/交付/ · 抽读三份 · 数量 ≥140）', (function () {
      var D = path236.join(__dirname, 'docs', '_史料', '交付');
      var list = fs236.readdirSync(D).filter(function (f) { return /\.md$/.test(f); });
      var probe = ['v89235-政务厅角标与素材清理.md', 'v89230-兵种链路与挂载流程.md', 'v89229-兵种重构与城视图换代.md'];
      var ok = probe.every(function (f) {
        try { return fs236.readFileSync(path236.join(D, f), 'utf8').length > 800; } catch (e) { return false; }
      });
      window.__r236b = 'n=' + list.length + ' 抽读=' + ok;
      return ok && list.length >= 140;
    })());

    /* ③ 过时材料清理在册（抽样六份 · 顶层与全局零残留 + 备份在册） */
    check('§236③ 过时材料清理在册（抽六份零残留 · 备份留）', (function () {
      var D = path236.join(__dirname, 'docs');
      var gone = ['门派系统规则.md', '玩法扩展规划.md', '试玩测评报告.md', 'UI设计交接.md',
        '交接文档.md', 'ui-tokens-vnext.css'];
      var left = gone.filter(function (f) { return fs236.existsSync(path236.join(D, f)); });
      var bak = fs236.existsSync(path236.join(__dirname, '.workbuddy', 'backup', 'v89236-docs'));
      window.__r236c = 'left=' + (left.join(',') || '0') + ' bak=' + bak;
      return left.length === 0 && bak;
    })());

    /* ④ 引用零悬空（需求档案 path 归位计数 + 顶层悬空 docs/v89 零） */
    check('§236④ 引用零悬空（需求档案 _史料/交付/ 引用 ≥150 · 顶层悬空 0）', (function () {
      var a = fs236.readFileSync(path236.join(__dirname, '需求档案.md'), 'utf8');
      var moved = (a.match(/docs\/_史料\/交付\//g) || []).length;
      /* 顶层悬空抽查：需求档案里 docs/ + v89 全名引用，必须命中顶层或 _史料/交付 或带已清理标注 */
      var bad = 0;
      var re = /docs\/(v89[^\s`)）」』|，。\]（'"]+)/g, m;
      while ((m = re.exec(a)) !== null) {
        var tgt = m[1];
        if (tgt.indexOf('*') >= 0 || tgt.indexOf('v89.') === 0) continue;
        if (fs236.existsSync(path236.join(__dirname, 'docs', tgt))) continue;
        if (fs236.existsSync(path236.join(__dirname, 'docs', '_史料', '交付', tgt))) continue;
        if (a.slice(m.index, m.index + m[0].length + 26).indexOf('v89.236') >= 0) continue;
        bad++;
      }
      window.__r236d = '归位引用=' + moved + ' 悬空=' + bad;
      return moved >= 150 && bad === 0;
    })());

    /* ⑤ 版本与档案在册（v89.236 · 老板原话关键句逐字） */
    check('§236⑤ 版本与档案在册（v89.236 · 老板原话逐字）', (function () {
      var m236 = fs236.readFileSync(path236.join(__dirname, 'js', 'main.js'), 'utf8');
      var a236 = fs236.readFileSync(path236.join(__dirname, '需求档案.md'), 'utf8');
      return /GAME\.VERSION = 'v89\.\d+'/.test(m236)
        && a236.indexOf('v89.236') >= 0
        && a236.indexOf('对文档（内容）进行分类，整合') >= 0
        && a236.indexOf('资产类的梳理保留') >= 0
        && a236.indexOf('过时版本，过时风格相关内容去除') >= 0;
    })());
  })();

'''
s = s.replace(anchor, SEC + anchor)
LOG.append('[ok] §236 段插入（五条）')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
LOG.append('[done] len %d → %d' % (N0, len(s)))
print('\n'.join(LOG))
