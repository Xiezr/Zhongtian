# -*- coding: utf-8 -*-
"""
v89.8 补丁（2026-09-17 · 老板「3段式可读性好，交互性差，适当增长篇幅，5-7段选择。最好还能有背景壁画的变换」）

改动：
  1) js/state.js  : 新增 GAME.SG.rankCount（段数出口，界面「第 N 段·共 M 段」共用）
  2) js/ui.js     : 新增 ui.SG_MURAL（13 张程序化壁画）+ ui.sgBg（双图层交叉淡入）
                    + sgRender 骨架化（壁画层/沙幕/正文层分离）+ sgHTML 加段进度
  3) index.html   : .sgr-bg/.sgr-scrim/.sgr-dots 样式 + sgrIn 段入场动效
"""
import io, sys

ROOT = r'E:\Deepseekdb'
FAILS = []

def read(p):
    return io.open(ROOT + '\\' + p, encoding='utf-8', newline='').read()

def write(p, s):
    io.open(ROOT + '\\' + p, 'w', encoding='utf-8', newline='').write(s)

def apply(path, old, new, tag):
    src = read(path)
    n = src.count(old)
    if n != 1:
        FAILS.append('[%s] 锚点命中 %d 次（应为 1）' % (tag, n))
        return
    src = src.replace(old, new, 1)
    write(path, src)
    if new not in read(path):
        FAILS.append('[%s] 落盘回查失败' % tag)
        return
    print('OK  ' + tag)

# ============================================================
# 1) state.js · GAME.SG.rankCount
# ============================================================
OLD = '''  GAME.SG.one = function (sid) {
    var all = GAME.SG.list();
    for (var i = 0; i < all.length; i++) if (all[i].id === sid) return all[i];
    return null;
  };
'''
NEW = OLD + '''
  /* 段数（层数）：从首幕逐层推进的最深层号 —— 界面「第 N 段 · 共 M 段」与测试共用。
     v89.8 结构约定：全路径同层、结局挂在最深层；本函数只报层数，不判合法性
     （合法性由 story/tools/check.py 把关）。 */
  GAME.SG.rankCount = function (st) {
    var ns = (st && st.nodes) || [];
    if (!ns.length) return 0;
    var idx = {}, depth = {}, queue = [ns[0].id];
    ns.forEach(function (n) { idx[n.id] = n; });
    depth[ns[0].id] = 1;
    while (queue.length) {
      var cur = queue.shift(), node = idx[cur];
      ((node && node.o) || []).forEach(function (op) {
        if (idx[op.to] && depth[op.to] == null) { depth[op.to] = depth[cur] + 1; queue.push(op.to); }
      });
    }
    var max = 0;
    for (var k in depth) if (depth[k] > max) max = depth[k];
    return max;
  };
'''
apply('js/state.js', OLD, NEW, 'state.js · rankCount')

# ============================================================
# 2a) ui.js · 壁画库（插在 ui.SG_BLOCK 之前）
# ============================================================
OLD = '''  /* entry block: returns '' when the anchor has no story (no empty shell) */
  ui.SG_BLOCK = function (kind, id, name) {'''

