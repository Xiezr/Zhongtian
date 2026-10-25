var fs=require('fs');function L(s){fs.appendFileSync('calib_probe.log',s+'\n');}
L('0 start');
global.window=global;
global.localStorage={_d:{},getItem:function(k){return this._d[k]||null;},setItem:function(k,v){this._d[k]=String(v);},removeItem:function(k){delete this._d[k];}};
function makeEl(t){return{tagName:t||'DIV',textContent:'',innerHTML:'',value:'',checked:false,dataset:{},style:{},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}},addEventListener:function(){},appendChild:function(){},setAttribute:function(){},getAttribute:function(){return null;},querySelector:function(){return makeEl();},querySelectorAll:function(){return[];},getContext:function(){return null;},getBoundingClientRect:function(){return{left:0,top:0,width:760,height:540};}};}
global.document={createElement:function(t){return makeEl(t);},querySelector:function(s){return makeEl();},querySelectorAll:function(){return[];},getElementById:function(id){return makeEl();},addEventListener:function(){},readyState:'complete'};
global.requestAnimationFrame=function(f){return f&&f();};global.location={search:'',href:'file:///index.html'};global.addEventListener=function(){};global.removeEventListener=function(){};global.getComputedStyle=function(){return{getPropertyValue:function(){return'';}};};global.innerWidth=1440;global.innerHeight=900;
L('1 stub ok');
require('./js/bundle-core.js');L('2 required');
require('./js/bundle-war.js');L('2 required');
require('./js/bundle-ui.js');L('2 required');
var G=global.GAME,DATA=G.DATA;L('3 G ok');
G.newGame({name:'p',cityName:'pc'});L('4 newGame ok');
if(G.DATA.DEFAULT_SETTINGS)G.DATA.DEFAULT_SETTINGS.battleWatch=false;L('5 settings');
L('6 done');
