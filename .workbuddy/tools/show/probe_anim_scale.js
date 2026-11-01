'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage();
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });
  var NAME = process.argv[2] || 'Soldier';
  await p.evaluate(function (n) { window.__NAME = n; }, NAME);
  await p.evaluate(function (c) { window.__CLIP = c; }, process.argv[3] || 'Idle');
  var r = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME; var NAME = window.__NAME;
    var W = 320, H = 320;
    var scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff,0xffffff,3));
    var cam = new THREE.PerspectiveCamera(40, 1, 0.01, 1e6); cam.position.set(0,1.0,3.0); cam.lookAt(0,0.5,0);
    var cv = document.createElement('canvas'); cv.width=W; cv.height=H;
    var rd = new THREE.WebGLRenderer({canvas:cv, antialias:false, alpha:true, preserveDrawingBuffer:true});
    rd.setSize(W,H,false); rd.setClearColor(0x000000,0);
    function px(){ rd.render(scene,cam); var gl=rd.getContext(), a=new Uint8Array(W*H*4);
      gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);
      var mn=1e9,mx=-1,n=0; for(var y=0;y<H;y++)for(var x=0;x<W;x++){ if(a[(y*W+x)*4+3]>20){n++; if(y<mn)mn=y; if(y>mx)mx=y;} }
      return n?(mx-mn+1):0; }
    return new Promise(function (res) {
      G.gltf.loadAnimated(NAME, function (o) {
        scene.add(o.root); o.root.updateMatrixWorld(true);
        var a = new THREE.AnimationMixer(o.root);
        var before = px();
        a.clipAction(o.byName[window.__CLIP||'Idle'] || o.clips[0]).play();
        for (var i=0;i<30;i++) a.update(0.05);
        var after = px();
        /* 动画里有没有 scale 轨道 */
        var scaleTracks = 0;
        (o.clips||[]).forEach(function(c){ (c.tracks||[]).forEach(function(t){ if(/\.scale$/.test(t.name)) scaleTracks++; }); });
        res({ clip0: o.clips[0] && o.clips[0].name, pxBefore: before, pxAfter: after, scaleTracks: scaleTracks, meta: o.meta,
          url: cv.toDataURL('image/png') });
      }, { name: NAME });
    });
  });
  var fs = require('fs');
  if (r.url) { fs.writeFileSync('.workbuddy/shots/animscale_' + NAME + '.png', Buffer.from(r.url.split(',')[1], 'base64')); console.log('WROTE animscale_soldier.png'); }
  delete r.url; console.log(JSON.stringify({ pxBefore: r.pxBefore, pxAfter: r.pxAfter, clip0: r.clip0, scale: r.meta && r.meta.scale }, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
