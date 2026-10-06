# v89.213 补丁 E（e2e）：① §204① 标题措辞更新（三栏 → 三段，判据不变）
#   ② §212e 段后插入 §213e（底栏形态 · 商场场景 · jsdom 管结构，几何交实机）
import io

P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

# ---- E1: §204① 标题（结构判据不变，措辞随口径） ----
rep('E1 §204① 标题',
    "      check('§204① 分页条三栏（左导航/中页码/右导航 · 页码文本在册 · 两端可翻）',",
    "      check('§204① 分页条三段（左导航/中页码/右导航 · 页码文本在册 · 两端可翻 · v89.213 整体居中）',")

# ---- E2: 插入 §213e 段 ----
frag = """
  /* ============================================================
   * §213e（v89.213 · 老板）：分页条「整体居中」——底栏真渲染（商场场景）
   *   jsdom 无布局引擎（rect 恒 0）→ 几何（居中 / 不重叠）交实机；
   *   e2e 管结构与真点：底栏三段齐 + 「隐藏名称/指挥战斗」+ 缩略图同屏 +
   *   底栏「下页」真点生效 + 弹窗出口同款。
   * ============================================================ */
  console.log('\\n--- §213e. v89.213 分页条整体居中（真实 DOM） ---');
  {
    try {
      /* ① 底栏（商场）：三段齐 + bb-tools 两按钮 / 缩略图同屏 */
      G.ui.closeAllModals();
      G.ui.setView('shop');
      await sleep(200);
      const bar213 = document.getElementById('bottom-bar');
      const pg213 = bar213.querySelector('.pager');
      const l213 = pg213 && pg213.querySelector('.pg-side.l');
      const m213 = pg213 && pg213.querySelector('.pg-info');
      const r213 = pg213 && pg213.querySelector('.pg-side.r');
      const tools213 = bar213.querySelector('.bb-tools');
      const lbl213 = bar213.querySelector('.bb-label-toggle');
      const war213 = bar213.querySelector('.bb-war');
      const mini213 = bar213.querySelector('.bb-mini');
      check('§213e① 底栏分页三段齐（l → 页码 → r）·「隐藏名称/指挥战斗」/ 缩略图同屏',
        !!pg213 && !!l213 && !!m213 && !!r213 && (m213.textContent || '').indexOf('页') >= 0
        && !!tools213 && !!lbl213 && !!war213 && !!mini213,
        'pg=' + !!pg213 + ' l=' + !!l213 + ' m=' + !!m213 + ' r=' + !!r213
        + ' tools=' + !!tools213 + ' lbl=' + !!lbl213 + ' war=' + !!war213 + ' mini=' + !!mini213);

      /* ② 底栏「下页」真点生效（1 → 2） */
      G.ui._pages['shop-items'] = 1;
      const nx213 = r213 ? r213.querySelector('[data-action="page"]') : null;
      let pgAfter213 = 1;
      if (nx213) { nx213.click(); await sleep(180); pgAfter213 = G.ui._pages['shop-items'] || 1; }
      check('§213e② 底栏「下页」真点生效（1 → 2 · 底栏重绘后仍在册）',
        !nx213 || (pgAfter213 === 2 && !!document.querySelector('#bottom-bar .pager .pg-info')),
        'after=' + pgAfter213 + ' hasPager=' + !!document.querySelector('#bottom-bar .pager'));

      /* ③ 弹窗出口（modalPagerHTML）三段同款 */
      G.ui.setView('city');
      G.ui.closeAllModals();
      G.ui.openModal(G.ui.modalPagerHTML('e213m', 100, 10), { title: 'T213' });
      await sleep(180);
      const mp213 = document.querySelector('#modal-root .pager');
      check('§213e③ 弹窗分页三段同款（l / 页码 / r 齐 · 页码文本在册）',
        !!mp213 && !!mp213.querySelector('.pg-side.l') && !!mp213.querySelector('.pg-info')
        && !!mp213.querySelector('.pg-side.r') && (mp213.textContent || '').indexOf('第 1/10 页') >= 0,
        mp213 ? (mp213.textContent || '').slice(0, 60) : 'null');
      G.ui.closeAllModals();
      await sleep(100);
    } catch (e213e) {
      check('§213e 段异常', false, String(e213e && e213e.message || e213e));
    }
  }

"""
anchor = "\n  return finish();"
assert s.count(anchor) == 1, 'anchor count=' + str(s.count(anchor))
assert '§213e' not in s, '§213e already present'
s = s.replace(anchor, frag + anchor)
print('[ok] E2 §213e 段插入')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
