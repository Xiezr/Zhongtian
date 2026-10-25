/* ============================================================
 * main.js — 启动、接线、开场
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.DATA;
  var ST = global.STATE;
  var EN = global.ENGINE;
  var UI = global.UI;

  var SEEN_KEY = 'new-wasteland-seen-v1';
  var booted = false;

  function boot() {
    if (booted) return;          /* 防重复启动（DOMContentLoaded 与手动调用可能都触发） */
    booted = true;

    var s = ST.load();
    if (!s) s = ST.newWorld(20261021);

    UI.renderAll();
    wire();

    /* 开局自动选中第一支队伍：让「能走多远」这个菱形直接显示出来，
       不用教程，玩家自己就看见了规则。 */
    var first = s.teams.filter(function (t) { return t.status !== 'dead'; })[0];
    if (first) UI.selectTeam(first.id);

    var seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { /* ignore */ }
    if (!seen) showIntro();
  }

  /* ---------- 开场：四句话 ---------- */
  function showIntro() {
    var box = document.createElement('div');
    box.className = 'intro';
    box.innerHTML =
      '<p>第 1 年。灰岗。</p>' +
      '<p>灯还亮着，因为还有人在加油。</p>' +
      '<p>外面是黑的。没有人知道那里面有什么。</p>' +
      '<p>——点一下，开始</p>';
    document.body.appendChild(box);

    box.onclick = function () {
      box.classList.add('gone');
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* ignore */ }
      setTimeout(function () { box.remove(); }, 700);
    };
  }

  /* ---------- 按钮与快捷键 ---------- */
  function wire() {
    document.querySelectorAll('[data-adv]').forEach(function (b) {
      b.onclick = function () {
        var n = parseInt(b.dataset.adv, 10) || 1;
        EN.advance(n);
        UI.renderAll();
        if (!UI.maybeShowStory()) { if (!UI.maybeShowEnvoy()) UI.maybeShowEvent(); }
      };
    });

    var rec = document.getElementById('btnRecruit');
    if (rec) rec.onclick = function () {
      var r = EN.recruitTeam();
      if (!r.ok) UI.toast(r.msg); else UI.toast('新队成立');
      UI.renderAll();
    };

    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      var s = ST.S();
      if (!s) return;

      if (e.code === 'Space') {
        e.preventDefault();
        EN.advance(1);
        UI.renderAll();
        if (!UI.maybeShowStory()) { if (!UI.maybeShowEnvoy()) UI.maybeShowEvent(); }
      } else if (e.key === '8') {
        EN.advance(8);
        UI.renderAll();
        if (!UI.maybeShowStory()) { if (!UI.maybeShowEnvoy()) UI.maybeShowEvent(); }
      } else if (e.key === 'r' || e.key === 'R') {
        var t = s.teams.filter(function (x) { return x.status === 'out'; })[0];
        if (t) { EN.retreatHome(t); UI.renderAll(); }
      } else if (e.key === 'Escape') {
        UI.selectTeam(null);
      }
    });

    /* 自动存档：每次动作后 800ms 落盘 */
    var timer = null;
    var obs = function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { ST.save(); }, 800);
    };
    document.addEventListener('click', obs, true);
    document.addEventListener('keydown', obs, true);
  }

  /* 对外暴露：浏览器会走 DOMContentLoaded，测试可以手动 BOOT() */
  global.BOOT = boot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
