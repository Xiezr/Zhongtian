# -*- coding: utf-8 -*-
"""v89.216 换皮视觉层（程序化图标）：① 调色板「荒原化」（材质与色相：青瓦→锈铁顶/琉璃→旧铜/
   米黄砖→水泥/亮木→旧木/亮绿→荒草/亮水→浑水/亮朱→锈红）② 骑兵剪影 → **机车**（摩托+车手）。
   形制框架不动（只换材质语义），一处调色板全局生效。"""
import io, sys
R = 'E:/Deepseekdb/'
p = R + 'js/icons.js'
s = io.open(p, encoding='utf-8', newline='').read()

# ── ① 调色板 ──
OLD_PAL = """  var P = {
    /* v30 调色板「亮画面」化：对齐原版——鲜亮但不失层次，高光更透、暗部保留 */
    ink: '#241a10',
    /* 亮青瓦 */
    tileHi: '#9db2c8', tileMd: '#64788e', tileLo: '#3d4d61', tileEdge: '#232e3c',
    /* 金琉璃 */
    glaHi: '#e8b44e', glaMd: '#b47c26', gllaLo: '#7a4e12',
    /* 米黄砖墙 */
    wallHi: '#eedcb2', wallMd: '#c4a872', wallLo: '#93794c', wallEdge: '#5e4a2c',
    /* 亮木 */
    woodHi: '#c89058', woodMd: '#96602e', woodLo: '#6a4018', woodEdge: '#3f260c',
    /* 亮岩 */
    stHi: '#d0ccbe', stMd: '#9c968a', stLo: '#6b655a', stEdge: '#453f36',
    /* 亮金 */
    goldHi: '#f6d788', goldMd: '#d0a038', goldLo: '#92691e',
    /* 亮绿 */
    grHi: '#96c258', grMd: '#689838', grLo: '#42701e',
    /* 亮水 */
    waHi: '#8cc8ec', waMd: '#5898c4', waLo: '#35709e',
    /* 火（保留暖亮） */
    fiHi: '#ffdd77', fiMd: '#f0952f', fiLo: '#b85414',
    /* 亮朱 */
    rHi: '#d45c3c', rMd: '#a83a22', rLo: '#742513',
    /* 亮钢 */
    irHi: '#d4dce8', irMd: '#98a4b6', irLo: '#667284',
    /* 亮麻 */
    clHi: '#ecdcb2', clMd: '#b89e6e', clLo: '#856c44',
    /* 亮玉（修复 SLOT_ART 死引用：jadeHi/jadeLo 此前未定义） */
    jadeHi: '#8fd8ac', jadeLo: '#4a8a60',
    /* 亮皮革（修复 SLOT_ART 死引用：leatherHi/Md/Lo 此前未定义） */
    leatherHi: '#d8b488', leatherMd: '#a87e50', leatherLo: '#745432',
  };"""
NEW_PAL = """  var P = {
    /* v89.216 调色板「荒原化」（换皮视觉层 · 一处改全局）：材质与色相换到废土 ——
       青瓦→**锈铁顶** · 金琉璃→**旧铜** · 米黄砖墙→**水泥** · 亮木→**旧木** ·
       亮岩→**碎石** · 亮金→**黄铜** · 亮绿→**荒草** · 亮水→**浑水** · 亮朱→**锈红** ·
       亮钢/麻/玉/皮革→哑光版。**形制不动**（屋檐还是屋檐、城墙还是城墙），
       只把"新瓦亮漆"换成"旧料锈迹"——这是"名字已废土、图仍是新屋"的收口。
       ⚠️ 全局观感由这一处决定；要回退只改这里（备份在 .workbuddy/backup/v89215/icons.js）。 */
    ink: '#241f18',
    /* 锈铁顶 */
    tileHi: '#b4a08a', tileMd: '#857055', tileLo: '#56452f', tileEdge: '#33281a',
    /* 旧铜 */
    glaHi: '#c9a464', glaMd: '#97743c', gllaLo: '#6a5024',
    /* 水泥墙 */
    wallHi: '#d5cfc0', wallMd: '#a8a294', wallLo: '#7a7466', wallEdge: '#4e4840',
    /* 旧木 */
    woodHi: '#b89468', woodMd: '#8e6a42', woodLo: '#5f452a', woodEdge: '#3a2a18',
    /* 碎石 */
    stHi: '#cfcabd', stMd: '#a09a8e', stLo: '#6e675c', stEdge: '#46403a',
    /* 黄铜 */
    goldHi: '#e8cf92', goldMd: '#c09a48', goldLo: '#84662a',
    /* 荒草 */
    grHi: '#a8b06a', grMd: '#7a8248', grLo: '#4e5628',
    /* 浑水 */
    waHi: '#8fbcca', waMd: '#5c8ea0', waLo: '#3a6478',
    /* 火（保留暖亮） */
    fiHi: '#ffdd77', fiMd: '#f0952f', fiLo: '#b85414',
    /* 锈红 */
    rHi: '#cf6040', rMd: '#a04428', rLo: '#702e18',
    /* 哑钢 */
    irHi: '#cdd4de', irMd: '#93a0b2', irLo: '#616c7c',
    /* 帆布 */
    clHi: '#e2d3ab', clMd: '#ab9268', clLo: '#7a6340',
    /* 玉（哑） */
    jadeHi: '#86c9a2', jadeLo: '#457f5a',
    /* 皮革（旧） */
    leatherHi: '#cfae84', leatherMd: '#a07a4e', leatherLo: '#6e502f',
  };"""
