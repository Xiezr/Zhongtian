# -*- coding: utf-8 -*-
"""v89.231 批次 d2：smoke §231 守卫段 + 版本三连（v89.231）"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []

# ---------- ① main.js 版本号 ----------
P2 = 'js/main.js'
m = rd(P2)
old_v = "GAME.VERSION = 'v89.230';"
assert m.count(old_v) == 1, 'version line count'
m = m.replace(old_v, "GAME.VERSION = 'v89.231';")
wr(P2, m)
REPORT.append('[ok] main.js GAME.VERSION → v89.231')

# ---------- ② smoke：§199④ 升级 / §230⑤ 放宽 / §231 插入 ----------
P = 'smoke-test.js'
s = rd(P)

old199 = "/GAME\\.VERSION = 'v89\\.230'/.test(mS199)"
assert s.count(old199) == 1, '199 count'
s = s.replace(old199, "/GAME\\.VERSION = 'v89\\.231'/.test(mS199)")
REPORT.append('[ok] §199④ 版本锁 → v89.231')

old230 = "/GAME\\.VERSION = 'v89\\.230'/.test(m230)"
assert s.count(old230) == 1, '230 count'
s = s.replace(old230,
    "/GAME\\.VERSION = 'v89\\.\\d+'/.test(m230)   /* v89.231：现行版本由 §199④ 逐轮锁（同 §229c⑧ 口径 · 本处置宽松只证在册） */")
REPORT.append('[ok] §230⑤ 版本锁放宽（v89.\\d+）')

SEG = r"""  /* ============================================================
   * §231（v89.231 · 科技体系调整批）—— 回归哨兵
   * ------------------------------------------------------------
   * 老板：「根据废土背景和现有兵种，建筑，调整科技体系」。
   * 本段守五类：
   *   ① 24 项术语换代逐项对表（20 新名 · 资源四项保持 · 旧名活代码零残留）
   *   ② 分组齐备（DATA.TECH_CATS 5 组 · 计数 4/6/5/6/3 · 每项 cat 合法 · 无孤儿）
   *   ③ 研习所面板分节渲染（五组标题在屏 · 真渲染）
   *   ④ 引用链完好（兵种 unlock.tech + 建筑 BUILD_TECH_REQ 全 ∈ TECH · 无悬空 id）
   *   ⑤ 版本与档案在册（v89.231 · 老板原话 + 映射表「科技体系」节）
   * ============================================================ */
  console.log('\n===== §231 科技体系（术语换代 · 分组 · 引用链）=====');
  (function () {
    var fs231 = require('fs'), path231 = require('path');
    var main231 = fs231.readFileSync(path231.join(__dirname, 'js', 'main.js'), 'utf8');
    var self231 = fs231.readFileSync(path231.join(__dirname, 'smoke-test.js'), 'utf8');
    var a231 = fs231.readFileSync(path231.join(__dirname, '需求档案.md'), 'utf8');
    var mp231 = fs231.readFileSync(path231.join(__dirname, 'docs', '废土术语映射表.md'), 'utf8');
    function strip231(x) { return x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

    var MAP231 = [
      ['lianbing', '募兵整训'], ['zhandou', '战斗条令'], ['dazao', '锻造工艺'],
      ['zhencha', '侦察网络'], ['fanghu', '装甲强化'], ['fuzhong', '载重优化'],
      ['xingjun', '机动行军'], ['paoshe', '弹道校正'], ['jiayu', '机车操控'],
      ['jianzhu', '废墟重建'], ['chucun', '仓储扩容'], ['buji', '生命维持'],
      ['tongshuai', '指挥链路'], ['chengfang', '防御工事'], ['weixiu', '再生技术'],
      ['qianglue', '废墟搜刮'], ['hecheng', '量产工艺'], ['chelun', '传动系统'],
      ['xunma', '座驾改装'], ['yanjiu', '逆向工程'],
    ];
    var OLD231 = {
      lianbing: '练兵技巧', zhandou: '战斗技巧', dazao: '打造技巧', zhencha: '侦察技巧',
      fanghu: '防护技巧', fuzhong: '负重技巧', xingjun: '行军技巧', paoshe: '抛射技巧',
      jiayu: '驾驭技巧', jianzhu: '建筑技术', chucun: '储存技术', buji: '补给技巧',
      tongshuai: '统帅能力', chengfang: '城防技术', weixiu: '维修技术', qianglue: '抢掠技巧',
      hecheng: '合成技巧', chelun: '车轮技术', xunma: '机修技巧', yanjiu: '研究技巧',
    };

    /* ① 术语换代逐项对表 + 旧名活代码零残留（剥注释；沿革注/引述里的旧名是有意保留） */
    check('§231① 科技 24 项术语换代逐项对表（20 新名 · 资源四项保持 · 旧名活代码零残留）', (function () {
      var bad = [];
      MAP231.forEach(function (mm) {
        var t = null;
        DATA.TECH.forEach(function (x) { if (x.id === mm[0]) t = x; });
        if (!t || t.name !== mm[1]) bad.push(mm[0] + ':' + (t ? t.name : 'MISS'));
      });
      if (DATA.TECH.length !== 24) bad.push('count=' + DATA.TECH.length);
      var keep = { zhongzhi: '净化技术', kanfa: '栽培技术', wajue: '蓄能技术', yelian: '熔炼技术' };
      Object.keys(keep).forEach(function (id) {
        var t = null;
        DATA.TECH.forEach(function (x) { if (x.id === id) t = x; });
        if (!t || t.name !== keep[id]) bad.push(id + ':' + (t ? t.name : 'MISS'));
      });
      var live = ['ui', 'battle', 'domain', 'systems', 'tactic', 'main', 'data'].map(function (f) {
        return strip231(fs231.readFileSync(path231.join(__dirname, 'js', f + '.js'), 'utf8'));
      }).join('\n');
      var left = MAP231.map(function (mm) { return OLD231[mm[0]]; })
        .filter(function (o) { return live.indexOf(o) >= 0; });
      window.__r231a = 'bad=' + bad.join(',') + ' 活代码残留=' + left.join(',');
      return bad.length === 0 && left.length === 0;
    })(), window.__r231a || '');

    /* ② 分组齐备 */
    check('§231② 科技分组齐备（TECH_CATS 5 组 · 计数 4/6/5/6/3 · 无孤儿）', (function () {
      var cats = DATA.TECH_CATS || [];
      var keys = cats.map(function (c) { return c.key; });
      var cnt = {}, orphan = [];
      DATA.TECH.forEach(function (t) {
        if (keys.indexOf(t.cat) < 0) orphan.push(t.id);
        cnt[t.cat] = (cnt[t.cat] || 0) + 1;
      });
      var want = { res: 4, mil: 6, eng: 5, logi: 6, intel: 3 };
      var okCnt = keys.length === 5 && keys.every(function (k) { return cnt[k] === want[k]; });
      window.__r231b = keys.join('/') + ' · 计数 ' + keys.map(function (k) { return cnt[k]; }).join('/')
        + ' · 孤儿 ' + (orphan.length ? orphan.join(',') : '0');
      return okCnt && orphan.length === 0;
    })(), window.__r231b || '');

    /* ③ 面板分节渲染（真渲染） */
    check('§231③ 研习所面板分节渲染（五组标题在屏 · 24 数据行 · 真渲染）', (function () {
      var h = G.ui.techHTML();
      var names = ['资源产出', '军事武装', '工程建设', '机动后勤', '情报指挥'];
      var missG = names.filter(function (n) { return h.indexOf('>' + n + '<') < 0; });
      var rows = (h.match(/<tr>/g) || []).length;        /* thead 1 + 数据 24 = 25 */
      var cats = (h.match(/class="tech-cat"/g) || []).length;
      window.__r231c = '缺组=' + (missG.join(',') || '0') + ' tr=' + rows + ' cat行=' + cats;
      return missG.length === 0 && rows === 25 && cats === 5;
    })(), window.__r231c || '');

    /* ④ 引用链完好 */
    check('§231④ 科技引用链完好（兵种/建筑全 ∈ TECH · 无悬空 id）', (function () {
      var ids = DATA.TECH.map(function (t) { return t.id; });
      var bad = [];
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var u = DATA.TROOPS[k].unlock || {};
        if (u.tech) Object.keys(u.tech).forEach(function (t) {
          if (ids.indexOf(t) < 0) bad.push('troop:' + k + '->' + t);
        });
      });
      Object.keys(DATA.BUILD_TECH_REQ || {}).forEach(function (b) {
        var t = DATA.BUILD_TECH_REQ[b].tech;
        if (ids.indexOf(t) < 0) bad.push('bldg:' + b + '->' + t);
      });
      window.__r231d = 'TECH=' + ids.length + ' · 悬空 ' + (bad.join(',') || '0');
      return ids.length === 24 && bad.length === 0;
    })(), window.__r231d || '');

    /* ⑤ 版本与档案在册 */
    check('§231⑤ 版本与档案在册（v89.231 · 老板原话 + 映射表「科技体系」节）', (function () {
      var ok = /GAME\.VERSION = 'v89\.\d+'/.test(main231)
        && a231.indexOf('v89.231') >= 0
        && a231.indexOf('调整科技体系') >= 0
        && mp231.indexOf('科技体系') >= 0 && mp231.indexOf('募兵整训') >= 0
        && mp231.indexOf('情报指挥') >= 0;
      window.__r231e = 'ver=ok 档案=' + (a231.indexOf('调整科技体系') >= 0)
        + ' 映射表=' + (mp231.indexOf('科技体系') >= 0);
      return ok && self231.length > 100000;
    })(), window.__r231e || '');
  })();

"""
anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, 'tail anchor count'
s = s.replace(anchor, SEG + anchor)
REPORT.append('[ok] §231 段插入（五条）')

wr(P, s)
print('\n'.join(REPORT))
