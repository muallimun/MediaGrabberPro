// popup.js - v29.2.0 (Localization, Icons & Full Feature Sync)

document.addEventListener('DOMContentLoaded', () => {
    // --- i18n DİL MOTORU ---
    function applyLocalization() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const msg = chrome.i18n.getMessage(el.getAttribute("data-i18n"));
            if (msg) el.textContent = msg;
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const msg = chrome.i18n.getMessage(el.getAttribute("data-i18n-placeholder"));
            if (msg) el.placeholder = msg;
        });
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            const msg = chrome.i18n.getMessage(el.getAttribute("data-i18n-title"));
            if (msg) el.title = msg;
        });
    }
    applyLocalization();

    const listDiv = document.getElementById('list');
    const countBadge = document.getElementById('countBadge');
    const clearBtn = document.getElementById('clearAll');
    const downloadAllBtn = document.getElementById('downloadAll');
    const downloadZipBtn = document.getElementById('downloadZip');
    const selectAllCheckbox = document.getElementById('selectAll');
    const searchBox = document.getElementById('searchBox');
    const toastMsg = document.getElementById('toastMsg');
    const videoModal = document.getElementById('videoModal');
    const videoPlayer = document.getElementById('videoPlayer');

    let allItems = [];
    let selectedUrls = new Set();
    let currentFilter = 'all';
    let currentSort = 'newest';
    const downloadingUrls = new Map();
    let currentAudio = null;

    // ESTETİK İKON SETİ
    const icons = {
        play: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 4v16l13-8z"></path></svg>`,
        pause: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 4h4v16H6zm8 0h4v16h-4z"></path></svg>`,
        dl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        loading: `<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" width="16" height="16"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83"></path></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        del: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        musicNote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
        videoIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`
    };

    // AYARLARIN YÜKLENMESİ
    chrome.storage.local.get({ folderName: "MediaGrabber_Downloads", namingMethod: 'smart', customName: '', addDomain: false, addDate: false, addTime: false, autoClear: false }, (items) => {
        document.getElementById('folderNameInput').value = items.folderName;
        document.getElementById('namingMethod').value = items.namingMethod;
        document.getElementById('customNameInput').value = items.customName;
        document.getElementById('addDomain').checked = items.addDomain;
        document.getElementById('addDate').checked = items.addDate;
        document.getElementById('addTime').checked = items.addTime;
        document.getElementById('autoClearCheck').checked = items.autoClear;
        if(items.namingMethod === 'custom') document.getElementById('customNameContainer').style.display = 'block';
    });

    document.getElementById('saveSettings').onclick = () => {
        chrome.storage.local.set({
            folderName: document.getElementById('folderNameInput').value.trim() || "MediaGrabber_Downloads",
            namingMethod: document.getElementById('namingMethod').value,
            customName: document.getElementById('customNameInput').value.trim(),
            addDomain: document.getElementById('addDomain').checked,
            addDate: document.getElementById('addDate').checked,
            addTime: document.getElementById('addTime').checked,
            autoClear: document.getElementById('autoClearCheck').checked
        }, () => { showToast(chrome.i18n.getMessage("settingsSaved")); document.getElementById('settingsPanel').style.display='none'; });
    };

    function showToast(msg) {
        toastMsg.textContent = msg; document.getElementById('toast').className = "show";
        setTimeout(() => document.getElementById('toast').className = "", 2500);
    }

    const parseSize = (s) => {
        if(!s || s === "Unknown" || s === "Stream") return 0;
        let n = parseFloat(s); if(s.includes("KB")) n /= 1024; return n;
    };

    // TÜMÜNÜ SEÇ (FIX)
    selectAllCheckbox.onclick = () => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
            if (cb.checked) selectedUrls.add(cb.dataset.url); else selectedUrls.delete(cb.dataset.url);
            cb.closest('.item').classList.toggle('selected', cb.checked);
        });
        updateDownloadButton();
    };

    function updateDisplay() {
        const term = searchBox.value.toLowerCase();
        let filtered = allItems.filter(item => {
            const matchesSearch = item.filename.toLowerCase().includes(term);
            const matchesTab = (currentFilter === 'all') || (currentFilter === 'audio' && (item.type==='audio'||item.type==='stream')) || (currentFilter === 'video' && item.type==='video');
            return matchesSearch && matchesTab;
        });

        filtered.sort((a, b) => {
            if (currentSort === 'newest') return (b.timestamp || 0) - (a.timestamp || 0);
            if (currentSort === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
            if (currentSort === 'name_asc') return a.filename.localeCompare(b.filename);
            if (currentSort === 'name_desc') return b.filename.localeCompare(a.filename);
            if (currentSort === 'size_desc') return parseSize(b.size) - parseSize(a.size);
            if (currentSort === 'size_asc') return parseSize(a.size) - parseSize(b.size);
            return 0;
        });
        renderListUI(filtered);
    }

    function renderListUI(items) {
        listDiv.innerHTML = items.length === 0 ? `<div class="empty-state">📭 ${chrome.i18n.getMessage("listEmpty")}</div>` : "";
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item'; if (selectedUrls.has(item.url)) div.classList.add('selected');
            
            const isVideo = item.type === 'video' || (item.filename && item.filename.endsWith('.mp4'));
            const fileIcon = isVideo ? icons.videoIcon : icons.musicNote;
            const status = downloadingUrls.get(item.url);
            let dlIcon = status === 'downloading' ? icons.loading : (status === 'success' ? icons.success : icons.dl);

            div.innerHTML = `
                <div class="check-col"><input type="checkbox" class="item-checkbox" data-url="${item.url}" ${selectedUrls.has(item.url)?'checked':''}></div>
                <div class="info-col">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <span class="name" title="${item.filename}">${item.filename}</span>
                        <div class="meta"><span class="tag">${item.type.toUpperCase()}</span> <span>${item.size}</span></div>
                    </div>
                </div>
                <div class="action-col">
                    <button class="icon-btn play-btn" title="Oynat">${icons.play}</button>
                    <button class="icon-btn edit-btn">${icons.edit}</button>
                    <button class="icon-btn copy-btn">${icons.copy}</button>
                    <button class="icon-btn dl-btn">${dlIcon}</button>
                    <button class="icon-btn del-btn" style="color:var(--danger)">${icons.del}</button>
                </div>
            `;

            div.querySelector('.item-checkbox').onchange = (e) => {
                if(e.target.checked) selectedUrls.add(item.url); else selectedUrls.delete(item.url);
                div.classList.toggle('selected', e.target.checked); updateDownloadButton();
            };

            div.querySelector('.play-btn').onclick = () => {
                if(isVideo) { videoPlayer.src = item.url; videoModal.style.display = "flex"; videoPlayer.play().catch(() => showToast("Hata.")); }
                else { if(currentAudio) currentAudio.pause(); currentAudio = new Audio(item.url); currentAudio.play().catch(() => showToast("Hata.")); }
            };

            div.querySelector('.edit-btn').onclick = () => {
                const newName = prompt(chrome.i18n.getMessage("renamePrompt"), item.filename.split('.')[0]);
                if (newName) chrome.runtime.sendMessage({action: "RENAME_ITEM", url: item.url, newName: newName.trim()}, () => fetchAndRender());
            };

            div.querySelector('.copy-btn').onclick = () => { navigator.clipboard.writeText(item.url); showToast(chrome.i18n.getMessage("copied")); };
            
            div.querySelector('.dl-btn').onclick = () => {
                downloadingUrls.set(item.url, 'downloading'); updateDisplay();
                chrome.runtime.sendMessage({action: "DOWNLOAD_ONE", url: item.url, filename: item.filename});
            };

            div.querySelector('.del-btn').onclick = () => {
                chrome.runtime.sendMessage({action: "DELETE_ITEM", url: item.url}, () => {
                    selectedUrls.delete(item.url); fetchAndRender();
                });
            };
            listDiv.appendChild(div);
        });
        selectAllCheckbox.checked = items.length > 0 && items.every(i => selectedUrls.has(i.url));
    }

    function updateDownloadButton() {
        const count = selectedUrls.size;
        downloadAllBtn.textContent = count > 0 ? `${chrome.i18n.getMessage("downloadBtn")} (${count})` : chrome.i18n.getMessage("downloadAll");
        clearBtn.textContent = count > 0 ? `${chrome.i18n.getMessage("deleteBtn")} (${count})` : chrome.i18n.getMessage("clear");
    }

    function fetchAndRender() {
        chrome.storage.local.get({ mediaList: [] }, (res) => { allItems = res.mediaList || []; countBadge.textContent = allItems.length; updateDisplay(); });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentFilter = btn.dataset.filter; updateDisplay(); });
    document.getElementById('sortSelect').onchange = (e) => { currentSort = e.target.value; updateDisplay(); };
    searchBox.oninput = updateDisplay;
    document.getElementById('settingsToggle').onclick = () => { document.getElementById('settingsPanel').style.display='block'; document.getElementById('infoPanel').style.display='none'; };
    document.getElementById('infoToggle').onclick = () => { document.getElementById('infoPanel').style.display='block'; document.getElementById('settingsPanel').style.display='none'; };
    document.getElementById('closePopup').onclick = () => window.close();
    document.getElementById('closeVideoBtn').onclick = () => { videoModal.style.display='none'; videoPlayer.pause(); };
    document.getElementById('namingMethod').onchange = (e) => { document.getElementById('customNameContainer').style.display = e.target.value === 'custom' ? 'block' : 'none'; };

    document.getElementById('saveList').onclick = () => {
        if (allItems.length === 0) return;
        let content = "MEDIA GRABBER LIST\n\n";
        allItems.forEach(i => content += `File: ${i.filename}\nLink: ${i.url}\n\n`);
        const blob = new Blob([content], {type: 'text/plain'});
        chrome.downloads.download({ url: URL.createObjectURL(blob), filename: "Media_List.txt", saveAs: true });
    };

    downloadAllBtn.onclick = () => {
        const urls = selectedUrls.size > 0 ? Array.from(selectedUrls) : allItems.map(i => i.url);
        if (urls.length > 0) chrome.runtime.sendMessage({action: "DOWNLOAD_LIST", urls: urls});
    };
    downloadZipBtn.onclick = () => chrome.runtime.sendMessage({action: "DOWNLOAD_ZIP"});
    
    clearBtn.onclick = () => {
        if(confirm(chrome.i18n.getMessage("confirmClear"))) {
            const action = selectedUrls.size > 0 ? "DELETE_LIST" : "CLEAR";
            chrome.runtime.sendMessage({action: action, urls: Array.from(selectedUrls)}, () => { selectedUrls.clear(); fetchAndRender(); });
        }
    };
    fetchAndRender();
});