if s.count(OLD_PAL) == 1:
    s = s.replace(OLD_PAL, NEW_PAL)
    print('✅ 调色板已荒原化')
elif 'v89.216 调色板' in s:
    print('… 调色板已改过（幂等跳过）')
else:
    print('❌ 调色板锚点失配'); sys.exit(1)

# ── ② 骑兵剪影 → 机车 ──
OLD_FN_HEAD = """  function soldierMount(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    /* v31：机车剪影——坐姿骑手 + 马（马头朝右） */"""
NEW_FN_HEAD = """  function soldierMount(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    /* v89.216 换皮视觉层：骑兵剪影 → **机车**（两轮 + 车架 + 油箱 + 车把 + 前灯 + 骑行姿态；
       车头朝右）。武器语汇同旧版（矛/刀/弓/斧 一只手可持）—— 兵种语义已是「摩托游骑/
       装甲战车/突击摩托」，马形才是真正的错配。 */
    var s = '<ellipse cx="32" cy="57" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
    var wheel = function (cx) {
      return '<circle cx="' + cx + '" cy="50" r="6.6" fill="' + P.irLo + '"/>' +
        '<circle cx="' + cx + '" cy="50" r="4.6" fill="' + P.stLo + '"/>' +
        '<circle cx="' + cx + '" cy="50" r="1.5" fill="' + P.irHi + '"/>' +
        '<g stroke="' + P.irHi + '" stroke-width=".7" opacity=".45">' +
        '<line x1="' + cx + '" y1="44.6" x2="' + cx + '" y2="55.4"/>' +
        '<line x1="' + (cx - 5.4) + '" y1="50" x2="' + (cx + 5.4) + '" y2="50"/></g>';
    };
    s += wheel(13) + wheel(51);
    /* 车架 + 油箱 + 座垫 + 排气管 + 车把 + 前灯 */
    s += '<path d="M12 50 L21 39 L43 39 L52 50 L47.4 50 L40 42.6 L24 42.6 L16.6 50 Z" fill="' + C2 + '"/>' +
      '<path d="M21 31.4 L43 31.4 Q45 31.4 45 33.4 L45 36.6 Q45 38.6 43 38.6 L21 38.6 Q19 38.6 19 36.6 L19 33.4 Q19 31.4 21 31.4 Z" fill="' + C1 + '"/>' +
      '<path d="M21 31.4 L43 31.4 Q45 31.4 45 33.4 L45 34.2 L19 34.2 L19 33.4 Q19 31.4 21 31.4 Z" fill="' + C3 + '" opacity=".75"/>' +
      '<path d="M44 45 L57 45 L57 48.2 L43 48.2 Z" fill="' + P.irMd + '"/>' +
      '<path d="M54 34.4 L63 33 L63.8 36.2 L54.8 37.4 Z" fill="' + C3 + '"/>' +
      '<line x1="58.6" y1="34.6" x2="58.6" y2="30" stroke="' + P.irMd + '" stroke-width="1.6"/>' +
      '<circle cx="61.4" cy="28.6" r="2.8" fill="' + P.goldHi + '"/>' +
      '<path d="M14 31 L27 30 L29 33.4 L14 34.4 Z" fill="' + P.leatherMd + '"/>' +
      '<line x1="24" y1="42.6" x2="18" y2="48" stroke="' + P.irLo + '" stroke-width="1.4"/>' +
      '<line x1="40" y1="42.6" x2="48" y2="48" stroke="' + P.irLo + '" stroke-width="1.4"/>';"""
