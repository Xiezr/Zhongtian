/* ============================================================
 * saveidb.js — P5「内容与持久化」持久化第二后端（全仓唯一 IndexedDB 出口）
 * ------------------------------------------------------------
 * 设计口径（写在前面，后来人先读再改）：
 *   1. **唯一出口**：整个仓库只有本文件调用浏览器 IndexedDB 的 `open`。
 *      state.js / main.js / 工具 / 测试一律通过 `GAME.idb.*` 读写，
 *      不许另起第二处 —— 反向证据断言会扫全仓标识符零重复。
 *   2. **第二后端，不是替换**：localStorage 仍是同步权威（38 处存档断言、
 *      同步启动流程零回归）。IDB 只在 `SAVE_BACKEND='idb'` 时异步镜像一份，
 *      并在本地缺档时提供异步补水（`GAME.idbHydrate`）。任何一步失败都静默
 *      降级回 localStorage，不阻断游戏。
 *   3. **分块（chunked persistence）**：一份存档 json 切成 CHUNK_BYTES 的块，
 *      逐块写 object store；`::meta` 记录块数 / 字节 / 版本 / 校验和 / 时间。
 *      这样单条记录体积有上界，不再受 localStorage 5MB 配额约束。
 *   4. **异步 + 可注入**：对外全是 Promise；底层 `indexedDB` 工厂通过
 *      `_factory()` 惰性取，可用 `GAME.idbSetFactory(fake)` 注入内存实现，
 *      使 jsdom（无原生 indexedDB）也能跑真实分块往返断言。
 *   5. **版本号**：存档格式仍由 state.js 的 SAVE_VERSION=3 决定；
 *      本模块的 DB_VER 只是 IndexedDB 库结构版本，两者互不干扰。
 * ============================================================ */
