/* 复现"募兵上限"之谜：用 rushF_1x 终局存档直接问游戏 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data','state','questdata','systems','domain','map','battle','tactic','icons','gicons','bitmaps','portraits','story','ui','main'].forEach(function(f){ require(R + 'js/' + f + '.js'); });
var G = global.GAME;
var payload = JSON.parse(fs.readFileSync(R + '.workbuddy/tmp/playtest600/rushF_1x/final_state.json', 'utf8'));
G.adoptState(payload);
var st = G.state;
var out = [];
out.push('s.res === cities[0].res ? ' + (st.res === st.cities[0].res));
out.push('s.res.pop=' + st.res.pop + ' gold=' + Math.round(st.res.gold));
st.cities.forEach(function(c, i){
  G.ui._cityId = c.id;
  var lo = G.trainLimitOf('yibing');
  var cq = G.trainLimitOf('changqiang');
  out.push('[' + i + '] ' + c.name + ' 城pop=' + G.res(c).pop
    + ' | yibing cap=' + lo.cap + ' (popB=' + lo.popBound + '/resB=' + lo.resBound + ')'
    + ' | changqiang cap=' + cq.cap + ' (popB=' + cq.popBound + '/resB=' + cq.resBound + ')');
  out.push('    maxTrainCount(yibing)=' + G.maxTrainCount('yibing', c.id)
    + ' | canTrain(changqiang)=' + JSON.stringify(G.canTrain('changqiang')));
});
fs.writeFileSync(R + '.workbuddy/tmp/_probe_train.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
