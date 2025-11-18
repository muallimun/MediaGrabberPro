// background.js - V39 (Data Integrity)

let tabTitles = {}; 
const processedUrls = new Set();
const processedBaseUrls = new Set(); 
const trMap = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};

try { importScripts('jszip.min.js'); } catch (e) {}

function sanitizeFilename(name) {
    if (!name || name === "undefined" || name === "null") return "Audio_" + Date.now();
    let cleanName = name.replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match] || match);
    cleanName = cleanName.trim().replace(/\s+/g, '_');
    cleanName = cleanName.replace(/[^a-zA-Z0-9_\-.]/g, '');
    if (cleanName.length > 120) cleanName = cleanName.substring(0, 120);
    return cleanName;
}

function getBaseUrl(url) {
    try { return url.split('?')[0]; } catch(e) { return url; }
}

function updateBadge() {
    chrome.storage.local.get({ mediaList: [] }, (result) => {
        const count = result.mediaList ? result.mediaList.length : 0;
        chrome.action.setBadgeText({text: count > 0 ? count.toString() : ""});
        chrome.action.setBadgeBackgroundColor({color: "#e74c3c"});
    });
}

function saveToStorage(url, title, sizeInfo, isHLS = false) {
    const baseUrl = getBaseUrl(url);
    if (processedBaseUrls.has(baseUrl)) return;

    let finalTitle = title;
    if (!finalTitle || finalTitle === "Dosya" || finalTitle === "Audio_File") {
        try {
            finalTitle = decodeURIComponent(url.split('/').pop().split('?')[0]);
            finalTitle = finalTitle.replace(/\.(mp3|m4a|wav|m3u8)$/i, '');
        } catch(e) { finalTitle = "Stream_" + Date.now(); }
    }

    let finalFilename = sanitizeFilename(finalTitle);
    
    if (isHLS) {
        if (!finalFilename.match(/\.(m3u8|mp3)$/i)) finalFilename += ".mp3"; 
    } else {
        if (!finalFilename.match(/\.(mp3|m4a|wav|mp4|aac)$/i)) {
            if (url.includes('.m4a')) finalFilename += ".m4a";
            else if (url.includes('.wav')) finalFilename += ".wav";
            else finalFilename += ".mp3"; 
        }
    }

    const newItem = { 
        url: url, 
        filename: finalFilename, 
        size: sizeInfo || "?",
        type: isHLS ? "stream" : "file" 
    };

    chrome.storage.local.get({ mediaList: [] }, (result) => {
        const list = result.mediaList || []; // Hata koruması
        
        const isDuplicateName = list.some(i => i.filename === finalFilename);
        const isDuplicateUrl = list.some(i => getBaseUrl(i.url) === baseUrl);

        if (!isDuplicateUrl && !isDuplicateName) {
            processedUrls.add(url);
            processedBaseUrls.add(baseUrl);
            list.push(newItem);
            chrome.storage.local.set({ mediaList: list }, () => updateBadge());
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SET_TITLE") {
        if (sender.tab) tabTitles[sender.tab.id] = request.payload;
        sendResponse("OK");
    }
    if (request.action === "CLEAR") {
        processedUrls.clear();
        processedBaseUrls.clear();
        tabTitles = {}; 
        chrome.storage.local.set({ mediaList: [] }, () => {
            updateBadge();
            sendResponse("CLEARED");
        });
        return true; 
    }
    if (request.action === "RENAME_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const list = result.mediaList;
            const itemIndex = list.findIndex(i => i.url === request.url);
            if (itemIndex !== -1) {
                let newName = sanitizeFilename(request.newName);
                if(!newName.includes('.')) {
                     const oldExt = list[itemIndex].filename.split('.').pop();
                     newName += "." + oldExt;
                }
                list[itemIndex].filename = newName;
                chrome.storage.local.set({ mediaList: list }, () => sendResponse({status: "Renamed"}));
            }
        });
        return true;
    }
    if (request.action === "DOWNLOAD_ONE") {
        chrome.storage.local.get({ folderName: "MediaGrabber_Downloads" }, (settings) => {
            let fname = sanitizeFilename(request.filename);
            if(!fname.includes('.')) fname += ".mp3";
            
            // Eğer folderName boşsa veya undefined ise varsayılanı kullan
            const folder = settings.folderName || "MediaGrabber_Downloads";
            
            chrome.downloads.download({
                url: request.url,
                filename: folder + "/" + fname,
                conflictAction: 'uniquify',
                saveAs: false
            }, (id) => { 
                if(chrome.runtime.lastError) console.error(chrome.runtime.lastError);
                sendResponse({success: !chrome.runtime.lastError}); 
            });
        });
        return true;
    }
    if (request.action === "DOWNLOAD_ALL") {
        chrome.storage.local.get({ mediaList: [], folderName: "MediaGrabber_Downloads" }, async (result) => {
            const list = result.mediaList || [];
            const folder = result.folderName || "MediaGrabber_Downloads";
            
            for(let item of list) {
                let fname = sanitizeFilename(item.filename);
                chrome.downloads.download({
                    url: item.url,
                    filename: folder + "/" + fname,
                    conflictAction: 'uniquify',
                    saveAs: false
                });
                await new Promise(r => setTimeout(r, 1000));
            }
        });
        sendResponse("BATCH_STARTED");
    }
    if (request.action === "DELETE_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const targetBase = getBaseUrl(request.url);
            const newList = result.mediaList.filter(item => item.url !== request.url);
            processedUrls.delete(request.url);
            processedBaseUrls.delete(targetBase);
            chrome.storage.local.set({ mediaList: newList }, () => {
                updateBadge();
                sendResponse({status: "Deleted"});
            });
        });
        return true;
    }
    if (request.action === "DOWNLOAD_ZIP") {
        downloadAndZip();
        sendResponse("ZIP_STARTED");
    }
    if (request.action === "ADD_SCANNED_LINKS") {
        const links = request.payload;
        let count = 0;
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const list = result.mediaList;
            links.forEach(item => {
                saveToStorage(item.url, item.title, "Scan");
                count++;
            });
            sendResponse({addedCount: count});
        });
        return true;
    }
});

