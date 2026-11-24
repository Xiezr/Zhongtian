/* P5 IndexedDB 迁移探针（v158.5）
 * 判据全部对齐总计划 P5 §4 验收原文，不自造标准：
 *   A 唯一出口：全仓源码 indexedDB 只在 saveidb.js、唯一 .open 调用、默认 local
 *   B 分块：写 >5MB 档（突破 5MB 天花板）/ 逐字读回 / 覆盖写清旧块 / list+remove
 *   C 双写：saveTo / saveGame 真镜像且 json 逐字一致、同步返回不阻塞、local 不介入
 *   D 双读：删本地档补水 / v3 老档迁入 / 校验和损坏拒绝 / 缺块拒绝 / 版本闸
 *   E 降级：IDB 不可用时 available=false、write/read 不抛、hydrate 返回 null、reset 自愈
 *   F 切换后端 20 次无数据丢失
 *   G 反向证据：派生字段 0 入档 / P0~P4 逐字仍在 / dropSlot 清镜像
 *   H 无页面异常
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/saveidb_probe.js > .workbuddy/tmp/saveidb_probe.log 2>&1
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  /* ---- A2/A3：源码层唯一出口（node 侧扫，排除生成产物）---- */
  const JS = path.join(ROOT, 'js');
  const srcFiles = fs.readdirSync(JS).filter((f) =>
    f.endsWith('.js') && !/^bundle-/.test(f) && f !== 'ui-all.js');
  const withIdb = srcFiles.filter((f) =>
    /indexedDB/.test(fs.readFileSync(path.join(JS, f), 'utf8')));
  const idbSrc = fs.readFileSync(path.join(JS, 'saveidb.js'), 'utf8');
  const openCalls = (idbSrc.match(/\.open\(/g) || []).length;

  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.idb && window.GAME.savePayload', null, { timeout: 30000 });

  /* 隔离被测变量：临时停用自动存档（探针环境，不动产品代码），并清空镜像库。 */
  await p.evaluate(async () => {
    GAME.__p5Auto = GAME.autoSave;
    GAME.autoSave = function () { return { ok: true, msg: 'probe-stubbed' }; };
    GAME.newGame({ name: 'p5', cityName: '灰岗', mapSeed: 20261124 });
    GAME.ui.enterGame();
    await GAME.idb.clear();
    GAME.setSaveBackend('local');
    window.__p5 = {};
  });

  /* 等待"镜像落盘"的轮询 helper（fire-and-forget 是异步的） */
  const waitMirror = (sid) => p.evaluate(async (id) => {
    for (let i = 0; i < 80; i++) {
      const l = await GAME.idbList();
      if (l.some((x) => x.id === id)) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    return false;
  }, sid);
  const waitGone = (sid) => p.evaluate(async (id) => {
    for (let i = 0; i < 80; i++) {
      const l = await GAME.idbList();
      if (!l.some((x) => x.id === id)) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    return false;
  }, sid);

  /* ---- A. 唯一出口 / 接口 / 默认 ---- */
  const a = await p.evaluate(() => ({
    native: typeof indexedDB !== 'undefined',
    avail: GAME.idbAvailable(),
    keys: Object.keys(GAME.idb || {}),
    backend: GAME.SAVE_BACKEND,
    chunk: GAME.idb.CHUNK_BYTES,
    version: GAME.VERSION,
    sv: GAME.savePayload() ? JSON.parse(GAME.savePayload()).version : -1
  }));
  ok('A1 原生 IndexedDB 可用 + 接口齐全 + 默认 local（v158.4 行为不变）',
    a.native && a.avail && a.backend === 'local' && a.chunk === 256 * 1024
    && ['write', 'read', 'list', 'remove', 'clear', 'available'].every((k) => a.keys.indexOf(k) >= 0),
    'backend=' + a.backend + ' chunk=' + a.chunk + ' ver=' + a.version + ' saveVer=' + a.sv);
  ok('A2 反向证据：全仓源码 indexedDB 只出现在 saveidb.js',
    withIdb.length === 1 && withIdb[0] === 'saveidb.js',
    '命中文件=[' + withIdb.join(',') + '] 扫描 ' + srcFiles.length + ' 个源文件');
  ok('A3 反向证据：唯一 .open 调用（无第二处 indexedDB.open）', openCalls === 1,
    'openCalls=' + openCalls);
  const a3 = await p.evaluate(() => {
    const s = GAME.idbMirror.toString() + GAME.idbHydrate.toString();
    return /GAME\.idb\.write\(/.test(s) && /GAME\.idb\.read\(/.test(s)
      && /adoptState/.test(s) && /checksum/.test(s);
  });
  ok('A4 双写/双读都只经 GAME.idb 出口 + 复用 adoptState/checksum', a3);

  /* ---- B. 分块 + 突破 5MB 天花板 ---- */
  const b1 = await p.evaluate(async () => {
    const big = JSON.stringify({ version: 3, pad: 'x'.repeat(5 * 1024 * 1024 + 123457) });
    const w = await GAME.idb.write('__big', big, { version: 3, savedAt: 1, checksum: 'x' });
    const r = await GAME.idb.read('__big');
    return { w, bytes: big.length, same: r.ok && r.json === big,
      chunks: r.ok ? r.meta.n : -1, rbytes: r.ok ? r.meta.bytes : -1 };
  });
  ok('B1 写 5MB+ 档成功且真分块（非 0 平凡解）',
    b1.w.ok && b1.w.chunks >= 20 && b1.bytes > 5 * 1024 * 1024,
    'bytes=' + b1.bytes + ' chunks=' + b1.w.chunks);
  ok('B2 分块读回逐字相等（===，非长度近似）', b1.same && b1.rbytes === b1.bytes,
    'same=' + b1.same + ' metaBytes=' + b1.rbytes);
  const b3 = await p.evaluate(async () => {
    const r = await GAME.idb.read('__big');
    const m = r.meta || {};
    return { n: m.n, bytes: m.bytes, version: m.version, savedAt: m.savedAt, checksum: m.checksum };
  });
  ok('B3 ::meta 五字段齐全（n/bytes/version/savedAt/checksum）',
    b3.n >= 20 && b3.bytes > 5 * 1024 * 1024 && b3.version === 3
    && b3.savedAt === 1 && typeof b3.checksum === 'string', JSON.stringify(b3));
  const b4 = await p.evaluate(async () => {
    const w = await GAME.idb.write('__big', 'SHORT', { version: 3, savedAt: 2, checksum: 'y' });
    const r = await GAME.idb.read('__big');
    return { chunks: w.chunks, same: r.ok && r.json === 'SHORT', n: r.ok ? r.meta.n : -1 };
  });
  ok('B4 覆盖写清旧块（chunks 20+ → 1，读回为新文本）',
    b4.chunks === 1 && b4.same && b4.n === 1, JSON.stringify(b4));
  const b5 = await p.evaluate(async () => {
    const l1 = await GAME.idbList();
    const seen = l1.some((x) => x.id === '__big');
    const rm = await GAME.idb.remove('__big');
    const r = await GAME.idb.read('__big');
    const l2 = await GAME.idbList();
    return { seen, rm: rm.ok, gone: !r.ok, notListed: !l2.some((x) => x.id === '__big') };
  });
  ok('B5 list 可见 / remove 后读不到且索引同步摘除',
    b5.seen && b5.rm && b5.gone && b5.notListed, JSON.stringify(b5));

  /* ---- C. 双写镜像：真存档路径 ---- */
  const c1 = await p.evaluate(() => {
    GAME.setSaveBackend('idb');
    return GAME.saveTo('s1');
  });
  const c1seen = await waitMirror('s1');
  const c1r = await p.evaluate(async () => {
    const r = await GAME.idb.read('s1');
    const local = localStorage.getItem(GAME.slotOf('s1').key);
    return { ok: r.ok, same: r.ok && r.json === local, localLen: (local || '').length };
  });
  ok('C1 saveTo 真镜像且 json 与 localStorage 逐字一致',
    c1.ok && c1seen && c1r.ok && c1r.same && c1r.localLen > 100,
    'size=' + c1.size + ' seen=' + c1seen + ' same=' + c1r.same);
  const c2 = await p.evaluate(() => GAME.saveGame());
  const c2seen = await waitMirror('main');
  const c2r = await p.evaluate(async () => {
    const r = await GAME.idb.read('main');
    const local = localStorage.getItem(GAME.slotOf('main').key);
    return { ok: r.ok, same: r.ok && r.json === local };
  });
  ok('C2 saveGame（主档）同样镜像且逐字一致', c2 && c2seen && c2r.ok && c2r.same,
    'seen=' + c2seen + ' same=' + c2r.same);
  const c3 = await p.evaluate(() => {
    const t0 = performance.now();
    const r = GAME.saveTo('s2');
    const dt = performance.now() - t0;
    return { ok: r.ok, dt: +dt.toFixed(3), isPromise: !!(r && r.then) };
  });
  ok('C3 异步镜像不阻塞：saveTo 同步返回且 <16.7ms',
    c3.ok && !c3.isPromise && c3.dt < 16.7, 'dt=' + c3.dt + 'ms');
  await waitMirror('s2');
  const c4 = await p.evaluate(async () => {
    await GAME.idb.clear();
    GAME.setSaveBackend('local');
    const r = GAME.saveTo('s3');
    const mirror = GAME.idbMirror('s3', '{}', GAME.state);   /* 同步闸门，确定的契约 */
    const l = await GAME.idbList();
    return { ok: r.ok, mirror: mirror, listed: l.length };
  });
  ok('C4 默认 local 不介入镜像（idbMirror 同步返回 false，库保持空）',
    c4.ok && c4.mirror === false && c4.listed === 0, JSON.stringify(c4));

  /* ---- D. 双读 / v3 迁入 / 损坏拒绝 ---- */
  const d0 = await p.evaluate(() => {
    /* 显式落一个已知位姿，给「读回位姿一致」一个确定基准（非平凡解）：
       _avatar 由 P0 惰性补齐，取样时刻不同会让基准变成 'none'。 */
    if (!GAME.state._avatar) GAME.state._avatar = {};
    GAME.state._avatar.dir = [0.25, 0.5, 0.75];
    GAME.state._avatar.h = 0;
    GAME.state._avatar.yaw = 0.25;
    const st = JSON.parse(GAME.savePayload());
    window.__p5.base = {
      cities: (st.cities || []).length,
      gens: (st.generals || []).length,
      dir: st._avatar ? JSON.stringify(st._avatar.dir) : 'none',
      ruler: (st.ruler || {}).name || ''
    };
    return window.__p5.base;
  });
  const d1 = await p.evaluate(async () => {
    GAME.setSaveBackend('idb');
    GAME.saveTo('main');
    const raw = GAME.savePayload();                       /* 现版 v3 结构存档 */
    await GAME.idb.write('main', raw, { version: 3, savedAt: 3, checksum: GAME.checksum(raw) });
    localStorage.removeItem(GAME.slotOf('main').key);   /* 模拟本地档丢失 */
    const st = await GAME.idbHydrate('main');
    return { got: !!st, ver: st ? st.version : -1,
      cities: st ? (st.cities || []).length : -1,
      gens: st ? (st.generals || []).length : -1,
      dir: st && st._avatar ? JSON.stringify(st._avatar.dir) : 'none',
      isPromise: !!(st && st.then) };
  });
  ok('D1 删本地档后补水成功：v3 结构 / 城市·将领·位姿逐项一致',
    d0.dir !== 'none' && d1.got && !d1.isPromise && d1.ver === 3 && d1.cities === d0.cities
    && d1.gens === d0.gens && d1.dir === d0.dir,
    JSON.stringify(d1) + ' base=' + JSON.stringify(d0));
  const d2 = await p.evaluate(async () => {
    const raw = GAME.savePayload();
    await GAME.idb.write('main', raw, { version: 3, savedAt: 4, checksum: 'deadbeef' });
    const st = await GAME.idbHydrate('main');
    return st === null;
  });
  ok('D2 校验和损坏 → 拒绝补水（返回 null，不吞坏档）', d2 === true, 'null=' + d2);
  const d3 = await p.evaluate(async () => {
    const big = 'y'.repeat(300 * 1024);
    await GAME.idb.write('__hole', big, { version: 3, savedAt: 5, checksum: 'z' });
    const before = await GAME.idb.read('__hole');
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open(GAME.idb.DB_NAME, 1);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(GAME.idb.STORE, 'readwrite');
      tx.objectStore(GAME.idb.STORE).delete('__hole::1');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    const after = await GAME.idb.read('__hole');
    return { beforeN: before.ok ? before.meta.n : -1, afterOk: after.ok, msg: after.msg || '' };
  });
  ok('D3 缺块 → read 明确失败（不拼坏档）',
    d3.beforeN >= 2 && d3.afterOk === false, JSON.stringify(d3));
  const d4 = await p.evaluate(async () => {
    const bad = JSON.stringify({ version: 999, cities: [], generals: [] });
    await GAME.idb.write('main', bad, { version: 999, savedAt: 6, checksum: GAME.checksum(bad) });
    const st = await GAME.idbHydrate('main');
    return st === null;
  });
  ok('D4 版本闸：非 v3 结构拒绝（双读只认现版）', d4 === true, 'null=' + d4);
  const d5 = await p.evaluate(async () => {
    /* v3 老档逐份迁入：5 份独立老档全部 100% 读回 */
    const raw = GAME.savePayload();
    let good = 0;
    for (let i = 0; i < 5; i++) {
      const id = '__v3_' + i;
      await GAME.idb.write(id, raw, { version: 3, savedAt: 100 + i, checksum: GAME.checksum(raw) });
      const r = await GAME.idb.read(id);
      if (r.ok && r.json === raw) good++;
    }
    return { good, total: 5 };
  });
  ok('D5 v3 老档迁入成功率 100%（5/5 逐字读回）',
    d5.good === 5 && d5.total === 5, d5.good + '/' + d5.total);

  /* ---- E. 自动降级 ---- */
  const e1 = await p.evaluate(async () => {
    GAME.idbSetFactory(null);
    const avail = GAME.idbAvailable();
    const w = await GAME.idb.write('__x', 'abc', {});
    const r = await GAME.idb.read('__x');
    const l = await GAME.idbList();
    const rm = await GAME.idb.remove('__x');
    return { avail, w: w.ok === false, r: r.ok === false, l: l.length === 0, rm: rm.ok === false };
  });
  ok('E1 IDB 不可用 → available=false + write/read/list/remove 全返回失败不抛',
    e1.avail === false && e1.w && e1.r && e1.l && e1.rm, JSON.stringify(e1));
  const e2 = await p.evaluate(async () => {
    GAME.setSaveBackend('idb');
    const m = GAME.idbMirror('main', '{}', GAME.state);
    const st = await GAME.idbHydrate('main');
    const r = GAME.saveTo('main');              /* 本地照常，绝不阻断 */
    return { m, st: st === null, saveOk: r.ok };
  });
  ok('E2 降级不阻断游戏：idbMirror=false / hydrate=null / saveTo 仍 ok',
    e2.m === false && e2.st && e2.saveOk, JSON.stringify(e2));
  const e3 = await p.evaluate(async () => {
    GAME.idbResetFactory();
    const avail = GAME.idbAvailable();
    const w = await GAME.idb.write('__selfheal', 'ok', { version: 3, checksum: 'q' });
    const r = await GAME.idb.read('__selfheal');
    return { avail, w: w.ok, same: r.ok && r.json === 'ok' };
  });
  ok('E3 reset 后自愈（可再次写读）', e3.avail && e3.w && e3.same, JSON.stringify(e3));

  /* ---- F. 切换后端 20 次无数据丢失 ---- */
  const f1 = await p.evaluate(async () => {
    GAME.setSaveBackend('local');
    GAME.saveTo('main');
    const base = JSON.parse(localStorage.getItem(GAME.slotOf('main').key));
    const snap = { cities: (base.cities || []).length, gens: (base.generals || []).length,
      ruler: (base.ruler || {}).name || '', ver: base.version };
    let allOk = true, flips = 0;
    for (let i = 0; i < 20; i++) {
      GAME.setSaveBackend(i % 2 ? 'idb' : 'local');
      flips++;
      const r = GAME.saveTo('main');
      if (!r.ok) allOk = false;
    }
    for (let i = 0; i < 60; i++) {           /* 等最后一次镜像落定 */
      const l = await GAME.idbList();
      if (l.some((x) => x.id === 'main')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const local = JSON.parse(localStorage.getItem(GAME.slotOf('main').key));
    const idbR = await GAME.idb.read('main');
    return { allOk, flips, snap,
      localOk: (local.cities || []).length === snap.cities
        && (local.generals || []).length === snap.gens
        && (local.ruler || {}).name === snap.ruler && local.version === snap.ver,
      idbOk: idbR.ok && idbR.json === localStorage.getItem(GAME.slotOf('main').key),
      final: GAME.SAVE_BACKEND };
  });
  ok('F1 切换后端 20 次无数据丢失（本地 + 镜像逐字一致）',
    f1.allOk && f1.flips === 20 && f1.localOk && f1.idbOk,
    'flips=' + f1.flips + ' localOk=' + f1.localOk + ' idbOk=' + f1.idbOk + ' final=' + f1.final);

  /* ---- G. 反向证据 ---- */
  const g1 = await p.evaluate(() => {
    const raw = GAME.savePayload();
    const st = JSON.parse(raw);
    return { npcPos: raw.indexOf('npcPos') >= 0,
      idbField: raw.indexOf('SAVE_BACKEND') >= 0 || raw.indexOf('idbMirror') >= 0,
      grid: raw.indexOf('_sub153LL') >= 0,
      v3: st.version === 3,
      fogV: (function () { try { return st.fog && typeof st.fog.v !== 'undefined'; } catch (e) { return false; } })() };
  });
  ok('G1 派生字段 0 入档：无 npcPos / 无 idb 字段 / 无 _sub153LL · version 仍 3 · fog.v 未误删',
    !g1.npcPos && !g1.idbField && !g1.grid && g1.v3 && g1.fogV, JSON.stringify(g1));
  const g2 = await p.evaluate(() => {
    const M = GAME.map3d, D = GAME.district, V = GAME.vehicle, N = GAME.npc;
    return {
      p0: typeof M.playerPose === 'function' && typeof M.setPlayerPose === 'function',
      p1: typeof M.nearestInteractable === 'function',
      p2: typeof D.step === 'function' && typeof GAME.ui.renderDistrictHud === 'function',
      p3: typeof V.toggle === 'function',
      p4: typeof N.spawn === 'function' && typeof GAME.ui.renderNpcHint === 'function',
      sync: (function () { const r = GAME.loadFrom('main'); return !!r && !r.then; })()
    };
  });
  ok('G2 P0~P4 出口逐字仍在 + loadFrom 仍是同步契约',
    g2.p0 && g2.p1 && g2.p2 && g2.p3 && g2.p4 && g2.sync, JSON.stringify(g2));
  const g3 = await p.evaluate(() => { GAME.setSaveBackend('idb'); return GAME.saveTo('s3'); });
  const g3seen = await waitMirror('s3');
  const g3r = await p.evaluate(async () => {
    const d = GAME.dropSlot('s3');
    return d;
  });
  const g3gone = await waitGone('s3');
  const g3read = await p.evaluate(async () => (await GAME.idb.read('s3')).ok);
  ok('G3 dropSlot 同步清镜像（删档不残留镜像）',
    g3.ok && g3seen && g3r.ok && g3gone && g3read === false,
    'seen=' + g3seen + ' gone=' + g3gone + ' readOk=' + g3read);

  /* ---- H. 无页面异常 + 收尾还原 ---- */
  await p.evaluate(() => {
    if (GAME.__p5Auto) GAME.autoSave = GAME.__p5Auto;
    GAME.setSaveBackend('local');
  });
  ok('H1 全程无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
