# -*- coding: utf-8 -*-
"""v89.126 补丁 G2：城墙并入建筑体系（domain / ui / main）
—— buildingLevel 特判退役、wallCost/buildWall/upgradeWall/wallPendingOf 退役、
   队列里的 'wall' 类型与分支退役、自动建造城墙特例退役、
   ui.openWallModal 退役（热区 open-wall → 通用建筑面板）、main 动作清理。
安全：读→改→原子写→node --check；每处锚点 count==1（块用起止标记切片）。
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

def patch(rel, pairs):
    P = os.path.join(R, rel)
    s = io.open(P, encoding='utf-8').read()
    for i, (old, new) in enumerate(pairs):
        c = s.count(old)
        assert c == 1, '[%s] 锚点 %d 计数 %d（应为 1）\n---\n%s\n---' % (rel, i, c, old[:220])
        s = s.replace(old, new)
    tmp = P + '.tmp_v89126'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (rel, r.stderr[:400])
    print('✓ %s（%d 处）' % (rel, len(pairs)))

# ═══════════ domain.js：先做块删除（cut），再做精确替换 ═══════════
P = os.path.join(R, 'js/domain.js')
s = io.open(P, encoding='utf-8').read()

def cut(s, start, end, what, tomb=''):
    assert s.count(start) == 1, '[%s] start 计数 %d' % (what, s.count(start))
    i = s.find(start)
    j = s.find(end, i)
    assert j > i, '[%s] 找不到 end' % what
    return s[:i] + tomb + s[j + len(end):]

s = cut(s,
        "  /* --------- 城墙（v16：不占格，环绕城池一圈） --------- */\n",
        "    return { ok: true, msg: '开始修建城墙' };\n  };\n",
        'wallCost/buildWall',
        "  /* v89.126：`wallCost` / `buildWall` 退役 —— 城墙占格后走通用出口\n"
        "     （buildAt / levelCost / payCost / checkBuildSlot，与其它建筑一字不差）。 */\n")

s = cut(s,
        "  /* 该城是否已有城墙在建造队列里。\n",
        "      return q.type === 'wall' && q.cityId === cityId;\n    });\n  };\n",
        'wallPendingOf',
        "  /* v89.126：`wallPendingOf` 退役 —— 城墙占格后有 `cell.pending` 可看，\n"
        "     与其它建筑同一查法（v64 那条\"防重复排队\"此时天然成立）。 */\n")

s = cut(s,
        "  GAME.upgradeWall = function (cityId) {\n",
        "    return { ok: true, msg: '开始升级城墙 → Lv' + (lv + 1) };\n  };\n\n",
        'upgradeWall',
        "  /* v89.126：`upgradeWall` 退役 —— 通用 `upgradeAt` 接管（含珠宝提示 / 建造成本 buff）。 */\n\n")

# buildingLevel 特判退役 + 新增 wallCellIdxOf
old_bl = ("    /* v16：城墙不再占格，等级存在 city.wallLv */\n"
          "    if (bid === 'chengqiang') return city.wallLv || 0;\n"
          "    var l = 0;\n"
          "    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });\n"
          "    return l;\n"
          "  };\n")
new_bl = ("    /* v89.126：城墙占格后与其它建筑**同一读法**（原 `city.wallLv` 特判退役）。 */\n"
          "    var l = 0;\n"
          "    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });\n"
          "    return l;\n"
          "  };\n"
          "  /* v89.126（老板「城墙与其他建筑并列管理」）：城墙格下标（唯一出口）——\n"
          "     -1 = 尚未修建。环城热区点击 / 建造入口 / 断言一律读它。 */\n"
          "  GAME.wallCellIdxOf = function (city) {\n"
          "    city = city || GAME.currentCity();\n"
          "    if (!city) return -1;\n"
          "    var idx = -1;\n"
          "    (city.cells || []).forEach(function (x, i) {\n"
          "      if (idx < 0 && x.build && x.build.id === 'chengqiang') idx = i;\n"
          "    });\n"
          "    return idx;\n"
          "  };\n")
assert s.count(old_bl) == 1, 'buildingLevel 锚点 %d' % s.count(old_bl)
s = s.replace(old_bl, new_bl)

# cancelRefundOf：wall hit 分支 + cost 反查
old_hit = ("      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId；\n"
           "         城墙（wall）无下标，按类型 + 城池匹配 */\n"
           "      var hit = kind === 'wall'\n"
           "        ? (x.type === 'wall' && (!cur || !x.cityId || x.cityId === cur.id))\n"
           "        : kind === 'city'\n")
new_hit = ("      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId */\n"
           "      var hit = kind === 'city'\n")
assert s.count(old_hit) == 1, 'cancelRefundOf hit 锚点 %d' % s.count(old_hit)
s = s.replace(old_hit, new_hit)

old_c = ("    else if (q.type === 'wall') cost = DATA.BUILDINGS.chengqiang.levelCost(q.targetLevel - 1) || DATA.BUILDINGS.chengqiang.buildCost;\n")
assert s.count(old_c) == 1, 'cancelRefundOf cost 锚点 %d' % s.count(old_c)
s = s.replace(old_c, "")

# queueValueOf：wall 分支
old_qv = ("    } else if (q.type === 'wall') {\n"
          "      var bw = DATA.BUILDINGS.chengqiang;\n"
          "      cost = bw ? (((q.targetLevel || 1) <= 1) ? bw.buildCost : bw.levelCost((q.targetLevel || 2) - 1)) : null;\n"
          "    } else if (q.type === 'ext_build' || q.type === 'ext_upgrade') {\n")
new_qv = ("    } else if (q.type === 'ext_build' || q.type === 'ext_upgrade') {\n")
assert s.count(old_qv) == 1, 'queueValueOf 锚点 %d' % s.count(old_qv)
s = s.replace(old_qv, new_qv)

# queueAt：wall 分支
old_qa = "      if (kind === 'wall' && q.type === 'wall') out = q;\n"
assert s.count(old_qa) == 1, 'queueAt 锚点 %d' % s.count(old_qa)
s = s.replace(old_qa, "")

# 自动建造：城墙候选段退役
old_cand = ("""    /* v64（老板）：「城墙纳入自动建筑中」——
       城墙**不占格**（等级存在 `city.wallLv`），原先根本不在候选里，
       于是"自动升级"永远不碰它，城墙等级一直停在玩家手点的那一级。
       现在它作为**每城一个**候选参与，等级序与别的建筑同一条规则。 */
    (s.cities || []).forEach(function (ct) {
      var wlv = ct.wallLv || 0;
      if (wlv >= GAME.buildCapOf(ct, 'chengqiang')) return;
      /* 城墙不占格 → 没有 `cell.pending` 可看，必须单独查"是否已在队列里" */
      if (GAME.wallPendingOf(ct.id)) return;
      cands.push({ kind: 'wall', idx: -1, cityId: ct.id, lv: wlv,
        name: (multi ? ct.name + '·' : '') + DATA.BUILDINGS.chengqiang.name });
    });

