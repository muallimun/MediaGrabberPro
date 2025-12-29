// background.js - V80 (Kritik Hata Düzeltmeleri & Tam Mantık)

let tabTitles = {}; 
const processedUrls = new Set();
const processedBaseUrls = new Set(); 
const recentSaves = new Set();
const activeDownloads = new Map(); // downloadId -> url

const trMap = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};

try { importScripts('jszip.min.js'); } catch (e) { console.error("JSZip yüklenemedi:", e); }

function sanitizeFilename(name) {
    if (!name || name === "undefined" || name === "null" || name === "Dosya" || name.trim() === "") return "Media_" + Date.now();
    let cleanName = name.replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match] || match);
    cleanName = cleanName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '');
    if (cleanName.length > 120) cleanName = cleanName.substring(0, 120);
    return cleanName;
}

function getBaseUrl(url) { try { return url.split('?')[0]; } catch(e) { return url; } }

function updateBadge() {
    chrome.storage.local.get({ mediaList: [] }, (result) => {
        const count = result.mediaList ? result.mediaList.length : 0;
        chrome.action.setBadgeText({text: count > 0 ? count.toString() : ""});
        chrome.action.setBadgeBackgroundColor({color: "#e74c3c"});
    });
}

// İndirme Durumu Takibi
chrome.downloads.onChanged.addListener((delta) => {
    if (activeDownloads.has(delta.id)) {
        const url = activeDownloads.get(delta.id);
        let status = "downloading";
        if (delta.state && delta.state.current === "complete") { status = "success"; activeDownloads.delete(delta.id); }
        else if (delta.error) { status = "error"; activeDownloads.delete(delta.id); }
        chrome.runtime.sendMessage({ action: "DOWNLOAD_STATUS_UPDATE", url: url, status: status }).catch(() => {});
    }
});

// Otomatik Temizleme
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get({ autoClear: false }, (res) => {
        if (res.autoClear) {
            chrome.storage.local.set({ mediaList: [] }, () => {
                processedUrls.clear(); processedBaseUrls.clear(); updateBadge();
            });
        }
    });
});

// --- ANA KAYIT FONKSİYONU (ReferenceError ve Artist Fix) ---
function saveToStorage(url, title, sizeInfo, isHLS = false, detectedExt = ".mp3") {
    chrome.storage.local.get({ mediaList: [] }, (result) => {
        const list = result.mediaList || [];
        
        // 1. Link Tekilleştirme (Aynı URL zaten varsa ekleme)
        if (list.some(i => i.url === url)) return;

        let finalTitle = title;
        const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const genericNames = ["index", "broadcast", "audio", "video", "media", "stream", "playlist", "dosya", "medya"];

        // .mp4 gibi anlamsız veya jenerik isimleri düzelt
        let check = (finalTitle || "").toLowerCase().split('.')[0];
        if (!finalTitle || finalTitle.length < 3 || genericNames.includes(check) || isUuid(check)) {
            try {
                const urlObj = new URL(url);
                const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
                let fName = parts.pop() || "";
                let folder = parts.pop() || "Media";
                finalTitle = (genericNames.includes(fName.toLowerCase().split('.')[0]) || fName.length < 3) ? folder : fName.replace(/\.(mp3|m4a|wav|mp4|m3u8|aac)$/i, '');
            } catch(e) { finalTitle = "Media_" + Date.now().toString().slice(-4); }
        }

        let filenameToSave = sanitizeFilename(finalTitle);
        
        if (detectedExt === ".mp4") {
            if (!filenameToSave.toLowerCase().endsWith(".mp4")) filenameToSave += ".mp4";
        } else if (isHLS) {
            if (!filenameToSave.match(/\.(m3u8|mp3|mp4)$/i)) filenameToSave += ".mp3"; 
        } else {
            if (!filenameToSave.toLowerCase().endsWith(detectedExt)) filenameToSave += detectedExt;
        }

        // 2. İsim Çakışması Kontrolü (Aynı sanatçı sorunu çözümü)
        if (list.some(i => i.filename === filenameToSave)) {
            const timestamp = Date.now().toString().slice(-4);
            filenameToSave = filenameToSave.replace(/(\.[^.]+)$/, `_${timestamp}$1`);
        }

        // 3. Değişken Tanımlama (ReferenceError Fix)
        const newItem = { 
            url: url, 
            filename: filenameToSave, 
            size: sizeInfo || "?",
            type: (detectedExt === ".mp4") ? "video" : (isHLS ? "stream" : "audio"),
            timestamp: Date.now()
        };

        list.push(newItem);
        chrome.storage.local.set({ mediaList: list }, () => updateBadge());
    });
}