async function downloadAndZip() {
    const zip = new JSZip();
    const folder = zip.folder("Medya_Arsiv");
    const result = await chrome.storage.local.get({ mediaList: [] });
    const list = result.mediaList || [];
    if (list.length === 0) return;
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
        const url = reader.result;
        const date = new Date().toISOString().slice(0,10);
        chrome.downloads.download({ url: url, filename: `Arsiv_${date}.zip`, saveAs: true });
    };
    reader.readAsDataURL(content);
}

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        const url = details.url;
        const tabId = details.tabId;

        if (url.includes('google') || url.includes('analytics') || url.includes('facebook')) return;
        if (url.includes('.ts') && !url.includes('.mp3')) return;

        const headers = details.responseHeaders;
        let isAudio = false;
        let isHLS = false;
        let size = 0;

        if (headers) {
            for (let i = 0; i < headers.length; i++) {
                const name = headers[i].name.toLowerCase();
                const value = headers[i].value.toLowerCase();
                if (name === 'content-type') {
                    if (value.includes('audio/') || value.includes('video/mp4') || value.includes('octet-stream')) {
                         if (value.includes('octet-stream')) {
                            if (url.match(/\.(mp3|m4a|wav|aac)(\?|$)/i) || url.includes('/assets/')) isAudio = true;
                        } else {
                            isAudio = true;
                        }
                    }
                    if (value.includes('mpegurl') || value.includes('hls')) { isAudio = true; isHLS = true; }
                }
                if (name === 'content-length') size = parseInt(value);
            }
        }
        if (url.includes('.m3u8') || url.includes('playlist')) { isAudio = true; isHLS = true; }

        if (isAudio) {
            if (isHLS || size === 0 || size > 50000) {
                let sizeStr = isHLS ? "Stream" : (size > 0 ? (size / 1024 / 1024).toFixed(2) + " MB" : "Unknown");
                setTimeout(() => {
                    let nameToUse = "Dosya";
                    if (tabId !== -1 && tabTitles[tabId]) nameToUse = tabTitles[tabId];
                    else { try { nameToUse = decodeURIComponent(url.split('/').pop().split('?')[0]); } catch(e){} }
                    saveToStorage(url, nameToUse, sizeStr, isHLS);
                }, 600);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);