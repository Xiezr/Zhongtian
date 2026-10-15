# v89.177 修复：① 两处 guanfuBox 拼接插 heartsBox177（施工态 + 正常态互斥）
#              ② 君主面板五关清单挂载（B2b 被 skip 误判漏掉）
import io

ROOT = 'E:/Deepseekdb/'
p = ROOT + 'js/ui.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

# ① 两处拼接（count 应为 2）
old1 = 'guanfuBox + queueBox174 +'
assert s.count(old1) == 2, '拼接点数量 ' + str(s.count(old1))
s = s.replace(old1, 'guanfuBox + heartsBox177 + queueBox174 +')

# ② 五关清单挂载
old2 = """              (bNeed == null ? '　·　已至天授上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div></td></tr>';"""
assert s.count(old2) == 1, '挂载点数量 ' + str(s.count(old2))
new2 = """              (bNeed == null ? '　·　已至天授上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div>' + _trialHTML177 +
              '</td></tr>';"""
s = s.replace(old2, new2)

io.open(p, 'w', encoding='utf-8', newline='').write(s)

# 写后自检
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert chk.count('guanfuBox + heartsBox177 + queueBox174 +') == 2
assert chk.count("'</div>' + _trialHTML177") == 1
print('FIXED-177 · 两处拼接 + 清单挂载')
