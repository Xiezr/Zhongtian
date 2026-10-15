# -*- coding: utf-8 -*-
"""v90.17（老板 4）：套装部件名多元化 —— 14 槽 × 3 侧重各给专属名（占=战斗/治=测控/体=重装），
   保留左右/前后缀与套装前缀。只改 name，数值不动，重生成 DATA.EQUIP。"""
SLOT_LR = {'arm_up_l':'左','arm_up_r':'右','arm_low_l':'左','arm_low_r':'右',
  'thigh_l':'左','thigh_r':'右','shin_l':'左','shin_r':'右','foot_l':'左','foot_r':'右',
  'weapon':'右','pendant':'左','back':'左','ring':'右'}
# 槽 → {占/治/体 三味名}
SN = {
 'head':   {'zhan':'火控观瞄','zhi':'测控观瞄','ti':'装甲观瞄'},
 'chest':  {'zhan':'动力引擎','zhi':'指挥中枢','ti':'重装躯干'},
 'waist':  {'zhan':'速控平衡环','zhi':'稳态陀螺环','ti':'承重腰腹'},
 'arm_up': {'zhan':'强袭展臂','zhi':'精密展臂','ti':'重甲展臂'},
 'arm_low':{'zhan':'突击操作臂','zhi':'精细操作臂','ti':'重装操作臂'},
 'thigh':  {'zhan':'疾行承载腿','zhi':'稳态承载腿','ti':'重装承载腿'},
 'shin':   {'zhan':'疾行支撑腿','zhi':'稳态支撑腿','ti':'重装支撑腿'},
 'foot':   {'zhan':'疾行抓地足','zhi':'稳态抓地足','ti':'重装抓地足'},
 'weapon': {'zhan':'强袭炮','zhi':'精准炮','ti':'重炮'},
 'pendant':{'zhan':'副炮','zhi':'辅助炮','ti':'副重炮'},
 'mount':  {'zhan':'突进推进器','zhi':'悬浮单元','ti':'重装推进器'},
 'back':   {'zhan':'突击翼','zhi':'侦察翼','ti':'重装翼'},
 'ring':   {'zhan':'突击翼','zhi':'侦察翼','ti':'重装翼'},
 'neck':   {'zhan':'战地净化器','zhi':'精测净化器','ti':'重装净化器'},
}
def base_slot(s):
    for k in ('arm_up','arm_low','thigh','shin','foot'):
        if s.startswith(k): return k
    return s
SLOT_ZH = {'head':'观瞄','chest':'动力','waist':'平衡','arm_up':'驱动臂','arm_low':'操作臂',
 'thigh':'承载腿','shin':'支撑腿','foot':'抓地足','weapon':'武装','mount':'机动',
 'back':'披风','ring':'披风','pendant':'武装','neck':'辐射清除'}
PREF = {1:{'zhan':'拾荒','zhi':'补丁','ti':'铁皮'},2:{'zhan':'巡逻','zhi':'工坊','ti':'装卸'},
 3:{'zhan':'猎杀','zhi':'中枢','ti':'重装'},4:{'zhan':'战团','zhi':'议会','ti':'壁垒'},
 5:{'zhan':'诸神','zhi':'智囊','ti':'不朽'},6:{'zhan':'天罚','zhi':'神谕','ti':'机体'}}
TN={1:'coarse',2:'fine',3:'prime',4:'rare',5:'legend',6:'divine'}
def make_name(q, focus, slot):
    bs = base_slot(slot)
    core = SN[bs][focus]
    lr = SLOT_LR.get(slot, '')
    return PREF[q][focus] + lr + core
# 打印样例
for q,f,s in [(6,'zhan','weapon'),(6,'zhi','pendant'),(6,'ti','chest'),(5,'zhan','arm_up_l'),(1,'ti','foot_r')]:
    print(TN[q], f, s, '->', make_name(q,f,s))
