# -*- coding: utf-8 -*-
"""v89.178 补丁 B：出征界面预估区文案精简（ui.js）
   老板令：
     · 去掉「👥 共派遣 720 兵」（"这不明摆着吗"）——含 #exp-sum 元素整条退役
     · 去掉「区间：我 1 : … · 情报 Lv1（升侦察技巧可收窄）」（"也没必要"）
     · 「⚑ 此战凶险：胜则可入史册」并入「兵力偏少」→ 只写「兵力偏少，此战凶险」
   行级手术（每步唯一性断言）；行首 '+' 衔接单独处理（防 `'a' + +b` 一元正号吞串）。
   跑法：python .workbuddy/tools/patch/v89178b_ui.py"""
import io

P = 'js/ui.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
assert '\r\n' not in s, 'CRLF detected'
lines = s.split('\n')

def find_idx(pred, tag):
    idx = [i for i, l in enumerate(lines) if pred(l)]
    assert len(idx) == 1, tag + ' hits=' + str(len(idx))
    return idx[0]

# ---- B1: 删 #exp-sum 的 HTML 行 ----
i = find_idx(lambda l: 'id="exp-sum"' in l, 'B1')
del lines[i]

# ---- B2a: var sum73 → var pow73（附退役注释） ----
i = find_idx(lambda l: "var sum73 = $('#exp-sum'), pow73 = $('#exp-power');" in l, 'B2a')
lines[i] = ("    /* v89.178（老板：「👥 共派遣 N 兵，这不明摆着吗」）——「共派遣」整行退役"
            "（#exp-sum 元素同删）；兵力在各兵种输入框上本就可数。 */\n"
            "    var pow73 = $('#exp-power');")

# ---- B2b: if (sum73 || pow73) { → if (pow73) { ----
i = find_idx(lambda l: 'if (sum73 || pow73) {' in l, 'B2b')
lines[i] = '    if (pow73) {'

# ---- B2c: 去 n74 ----
i = find_idx(lambda l: 'var n74 = 0, mine74 = 0;' in l, 'B2c')
lines[i] = '      var mine74 = 0;'

i = find_idx(lambda l: l.strip() == 'n74 += v74;', 'B2d')
del lines[i]

# ---- B2e: 删 sum73 更新段（4 行；删后下一行应为 if (pow73) {） ----
i = find_idx(lambda l: l.strip() == 'if (sum73) {', 'B2e')
assert 'sum73.innerHTML' in lines[i + 1], 'B2e shape1'
assert '共派遣' in lines[i + 1] + lines[i + 2], 'B2e shape2'
del lines[i:i + 4]
assert lines[i].strip() == 'if (pow73) {', 'B2e shape3: ' + lines[i]

# ---- B3a: 删 _two74（区间行退役后无消费者） ----
i = find_idx(lambda l: 'function _two74(x)' in l, 'B3a')
del lines[i]

# ---- B3b: 「兵力偏少」→「兵力偏少，此战凶险」（并入原独立凶险行） ----
i = find_idx(lambda l: l.strip().startswith(": ['兵力偏少',"), 'B3b')
lines[i] = ("            /* v89.178（老板：「此战凶险」加到「兵力偏少」后边，只写「兵力偏少，此战凶险」）——\n"
            "               原单独一行「⚑ 此战凶险：胜则可入史册」退役，并入本标签。 */\n"
            "            : ['兵力偏少，此战凶险', 'var(--gold-light)'];")

# ---- B4: 删「区间 / 情报 Lv」2 行 + 「⚑ 此战凶险」2 行；下一行去行首 '+' ----
i = find_idx(lambda l: '区间：我 1 : ' in l, 'B4')
assert '_two74(rLo)' in lines[i], 'B4 shape1'
assert '情报 Lv' in lines[i + 1], 'B4 shape2'
assert 'rLo < 1 && rHi != null && rHi >= 0.9' in lines[i + 2], 'B4 shape3'
assert '此战凶险：胜则可入史册' in lines[i + 3], 'B4 shape4'
del lines[i:i + 4]
lines.insert(i, "            /* v89.178（老板：「区间…情报 Lv（升侦察技巧可收窄）这个也没必要」）——区间/情报条退役。 */")
nxt = lines[i + 1]
assert nxt.strip().startswith('+ (pw74.siege'), 'B4 next=' + nxt[:50]
lines[i + 1] = nxt.replace('+ (pw74.siege', '(pw74.siege', 1)

# ---- 写盘 + 自检 ----
out = '\n'.join(lines)
for gone in ['id="exp-sum"', "'👥 共派遣", "'　·　情报 Lv", "'⚑ 此战凶险", '_two74', 'sum73', 'var n74']:
    assert gone not in out, 'residue: ' + gone
assert out.count("['兵力偏少，此战凶险'") == 1
assert "    var pow73 = $('#exp-power');" in out
io.open(P, 'w', encoding='utf-8', newline='').write(out)
print('patch B OK: ui.js updated, len=%d' % len(out))
