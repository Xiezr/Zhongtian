/* ============================================================
 * ui-fx.js　反馈层 · 里程碑演出 / 通知 / 浮字 / 音效 / 场景层
 * ------------------------------------------------------------
 * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序
 *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。
 * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。
 * ============================================================ */
import './ui.js';
(function () {
  var GAME = window.GAME;
  var DATA = GAME.DATA, U = GAME.utils;
  var ui = GAME.ui;
  var $ = ui._dom.$, $$ = ui._dom.$$;

  /* ============================================================
   * v89.93（整改 E5）：**里程碑演出层** —— ui.moment(spec)
   * ------------------------------------------------------------
   * 改前：全站唯一有演出的地方是荒野剧本；攻占城市/威望晋升/时代之志
   *       全部只有一行日志（"重大时刻零演出"）。
   * 三档：inline（横幅条 2.2s 自动过）· card（居中卡，手动关）·
   *       full（全屏，手动关）。全部复用既有令牌与金色系，不新增素材。
   * 铁律：① 不阻塞操作（inline 可点穿；card/full 可 Esc / 点关闭）；
   *       ② 内容全部来自调用方传入的既有出口数据，不写死字面量。
   * ============================================================ */
  ui._momentTimer = null;
  ui.momentClose = function () {
    clearTimeout(ui._momentTimer);
    var fx = document.getElementById('moment-fx');
    if (fx) { fx.className = ''; fx.innerHTML = ''; }
  };
  ui.moment = function (spec) {
    spec = spec || {};
    var kind = spec.kind || 'inline';
    var fx = document.getElementById('moment-fx');
    if (!fx) {
      fx = document.createElement('div');
      fx.id = 'moment-fx';
      var _root150c = ui.layerRoot();
      if (_root150c && _root150c.appendChild) _root150c.appendChild(fx);
    }
    var head = (spec.icon ? '<span class="mo-ico">' + spec.icon + '</span>' : '') +
      '<span class="mo-title">' + U.escape(spec.title || '') + '</span>';
    var sub = spec.sub ? '<div class="mo-sub">' + U.escape(spec.sub) + '</div>' : '';
    var body = (spec.lines && spec.lines.length)
      ? '<div class="mo-lines">' + spec.lines.map(function (t) { return '<div>' + U.escape(t) + '</div>'; }).join('') + '</div>' : '';
    var foot = (kind === 'inline')
      ? ''
      : '<div class="mo-foot"><button class="btn sm gold" data-action="moment-close">知道了</button></div>';
    fx.className = 'mo mo-' + kind;
    fx.innerHTML = '<div class="mo-box mo-box-' + kind + '"><div class="mo-head">' + head + '</div>' + sub + body + foot + '</div>';
    clearTimeout(ui._momentTimer);
    if (kind === 'inline') {
      ui._momentTimer = setTimeout(function () { ui.momentClose(); }, (spec.ms) || 2200);
    }
    return fx;
  };

  /* ============================================================
   * v89.93（整改 E4）：**反馈分层** —— 四型通知 + 数值浮字 + 程序化音效
   * ------------------------------------------------------------
   * 改前：全站只有一个 toast（单元素、textContent 直接覆盖、2200ms、无类型/队列），
   *       连续操作时后一条吃掉前一条，成功与失败长得一模一样；且**全站零音效**。
   * 现在：① ui.notify(type,msg) 四型（success/info/warn/danger）+ 最多 3 条堆叠；
   *       ② ui.floatGain(el, delta) 数值上浮；③ GAME.audio.play(key) Web Audio 合成。
   * 旧入口 ui.toast 保留为 info 的别名 —— 200+ 调用点零迁移。
   * ============================================================ */
  ui._notes = [];
  ui.notify = function (type, msg, opt) {
    type = (['success', 'info', 'warn', 'danger'].indexOf(type) >= 0) ? type : 'info';
    msg = String(msg == null ? '' : msg);
    /* v89.207（老板 1·快赢③）：**相邻同文案合并** —— 连续同类操作（连点加兵/连点快购）
       不再刷出多条重复行，合并为「msg（×N）」（上限 3 条队列照旧；跨类型不合并）。
       渲染层：n.n > 1 才带计数后缀 —— 单条场景与旧观感逐字一致。 */
    var _lastN = ui._notes[ui._notes.length - 1];
    if (_lastN && _lastN.msg === msg && _lastN.type === type) {
      _lastN.n = (_lastN.n || 1) + 1;
    } else {
      ui._notes.push({ type: type, msg: msg, n: 1 });
    }
    var keep = (opt && opt.keep) || 3;
    while (ui._notes.length > keep) ui._notes.shift();
    var el = $('#toast');
    el.innerHTML = ui._notes.map(function (n) {
      return '<div class="toast-line t-' + n.type + '">' + U.escape(n.msg) +
        (n.n > 1 ? '（×' + n.n + '）' : '') + '</div>';
    }).join('');
    /* v89.203（老板 1）：弹窗打开 → 提示条上浮到屏幕中上部（不挡底部操作键）；
       无弹窗 → 保持底部（原习惯不变）。判定 = 模态元素在册且仍在文档中。 */
    el.classList.toggle('high', !!(ui._maskEl && ui._maskEl.isConnected));
    el.classList.add('show');
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(function () {
      el.classList.remove('show');
      ui._notes = [];
    }, (opt && opt.ms) || 2200);
  };
  /* 兼容别名：旧调用点（200+）一律走 info 型 */
  ui.toast = function (msg) { ui.notify('info', msg); };

  /* ============================================================
   * v2026-11-01（老板）：**场景层** —— 前传（Lv1-20）的"在场感"
   * ------------------------------------------------------------
   * 旧的升级/移动反馈只有两样：一行 ✨ 日志、一句"走到 X 了"的 toast。
   * 老板原话：「进入一个具体的场景，而不是玩文字游戏」。
   * 所以加一层**独立于系统 toast 的场景层**（不阻塞玩法、自动消散、无滚动条）：
   *   · ui.sceneCaption(text)        —— 移动时一条感官化的"沿途"字幕；
   *   · ui.levelUpScene(gen,f,to,s) —— 升级不再是文字，是一张会亮一下的"瞬间卡"。
   * 常量全部进 DATA.SCENE（见 data.js），此处只引用不写死。
   * ============================================================ */
  (function () {
    var U = GAME.utils;
    ui._sceneHost = function () {
      var h = document.getElementById('scene-layer');
      if (!h) {
        h = document.createElement('div');
        h.id = 'scene-layer';
        h.className = 'scene-layer';
        (document.body || document.documentElement).appendChild(h);
      }
      return h;
    };
    ui.sceneCaption = function (text, opt) {
      if (!text) return;
      var host = ui._sceneHost();
      var d = document.createElement('div');
      d.className = 'scene-caption';
      d.textContent = text;
      host.appendChild(d);
      /* 双 rAF 确保过渡触发（首帧先有起始态）*/
      requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add('show'); }); });
      var ms = ((GAME.DATA && GAME.DATA.SCENE && GAME.DATA.SCENE.captionMs) || 2600);
      setTimeout(function () {
        d.classList.remove('show');
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 600);
      }, ms);
    };
    ui._luTimer = null;
    ui.levelUpScene = function (gen, from, to, step) {
      if (!gen) return;
      var stage = document.getElementById('levelup-stage');
      if (!stage) {
        stage = document.createElement('div');
        stage.id = 'levelup-stage';
        stage.className = 'levelup-stage';
        (document.body || document.documentElement).appendChild(stage);
      }
      var name = gen.name || '无名';
      var rank = (GAME.rankOf ? (GAME.rankOf(gen) || {}).name : '') || '';
      var lines = ((GAME.DATA && GAME.DATA.SCENE && GAME.DATA.SCENE.levelLine) || { _: '这一刻，废土记得你的名字。' });
      var lv = (lines[rank] || lines._ || '这一刻，废土记得你的名字。');
      stage.innerHTML =
        '<div class="levelup-card">' +
          '<div class="lu-name">' + U.escape(name) + '</div>' +
          '<div class="lu-lv">Lv <b>' + from + '</b> → <b>' + to + '</b>' + (rank ? '　·　' + U.escape(rank) : '') + '</div>' +
          '<div class="lu-delta">实力 +' + (step || 0) + '（自动加点）</div>' +
          '<div class="lu-line">' + U.escape(lv) + '</div>' +
        '</div>';
      stage.classList.add('show');
      if (ui._luTimer) clearTimeout(ui._luTimer);
      var ms = ((GAME.DATA && GAME.DATA.SCENE && GAME.DATA.SCENE.levelUpMs) || 2600);
      ui._luTimer = setTimeout(function () { stage.classList.remove('show'); }, ms);
      if (GAME.sfx) GAME.sfx('levelup');
    };
  })();

  /* v89.93（E4）：数值浮字 —— el 可为元素或选择器；delta 正绿负红 */
  ui.floatGain = function (el, delta, opt) {
    if (!delta) return;
    var host = (typeof el === 'string') ? $(el) : el;
    if (!host || !host.getBoundingClientRect || !document.body) return;
    try {
      var r = host.getBoundingClientRect();
      var d = document.createElement('div');
      d.className = 'float-gain' + (delta < 0 ? ' neg' : '');
      d.textContent = (delta > 0 ? '+' : '') + GAME.utils.fmt(Math.abs(delta) === delta ? delta : delta);
      /* v89.150（老板 2）：浮字在画布坐标系里 absolute 定位 → rect 先换算成画布坐标 */
      var _p150 = ui.toCanvasXY(r.left + r.width / 2, r.top);
      d.style.left = Math.round(_p150.x) + 'px';
      d.style.top = Math.round(_p150.y) + 'px';
      var _root150b = ui.layerRoot();
      if (!_root150b || !_root150b.appendChild) return;
      _root150b.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, (opt && opt.ms) || 950);
    } catch (e) { /* 浮字永不阻塞玩法 */ }
  };

  /* ------------------------------------------------------------
   * v89.93（E4）：程序化音效（零素材 · Web Audio 合成）
   * ------------------------------------------------------------
   * 与项目"程序化绘制地图/场景"同一条路线：oscillator + envelope，不落任何素材文件。
   * · 音频不可用（无 AudioContext / 被策略拦截 / 用户关了）→ **静默降级**，不抛错、不影响玩法
   * · 开关与音量入档：settings.sfx（默认开）/ settings.sfxVol（默认 0.5）
   * ------------------------------------------------------------ */
  GAME.audio = (function () {
    var AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext || null) : null;
    var ctx = null;
    /* 音符表：[频率, 时长秒, 波形] —— 一句 1~3 个音，克制、不聒噪 */
    var SPEC = {
      click:   [[660, 0.05, 'triangle']],
      build:   [[520, 0.07, 'triangle'], [780, 0.09, 'triangle']],
      train:   [[300, 0.07, 'sawtooth'], [420, 0.08, 'sawtooth']],
      march:   [[240, 0.09, 'sine'], [180, 0.12, 'sine']],
      win:     [[523, 0.09, 'triangle'], [659, 0.09, 'triangle'], [784, 0.16, 'triangle']],
      lose:    [[392, 0.12, 'sawtooth'], [262, 0.20, 'sawtooth']],
      levelup: [[659, 0.07, 'triangle'], [880, 0.12, 'triangle']],
      rank:    [[523, 0.08, 'sine'], [659, 0.08, 'sine'], [880, 0.08, 'sine'], [1046, 0.18, 'sine']],
      alarm:   [[440, 0.13, 'square'], [330, 0.13, 'square'], [440, 0.13, 'square']],
    };
    function on() {
      var s = GAME.state;
      if (s && s.settings && s.settings.sfx === false) return false;
      return true;
    }
    function vol() {
      var s = GAME.state;
      var v = (s && s.settings && s.settings.sfxVol != null) ? s.settings.sfxVol : 0.5;
      return Math.max(0, Math.min(1, Number(v) || 0));
    }
    return {
      keys: function () { return Object.keys(SPEC); },
      available: function () { return !!AC; },
      play: function (key) {
        try {
          if (!on()) return false;
          var spec = SPEC[key];
          if (!spec) return false;
          if (!AC) return false;
          if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
          if (!ctx) return false;
          if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e2) {} }
          var start = ctx.currentTime + 0.01, v = vol() * 0.22;
          for (var i = 0; i < spec.length; i++) {
            var n = spec[i];
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = n[2] || 'triangle';
            o.frequency.value = n[0];
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), start + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, start + n[1]);
            o.connect(g); g.connect(ctx.destination);
            o.start(start); o.stop(start + n[1] + 0.02);
            start += n[1] + 0.03;
          }
          return true;
        } catch (e) { return false; }   /* 音频永不影响玩法 */
      }
    };
  })();
  /* 便捷播放入口（调用点一律走它，缺失时静默） */
  ui.sfx = function (key) { try { if (GAME.audio) GAME.audio.play(key); } catch (e) {} };
  GAME.sfx = ui.sfx;   /* 域层（state/battle/systems）调用入口 —— 音频永不阻塞玩法 */

})();
