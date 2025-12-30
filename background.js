// background.js - v29.2.0 (Naming, Deletion Restoration & Spam Shield - FULL)

let tabTitles = {}; 
const processedBaseUrls = new Set(); // Silinenlerin tekrar yakalanabilmesi için Set olarak tutuluyor
const activeDownloads = new Map();

const trMap = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};

try { importScripts('jszip.min.js'); } catch (e) { console.error("JSZip yüklenemedi"); }

function sanitizeFilename(name) {
    if (!name || name === "undefined" || name === "null" || name === "Dosya") return "Media_" + Date.now();
    let cleanName = name.replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match] || match);
    return cleanName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '').substring(0, 110);
}

function normalizeUrl(url) {
    try {
        const u = new URL(url);
        ['token', 'expire', 't', 'timestamp', 'sig'].forEach(p => u.searchParams.delete(p));
        return u.origin + u.pathname;
    } catch(e) { return url.split('?')[0]; }
}

function updateBadge() {
    chrome.storage.local.get({ mediaList: [] }, (res) => {
        const count = res.mediaList.length;
        chrome.action.setBadgeText({text: count > 0 ? count.toString() : ""});
        chrome.action.setBadgeBackgroundColor({color: "#e74c3c"});
    });
}

function saveToStorage(url, title, sizeInfo, detectedExt = ".mp3", tabId = -1) {
    const normUrl = normalizeUrl(url);
    const baseUrl = url.split('?')[0];
    if (processedBaseUrls.has(baseUrl)) return; // Spam Shield

    chrome.storage.local.get({ 
        mediaList: [], namingMethod: 'smart', customName: 'Media',
        addDomain: false, addDate: false, addTime: false 
    }, (settings) => {
        let list = settings.mediaList || [];
        if (list.some(i => normalizeUrl(i.url) === normUrl)) return;

        let baseName = "Media";

        // --- DİNAMİK İSİMLENDİRME MOTORU ---
        if (settings.namingMethod === 'smart') {
            baseName = title || "Dosya";
            if (baseName === "Dosya") {
                try { baseName = decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.(mp3|mp4|m4a|wav|aac)$/i, ''); } catch(e) {}
            }
        } else if (settings.namingMethod === 'pageTitle' && tabId !== -1) {
            baseName = tabTitles[tabId] || "Sayfa";
        } else if (settings.namingMethod === 'urlSuffix') {
            try { baseName = decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.(mp3|mp4|m4a|wav|aac)$/i, ''); } catch(e) {}
        } else if (settings.namingMethod === 'custom') {
            baseName = settings.customName || "Kayit";
        }

        // Opsiyonel Ek Bilgiler
        if (settings.addDomain) {
            try { const dom = new URL(url).hostname.replace('www.', '').replace(/\./g, '_'); baseName += "_" + dom; } catch(e) {}
        }
        if (settings.addDate || settings.addTime) {
            const now = new Date();
            if (settings.addDate) baseName += "_" + now.getDate().toString().padStart(2,'0') + "_" + (now.getMonth()+1).toString().padStart(2,'0') + "_" + now.getFullYear();
            if (settings.addTime) baseName += "_" + now.getHours().toString().padStart(2,'0') + "_" + now.getMinutes().toString().padStart(2,'0') + "_" + now.getSeconds().toString().padStart(2,'0');
        }

        let filenameToSave = sanitizeFilename(baseName);
        if (!filenameToSave.toLowerCase().endsWith(detectedExt)) filenameToSave += detectedExt;

        // Çakışma Önleyici (Sadece gerçekten aynı isim varsa random sayı ekler)
        if (list.some(i => i.filename === filenameToSave && normalizeUrl(i.url) !== normUrl)) {
            filenameToSave = filenameToSave.replace(/(\.[^.]+)$/, `_${Date.now().toString().slice(-4)}$1`);
        }

        processedBaseUrls.add(baseUrl);
        list.push({ url, filename: filenameToSave, size: sizeInfo || "? MB", type: detectedExt === ".mp4" ? "video" : "audio", timestamp: Date.now() });
        chrome.storage.local.set({ mediaList: list }, () => updateBadge());
    });
}

