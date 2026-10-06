module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var png = PNG.sync.read(fs.readFileSync('E:/Deepseekdb/.workbuddy/shots/v89214-eqtip.png'));
var hist = {};
for (var i = 0; i < png.data.length; i += 4) {
  var r = png.data[i], g = png.data[i+1], b = png.data[i+2];
  var L = 0.299*r + 0.587*g + 0.114*b;
  if (L < 60) continue;
  var k = Math.round(r/32)*32 + ',' + Math.round(g/32)*32 + ',' + Math.round(b/32)*32;
  hist[k] = (hist[k]||0)+1;
}
var arr = Object.keys(hist).map(function(k){return [k, hist[k]];}).sort(function(a,b){return b[1]-a[1];});
console.log('尺寸 ' + png.width + 'x' + png.height);
console.log('亮像素色簇 top12：');
arr.slice(0,12).forEach(function(x){ console.log('   ' + x[0] + '  x' + x[1]); });
