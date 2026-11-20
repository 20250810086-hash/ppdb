const DETAIL_ANAK = [
  ['nama', 'Nama lengkap'],
  ['jk', 'Jenis kelamin'],
  ['tempatLahir', 'Tempat lahir'],
  ['tanggalLahir', 'Tanggal lahir'],
  ['agama', 'Agama'],
  ['nik', 'NIK'],
  ['noKK', 'No. Kartu Keluarga'],
  ['noAkta', 'No. Akta Lahir'],
  ['anakKe', 'Anak ke-'],
  ['jmlSaudara', 'Jumlah saudara kandung'],
  ['alamat', 'Alamat'],
  ['rt', 'RT'],
  ['rw', 'RW'],
  ['dusun', 'Dusun'],
  ['kelurahan', 'Desa/Kelurahan'],
  ['kecamatan', 'Kecamatan'],
  ['kodePos', 'Kode pos'],
  ['jenisTinggal', 'Jenis tinggal'],
  ['alatTransportasi', 'Alat transportasi'],
  ['jarakRumah', 'Jarak ke sekolah (km)'],
  ['beratBadan', 'Berat badan (kg)'],
  ['tinggiBadan', 'Tinggi badan (cm)'],
  ['lingkarKepala', 'Lingkar kepala (cm)'],
  ['kebutuhanKhusus', 'Kebutuhan khusus'],
  ['sekolahAsal', 'PAUD/KB asal']
];

const DETAIL_ORTU = [
  ['nama', 'Nama'],
  ['nik', 'NIK'],
  ['tahunLahir', 'Tahun lahir'],
  ['pendidikan', 'Pendidikan'],
  ['pekerjaan', 'Pekerjaan'],
  ['penghasilan', 'Penghasilan per bulan']
];

function namaOrtu(p) {
  return (p.ayah && p.ayah.nama) || (p.ibu && p.ibu.nama) || (p.wali && p.wali.nama) || '-';
}

function kvList(defs, data) {
  return (
    '<dl style="margin:0">' +
    defs
      .map(([k, l]) => {
        let v = data ? data[k] : '';
        if (k === 'tanggalLahir') v = fmtTanggal(v);
        if (k === 'jk') v = v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : v;
        return '<div class="kv"><dt>' + esc(l) + '</dt><dd>' + val(v) + '</dd></div>';
      })
      .join('') +
    '</dl>'
  );
}

function detailHtml(p, s) {
  const riwayat = (p.riwayat || [])
    .slice()
    .reverse()
    .map((r) => '<li><span class="time">' + esc(fmtWaktu(r.waktu)) + '</span>' + esc(r.aksi) + ' <span class="muted">oleh ' + esc(r.oleh) + '</span></li>')
    .join('');
  return (
    '<dl style="margin:0">' +
    '<div class="kv"><dt>No. Pendaftaran</dt><dd><strong>' + esc(p.id) + '</strong></dd></div>' +
    '<div class="kv"><dt>Tanggal daftar</dt><dd>' + esc(fmtWaktu(p.tanggalDaftar)) + '</dd></div>' +
    '<div class="kv"><dt>Usia (per ' + esc(fmtTanggal(s.tanggalAcuanUsia)) + ')</dt><dd>' + esc(hitungUsia(p.anak.tanggalLahir, s.tanggalAcuanUsia)) + '</dd></div>' +
    '<div class="kv"><dt>No. HP orang tua</dt><dd>' + val(p.hp) + '</dd></div>' +
    '<div class="kv"><dt>Status verifikasi</dt><dd>' + badgeStatus(p.status) + '</dd></div>' +
    '<div class="kv"><dt>Hasil seleksi</dt><dd>' + badgeKeputusan(p) + '</dd></div>' +
    (p.catatan ? '<div class="kv"><dt>Catatan verifikasi</dt><dd>' + esc(p.catatan) + '</dd></div>' : '') +
    (p.diverifikasiOleh ? '<div class="kv"><dt>Diverifikasi oleh</dt><dd>' + esc(p.diverifikasiOleh) + ' (' + esc(fmtWaktu(p.tanggalVerifikasi)) + ')</dd></div>' : '') +
    '</dl>' +
    '<div class="detail-head">Data Calon Peserta Didik</div>' + kvList(DETAIL_ANAK, p.anak) +
    '<div class="detail-head">Data Ayah</div>' + kvList(DETAIL_ORTU, p.ayah) +
    '<div class="detail-head">Data Ibu</div>' + kvList(DETAIL_ORTU, p.ibu) +
    (p.wali && p.wali.nama ? '<div class="detail-head">Data Wali</div>' + kvList(DETAIL_ORTU, p.wali) : '') +
    berkasSectionHtml(p) +
    '<div class="detail-head">Riwayat Proses</div><ul class="timeline mt">' + (riwayat || '<li>Belum ada riwayat</li>') + '</ul>'
  );
}

