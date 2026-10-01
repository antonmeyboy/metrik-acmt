const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // Navigation & View State
    const activeTab = ref('audit');
    const auditorUnit = ref('UID SUMUT');
    const showConfigModal = ref(false);
    const showResetModal = ref(false);

    // Configuration
    const config = reactive({
      acmtBaseUrl: 'https://portalapp.iconpln.co.id/acmt/DisplayBlobServlet1',
      acmtCookie: '',
      hasCookie: false,
      targetMonths: ['202610', '202609', '202608', '202607', '202606', '202605'],
      targetMonthsText: '202610, 202609, 202608, 202607, 202606, 202605',
      fotoRumahFotoke: '2',
      fotoMeterFotoke: 'null',
      imageSourceMode: 'direct', // 'direct' = Browser langsung buka link ACMT; 'proxy' = Lewat server
      simulatedMode: false,
      concurrencyLimit: 5,
    });

    // Ingestion & Data
    const rawPasteInput = ref('');
    const items = ref([]);
    const focusedRowIndex = ref(0);

    // Pagination
    const currentPage = ref(1);
    const pageSize = ref(50);

    // Batch Status
    const batchStatus = reactive({
      isRunning: false,
      total: 0,
      processed: 0,
      currentIdpel: '',
      errors: 0,
    });
    let batchPollInterval = null;

    // Lightbox
    const lightbox = reactive({
      show: false,
      item: null,
      month: '',
      type: 'meter',
    });
    const lightboxZoom = ref(1);
    const lightboxRotate = ref(0);

    // History Sessions
    const historySessions = ref([]);

    // Computed Properties
    const totalPages = computed(() => Math.ceil(items.value.length / pageSize.value) || 1);

    const paginatedItems = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      return items.value.slice(start, start + pageSize.value);
    });

    const paginationRange = computed(() => {
      if (items.value.length === 0) return '0 - 0';
      const start = (currentPage.value - 1) * pageSize.value + 1;
      const end = Math.min(currentPage.value * pageSize.value, items.value.length);
      return `${start} - ${end}`;
    });

    const metrics = computed(() => {
      let sesuai = 0;
      let tidakSesuai = 0;
      let pending = 0;

      items.value.forEach((item) => {
        if (item.status === 'sesuai') sesuai++;
        else if (item.status === 'salah') tidakSesuai++;
        else pending++;
      });

      return {
        total: items.value.length,
        sesuai,
        tidakSesuai,
        pending,
      };
    });

    const pageAuditedCount = computed(() => {
      return paginatedItems.value.filter((i) => i.status === 'sesuai' || i.status === 'salah').length;
    });

    const batchProgressPercent = computed(() => {
      if (!batchStatus.total) return 0;
      return Math.round((batchStatus.processed / batchStatus.total) * 100);
    });

    // Helpers
    function formatMonthHeader(blth) {
      if (!blth || blth.length < 6) return blth;
      const year = blth.substring(0, 4);
      const monthNum = parseInt(blth.substring(4, 6), 10);
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
      return `${months[monthNum - 1] || ''} ${year}`;
    }

    function getDirectAcmtUrl(idpel, blth, type = 'meter') {
      if (!idpel || !blth) return '#';
      const fotokeVal = type === 'rumah' ? (config.fotoRumahFotoke || '2') : (config.fotoMeterFotoke || 'null');
      const baseUrl = config.acmtBaseUrl || 'https://portalapp.iconpln.co.id/acmt/DisplayBlobServlet1';
      return `${baseUrl}?idpel=${encodeURIComponent(idpel)}&nomor_meter=null&fotoke=${fotokeVal}&blth=${encodeURIComponent(blth)}&isPhoto=null`;
    }

    function getPhotoUrl(idpel, blth, type = 'meter') {
      if (!idpel || !blth) return '';
      if (config.simulatedMode) {
        return `/api/photo?idpel=${encodeURIComponent(idpel)}&blth=${encodeURIComponent(blth)}&type=${encodeURIComponent(type)}`;
      }
      if (config.imageSourceMode === 'direct') {
        return getDirectAcmtUrl(idpel, blth, type);
      }
      return `/api/photo?idpel=${encodeURIComponent(idpel)}&blth=${encodeURIComponent(blth)}&type=${encodeURIComponent(type)}`;
    }

    function handleImageError(event) {
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200" fill="#f8fafc"><rect width="100%" height="100%" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" rx="6"/><text x="80" y="95" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="11" font-weight="700">TIDAK ADA</text><text x="80" y="112" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="11" font-weight="700">FOTO</text></svg>';
    }

    function openDirectUrl(idpel, blth, type = 'meter') {
      const url = getDirectAcmtUrl(idpel, blth, type);
      window.open(url, '_blank');
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text);
      alert(`IDPEL ${text} berhasil disalin!`);
    }

    // Parsing Excel Data Input
    function parseAndLoadInput() {
      const text = rawPasteInput.value.trim();
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsed = [];

      lines.forEach((line, index) => {
        const cols = line.split('\t');

        // Check if header row
        const firstCol = cols[0].trim().toUpperCase();
        if (firstCol === 'NO' || firstCol === 'IDPEL' || firstCol === 'UNIT') {
          return; // skip header
        }

        if (cols.length >= 7) {
          // Full Excel row: NO, UNIT, IDPEL, NAMA, KDDK, PETUGAS, LWBPPAKAI
          parsed.push({
            no: cols[0].trim() || String(index + 1),
            unit: cols[1].trim() || '-',
            idpel: cols[2].replace(/\D/g, '').trim(),
            nama: cols[3].trim() || '-',
            kddk: cols[4].trim() || '-',
            petugas: cols[5].trim() || '-',
            lwbppakai: cols[6].trim() || '-',
            status: 'pending',
            catatan: '',
          });
        } else if (cols.length >= 3 && cols[2].replace(/\D/g, '').length >= 10) {
          parsed.push({
            no: cols[0].trim() || String(index + 1),
            unit: cols[1].trim() || '-',
            idpel: cols[2].replace(/\D/g, '').trim(),
            nama: cols[3]?.trim() || '-',
            kddk: cols[4]?.trim() || '-',
            petugas: cols[5]?.trim() || '-',
            lwbppakai: cols[6]?.trim() || '-',
            status: 'pending',
            catatan: '',
          });
        } else {
          // Just raw IDPEL or single column
          const rawId = line.replace(/\D/g, '').trim();
          if (rawId.length >= 8) {
            parsed.push({
              no: String(parsed.length + 1),
              unit: '-',
              idpel: rawId,
              nama: '-',
              kddk: '-',
              petugas: '-',
              lwbppakai: '-',
              status: 'pending',
              catatan: '',
            });
          }
        }
      });

      if (parsed.length > 0) {
        items.value = parsed;
        currentPage.value = 1;
        rawPasteInput.value = '';
        triggerBatchPrefetch();
      } else {
        alert('Tidak ada baris IDPEL valid yang terdeteksi dari data yang di-paste.');
      }
    }

    // Trigger batch photo download in background
    async function triggerBatchPrefetch() {
      const idpelList = items.value.map((i) => i.idpel);
      try {
        const res = await fetch('/api/batch-prefetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idpels: idpelList,
            blthList: config.targetMonths,
            forceRefresh: false,
          }),
        });
        const data = await res.json();
        if (data.success) {
          startBatchPolling();
        }
      } catch (err) {
        console.error('Error starting batch prefetch:', err);
      }
    }

    function startBatchPolling() {
      if (batchPollInterval) clearInterval(batchPollInterval);
      batchPollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/batch-status');
          const data = await res.json();
          Object.assign(batchStatus, data);
          if (!data.isRunning) {
            clearInterval(batchPollInterval);
          }
        } catch (e) {
          clearInterval(batchPollInterval);
        }
      }, 1000);
    }

    async function cancelBatch() {
      await fetch('/api/batch-cancel', { method: 'POST' });
      batchStatus.isRunning = false;
      if (batchPollInterval) clearInterval(batchPollInterval);
    }

    // Audit Decisions
    function setAuditDecision(item, status, idx) {
      if (!item) return;
      if (item.status === status) {
        item.status = 'pending';
      } else {
        item.status = status;
        if (status === 'salah') {
          // focus catatan input
          nextTick(() => {
            const input = document.querySelector(`textarea[ref="catatan_${idx}"]`);
            if (input) input.focus();
          });
        }
      }
    }

    // Keyboard Shortcuts
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      if (lightbox.show) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === '1') {
          setAuditDecision(lightbox.item, 'sesuai');
          closeLightbox();
        }
        if (e.key === '2') {
          setAuditDecision(lightbox.item, 'salah');
          closeLightbox();
        }
        return;
      }

      const currentList = paginatedItems.value;
      if (currentList.length === 0) return;

      if (e.key === '1') {
        const item = currentList[focusedRowIndex.value];
        if (item) {
          setAuditDecision(item, 'sesuai', focusedRowIndex.value);
          if (focusedRowIndex.value < currentList.length - 1) {
            focusedRowIndex.value++;
          }
        }
      } else if (e.key === '2') {
        const item = currentList[focusedRowIndex.value];
        if (item) {
          setAuditDecision(item, 'salah', focusedRowIndex.value);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedRowIndex.value < currentList.length - 1) {
          focusedRowIndex.value++;
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedRowIndex.value > 0) {
          focusedRowIndex.value--;
        }
      }
    }

    // Lightbox Modal
    function openLightbox(item, month, type = 'meter') {
      lightbox.item = item;
      lightbox.month = month;
      lightbox.type = type;
      lightbox.show = true;
      lightboxZoom.value = 1;
      lightboxRotate.value = 0;
      nextTick(() => lucide.createIcons());
    }

    function closeLightbox() {
      lightbox.show = false;
      lightbox.item = null;
    }

    // Actions
    async function saveAndLockDB() {
      if (items.value.length === 0) return;
      try {
        const res = await fetch('/api/audit/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditor: auditorUnit.value,
            records: items.value,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert(`Sukses! ${data.message} (Sesi: ${data.sessionId})`);
          loadHistorySessions();
        }
      } catch (err) {
        alert('Gagal menyimpan hasil: ' + err.message);
      }
    }

    function exportCSV() {
      if (items.value.length === 0) return;
      const headers = ['NO', 'UNIT', 'IDPEL', 'NAMA', 'KDDK', 'PETUGAS', 'LWBPPAKAI', 'KEPUTUSAN_AUDIT', 'KETERANGAN'];
      const rows = items.value.map((item, i) => [
        i + 1,
        `"${item.unit || '-'}"`,
        `"${item.idpel}"`,
        `"${item.nama || '-'}"`,
        `"${item.kddk || '-'}"`,
        `"${item.petugas || '-'}"`,
        `"${item.lwbppakai || '-'}"`,
        `"${item.status ? item.status.toUpperCase() : 'PENDING'}"`,
        `"${(item.catatan || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `HASIL_AUDIT_ACMT_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function resetQueue() {
      if (confirm('Apakah Anda yakin ingin mengosongkan antrean audit saat ini?')) {
        items.value = [];
        currentPage.value = 1;
        rawPasteInput.value = '';
      }
    }

    async function refreshEmptyCache() {
      try {
        const res = await fetch('/api/clear-empty-cache', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Cache kosong berhasil dibersihkan.');
        triggerBatchPrefetch();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    // History Session Management
    async function loadHistorySessions() {
      try {
        const res = await fetch('/api/audit/sessions');
        historySessions.value = await res.json();
      } catch (err) {
        console.error('Error loading history:', err);
      }
    }

    async function loadSessionIntoQueue(sessionId) {
      try {
        const res = await fetch(`/api/audit/session/${sessionId}`);
        const data = await res.json();
        if (data && data.records) {
          items.value = data.records;
          activeTab.value = 'audit';
          currentPage.value = 1;
        }
      } catch (err) {
        alert('Gagal membuka sesi: ' + err.message);
      }
    }

    function exportSessionCSV(sessionId) {
      loadSessionIntoQueue(sessionId).then(() => exportCSV());
    }

    // Config Management
    async function loadServerConfig() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        Object.assign(config, data);
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }

    async function saveServerConfig() {
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const data = await res.json();
        if (data.success) {
          alert('Pengaturan berhasil disimpan!');
          showConfigModal.value = false;
        }
      } catch (err) {
        alert('Gagal menyimpan pengaturan: ' + err.message);
      }
    }

    function openWhatsAppModal() {
      const phone = prompt('Masukkan nomor WhatsApp Petugas / Pengawas (misal 628123456789):', '628');
      if (phone) {
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
      }
    }

    // Demo Data
    function loadSampleData() {
      const samples = [
        { no: '1', unit: 'MDN01', idpel: '124150540656', nama: 'ACHMAD SYUKRI', kddk: '01A', petugas: 'BAMBANG', lwbppakai: '245', status: 'pending', catatan: '' },
        { no: '2', unit: 'MDN01', idpel: '124150563478', nama: 'H. NASUTION', kddk: '01B', petugas: 'BAMBANG', lwbppakai: '180', status: 'pending', catatan: '' },
        { no: '3', unit: 'MDN02', idpel: '124000011058', nama: 'SITI AMINAH', kddk: '02A', petugas: 'SURYA', lwbppakai: '310', status: 'pending', catatan: '' },
        { no: '4', unit: 'MDN02', idpel: '124000152063', nama: 'PT MAKMUR SENTOSA', kddk: '02B', petugas: 'SURYA', lwbppakai: '1450', status: 'pending', catatan: '' },
        { no: '5', unit: 'MDN03', idpel: '124000511652', nama: 'RUDI HERMAWAN', kddk: '03A', petugas: 'ANDI', lwbppakai: '95', status: 'pending', catatan: '' },
        { no: '6', unit: 'MDN03', idpel: '124000855166', nama: 'SRI WAHYUNI', kddk: '03B', petugas: 'ANDI', lwbppakai: '215', status: 'pending', catatan: '' },
        { no: '7', unit: 'MDN04', idpel: '124011175876', nama: 'DEDI KURNIAWAN', kddk: '04A', petugas: 'FARHAN', lwbppakai: '420', status: 'pending', catatan: '' },
        { no: '8', unit: 'MDN04', idpel: '124011294821', nama: 'CV KARYA UTAMA', kddk: '04B', petugas: 'FARHAN', lwbppakai: '880', status: 'pending', catatan: '' },
        { no: '9', unit: 'MDN05', idpel: '124012384912', nama: 'HASANUDDIN', kddk: '05A', petugas: 'IRFAN', lwbppakai: '160', status: 'pending', catatan: '' },
        { no: '10', unit: 'MDN05', idpel: '124013948201', nama: 'YUSUF EFENDI', kddk: '05B', petugas: 'IRFAN', lwbppakai: '290', status: 'pending', catatan: '' },
      ];
      items.value = samples;
      currentPage.value = 1;
      nextTick(() => lucide.createIcons());
      triggerBatchPrefetch();
    }

    onMounted(() => {
      loadServerConfig();
      loadHistorySessions();
      window.addEventListener('keydown', handleKeyDown);
      nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    });

    return {
      activeTab,
      auditorUnit,
      showConfigModal,
      showResetModal,
      config,
      rawPasteInput,
      items,
      focusedRowIndex,
      currentPage,
      pageSize,
      totalPages,
      paginatedItems,
      paginationRange,
      metrics,
      pageAuditedCount,
      batchStatus,
      batchProgressPercent,
      lightbox,
      lightboxZoom,
      lightboxRotate,
      historySessions,
      formatMonthHeader,
      getPhotoUrl,
      getDirectAcmtUrl,
      openDirectUrl,
      handleImageError,
      copyToClipboard,
      parseAndLoadInput,
      cancelBatch,
      setAuditDecision,
      openLightbox,
      closeLightbox,
      saveAndLockDB,
      exportCSV,
      resetQueue,
      refreshEmptyCache,
      loadHistorySessions,
      loadSessionIntoQueue,
      exportSessionCSV,
      saveServerConfig,
      openWhatsAppModal,
      loadSampleData,
    };
  },
}).mount('#app');