if s.count(OLD_FN_HEAD) == 1:
    s = s.replace(OLD_FN_HEAD, NEW_FN_HEAD)
    print('✅ 机车车体已就位')
elif 'v89.216 换皮视觉层：骑兵剪影' in s:
    print('… 机车已改过（幂等跳过）')
else:
    print('❌ 机车锚点失配'); sys.exit(1)

# 旧马身/骑手/披风段整段退役（从马身 path 到函数结尾前的 return s;）
import re
i0 = s.index(NEW_FN_HEAD) + len(NEW_FN_HEAD)
i1 = s.index('  function soldierCart(', i0)
body = s[i0:i1]
# 保留武器语汇（spear/sword/bow/axe 的 if 链）与头部、头盔段 —— 重排为机车骑手版
NEW_BODY = """
    /* 骑手（骑行姿态：前倾，腿跨车身） */
    s += '<path d="M24 24 L21 34 L28 34 L30 24 Z" fill="' + C3 + '"/>' +
      '<path d="M36 24 L38 34 L45 34 L42 24 Z" fill="' + C2 + '"/>' +
      '<path d="M22 15 L20 27 L32 27 L32 15 Z" fill="' + C2 + '"/>' +
      '<path d="M32 15 L44 15 L42 27 L32 27 Z" fill="' + C3 + '"/>' +
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".5">' +
      '<path d="M21 19 L43 19"/><path d="M20.6 23 L42.4 23"/>' +
      '</g>';
    /* 左臂（持兵器；握在车把上方） */
    s += '<path d="M22 15 L51 12 L52.6 14.6 L21 18 Z" fill="' + C2 + '"/>' +
      '<circle cx="52" cy="13.4" r="1.5" fill="' + P.leatherMd + '"/>';
    /* 持兵器 */
    if (w === 'spear') {
      s += '<line x1="52" y1="13" x2="44" y2="1" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M44 1 L47 -2 L49 2 L46 4 Z" fill="' + P.irHi + '"/>';
    } else if (w === 'sword') {
      s += '<path d="M52 13 L46 9 L48 7 L54 11 Z" fill="' + P.irHi + '"/>' +
        '<rect x="48" y="11" width="6" height="1.6" rx=".8" transform="rotate(-30 51 12)" fill="' + P.goldMd + '"/>';
    } else if (w === 'bow') {
      s += '<path d="M52 13 Q44 7 52 3" stroke="' + P.woodHi + '" stroke-width="1.8" fill="none"/>' +
        '<line x1="52" y1="13" x2="52" y2="3" stroke="' + P.clHi + '" stroke-width=".7"/>';
    } else if (w === 'axe') {
      s += '<line x1="52" y1="13" x2="50" y2="3" stroke="' + P.woodMd + '" stroke-width="1.6"/>' +
        '<path d="M48 3 Q42 -1 38 3 Q44 7 48 7 Z" fill="' + P.irHi + '"/>';
    }
    /* 右臂（扶把） */
    s += '<path d="M44 15 L56 20 L57.4 18 L45.4 13 Z" fill="' + C3 + '"/>';
    /* 头 + 盔（战术头盔 + 护目镜） */
    s += '<circle cx="32" cy="11.4" r="4.2" fill="' + P.leatherMd + '"/>' +
      '<circle cx="32" cy="11.4" r="3.4" fill="' + P.clHi + '"/>' +
      '<path d="M27.4 9.4 Q27.4 4 32 4 Q36.6 4 36.6 9.4 Z" fill="' + C1 + '"/>' +
      '<rect x="27.4" y="7.4" width="9.2" height="2" rx="1" fill="' + C3 + '"/>' +
      '<rect x="28.2" y="10.6" width="7.6" height="2.1" rx="1" fill="' + P.irMd + '" opacity=".9"/>' +
      '<path d="M32 4 L30 1.4 M32 4 L34 1.4" stroke="' + P.irLo + '" stroke-width=".7" stroke-linecap="round"/>';
    return s;
  }
"""
# 只保留武器段（从 '/* 左臂' 到 '/* 右臂'）——旧版的枪/刀/弓/斧坐标已被上面重写，故整体替换
s = s[:i0 - len(NEW_FN_HEAD)] + NEW_FN_HEAD + NEW_BODY + s[i1:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('✅ soldierMount 整段重写为机车版')
