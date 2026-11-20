const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const PENDAFTAR_DIR = path.join(DATA_DIR, 'pendaftar');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'pengaturan.json');
const BERKAS_DIR = path.join(DATA_DIR, 'berkas');
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_BODY = 1024 * 1024;
const MAX_BERKAS = 3 * 1024 * 1024;
const JENIS_BERKAS = { akta: 'Akta Kelahiran', kk: 'Kartu Keluarga' };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const FIELD_ANAK = ['nama', 'jk', 'tempatLahir', 'tanggalLahir', 'nik', 'noKK', 'noAkta', 'agama', 'alamat', 'rt', 'rw', 'dusun', 'kelurahan', 'kecamatan', 'kodePos', 'jenisTinggal', 'alatTransportasi', 'anakKe', 'jmlSaudara', 'beratBadan', 'tinggiBadan', 'lingkarKepala', 'jarakRumah', 'sekolahAsal', 'kebutuhanKhusus'];
const FIELD_ORTU = ['nama', 'tahunLahir', 'pendidikan', 'pekerjaan', 'penghasilan', 'nik'];
const STATUS_VERIFIKASI = ['Terverifikasi', 'Perlu Perbaikan'];
const KEPUTUSAN = ['Diterima', 'Cadangan', 'Ditolak', 'Batal'];

const sessions = new Map();

fs.mkdirSync(PENDAFTAR_DIR, { recursive: true });
fs.mkdirSync(BERKAS_DIR, { recursive: true });

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
};

const writeJson = (file, data) => {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
};

const send = (res, status, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Data terlalu besar'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('Format data tidak valid'));
      }
    });
    req.on('error', reject);
  });

const readRaw = (req, max) =>
  new Promise((resolve, reject) => {
    let size = 0;
    let gagal = false;
    const chunks = [];
    req.on('data', (c) => {
      if (gagal) return;
      size += c.length;
      if (size > max) {
        gagal = true;
        reject(new Error('Ukuran berkas melebihi 3 MB'));
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!gagal) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });

const detectType = (buf) => {
  if (buf.length > 4 && buf.slice(0, 4).toString('latin1') === '%PDF') return { ext: 'pdf', mime: 'application/pdf' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  return null;
};

const today = () => new Date().toLocaleDateString('sv-SE');
const nowStr = () => new Date().toLocaleString('sv-SE');

const publicUser = (u) => {
  const { password, ...rest } = u;
  return rest;
};

const getSettings = () => readJson(SETTINGS_FILE, {});

const isOpen = (s) => !!s.pendaftaranBuka && today() >= s.tanggalMulai && today() <= s.tanggalSelesai;

const currentAuth = (req) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.t > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  const user = readJson(USERS_FILE, []).find((x) => x.id === s.uid);
  if (!user) return null;
  return { user, token };
};

const listPendaftar = () =>
  fs
    .readdirSync(PENDAFTAR_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(PENDAFTAR_DIR, f), null))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));

const ID_RE = /^PPDB-\d{4}-\d{3,}$/;

const getPendaftar = (id) => (ID_RE.test(id) ? readJson(path.join(PENDAFTAR_DIR, id + '.json'), null) : null);

const savePendaftar = (p) => writeJson(path.join(PENDAFTAR_DIR, p.id + '.json'), p);