""")
new_cand = ("""    /* v89.126：城墙占格后**并入上面的 cells 候选扫描**（天然包含它）——
       原"城墙单独候选 + wallPendingOf 防重排"整段退役。 */

""")
assert s.count(old_cand) == 1, '自动建造候选锚点 %d' % s.count(old_cand)
s = s.replace(old_cand, new_cand)

old_ko = ("    /* 等级从低到高；同级**城内功能建筑 → 城墙 → 城外资源地块**\n"
          "       （城墙耗石尤多，同级时不该抢在城内建筑前面） */\n"
          "    var KIND_ORD = { city: 0, wall: 1, ext: 2 };\n")
new_ko = ("    /* 等级从低到高；同级**城内建筑（含城墙）→ 城外资源地块** */\n"
          "    var KIND_ORD = { city: 0, ext: 2 };\n")
assert s.count(old_ko) == 1, 'KIND_ORD 锚点 %d' % s.count(old_ko)
s = s.replace(old_ko, new_ko)

old_call = ("      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)\n"
            "        : (c.kind === 'wall' ? GAME.buildWall(c.cityId)\n"
            "          : GAME.upgradeAt(c.cityId || city.id, c.idx));\n")
new_call = ("      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)\n"
            "        : GAME.upgradeAt(c.cityId || city.id, c.idx);\n")
assert s.count(old_call) == 1, '自动建造调用锚点 %d' % s.count(old_call)
s = s.replace(old_call, new_call)

# domain 5386 附近（第二处 hit 计算）
old_hit2 = ("      /* v14：外城地块按城池独立，同一下标会在多城间重复，须同时匹配 cityId；\n"
            "         v16：城墙（wall）无下标，按类型 + 城池匹配 */\n"
            "      var sameCity = !cur || !q.cityId || q.cityId === cur.id;\n"
            "      var hit = kind === 'wall'\n"
            "        ? (q.type === 'wall' && sameCity)\n"
            "        : kind === 'city'\n")
new_hit2 = ("      /* v14：外城地块按城池独立，同一下标会在多城间重复，须同时匹配 cityId */\n"
            "      var sameCity = !cur || !q.cityId || q.cityId === cur.id;\n"
            "      var hit = kind === 'city'\n")
assert s.count(old_hit2) == 1, 'hit2 锚点 %d' % s.count(old_hit2)
s = s.replace(old_hit2, new_hit2)

# 兼容：cancelRefundOf 里 kind==='wall' 之外，另有一处 doCancelBuild 的 wall 分支？
# （上面 hit2 即它；如还有残留会在 smoke 中暴露）

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'domain.js node --check 失败：' + r.stderr[:400]
print('✓ js/domain.js（块删除 3 段 + 精确替换 10 处）')

# ═══════════ ui.js ═══════════
P = os.path.join(R, 'js/ui.js')
s = io.open(P, encoding='utf-8').read()

s = cut(s,
        "  /* ============================================================\n   * 城墙（v16：不占格，环绕城池一圈）\n",
        "      '<div class=\"bldg-foot\"><span></span><button class=\"btn\" data-action=\"close-modal\">关闭</button><span></span></div>');\n  };\n\n",
        'openWallModal',
        "  /* v89.126：原「城墙」独立面板（openWallModal）退役 ——\n"
        "     城墙占格后走**通用建筑面板**（ui.openBuildModal，含建造/升级/取消/提速）；\n"
        "     环城热区 `open-wall` 由 main.js 转发到该面板。 */\n\n")

patch('js/ui.js', [
    ("      var wall = ct.wallLv || 0;",
     "      var wall = GAME.buildingLevel(ct, 'chengqiang') || 0;   /* v89.126：城墙占格后同一读法 */"),
    ("　城墙 Lv' + p.wallLv + '<span class=\"plan-dim\">（不占格）</span></span></div>' +",
     "　城墙 Lv' + p.wallLv + '<span class=\"plan-dim\">（占城内 1 格）</span></span></div>' +"),
    ("    var kn = kind === 'wall' ? '城墙施工' : (kind === 'ext' ? '城外' + (isUp ? '升级' : '建造') : (isUp ? '升级' : '建造'));",
     "    var kn = kind === 'ext' ? '城外' + (isUp ? '升级' : '建造') : (isUp ? '升级' : '建造');"),
])

# ═══════════ main.js ═══════════
patch('js/main.js', [
    ("      case 'open-wall': ui.openWallModal(); break;",
     "      case 'open-wall': {\n"
     "        /* v89.126：城墙占格后，环城热区点击 = 打开城墙格的**通用建筑面板**；\n"
     "           未建城墙 → 找一格空地打开建造菜单（选「城墙」）。 */\n"
     "        var _cw126 = GAME.currentCity();\n"
     "        var _wi126 = GAME.wallCellIdxOf ? GAME.wallCellIdxOf(_cw126) : -1;\n"
     "        if (_wi126 >= 0) { ui.openBuildModal(_wi126); break; }\n"
     "        var _free126 = -1;\n"
     "        (((_cw126 || {}).cells) || []).forEach(function (x, i) {\n"
     "          if (_free126 < 0 && !x.build && !x.pending && !x.official) _free126 = i;\n"
     "        });\n"
     "        if (_free126 >= 0) { ui.openBuildModal(_free126); ui.toast('在空地上选择「城墙」即可修建'); }\n"
     "        else ui.toast('城内已无空地可建城墙（先拆一处或扩建）');\n"
     "        break;\n"
     "      }"),
    ("""      case 'rush-wall': {
        var _rq3 = GAME.queueRushPay(GAME.queueAt('wall'), '城墙工程');
        ui.toast(_rq3.msg);
        GAME.refreshAll();
        ui.openWallPanel();
        break;
      }
""", ""),
    ("      case 'wall-build': GAME.doBuildWall(); break;\n", ""),
    ("""  /* --------- 城墙（v16：不占格） --------- */
  GAME.doBuildWall = function () {
    var c = GAME.currentCity();
    if (!c) return;
    var r = (c.wallLv || 0) > 0 ? GAME.upgradeWall(c.id) : GAME.buildWall(c.id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openWallModal(); }
  };

""",
     """  /* v89.126：`doBuildWall` 退役 —— 城墙走通用建造/升级（confirm-build / confirm-upgrade）。 */

"""),
])

print('补丁 G2 完成。')
