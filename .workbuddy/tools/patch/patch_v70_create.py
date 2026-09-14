# -*- coding: utf-8 -*-
"""v70 · 第 4 块：创建界面（老板需求 5）。

老板原话：
  「首次进入游戏的创建界面，头像与将领可选头像不一致，城池归属应归属到州城所辖范围内，
    目前几个选项不太 OK」

改动：
  ① index.html  头像位改用画像（加 <img> 样式）；「城池归属」选项 = 随机 + **十三州**
  ② ui.js       头像预览改渲染头像池（与将领同一套美术，idx 即 portraitSeed）；
                归属说明换成「州治 + 特产 + 风土」；doCreate 传 portraitSeed + 州名
  ③ data.js     DATA.START_STATES（十三州清单）
  ④ state.js    GAME.pickStartPos（唯一出口：州治近旁的确定性平原空地，带归属校验）
                + newGame 按所选州落位（并把解析后的州写进 ruler.region）
  ⑤ map.js      出生点改读 state.map.startPos（强制平原圈 / 据点安全半径同步）

用法：python patch_v70_create.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
DATA = J('js', 'data.js')
STATE = J('js', 'state.js')
UI = J('js', 'ui.js')
MAP = J('js', 'map.js')
HTML = J('index.html')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    if b'\r' in io.open(p, 'rb').read():
        print('!! %s：落盘核验失败' % tag)
        return False
    return True


def cut(src, old, new, tag, optional=False):
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：已改过（跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次（必须唯一），拒绝写盘' % (tag, n))
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


# ---------------- ① index.html ----------------
CHIPS_OLD = """            <span class="chips" style="flex:1;">
              <span class="chip on" data-action="chip-set" data-v="random" data-target="create-region" data-after="region">随机</span>
              <span class="chip" data-action="chip-set" data-v="north" data-target="create-region" data-after="region">北方平原</span>
              <span class="chip" data-action="chip-set" data-v="central" data-target="create-region" data-after="region">中原腹地</span>
              <span class="chip" data-action="chip-set" data-v="south" data-target="create-region" data-after="region">江南水乡</span>
            </span>"""

CHIPS_NEW = """            <!-- v70（老板需求 5）：「城池归属应归属到州城所辖范围内，目前几个选项不太 OK」——
                 旧的「北方/中原/江南」只是三句文案（从不影响落位）；现在给出**十三州**，
                 选哪个州，出生城就落在该州州治近旁（GAME.pickStartPos，就近归属同一判据）。 -->
            <span class="chips" style="flex:1;flex-wrap:wrap;">
              <span class="chip on" data-action="chip-set" data-v="random" data-target="create-region" data-after="region">随机</span>
              <span class="chip" data-action="chip-set" data-v="司隶" data-target="create-region" data-after="region">司隶</span>
              <span class="chip" data-action="chip-set" data-v="兖州" data-target="create-region" data-after="region">兖州</span>
              <span class="chip" data-action="chip-set" data-v="豫州" data-target="create-region" data-after="region">豫州</span>
              <span class="chip" data-action="chip-set" data-v="徐州" data-target="create-region" data-after="region">徐州</span>
              <span class="chip" data-action="chip-set" data-v="青州" data-target="create-region" data-after="region">青州</span>
              <span class="chip" data-action="chip-set" data-v="冀州" data-target="create-region" data-after="region">冀州</span>
              <span class="chip" data-action="chip-set" data-v="幽州" data-target="create-region" data-after="region">幽州</span>
              <span class="chip" data-action="chip-set" data-v="并州" data-target="create-region" data-after="region">并州</span>
              <span class="chip" data-action="chip-set" data-v="凉州" data-target="create-region" data-after="region">凉州</span>
              <span class="chip" data-action="chip-set" data-v="益州" data-target="create-region" data-after="region">益州</span>
              <span class="chip" data-action="chip-set" data-v="荆州" data-target="create-region" data-after="region">荆州</span>
              <span class="chip" data-action="chip-set" data-v="扬州" data-target="create-region" data-after="region">扬州</span>
              <span class="chip" data-action="chip-set" data-v="交州" data-target="create-region" data-after="region">交州</span>
            </span>"""

AVATAR_CSS_OLD = """  .avatar-big {
    width: 130px; height: 130px; margin: 14px auto; border: 3px solid var(--gold);
    border-radius: 10px; background: radial-gradient(circle at 50% 30%, #3a3a4a, #24242e);
    display: flex; align-items: center; justify-content: center; font-size: 84px;
    box-shadow: 0 8px 24px rgba(var(--sh-rgb),.5);
  }"""

AVATAR_CSS_NEW = """  .avatar-big {
    width: 130px; height: 130px; margin: 14px auto; border: 3px solid var(--gold);
    border-radius: 10px; background: radial-gradient(circle at 50% 30%, #3a3a4a, #24242e);
    display: flex; align-items: center; justify-content: center; font-size: 84px;
    box-shadow: 0 8px 24px rgba(var(--sh-rgb),.5);
  }
  /* v70（老板需求 5）：头像改用画像（与将领同一套池子），不再用 emoji */
  .avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 7px; display: block; }"""

# ---------------- ② ui.js ----------------
SETCREATE_OLD = """  ui.setCreate = function () {
    var list = DATA.AVATARS[gender];
    avatarIdx = U.clamp(avatarIdx, 0, list.length - 1);
    $('#create-avatar').textContent = list[avatarIdx];
    var region = $('#create-region').value;
    var txt = region === 'random' ? '（随机分配一处宝地，开疆拓土）' :
      region === 'north' ? '（北方平原·易守难攻）' :
      region === 'central' ? '（中原腹地·物产丰饶）' : '（江南水乡·富庶安宁）';
    $('#create-map-preview').textContent = txt;"""

SETCREATE_NEW = """  /* v70（老板需求 5）：「头像与将领可选头像不一致」——
     创建界面的头像改用**与将领同一套**的头像池（assets/portraits/pool），
     idx 直接就是 portraitSeed（池内下标）→ 创建后君主的脸与顶栏 / 将领页**同一张**。
     emoji 池（DATA.AVATARS）只留作池子不可用时的兜底。 */
  ui.avatarPool = function () {
    var P = GAME.portraits;
    var list = (P && P.POOL && P.POOL[gender === 'female' ? 'f' : 'm']) || [];
    return list;
  };
  ui.paintCreateAvatar = function () {
    var el = $('#create-avatar');
    if (!el) return;
    var pool = ui.avatarPool();
    avatarIdx = U.clamp(avatarIdx, 0, Math.max(0, pool.length - 1));
    var file = pool[avatarIdx];
    el.innerHTML = file
      ? '<img src="' + GAME.portraits.DIR + 'pool/' + file + '" alt="头像">'
      : '<span>🧔</span>';
  };
  ui.setCreate = function () {
    ui.paintCreateAvatar();
    /* v70（老板需求 5）：归属选项改成**十三州** —— 说明给「州治 + 特产 + 风土」，
       出生城由 GAME.pickStartPos 落在该州州治近旁（不再是三句空文案）。 */
    var region = $('#create-region').value;
    var txt;
    if (region === 'random' || !DATA.STATE_SPECIALTY[region]) {
      txt = '（随机择一州落籍 · 出生城落在该州州治近旁的平原）';
    } else {
      var sp = DATA.STATE_SPECIALTY[region];
      var mat = DATA.MATERIAL_BY_ID[sp.mat];
      var seat = null;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (!seat && c.state === region && (c.type === 'zhou' || c.type === 'capital')) seat = c;
      });
      txt = '（' + region + ' · 州治' + (seat ? seat.name : '—') + ' · 特产' +
        (mat ? mat.name : sp.mat) + '　' + sp.lore + '）';
    }
    $('#create-map-preview').textContent = txt;"""

SHIFT_OLD = """  ui.avatarShift = function (dir) {
    var list = DATA.AVATARS[gender];
    avatarIdx = (avatarIdx + dir + list.length) % list.length;
    $('#create-avatar').textContent = list[avatarIdx];
  };"""

SHIFT_NEW = """  ui.avatarShift = function (dir) {
    var n = ui.avatarPool().length || 1;
    avatarIdx = (avatarIdx + dir + n) % n;
    ui.paintCreateAvatar();
  };"""

DOCREATE_OLD = """    /* 已移除"玩家守则"勾选：本项目无需该门禁，首页直接提供存档选择 */
    var avatar = DATA.AVATARS[gender][avatarIdx];
    GAME.newGame({ name: name, avatar: avatar, gender: gender, region: $('#create-region').value });"""

DOCREATE_NEW = """    /* 已移除"玩家守则"勾选：本项目无需该门禁，首页直接提供存档选择 */
    var list = DATA.AVATARS[gender];
    var avatar = list[avatarIdx % list.length];
    /* v70（老板需求 5）：portraitSeed = 头像池下标（就是玩家挑的那张脸），
       落位交给 newGame 按所选州算；avatar（emoji）保留为旧字段兜底。 */
    GAME.newGame({
      name: name, avatar: avatar, gender: gender,
      region: $('#create-region').value,
      portraitSeed: avatarIdx,
    });"""

# ---------------- ③ data.js ----------------
STATES_ANCHOR = """  /* 玩家出生州（司隶附近，洛阳 265,215 周边） */
  DATA.START_POS = { x: 275, y: 225 };"""

STATES_NEW = """  /* 玩家出生州（司隶附近，洛阳 265,215 周边）—— 旧口径的固定出生点，
     v70 起只作**兜底**（正常走 GAME.pickStartPos，按所选州落位）。 */
  DATA.START_POS = { x: 275, y: 225 };

  /* 出生州清单（v70 · 老板需求 5）—— 创建界面「城池归属」的选项：就是十三州。
     选哪个州，出生城就落在该州州治近旁（司隶以都城洛阳为锚），见 GAME.pickStartPos。 */
  DATA.START_STATES = ['司隶', '兖州', '豫州', '徐州', '青州', '冀州', '幽州',
    '并州', '凉州', '益州', '荆州', '扬州', '交州'];"""

# ---------------- ④ state.js ----------------
PICK_ANCHOR = """  GAME.makeLordGeneral = function (rulerOpts, seed, cityId) {"""

PICK_NEW = """  /* ============================================================
   * 出生坐标（v70 · 老板需求 5）—— 唯一出口
   * ------------------------------------------------------------
   * 老板：「城池归属应归属到州城所辖范围内，目前几个选项不太 OK」
   * 口径：选了某个州 → 出生城落在**该州州治近旁**的确定性环带（半径 3~8 格），
   *   并要求 `GAME.stateOfCity(落点)` 就是该州 —— "所辖范围"与就近认领是**同一判据**，
   *   不另画一套边界（画了就是第二个出口）。
   *   司隶无州城 → 锚点取都城洛阳（与 stateOfCity 的口径一致）。
   * 约束：不压任何系统城（±2 缓冲）、不越界；由 (州名, 种子) 确定性生成 —— 同种子同落点。
   * ============================================================ */
  GAME.pickStartPos = function (stateName, seed) {
    var states = DATA.START_STATES || [];
    var rand = U.rng((Math.round(seed) || 1) >>> 0);
    var name = String(stateName == null ? '' : stateName);
    if (name !== 'random' && states.indexOf(name) < 0) name = 'random';
    if (name === 'random') name = states[Math.floor(rand() * states.length)] || '司隶';
    var anchor = null;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (anchor) return;
      if (c.type === 'zhou' && c.state === name) anchor = c;
      if (!anchor && name === '司隶' && c.type === 'capital') anchor = c;
    });
    if (!anchor) anchor = { x: DATA.START_POS.x, y: DATA.START_POS.y };
    var free = function (x, y) {
      if (x < 3 || y < 3 || x > DATA.MAP_W - 4 || y > DATA.MAP_H - 4) return false;
      var hit = false;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (Math.abs(c.x - x) <= 2 && Math.abs(c.y - y) <= 2) hit = true;
      });
      if (hit) return false;
      return GAME.stateOfCity({ x: x, y: y }) === name;
    };
    for (var i = 0; i < 240; i++) {
      var ang = rand() * Math.PI * 2, rad = 3 + rand() * 5;
      var x = Math.round(anchor.x + Math.cos(ang) * rad);
      var y = Math.round(anchor.y + Math.sin(ang) * rad);
      if (free(x, y)) return { x: x, y: y, state: name };
    }
    /* 兜底：环带扫不到就自锚点向外做确定性扫描（保证**必有**可用点） */
    for (var r = 3; r <= 26; r++) {
      for (var dx = -r; dx <= r; dx++) {
        for (var dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var bx = anchor.x + dx, by = anchor.y + dy;
          if (free(bx, by)) return { x: bx, y: by, state: name };
        }
      }
    }
    return { x: DATA.START_POS.x, y: DATA.START_POS.y, state: name };
  };

