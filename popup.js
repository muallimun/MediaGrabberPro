document.addEventListener('DOMContentLoaded', () => {
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

    let currentAudio = null;
    let currentPlayBtn = null;
    let allItems = [];
    let selectedUrls = new Set();

    const icons = {
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
        dl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        del: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        musicNote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
        videoIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`
    };

    function showToast(msg, isError = false) {
        toastMsg.textContent = msg;
        document.getElementById('toastIcon').textContent = isError ? "❌" : "✅";
        toast.style.background = isError ? "#dc2626" : "#1e293b";
        toast.className = "show";
        setTimeout(() => { toast.className = ""; }, 2500);
    }

    if (closePopupBtn) {
        closePopupBtn.onclick = () => window.close();
    }

    if(closeVideoBtn) {
        closeVideoBtn.onclick = () => {
            videoModal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.src = "";
        };
    }

    infoToggle.onclick = () => {
        infoPanel.style.display = infoPanel.style.display === 'block' ? 'none' : 'block';
        settingsPanel.style.display = 'none';
    };
    settingsToggle.onclick = () => {
        settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
        infoPanel.style.display = 'none';
        chrome.storage.local.get({ folderName: "MediaGrabber_Downloads", listName: "Media_List.txt" }, (items) => {
            document.getElementById('folderNameInput').value = items.folderName;
            document.getElementById('listNameInput').value = items.listName;
        });
    };
    saveSettingsBtn.onclick = () => {
        const folder = document.getElementById('folderNameInput').value.trim() || "MediaGrabber_Downloads";
        const listFile = document.getElementById('listNameInput').value.trim() || "Media_List.txt";
        chrome.storage.local.set({ folderName: folder, listName: listFile }, () => {
            showToast("Ayarlar Kaydedildi");
            settingsPanel.style.display = 'none';
        });
    };

    function updateDownloadButton() {
        const count = selectedUrls.size;
        if (count > 0) {
            downloadAllBtn.textContent = `SEÇİLENLERİ İNDİR (${count})`;
            downloadAllBtn.style.background = "#f59e0b"; // warning color
            clearBtn.textContent = `SEÇİLENİ SİL (${count})`;
        } else {
            downloadAllBtn.textContent = "⬇ TÜMÜNÜ İNDİR";
            downloadAllBtn.style.background = "#10b981"; // success color
            clearBtn.textContent = "🗑 TÜMÜNÜ SİL";
        }
    }

    selectAllCheckbox.onclick = () => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        const isChecked = selectAllCheckbox.checked;
        
        checkboxes.forEach(cb => {
            const url = cb.dataset.url;
            const itemDiv = cb.closest('.item');
            
            cb.checked = isChecked;

            if (isChecked) {
                selectedUrls.add(url);
                itemDiv.classList.add('selected');
            } else {
                selectedUrls.delete(url);
                itemDiv.classList.remove('selected');
            }
        });

        updateDownloadButton();
    };

    saveListBtn.onclick = () => {
        if (allItems.length === 0) return;
        chrome.storage.local.get({ listName: "Media_List.txt" }, (settings) => {
            let content = "MEDIA GRABBER LISTESI\n=====================\n\n";
            allItems.forEach(item => { content += `Dosya: ${item.filename}\nLink: ${item.url}\n\n`; });
            const blob = new Blob([content], {type: 'text/plain'});
            chrome.downloads.download({ url: URL.createObjectURL(blob), filename: settings.listName, saveAs: true });
        });
    };

    searchBox.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allItems.filter(item => item.filename.toLowerCase().includes(term));
        renderListUI(filtered);
    });

    function toggleAudio(url, btn) {
        if (currentAudio) {
            currentAudio.pause();
            if (currentPlayBtn) {
                currentPlayBtn.innerHTML = icons.play;
                currentPlayBtn.classList.remove('active');
            }
            if (currentPlayBtn === btn) {
                currentAudio = null; currentPlayBtn = null; return;
            }
        }
        currentAudio = new Audio(url);
        currentPlayBtn = btn;
        btn.innerHTML = icons.pause;
        btn.classList.add('active');
        currentAudio.play().catch(() => { showToast("Oynatılamıyor", true); btn.innerHTML = icons.play; btn.classList.remove('active'); });
        currentAudio.onended = () => { btn.innerHTML = icons.play; btn.classList.remove('active'); currentAudio = null; };
    }

    function fetchAndRender() {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            allItems = result.mediaList || [];
            countBadge.textContent = allItems.length;
            renderListUI(allItems);
            updateDownloadButton();
        });
    }

    function renderListUI(items) {
        listDiv.innerHTML = "";
        if (items.length === 0) {
            listDiv.innerHTML = `<div class="empty-state"><div style="font-size:30px; margin-bottom:10px; opacity:0.4;">📭</div><div>Liste Boş</div><div style="margin-top:5px; font-size:11px;">Medyayı oynatın.</div></div>`;
            footerControls.style.display = 'none';
            saveListBtn.style.display = 'none';
            searchBox.parentElement.style.display = 'none';
            return;
        }
        footerControls.style.display = 'flex';
        saveListBtn.style.display = 'flex';
        searchBox.parentElement.style.display = 'block';

        [...items].reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            if (selectedUrls.has(item.url)) div.classList.add('selected');

            const isVideo = item.type === 'video' || (item.filename && item.filename.endsWith('.mp4'));
            const fileIcon = isVideo ? icons.videoIcon : icons.musicNote;

            div.innerHTML = `
                <div class="check-col">
                    <input type="checkbox" class="item-checkbox" data-url="${item.url}">
                </div>
                <div class="info-col">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <span class="name" title="${item.filename}">${item.filename}</span>
                        <div class="meta">
                            <span class="tag">${isVideo ? 'VIDEO' : (item.size || '? MB')}</span>
                            <span title="${item.url}" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${new URL(item.url).hostname}</span>
                        </div>
                    </div>
                </div>
                <div class="action-col">
                    <button class="icon-btn play-btn" title="${isVideo ? 'İzle' : 'Dinle'}">${icons.play}</button>
                    <button class="icon-btn edit-btn" title="İsim Değiştir">${icons.edit}</button>
                    <button class="icon-btn copy-btn" title="Link Kopyala">${icons.copy}</button>
                    <button class="icon-btn dl-btn" title="İndir">${icons.dl}</button>
                    <button class="icon-btn del-btn" title="Sil">${icons.del}</button>
                </div>
            `;
            
            const checkbox = div.querySelector('.item-checkbox');
            checkbox.checked = selectedUrls.has(item.url);
            checkbox.onchange = (e) => {
                if(e.target.checked) { selectedUrls.add(item.url); div.classList.add('selected'); } 
                else { selectedUrls.delete(item.url); div.classList.remove('selected'); }
                selectAllCheckbox.checked = (selectedUrls.size === allItems.length && allItems.length > 0);
                updateDownloadButton();
            };
            
            div.querySelector('.play-btn').onclick = function() { 
                if(isVideo) {
                    if(currentAudio) currentAudio.pause();
                    videoPlayer.src = item.url;
                    videoModal.style.display = "flex";
                    videoPlayer.play();
                } else {
                    toggleAudio(item.url, this); 
                }
            };

            div.querySelector('.copy-btn').onclick = function() { navigator.clipboard.writeText(item.url); showToast("Link Kopyalandı"); };
            div.querySelector('.edit-btn').onclick = function() {
                const currentName = item.filename.replace(/\.(mp3|mp4|m4a|wav|aac|m3u8)$/i, '');
                const newName = prompt("Yeni dosya adı:", currentName);
                if (newName && newName.trim() !== "") {
                    chrome.runtime.sendMessage({action: "RENAME_ITEM", url: item.url, newName: newName}, (res) => {
                        if(res.status === "Renamed") { showToast("İsim Güncellendi"); fetchAndRender(); }
                    });
                }
            };
            div.querySelector('.dl-btn').onclick = function() {
                const btn = this; btn.innerHTML = "⏳";
                chrome.runtime.sendMessage({action: "DOWNLOAD_ONE", url: item.url, filename: item.filename}, (res) => {
                    if(res && res.success) { btn.innerHTML = "✔"; btn.style.color = "#10b981"; } 
                    else { btn.innerHTML = "↗"; chrome.tabs.create({ url: item.url }); showToast("Yeni sekmede açıldı.", true); }
                    setTimeout(() => { btn.innerHTML = icons.dl; btn.style.color = ""; }, 2000);
                });
            };
            div.querySelector('.del-btn').onclick = function() {
                chrome.runtime.sendMessage({action: "DELETE_ITEM", url: item.url}, () => {
                    selectedUrls.delete(item.url); updateDownloadButton(); fetchAndRender();
                });
            };
            listDiv.appendChild(div);
        });
        selectAllCheckbox.checked = (selectedUrls.size > 0) && document.querySelectorAll('.item-checkbox').length === selectedUrls.size;

    }

    downloadAllBtn.onclick = () => {
        if (selectedUrls.size > 0) {
            const urlsArray = Array.from(selectedUrls);
            chrome.runtime.sendMessage({action: "DOWNLOAD_LIST", urls: urlsArray}, (response) => {
                if (response?.status === 'BATCH_STARTED') {
                    showToast(`${urlsArray.length} dosya indirme kuyruğuna eklendi.`);
                }
            });
        } else {
            if(confirm(`Listedeki ${allItems.length} dosyanın tümü indirilsin mi?`)) {
                chrome.runtime.sendMessage({action: "DOWNLOAD_ALL"}, (response) => {
                    if (response === 'BATCH_STARTED') {
                        showToast("Tüm dosyalar indirme kuyruğuna eklendi.");
                    }
                });
            }
        }
    };

    downloadZipBtn.onclick = () => {
        const itemsToZip = selectedUrls.size > 0 
            ? allItems.filter(item => selectedUrls.has(item.url))
            : allItems;

        if (itemsToZip.length === 0) {
            showToast("Sıkıştırılacak dosya bulunamadı.", true);
            return;
        }

        if(confirm(`${itemsToZip.length} dosya ZIP olarak indirilecek. Lütfen bekleyin.`)) {
            chrome.runtime.sendMessage({action: "DOWNLOAD_ZIP"}, (response) => {
                if (response === 'ZIP_STARTED') {
                    showToast("Sıkıştırma ve indirme başlatıldı...");
                }
            });
        }
    };

    clearBtn.onclick = () => {
        if (selectedUrls.size > 0) {
             if(confirm(`Seçili ${selectedUrls.size} dosya silinsin mi?`)) {
                 const urlsToDelete = Array.from(selectedUrls);
                 chrome.runtime.sendMessage({action: "DELETE_LIST", urls: urlsToDelete}, (response) => {
                    if (response?.status === 'Deleted multiple') {
                        selectedUrls.clear(); 
                        fetchAndRender();
                        showToast(`${urlsToDelete.length} öğe silindi.`);
                    }
                 });
             }
        } else {
            if(confirm("Tüm liste temizlensin mi?")) {
                chrome.runtime.sendMessage({action: "CLEAR"}, (response) => {
                    if (response === 'CLEARED') {
                        selectedUrls.clear(); 
                        fetchAndRender(); 
                        showToast("Liste temizlendi.");
                    }
                });
            }
        }
    };

    fetchAndRender();
});