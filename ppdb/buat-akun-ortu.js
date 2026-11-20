const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, 'data');
const PENDAFTAR = path.join(DATA, 'pendaftar');
const USERS_FILE = path.join(DATA, 'users.json');
const KELUAR = path.join(__dirname, 'akun-orang-tua.csv');
const AKUN_AWAL = 'data_awal';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
const titleCase = (s) => String(s).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

const HURUF = 'abcdefghjkmnpqrstuvwxyz23456789'; // tanpa huruf/angka yang mirip (i, l, o, 0, 1)
const randomPass = () => Array.from(crypto.randomBytes(8)).map((b) => HURUF[b % HURUF.length]).join('');

const users = readJson(USERS_FILE, []);
const awal = users.find((u) => u.username === AKUN_AWAL);
if (!awal) {
  console.log('Akun "' + AKUN_AWAL + '" tidak ditemukan. Jalankan dulu: node import-awal.js');
  process.exit(0);
}

const files = fs.readdirSync(PENDAFTAR).filter((f) => f.endsWith('.json')).sort();
const milikAwal = files
  .map((f) => ({ f, p: readJson(path.join(PENDAFTAR, f), null) }))
  .filter((x) => x.p && x.p.ortuId === awal.id);

if (!milikAwal.length) {
  console.log('Tidak ada data pendaftar yang masih dimiliki "' + AKUN_AWAL + '". Tidak ada yang perlu diproses.');
  process.exit(0);
}

const dipakai = new Set(users.map((u) => u.username));
const maxId = () => users.reduce((n, x) => Math.max(n, parseInt(x.id.slice(1), 10) || 0), 0);

const buatUsername = (namaAnak) => {
  const kata = namaAnak.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  let dasar = (kata.slice(0, 2).join('_') || 'ortu').slice(0, 18);
  if (dasar.length < 4) dasar = (dasar + '_ortu').slice(0, 18);
  let u = dasar, i = 1;
  while (dipakai.has(u)) { i++; u = dasar.slice(0, 18 - String(i).length) + i; }
  dipakai.add(u);
  return u;
};

const baris = [['No Pendaftaran', 'Nama Anak', 'Nama Orang Tua', 'Username', 'Password Awal', 'No HP']];
milikAwal.forEach(({ f, p }) => {
  const namaOrtu = titleCase(p.ayah.nama || p.ibu.nama || p.wali.nama || 'Orang Tua ' + p.anak.nama);
  const username = buatUsername(p.anak.nama);
  const password = randomPass();
  const akun = {
    id: 'U' + String(maxId() + 1).padStart(3, '0'), role: 'ortu', username, password: sha(password),
    nama: namaOrtu.slice(0, 100), jabatan: 'Orang Tua/Wali', jk: null, tempatLahir: null, tanggalLahir: null, hp: p.hp || null
  };
  users.push(akun);
  p.ortuId = akun.id;
  p.riwayat = p.riwayat || [];
  p.riwayat.push({ waktu: new Date().toLocaleString('sv-SE'), oleh: 'Administrator', aksi: 'Akun orang tua dibuat (' + username + ')' });
  writeJson(path.join(PENDAFTAR, f), p);
  baris.push([p.id, p.anak.nama, akun.nama, username, password, p.hp || '']);
});

const masihAda = fs.readdirSync(PENDAFTAR).filter((f) => f.endsWith('.json'))
  .some((f) => (readJson(path.join(PENDAFTAR, f), {}) || {}).ortuId === awal.id);
writeJson(USERS_FILE, masihAda ? users : users.filter((u) => u.id !== awal.id));

const csvCell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(KELUAR, '\uFEFF' + baris.map((r) => r.map(csvCell).join(';')).join('\r\n'), 'utf8');

console.log('Selesai: ' + milikAwal.length + ' akun orang tua dibuat dan datanya dipindahkan.');
console.log('Daftar username dan password: ' + KELUAR);
console.log('Simpan file itu baik-baik (jangan diunggah ke folder public), lalu bagikan ke masing-masing orang tua.');
if (!masihAda) console.log('Akun penampung "' + AKUN_AWAL + '" sudah dihapus.');