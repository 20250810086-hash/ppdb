const TOKEN_KEY = 'ppdb_token';
const USER_KEY = 'ppdb_user';

const HOME_BY_ROLE = {
  admin: 'admin.html',
  guru: 'guru.html',
  ortu: 'ortu.html'
};

const BERKAS = [
  { k: 'akta', l: 'Akta Kelahiran' },
  { k: 'kk', l: 'Kartu Keluarga' }
];

const MAX_BERKAS = 3 * 1024 * 1024;

const ROLE_LABEL = {
  admin: 'Admin',
  guru: 'Guru',
  ortu: 'Orang Tua'
};

const Auth = {
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  home(role) {
    return HOME_BY_ROLE[role] || 'index.html';
  },
  require(roles) {
    const u = Auth.user();
    if (!Auth.token() || !u) {
      location.replace('index.html');
      return null;
    }
    if (roles && !roles.includes(u.role)) {
      location.replace(Auth.home(u.role));
      return null;
    }
    return u;
  },
  async logout() {
    try {
      await request('POST', '/api/logout');
    } catch (e) {}
    Auth.clear();
    location.replace('index.html');
  }
};

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.token();
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new Error('Tidak dapat terhubung ke server. Pastikan server berjalan.');
  }
  let data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (res.status === 401 && token && !url.endsWith('/login')) {
    Auth.clear();
    location.replace('index.html');
    throw new Error('Sesi berakhir, silakan login kembali');
  }
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

const Api = {
  login: (username, password) => request('POST', '/api/login', { username, password }),
  register: (data) => request('POST', '/api/register', data),
  me: () => request('GET', '/api/me'),
  changePassword: (lama, baru) => request('PUT', '/api/me/password', { lama, baru }),
  pengaturan: () => request('GET', '/api/pengaturan'),
  savePengaturan: (data) => request('PUT', '/api/pengaturan', data),
  statistik: () => request('GET', '/api/statistik'),
  listPendaftar: () => request('GET', '/api/pendaftar'),
  getPendaftar: (id) => request('GET', '/api/pendaftar/' + id),
  createPendaftar: (data) => request('POST', '/api/pendaftar', data),
  updatePendaftar: (id, data) => request('PUT', '/api/pendaftar/' + id, data),
  verifikasi: (id, status, catatan) => request('PUT', '/api/pendaftar/' + id + '/verifikasi', { status, catatan }),
  keputusan: (id, keputusan, kelompok) => request('PUT', '/api/pendaftar/' + id + '/keputusan', { keputusan, kelompok }),
  deletePendaftar: (id) => request('DELETE', '/api/pendaftar/' + id),
  listUsers: () => request('GET', '/api/users'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', '/api/users/' + id, data),
  deleteUser: (id) => request('DELETE', '/api/users/' + id),
  uploadBerkas: (id, jenis, file) => uploadBerkas(id, jenis, file),
  deleteBerkas: (id, jenis) => request('DELETE', '/api/pendaftar/' + id + '/berkas/' + jenis)
};

async function uploadBerkas(id, jenis, file) {
  let res;
  try {
    res = await fetch('/api/pendaftar/' + id + '/berkas/' + jenis, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + Auth.token(),
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name)
      },
      body: file
    });
  } catch (e) {
    throw new Error('Tidak dapat terhubung ke server. Pastikan server berjalan.');
  }
  let data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Gagal mengunggah berkas');
  return data;
}

function fmtUkuran(b) {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}

function berkasKurang(p) {
  return BERKAS.filter((x) => !(p.berkas && p.berkas[x.k])).map((x) => x.l);
}

function berkasSectionHtml(p) {
  const rows = BERKAS.map((x) => {
    const f = p.berkas && p.berkas[x.k];
    const isi = f
      ? '<span>' + esc(f.nama) + ' <span class="muted small">(' + esc(fmtUkuran(f.ukuran)) + ')</span></span> ' +
        '<button type="button" class="btn btn-sm btn-outline no-print" data-berkas="' + x.k + '" data-id="' + esc(p.id) + '">Lihat</button>'
      : '<span class="badge badge-reject">Belum diunggah</span>';
    return '<div class="kv"><dt>' + esc(x.l) + '</dt><dd>' + isi + '</dd></div>';
  }).join('');
  return '<div class="detail-head">Berkas Pendukung</div><dl style="margin:0">' + rows + '</dl>';
}

function bindBerkas(root) {
  root.querySelectorAll('[data-berkas]').forEach((btn) => {
    btn.addEventListener('click', () => previewBerkas(btn.dataset.id, btn.dataset.berkas));
  });
}