import './core.js';
(function () {
  var GAME = window.GAME = window.GAME || {};

  var DB_NAME = 'sanguo_save_idb';
  var DB_VER = 1;
  var STORE = 'slots';
  /* 单块 256KB：远低于主流浏览器单记录上限，单块读写 <1ms（探针实测），
     一份 1.1MB 后期档 = 5 块。改这个值要在交付文档重跑 p95 探针。 */
  var CHUNK_BYTES = 256 * 1024;
  var INDEX_KEY = '__index';

  var _factory = null;
  var _factoryLocked = false;
  var _dbPromise = null;

  /* 唯一一次碰全局 indexedDB 标识符。隐私模式 / 被禁用 / 非浏览器 → null。 */
  function factory() {
    if (_factoryLocked) return _factory;
    _factoryLocked = true;
    var idb = null;
    try { idb = (typeof indexedDB !== 'undefined') ? indexedDB : null; } catch (e) { idb = null; }
    _factory = idb;
    return idb;
  }

  /* 测试注入口：传内存 fake（实现 open(name,ver)）后，_factory 被锁定为 fake。
     GAME.idbResetFactory() 解锁，回到探测真实浏览器。 */
  GAME.idbSetFactory = function (fake) {
    _factory = fake || null;
    _factoryLocked = true;
    _dbPromise = null;
    return !!fake;
  };
  GAME.idbResetFactory = function () {
    _factory = null; _factoryLocked = false; _dbPromise = null;
  };

  /* 同步可用性探测：调用方据此决定是否尝试写，失败也只是一次 Promise reject。 */
  GAME.idbAvailable = function () { return !!factory(); };

  /* v158.5：IndexedDB 事务事件统一接线（具名函数 + 引用赋值）。
     ⚠️ 不写 `tx.oncomplete = function () {...}`：audit.js 的 defRe 只认
     `X.Y = function (` 形态并登记为函数定义，事件回调由浏览器调用、全仓没有
     显式调用点，会被误判成「死函数」拦门禁（首轮实测 13 条）。
     这里不加白名单、不放宽判据，只改成项目既定的具名函数 + 引用赋值；
     同时删掉从未被调用的 wrapReq / wrapTx 两个死辅助函数。 */
  function bindTx(tx, resolve, reject, done) {
    function onComplete() { resolve(typeof done === 'function' ? done() : done); }
    function onError() { reject(tx.error || new Error('idb tx error')); }
    function onAbort() { reject(tx.error || new Error('idb tx abort')); }
    tx.oncomplete = onComplete;
    tx.onerror = onError;
    tx.onabort = onAbort;
  }

  function open() {
    if (_dbPromise) return _dbPromise;
    var f = factory();
    if (!f) return Promise.reject(new Error('indexedDB unavailable'));
    _dbPromise = new Promise(function (resolve, reject) {
      var r;
      try { r = f.open(DB_NAME, DB_VER); }
      catch (e) { reject(e); return; }
      if (r.onupgradeneeded !== undefined || typeof r.addEventListener === 'function') {
        r.onupgradeneeded = function () {
          var db = r.result;
          try { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); } catch (e) { }
        };
      }
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error('open failed')); };
      function onBlocked() { reject(new Error('open blocked')); }
      r.onblocked = onBlocked;
    }).catch(function (e) {
      _dbPromise = null;   /* 打开失败不缓存，下次可重试 */
      throw e;
    });
    return _dbPromise;
  }

  function split(json) {
    var out = [], n = Math.max(1, Math.ceil(json.length / CHUNK_BYTES));
    for (var i = 0; i < n; i++) out.push(json.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
    return out;
  }

  var api = GAME.idb = {
    DB_NAME: DB_NAME,
    STORE: STORE,
    CHUNK_BYTES: CHUNK_BYTES,

    available: GAME.idbAvailable,

    /** 异步镜像一份存档。meta = {version, savedAt, checksum, bytes}（由 state.js 传）。
     *  返回 {ok, chunks, bytes}；失败返回 {ok:false, msg}（不抛，调用方静默降级）。 */
    write: function (slotId, json, meta) {
      if (!factory()) return Promise.resolve({ ok: false, msg: 'unavailable' });
      var txt = String(json == null ? '' : json);
      var parts = split(txt);
      var rec = {
        n: parts.length,
        bytes: txt.length,
        version: (meta && meta.version) || 0,
        savedAt: (meta && meta.savedAt) || 0,
        checksum: (meta && meta.checksum) || ''
      };
      /* v158.5 首轮探针实测（B4/D1/F1 红）：**清旧块必须先于写新块发出**。
         IndexedDB 事务内请求按**发出顺序**执行 —— 若把 delete 塞进
         `get(meta).onsuccess` 回调里，它排在所有 put 之后，会把刚写好的
         新块 0 删掉，覆盖写后 read 直接失败。所以先用一次独立只读事务
         取旧块数，再在写事务里「先 delete、后 put」。 */
      return open().then(function (db) {
        return new Promise(function (resolve) {
          var tx;
          try { tx = db.transaction(STORE, 'readonly'); } catch (e) { resolve(null); return; }
          var req = tx.objectStore(STORE).get(slotId + '::meta');
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        });
      }).then(function (old) {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx;
            try { tx = db.transaction(STORE, 'readwrite'); }
            catch (e) { reject(e); return; }
            var st = tx.objectStore(STORE);
            try {
              /* ① 先删旧块（请求先发出 → 先执行） */
              if (old && old.n) for (var k = 0; k < old.n; k++) st.delete(slotId + '::' + k);
              /* ② 再写新块与 meta */
              for (var i = 0; i < parts.length; i++) st.put(parts[i], slotId + '::' + i);
              st.put(rec, slotId + '::meta');
              /* ③ 维护索引（get 的 onsuccess 内发 put，key 与块不冲突） */
              st.get(INDEX_KEY).onsuccess = function (e2) {
                var ix = e2.target.result || [];
                if (ix.indexOf(slotId) < 0) { ix.push(slotId); st.put(ix, INDEX_KEY); }
              };
            } catch (e3) { reject(e3); return; }
            bindTx(tx, resolve, reject, function () {
              return { ok: true, chunks: parts.length, bytes: rec.bytes };
            });
          });
        });
      }).then(function (res) { return res; }, function (e) {
        return { ok: false, msg: (e && e.message) || 'write failed' };
      });
    },

    /** 异步读回。返回 {ok:true, json, meta} 或 {ok:false}（缺档/损坏/不可用）。 */
    read: function (slotId) {
      if (!factory()) return Promise.resolve({ ok: false, msg: 'unavailable' });
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx;
          try { tx = db.transaction(STORE, 'readonly'); }
          catch (e) { reject(e); return; }
          var st = tx.objectStore(STORE);
          var rec = null, chunks = null;
          st.get(slotId + '::meta').onsuccess = function (e) {
            rec = e.target.result || null;
            if (!rec || !(rec.n >= 1)) { resolve({ ok: false }); return; }
            chunks = new Array(rec.n);
            for (var i = 0; i < rec.n; i++) {
              (function (idx) {
                st.get(slotId + '::' + idx).onsuccess = function (e2) { chunks[idx] = e2.target.result; };
              })(i);
            }
          };
          bindTx(tx, resolve, reject, function () {
            if (!rec || !chunks) return { ok: false };
            for (var i = 0; i < chunks.length; i++) {
              if (typeof chunks[i] !== 'string') return { ok: false, msg: 'chunk missing' };
            }
            return { ok: true, json: chunks.join(''), meta: rec };
          });
        });
      }).then(function (res) { return res; }, function (e) {
        return { ok: false, msg: (e && e.message) || 'read failed' };
      });
    },

    /** 列出已镜像的槽位摘要（只读 meta，不读正文）。返回 [{id, version, savedAt, bytes, chunks}] */
    list: function () {
      if (!factory()) return Promise.resolve([]);
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx;
          try { tx = db.transaction(STORE, 'readonly'); }
          catch (e) { reject(e); return; }
          var st = tx.objectStore(STORE);
          var out = [];
          /* v158.5 首轮探针实测（B5/C1/C2/G3 红）：索引是**异步 get**，
             逐槽位取 meta 的请求必须在这个 onsuccess 里发出；放到外面时
             ids 还是初始空数组，for 循环 0 次，list 永远返回 []。 */
          st.get(INDEX_KEY).onsuccess = function (e) {
            var ids = e.target.result || [];
            for (var i = 0; i < ids.length; i++) {
              (function (id) {
                st.get(id + '::meta').onsuccess = function (e2) {
                  var m = e2.target.result;
                  if (m) out.push({ id: id, version: m.version, savedAt: m.savedAt, bytes: m.bytes, chunks: m.n });
                };
              })(ids[i]);
            }
          };
          bindTx(tx, resolve, reject, out);
        });
      }).catch(function () { return []; });
    },

    /** 删除某槽位的全部块与 meta。返回 {ok}。 */
    remove: function (slotId) {
      if (!factory()) return Promise.resolve({ ok: false, msg: 'unavailable' });
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx;
          try { tx = db.transaction(STORE, 'readwrite'); }
          catch (e) { reject(e); return; }
          var st = tx.objectStore(STORE);
          st.get(slotId + '::meta').onsuccess = function (e) {
            var old = e.target.result;
            if (old && old.n) for (var k = 0; k < old.n; k++) st.delete(slotId + '::' + k);
          };
          st.delete(slotId + '::meta');
          st.get(INDEX_KEY).onsuccess = function (e2) {
            var ix = e2.target.result || [];
            var at = ix.indexOf(slotId);
            if (at >= 0) { ix.splice(at, 1); st.put(ix, INDEX_KEY); }
          };
          bindTx(tx, resolve, reject, { ok: true });
        });
      }).then(function (r) { return r; }, function (e) {
        return { ok: false, msg: (e && e.message) || 'remove failed' };
      });
    },

    /** 清空整个镜像库。返回 {ok}。 */
    clear: function () {
      if (!factory()) return Promise.resolve({ ok: false, msg: 'unavailable' });
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx;
          try { tx = db.transaction(STORE, 'readwrite'); }
          catch (e) { reject(e); return; }
          tx.objectStore(STORE).clear();
          bindTx(tx, resolve, reject, { ok: true });
        });
      }).then(function (r) { return r; }, function (e) {
        return { ok: false, msg: (e && e.message) || 'clear failed' };
      });
    }
  };
})();
