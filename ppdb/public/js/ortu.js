(function () {
  const user = Auth.require(['ortu']);
  if (!user) return;

  mountTopbar();

  const $ = (id) => document.getElementById(id);

  const PENDIDIKAN = ['Tidak sekolah', 'SD / sederajat', 'SMP / sederajat', 'SMA / sederajat', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];
  const PEKERJAAN = ['Tidak bekerja', 'Wiraswasta', 'Karyawan Swasta', 'Pedagang Kecil', 'Pedagang Besar', 'PNS/TNI/Polri', 'Petani', 'Buruh', 'Nelayan', 'Guru/Dosen', 'Lainnya'];
  const PENGHASILAN = [
    'Tidak Berpenghasilan',
    'Kurang dari Rp. 500,000',
    'Rp. 500,000 - Rp. 999,999',
    'Rp. 1,000,000 - Rp. 1,999,999',
    'Rp. 2,000,000 - Rp. 4,999,999',
    'Rp. 5,000,000 - Rp. 20,000,000',
    'Lebih dari Rp. 20,000,000'
  ];
  const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];
  const JENIS_TINGGAL = ['Bersama orang tua', 'Wali', 'Kos', 'Asrama', 'Panti asuhan', 'Lainnya'];
  const TRANSPORT = ['Jalan kaki', 'Sepeda motor', 'Mobil pribadi', 'Angkutan umum/bus/pete-pete', 'Antar jemput sekolah', 'Sepeda', 'Lainnya'];
  const KEBUTUHAN = ['Tidak ada', 'Tuna netra', 'Tuna rungu', 'Tuna grahita', 'Tuna daksa', 'Autis', 'Lainnya'];

  const ANAK_FIELDS = [
    { s: 'Data Calon Peserta Didik' },
    { k: 'nama', l: 'Nama lengkap', req: true, max: 100, full: true },
    { k: 'jk', l: 'Jenis kelamin', t: 'select', o: [['L', 'Laki-laki'], ['P', 'Perempuan']], req: true },
    { k: 'agama', l: 'Agama', t: 'select', o: AGAMA },
    { k: 'tempatLahir', l: 'Tempat lahir', req: true, max: 60 },
    { k: 'tanggalLahir', l: 'Tanggal lahir', t: 'date', req: true, help: 'Usia dihitung per tanggal acuan sekolah' },
    { k: 'nik', l: 'NIK anak', im: 'numeric', max: 16, help: '16 digit, sesuai Kartu Keluarga' },
    { k: 'noKK', l: 'No. Kartu Keluarga', im: 'numeric', max: 16, help: '16 digit' },
    { k: 'noAkta', l: 'No. Registrasi Akta Lahir', max: 60 },
    { k: 'anakKe', l: 'Anak ke-', t: 'number', min: 1, max: 2 },
    { k: 'jmlSaudara', l: 'Jumlah saudara kandung', t: 'number', min: 0, max: 2 },
    { s: 'Alamat Tempat Tinggal' },
    { k: 'alamat', l: 'Alamat (jalan/blok)', req: true, max: 150, full: true },
    { k: 'rt', l: 'RT', im: 'numeric', max: 3 },
    { k: 'rw', l: 'RW', im: 'numeric', max: 3 },
    { k: 'dusun', l: 'Dusun', max: 60 },
    { k: 'kelurahan', l: 'Desa/Kelurahan', max: 60 },
    { k: 'kecamatan', l: 'Kecamatan', max: 60 },
    { k: 'kodePos', l: 'Kode pos', im: 'numeric', max: 5 },
    { k: 'jenisTinggal', l: 'Jenis tinggal', t: 'select', o: JENIS_TINGGAL },
    { k: 'alatTransportasi', l: 'Alat transportasi ke sekolah', t: 'select', o: TRANSPORT },
    { k: 'jarakRumah', l: 'Jarak rumah ke sekolah (km)', t: 'number', min: 0, step: '0.1', max: 5 },
    { s: 'Data Tambahan' },
    { k: 'beratBadan', l: 'Berat badan (kg)', t: 'number', min: 0, step: '0.1', max: 5 },
    { k: 'tinggiBadan', l: 'Tinggi badan (cm)', t: 'number', min: 0, step: '0.1', max: 5 },
    { k: 'lingkarKepala', l: 'Lingkar kepala (cm)', t: 'number', min: 0, step: '0.1', max: 5 },
    { k: 'kebutuhanKhusus', l: 'Kebutuhan khusus', t: 'select', o: KEBUTUHAN },
    { k: 'sekolahAsal', l: 'PAUD/KB asal (jika ada)', max: 100 }
  ];

  const ORTU_FIELDS = [
    { k: 'nama', l: 'Nama lengkap', max: 100, full: true },
    { k: 'nik', l: 'NIK', im: 'numeric', max: 16 },
    { k: 'tahunLahir', l: 'Tahun lahir', im: 'numeric', max: 4, ph: '1990' },
    { k: 'pendidikan', l: 'Pendidikan terakhir', t: 'select', o: PENDIDIKAN },
    { k: 'pekerjaan', l: 'Pekerjaan', t: 'select', o: PEKERJAAN },
    { k: 'penghasilan', l: 'Penghasilan per bulan', t: 'select', o: PENGHASILAN }
  ];

  const DEFAULT_ANAK = {
    agama: 'Islam',
    kecamatan: 'Kec. Talaga',
    kodePos: '45463',
    jenisTinggal: 'Bersama orang tua',
    kebutuhanKhusus: 'Tidak ada'
  };

  const FORM_SECTIONS = [
    { g: 'anak', fields: ANAK_FIELDS },
    { g: 'ayah', title: 'Data Ayah', fields: ORTU_FIELDS },
    { g: 'ibu', title: 'Data Ibu', fields: ORTU_FIELDS },
    { g: 'wali', title: 'Data Wali (isi jika anak tinggal dengan wali)', fields: ORTU_FIELDS }
  ];

  let settings = {};
  let list = [];
  let editingId = null;
  let detailId = null;

  function show(view) {
    ['viewList', 'viewForm', 'viewDetail'].forEach((v) => $(v).classList.toggle('hidden', v !== view));
    window.scrollTo(0, 0);
  }

  function canEdit(p) {
    return !p.keputusan && p.status !== 'Terverifikasi';
  }

  function fieldHtml(g, f, v) {
    const id = 'f_' + g + '_' + f.k;
    const base = ' id="' + id + '" data-g="' + g + '" data-k="' + f.k + '"' + (f.req ? ' required' : '');
    let input;
    if (f.t === 'select') {
      const opts = f.o
        .map((o) => {
          const ov = Array.isArray(o) ? o[0] : o;
          const ol = Array.isArray(o) ? o[1] : o;
          return '<option value="' + esc(ov) + '"' + (String(v) === String(ov) ? ' selected' : '') + '>' + esc(ol) + '</option>';
        })
        .join('');
      input = '<select' + base + '><option value="">- Pilih -</option>' + opts + '</select>';
    } else {
      input =
        '<input type="' + (f.t || 'text') + '"' + base +
        ' value="' + esc(v) + '"' +
        (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') +
        (f.im ? ' inputmode="' + f.im + '"' : '') +
        (f.t === 'number' || !f.max ? '' : ' maxlength="' + f.max + '"') +
        (f.t === 'number' && f.min !== undefined ? ' min="' + f.min + '"' : '') +
        (f.step ? ' step="' + f.step + '"' : '') +
        (f.t === 'date' ? ' max="' + new Date().toLocaleDateString('sv-SE') + '"' : '') +
        '>';
    }
    return (
      '<div class="form-group' + (f.full ? ' full' : '') + '">' +
      '<label' + (f.req ? ' class="req"' : '') + ' for="' + id + '">' + esc(f.l) + '</label>' +
      input +
      (f.help ? '<span class="help" id="' + id + '_help">' + esc(f.help) + '</span>' : '') +
      '</div>'
    );
  }

  function renderForm(p) {
    let html = '';
    FORM_SECTIONS.forEach((sec) => {
      const data = p ? p[sec.g] || {} : sec.g === 'anak' ? DEFAULT_ANAK : {};
      if (sec.title) html += '<div class="section-title">' + esc(sec.title) + '</div>';
      sec.fields.forEach((f) => {
        if (f.s) {
          html += '<div class="section-title">' + esc(f.s) + '</div>';
        } else {
          html += fieldHtml(sec.g, f, data[f.k] !== undefined ? data[f.k] : '');
        }
      });
    });
    html += '<div class="section-title">Kontak Orang Tua/Wali</div>';
    html += fieldHtml('root', { k: 'hp', l: 'Nomor HP/WhatsApp', t: 'tel', req: true, im: 'numeric', max: 14, ph: '081234567890', full: true }, p ? p.hp : user.hp || '');
    html += '<div class="section-title">Berkas Pendukung</div>';
    BERKAS.forEach((x) => {
      const ada = p && p.berkas && p.berkas[x.k];
      html +=
        '<div class="form-group full"><label' + (ada ? '' : ' class="req"') + ' for="f_berkas_' + x.k + '">' + esc(x.l) + '</label>' +
        '<input type="file" id="f_berkas_' + x.k + '" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"' + (ada ? '' : ' required') + '>' +
        '<span class="help">' + (ada ? 'Sudah diunggah: ' + esc(ada.nama) + '. Pilih file baru hanya jika ingin mengganti. ' : '') + 'Format PDF, JPG, atau PNG, maksimal 3 MB.</span></div>';
    });
    $('formFields').innerHTML = html;
    updateUsiaHelp();
  }

  function collect() {
    const d = { anak: {}, ayah: {}, ibu: {}, wali: {}, hp: '' };
    $('formFields').querySelectorAll('[data-g]').forEach((n) => {
      const g = n.dataset.g;
      if (g === 'root') d[n.dataset.k] = n.value.trim();
      else d[g][n.dataset.k] = n.value.trim();
    });
    return d;
  }

  function updateUsiaHelp() {
    const input = $('f_anak_tanggalLahir');
    const help = $('f_anak_tanggalLahir_help');
    if (!input || !help) return;
    if (!input.value) {
      help.textContent = 'Usia dihitung per ' + fmtTanggal(settings.tanggalAcuanUsia);
      return;
    }
    const usia = hitungUsia(input.value, settings.tanggalAcuanUsia);
    const tahun = parseInt(usia, 10);
    let saran;
    if (tahun < settings.usiaMinimal) saran = ' - belum memenuhi usia minimal ' + settings.usiaMinimal + ' tahun';
    else saran = tahun >= 5 ? ' - perkiraan Kelompok B' : ' - perkiraan Kelompok A';
    help.textContent = 'Usia per ' + fmtTanggal(settings.tanggalAcuanUsia) + ': ' + usia + saran;
  }

  $('formFields').addEventListener('input', (e) => {
    if (e.target.id === 'f_anak_tanggalLahir') updateUsiaHelp();
  });

  function pilihBerkas() {
    const out = {};
    BERKAS.forEach((x) => {
      const f = $('f_berkas_' + x.k).files[0];
      if (!f) return;
      if (f.size > MAX_BERKAS) throw new Error(x.l + ' melebihi 3 MB');
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) throw new Error(x.l + ' harus berformat PDF, JPG, atau PNG');
      out[x.k] = f;
    });
    return out;
  }

  function berkasPeringatan(p) {
    if (!canEdit(p)) return '';
    const kurang = berkasKurang(p);
    return kurang.length ? '<div class="alert alert-warn">Berkas belum lengkap: ' + esc(kurang.join(', ')) + '. Lengkapi lewat tombol Perbaiki Data.</div>' : '';
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    $('formTitle').textContent = p ? 'Perbaiki Data Pendaftaran' : 'Formulir Pendaftaran Peserta Didik Baru';
    $('btnSubmit').textContent = p ? 'Simpan Perbaikan' : 'Kirim Pendaftaran';
    hideAlert($('formAlert'));
    if (p && p.status === 'Perlu Perbaikan' && p.catatan) {
      showAlert($('formAlert'), 'Catatan guru: ' + p.catatan, 'warn');
    }
    renderForm(p);
    show('viewForm');
  }

  $('pendaftaranForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = $('pendaftaranForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const btn = $('btnSubmit');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    hideAlert($('formAlert'));
    try {
      const files = pilihBerkas();
      const data = collect();
      const wasEdit = !!editingId;
      const saved = wasEdit ? await Api.updatePendaftar(editingId, data) : await Api.createPendaftar(data);
      const gagal = [];
      for (const x of BERKAS) {
        if (!files[x.k]) continue;
        try {
          await Api.uploadBerkas(saved.id, x.k, files[x.k]);
        } catch (e) {
          gagal.push(x.l + ': ' + e.message);
        }
      }
      await loadAll();
      if (gagal.length) {
        openForm(list.find((q) => q.id === saved.id));
        showAlert($('formAlert'), 'Data tersimpan, tetapi berkas gagal diunggah. ' + gagal.join('; ') + '. Pilih file lagi lalu simpan.');
        return;
      }
      toast(wasEdit ? 'Perbaikan berhasil disimpan' : 'Pendaftaran berhasil dikirim', 'success');
      show('viewList');
    } catch (err) {
      showAlert($('formAlert'), err.message);
      window.scrollTo(0, 0);
    } finally {
      btn.disabled = false;
      btn.textContent = editingId ? 'Simpan Perbaikan' : 'Kirim Pendaftaran';
    }
  });

  function backToList() {
    show('viewList');
  }

  $('btnBatal').addEventListener('click', backToList);
  $('btnBatalAtas').addEventListener('click', backToList);
  $('btnKembali').addEventListener('click', backToList);
  $('btnDaftar').addEventListener('click', () => openForm(null));
  $('btnPassword').addEventListener('click', changePasswordDialog);
  $('btnCetak').addEventListener('click', () => window.print());
  $('btnEditDetail').addEventListener('click', () => {
    const p = list.find((x) => x.id === detailId);
    if (p) openForm(p);
  });

  function hasilAlert(p) {
    if (p.keputusan === 'Diterima') {
      return '<div class="alert alert-success"><strong>Selamat!</strong> ' + esc(p.anak.nama) + ' dinyatakan DITERIMA di ' + esc(p.kelompok) + '. Silakan menghubungi sekolah untuk informasi selanjutnya.</div>';
    }
    if (p.keputusan === 'Cadangan') {
      return '<div class="alert alert-warn">' + esc(p.anak.nama) + ' masuk daftar CADANGAN. Sekolah akan menghubungi Anda jika tersedia kursi.</div>';
    }
    if (p.keputusan === 'Ditolak') {
      return '<div class="alert alert-error">Mohon maaf, ' + esc(p.anak.nama) + ' belum dapat diterima pada periode ini.</div>';
    }
    if (p.status === 'Perlu Perbaikan') {
      return '<div class="alert alert-warn"><strong>Perlu perbaikan:</strong> ' + esc(p.catatan || '-') + '</div>';
    }
    if (p.status === 'Terverifikasi') {
      return '<div class="alert alert-info">Data sudah terverifikasi. Menunggu keputusan akhir dari sekolah.</div>';
    }
    return '<div class="alert alert-info">Data sedang menunggu verifikasi guru.</div>';
  }

  function renderList() {
    const wrap = $('listWrap');
    if (!list.length) {
      wrap.innerHTML = '<div class="card empty">Belum ada pendaftaran. Tekan tombol <strong>+ Daftarkan Anak</strong> untuk memulai.</div>';
      return;
    }
    wrap.innerHTML = list
      .map(
        (p) =>
          '<div class="card">' +
          '<div class="card-title"><div><h3>' + esc(p.anak.nama) + '</h3>' +
          '<div class="muted small">No. ' + esc(p.id) + ' &middot; Daftar ' + esc(fmtWaktu(p.tanggalDaftar)) + '</div></div>' +
          '<div class="flex flex-wrap">' + badgeStatus(p.status) + badgeKeputusan(p) + '</div></div>' +
          hasilAlert(p) +
          berkasPeringatan(p) +
          '<div class="flex flex-wrap">' +
          '<button type="button" class="btn btn-sm" data-act="detail" data-id="' + esc(p.id) + '">Lihat Detail &amp; Bukti</button>' +
          (canEdit(p) ? '<button type="button" class="btn btn-sm btn-outline" data-act="edit" data-id="' + esc(p.id) + '">Perbaiki Data</button>' : '') +
          '</div></div>'
      )
      .join('');
  }

  $('listWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = list.find((x) => x.id === b.dataset.id);
    if (!p) return;
    if (b.dataset.act === 'detail') openDetail(p);
    if (b.dataset.act === 'edit') openForm(p);
  });

  function kvRows(fields, data) {
    return fields
      .filter((f) => !f.s)
      .map((f) => {
        let v = data[f.k];
        if (f.t === 'date') v = fmtTanggal(v);
        if (f.t === 'select' && Array.isArray(f.o[0])) {
          const found = f.o.find((o) => o[0] === v);
          if (found) v = found[1];
        }
        return '<div class="kv"><dt>' + esc(f.l) + '</dt><dd>' + val(v) + '</dd></div>';
      })
      .join('');
  }

  function openDetail(p) {
    detailId = p.id;
    $('btnEditDetail').classList.toggle('hidden', !canEdit(p));
    const adaWali = p.wali && p.wali.nama;
    const riwayat = (p.riwayat || [])
      .slice()
      .reverse()
      .map((r) => '<li><span class="time">' + esc(fmtWaktu(r.waktu)) + '</span>' + esc(r.aksi) + ' <span class="muted">oleh ' + esc(r.oleh) + '</span></li>')
      .join('');
    $('detailWrap').innerHTML =
      '<div class="bukti mb">' +
      '<div class="bukti-head"><h2 class="mb-0">BUKTI PENDAFTARAN PPDB</h2>' +
      '<div class="bold">' + esc(settings.namaSekolah) + '</div>' +
      '<div class="small muted">' + esc(settings.alamat) + '</div>' +
      '<div class="small">Tahun Ajaran ' + esc(settings.tahunAjaran) + '</div></div>' +
      '<dl style="margin:0">' +
      '<div class="kv"><dt>No. Pendaftaran</dt><dd><strong>' + esc(p.id) + '</strong></dd></div>' +
      '<div class="kv"><dt>Tanggal daftar</dt><dd>' + esc(fmtWaktu(p.tanggalDaftar)) + '</dd></div>' +
      '<div class="kv"><dt>Status verifikasi</dt><dd>' + badgeStatus(p.status) + '</dd></div>' +
      '<div class="kv"><dt>Hasil seleksi</dt><dd>' + badgeKeputusan(p) + '</dd></div>' +
      (p.catatan ? '<div class="kv"><dt>Catatan guru</dt><dd>' + esc(p.catatan) + '</dd></div>' : '') +
      '<div class="kv"><dt>Usia (per ' + esc(fmtTanggal(settings.tanggalAcuanUsia)) + ')</dt><dd>' + esc(hitungUsia(p.anak.tanggalLahir, settings.tanggalAcuanUsia)) + '</dd></div>' +
      '<div class="kv"><dt>No. HP orang tua</dt><dd>' + val(p.hp) + '</dd></div>' +
      '</dl>' +
      '<div class="detail-head">Data Calon Peserta Didik</div><dl style="margin:0">' + kvRows(ANAK_FIELDS, p.anak) + '</dl>' +
      '<div class="detail-head">Data Ayah</div><dl style="margin:0">' + kvRows(ORTU_FIELDS, p.ayah) + '</dl>' +
      '<div class="detail-head">Data Ibu</div><dl style="margin:0">' + kvRows(ORTU_FIELDS, p.ibu) + '</dl>' +
      (adaWali ? '<div class="detail-head">Data Wali</div><dl style="margin:0">' + kvRows(ORTU_FIELDS, p.wali) + '</dl>' : '') +
      berkasSectionHtml(p) +
      '</div>' +
      '<div class="card no-print"><h3>Riwayat Proses</h3><ul class="timeline">' + (riwayat || '<li>Belum ada riwayat</li>') + '</ul></div>';
    bindBerkas($('detailWrap'));
    show('viewDetail');
  }

  function renderHeader() {
    $('namaUser').textContent = user.nama;
    const alertEl = $('infoAlert');
    if (settings.dibuka) {
      $('heroInfo').textContent =
        'Pendaftaran tahun ajaran ' + settings.tahunAjaran + ' dibuka sampai ' + fmtTanggal(settings.tanggalSelesai) + '. Anda dapat mendaftarkan lebih dari satu anak.';
      $('btnDaftar').classList.remove('hidden');
      alertEl.classList.add('hidden');
    } else {
      $('heroInfo').textContent = 'Pendaftaran tahun ajaran ' + settings.tahunAjaran + ' saat ini ditutup.';
      $('btnDaftar').classList.add('hidden');
      showAlert(
        alertEl,
        'Pendaftaran dibuka pada ' + fmtTanggal(settings.tanggalMulai) + ' sampai ' + fmtTanggal(settings.tanggalSelesai) + '. Anda tetap dapat melihat status pendaftaran yang sudah masuk.',
        'warn'
      );
    }
  }

  async function loadAll() {
    const [s, l] = await Promise.all([Api.pengaturan(), Api.listPendaftar()]);
    settings = s;
    list = l.slice().reverse();
    renderHeader();
    renderList();
  }

  loadAll().catch((err) => {
    $('listWrap').innerHTML = '<div class="alert alert-error">' + esc(err.message) + '</div>';
  });
})();