const nextId = (settings) => {
  const year = String(settings.tahunAjaran || '').slice(0, 4) || String(new Date().getFullYear());
  const prefix = 'PPDB-' + year + '-';
  const max = listPendaftar()
    .filter((p) => p.id.startsWith(prefix))
    .reduce((m, p) => Math.max(m, parseInt(p.id.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
};

const pick = (src, keys) => {
  const o = {};
  keys.forEach((k) => {
    o[k] = src && src[k] !== undefined && src[k] !== null ? String(src[k]).trim().slice(0, 200) : '';
  });
  return o;
};

const hitungUsia = (tglLahir, acuan) => {
  const l = new Date(tglLahir);
  const a = new Date(acuan);
  let u = a.getFullYear() - l.getFullYear();
  const m = a.getMonth() - l.getMonth();
  if (m < 0 || (m === 0 && a.getDate() < l.getDate())) u--;
  return u;
};

const bersihkanForm = (b) => ({
  anak: pick(b.anak, FIELD_ANAK),
  ayah: pick(b.ayah, FIELD_ORTU),
  ibu: pick(b.ibu, FIELD_ORTU),
  wali: pick(b.wali, FIELD_ORTU),
  hp: b.hp ? String(b.hp).trim().slice(0, 20) : ''
});

const validasiForm = (d, settings) => {
  const a = d.anak;
  if (!a.nama) return 'Nama anak wajib diisi';
  if (!['L', 'P'].includes(a.jk)) return 'Jenis kelamin wajib dipilih';
  if (!a.tempatLahir) return 'Tempat lahir wajib diisi';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.tanggalLahir) || isNaN(new Date(a.tanggalLahir))) return 'Tanggal lahir tidak valid';
  if (a.nik && !/^\d{16}$/.test(a.nik)) return 'NIK anak harus 16 digit';
  if (a.noKK && !/^\d{16}$/.test(a.noKK)) return 'No KK harus 16 digit';
  if (!a.alamat) return 'Alamat wajib diisi';
  if (!d.ayah.nama && !d.ibu.nama && !d.wali.nama) return 'Data ayah, ibu, atau wali wajib diisi';
  if (!/^0\d{9,13}$/.test(d.hp)) return 'Nomor HP tidak valid (contoh: 081234567890)';
  const usia = hitungUsia(a.tanggalLahir, settings.tanggalAcuanUsia || today());
  if (usia < (settings.usiaMinimal || 0)) return 'Usia minimal pendaftar ' + settings.usiaMinimal + ' tahun per ' + settings.tanggalAcuanUsia;
  if (usia > 7) return 'Usia pendaftar melebihi batas TK';
  return null;
};

const catat = (p, oleh, aksi) => {
  p.riwayat = p.riwayat || [];
  p.riwayat.push({ waktu: nowStr(), oleh, aksi });
};

const statistik = () => {
  const list = listPendaftar();
  const s = getSettings();
  const hitung = (fn) => list.filter(fn).length;
  const kuota = {};
  Object.keys(s.kuota || {}).forEach((k) => {
    kuota[k] = { kuota: s.kuota[k], diterima: hitung((p) => p.keputusan === 'Diterima' && p.kelompok === k) };
  });
  return {
    total: list.length,
    menungguVerifikasi: hitung((p) => p.status === 'Menunggu Verifikasi'),
    perluPerbaikan: hitung((p) => p.status === 'Perlu Perbaikan'),
    terverifikasi: hitung((p) => p.status === 'Terverifikasi'),
    diterima: hitung((p) => p.keputusan === 'Diterima'),
    cadangan: hitung((p) => p.keputusan === 'Cadangan'),
    ditolak: hitung((p) => p.keputusan === 'Ditolak'),
    belumDiputuskan: hitung((p) => !p.keputusan),
    lakiLaki: hitung((p) => p.anak.jk === 'L'),
    perempuan: hitung((p) => p.anak.jk === 'P'),
    kuota
  };
};

const api = async (req, res, pathname) => {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const m = req.method;
  const [r, id, sub, jenis] = parts;
  const auth = currentAuth(req);
  const user = auth && auth.user;

  const must = (...roles) => {
    if (!user) {
      send(res, 401, { error: 'Silakan login terlebih dahulu' });
      return false;
    }
    if (roles.length && !roles.includes(user.role)) {
      send(res, 403, { error: 'Akses ditolak' });
      return false;
    }
    return true;
  };

  if (r === 'login' && m === 'POST') {
    const b = await readBody(req);
    const uname = String(b.username || '').trim().toLowerCase();
    const u = readJson(USERS_FILE, []).find((x) => x.username === uname);
    if (!u || u.password !== sha(b.password || '')) return send(res, 401, { error: 'Username atau password salah' });
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { uid: u.id, t: Date.now() });
    return send(res, 200, { token, user: publicUser(u) });
  }

  if (r === 'register' && m === 'POST') {
    const b = await readBody(req);
    const users = readJson(USERS_FILE, []);
    const uname = String(b.username || '').trim().toLowerCase();
    const nama = String(b.nama || '').trim().slice(0, 100);
    const hp = String(b.hp || '').trim();
    if (!nama) return send(res, 400, { error: 'Nama wajib diisi' });
    if (!/^[a-z0-9_]{4,20}$/.test(uname)) return send(res, 400, { error: 'Username 4-20 karakter: huruf kecil, angka, atau underscore' });
    if (String(b.password || '').length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
    if (!/^0\d{9,13}$/.test(hp)) return send(res, 400, { error: 'Nomor HP tidak valid' });
    if (users.some((x) => x.username === uname)) return send(res, 409, { error: 'Username sudah dipakai' });
    const max = users.reduce((n, x) => Math.max(n, parseInt(x.id.slice(1), 10) || 0), 0);
    const baru = { id: 'U' + String(max + 1).padStart(3, '0'), role: 'ortu', username: uname, password: sha(b.password), nama, jabatan: 'Orang Tua/Wali', jk: null, tempatLahir: null, tanggalLahir: null, hp };
    users.push(baru);
    writeJson(USERS_FILE, users);
    return send(res, 201, { message: 'Akun berhasil dibuat' });
  }

  if (r === 'logout' && m === 'POST') {
    if (auth) sessions.delete(auth.token);
    return send(res, 200, { message: 'Berhasil keluar' });
  }

  if (r === 'me' && !id && m === 'GET') {
    if (!must()) return;
    return send(res, 200, publicUser(user));
  }

  if (r === 'me' && id === 'password' && m === 'PUT') {
    if (!must()) return;
    const b = await readBody(req);
    if (user.password !== sha(b.lama || '')) return send(res, 400, { error: 'Password lama salah' });
    if (String(b.baru || '').length < 6) return send(res, 400, { error: 'Password baru minimal 6 karakter' });
    const users = readJson(USERS_FILE, []);
    users.find((x) => x.id === user.id).password = sha(b.baru);
    writeJson(USERS_FILE, users);
    return send(res, 200, { message: 'Password berhasil diubah' });
  }

  if (r === 'pengaturan' && m === 'GET') {
    const s = getSettings();
    return send(res, 200, { ...s, dibuka: isOpen(s) });
  }

  if (r === 'pengaturan' && m === 'PUT') {
    if (!must('admin')) return;
    const b = await readBody(req);
    const s = getSettings();
    ['namaSekolah', 'alamat', 'kontak', 'tahunAjaran'].forEach((k) => {
      if (typeof b[k] === 'string' && b[k].trim()) s[k] = b[k].trim().slice(0, 200);
    });
    ['tanggalMulai', 'tanggalSelesai', 'tanggalAcuanUsia'].forEach((k) => {
      if (typeof b[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b[k])) s[k] = b[k];
    });
    if (s.tanggalMulai > s.tanggalSelesai) return send(res, 400, { error: 'Tanggal mulai tidak boleh setelah tanggal selesai' });
    if (typeof b.pendaftaranBuka === 'boolean') s.pendaftaranBuka = b.pendaftaranBuka;
    if (b.usiaMinimal !== undefined) {
      const n = parseInt(b.usiaMinimal, 10);
      if (Number.isInteger(n) && n >= 0 && n <= 10) s.usiaMinimal = n;
    }
    if (b.kuota && typeof b.kuota === 'object') {
      Object.keys(s.kuota).forEach((k) => {
        const n = parseInt(b.kuota[k], 10);
        if (Number.isInteger(n) && n >= 0) s.kuota[k] = n;
      });
    }
    writeJson(SETTINGS_FILE, s);
    return send(res, 200, { ...s, dibuka: isOpen(s) });
  }

  if (r === 'statistik' && m === 'GET') {
    if (!must('admin', 'guru')) return;
    return send(res, 200, statistik());
  }

  if (r === 'pendaftar') {
    if (!id && m === 'GET') {
      if (!must()) return;
      let list = listPendaftar();
      if (user.role === 'ortu') list = list.filter((p) => p.ortuId === user.id);
      return send(res, 200, list);
    }

    if (!id && m === 'POST') {
      if (!must('ortu')) return;
      const s = getSettings();
      if (!isOpen(s)) return send(res, 403, { error: 'Pendaftaran sedang ditutup' });
      const d = bersihkanForm(await readBody(req));
      const err = validasiForm(d, s);
      if (err) return send(res, 400, { error: err });
      const dobel = listPendaftar().some((p) => p.anak.nama.toLowerCase() === d.anak.nama.toLowerCase() && p.anak.tanggalLahir === d.anak.tanggalLahir);
      if (dobel) return send(res, 409, { error: 'Anak dengan nama dan tanggal lahir yang sama sudah terdaftar' });
      const p = {
        id: nextId(s),
        ortuId: user.id,
        tanggalDaftar: nowStr(),
        status: 'Menunggu Verifikasi',
        catatan: '',
        diverifikasiOleh: null,
        tanggalVerifikasi: null,
        keputusan: null,
        kelompok: null,
        tanggalKeputusan: null,
        berkas: {},
        ...d,
        riwayat: []
      };
      catat(p, user.nama, 'Mengirim formulir pendaftaran');
      savePendaftar(p);
      return send(res, 201, p);
    }

    const p = getPendaftar(id);
    if (id && !p) return send(res, 404, { error: 'Data pendaftar tidak ditemukan' });

    if (id && sub === 'berkas') {
      if (!JENIS_BERKAS[jenis]) return send(res, 404, { error: 'Jenis berkas tidak dikenal' });
      if (!must()) return;
      if (user.role === 'ortu' && p.ortuId !== user.id) return send(res, 403, { error: 'Akses ditolak' });
      p.berkas = p.berkas || {};
      const info = p.berkas[jenis];

      if (m === 'GET') {
        if (!info) return send(res, 404, { error: 'Berkas belum diunggah' });
        const file = path.join(BERKAS_DIR, p.id, jenis + '.' + info.ext);
        if (!fs.existsSync(file)) return send(res, 404, { error: 'File berkas tidak ditemukan' });
        res.writeHead(200, {
          'Content-Type': info.tipe,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        return fs.createReadStream(file).pipe(res);
      }

      if (m === 'PUT' || m === 'DELETE') {
        if (!must('ortu')) return;
        if (p.keputusan || p.status === 'Terverifikasi') return send(res, 400, { error: 'Data sudah dikunci, berkas tidak dapat diubah' });
        const dir = path.join(BERKAS_DIR, p.id);

        if (m === 'PUT') {
          const buf = await readRaw(req, MAX_BERKAS);
          if (!buf.length) return send(res, 400, { error: 'Berkas kosong' });
          const tipe = detectType(buf);
          if (!tipe) return send(res, 400, { error: 'Format berkas harus PDF, JPG, atau PNG' });
          fs.mkdirSync(dir, { recursive: true });
          ['pdf', 'jpg', 'png'].forEach((e) => {
            const f = path.join(dir, jenis + '.' + e);
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
          fs.writeFileSync(path.join(dir, jenis + '.' + tipe.ext), buf);
          let nama = 'berkas.' + tipe.ext;
          try {
            nama = decodeURIComponent(String(req.headers['x-filename'] || '')).replace(/[\\/]/g, '_').trim().slice(0, 100) || nama;
          } catch (e) {}
          p.berkas[jenis] = { nama, tipe: tipe.mime, ext: tipe.ext, ukuran: buf.length, tanggal: nowStr() };
          if (p.status === 'Perlu Perbaikan') p.status = 'Menunggu Verifikasi';
          catat(p, user.nama, 'Mengunggah ' + JENIS_BERKAS[jenis]);
          savePendaftar(p);
          return send(res, 200, p);
        }

        if (!info) return send(res, 404, { error: 'Berkas belum diunggah' });
        const f = path.join(dir, jenis + '.' + info.ext);
        if (fs.existsSync(f)) fs.unlinkSync(f);
        delete p.berkas[jenis];
        catat(p, user.nama, 'Menghapus ' + JENIS_BERKAS[jenis]);
        savePendaftar(p);
        return send(res, 200, p);
      }
    }

    if (id && !sub && m === 'GET') {
      if (!must()) return;
      if (user.role === 'ortu' && p.ortuId !== user.id) return send(res, 403, { error: 'Akses ditolak' });
      return send(res, 200, p);
    }

    if (id && !sub && m === 'PUT') {
      if (!must('ortu')) return;
      if (p.ortuId !== user.id) return send(res, 403, { error: 'Akses ditolak' });
      if (p.keputusan) return send(res, 400, { error: 'Data tidak dapat diubah karena sudah ada keputusan' });
      if (p.status === 'Terverifikasi') return send(res, 400, { error: 'Data sudah terverifikasi dan tidak dapat diubah' });
      const s = getSettings();
      const d = bersihkanForm(await readBody(req));
      const err = validasiForm(d, s);
      if (err) return send(res, 400, { error: err });
      Object.assign(p, d);
      p.status = 'Menunggu Verifikasi';
      catat(p, user.nama, 'Memperbarui formulir pendaftaran');
      savePendaftar(p);
      return send(res, 200, p);
    }

    if (id && sub === 'verifikasi' && m === 'PUT') {
      if (!must('guru', 'admin')) return;
      const b = await readBody(req);
      if (!STATUS_VERIFIKASI.includes(b.status)) return send(res, 400, { error: 'Status verifikasi tidak valid' });
      const catatan = String(b.catatan || '').trim().slice(0, 500);
      if (b.status === 'Perlu Perbaikan' && !catatan) return send(res, 400, { error: 'Catatan perbaikan wajib diisi' });
      if (p.keputusan) return send(res, 400, { error: 'Sudah ada keputusan. Batalkan keputusan terlebih dahulu' });
      if (b.status === 'Terverifikasi') {
        const kurang = Object.keys(JENIS_BERKAS).filter((k) => !(p.berkas && p.berkas[k])).map((k) => JENIS_BERKAS[k]);
        if (kurang.length) return send(res, 400, { error: 'Belum dapat diverifikasi, berkas belum diunggah: ' + kurang.join(', ') });
      }
      p.status = b.status;
      p.catatan = catatan;
      p.diverifikasiOleh = user.nama;
      p.tanggalVerifikasi = nowStr();
      catat(p, user.nama, 'Verifikasi: ' + b.status + (catatan ? ' (' + catatan + ')' : ''));
      savePendaftar(p);
      return send(res, 200, p);
    }

    if (id && sub === 'keputusan' && m === 'PUT') {
      if (!must('admin')) return;
      const b = await readBody(req);
      if (!KEPUTUSAN.includes(b.keputusan)) return send(res, 400, { error: 'Keputusan tidak valid' });
      const s = getSettings();
      if (b.keputusan === 'Batal') {
        p.keputusan = null;
        p.kelompok = null;
        p.tanggalKeputusan = null;
        catat(p, user.nama, 'Membatalkan keputusan');
        savePendaftar(p);
        return send(res, 200, p);
      }
      if (b.keputusan !== 'Ditolak' && p.status !== 'Terverifikasi') return send(res, 400, { error: 'Pendaftar harus terverifikasi terlebih dahulu' });
      let kelompok = null;
      if (b.keputusan === 'Diterima') {
        kelompok = String(b.kelompok || '');
        if (!(kelompok in s.kuota)) return send(res, 400, { error: 'Kelompok tidak valid' });
        const terisi = listPendaftar().filter((x) => x.id !== p.id && x.keputusan === 'Diterima' && x.kelompok === kelompok).length;
        if (terisi >= s.kuota[kelompok]) return send(res, 400, { error: 'Kuota ' + kelompok + ' sudah penuh' });
      }
      p.keputusan = b.keputusan;
      p.kelompok = kelompok;
      p.tanggalKeputusan = nowStr();
      catat(p, user.nama, 'Keputusan: ' + b.keputusan + (kelompok ? ' (' + kelompok + ')' : ''));
      savePendaftar(p);
      return send(res, 200, p);
    }

    if (id && !sub && m === 'DELETE') {
      if (!must('admin')) return;
      fs.unlinkSync(path.join(PENDAFTAR_DIR, p.id + '.json'));
      fs.rmSync(path.join(BERKAS_DIR, p.id), { recursive: true, force: true });
      return send(res, 200, { message: 'Data pendaftar dihapus' });
    }
  }

  if (r === 'users') {
    if (!must('admin')) return;
    const users = readJson(USERS_FILE, []);

    if (!id && m === 'GET') return send(res, 200, users.map(publicUser));

    if (!id && m === 'POST') {
      const b = await readBody(req);
      const uname = String(b.username || '').trim().toLowerCase();
      const nama = String(b.nama || '').trim().slice(0, 100);
      if (!nama) return send(res, 400, { error: 'Nama wajib diisi' });
      if (!/^[a-z0-9_]{4,20}$/.test(uname)) return send(res, 400, { error: 'Username 4-20 karakter: huruf kecil, angka, atau underscore' });
      if (String(b.password || '').length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
      if (!['guru', 'admin'].includes(b.role)) return send(res, 400, { error: 'Role tidak valid' });
      if (users.some((x) => x.username === uname)) return send(res, 409, { error: 'Username sudah dipakai' });
      const max = users.reduce((n, x) => Math.max(n, parseInt(x.id.slice(1), 10) || 0), 0);
      const baru = { id: 'U' + String(max + 1).padStart(3, '0'), role: b.role, username: uname, password: sha(b.password), nama, jabatan: String(b.jabatan || '').trim().slice(0, 100) || 'Guru', jk: ['L', 'P'].includes(b.jk) ? b.jk : null, tempatLahir: null, tanggalLahir: null, hp: String(b.hp || '').trim() || null };
      users.push(baru);
      writeJson(USERS_FILE, users);
      return send(res, 201, publicUser(baru));
    }

    const target = users.find((x) => x.id === id);
    if (id && !target) return send(res, 404, { error: 'Pengguna tidak ditemukan' });

    if (id && m === 'PUT') {
      const b = await readBody(req);
      if (typeof b.nama === 'string' && b.nama.trim()) target.nama = b.nama.trim().slice(0, 100);
      if (typeof b.jabatan === 'string') target.jabatan = b.jabatan.trim().slice(0, 100);
      if (typeof b.hp === 'string') target.hp = b.hp.trim() || null;
      if (b.password) {
        if (String(b.password).length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
        target.password = sha(b.password);
      }
      writeJson(USERS_FILE, users);
      return send(res, 200, publicUser(target));
    }

    if (id && m === 'DELETE') {
      if (target.id === user.id) return send(res, 400, { error: 'Tidak dapat menghapus akun sendiri' });
      if (listPendaftar().some((p) => p.ortuId === target.id)) return send(res, 400, { error: 'Akun masih memiliki data pendaftar' });
      writeJson(USERS_FILE, users.filter((x) => x.id !== id));
      return send(res, 200, { message: 'Pengguna dihapus' });
    }
  }

  return send(res, 404, { error: 'Endpoint tidak ditemukan' });
};

const serveStatic = (req, res, pathname) => {
  let rel;
  try {
    rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Halaman tidak ditemukan');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
};

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  try {
    if (pathname.startsWith('/api/')) return await api(req, res, pathname);
    return serveStatic(req, res, pathname);
  } catch (e) {
    if (!res.headersSent) send(res, 400, { error: e.message || 'Terjadi kesalahan' });
  }
});

server.listen(PORT, () => {
  console.log('PPDB TK Kemala Bhayangkari 62 Talaga berjalan di http://localhost:' + PORT);
});