async function previewBerkas(id, jenis) {
  const def = BERKAS.find((x) => x.k === jenis);
  try {
    const res = await fetch('/api/pendaftar/' + id + '/berkas/' + jenis, {
      headers: { Authorization: 'Bearer ' + Auth.token() }
    });
    if (!res.ok) {
      let msg = 'Berkas tidak dapat dibuka';
      try {
        msg = (await res.json()).error || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const pdf = blob.type === 'application/pdf';
    const ext = pdf ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
    const prevOverflow = document.body.style.overflow;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.style.zIndex = '150';
    wrap.innerHTML =
      '<div class="modal"><div class="modal-head"><h3>' + esc(def ? def.l : 'Berkas') + '</h3><button class="modal-close" type="button">&times;</button></div>' +
      (pdf
        ? '<iframe src="' + url + '" title="Pratinjau berkas" style="width:100%;height:65vh;border:1px solid var(--border);border-radius:8px"></iframe>'
        : '<img src="' + url + '" alt="Pratinjau berkas" style="max-width:100%;display:block;margin:0 auto;border-radius:8px">') +
      '<div class="form-actions"><a class="btn btn-sm" href="' + url + '" download="' + esc((def ? def.l : 'Berkas').replace(/\s+/g, '-') + '-' + id) + '.' + ext + '">Unduh</a></div></div>';
    const close = () => {
      wrap.remove();
      URL.revokeObjectURL(url);
      document.body.style.overflow = prevOverflow;
    };
    wrap.querySelector('.modal-close').onclick = close;
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close();
    });
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
  } catch (err) {
    toast(err.message, 'error');
  }
}

function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function val(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s ? esc(s) : '<span class="muted">-</span>';
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function fmtTanggal(s) {
  if (!s) return '-';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return esc(s);
  return parseInt(m[3], 10) + ' ' + BULAN[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

function fmtWaktu(s) {
  if (!s) return '-';
  const jam = String(s).match(/\d{2}:\d{2}/);
  return fmtTanggal(s) + (jam ? ', ' + jam[0] : '');
}

function hitungUsia(tglLahir, acuan) {
  if (!tglLahir) return '-';
  const l = new Date(tglLahir);
  const a = acuan ? new Date(acuan) : new Date();
  let tahun = a.getFullYear() - l.getFullYear();
  let bulan = a.getMonth() - l.getMonth();
  if (a.getDate() < l.getDate()) bulan--;
  if (bulan < 0) {
    tahun--;
    bulan += 12;
  }
  return tahun + ' th ' + bulan + ' bln';
}

function badgeStatus(status) {
  const map = {
    'Menunggu Verifikasi': 'badge-wait',
    'Perlu Perbaikan': 'badge-fix',
    'Terverifikasi': 'badge-ok'
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + esc(status) + '</span>';
}

function badgeKeputusan(p) {
  if (!p.keputusan) return '<span class="badge badge-gray">Belum diputuskan</span>';
  const map = {
    Diterima: 'badge-accept',
    Cadangan: 'badge-reserve',
    Ditolak: 'badge-reject'
  };
  const extra = p.kelompok ? ' - ' + p.kelompok : '';
  return '<span class="badge ' + (map[p.keputusan] || 'badge-gray') + '">' + esc(p.keputusan + extra) + '</span>';
}

function toast(msg, type) {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showAlert(el, msg, type) {
  el.className = 'alert alert-' + (type || 'error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAlert(el) {
  el.classList.add('hidden');
}

function openModal(html) {
  closeModal();
  const b = document.createElement('div');
  b.className = 'modal-backdrop';
  b.id = 'modalBackdrop';
  b.innerHTML = '<div class="modal">' + html + '</div>';
  b.addEventListener('click', (e) => {
    if (e.target === b) closeModal();
  });
  document.body.appendChild(b);
  document.body.style.overflow = 'hidden';
  return b;
}

function closeModal() {
  const b = document.getElementById('modalBackdrop');
  if (b) b.remove();
  document.body.style.overflow = '';
}

function mountTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;
  const u = Auth.user();
  el.className = 'topbar';
  el.innerHTML =
    '<div class="topbar-inner">' +
    '<a class="brand" href="index.html"><span class="brand-logo">KB</span><span>PPDB TK Kemala Bhayangkari 62</span></a>' +
    (u
      ? '<div class="topbar-user"><span class="user-name">' + esc(u.nama) + '</span><span class="role-chip">' + esc(ROLE_LABEL[u.role] || u.role) + '</span>' +
        '<button class="btn btn-light btn-sm" id="btnLogout">Keluar</button></div>'
      : '') +
    '</div>';
  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', () => Auth.logout());
}

async function changePasswordDialog() {
  const b = openModal(
    '<div class="modal-head"><h3>Ubah Password</h3><button class="modal-close" type="button" id="mClose">&times;</button></div>' +
      '<div id="mAlert" class="alert hidden"></div>' +
      '<div class="form-grid">' +
      '<div class="form-group full"><label class="req" for="pwLama">Password lama</label><input type="password" id="pwLama" autocomplete="current-password"></div>' +
      '<div class="form-group full"><label class="req" for="pwBaru">Password baru</label><input type="password" id="pwBaru" autocomplete="new-password"><span class="help">Minimal 6 karakter</span></div>' +
      '</div>' +
      '<div class="form-actions"><button class="btn" type="button" id="mSave">Simpan</button><button class="btn btn-outline" type="button" id="mCancel">Batal</button></div>'
  );
  b.querySelector('#mClose').onclick = closeModal;
  b.querySelector('#mCancel').onclick = closeModal;
  b.querySelector('#mSave').onclick = async () => {
    const alertEl = b.querySelector('#mAlert');
    try {
      await Api.changePassword(b.querySelector('#pwLama').value, b.querySelector('#pwBaru').value);
      closeModal();
      toast('Password berhasil diubah', 'success');
    } catch (e) {
      showAlert(alertEl, e.message);
    }
  };
}