NEW = r'''  /* ============================================================
   * 壁画库（v89.8 · 老板「背景壁画的变换」）
   * ------------------------------------------------------------
   * 每张一段程序化 SVG（满幅 · slice 裁切），数据里每幕/结局声明 `bg`。
   * 画法约定：底色吃主题变量（明暗四主题都成立），剪影用半透明墨色，
   * 灯火/月/水光用暖色低透明 —— 与项目「程序化绘制、零外链素材」同路线。
   * 键名与 story/tools/check.py 的白名单一致（新增壁画须两处同更）。
   * ============================================================ */
  ui.SG_MURAL = {
    /* 衙堂 · 烛夜：红柱、横梁、匾影、公案与烛光 */
    yat:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="540" width="1200" height="260" fill="var(--bg-3)"/>' +
      '<rect y="300" width="1200" height="12" fill="rgba(0,0,0,.45)"/>' +
      '<rect x="470" y="212" width="260" height="86" rx="6" fill="rgba(0,0,0,.5)" stroke="rgba(190,150,84,.45)" stroke-width="2"/>' +
      '<rect x="150" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="400" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="766" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="1016" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="430" y="612" width="340" height="26" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="452" y="638" width="296" height="10" fill="rgba(0,0,0,.4)"/>' +
      '<circle cx="512" cy="564" r="46" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="512" cy="570" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<circle cx="688" cy="564" r="46" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="688" cy="570" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<rect x="536" y="588" width="24" height="34" rx="3" fill="rgba(20,16,12,.6)"/>' +
      '<rect x="640" y="588" width="24" height="34" rx="3" fill="rgba(20,16,12,.6)"/>' +
      '</svg>',
    /* 库仓 · 灯影：梁、垛、粮袋、吊灯 */
    ku:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="520" width="1200" height="280" fill="var(--bg-3)"/>' +
      '<rect y="150" width="1200" height="18" fill="rgba(0,0,0,.45)"/>' +
      '<rect y="250" width="1200" height="12" fill="rgba(0,0,0,.35)"/>' +
      '<rect x="240" y="290" width="26" height="240" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="934" y="290" width="26" height="240" fill="rgba(0,0,0,.4)"/>' +
      '<g fill="rgba(60,46,30,.66)">' +
        '<rect x="120" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="290" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="120" y="500" width="150" height="94" rx="10"/>' +
        '<rect x="760" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="930" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="930" y="500" width="150" height="94" rx="10"/>' +
      '</g>' +
      '<circle cx="600" cy="330" r="60" fill="rgba(255,190,90,.10)"/>' +
      '<rect x="596" y="210" width="8" height="90" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="600" cy="316" r="14" fill="rgba(255,210,130,.8)"/>' +
      '<rect x="470" y="640" width="260" height="12" fill="rgba(0,0,0,.3)"/>' +
      '</svg>',
    /* 书斋 · 灯下：窗格、案、卷、灯 */
    zhai:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<rect x="660" y="140" width="330" height="270" fill="rgba(255,196,110,.10)"/>' +
      '<g stroke="rgba(0,0,0,.4)" stroke-width="8" fill="none">' +
        '<rect x="660" y="140" width="330" height="270" rx="6"/>' +
        '<path d="M715 140v270M770 140v270M825 140v270M880 140v270M935 140v270"/>' +
        '<path d="M660 210h330M660 280h330M660 350h330"/>' +
      '</g>' +
      '<rect x="250" y="560" width="420" height="26" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="270" y="586" width="380" height="10" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="300" y="520" width="120" height="34" rx="6" fill="rgba(214,200,168,.4)"/>' +
      '<rect x="330" y="500" width="120" height="34" rx="6" fill="rgba(214,200,168,.32)"/>' +
      '<circle cx="600" cy="500" r="52" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="600" cy="512" r="10" fill="rgba(255,214,140,.85)"/>' +
      '</svg>',
    /* 夜院 · 月下：矮墙、老树、灯、月 */
    yuan:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="880" cy="190" r="54" fill="rgba(255,240,205,.82)"/>' +
      '<circle cx="880" cy="190" r="96" fill="rgba(255,240,205,.08)"/>' +
      '<rect y="470" width="1200" height="90" fill="rgba(0,0,0,.35)"/>' +
      '<path d="M0 470h1200v22H0z" fill="rgba(0,0,0,.3)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M210 470c0-70 10-120 26-160l16 6c-12 38-20 92-20 154z" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="252" cy="270" r="86" fill="rgba(0,0,0,.42)"/>' +
      '<circle cx="180" cy="310" r="54" fill="rgba(0,0,0,.36)"/>' +
      '<circle cx="320" cy="316" r="48" fill="rgba(0,0,0,.34)"/>' +
      '<rect x="1044" y="470" width="16" height="90" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="1052" cy="560" r="34" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="1052" cy="556" r="8" fill="rgba(255,214,140,.8)"/>' +
      '</svg>',
    /* 酒肆 · 灯市：布棚、酒旗、灯笼、桌 */
    jiu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M0 150h1200v40H0z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M60 190h240l-24 150H84z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M340 190h240l-24 150H364z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M620 190h240l-24 150H644z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M900 190h240l-24 150H924z" fill="rgba(120,60,40,.4)"/>' +
      '<rect x="1024" y="240" width="10" height="330" fill="rgba(0,0,0,.5)"/>' +
      '<rect x="964" y="256" width="96" height="64" rx="4" fill="rgba(140,50,34,.62)"/>' +
      '<circle cx="600" cy="250" r="42" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="600" cy="262" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<circle cx="220" cy="250" r="42" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="220" cy="262" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<rect x="180" y="640" width="240" height="20" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="780" y="640" width="240" height="20" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="190" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="394" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="790" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="994" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '</svg>',
    /* 雨巷 · 夜行：檐、雨线、灯、水光 */
    xiang:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="600" width="1200" height="200" fill="var(--bg-3)"/>' +
      '<path d="M0 120h520l-40 120H0z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M1200 90H700l36 130h464z" fill="rgba(0,0,0,.42)"/>' +
      '<g stroke="rgba(200,214,228,.14)" stroke-width="3">' +
        '<path d="M140 200l-60 220M300 190l-60 230M470 210l-60 220M660 180l-60 240M840 200l-60 230M1010 190l-60 230M1130 220l-56 210"/>' +
      '</g>' +
      '<circle cx="600" cy="330" r="66" fill="rgba(255,190,90,.12)"/>' +
      '<rect x="592" y="252" width="14" height="70" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="599" cy="336" r="13" fill="rgba(255,214,140,.8)"/>' +
      '<path d="M180 640h420v10H180z" fill="rgba(190,208,224,.10)"/>' +
      '<path d="M700 700h360v10H700z" fill="rgba(190,208,224,.08)"/>' +
      '</svg>',
    /* 湖夜 · 渔火：月、水、舟、苇 */
    hu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="840" cy="180" r="60" fill="rgba(255,240,205,.85)"/>' +
      '<circle cx="840" cy="180" r="110" fill="rgba(255,240,205,.07)"/>' +
      '<rect y="430" width="1200" height="370" fill="var(--bg-3)"/>' +
      '<path d="M0 430h1200v6H0z" fill="rgba(0,0,0,.3)"/>' +
      '<g fill="rgba(205,222,236,.16)">' +
        '<rect x="810" y="470" width="70" height="7" rx="3"/>' +
        '<rect x="836" y="500" width="52" height="6" rx="3"/>' +
        '<rect x="820" y="532" width="88" height="6" rx="3"/>' +
        '<rect x="846" y="566" width="60" height="5" rx="3"/>' +
        '<rect x="300" y="520" width="90" height="6" rx="3"/>' +
        '<rect x="330" y="560" width="64" height="5" rx="3"/>' +
      '</g>' +
      '<path d="M560 520c30 16 84 16 114 0l-10 22H570z" fill="rgba(0,0,0,.58)"/>' +
      '<circle cx="600" cy="500" r="30" fill="rgba(255,190,90,.14)"/>' +
      '<circle cx="614" cy="494" r="7" fill="rgba(255,214,140,.85)"/>' +
      '<g stroke="rgba(0,0,0,.42)" stroke-width="5" fill="none">' +
        '<path d="M120 620c6-60 4-108-6-150M170 630c2-52 8-96 18-136M76 640c8-48 8-88 0-126"/>' +
        '<path d="M1080 610c-6-56-2-100 8-140M1130 622c-2-48-8-88-16-124"/>' +
      '</g>' +
      '</svg>',
    /* 湖晨 · 雾晓：雾带、低日、远鹭 */
    hud:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="880" cy="260" r="70" fill="rgba(255,214,150,.35)"/>' +
      '<circle cx="880" cy="260" r="130" fill="rgba(255,214,150,.08)"/>' +
      '<rect y="440" width="1200" height="360" fill="var(--bg-3)"/>' +
      '<g fill="rgba(220,228,236,.10)">' +
        '<rect y="330" width="1200" height="30" rx="15"/>' +
        '<rect x="120" y="396" width="920" height="26" rx="13"/>' +
        '<rect x="420" y="452" width="760" height="22" rx="11"/>' +
      '</g>' +
      '<path d="M330 300c22-4 40-4 60 0l-8 14c-16-3-32-3-44 0z" fill="rgba(240,244,248,.5)"/>' +
      '<path d="M430 250c18-3 34-3 50 0l-6 12c-14-3-26-3-38 0z" fill="rgba(240,244,248,.4)"/>' +
      '<g stroke="rgba(0,0,0,.4)" stroke-width="5" fill="none">' +
        '<path d="M150 620c4-52 2-94-6-130M196 628c0-44 6-82 14-116"/>' +
      '</g>' +
      '</svg>',
    /* 山道 · 云雾：叠峰、雾带、松、径 */
    shan:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<path d="M0 470L250 210l210 260z" fill="rgba(0,0,0,.34)"/>' +
      '<path d="M300 470L620 130l340 340z" fill="rgba(0,0,0,.42)"/>' +
      '<path d="M760 470L980 250l220 220z" fill="rgba(0,0,0,.3)"/>' +
      '<rect y="470" width="1200" height="330" fill="var(--bg-3)"/>' +
      '<g fill="rgba(220,228,236,.08)">' +
        '<rect x="140" y="430" width="820" height="26" rx="13"/>' +
        '<rect x="430" y="500" width="700" height="22" rx="11"/>' +
      '</g>' +
      '<path d="M240 470c0-64 6-110 16-146l14 4c-8 34-14 84-14 142z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M232 360l40-70 40 70z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M236 420l36-62 36 62z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M540 800c30-90 90-170 190-240" stroke="rgba(0,0,0,.35)" stroke-width="26" fill="none"/>' +
      '<circle cx="860" cy="430" r="34" fill="rgba(255,190,90,.10)"/>' +
      '<circle cx="858" cy="436" r="7" fill="rgba(255,214,140,.75)"/>' +
      '</svg>',
    /* 山营 · 火：帐、火、旗、戈 */
    ying:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M180 560l130-150 130 150z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M760 560l124-140 124 140z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M540 560l90-104 90 104z" fill="rgba(0,0,0,.34)"/>' +
      '<circle cx="600" cy="600" r="90" fill="rgba(255,150,60,.14)"/>' +
      '<circle cx="600" cy="606" r="34" fill="rgba(255,150,60,.22)"/>' +
      '<path d="M600 560c10 18 16 32 16 46a16 16 0 01-32 0c0-12 6-28 16-46z" fill="rgba(255,170,70,.6)"/>' +
      '<circle cx="574" cy="540" r="3" fill="rgba(255,190,90,.7)"/>' +
      '<circle cx="628" cy="524" r="3" fill="rgba(255,190,90,.6)"/>' +
      '<circle cx="610" cy="500" r="2.4" fill="rgba(255,190,90,.5)"/>' +
      '<rect x="1050" y="300" width="8" height="270" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M1058 306h86l-20 34 20 34h-86z" fill="rgba(140,50,34,.6)"/>' +
      '<path d="M120 620l-26-140M190 630l-6-150M262 620l16-140" stroke="rgba(0,0,0,.42)" stroke-width="6"/>' +
      '</svg>',
    /* 城楼 · 宵禁：垛口、门楼、旗、月 */
    men:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="260" cy="170" r="52" fill="rgba(255,240,205,.8)"/>' +
      '<circle cx="260" cy="170" r="92" fill="rgba(255,240,205,.07)"/>' +
      '<rect y="430" width="1200" height="370" fill="var(--bg-3)"/>' +
      '<rect y="360" width="1200" height="70" fill="rgba(0,0,0,.4)"/>' +
      '<g fill="rgba(0,0,0,.4)">' +
        '<rect x="60" y="330" width="40" height="40"/><rect x="160" y="330" width="40" height="40"/>' +
        '<rect x="260" y="330" width="40" height="40"/><rect x="360" y="330" width="40" height="40"/>' +
        '<rect x="460" y="330" width="40" height="40"/><rect x="560" y="330" width="40" height="40"/>' +
        '<rect x="660" y="330" width="40" height="40"/><rect x="760" y="330" width="40" height="40"/>' +
        '<rect x="860" y="330" width="40" height="40"/><rect x="960" y="330" width="40" height="40"/>' +
        '<rect x="1060" y="330" width="40" height="40"/>' +
      '</g>' +
      '<path d="M480 430v128h120V430z" fill="rgba(0,0,0,.6)"/>' +
      '<path d="M440 430l40-64h240l40 64z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M500 366l100-52 100 52z" fill="rgba(0,0,0,.44)"/>' +
      '<rect x="700" y="230" width="7" height="130" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M707 238h72l-16 28 16 28h-72z" fill="rgba(140,50,34,.6)"/>' +
      '<circle cx="540" cy="500" r="30" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="540" cy="506" r="7" fill="rgba(255,214,140,.78)"/>' +
      '</svg>',
    /* 郡府 · 飞檐：双层檐、阶、双灯 */
    fu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="520" width="1200" height="280" fill="var(--bg-3)"/>' +
      '<path d="M300 420h600l-70 60H370z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M260 360h680l-60 60H320z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M540 300h120l40 60H500z" fill="rgba(0,0,0,.5)"/>' +
      '<rect x="360" y="480" width="30" height="120" fill="rgba(96,42,28,.6)"/>' +
      '<rect x="810" y="480" width="30" height="120" fill="rgba(96,42,28,.6)"/>' +
      '<rect x="450" y="540" width="300" height="80" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="520" y="560" width="160" height="60" fill="rgba(255,196,110,.08)"/>' +
      '<circle cx="330" cy="470" r="40" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="330" cy="478" r="9" fill="rgba(255,214,140,.8)"/>' +
      '<circle cx="870" cy="470" r="40" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="870" cy="478" r="9" fill="rgba(255,214,140,.8)"/>' +
      '<path d="M300 640h600v24H300zM340 664h520v20H340z" fill="rgba(0,0,0,.28)"/>' +
      '</svg>',
    /* 晨光 · 收束：天光、远郭、归雁 */
    xiao:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="140" width="1200" height="200" fill="rgba(255,190,120,.07)"/>' +
      '<rect y="260" width="1200" height="200" fill="rgba(255,170,110,.06)"/>' +
      '<circle cx="760" cy="420" r="84" fill="rgba(255,214,150,.5)"/>' +
      '<circle cx="760" cy="420" r="150" fill="rgba(255,214,150,.10)"/>' +
      '<rect y="480" width="1200" height="320" fill="var(--bg-3)"/>' +
      '<path d="M120 480h170v-40h40v40h130v-56h44v56h150v-34h36v34h160v-48h44v48h140" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="10"/>' +
      '<path d="M420 360l14-9 14 9-14-3zM500 320l14-9 14 9-14-3zM580 350l12-8 12 8-12-2z" fill="rgba(0,0,0,.42)"/>' +
      '<rect y="560" width="1200" height="240" fill="rgba(0,0,0,.16)"/>' +
      '</svg>'
  };

  /* entry block: returns '' when the anchor has no story (no empty shell) */
  ui.SG_BLOCK = function (kind, id, name) {'''

