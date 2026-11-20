(function () {
  const user = Auth.require(['guru']);
  if (!user) return;

  mountTopbar();

  const $ = (id) => document.getElementById(id);

  let settings = {};
  let list = [];

  $('namaUser').textContent = user.nama;
  $('btnPassword').addEventListener('click', changePasswordDialog);

  function renderStat(st) {
    $('statGrid').innerHTML =
      statHtml('Total pendaftar', st.total) +
      statHtml('Menunggu verifikasi', st.menungguVerifikasi, 'warn') +
      statHtml('Perlu perbaikan', st.perluPerbaikan, 'warn') +
      statHtml('Terverifikasi', st.terverifikasi, 'ok');
  }

  function renderTabel() {
    const hasil = filterPendaftar(list, $('cari').value, $('filterStatus').value, '');
    $('jumlahTampil').textContent = hasil.length + ' dari ' + list.length + ' data';
    $('tabelWrap').innerHTML = pendaftarTable(hasil, settings);
  }

  $('cari').addEventListener('input', renderTabel);
  $('filterStatus').addEventListener('change', renderTabel);

  $('tabelWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="periksa"]');
    if (b) periksa(b.dataset.id);
  });

  function periksa(id) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    const b = openModal(modalHead(p) + detailHtml(p, settings) + verifikasiHtml(p));
    b.querySelector('#mClose').onclick = closeModal;
    bindBerkas(b);
    bindVerifikasi(b, p, async () => {
      closeModal();
      await loadAll();
    });
  }

  async function loadAll() {
    try {
      const [s, l, st] = await Promise.all([Api.pengaturan(), Api.listPendaftar(), Api.statistik()]);
      settings = s;
      list = l.slice().sort((a, b) => {
        const rank = (p) => (p.status === 'Menunggu Verifikasi' ? 0 : p.status === 'Perlu Perbaikan' ? 1 : 2);
        return rank(a) - rank(b) || a.id.localeCompare(b.id);
      });
      renderStat(st);
      renderTabel();
    } catch (err) {
      $('tabelWrap').innerHTML = '<div class="alert alert-error">' + esc(err.message) + '</div>';
    }
  }

  loadAll();
})();
