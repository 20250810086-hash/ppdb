const fs = require('fs');
const path = require('path');

const MASUK = path.join(__dirname, 'akun-orang-tua.csv');
const KELUAR = path.join(__dirname, 'akun-orang-tua.xls');

if (!fs.existsSync(MASUK)) {
  console.log('File akun-orang-tua.csv tidak ditemukan di folder ini.');
  process.exit(0);
}

const teks = fs.readFileSync(MASUK, 'utf8').replace(/^\uFEFF/, '');
const baris = [];
let r = [], c = '', q = false;
for (let i = 0; i < teks.length; i++) {
  const ch = teks[i];
  if (q) {
    if (ch === '"') { if (teks[i + 1] === '"') { c += '"'; i++; } else q = false; }
    else c += ch;
  } else if (ch === '"') q = true;
  else if (ch === ';') { r.push(c); c = ''; }
  else if (ch === '\n' || ch === '\r') {
    if (ch === '\r' && teks[i + 1] === '\n') i++;
    r.push(c); baris.push(r); r = []; c = '';
  } else c += ch;
}
if (c !== '' || r.length) { r.push(c); baris.push(r); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sel = (v, tag) => '<' + tag + ' style="mso-number-format:\'\\@\';border:1px solid #999;padding:4px">' + esc(v) + '</' + tag + '>';

const html =
  '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>' +
  baris.map((b, i) => '<tr>' + b.map((v) => sel(v, i === 0 ? 'th' : 'td')).join('') + '</tr>').join('') +
  '</table></body></html>';

fs.writeFileSync(KELUAR, '\uFEFF' + html, 'utf8');
console.log('Selesai: ' + (baris.length - 1) + ' baris data.');
console.log('Buka file ini dengan Excel: ' + KELUAR);