apply('js/ui.js', OLD, NEW, 'ui.js · 壁画库 SG_MURAL')

# ============================================================
# 2b) ui.js · sgRender 骨架化 + sgBg 交叉淡入
# ============================================================
OLD = '''  ui.sgRender = function () {
    var run = GAME.SG._run;
    if (!run) return;
    var el = document.getElementById('story-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = ui.sgHTML();
    el.scrollTop = 0;
  };'''

NEW = '''  /* 换壁画：两层交叉淡入（同键不闪；首帧自 0 淡入）。层序由数据里的 bg 驱动。 */
  ui._sgBgKey = '';
  ui.sgBg = function (key) {
    var el = document.getElementById('story-fx');
    if (!el) return;
    if (!ui.SG_MURAL[key]) key = 'yuan';
    if (ui._sgBgKey === key) return;
    ui._sgBgKey = key;
    var layers = el.querySelectorAll('.sgr-bg');
    if (layers.length < 2) return;
    var cur = layers[0].dataset.on ? layers[0] : (layers[1].dataset.on ? layers[1] : null);
    var next = (cur === layers[0]) ? layers[1] : layers[0];
    next.innerHTML = ui.SG_MURAL[key];
    next.dataset.key = key;
    next.dataset.on = '1';
    if (cur) delete cur.dataset.on;
  };
  ui.sgRender = function () {
    var run = GAME.SG._run;
    if (!run) return;
    var el = document.getElementById('story-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);
    }
    /* v89.8：骨架一次建成 —— 壁画两层 + 沙幕 + 正文层；
       之后每段只换 .sgr-body 与壁画，不整体重建（否则淡入动效与层状态全丢）。 */
    if (!el.querySelector('.sgr-body')) {
      el.innerHTML = '<div class="sgr-bg"></div><div class="sgr-bg"></div>' +
        '<div class="sgr-scrim"></div><div class="sgr-body"></div>';
      ui._sgBgKey = '';
    }
    el.style.display = 'block';
    var cur = (run.phase === 'end') ? (run.ending || {}) : (GAME.SG.nodeOf(run, run.nodeId) || {});
    ui.sgBg(cur.bg || 'yuan');
    el.querySelector('.sgr-body').innerHTML = ui.sgHTML();
    el.scrollTop = 0;
  };'''

