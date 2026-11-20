(function () {
  const user = Auth.require(['admin']);
  if (!user) return;

  mountTopbar();

  const $ = (id) => document.getElementById(id);

  let settings = {};
  let list = [];
  let stat = {};
  let users = [];

  $('namaUser').textContent = user.nama;
  $('btnPassword').addEventListener('click', changePasswordDialog);

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
  }

  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  function renderRingkasan() {
    $('statGrid').innerHTML =
      statHtml('Total pendaftar', stat.total) +
      statHtml('Menunggu verifikasi', stat.menungguVerifikasi, 'warn') +
      statHtml('Perlu perbaikan', stat.perluPerbaikan, 'warn') +
      statHtml('Terverifikasi', stat.terverifikasi) +
      statHtml('Diterima', stat.diterima, 'ok') +
      statHtml('Cadangan', stat.cadangan) +
      statHtml('Ditolak', stat.ditolak, 'bad') +
      statHtml('Belum diputuskan', stat.belumDiputuskan) +
      statHtml('Laki-laki', stat.lakiLaki) +
      statHtml('Perempuan', stat.perempuan);
    $('kuotaGrid').innerHTML = Object.keys(stat.kuota)
      .map((k) => {
        const q = stat.kuota[k];
        const pct = q.kuota ? Math.min(100, Math.round((q.diterima / q.kuota) * 100)) : 0;
        const penuh = q.kuota > 0 && q.diterima >= q.kuota;
        return (
          '<div class="card mb-0"><div class="flex between"><strong>' + esc(k) + '</strong><span>' + esc(q.diterima) + ' / ' + esc(q.kuota) + '</span></div>' +
          '<div class="progress mt"><div class="progress-bar' + (penuh ? ' full' : '') + '" style="width:' + pct + '%"></div></div>' +
          '<div class="muted small mt">' + (penuh ? 'Kuota penuh' : 'Sisa ' + (q.kuota - q.diterima) + ' kursi') + '</div></div>'
        );
      })
      .join('');
  }

  function renderTabel() {
    const hasil = filterPendaftar(list, $('cari').value, $('filterStatus').value, $('filterKeputusan').value);
    $('jumlahTampil').textContent = hasil.length + ' dari ' + list.length + ' data';
    $('tabelWrap').innerHTML = pendaftarTable(hasil, settings);
  }

  ['cari', 'filterStatus', 'filterKeputusan'].forEach((id) => {
    $(id).addEventListener(id === 'cari' ? 'input' : 'change', renderTabel);
  });

  $('tabelWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="periksa"]');
    if (b) periksa(b.dataset.id);
  });

  function keputusanHtml(p) {
    const kel = Object.keys(settings.kuota)
      .map((k) => '<option value="' + esc(k) + '"' + (p.kelompok === k ? ' selected' : '') + '>' + esc(k) + '</option>')
      .join('');
    const pilihan = ['Diterima', 'Cadangan', 'Ditolak']
      .map((o) => '<option value="' + o + '"' + (p.keputusan === o ? ' selected' : '') + '>' + o + '</option>')
      .join('');
    const info = Object.keys(stat.kuota)
      .map((k) => esc(k) + ': ' + stat.kuota[k].diterima + '/' + stat.kuota[k].kuota)
      .join(' &middot; ');
    return (
      '<div class="card mt" style="box-shadow:none;border:1px solid var(--border)">' +
      '<h3>Keputusan Akhir</h3>' +
      '<div class="muted small mb">Terisi: ' + info + '</div>' +
      '<div id="kAlert" class="alert hidden"></div>' +
      (!p.keputusan && p.status !== 'Terverifikasi'
        ? '<div class="alert alert-warn">Data belum terverifikasi. Sebelum diverifikasi, hanya keputusan Ditolak yang dapat diberikan.</div>'
        : '') +
      '<div class="form-grid">' +
      '<div class="form-group"><label for="kKeputusan">Keputusan</label><select id="kKeputusan">' + pilihan + '</select></div>' +
      '<div class="form-group" id="kKelompokWrap"><label for="kKelompok">Ditempatkan di kelompok</label><select id="kKelompok">' + kel + '</select></div>' +
      '</div>' +
      '<div class="form-actions">' +
      '<button type="button" class="btn" id="kSimpan">Simpan Keputusan</button>' +
      (p.keputusan ? '<button type="button" class="btn btn-outline" id="kBatal">Batalkan Keputusan</button>' : '') +
      '<button type="button" class="btn btn-danger" id="kHapus">Hapus Data</button>' +
      '</div></div>'
    );
  }

  function periksa(id) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    const b = openModal(modalHead(p) + detailHtml(p, settings) + verifikasiHtml(p) + keputusanHtml(p));
    b.querySelector('#mClose').onclick = closeModal;
    bindBerkas(b);
    bindVerifikasi(b, p, async () => {
      await loadAll();
      periksa(id);
    });

    const sel = b.querySelector('#kKeputusan');
    const wrap = b.querySelector('#kKelompokWrap');
    const sync = () => wrap.classList.toggle('hidden', sel.value !== 'Diterima');
    sel.onchange = sync;
    sync();

    const kAlert = b.querySelector('#kAlert');
    const simpanKeputusan = async (keputusan, kelompok, pesan) => {
      hideAlert(kAlert);
      try {
        await Api.keputusan(p.id, keputusan, kelompok);
        toast(pesan, 'success');
        closeModal();
        await loadAll();
      } catch (err) {
        showAlert(kAlert, err.message);
      }
    };

    b.querySelector('#kSimpan').onclick = () => simpanKeputusan(sel.value, b.querySelector('#kKelompok').value, 'Keputusan disimpan');

    const batal = b.querySelector('#kBatal');
    if (batal) {
      batal.onclick = () => {
        if (confirm('Batalkan keputusan untuk ' + p.anak.nama + '?')) simpanKeputusan('Batal', '', 'Keputusan dibatalkan');
      };
    }

    b.querySelector('#kHapus').onclick = async () => {
      if (!confirm('Hapus data pendaftar ' + p.anak.nama + '? Tindakan ini tidak dapat dibatalkan.')) return;
      try {
        await Api.deletePendaftar(p.id);
        toast('Data pendaftar dihapus', 'success');
        closeModal();
        await loadAll();
      } catch (err) {
        showAlert(kAlert, err.message);
      }
    };
  }

  function csvCell(v) {
    return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  }

  function csvText(v) {
    return v ? '="' + String(v).replace(/"/g, '') + '"' : '""';
  }

  $('btnCsv').addEventListener('click', () => {
    const hasil = filterPendaftar(list, $('cari').value, $('filterStatus').value, $('filterKeputusan').value);
    if (!hasil.length) {
      toast('Tidak ada data untuk diunduh', 'error');
      return;
    }
    const head = ['No Pendaftaran', 'Nama', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'NIK', 'Alamat', 'Ayah', 'Ibu', 'Wali', 'No HP', 'Tanggal Daftar', 'Akta', 'KK', 'Status Verifikasi', 'Keputusan', 'Kelompok'];
    const rows = hasil.map((p) =>
      [
        csvCell(p.id),
        csvCell(p.anak.nama),
        csvCell(p.anak.jk),
        csvCell(p.anak.tempatLahir),
        csvCell(p.anak.tanggalLahir),
        csvText(p.anak.nik),
        csvCell(p.anak.alamat),
        csvCell(p.ayah.nama),
        csvCell(p.ibu.nama),
        csvCell(p.wali.nama),
        csvText(p.hp),
        csvCell(p.tanggalDaftar),
        csvCell(p.berkas && p.berkas.akta ? 'Ada' : 'Belum'),
        csvCell(p.berkas && p.berkas.kk ? 'Ada' : 'Belum'),
        csvCell(p.status),
        csvCell(p.keputusan || ''),
        csvCell(p.kelompok || '')
      ].join(';')
    );
    const blob = new Blob(['﻿' + head.map(csvCell).join(';') + '\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pendaftar-ppdb-' + new Date().toLocaleDateString('sv-SE') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function renderPengaturan() {
    $('s_namaSekolah').value = settings.namaSekolah || '';
    $('s_alamat').value = settings.alamat || '';
    $('s_kontak').value = settings.kontak || '';
    $('s_tahunAjaran').value = settings.tahunAjaran || '';
    $('s_buka').value = settings.pendaftaranBuka ? '1' : '0';
    $('s_mulai').value = settings.tanggalMulai || '';
    $('s_selesai').value = settings.tanggalSelesai || '';
    $('s_acuan').value = settings.tanggalAcuanUsia || '';
    $('s_usia').value = settings.usiaMinimal;
    $('kuotaInputs').innerHTML = Object.keys(settings.kuota)
      .map(
        (k, i) =>
          '<div class="form-group"><label for="kuota_' + i + '">' + esc(k) + '</label><input type="number" min="0" id="kuota_' + i + '" data-k="' + esc(k) + '" value="' + esc(settings.kuota[k]) + '"></div>'
      )
      .join('');
  }

  $('setForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnSimpanSet');
    hideAlert($('setAlert'));
    btn.disabled = true;
    const kuota = {};
    $('kuotaInputs').querySelectorAll('input').forEach((i) => {
      kuota[i.dataset.k] = i.value;
    });
    try {
      settings = await Api.savePengaturan({
        namaSekolah: $('s_namaSekolah').value,
        alamat: $('s_alamat').value,
        kontak: $('s_kontak').value,
        tahunAjaran: $('s_tahunAjaran').value,
        pendaftaranBuka: $('s_buka').value === '1',
        tanggalMulai: $('s_mulai').value,
        tanggalSelesai: $('s_selesai').value,
        tanggalAcuanUsia: $('s_acuan').value,
        usiaMinimal: $('s_usia').value,
        kuota
      });
      toast('Pengaturan disimpan', 'success');
      await loadAll();
    } catch (err) {
      showAlert($('setAlert'), err.message);
      window.scrollTo(0, 0);
    } finally {
      btn.disabled = false;
    }
  });

  const ROLE_BADGE = { admin: 'badge-reject', guru: 'badge-ok', ortu: 'badge-gray' };

  function renderUsers() {
    const kw = $('cariUser').value.trim().toLowerCase();
    const role = $('filterRole').value;
    const hasil = users.filter((u) => (!role || u.role === role) && (!kw || u.nama.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw)));
    if (!hasil.length) {
      $('userWrap').innerHTML = '<div class="empty">Tidak ada pengguna</div>';
      return;
    }
    $('userWrap').innerHTML =
      '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Jabatan</th><th>No HP</th><th>Aksi</th></tr></thead><tbody>' +
      hasil
        .map(
          (u) =>
            '<tr><td class="bold">' + esc(u.nama) + '</td><td>' + esc(u.username) + '</td>' +
            '<td><span class="badge ' + (ROLE_BADGE[u.role] || 'badge-gray') + '">' + esc(ROLE_LABEL[u.role] || u.role) + '</span></td>' +
            '<td>' + val(u.jabatan) + '</td><td>' + val(u.hp) + '</td>' +
            '<td><div class="flex flex-wrap"><button type="button" class="btn btn-sm btn-outline" data-act="edit" data-id="' + esc(u.id) + '">Ubah</button>' +
            (u.id === user.id ? '' : '<button type="button" class="btn btn-sm btn-danger" data-act="hapus" data-id="' + esc(u.id) + '">Hapus</button>') +
            '</div></td></tr>'
        )
        .join('') +
      '</tbody></table></div>';
  }

  $('cariUser').addEventListener('input', renderUsers);
  $('filterRole').addEventListener('change', renderUsers);

  $('userWrap').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const u = users.find((x) => x.id === b.dataset.id);
    if (!u) return;
    if (b.dataset.act === 'edit') return userDialog(u);
    if (!confirm('Hapus pengguna ' + u.nama + '?')) return;
    try {
      await Api.deleteUser(u.id);
      toast('Pengguna dihapus', 'success');
      await loadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btnTambahUser').addEventListener('click', () => userDialog(null));

  function userDialog(u) {
    const baru = !u;
    const b = openModal(
      '<div class="modal-head"><h3>' + (baru ? 'Tambah Guru/Admin' : 'Ubah Pengguna') + '</h3><button class="modal-close" type="button" id="mClose">&times;</button></div>' +
        '<div id="uAlert" class="alert hidden"></div>' +
        '<div class="form-grid">' +
        '<div class="form-group full"><label class="req" for="uNama">Nama lengkap</label><input type="text" id="uNama" maxlength="100" value="' + esc(u ? u.nama : '') + '"></div>' +
        (baru
          ? '<div class="form-group"><label class="req" for="uUsername">Username</label><input type="text" id="uUsername" maxlength="20" autocapitalize="none"></div>' +
            '<div class="form-group"><label class="req" for="uRole">Peran</label><select id="uRole"><option value="guru">Guru</option><option value="admin">Admin</option></select></div>'
          : '<div class="form-group full"><label>Username</label><input type="text" value="' + esc(u.username) + '" readonly></div>') +
        '<div class="form-group"><label for="uJabatan">Jabatan</label><input type="text" id="uJabatan" maxlength="100" value="' + esc(u ? u.jabatan : 'Guru') + '"></div>' +
        '<div class="form-group"><label for="uHp">No. HP</label><input type="tel" id="uHp" inputmode="numeric" maxlength="14" value="' + esc(u && u.hp ? u.hp : '') + '"></div>' +
        '<div class="form-group full"><label' + (baru ? ' class="req"' : '') + ' for="uPassword">' + (baru ? 'Password' : 'Password baru (kosongkan jika tidak diubah)') + '</label><input type="password" id="uPassword" autocomplete="new-password"><span class="help">Minimal 6 karakter</span></div>' +
        '</div>' +
        '<div class="form-actions"><button type="button" class="btn" id="uSimpan">Simpan</button><button type="button" class="btn btn-outline" id="uBatal">Batal</button></div>'
    );
    b.querySelector('#mClose').onclick = closeModal;
    b.querySelector('#uBatal').onclick = closeModal;
    b.querySelector('#uSimpan').onclick = async () => {
      const al = b.querySelector('#uAlert');
      hideAlert(al);
      const data = {
        nama: b.querySelector('#uNama').value.trim(),
        jabatan: b.querySelector('#uJabatan').value.trim(),
        hp: b.querySelector('#uHp').value.trim()
      };
      const pw = b.querySelector('#uPassword').value;
      if (pw) data.password = pw;
      try {
        if (baru) {
          data.username = b.querySelector('#uUsername').value.trim();
          data.role = b.querySelector('#uRole').value;
          data.password = pw;
          await Api.createUser(data);
        } else {
          await Api.updateUser(u.id, data);
        }
        toast('Pengguna disimpan', 'success');
        closeModal();
        await loadAll();
      } catch (err) {
        showAlert(al, err.message);
      }
    };
  }

  async function loadAll() {
    try {
      const [s, l, st, us] = await Promise.all([Api.pengaturan(), Api.listPendaftar(), Api.statistik(), Api.listUsers()]);
      settings = s;
      list = l.slice().reverse();
      stat = st;
      users = us;
      renderRingkasan();
      renderTabel();
      renderPengaturan();
      renderUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  loadAll();
})();
