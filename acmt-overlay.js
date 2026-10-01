(function() {
  if (document.getElementById('metrik-overlay-container')) {
    document.getElementById('metrik-overlay-container').remove();
  }

  // Inject Overlay Container
  const container = document.createElement('div');
  container.id = 'metrik-overlay-container';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;background:#f8fafc;overflow-y:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1e293b;';
  document.body.appendChild(container);

  // Helper to load external scripts sequentially
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Helper to load CSS
  function loadStyle(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  async function init() {
    // 1. Load Tailwind if needed
    if (!window.tailwind) {
      await loadScript('https://cdn.tailwindcss.com');
    }

    // 2. Load Vue 3 if needed
    if (!window.Vue) {
      await loadScript('https://unpkg.com/vue@3/dist/vue.global.prod.js');
    }

    // 3. Load Lucide if needed
    if (!window.lucide) {
      await loadScript('https://unpkg.com/lucide@latest');
    }

    // Custom CSS for thumb-img and scrollbars
    const customStyle = document.createElement('style');
    customStyle.textContent = `
      #metrik-overlay-container [v-cloak] { display: none; }
      #metrik-overlay-container ::-webkit-scrollbar { width: 6px; height: 6px; }
      #metrik-overlay-container ::-webkit-scrollbar-track { background: #f1f5f9; }
      #metrik-overlay-container ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      #metrik-overlay-container ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      .metrik-thumb { transition: transform 0.15s ease-in-out; }
      .metrik-thumb:hover { transform: scale(1.08); z-index: 20; }
    `;
    document.head.appendChild(customStyle);

    // 4. Inject HTML Template
    container.innerHTML = `
      <div id="metrik-vue-app" v-cloak class="flex flex-col min-h-screen bg-slate-50 text-slate-800">
        <!-- Header -->
        <header class="bg-[#142952] text-white px-5 py-2.5 shadow-md flex items-center justify-between sticky top-0 z-50">
          <div class="flex items-center space-x-4">
            <div class="w-8 h-8 rounded bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-slate-900 font-black shadow-sm text-sm">
              ⚡
            </div>
            <div>
              <div class="text-base font-black tracking-wide leading-none flex items-center gap-1.5">
                <span>METRIK - ACMT</span>
                <span class="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-400/30">MODE TAB RESMI ACMT</span>
              </div>
              <div class="text-[10px] tracking-widest text-cyan-300 font-bold uppercase mt-0.5">
                Fast Review Dashboard
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-3">
            <button 
              @click="closeOverlay" 
              class="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow-sm">
              <span>✕ Tutup / Kembali ke ACMT</span>
            </button>
          </div>
        </header>

        <!-- Main Body -->
        <main class="flex-1 p-4 max-w-[1920px] w-full mx-auto flex flex-col space-y-3.5">
          <!-- Ingestion Card -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5">
            <div class="flex flex-col md:flex-row items-stretch gap-3">
              <div class="relative flex-1">
                <textarea 
                  v-model="rawPasteInput" 
                  placeholder="Paste baris data Excel di sini (bisa 1 kolom IDPEL saja atau kolom lengkap NO, UNIT, IDPEL, NAMA, KDDK, PETUGAS, LWBPPAKAI)..."
                  rows="2"
                  class="w-full pl-3 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"></textarea>
              </div>
              <div class="flex items-center space-x-2">
                <button 
                  @click="handleTarikFotoClick" 
                  :disabled="!rawPasteInput.trim() && items.length === 0"
                  class="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition whitespace-nowrap h-full">
                  <span>📥 Tarik Foto (ACMT)</span>
                </button>
              </div>
            </div>

            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div class="flex flex-wrap items-center gap-3">
                <span>💡 Salin langsung dari Excel lalu paste ke kotak di atas.</span>
                <button @click="loadSampleData" class="text-blue-600 hover:underline font-semibold">
                  ✨ Muat Contoh 10 IDPEL (Demo)
                </button>
              </div>
              <div class="flex items-center space-x-2 font-mono text-[10px]">
                <span class="text-slate-400">Shortcut:</span>
                <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">1 = Sesuai</span>
                <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">2 = Salah</span>
              </div>
            </div>
          </div>

          <!-- Controls Bar -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center space-x-2">
              <div class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                Total: <span class="font-bold font-mono">{{ metrics.total }}</span>
              </div>
              <div class="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800">
                Sesuai: <span class="font-bold font-mono">{{ metrics.sesuai }}</span>
              </div>
              <div class="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-800">
                Tidak Sesuai: <span class="font-bold font-mono">{{ metrics.tidakSesuai }}</span>
              </div>
              <div class="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800">
                Pending: <span class="font-bold font-mono">{{ metrics.pending }}</span>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <button 
                @click="exportCSV" 
                :disabled="items.length === 0"
                class="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition shadow-sm">
                <span>📊 Export CSV</span>
              </button>
              <button 
                @click="retryAllImages" 
                class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition">
                <span>🔄 Tarik Ulang Semua Foto</span>
              </button>
              <button 
                @click="resetQueue" 
                class="bg-white border border-slate-300 hover:bg-slate-50 text-rose-600 font-semibold text-xs px-3 py-2 rounded-lg transition">
                <span>🗑️ Reset</span>
              </button>
            </div>
          </div>

          <!-- Pagination & Controls Bar -->
          <div class="flex flex-wrap items-center justify-between text-xs text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
            <div class="flex items-center space-x-3">
              <span>Menampilkan: <strong class="text-blue-700 font-mono">{{ items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0 }} - {{ Math.min(currentPage * pageSize, items.length) }}</strong> dari <strong class="text-slate-900 font-mono">{{ items.length }}</strong> Pelanggan</span>
              <span class="text-slate-300">|</span>
              <label class="flex items-center space-x-1.5 font-semibold text-slate-600">
                <span>Per Halaman:</span>
                <select v-model.number="pageSize" @change="currentPage = 1" class="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option :value="50">50 Baris</option>
                  <option :value="100">100 Baris</option>
                  <option :value="300">300 Baris (Semua)</option>
                  <option :value="1000">1.000 Baris (Semua)</option>
                </select>
              </label>
            </div>

            <div class="flex items-center space-x-2">
              <button 
                @click="currentPage = Math.max(1, currentPage - 1)" 
                :disabled="currentPage === 1"
                class="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 font-bold text-xs transition">
                ◀ Prev
              </button>
              <span class="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Hal {{ currentPage }} / {{ totalPages }}
              </span>
              <button 
                @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                :disabled="currentPage >= totalPages"
                class="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 font-bold text-xs transition">
                Next ▶
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100/90 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[10px] font-black">
                    <th class="py-2.5 px-2 text-center w-12">NO</th>
                    <th class="py-2.5 px-2 text-center w-14">UNIT</th>
                    <th class="py-2.5 px-3 font-black text-blue-900 w-32">IDPEL</th>
                    <th class="py-2.5 px-2">NAMA</th>
                    <th class="py-2.5 px-2 text-center">KDDK</th>
                    <th class="py-2.5 px-2 text-center">PETUGAS</th>
                    <th class="py-2.5 px-2 text-center">LWBPPAKAI</th>
                    <th v-for="month in targetMonths" :key="month" class="py-2.5 px-1 text-center w-20 text-slate-700 font-bold whitespace-nowrap">
                      {{ formatMonthHeader(month) }}
                    </th>
                    <th class="py-2.5 px-2 text-center w-24 text-emerald-800 font-bold bg-emerald-50/70 border-x border-emerald-100">
                      FOTO RUMAH
                    </th>
                    <th class="py-2.5 px-3 text-center w-40">KEPUTUSAN AUDIT</th>
                    <th class="py-2.5 px-3 w-48">KETERANGAN</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-if="paginatedItems.length === 0">
                    <td :colspan="10 + targetMonths.length" class="py-12 text-center text-slate-400">
                      <p class="font-semibold text-sm text-slate-600">Antrean audit masih kosong</p>
                      <p class="text-xs text-slate-400 mt-1">Paste baris data Excel IDPEL di kotak atas untuk mulai mengaudit.</p>
                      <button @click="loadSampleData" class="mt-3 text-xs bg-sky-50 text-sky-600 border border-sky-200 font-semibold px-3 py-1.5 rounded-lg hover:bg-sky-100">
                        Muat 10 Contoh Data Sekarang
                      </button>
                    </td>
                  </tr>

                  <tr 
                    v-for="(item, idx) in paginatedItems" 
                    :key="item.idpel"
                    :class="[
                      focusedRowIndex === idx ? 'bg-sky-50/60 ring-1 ring-sky-300' : 'hover:bg-slate-50/80',
                      item.status === 'sesuai' ? 'bg-emerald-50/20' : '',
                      item.status === 'salah' ? 'bg-rose-50/25' : ''
                    ]"
                    @click="focusedRowIndex = idx"
                    class="transition-colors duration-100">
                    
                    <td class="py-2.5 px-2 text-center font-mono text-slate-400 font-semibold">
                      {{ (currentPage - 1) * pageSize + idx + 1 }}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <span class="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-mono">{{ item.unit || '-' }}</span>
                    </td>
                    <td class="py-2.5 px-3 font-mono font-bold text-blue-700 hover:text-blue-900 cursor-pointer" @click="copyToClipboard(item.idpel)">
                      {{ item.idpel }}
                    </td>
                    <td class="py-2.5 px-2 text-slate-700 truncate max-w-[120px]" :title="item.nama">{{ item.nama || '-' }}</td>
                    <td class="py-2.5 px-2 text-center font-mono text-slate-600">{{ item.kddk || '-' }}</td>
                    <td class="py-2.5 px-2 text-center text-slate-600">{{ item.petugas || '-' }}</td>
                    <td class="py-2.5 px-2 text-center font-mono font-semibold text-slate-700">{{ item.lwbppakai || '-' }}</td>

                    <!-- 6 Months Photos -->
                    <td v-for="month in targetMonths" :key="month" class="py-2 px-1 text-center align-middle">
                      <div class="w-16 h-20 mx-auto rounded border border-slate-200 bg-slate-100 overflow-hidden relative shadow-xs flex items-center justify-center group select-none">
                        <img 
                          v-if="!imageErrors[getImgKey(item.idpel, month, 'meter')]"
                          :key="getImgKey(item.idpel, month, 'meter') + '_' + renderVersion"
                          :src="getPhotoUrl(item.idpel, month, 'meter')" 
                          :alt="month" 
                          loading="lazy"
                          class="w-full h-full object-cover metrik-thumb cursor-pointer"
                          @click="openLightbox(item, month, 'meter')"
                          @error="onImageError(item.idpel, month, 'meter')"
                          @load="onImageSuccess(item.idpel, month, 'meter')" />
                        
                        <!-- Fallback Card -->
                        <div v-else class="w-full h-full flex flex-col items-center justify-center p-1 bg-slate-50 text-[9px] text-slate-500 leading-tight">
                          <span class="font-bold text-[8px] text-slate-600">Gagal Muat</span>
                          <div class="flex items-center space-x-1 mt-1">
                            <button @click.stop="retryImage(item.idpel, month, 'meter')" class="p-0.5 px-1 bg-sky-100 text-sky-700 rounded font-bold text-[8px]">Muat</button>
                            <a :href="getDirectAcmtUrl(item.idpel, month, 'meter')" target="_blank" class="p-0.5 px-1 bg-slate-200 text-slate-700 rounded font-bold text-[8px]">Link</a>
                          </div>
                        </div>

                        <!-- Hover Controls -->
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center space-x-1 transition opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                          <button @click.stop="openLightbox(item, month, 'meter')" title="Perbesar" class="p-1 rounded bg-black/70 text-white hover:bg-black">🔍</button>
                          <a :href="getDirectAcmtUrl(item.idpel, month, 'meter')" target="_blank" @click.stop title="Tab Baru" class="p-1 rounded bg-black/70 text-cyan-300 hover:bg-blue-600">↗</a>
                        </div>
                      </div>
                    </td>

                    <!-- Foto Rumah -->
                    <td class="py-2 px-1.5 text-center align-middle bg-emerald-50/20 border-x border-emerald-100/60">
                      <div class="w-16 h-20 mx-auto rounded border border-emerald-200 bg-slate-100 overflow-hidden relative shadow-xs flex items-center justify-center group select-none">
                        <img 
                          v-if="!imageErrors[getImgKey(item.idpel, targetMonths[0], 'rumah')]"
                          :key="getImgKey(item.idpel, targetMonths[0], 'rumah') + '_' + renderVersion"
                          :src="getPhotoUrl(item.idpel, targetMonths[0], 'rumah')" 
                          alt="Foto Rumah" 
                          loading="lazy"
                          class="w-full h-full object-cover metrik-thumb cursor-pointer"
                          @click="openLightbox(item, targetMonths[0], 'rumah')"
                          @error="onImageError(item.idpel, targetMonths[0], 'rumah')"
                          @load="onImageSuccess(item.idpel, targetMonths[0], 'rumah')" />

                        <div v-else class="w-full h-full flex flex-col items-center justify-center p-1 bg-emerald-50/40 text-[9px] text-slate-500 leading-tight">
                          <span class="font-bold text-[8px] text-slate-600">Gagal Muat</span>
                          <div class="flex items-center space-x-1 mt-1">
                            <button @click.stop="retryImage(item.idpel, targetMonths[0], 'rumah')" class="p-0.5 px-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[8px]">Muat</button>
                            <a :href="getDirectAcmtUrl(item.idpel, targetMonths[0], 'rumah')" target="_blank" class="p-0.5 px-1 bg-slate-200 text-slate-700 rounded font-bold text-[8px]">Link</a>
                          </div>
                        </div>

                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center space-x-1 transition opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                          <button @click.stop="openLightbox(item, targetMonths[0], 'rumah')" title="Perbesar" class="p-1 rounded bg-black/70 text-white hover:bg-black">🔍</button>
                          <a :href="getDirectAcmtUrl(item.idpel, targetMonths[0], 'rumah')" target="_blank" @click.stop title="Tab Baru" class="p-1 rounded bg-black/70 text-cyan-300 hover:bg-blue-600">↗</a>
                        </div>
                      </div>
                    </td>

                    <!-- Keputusan Audit -->
                    <td class="py-2.5 px-3 text-center align-middle">
                      <div class="flex items-center justify-center space-x-1.5">
                        <button 
                          @click.stop="setAuditDecision(item, 'sesuai', idx)"
                          :class="item.status === 'sesuai' ? 'bg-emerald-600 text-white font-bold shadow-sm ring-2 ring-emerald-400' : 'bg-white text-slate-700 border border-slate-300 hover:bg-emerald-50'"
                          class="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition">
                          <span>✓ Sesuai</span>
                        </button>
                        <button 
                          @click.stop="setAuditDecision(item, 'salah', idx)"
                          :class="item.status === 'salah' ? 'bg-rose-600 text-white font-bold shadow-sm ring-2 ring-rose-400' : 'bg-white text-slate-700 border border-slate-300 hover:bg-rose-50'"
                          class="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition">
                          <span>✕ Salah</span>
                        </button>
                      </div>
                    </td>

                    <!-- Keterangan -->
                    <td class="py-2.5 px-3 align-middle">
                      <input 
                        v-model="item.catatan" 
                        type="text" 
                        placeholder="Catatan..." 
                        class="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Table Footer Pagination -->
            <div class="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
              <span class="text-slate-500">Total <strong class="text-slate-800 font-mono">{{ items.length }}</strong> IDPEL dalam antrean audit</span>
              <div class="flex items-center space-x-2">
                <button 
                  @click="currentPage = Math.max(1, currentPage - 1)" 
                  :disabled="currentPage === 1"
                  class="px-3 py-1 rounded border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white font-semibold text-xs">
                  ◀ Sebelumnya
                </button>
                <span class="font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">Hal {{ currentPage }} dari {{ totalPages }}</span>
                <button 
                  @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                  :disabled="currentPage >= totalPages"
                  class="px-3 py-1 rounded border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white font-semibold text-xs">
                  Berikutnya ▶
                </button>
              </div>
            </div>
          </div>
        </main>

        <!-- Lightbox Modal -->
        <div v-if="lightbox.show" class="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col z-[99999999] p-4">
          <div class="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div class="text-sm font-bold flex items-center space-x-2">
              <span class="text-cyan-400 font-mono">{{ lightbox.item?.idpel }}</span>
              <span class="text-slate-400">&bull;</span>
              <span class="text-slate-200">{{ lightbox.item?.nama || 'Pelanggan' }}</span>
              <span class="text-slate-400">&bull;</span>
              <span class="bg-blue-600 px-2 py-0.5 rounded text-xs uppercase font-bold">{{ lightbox.type === 'meter' ? 'Meter ' + lightbox.month : 'Foto Rumah' }}</span>
            </div>
            <div class="flex items-center space-x-3 text-xs">
              <button @click="lightboxZoom = Math.max(0.5, lightboxZoom - 0.25)" class="bg-white/10 hover:bg-white/20 p-2 rounded-lg font-bold">➖</button>
              <span class="font-mono text-xs w-12 text-center">{{ Math.round(lightboxZoom * 100) }}%</span>
              <button @click="lightboxZoom = Math.min(3, lightboxZoom + 0.25)" class="bg-white/10 hover:bg-white/20 p-2 rounded-lg font-bold">➕</button>
              <button @click="lightboxRotate = (lightboxRotate + 90) % 360" class="bg-white/10 hover:bg-white/20 p-2 rounded-lg font-bold">🔄 Putar</button>
              <button @click="lightboxZoom = 1; lightboxRotate = 0" class="bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg text-[11px]">Reset</button>
              <button @click="lightbox.show = false" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold">✕ Tutup</button>
            </div>
          </div>
          <div class="flex-1 flex items-center justify-center overflow-hidden relative my-2">
            <img 
              :src="getPhotoUrl(lightbox.item?.idpel, lightbox.month, lightbox.type)" 
              :style="{ transform: 'scale(' + lightboxZoom + ') rotate(' + lightboxRotate + 'deg)', transition: 'transform 0.15s ease' }"
              class="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none" />
          </div>
          <div class="flex items-center justify-between text-white pt-2 border-t border-white/10">
            <div class="flex items-center space-x-2">
              <button 
                v-for="m in targetMonths" 
                :key="m"
                @click="lightbox.month = m; lightbox.type = 'meter'"
                :class="lightbox.month === m && lightbox.type === 'meter' ? 'border-cyan-400 bg-cyan-900/60' : 'border-white/20 bg-white/5'"
                class="text-[10px] px-2 py-1 rounded border font-mono font-bold hover:bg-white/20">
                {{ formatMonthHeader(m) }}
              </button>
              <button 
                @click="lightbox.type = 'rumah'"
                :class="lightbox.type === 'rumah' ? 'border-emerald-400 bg-emerald-900/60' : 'border-white/20 bg-white/5'"
                class="text-[10px] px-2 py-1 rounded border font-mono font-bold hover:bg-white/20 text-emerald-300">
                FOTO RUMAH
              </button>
            </div>
            <div class="flex items-center space-x-2">
              <button @click="setAuditDecision(lightbox.item, 'sesuai', focusedRowIndex)" class="bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg text-xs font-bold">✓ Sesuai (1)</button>
              <button @click="setAuditDecision(lightbox.item, 'salah', focusedRowIndex)" class="bg-rose-600 hover:bg-rose-700 px-4 py-1.5 rounded-lg text-xs font-bold">✕ Salah (2)</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 5. Mount Vue Application
    const { createApp, ref, reactive, computed, nextTick } = Vue;

    createApp({
      setup() {
        const rawPasteInput = ref('');
        const items = ref([]);
        const focusedRowIndex = ref(0);
        const currentPage = ref(1);
        const pageSize = ref(50);
        const targetMonths = ref(['202610', '202609', '202608', '202607', '202606', '202605']);
        const imageErrors = reactive({});
        const renderVersion = ref(1);

        const lightbox = reactive({
          show: false,
          item: null,
          month: '',
          type: 'meter',
        });
        const lightboxZoom = ref(1);
        const lightboxRotate = ref(0);

        function closeOverlay() {
          container.style.display = 'none';
        }

        function getImgKey(idpel, blth, type = 'meter') {
          return idpel + '_' + blth + '_' + type;
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
          Object.keys(imageErrors).forEach(k => delete imageErrors[k]);
          renderVersion.value++;
        }

        function formatMonthHeader(blth) {
          if (!blth || blth.length < 6) return blth;
          const year = blth.substring(0, 4);
          const monthNum = parseInt(blth.substring(4, 6), 10);
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
          return (months[monthNum - 1] || '') + ' ' + year;
        }

        // Relative URL directly to ACMT on current domain
        function getDirectAcmtUrl(idpel, blth, type = 'meter') {
          if (!idpel || !blth) return '#';
          const fotoke = type === 'rumah' ? '2' : 'null';
          return '/acmt/DisplayBlobServlet1?idpel=' + encodeURIComponent(idpel) + '&nomor_meter=null&fotoke=' + fotoke + '&blth=' + encodeURIComponent(blth) + '&isPhoto=null';
        }

        function getPhotoUrl(idpel, blth, type = 'meter') {
          return getDirectAcmtUrl(idpel, blth, type);
        }

        function copyToClipboard(text) {
          navigator.clipboard.writeText(text);
          alert('IDPEL ' + text + ' berhasil disalin!');
        }

        function parseAndLoadInput() {
          const text = rawPasteInput.value.trim();
          if (!text) return;
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          const parsed = [];

          // If there's only 1 line, check if multiple IDPELs separated by space, comma, semicolon
          if (lines.length === 1 && !lines[0].includes('\t')) {
            const tokens = lines[0].split(/[\s,;]+/).map(t => t.replace(/\D/g, '').trim()).filter(t => t.length >= 8);
            if (tokens.length > 1) {
              tokens.forEach((id, i) => {
                parsed.push({
                  no: String(i + 1),
                  unit: '-',
                  idpel: id,
                  nama: '-',
                  kddk: '-',
                  petugas: '-',
                  lwbppakai: '-',
                  status: 'pending',
                  catatan: '',
                });
              });
              const existingIds = new Set(items.value.map(i => i.idpel));
              const newItems = parsed.filter(p => !existingIds.has(p.idpel));
              if (newItems.length > 0) {
                const startNo = items.value.length;
                newItems.forEach((item, idx) => { item.no = String(startNo + idx + 1); });
                items.value = [...items.value, ...newItems];
              }
              currentPage.value = 1;
              rawPasteInput.value = '';
              retryAllImages();
              return;
            }
          }

          lines.forEach((line, index) => {
            const cols = line.split('\t');
            const firstCol = cols[0].trim().toUpperCase();
            if (firstCol === 'NO' || firstCol === 'IDPEL' || firstCol === 'UNIT') return;

            if (cols.length >= 7) {
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
              const tokens = line.split(/[\s,;]+/).map(t => t.replace(/\D/g, '').trim()).filter(t => t.length >= 8);
              if (tokens.length > 0) {
                tokens.forEach(id => {
                  parsed.push({
                    no: String(parsed.length + 1),
                    unit: '-',
                    idpel: id,
                    nama: '-',
                    kddk: '-',
                    petugas: '-',
                    lwbppakai: '-',
                    status: 'pending',
                    catatan: '',
                  });
                });
              }
            }
          });

          if (parsed.length > 0) {
            const existingIds = new Set(items.value.map(i => i.idpel));
            const newItems = parsed.filter(p => !existingIds.has(p.idpel));
            if (newItems.length > 0) {
              const startNo = items.value.length;
              newItems.forEach((item, idx) => { item.no = String(startNo + idx + 1); });
              items.value = [...items.value, ...newItems];
            }
            currentPage.value = 1;
            rawPasteInput.value = '';
            retryAllImages();
          } else {
            alert('Tidak ada baris IDPEL valid yang terdeteksi.');
          }
        }

        function handleTarikFotoClick() {
          if (rawPasteInput.value.trim()) {
            parseAndLoadInput();
          } else if (items.value.length > 0) {
            retryAllImages();
          }
        }

        function setAuditDecision(item, status, index) {
          if (!item) return;
          item.status = status;
          if (index < paginatedItems.value.length - 1) {
            focusedRowIndex.value = index + 1;
          }
        }

        function handleKeyDown(e) {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          const currentList = paginatedItems.value;
          if (currentList.length === 0) return;

          if (e.key === '1') {
            const item = currentList[focusedRowIndex.value];
            if (item) setAuditDecision(item, 'sesuai', focusedRowIndex.value);
          } else if (e.key === '2') {
            const item = currentList[focusedRowIndex.value];
            if (item) setAuditDecision(item, 'salah', focusedRowIndex.value);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (focusedRowIndex.value < currentList.length - 1) focusedRowIndex.value++;
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (focusedRowIndex.value > 0) focusedRowIndex.value--;
          }
        }

        function exportCSV() {
          if (items.value.length === 0) return;
          const headers = ['NO', 'UNIT', 'IDPEL', 'NAMA', 'KDDK', 'PETUGAS', 'LWBPPAKAI', 'KEPUTUSAN_AUDIT', 'KETERANGAN'];
          const rows = items.value.map((item, i) => [
            i + 1,
            '"' + (item.unit || '-') + '"',
            '"' + item.idpel + '"',
            '"' + (item.nama || '-') + '"',
            '"' + (item.kddk || '-') + '"',
            '"' + (item.petugas || '-') + '"',
            '"' + (item.lwbppakai || '-') + '"',
            '"' + (item.status ? item.status.toUpperCase() : 'PENDING') + '"',
            '"' + (item.catatan || '').replace(/"/g, '""') + '"',
          ]);
          const csvContent = 'data:text/csv;charset=utf-8,\\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', 'HASIL_AUDIT_ACMT_' + new Date().toISOString().slice(0, 10) + '.csv');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        function resetQueue() {
          if (confirm('Kosongkan antrean audit?')) {
            items.value = [];
            currentPage.value = 1;
            rawPasteInput.value = '';
            Object.keys(imageErrors).forEach(k => delete imageErrors[k]);
          }
        }

        function openLightbox(item, month, type = 'meter') {
          lightbox.item = item;
          lightbox.month = month;
          lightbox.type = type;
          lightboxZoom.value = 1;
          lightboxRotate.value = 0;
          lightbox.show = true;
        }

        function loadSampleData() {
          items.value = [
            { no: '1', unit: 'MDN01', idpel: '124150540656', nama: 'ACHMAD SYUKRI', kddk: '01A', petugas: 'BAMBANG', lwbppakai: '245', status: 'pending', catatan: '' },
            { no: '2', unit: 'MDN01', idpel: '124150563478', nama: 'H. NASUTION', kddk: '01B', petugas: 'BAMBANG', lwbppakai: '180', status: 'pending', catatan: '' },
            { no: '3', unit: 'MDN02', idpel: '124000011058', nama: 'SITI AMINAH', kddk: '02A', petugas: 'SURYA', lwbppakai: '310', status: 'pending', catatan: '' },
          ];
          currentPage.value = 1;
          retryAllImages();
        }

        const metrics = computed(() => {
          let sesuai = 0, tidakSesuai = 0, pending = 0;
          items.value.forEach(item => {
            if (item.status === 'sesuai') sesuai++;
            else if (item.status === 'salah') tidakSesuai++;
            else pending++;
          });
          return { total: items.value.length, sesuai, tidakSesuai, pending };
        });

        const paginatedItems = computed(() => {
          const start = (currentPage.value - 1) * pageSize.value;
          return items.value.slice(start, start + pageSize.value);
        });

        const totalPages = computed(() => {
          return Math.max(1, Math.ceil(items.value.length / pageSize.value));
        });

        window.addEventListener('keydown', handleKeyDown);

        return {
          rawPasteInput,
          items,
          focusedRowIndex,
          currentPage,
          pageSize,
          totalPages,
          targetMonths,
          imageErrors,
          renderVersion,
          lightbox,
          lightboxZoom,
          lightboxRotate,
          metrics,
          paginatedItems,
          closeOverlay,
          getImgKey,
          onImageError,
          onImageSuccess,
          retryImage,
          retryAllImages,
          formatMonthHeader,
          getPhotoUrl,
          getDirectAcmtUrl,
          copyToClipboard,
          handleTarikFotoClick,
          setAuditDecision,
          exportCSV,
          resetQueue,
          openLightbox,
          loadSampleData,
        };
      }
    }).mount('#metrik-vue-app');
  }

  init().catch(err => alert('Gagal memuat overlay METRIK: ' + err));
})();