apply('js/ui.js', OLD, NEW, 'ui.js · sgRender/sgBg')

# ============================================================
# 2c) ui.js · sgHTML 加段进度（头两段替换：banner 区）
# ============================================================
OLD = '''  ui.sgHTML = function () {
    var run = GAME.SG._run;
    if (!run) return '';
    var st = run.st;
    var h = '<div class="sgr-wrap">' +
      '<div class="sgr-banner">' +
        '<span class="ui-sub">' + (ui.SG_KIND[(st.anchor || {}).kind] || '逸闻') + '</span>' +
        '<span class="gold-heading sgr-title">' + U.escape(st.title) + '</span>' +
        '<span class="ui-sub">' + (run.phase === 'end' ? '终' : ('第 ' + (run.path.length + 1) + ' 幕')) + '</span>' +
        '<button class="btn sm" data-action="story-exit">' + (run.phase === 'end' ? '收起' : '掩卷') + '</button>' +
      '</div>';'''

NEW = '''  ui.sgHTML = function () {
    var run = GAME.SG._run;
    if (!run) return '';
    var st = run.st;
    /* v89.8：段进度（第 N 段 · 共 M 段 + 进度点）—— 段数从数据逐层推（rankCount）。 */
    var total = GAME.SG.rankCount ? GAME.SG.rankCount(st) : 0;
    var seg = run.path.length + 1;
    var prog = '终';
    if (run.phase !== 'end') {
      var dots = '';
      for (var i = 0; i < total; i++) dots += '<i' + (i < Math.min(seg, total) ? ' class="on"' : '') + '></i>';
      prog = '第 ' + seg + ' 段 · 共 ' + total + ' 段' +
        (dots ? '<span class="sgr-dots">' + dots + '</span>' : '');
    }
    var h = '<div class="sgr-wrap">' +
      '<div class="sgr-banner">' +
        '<span class="ui-sub">' + (ui.SG_KIND[(st.anchor || {}).kind] || '逸闻') + '</span>' +
        '<span class="gold-heading sgr-title">' + U.escape(st.title) + '</span>' +
        '<span class="sgr-prog">' + prog + '</span>' +
        '<button class="btn sm" data-action="story-exit">' + (run.phase === 'end' ? '收起' : '掩卷') + '</button>' +
      '</div>';'''

