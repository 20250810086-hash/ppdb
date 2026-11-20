(function () {
  const $ = (id) => document.getElementById(id);

  mountTopbar();

  if (Auth.token() && Auth.user()) {
    Api.me()
      .then((u) => location.replace(Auth.home(u.role)))
      .catch(() => Auth.clear());
  }

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $('panelLogin').classList.toggle('hidden', name !== 'login');
    $('panelRegister').classList.toggle('hidden', name !== 'register');
    hideAlert($('loginAlert'));
    hideAlert($('registerAlert'));
  }

  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnLogin');
    hideAlert($('loginAlert'));
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    try {
      const res = await Api.login($('loginUsername').value.trim(), $('loginPassword').value);
      Auth.save(res.token, res.user);
      location.replace(Auth.home(res.user.role));
    } catch (err) {
      showAlert($('loginAlert'), err.message);
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });

  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnRegister');
    hideAlert($('registerAlert'));
    if ($('regPassword').value !== $('regPassword2').value) {
      showAlert($('registerAlert'), 'Konfirmasi password tidak sama');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    try {
      const username = $('regUsername').value.trim().toLowerCase();
      await Api.register({
        nama: $('regNama').value.trim(),
        hp: $('regHp').value.trim(),
        username,
        password: $('regPassword').value
      });
      $('registerForm').reset();
      switchTab('login');
      $('loginUsername').value = username;
      $('loginPassword').focus();
      showAlert($('loginAlert'), 'Akun berhasil dibuat. Silakan masuk.', 'success');
    } catch (err) {
      showAlert($('registerAlert'), err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buat Akun';
    }
  });

  function row(label, value) {
    return '<div class="kv"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
  }

  async function loadInfo() {
    try {
      const s = await Api.pengaturan();
      $('heroTahun').textContent = s.tahunAjaran;
      const badge = $('statusBuka');
      badge.textContent = s.dibuka ? 'Pendaftaran DIBUKA' : 'Pendaftaran DITUTUP';
      badge.className = 'badge ' + (s.dibuka ? 'badge-accept' : 'badge-reject');
      $('infoList').innerHTML =
        row('Tahun ajaran', esc(s.tahunAjaran)) +
        row('Mulai', esc(fmtTanggal(s.tanggalMulai))) +
        row('Berakhir', esc(fmtTanggal(s.tanggalSelesai))) +
        row('Usia minimal', esc(s.usiaMinimal) + ' tahun per ' + esc(fmtTanggal(s.tanggalAcuanUsia))) +
        row('Alamat', esc(s.alamat)) +
        row('Kontak', esc(s.kontak));
      $('kuotaList').innerHTML = Object.keys(s.kuota)
        .map(
          (k) =>
            '<div class="stat"><div class="stat-value">' + esc(s.kuota[k]) + '</div><div class="stat-label">Kuota ' + esc(k) + '</div></div>'
        )
        .join('');
      $('footAlamat').textContent = s.alamat;
    } catch (err) {
      $('infoList').innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
    }
  }

  loadInfo();
})();