function filterPendaftar(list, q, status, keputusan) {
  const kw = (q || '').trim().toLowerCase();
  return list.filter((p) => {
    const cocokKata = !kw || p.anak.nama.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw) || namaOrtu(p).toLowerCase().includes(kw);
    const cocokStatus = !status || p.status === status;
    const cocokKeputusan = !keputusan || (keputusan === 'Belum' ? !p.keputusan : p.keputusan === keputusan);
    return cocokKata && cocokStatus && cocokKeputusan;
  });
}

function berkasBadge(p) {
  const n = BERKAS.length - berkasKurang(p).length;
  return '<span class="badge ' + (n === BERKAS.length ? 'badge-accept' : 'badge-fix') + '">' + n + '/' + BERKAS.length + '</span>';
}

function pendaftarTable(list, s) {
  if (!list.length) return '<div class="empty">Tidak ada data pendaftar</div>';
  const rows = list
    .map(
      (p, i) =>
        '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><div class="bold">' + esc(p.anak.nama) + '</div><div class="muted small">' + esc(p.id) + '</div></td>' +
        '<td>' + esc(p.anak.jk) + '</td>' +
        '<td>' + esc(hitungUsia(p.anak.tanggalLahir, s.tanggalAcuanUsia)) + '</td>' +
        '<td>' + esc(namaOrtu(p)) + '<div class="muted small">' + esc(p.hp) + '</div></td>' +
        '<td>' + esc(fmtTanggal(p.tanggalDaftar)) + '</td>' +
        '<td>' + berkasBadge(p) + '</td>' +
        '<td>' + badgeStatus(p.status) + '</td>' +
        '<td>' + badgeKeputusan(p) + '</td>' +
        '<td><button type="button" class="btn btn-sm" data-act="periksa" data-id="' + esc(p.id) + '">Periksa</button></td>' +
        '</tr>'
    )
    .join('');
  return (
    '<div class="table-wrap"><table><thead><tr><th>No</th><th>Calon Peserta Didik</th><th>JK</th><th>Usia</th><th>Orang Tua</th><th>Tgl Daftar</th><th>Berkas</th><th>Verifikasi</th><th>Hasil</th><th>Aksi</th></tr></thead><tbody>' +
    rows +
    '</tbody></table></div>'
  );
}

function modalHead(p) {
  return (
    '<div class="modal-head"><div><h3 class="mb-0">' + esc(p.anak.nama) + '</h3><div class="muted small">' + esc(p.id) + '</div></div>' +
    '<button class="modal-close" type="button" id="mClose">&times;</button></div>'
  );
}

function verifikasiHtml(p) {
  if (p.keputusan) {
    return '<div class="alert alert-info mt">Sudah ada keputusan akhir (' + esc(p.keputusan) + '). Verifikasi tidak dapat diubah selama keputusan masih berlaku.</div>';
  }
  const kurang = berkasKurang(p);
  const pilihan = ['Terverifikasi', 'Perlu Perbaikan']
    .map((o) => '<option value="' + o + '"' + (p.status === o ? ' selected' : '') + '>' + o + '</option>')
    .join('');
  return (
    '<div class="card mt" style="box-shadow:none;border:1px solid var(--border)">' +
    '<h3>Verifikasi Data</h3>' +
    (kurang.length ? '<div class="alert alert-warn">Berkas belum lengkap: ' + esc(kurang.join(', ')) + '. Data belum dapat ditandai terverifikasi.</div>' : '') +
    '<div id="vAlert" class="alert hidden"></div>' +
    '<div class="form-grid">' +
    '<div class="form-group full"><label for="vStatus">Hasil verifikasi</label><select id="vStatus">' + pilihan + '</select></div>' +
    '<div class="form-group full"><label for="vCatatan">Catatan</label><textarea id="vCatatan" maxlength="500">' + esc(p.catatan) + '</textarea>' +
    '<span class="help">Wajib diisi jika data perlu diperbaiki. Catatan akan terlihat oleh orang tua.</span></div>' +
    '</div>' +
    '<div class="form-actions"><button type="button" class="btn btn-success" id="vSimpan">Simpan Verifikasi</button></div>' +
    '</div>'
  );
}

function bindVerifikasi(root, p, onDone) {
  const btn = root.querySelector('#vSimpan');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const al = root.querySelector('#vAlert');
    hideAlert(al);
    btn.disabled = true;
    try {
      const upd = await Api.verifikasi(p.id, root.querySelector('#vStatus').value, root.querySelector('#vCatatan').value.trim());
      toast('Verifikasi disimpan', 'success');
      onDone(upd);
    } catch (err) {
      showAlert(al, err.message);
      btn.disabled = false;
    }
  });
}

function statHtml(label, value, kind) {
  return '<div class="stat ' + (kind || '') + '"><div class="stat-value">' + esc(value) + '</div><div class="stat-label">' + esc(label) + '</div></div>';
}
