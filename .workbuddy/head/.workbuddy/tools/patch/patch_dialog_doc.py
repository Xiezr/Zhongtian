# -*- coding: utf-8 -*-
"""v68 · 弹窗统一：smoke 第 56 节守卫 + docs/设计规范.md §11。"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
SMOKE = os.path.join(ROOT, 'smoke-test.js')
DOC = os.path.join(ROOT, 'docs', '设计规范.md')

N56 = """  /* ============================================================
   * 56. v68：弹窗统一规范（老板「点击建筑出来的弹窗……尽量统一」）
   * ------------------------------------------------------------
   * 考察结论与规范见 docs/设计规范.md §11。本节守卫易回退点：
   *   · 建筑详情弹窗（城内/城外/城墙）统一骨架与底栏
   *   · 底栏三格：危险（左）· 关闭（中）· 管理（右）
   *   · 升级费用与按钮同行（op-row-between）
   *   · 页脚样式统一（bldg-foot 与 m-foot 同规格，不用 dashed）
   *   · 操作命名：名字覆盖面板全部内容；多功能面板「用途A · 用途B」
   * ============================================================ */
  console.log('\\n--- 第 56 节：弹窗统一规范 ---');
  (function () {
    var fs56 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u56 = stripComment(fs56('ui'));
    var h56 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

    check('建筑详情弹窗统一用 bldg-foot 底栏（城内×2 / 城外×2 / 城墙×2）',
      (u56.match(/class="bldg-foot"/g) || []).length >= 6,
      (u56.match(/class="bldg-foot"/g) || []).length + ' 处');

    check('★ 底栏三格：拆毁（左）· 关闭（中）· 移动（右）', (function () {
      var i = u56.indexOf('class="bldg-foot"');
      var seg = u56.slice(i, i + 800);
      return seg.indexOf('demolish-ask') >= 0 && seg.indexOf('close-modal') >= 0 && seg.indexOf('move-ask') >= 0
        && seg.indexOf('demolish-ask') < seg.indexOf('close-modal')
        && seg.indexOf('close-modal') < seg.indexOf('move-ask');
    })());

    check('★ 升级行统一：费用与按钮同行（op-row-between 至少三处）',
      (u56.match(/op-row op-row-between/g) || []).length >= 3,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');

    check('页脚样式统一：bldg-foot 与 m-foot 同规格（实线，不再 dashed）',
      /\.bldg-foot \\{[^}]*solid/.test(h56) && !/\\.bldg-foot \\{[^}]*dashed/.test(h56));

    check('★ 操作命名：官府入口覆盖面板全部内容（不再叫「征收」）', (function () {
      var m = u56.match(/guanfu: \\{ label: "([^"]+)"/);
      return !!m && m[1].indexOf('征收') < 0 && m[1].indexOf('官府') >= 0;
    })());

    check('操作命名：多功能面板用「用途A · 用途B」（军营 / 作坊）',
      /junying: \\{ label: "[^"]+ · [^"]+"/.test(u56)
      && /gongjiangzuofang: \\{ label: "[^"]+ · [^"]+"/.test(u56));

    check('施工中弹窗与正常态同构（图标 + 名称 · Lv→Lv + 描述）',
      /icons\\.forBuilding\\(isUpgrade \\? cell\\.build\\.id : cell\\.pending\\.buildId\\)/.test(u56)
      && /升级中 · 后台施工/.test(u56));

    check('e2e 依赖的文案保留（不影响下方操作 / 目标等级）',
      /不影响下方操作/.test(u56) && /→ Lv' \\+ cell\\.pending\\.targetLevel/.test(u56));

    check('纯关窗语义不叫「取消」（城外空地已统一为「关闭」）',
      /选择资源建筑[\\s\\S]{0,500}m-foot[\\s\\S]{0,120}关闭/.test(u56));
  })();

"""

S55_TAIL_OLD = """      G.state = keep55;
    }
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

S55_TAIL_NEW = """      G.state = keep55;
    }
  })();

""" + N56 + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

DOC_ANCHOR_TAIL = """## 11. 弹窗规范（v68 考察后统一）

> 由来：老板 2026-09-14「点击建筑出来的弹窗还是不好看，要求尽量统一（除非功能多的建筑），
> 按钮位置合理，操作项的命名合理（官府那个操作入口叫征收，有点扯淡了）。
> 也考察一下其他弹窗界面，做到风格统一」。

### 11.1 骨架与尺寸
- 所有弹窗走 `ui.modalShell` / `ui.openShell` 三段式：`m-head`（标题栏）·`m-body`（内容区，滚动）·页脚（操作栏，固定）。
- 尺寸四档 `sm / md / lg / xl`：按内容量挑档；**不许出现"弹窗内滚动条撑破"**（挑大了比挑小了好）。

### 11.2 页脚与按钮位
- 四套页脚同规格：`.m-foot` / `.modal-foot` / `.panel-foot` / `.bldg-foot`（实线、同间距、flex 居中或两端）。
- 按钮惯例：**主操作在前**（`btn gold`）、关闭在后；纯关窗文案一律「关闭」。
- 「取消」只用于**中止一个动作**的确认框（取消建造 / 取消移动）；纯关闭不叫「取消」。
- 不可逆操作的确认框：主操作（`btn red`）+「取消」+ **必须逐项说清代价**。

### 11.3 建筑详情弹窗统一骨架（城内 / 城外 / 城墙 · 动线：使用 → 建设 → 管理）

```
[头部]   图标 40px ·「名称 · LvN」· 描述（居中）
[信息区] attr 行 —— 各建筑特有（功能多的建筑允许差异化：军营队列、作坊箭塔…）
[功能行] op-zone「功能」：使用建筑（金色主按钮，进功能面板）
[升级行] op-zone「升级」：费用（左）· 升级按钮（右）—— 费用与按钮**同行**
[底栏]   bldg-foot：拆毁（左）· 关闭（中）· 移动 / 交换（右）
```

- **施工中弹窗与正常态同构**（图标 + 名称 · Lv→Lv + 描述），危险操作（取消）进底栏。
- 底栏三格摆位延续 v28 的设计（拆毁左下、移动右下、中间留白防误点）——
  关闭按钮居中，正好充当误点缓冲。

### 11.4 操作命名（`BLDG_FUNC`）
- 格式：**图标 + 用途短语**；多功能面板写「用途A · 用途B」。
- **名字必须覆盖面板的全部内容**（点名不副实就是误导）：
  官府面板含征调民力 / 本城特产 / 岁贡 / 改名 → 入口叫「官府事务」，不叫「征收」。
- 反面检查表：入口名 ⊂ 面板功能 时，改（校场·出征与伤兵 → 出征 · 伤兵；名录 → 将领名录）。
"""


def main():
    smoke = io.open(SMOKE, 'rb').read().decode('utf-8')
    doc = io.open(DOC, 'rb').read().decode('utf-8')
    if '第 56 节：弹窗统一规范' in smoke and '## 11. 弹窗规范' in doc:
        print('· 已存在，跳过（幂等）')
        return 0
    crlf_s = smoke.count('\r\n')
    crlf_d = doc.count('\r\n')

    if '第 56 节：弹窗统一规范' not in smoke:
        if smoke.count(S55_TAIL_OLD) != 1:
            print('✗ smoke 锚点命中 %d 次' % smoke.count(S55_TAIL_OLD))
            return 1
        smoke = smoke.replace(S55_TAIL_OLD, S55_TAIL_NEW, 1)

    if '## 11. 弹窗规范' not in doc:
        if not doc.endswith('\n'):
            doc += '\n'
        doc += '\n' + DOC_ANCHOR_TAIL

    out_s = smoke.encode('utf-8')
    out_d = doc.encode('utf-8')
    if out_s.count(b'\r\n') != crlf_s or out_d.count(b'\r\n') != crlf_d:
        print('✗ 行尾被改写')
        return 1
    io.open(SMOKE, 'wb').write(out_s)
    io.open(DOC, 'wb').write(out_d)
    print('✓ 完成：smoke +第 56 节 | 设计规范 +§11')
    return 0


if __name__ == '__main__':
    sys.exit(main())
