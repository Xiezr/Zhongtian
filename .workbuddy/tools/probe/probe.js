const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { pretendToBeVisual: true });
const d = dom.window.document;
function px(sel, prop) {
  const el = d.querySelector(sel);
  if (!el) return 'no-el';
  const v = dom.window.getComputedStyle(el)[prop];
  return v || 'empty';
}
const root = dom.window.getComputedStyle(d.documentElement);
console.log('--fs-body =', JSON.stringify(root.getPropertyValue('--fs-body')));
console.log('--fs-h2   =', JSON.stringify(root.getPropertyValue('--fs-h2')));
console.log('.gold-heading font-size :', px('.gold-heading', 'fontSize'));
console.log('.m-title      font-size :', px('.m-title', 'fontSize'));
console.log('.map-title    font-size :', px('.map-title', 'fontSize'));
console.log('.btn          font-size :', px('.btn', 'fontSize'));
