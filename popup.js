// popup.js - Universal Media Grabber Pro v30.10.0

const t = (key, ...args) => {
    let msg = chrome.i18n.getMessage(key, args);
    return msg || key;
};

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();

    const listDiv = document.getElementById('list');
    const countBadge = document.getElementById('countBadge');
    const clearAllBtn = document.getElementById('clearAll');
    const clearDownloadedBtn = document.getElementById('clearDownloaded');
    const downloadAllBtn = document.getElementById('downloadAll');
    const downloadZipBtn = document.getElementById('downloadZip');
    const selectAllCheckbox = document.getElementById('selectAll');
    const searchBox = document.getElementById('searchBox');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const toastMsg = document.getElementById('toastMsg');
    const toastBox = document.getElementById('toast');
    const settingsPanel = document.getElementById('settingsPanel');
    const scanPageBtn = document.getElementById('scanPageBtn');

    const exportBtn = document.getElementById('exportBtn');
    const exportMenu = document.getElementById('exportMenu');
    const exportTxtBtn = document.getElementById('exportTxtBtn');
    const copyUrlsBtn = document.getElementById('copyUrlsBtn');

    const domainRuleBar = document.getElementById('domainRuleBar');
    const currentDomainEl = document.getElementById('currentDomain');
    const domainRuleSelect = document.getElementById('domainRuleSelect');

    const videoModal = document.getElementById('videoModal');
    const videoPlayer = document.getElementById('videoPlayer');
    const detailsModal = document.getElementById('detailsModal');
    const detailsBody = document.getElementById('detailsBody');
    const helpModal = document.getElementById('helpModal');

    let currentAudio = null;
    let currentAudioUrl = null;
    let activeAudioBtn = null;
    let activeVideoBtn = null;
    const playIcon = '▶';
    const pauseIcon = '⏸';

    let allItems = [];
    let selectedUrls = new Set();
    let currentFilter = 'all';
    let currentSort = 'newest';
    let currentTabDomain = "";
    let openDetailsItem = null;

    const icons = { play: `▶`, edit: `✏️`, dl: `⬇️`, copy: `📋`, del: `🗑️`, scorm: `📦`, video: `🎬`, audio: `🎵`, pdf: `📄`, menu: `⋮` };

    selectAllCheckbox.title = t('selectAllTooltip');
    clearSearchBtn.title = t('searchClearTooltip');
    exportBtn.title = t('exportBtnTooltip');

    document.getElementById('helpToggle').onclick = () => helpModal.classList.add('open');
    document.getElementById('helpClose').onclick = () => helpModal.classList.remove('open');
    document.getElementById('helpCloseFooter').onclick = () => helpModal.classList.remove('open');
    helpModal.onclick = (e) => { if (e.target === helpModal) helpModal.classList.remove('open'); };

    document.addEventListener('click', (e) => {
        if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) exportMenu.classList.remove('open');
        document.querySelectorAll('.dropdown-menu.open').forEach(m => {
            if (!m.closest('.dropdown-wrap').contains(e.target)) m.classList.remove('open');
        });
    });

    exportBtn.onclick = (e) => { e.stopPropagation(); exportMenu.classList.toggle('open'); };

    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (s) => {
        if (!s) return;
        document.getElementById('folderNameInput').value = s.folderName || 'UMG_Downloads';
        document.getElementById('namingMethod').value = s.namingMethod || 'smart';
        document.getElementById('customNameInput').value = s.customName || '';
        document.getElementById('addDomain').checked = !!s.addDomain;
        document.getElementById('addDate').checked = !!s.addDate;
        document.getElementById('addTime').checked = !!s.addTime;
        document.getElementById('adShieldEnabled').checked = s.adShieldEnabled !== false;
        document.getElementById('organizeByType').checked = !!s.organizeByType;
        document.getElementById('autoClearCheck').checked = !!s.autoClear;
        document.getElementById('devModeCheck').checked = !!s.devMode;
        document.getElementById('notificationsCheck').checked = s.notificationsEnabled !== false;
        if (s.namingMethod === 'custom') document.getElementById('customNameContainer').style.display = 'block';
    });

    document.getElementById('namingMethod').onchange = (e) => {
        document.getElementById('customNameContainer').style.display = e.target.value === 'custom' ? 'block' : 'none';
    };
    document.getElementById('settingsToggle').onclick = () => { settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block'; };
    document.getElementById('settingsClose').onclick = () => { settingsPanel.style.display = 'none'; };

    document.getElementById('saveSettings').onclick = () => {
        const toSave = {
            folderName: document.getElementById('folderNameInput').value.trim() || 'UMG_Downloads',
            namingMethod: document.getElementById('namingMethod').value,
            customName: document.getElementById('customNameInput').value.trim(),
            addDomain: document.getElementById('addDomain').checked,
            addDate: document.getElementById('addDate').checked,
            addTime: document.getElementById('addTime').checked,
            adShieldEnabled: document.getElementById('adShieldEnabled').checked,
            organizeByType: document.getElementById('organizeByType').checked,
            autoClear: document.getElementById('autoClearCheck').checked,
            devMode: document.getElementById('devModeCheck').checked,
            notificationsEnabled: document.getElementById('notificationsCheck').checked
        };
        chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings: toSave }, () => {
            showToast('toastSettingsSaved', 'success');
            settingsPanel.style.display = 'none';
        });
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url) return;
        try {
            const u = new URL(tabs[0].url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
            currentTabDomain = u.hostname.replace('www.', '');
            if (!currentTabDomain) return;
            currentDomainEl.textContent = currentTabDomain;
            domainRuleBar.classList.add('visible');
            chrome.runtime.sendMessage({ action: 'GET_DOMAIN_RULE', domain: currentTabDomain }, (res) => {
                domainRuleSelect.value = (res && res.rule) || 'all';
            });
        } catch(e) {}
    });

    domainRuleSelect.onchange = () => {
        if (!currentTabDomain) return;
        chrome.runtime.sendMessage({ action: 'SET_DOMAIN_RULE', domain: currentTabDomain, rule: domainRuleSelect.value }, () => {
            showToast('toastRuleUpdated', 'success');
        });
    };

    function showToast(msgKey, type = '', ...args) {
        toastMsg.textContent = t(msgKey, ...args);
        toastBox.className = "show" + (type ? " " + type : "");
        const dur = type === 'warning' ? 4000 : 2500;
        setTimeout(() => toastBox.className = "", dur);
    }

    function parseSize(s) {
        if (!s || s === "API Çözümlendi" || s === "Sayfa Linki" || s === "Akış (Stream)") return 0;
        let n = parseFloat(s); if (s.includes("KB")) n /= 1024; return n;
    }
    function formatSize(bytes, sizeStr) {
        if (!bytes) return sizeStr || "? MB";
        const mb = bytes / 1024 / 1024;
        if (mb < 1) return (bytes / 1024).toFixed(1) + " KB";
        return mb.toFixed(2) + " MB";
    }
    function formatBytes(bytes) {
        if (!bytes) return "—";
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }
    function formatTime(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        const d = new Date(ts);
        const hm = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        if (mins < 1) return 'Az önce';
        if (mins < 60) return mins + ' dk önce';
        if (mins < 1440) return hm;
        if (mins < 7 * 1440) {
            const days = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
            const dayLabel = Math.floor(mins/1440) === 1 ? 'Dün' : days[d.getDay()];
            return dayLabel + ' ' + hm;
        }
        const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
        return d.getDate() + ' ' + months[d.getMonth()] + ', ' + hm;
    }

    function getCurrentFilteredItems() {
        const term = searchBox.value.toLowerCase().trim();
        return allItems.filter(item => {
            if (term && !item.filename.toLowerCase().includes(term)) return false;
            if (currentFilter === 'all') return true;
            if (currentFilter === 'downloaded') return !!item.downloaded;
            if (currentFilter === 'PDF') return item.type === 'PDF' || item.type === 'PDF/Belge' || item.type === 'Arşiv';
            return item.type === currentFilter;
        });
    }

    function updateDisplay() {
        let filtered = getCurrentFilteredItems();
        filtered.sort((a, b) => {
            if (currentSort === 'newest') return (b.timestamp || 0) - (a.timestamp || 0);
            if (currentSort === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
            if (currentSort === 'name_asc') return a.filename.localeCompare(b.filename, 'tr');
            if (currentSort === 'name_desc') return b.filename.localeCompare(a.filename, 'tr');
            if (currentSort === 'size_desc') return parseSize(b.size) - parseSize(a.size);
            if (currentSort === 'size_asc') return parseSize(a.size) - parseSize(b.size);
            return 0;
        });

        // Toplam Boyut Hesaplama KISMI TAMAMEN SİLİNDİ
        
        renderListUI(filtered);
    }

    function renderListUI(items) {
        listDiv.innerHTML = '';
        if (items.length === 0) {
            listDiv.innerHTML = `<div class="empty-state">
                <div class="empty-icon">📭</div>
                <div>${t('emptyStateTitle')}</div>
                <div style="font-size:11px; margin-top:8px; color:var(--text-muted);">${t('emptyStateHint')}</div>
            </div>`;
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            if (selectedUrls.has(item.url)) div.classList.add('selected');
            if (item.downloaded) div.classList.add('downloaded');
            else if (item.downloading) div.classList.add('downloading');
            else if (item.downloadError) div.classList.add('error');

            const isVideo = item.type === 'Video' || (item.filename && item.filename.endsWith('.mp4'));
            const isAudio = item.type === 'Ses' || (item.filename && item.filename.endsWith('.mp3'));
            const isScorm = item.type === 'SCORM';
            const isPDF = item.type === 'PDF' || item.type === 'PDF/Belge';

            let fileIcon = icons.pdf;
            if (isVideo) fileIcon = icons.video;
            if (isAudio) fileIcon = icons.audio;
            if (isScorm) fileIcon = icons.scorm;

            // DÜZELTME BURADA: Her zaman gerçek türü göster, ama EBA ise turuncu renk ver.
            let tagClass = '';
            if (item.source === 'EBA') tagClass = 'eba';
            else if (item.source === 'Tarayıcı') tagClass = 'scan';
            
            let sourceTag = `<span class="tag ${tagClass}">${(item.type || 'DOSYA').toUpperCase()}</span>`;

            let statusBadge = '';
            if (item.downloaded) statusBadge = `<span class="status-badge downloaded">${t('statusDownloaded')}</span>`;
            else if (item.downloading) statusBadge = `<span class="status-badge downloading">${t('statusDownloading')}</span>`;
            else if (item.downloadError) statusBadge = `<span class="status-badge error">${t('statusError')}</span>`;

            let isCurrentlyPlaying = false;
            if (isAudio && currentAudioUrl === item.url && currentAudio && !currentAudio.paused) isCurrentlyPlaying = true;
            if (isVideo && videoPlayer.src === item.url && !videoPlayer.paused) isCurrentlyPlaying = true;
            
            let currentIcon = isCurrentlyPlaying ? pauseIcon : playIcon;
            let currentTitle = isCurrentlyPlaying ? t('actionPause') : t('actionPlay');

            const playBtnHtml = (isVideo || isAudio || isPDF)
                ? `<button class="icon-btn play-btn" data-url="${escapeAttr(item.url)}" title="${currentTitle}">${currentIcon}</button>` : '';

            const sizeText = formatSize(item.sizeBytes, item.size);
            const domainHtml = item.sourceDomain ? `<span class="sep">·</span><span class="domain">${item.sourceDomain}</span>` : '';
            const timeText = formatTime(item.timestamp);
            const timeHtml = timeText ? `<span class="sep">·</span><span>${timeText}</span>` : '';

            div.innerHTML = `
                <div class="check-col">
                    <input type="checkbox" class="item-checkbox" data-url="${escapeAttr(item.url)}" ${selectedUrls.has(item.url)?'checked':''}>
                </div>
                <div class="info-col">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <span class="name" title="${escapeAttr(item.filename)}">${escapeHtml(item.filename)}</span>
                        <div class="meta">
                            ${sourceTag}
                            <span class="sep">·</span>
                            <span>${sizeText}</span>
                            ${domainHtml}
                            ${timeHtml}
                            ${statusBadge}
                        </div>
                    </div>
                </div>
                <div class="action-col">
                    ${playBtnHtml}
                    <button class="icon-btn dl-btn" data-i18n-title="actionDownload" title="${t('actionDownload')}">${icons.dl}</button>
                    <button class="icon-btn del-btn" data-i18n-title="actionDelete" title="${t('actionDelete')}">${icons.del}</button>
                    <div class="dropdown-wrap">
                        <button class="icon-btn menu-btn" data-i18n-title="actionMenu" title="${t('actionMenu')}">${icons.menu}</button>
                        <div class="dropdown-menu">
                            <button data-action="rename">${t('actionRename')}</button>
                            <button data-action="copy">${t('actionCopyUrl')}</button>
                            <button data-action="saveas">${t('actionSaveAs')}</button>
                            <button data-action="details">${t('actionDetails')}</button>
                            <button data-action="blockUrl" class="danger-text">${t('actionBlockUrl')}</button>
                            <button data-action="blockSite" class="danger-text">${t('actionBlockSite')}</button>
                        </div>
                    </div>
                </div>
            `;

            div.querySelector('.item-checkbox').onchange = (e) => {
                if (e.target.checked) selectedUrls.add(item.url);
                else selectedUrls.delete(item.url);
                div.classList.toggle('selected', e.target.checked);
                updateDownloadButton();
            };

            const playBtn = div.querySelector('.play-btn');
            if (playBtn) {
                playBtn.onclick = () => {
                    if (isPDF) { window.open(item.url, '_blank'); return; }
                    const isPlaying = playBtn.textContent === pauseIcon;

                    if (isPlaying) {
                        if (isAudio && currentAudio) { currentAudio.pause(); activeAudioBtn = null; currentAudioUrl = null; }
                        else if (isVideo) { videoPlayer.pause(); activeVideoBtn = null; }
                        playBtn.textContent = playIcon;
                        playBtn.title = t('actionPlay');
                    } else {
                        if (currentAudio) {
                            currentAudio.pause();
                            if (activeAudioBtn) { activeAudioBtn.textContent = playIcon; activeAudioBtn.title = t('actionPlay'); }
                        }
                        if (!videoModal.classList.contains('open') && videoPlayer.src) {
                             if (activeVideoBtn) { activeVideoBtn.textContent = playIcon; activeVideoBtn.title = t('actionPlay'); }
                        }
                        if (isVideo) {
                            if (videoPlayer.src !== item.url) videoPlayer.src = item.url;
                            videoModal.classList.add('open');
                            videoPlayer.play().catch(() => showToast('toastPreviewFailed', 'warning'));
                            activeVideoBtn = playBtn;
                        } else if (isAudio) {
                            if (currentAudioUrl !== item.url) {
                                currentAudio = new Audio(item.url);
                                currentAudioUrl = item.url;
                                currentAudio.onended = () => {
                                    if (activeAudioBtn === playBtn) { playBtn.textContent = playIcon; playBtn.title = t('actionPlay'); activeAudioBtn = null; }
                                };
                            }
                            currentAudio.play().catch(() => showToast('toastPreviewFailed', 'warning'));
                            activeAudioBtn = playBtn;
                        }
                        playBtn.textContent = pauseIcon;
                        playBtn.title = t('actionPause');
                        if (isAudio) showToast('toastAudioPlaying', 'success');
                    }
                };
            }

            div.querySelector('.dl-btn').onclick = () => {
                if (item.type === 'SCORM') showToast('toastScormWarning', 'warning');
                chrome.runtime.sendMessage({ action: "DOWNLOAD_ITEM", url: item.url, filename: item.filename, type: item.type });
            };

            div.querySelector('.del-btn').onclick = () => {
                chrome.runtime.sendMessage({ action: "DELETE_ITEM", url: item.url }, () => {
                    selectedUrls.delete(item.url);
                    fetchAndRender();
                });
            };

            const menuBtn = div.querySelector('.menu-btn');
            const dropdown = div.querySelector('.dropdown-menu');
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m !== dropdown) m.classList.remove('open'); });
                dropdown.classList.toggle('open');
            };

            dropdown.querySelectorAll('button').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.remove('open');
                    const action = btn.dataset.action;
                    if (action === 'rename') {
                        const newName = prompt(t('promptRename'), item.filename.replace(/\.[^/.]+$/, ""));
                        if (newName && newName.trim()) chrome.runtime.sendMessage({ action: "RENAME_ITEM", url: item.url, newName: newName.trim() }, () => fetchAndRender());
                    } else if (action === 'copy') {
                        navigator.clipboard.writeText(item.url);
                        showToast('toastUrlCopied', 'success');
                    } else if (action === 'saveas') {
                        chrome.runtime.sendMessage({ action: "DOWNLOAD_ITEM", url: item.url, filename: item.filename, type: item.type, saveAs: true });
                    } else if (action === 'details') {
                        openDetailsModal(item);
                    } else if (action === 'blockUrl') {
                        chrome.runtime.sendMessage({ action: "BLOCK_URL", url: item.url }, () => {
                            selectedUrls.delete(item.url); showToast('toastBlockedUrl', 'warning'); fetchAndRender();
                        });
                    } else if (action === 'blockSite') {
                        if (!item.sourceDomain) return showToast('toastScanFailed', 'warning');
                        chrome.runtime.sendMessage({ action: "BLOCK_SITE", domain: item.sourceDomain }, () => {
                            selectedUrls.delete(item.url); showToast('toastBlockedSite', 'warning'); fetchAndRender();
                        });
                    }
                };
            });

            listDiv.appendChild(div);
        });

        selectAllCheckbox.checked = items.length > 0 && items.every(i => selectedUrls.has(i.url));
    }

    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function escapeAttr(s) { return escapeHtml(s); }

    function updateDownloadButton() {
        const count = selectedUrls.size;
        if (count > 0) downloadAllBtn.textContent = t('downloadSelected', count.toString());
        else downloadAllBtn.textContent = t('downloadAll');
    }

    function openDetailsModal(item) {
        openDetailsItem = item;
        const rows = [
            [t('detailsFileName'), escapeHtml(item.filename)],
            [t('detailsType'), escapeHtml(item.type || '—')],
            [t('detailsSize'), item.sizeBytes ? `${formatSize(item.sizeBytes)} <span style="color:var(--text-muted);font-size:11px;">(${formatBytes(item.sizeBytes)})</span>` : escapeHtml(item.size || '—')],
            [t('detailsSourceSite'), escapeHtml(item.sourceDomain || '—')],
            [t('detailsPageTitle'), escapeHtml(item.pageTitle || '—')],
            [t('detailsSource'), escapeHtml(item.source || '—')],
            [t('detailsCaptured'), item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'],
            [t('detailsStatus'), item.downloaded ? `${t('statusDownloaded')} (${item.downloadedAt ? new Date(item.downloadedAt).toLocaleString() : '—'})` : (item.downloading ? t('statusDownloading') : (item.downloadError ? `⚠️ ${escapeHtml(item.downloadError)}` : '⏸️'))]
        ];
        let html = rows.map(([k, v]) => `<div class="detail-row"><span class="key">${k}</span><span class="val">${v}</span></div>`).join('');
        html += `<div class="detail-row full"><span class="key">${t('detailsFullUrl')}</span><textarea class="detail-url" readonly>${escapeHtml(item.url)}</textarea></div>`;
        detailsBody.innerHTML = html;
        detailsModal.classList.add('open');
    }

    document.getElementById('detailsClose').onclick = () => { detailsModal.classList.remove('open'); };
    document.getElementById('detailsCloseFooter').onclick = () => { detailsModal.classList.remove('open'); };
    detailsModal.onclick = (e) => { if (e.target === detailsModal) detailsModal.classList.remove('open'); };
    document.getElementById('detailsCopyUrl').onclick = () => {
        if (openDetailsItem) { navigator.clipboard.writeText(openDetailsItem.url); showToast('toastUrlCopied', 'success'); }
    };

    selectAllCheckbox.onclick = () => {
        document.querySelectorAll('.item-checkbox').forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
            if (cb.checked) selectedUrls.add(cb.dataset.url);
            else selectedUrls.delete(cb.dataset.url);
            cb.closest('.item').classList.toggle('selected', cb.checked);
        });
        updateDownloadButton();
    };

    document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        updateDisplay();
    });
    document.getElementById('sortSelect').onchange = (e) => { currentSort = e.target.value; updateDisplay(); };
    searchBox.oninput = () => {
        clearSearchBtn.style.display = searchBox.value.length > 0 ? 'block' : 'none';
        updateDisplay();
    };
    clearSearchBtn.onclick = () => { searchBox.value = ''; clearSearchBtn.style.display = 'none'; updateDisplay(); searchBox.focus(); };
    document.getElementById('closePopup').onclick = () => window.close();

    downloadAllBtn.onclick = () => {
        const urls = selectedUrls.size > 0 ? Array.from(selectedUrls) : [];
        chrome.runtime.sendMessage({ action: "DOWNLOAD_LIST", urls: urls }, (res) => {
            if (res && res.count > 0) {
                if (res.skipped > 0) showToast('toastDownloadsStartedSkipped', 'success', res.count.toString(), res.skipped.toString());
                else showToast('toastDownloadsStarted', 'success', res.count.toString());
            } else if (res && res.skipped > 0) {
                showToast('toastAllDownloaded', 'warning');
            } else {
                showToast('toastNoFiles', 'warning');
            }
        });
    };

    downloadZipBtn.onclick = () => {
        const urls = selectedUrls.size > 0 ? Array.from(selectedUrls) : [];
        chrome.runtime.sendMessage({ action: "DOWNLOAD_ZIP", urls: urls });
        showToast('toastZipBuilding', 'success');
    };

    clearAllBtn.onclick = () => {
        const itemsToClear = getCurrentFilteredItems();
        if (itemsToClear.length === 0) return showToast('toastNoFiles', 'warning');
        if (confirm(t('confirmClearFiltered', itemsToClear.length.toString()))) {
            const urlsToClear = itemsToClear.map(i => i.url);
            chrome.runtime.sendMessage({ action: "CLEAR_LIST", urls: urlsToClear }, () => {
                urlsToClear.forEach(u => selectedUrls.delete(u));
                fetchAndRender();
            });
        }
    };

    clearDownloadedBtn.onclick = () => {
        const count = allItems.filter(i => i.downloaded).length;
        if (count === 0) { showToast('toastNoDownloadedItems', 'warning'); return; }
        if (confirm(t('confirmClearDownloaded', count.toString()))) {
            chrome.runtime.sendMessage({ action: "CLEAR_DOWNLOADED" }, () => {
                allItems.filter(i => i.downloaded).forEach(i => selectedUrls.delete(i.url));
                fetchAndRender();
                showToast('toastDownloadedCleared', 'success');
            });
        }
    };

    document.getElementById('closeVideoBtn').onclick = () => {
        videoModal.classList.remove('open');
        videoPlayer.pause();
        videoPlayer.src = '';
        if (activeVideoBtn) {
            activeVideoBtn.textContent = playIcon;
            activeVideoBtn.title = t('actionPlay');
            activeVideoBtn = null;
        }
    };

    function getFilteredUrls() { return getCurrentFilteredItems().map(i => i.url); }

    exportTxtBtn.onclick = () => {
        const urls = getFilteredUrls();
        if (urls.length === 0) return showToast('toastNoFiles', 'warning');
        const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url: url, filename: `UMG_URLs_${Date.now()}.txt`, saveAs: true }, () => {
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        });
        showToast('toastTxtExported', 'success');
        exportMenu.classList.remove('open');
    };

    copyUrlsBtn.onclick = () => {
        const urls = getFilteredUrls();
        if (urls.length === 0) return showToast('toastNoFiles', 'warning');
        navigator.clipboard.writeText(urls.join('\n')).then(() => {
            showToast('toastUrlsCopied', 'success', urls.length.toString());
        });
        exportMenu.classList.remove('open');
    };

    if (scanPageBtn) {
        scanPageBtn.onclick = async () => {
            scanPageBtn.disabled = true;
            scanPageBtn.textContent = t('scanBtnLoading');
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs[0] || !tabs[0].id) { scanPageBtn.disabled = false; scanPageBtn.textContent = t('scanBtn'); return; }
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                            const found = [];
                            const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.mp3', '.mp4', '.wav', '.m4a', '.aac', '.zip', '.rar'];
                            const getRowTitle = (el) => {
                                const tr = el.closest('tr');
                                if (tr) {
                                    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).filter(t => t.length > 2 && !/^\d{2}\.\d{2}\.\d{4}$/.test(t) && t.toLowerCase() !== 'sesli hutbe');
                                    if (cells.length > 0) return cells[0];
                                }
                                const card = el.closest('li, article, .card, .item, [class*="card"], [class*="item"]');
                                if (card) {
                                    const h = card.querySelector('h1, h2, h3, h4, h5, strong, .title, [class*="title"]');
                                    if (h && h.innerText.trim().length > 2) return h.innerText.trim();
                                }
                                return el.innerText.trim() || el.title || el.getAttribute('download') || "";
                            };
                            document.querySelectorAll('a[href]').forEach(a => {
                                try {
                                    const rawHref = a.getAttribute('href');
                                    if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('#')) return;
                                    const fullUrl = new URL(rawHref, window.location.href).href;
                                    const cleanPath = fullUrl.split('?')[0].toLowerCase();
                                    let matchedExt = docExts.find(ext => cleanPath.endsWith(ext));
                                    if (!matchedExt) {
                                        const lowerUrl = fullUrl.toLowerCase();
                                        const parentThIndex = a.closest('td') ? a.closest('td').cellIndex : -1;
                                        let colHeader = "";
                                        if (parentThIndex !== -1 && a.closest('table')) {
                                            const th = a.closest('table').querySelectorAll('th')[parentThIndex];
                                            if (th) colHeader = th.innerText.trim().toLowerCase();
                                        }
                                        if (lowerUrl.includes('.pdf') || colHeader === 'pdf') matchedExt = '.pdf';
                                        else if (lowerUrl.includes('.docx')) matchedExt = '.docx';
                                        else if (lowerUrl.includes('.doc') || colHeader === 'word') matchedExt = '.doc';
                                        else if (lowerUrl.includes('.mp3') || colHeader.includes('ses')) matchedExt = '.mp3';
                                        else if (lowerUrl.includes('.mp4')) matchedExt = '.mp4';
                                    }
                                    if (matchedExt) {
                                        let type = "PDF/Belge";
                                        if (['.mp3', '.wav', '.m4a', '.aac'].includes(matchedExt)) type = "Ses";
                                        else if (['.mp4', '.webm', '.mov'].includes(matchedExt)) type = "Video";
                                        found.push({ url: fullUrl, title: getRowTitle(a), ext: matchedExt, type: type });
                                    }
                                } catch(e) {}
                            });
                            document.querySelectorAll('audio, video, audio source, video source').forEach(m => {
                                const src = m.src || m.currentSrc;
                                if (src && src.startsWith('http')) {
                                    const isVid = m.tagName === 'VIDEO' || (m.parentElement && m.parentElement.tagName === 'VIDEO');
                                    found.push({ url: src, title: getRowTitle(m) || document.title, ext: isVid ? '.mp4' : '.mp3', type: isVid ? 'Video' : 'Ses' });
                                }
                            });
                            return Array.from(new Map(found.map(item => [item.url, item])).values());
                        }
                    });

                    const links = (results && results[0] && results[0].result) ? results[0].result : [];
                    if (links.length > 0) {
                        chrome.runtime.sendMessage({ action: "ADD_SCANNED_LINKS", payload: links, tabUrl: tabs[0].url }, (res) => {
                            const count = (res && res.count !== undefined) ? res.count : links.length;
                            if (count > 0) showToast('toastScanSuccess', 'success', count.toString());
                            else showToast('toastScanEmpty', 'warning');
                            scanPageBtn.disabled = false;
                            scanPageBtn.textContent = t('scanBtn');
                            setTimeout(fetchAndRender, 300);
                        });
                    } else {
                        scanPageBtn.disabled = false;
                        scanPageBtn.textContent = t('scanBtn');
                        showToast('toastScanEmpty', 'warning');
                    }
                } catch (err) {
                    scanPageBtn.disabled = false;
                    scanPageBtn.textContent = t('scanBtn');
                    showToast('toastScanFailed', 'warning');
                }
            });
        };
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.mediaList) fetchAndRender();
    });

    function fetchAndRender() {
        chrome.storage.local.get({ mediaList: [] }, (res) => {
            allItems = res.mediaList || [];
            countBadge.textContent = allItems.length;
            const existingUrls = new Set(allItems.map(i => i.url));
            selectedUrls.forEach(u => { if (!existingUrls.has(u)) selectedUrls.delete(u); });
            updateDisplay();
            updateDownloadButton();
        });
    }

    fetchAndRender();
});