""" + PICK_ANCHOR

NG_CITY_OLD = """  GAME.newGame = function (rulerOpts) {
    var city = GAME.makeCity({
      id: 'p1',
      name: rulerOpts.cityName || '新城池',
      x: DATA.START_POS.x, y: DATA.START_POS.y,
      initialExt: true,          // 首城预置 2 田 1 木 1 石 1 铁
      res: U.deep(DATA.INITIAL_RES),   // v60：开局库存进首城（不再是全境共享的 s.res）
    });
    var gen = GAME.makeGeneral(DATA.INITIAL_GENERAL, 1, 'idle', city.id, true);
    var mapSeed = U.now() % 100000;"""

NG_CITY_NEW = """  GAME.newGame = function (rulerOpts) {
    var mapSeed = U.now() % 100000;
    /* v70（老板需求 5）：出生坐标按**所选州**落位（州治近旁的平原空地），
       司隶以洛阳为锚；落不到才回退旧口径的固定点。出生城写明所属州 ——
       展示、岁贡、州特产都读同一份归属。 */
    var startPos = GAME.pickStartPos(rulerOpts.region, mapSeed);
    var city = GAME.makeCity({
      id: 'p1',
      name: rulerOpts.cityName || '新城池',
      x: startPos.x, y: startPos.y,
      state: startPos.state,
      initialExt: true,          // 首城预置 2 田 1 木 1 石 1 铁
      res: U.deep(DATA.INITIAL_RES),   // v60：开局库存进首城（不再是全境共享的 s.res）
    });
    var gen = GAME.makeGeneral(DATA.INITIAL_GENERAL, 1, 'idle', city.id, true);"""

NG_MAP_OLD = """      map: { seed: mapSeed, cities: GAME.buildNpcCities(mapSeed), wilds: null },"""

NG_MAP_NEW = """      /* v70：出生点随"所选州"走 —— 地图生成时的"出生圈强制平原"与据点安全半径
         都读 `map.startPos`（见 map.js），旧档缺字段则回退 DATA.START_POS。 */
      map: { seed: mapSeed, cities: GAME.buildNpcCities(mapSeed), wilds: null,
        startPos: { x: startPos.x, y: startPos.y } },"""

NG_REGION_OLD = """        region: rulerOpts.region || 'random',"""

NG_REGION_NEW = """        /* v70：记**解析后**的州（'random' 也记成抽到的那一州）——
           创建界面的选择因此可复盘，出生城的归属与它一致 */
        region: startPos.state || rulerOpts.region || 'random',"""

# ---------------- ⑤ map.js ----------------
MAP_PLAIN_OLD = """          var sx = DATA.START_POS.x, sy = DATA.START_POS.y;
          if (Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2) terrain = 'plain';"""

MAP_PLAIN_NEW = """          /* v70：出生点随"所选州"走（state.map.startPos）；旧档回退固定点 */
          var sp0 = s.map.startPos || DATA.START_POS;
          var sx = sp0.x, sy = sp0.y;
          if (Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2) terrain = 'plain';"""

MAP_FORT_OLD = """    /* 离出生点与名城太近则不生成 */
    var sp = DATA.START_POS;"""

MAP_FORT_NEW = """    /* 离出生点与名城太近则不生成（v70：出生点随所选州走） */
    var sp = (s.map && s.map.startPos) || DATA.START_POS;"""

EDITS = [
    (HTML, CHIPS_OLD, CHIPS_NEW, '①a 归属选项 → 十三州'),
    (HTML, AVATAR_CSS_OLD, AVATAR_CSS_NEW, '①b 头像 img 样式'),
    (UI, SETCREATE_OLD, SETCREATE_NEW, '②a 头像池渲染 + 归属说明'),
    (UI, SHIFT_OLD, SHIFT_NEW, '②b avatarShift 用池长'),
    (UI, DOCREATE_OLD, DOCREATE_NEW, '②c doCreate 传 portraitSeed'),
    (DATA, STATES_ANCHOR, STATES_NEW, '③ START_STATES 十三州'),
    (STATE, PICK_ANCHOR, PICK_NEW, '④a pickStartPos 唯一出口'),
    (STATE, NG_CITY_OLD, NG_CITY_NEW, '④b newGame 按州落位'),
    (STATE, NG_MAP_OLD, NG_MAP_NEW, '④c map.startPos'),
    (STATE, NG_REGION_OLD, NG_REGION_NEW, '④d ruler.region 记解析后州'),
    (MAP, MAP_PLAIN_OLD, MAP_PLAIN_NEW, '⑤a 强制平原圈随出生点'),
    (MAP, MAP_FORT_OLD, MAP_FORT_NEW, '⑤b 据点安全半径随出生点'),
]


def main():
    files = {}
    fails = []
    if 'pickStartPos' in read(STATE) and 'START_STATES' in read(DATA):
        print('· 全部已改过（幂等跳过）')
        return 0
    for path, old, new, tag in EDITS:
        if path not in files:
            files[path] = read(path)
        res = cut(files[path], old, new, tag, optional=True)
        if res is None:
            fails.append(tag)
            continue
        files[path] = res
    for path, s in files.items():
        if not save_lf(path, s, os.path.basename(path)):
            fails.append(os.path.basename(path))
    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
