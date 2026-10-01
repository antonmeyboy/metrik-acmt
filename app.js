const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // Navigation & View State
    const activeTab = ref('audit');
    const auditorUnit = ref('UID SUMUT');
    const showConfigModal = ref(false);
    const showResetModal = ref(false);
    const showBookmarkletModal = ref(false);
    const showHelpModal = ref(false);

    // Configuration
    const config = reactive({
      acmtBaseUrl: 'https://portalapp.iconpln.co.id/acmt/DisplayBlobServlet1',
      acmtCookie: '',
      hasCookie: false,
      targetMonths: ['202610', '202609', '202608', '202607', '202606', '202605'],
      targetMonthsText: '202610, 202609, 202608, 202607, 202606, 202605',
      fotoRumahFotoke: '2',
      fotoMeterFotoke: 'null',
      imageSourceMode: 'direct', // 'direct' = Browser langsung (bebas IP US), 'proxy' = Lewat server
      simulatedMode: false,
      concurrencyLimit: 5,
    });

    // Ingestion & Data
    const rawPasteInput = ref('');
    const items = ref([]);
    const focusedRowIndex = ref(0);

    // Reactive Tracking for Images
    const imageErrors = reactive({});
    const renderVersion = ref(1);

    function getImgKey(idpel, blth, type = 'meter') {
      return `${idpel}_${blth}_${type}`;
    }

    function onImageError(idpel, blth, type = 'meter') {
      imageErrors[getImgKey(idpel, blth, type)] = true;
    }

    function onImageSuccess(idpel, blth, type = 'meter') {
      delete imageErrors[getImgKey(idpel, blth, type)];
    }

    function retryImage(idpel, blth, type = 'meter') {
      delete imageErrors[getImgKey(idpel, blth, type)];
      renderVersion.value++;
    }

    function retryAllImages() {
      // Clear all tracked error states
      Object.keys(imageErrors).forEach((key) => {
        delete imageErrors[key];
      });
      renderVersion.value++;

      if (config.imageSourceMode === 'proxy') {
        triggerBatchPrefetch(true);
      }
    }

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

    // Bookmarklet Code snippet
    const bookmarkletCode = computed(() => {
      const origin = window.location.origin || 'https://web-production-6ff77.up.railway.app';
      return `javascript:(function(){var c=document.cookie;if(!c){alert('Tidak ada cookie yang terdeteksi. Pastikan login di portalapp.iconpln.co.id');return;}fetch('${origin}/api/sync-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:c})}).then(function(r){return r.json();}).then(function(d){alert('✅ Sesi ACMT Berhasil Disinkronkan ke METRIK!\\nSilakan kembali ke tab METRIK dan klik Tarik Foto.');}).catch(function(e){alert('Gagal menyinkronkan: '+e);});})();`;
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
        return `/api/photo?idpel=${encodeURIComponent(idpel)}&blth=${encodeURIComponent(blth)}&type=${encodeURIComponent(type)}&v=${renderVersion.value}`;
      }
      if (config.imageSourceMode === 'direct') {
        // Return pure exact ACMT URL without modifying parameters
        return getDirectAcmtUrl(idpel, blth, type);
      }
      return `/api/photo?idpel=${encodeURIComponent(idpel)}&blth=${encodeURIComponent(blth)}&type=${encodeURIComponent(type)}&v=${renderVersion.value}`;
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
        retryAllImages();
      } else {
        alert('Tidak ada baris IDPEL valid yang terdeteksi dari data yang di-paste.');
      }
    }

    function handleTarikFotoClick() {
      if (rawPasteInput.value.trim()) {
        parseAndLoadInput();
      } else if (items.value.length > 0) {
        retryAllImages();
        alert('Sedang menarik ulang foto untuk semua IDPEL dalam antrean...');
      }
    }

    // Trigger batch photo download in background (Proxy mode only)
    async function triggerBatchPrefetch(forceRefresh = false) {
      if (config.imageSourceMode !== 'proxy') return;

      const idpelList = items.value.map((i) => i.idpel);
      if (idpelList.length === 0) return;

      try {
        const res = await fetch('/api/batch-prefetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idpels: idpelList,
            months: config.targetMonths,
            forceRefresh,
          }),
        });
        const data = await res.json();
        if (data.success) {
          startBatchPolling();
        }
      } catch (err) {
        console.error('Batch prefetch trigger error:', err);
      }
    }

    function startBatchPolling() {
      if (batchPollInterval) clearInterval(batchPollInterval);
      batchPollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/batch-status');
          const status = await res.json();
          Object.assign(batchStatus, status);
          if (!status.isRunning) {
            clearInterval(batchPollInterval);
            batchPollInterval = null;
          }
        } catch (e) {
          clearInterval(batchPollInterval);
        }
      }, 1000);
    }

    async function cancelBatch() {
      try {
        await fetch('/api/batch-cancel', { method: 'POST' });
        batchStatus.isRunning = false;
        if (batchPollInterval) clearInterval(batchPollInterval);
      } catch (e) {
        console.error(e);
      }
    }

    // Audit Decision Actions
    function setAuditDecision(item, status, index) {
      item.status = status;
      // Auto move focus to next row
      if (index < paginatedItems.value.length - 1) {
        focusedRowIndex.value = index + 1;
      }
    }

    // Keyboard Shortcuts
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentList = paginatedItems.value;
      if (currentList.length === 0) return;

      if (e.key === '1') {
        const item = currentList[focusedRowIndex.value];
        if (item) {
          setAuditDecision(item, 'sesuai', focusedRowIndex.value);
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
        Object.keys(imageErrors).forEach((k) => delete imageErrors[k]);
      }
    }

    async function refreshEmptyCache() {
      try {
        const res = await fetch('/api/clear-empty-cache', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Cache kosong berhasil dibersihkan.');
        retryAllImages();
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
          retryAllImages();
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
        if (data) {
          // Preserve direct mode unless server explicitly configured
          if (data.imageSourceMode) {
            config.imageSourceMode = data.imageSourceMode;
          }
          if (data.targetMonths && Array.isArray(data.targetMonths)) {
            config.targetMonths = data.targetMonths;
            config.targetMonthsText = data.targetMonths.join(', ');
          }
          config.hasCookie = data.hasCookie;
          config.acmtCookie = data.acmtCookie || '';
          config.simulatedMode = !!data.simulatedMode;
        }
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }

    async function saveServerConfig() {
      try {
        if (config.targetMonthsText) {
          config.targetMonths = config.targetMonthsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const data = await res.json();
        if (data.success) {
          alert('Pengaturan berhasil disimpan!');
          showConfigModal.value = false;
          retryAllImages();
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
      retryAllImages();
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
      showBookmarkletModal,
      showHelpModal,
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
      bookmarkletCode,
      imageErrors,
      renderVersion,
      getImgKey,
      onImageError,
      onImageSuccess,
      retryImage,
      retryAllImages,
      handleTarikFotoClick,
      lightbox,
      lightboxZoom,
      lightboxRotate,
      historySessions,
      formatMonthHeader,
      getPhotoUrl,
      getDirectAcmtUrl,
      openDirectUrl,
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
