// popup.js - V83 (Link Copy Restored & All Features Preserved)

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMANLARI ---
    const listDiv = document.getElementById('list'); 
    const countBadge = document.getElementById('countBadge'); 
    const clearBtn = document.getElementById('clearAll'); 
    const downloadAllBtn = document.getElementById('downloadAll'); 
    const downloadZipBtn = document.getElementById('downloadZip'); 
    const saveListBtn = document.getElementById('saveList'); 
    const selectAllCheckbox = document.getElementById('selectAll'); 
    
    const infoToggle = document.getElementById('infoToggle'); 
    const infoPanel = document.getElementById('infoPanel'); 
    const settingsToggle = document.getElementById('settingsToggle'); 
    const settingsPanel = document.getElementById('settingsPanel'); 
    const saveSettingsBtn = document.getElementById('saveSettings'); 
    const closePopupBtn = document.getElementById('closePopup'); 
    
    const footerControls = document.getElementById('footerControls'); 
    const searchBox = document.getElementById('searchBox'); 
    const toast = document.getElementById('toast'); 
    const toastMsg = document.getElementById('toastMsg'); 

    const videoModal = document.getElementById('videoModal'); 
    const videoPlayer = document.getElementById('videoPlayer'); 
    const closeVideoBtn = document.getElementById('closeVideoBtn'); 

    const autoClearCheck = document.getElementById('autoClearCheck'); 
    const tabButtons = document.querySelectorAll('.tab-btn'); 
    const sortSelect = document.getElementById('sortSelect'); 

    // --- DEĞİŞKENLER ---
    let currentAudio = null; 
    let currentPlayBtn = null; 
    let allItems = []; 
    let selectedUrls = new Set(); 
    let currentFilter = 'all'; 
    let currentSort = 'newest';
    const downloadingUrls = new Map(); // url -> status

    const icons = {
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`, 
        pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`, 
        dl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`, 
        loading: `<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s linear infinite; width:18px;"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" style="width:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`, 
        edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`, 
        del: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`, 
        musicNote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`, 
        videoIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>` 
    };

    function showToast(msg, isError = false) {
        toastMsg.textContent = msg; 
        toast.className = "show"; 
        setTimeout(() => { toast.className = ""; }, 2500); 
    }

    // --- SIRALAMA YARDIMCISI ---
    function parseSize(sizeStr) {
        if (!sizeStr || sizeStr === "Stream" || sizeStr === "?") return 0;
        const match = sizeStr.match(/(\d+\.?\d*)\s*(MB|KB)/i);
        if (!match) return 0;
        let val = parseFloat(match[1]);
        if (match[2].toUpperCase() === "KB") val /= 1024;
        return val;
    }

    function sortItems(items) {
        return items.sort((a, b) => {
            if (currentSort === 'newest') return (b.timestamp || 0) - (a.timestamp || 0);
            if (currentSort === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
            if (currentSort === 'name_asc') return a.filename.localeCompare(b.filename);
            if (currentSort === 'size_desc') return parseSize(b.size) - parseSize(a.size);
            return 0;
        });
    }

    // --- MERKEZİ GÜNCELLEME ---
    function updateDisplay() {
        const term = searchBox.value.toLowerCase(); 
        let filtered = allItems.filter(item => {
            const matchesSearch = item.filename.toLowerCase().includes(term); 
            const matchesTab = (currentFilter === 'all') || (currentFilter === 'audio' && (item.type==='audio'||item.type==='stream')) || (currentFilter === 'video' && item.type==='video');
            return matchesSearch && matchesTab;
        });
        
        filtered = sortItems(filtered);
        renderListUI(filtered); 
    }

    // --- LISTEYİ KAYDET (V82 ONARIMI) ---
    saveListBtn.onclick = () => {
        if (allItems.length === 0) return; 
        chrome.storage.local.get({ listName: "Media_List.txt" }, (settings) => {
            let content = "MEDIA GRABBER LISTESI\n=====================\n\n"; 
            allItems.forEach(item => { content += `Dosya: ${item.filename}\nLink: ${item.url}\n\n`; }); 
            const blob = new Blob([content], {type: 'text/plain;charset=utf-8'}); 
            const reader = new FileReader();
            reader.onload = function(e) {
                chrome.downloads.download({ url: e.target.result, filename: settings.listName || "Media_List.txt", saveAs: true });
            };
            reader.readAsDataURL(blob);
        });
    };

    // --- DİNLEYİCİLER VE PANELLER ---
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "DOWNLOAD_STATUS_UPDATE") {
            downloadingUrls.set(msg.url, msg.status);
            updateDisplay();
        }
    });

    tabButtons.forEach(btn => {
        btn.onclick = () => {
            tabButtons.forEach(b => b.classList.remove('active')); 
            btn.classList.add('active'); currentFilter = btn.dataset.filter; updateDisplay(); 
        };
    });

    if (sortSelect) {
        sortSelect.onchange = (e) => { currentSort = e.target.value; updateDisplay(); };
    }

    searchBox.oninput = updateDisplay; 
    infoToggle.onclick = () => { infoPanel.style.display = infoPanel.style.display==='block'?'none':'block'; settingsPanel.style.display='none'; }; 
    
    settingsToggle.onclick = () => {
        settingsPanel.style.display = settingsPanel.style.display==='block'?'none':'block'; infoPanel.style.display='none';
        chrome.storage.local.get({ folderName:"MediaGrabber_Downloads", listName:"Media_List.txt", autoClear:false }, (items) => {
            document.getElementById('folderNameInput').value = items.folderName; 
            document.getElementById('listNameInput').value = items.listName; 
            if(autoClearCheck) autoClearCheck.checked = items.autoClear; 
        });
    };
    
    saveSettingsBtn.onclick = () => {
        chrome.storage.local.set({ 
            folderName: document.getElementById('folderNameInput').value.trim(),
            listName: document.getElementById('listNameInput').value.trim(),
            autoClear: autoClearCheck ? autoClearCheck.checked : false
        }, () => { showToast("Ayarlar Kaydedildi"); settingsPanel.style.display='none'; }); 
    };

    if (closePopupBtn) closePopupBtn.onclick = () => window.close(); 
    if (closeVideoBtn) { closeVideoBtn.onclick = () => { videoModal.style.display='none'; videoPlayer.pause(); videoPlayer.src=""; }; } 

    function toggleAudio(url, btn) {
        if (currentAudio) {
            currentAudio.pause(); 
            if (currentPlayBtn) { currentPlayBtn.innerHTML = icons.play; currentPlayBtn.classList.remove('active'); } 
            if (currentPlayBtn === btn) { currentAudio = null; currentPlayBtn = null; return; } 
        }
        currentAudio = new Audio(url); currentPlayBtn = btn;
        btn.innerHTML = icons.pause; btn.classList.add('active'); 
        currentAudio.play().catch(() => { showToast("Oynatılamıyor", true); btn.innerHTML = icons.play; }); 
        currentAudio.onended = () => { btn.innerHTML = icons.play; currentAudio = null; }; 
    }

    function renderListUI(items) {
        listDiv.innerHTML = ""; 
        if (items.length === 0) {
            listDiv.innerHTML = `<div class="empty-state"><div style="font-size:30px; margin-bottom:10px; opacity:0.4;">📭</div><div>Liste Boş</div></div>`; 
            if(allItems.length === 0) { footerControls.style.display = 'none'; saveListBtn.style.display = 'none'; searchBox.parentElement.style.display = 'none'; }
            return;
        }
        footerControls.style.display = 'flex'; 
        saveListBtn.style.display = 'flex'; 
        searchBox.parentElement.style.display = 'block'; 

        items.forEach(item => {
            const div = document.createElement('div'); 
            div.className = 'item'; 
            if (selectedUrls.has(item.url)) div.classList.add('selected'); 

            const isVideo = item.type === 'video' || (item.filename && item.filename.endsWith('.mp4')); 
            
            let dlIcon = icons.dl;
            const status = downloadingUrls.get(item.url);
            if (status === 'downloading') dlIcon = icons.loading;
            else if (status === 'success') dlIcon = icons.success;

            div.innerHTML = `
                <div class="check-col"><input type="checkbox" class="item-checkbox" data-url="${item.url}" ${selectedUrls.has(item.url)?'checked':''}></div>
                <div class="info-col">
                    <div class="file-icon">${isVideo ? icons.videoIcon : icons.musicNote}</div>
                    <div class="file-details">
                        <span class="name" title="${item.filename}">${item.filename}</span>
                        <div class="meta">
                            <span class="tag ${isVideo?'video-tag':'audio-tag'}">${isVideo?'VIDEO':'AUDIO'}</span>
                            <span class="size-info">${item.size}</span>
                            <span title="${item.url}" style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0.7;">${new URL(item.url).hostname}</span>
                        </div>
                    </div>
                </div>
                <div class="action-col">
                    <button class="icon-btn play-btn" title="Oynat">${icons.play}</button>
                    <button class="icon-btn edit-btn" title="Düzenle">${icons.edit}</button>
                    <button class="icon-btn copy-btn" title="Linki Kopyala">${icons.copy}</button> <button class="icon-btn dl-btn" title="İndir">${dlIcon}</button>
                    <button class="icon-btn del-btn" title="Sil">${icons.del}</button>
                </div>
            `;
            
            div.querySelector('.item-checkbox').onchange = (e) => {
                if(e.target.checked) { selectedUrls.add(item.url); div.classList.add('selected'); } 
                else { selectedUrls.delete(item.url); div.classList.remove('selected'); }
                updateDownloadButton(); 
            };
            
            div.querySelector('.play-btn').onclick = () => { 
                if(isVideo) { videoPlayer.src=item.url; videoModal.style.display="flex"; videoPlayer.play(); } 
                else toggleAudio(item.url, div.querySelector('.play-btn')); 
            };

            div.querySelector('.edit-btn').onclick = () => {
                const currentName = item.filename.replace(/\.(mp3|mp4|m4a|wav|aac|m3u8)$/i, ''); 
                const newName = prompt("Yeni dosya adı:", currentName); 
                if (newName && newName.trim() !== "") {
                    chrome.runtime.sendMessage({action: "RENAME_ITEM", url: item.url, newName: newName}, () => fetchAndRender());
                }
            };

            // LİNK KOPYALAMA İŞLEVİ (GERİ GETİRİLDİ)
            div.querySelector('.copy-btn').onclick = () => {
                navigator.clipboard.writeText(item.url);
                showToast("Link Kopyalandı");
            };

            div.querySelector('.del-btn').onclick = () => {
                chrome.runtime.sendMessage({action: "DELETE_ITEM", url: item.url}, () => {
                    selectedUrls.delete(item.url); fetchAndRender(); showToast("Dosya Silindi"); 
                });
            };

            div.querySelector('.dl-btn').onclick = () => {
                downloadingUrls.set(item.url, 'downloading'); updateDisplay();
                chrome.runtime.sendMessage({action: "DOWNLOAD_ONE", url: item.url, filename: item.filename});
            };

            listDiv.appendChild(div); 
        });
        selectAllCheckbox.checked = (selectedUrls.size > 0 && selectedUrls.size === items.length); 
    }

    function updateDownloadButton() {
        const count = selectedUrls.size; 
        if (count > 0) {
            downloadAllBtn.textContent = `SEÇİLENLERİ İNDİR (${count})`; 
            downloadAllBtn.style.background = "#f59e0b";
            clearBtn.textContent = `SEÇİLENİ SİL (${count})`; 
        } else {
            downloadAllBtn.textContent = "⬇ TÜMÜNÜ İNDİR"; 
            downloadAllBtn.style.background = "#10b981";
            clearBtn.textContent = "🗑 TÜMÜNÜ SİL"; 
        }
    }

    function fetchAndRender() {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            allItems = result.mediaList || []; 
            countBadge.textContent = allItems.length; 
            updateDisplay(); 
        });
    }

    downloadAllBtn.onclick = () => {
        const urls = selectedUrls.size > 0 ? Array.from(selectedUrls) : allItems.map(i => i.url); 
        if (confirm(`${urls.length} dosya indirilsin mi?`)) {
            urls.forEach(url => downloadingUrls.set(url, 'downloading')); updateDisplay();
            chrome.runtime.sendMessage({action: selectedUrls.size > 0 ? "DOWNLOAD_LIST":"DOWNLOAD_ALL", urls: urls});
        }
    };

    downloadZipBtn.onclick = () => {
        const itemsToZip = selectedUrls.size > 0 ? allItems.filter(item => selectedUrls.has(item.url)) : allItems; 
        if (itemsToZip.length === 0) return;
        chrome.runtime.sendMessage({action: "DOWNLOAD_ZIP"});
    };

    clearBtn.onclick = () => {
        if(confirm("Emin misiniz?")) {
            chrome.runtime.sendMessage({action: selectedUrls.size > 0 ? "DELETE_LIST":"CLEAR", urls: Array.from(selectedUrls)}, () => {
                selectedUrls.clear(); fetchAndRender();
            });
        }
    };

    fetchAndRender(); 
});