apply('js/ui.js', OLD, NEW, 'ui.js · sgHTML 段进度')

# ============================================================
# 3) index.html · 壁画层样式 + 段入场动效 + 进度点
# ============================================================
OLD = '''  .sgr-note { color: var(--text-dim); font-size: var(--fs-cap); }
</style>'''

NEW = '''  .sgr-note { color: var(--text-dim); font-size: var(--fs-cap); }
  /* v89.8（老板「背景壁画的变换」）：满幅壁画两层 + 交叉淡入 + 沙幕（保正文可读）。
     沙幕吃主题底色（明暗四主题都成立）；正文层 z=2 压在最上，点选不受遮挡。 */
  .sgr-bg { position: fixed; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;
    opacity: 0; transition: opacity .55s ease; z-index: 0; }
  .sgr-bg svg { width: 100%; height: 100%; display: block; }
  .sgr-bg[data-on] { opacity: 1; }
  .sgr-scrim { position: fixed; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;
    background: linear-gradient(180deg, var(--bg-dark) 0%, transparent 15%),
      linear-gradient(180deg, transparent 30%, var(--bg-2) 74%); }
  #story-fx .sgr-body { position: relative; z-index: 2; }
  /* 段入场动效（每段重放入场：正文层 innerHTML 每次替换，动画自然重放） */
  .sgr-wrap { animation: sgrIn .34s ease both; }
  @keyframes sgrIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .sgr-prog { color: var(--text-dim); font-size: var(--fs-sub); white-space: nowrap; flex: none; }
  .sgr-dots { display: inline-flex; gap: 4px; align-items: center; margin-left: 6px; }
  .sgr-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--line-strong); }
  .sgr-dots i.on { background: var(--gold-light); }
</style>'''

apply('index.html', OLD, NEW, 'index.html · 壁画样式')

# ============================================================
if FAILS:
    print('\n'.join(['FAIL  ' + x for x in FAILS]))
    sys.exit(1)
print('ALL OK · v89.8 代码补丁全部落盘')