// MESAJ DİNLEYİCİSİ (Tüm butonların işlevleri burada)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SET_TITLE" && sender.tab) tabTitles[sender.tab.id] = request.payload;
    
    if (request.action === "CLEAR") {
        processedBaseUrls.clear(); tabTitles = {};
        chrome.storage.local.set({ mediaList: [] }, () => { updateBadge(); sendResponse("CLEARED"); });
        return true;
    }
    
    if (request.action === "DELETE_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (res) => {
            const newList = res.mediaList.filter(i => i.url !== request.url);
            processedBaseUrls.delete(request.url.split('?')[0]); // Tekrar yakalanabilmesi için temizlendi
            chrome.storage.local.set({ mediaList: newList }, () => { updateBadge(); sendResponse("OK"); });
        }); return true;
    }

    if (request.action === "DELETE_LIST") {
        chrome.storage.local.get({ mediaList: [] }, (res) => {
            const newList = res.mediaList.filter(i => !request.urls.includes(i.url));
            request.urls.forEach(u => processedBaseUrls.delete(u.split('?')[0]));
            chrome.storage.local.set({ mediaList: newList }, () => { updateBadge(); sendResponse("OK"); });
        }); return true;
    }

    if (request.action === "RENAME_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (res) => {
            const list = res.mediaList; const idx = list.findIndex(i => i.url === request.url);
            if (idx !== -1) {
                const ext = list[idx].filename.split('.').pop();
                list[idx].filename = sanitizeFilename(request.newName) + "." + ext;
                chrome.storage.local.set({ mediaList: list }, () => sendResponse("OK"));
            }
        }); return true;
    }

    if (request.action === "DOWNLOAD_ONE") {
        chrome.storage.local.get({ folderName: "MediaGrabber_Downloads" }, (s) => {
            chrome.downloads.download({ url: request.url, filename: (s.folderName || "MediaGrabber_Downloads") + "/" + request.filename, conflictAction: 'uniquify' });
        });
    }

    if (request.action === "DOWNLOAD_LIST") {
        chrome.storage.local.get({ mediaList: [], folderName: "MediaGrabber_Downloads" }, async (res) => {
            for(let u of request.urls) {
                const item = res.mediaList.find(i => i.url === u);
                if(item) {
                    chrome.downloads.download({ url: item.url, filename: (res.folderName || "MediaGrabber_Downloads") + "/" + item.filename, conflictAction: 'uniquify' });
                    await new Promise(r => setTimeout(r, 1200)); // Chrome API limitlerine uygun gecikme
                }
            }
        });
    }

    if (request.action === "DOWNLOAD_ZIP") downloadAndZip();
    return true;
});

async function downloadAndZip() {
    const zip = new JSZip();
    const result = await chrome.storage.local.get({ mediaList: [] });
    for (const item of result.mediaList) {
        try { const res = await fetch(item.url); if (res.ok) zip.file(item.filename, await res.blob()); } catch (e) {}
    }
    zip.generateAsync({type: "blob"}).then(content => {
        const reader = new FileReader();
        reader.onload = () => chrome.downloads.download({ url: reader.result, filename: `Archive_${Date.now()}.zip`, saveAs: true });
        reader.readAsDataURL(content);
    });
}

chrome.webRequest.onHeadersReceived.addListener((details) => {
    const url = details.url;
    if (url.includes('google') || url.match(/\.(ts|m4s|m3u8)(\?|$)/i)) return; // Spam Shield

    let isMedia = false; let size = 0; let ext = ".mp3";
    details.responseHeaders.forEach(h => {
        const n = h.name.toLowerCase(); const v = h.value.toLowerCase();
        if (n === 'content-type') {
            if (v.includes('audio/')) isMedia = true;
            if (v.includes('video/')) { isMedia = true; ext = ".mp4"; }
        }
        if (n === 'content-length') size = parseInt(v);
    });

    if (isMedia && (size > 25000 || size === 0)) {
        const sizeStr = size > 0 ? (size / 1024 / 1024).toFixed(2) + " MB" : "Unknown";
        setTimeout(() => saveToStorage(url, tabTitles[details.tabId] || "Dosya", sizeStr, ext, details.tabId), 800);
    }
}, { urls: ["<all_urls>"] }, ["responseHeaders"]);