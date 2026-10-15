'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw=require('playwright-core');
(async function(){
 var b=await pw.chromium.launch({executablePath:'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'});
 var p=await b.newPage({viewport:{width:1680,height:1000}});
 var errs=[]; p.on('pageerror',function(e){errs.push(String(e));});
 await p.goto('http://localhost:8777/index.html');
 await p.waitForFunction('window.GAME && window.GAME.ui',null,{timeout:30000});
 await p.evaluate(function(){ var G=window.GAME,st=G.newGame({name:'X',cityName:'h',region:'a',mapSeed:1}); G.ui._cityId=st.cities[0].id; G.ui.enterGame(); G.ui.closeAllModals(); G._planetDoCreate(false); try{G.ui.closeAllModals();}catch(e){} G.ui.setView('galaxy'); G.refreshAll(); });
 await p.evaluate(function(){try{GAME.ui.closeAllModals();}catch(e){}}); await p.waitForTimeout(500);
 var r=await p.evaluate(function(){ return { planets:(GAME.planetsOf()||[]).length, hits:(GAME.ui._galaxyPlanets||[]).length }; });
 await p.screenshot({path:'.workbuddy/shots/v9130-galaxy.png'});
 console.log('GALAXY',JSON.stringify(r),'ERRS',JSON.stringify(errs.slice(0,2)));
 await b.close();
})();