// MESAJLAR (Tüm Orijinal Mesajlar KORUNDU)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SET_TITLE") {
        if (sender.tab) tabTitles[sender.tab.id] = request.payload;
        sendResponse("OK");
    }
    if (request.action === "CLEAR") {
        tabTitles = {};
        chrome.storage.local.set({ mediaList: [] }, () => { updateBadge(); sendResponse("CLEARED"); });
        return true; 
    }
    if (request.action === "DELETE_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const newList = result.mediaList.filter(item => item.url !== request.url);
            chrome.storage.local.set({ mediaList: newList }, () => { updateBadge(); sendResponse({status: "Deleted"}); });
        }); return true;
    }
    if (request.action === "DELETE_LIST") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const newList = result.mediaList.filter(item => !request.urls.includes(item.url));
            chrome.storage.local.set({ mediaList: newList }, () => { updateBadge(); sendResponse({status: "Deleted multiple"}); });
        }); return true;
    }
    if (request.action === "RENAME_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const list = result.mediaList;
            const idx = list.findIndex(i => i.url === request.url);
            if (idx !== -1) {
                let newN = sanitizeFilename(request.newName);
                const ext = list[idx].filename.split('.').pop();
                if(!newN.includes('.')) newN += "." + ext;
                list[idx].filename = newN;
                chrome.storage.local.set({ mediaList: list }, () => sendResponse({status: "Renamed"}));
            }
        }); return true;
    }
    if (request.action === "DOWNLOAD_ONE") {
        chrome.storage.local.get({ folderName: "MediaGrabber_Downloads" }, (s) => {
            chrome.downloads.download({
                url: request.url, filename: (s.folderName || "MediaGrabber_Downloads") + "/" + sanitizeFilename(request.filename),
                conflictAction: 'uniquify'
            }, (id) => { if (id) activeDownloads.set(id, request.url); sendResponse({success: !!id}); });
        }); return true;
    }
    if (request.action === "DOWNLOAD_LIST" || request.action === "DOWNLOAD_ALL") {
        chrome.storage.local.get({ mediaList: [], folderName: "MediaGrabber_Downloads" }, async (result) => {
            const folder = result.folderName || "MediaGrabber_Downloads";
            const targets = request.action === "DOWNLOAD_LIST" ? request.urls : result.mediaList.map(i => i.url);
            for(let url of targets) {
                const item = result.mediaList.find(i => i.url === url);
                if(item) {
                    chrome.downloads.download({ url: item.url, filename: folder + "/" + sanitizeFilename(item.filename) }, (id) => { if (id) activeDownloads.set(id, item.url); });
                    await new Promise(r => setTimeout(r, 1200));
                }
            }
        }); sendResponse("BATCH_STARTED");
    }
    if (request.action === "DOWNLOAD_ZIP") { downloadAndZip(); sendResponse("ZIP_STARTED"); }
    if (request.action === "ADD_SCANNED_LINKS") {
        const links = request.payload;
        let count = 0;
        links.forEach(item => { saveToStorage(item.url, item.title, "Scan"); count++; });
        sendResponse({addedCount: count}); return true;
    }
});

// ZIP ve Network Dinleyici mantığı KORUNDU
async function downloadAndZip() {
    const zip = new JSZip();
    const folder = zip.folder("Medya_Arsiv");
    const result = await chrome.storage.local.get({ mediaList: [] });
    const list = result.mediaList || [];
    for (const item of list) {
        try {
            const response = await fetch(item.url);
            if (response.ok) {
                const blob = await response.blob();
                folder.file(item.filename, blob);
            }
        } catch (e) {}
    }
    const content = await zip.generateAsync({type: "blob"});
    const reader = new FileReader();
    reader.onload = function() {
        chrome.downloads.download({ url: reader.result, filename: `Arsiv_${Date.now()}.zip`, saveAs: true });
    };
    reader.readAsDataURL(content);
}

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        const url = details.url;
        if (url.includes('google') || url.includes('analytics') || url.includes('facebook')) return;
        if (url.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|ico|json|html|pdf|doc|php)(\?|$)/i)) return;

        const headers = details.responseHeaders;
        let isMedia = false; let isHLS = false; let size = 0; let detectedExt = ".mp3";

        if (headers) {
            for (let h of headers) {
                let name = h.name.toLowerCase();
                let val = h.value.toLowerCase();
                if (name === 'content-type') {
                    if (val.includes('audio/')) { isMedia = true; if(val.includes('wav')) detectedExt=".wav"; }
                    if (val.includes('video/')) { isMedia = true; detectedExt=".mp4"; }
                    if (val.includes('mpegurl') || val.includes('hls')) { isMedia = true; isHLS = true; }
                }
                if (name === 'content-length') size = parseInt(val);
            }
        }
        if (isMedia && (isHLS || size > 20480 || size === 0)) {
            let sizeStr = size > 0 ? (size / 1024 / 1024).toFixed(2) + " MB" : "Stream";
            setTimeout(() => {
                let title = (details.tabId !== -1 && tabTitles[details.tabId]) ? tabTitles[details.tabId] : "Dosya";
                saveToStorage(url, title, sizeStr, isHLS, detectedExt);
            }, 800);
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);