// background.js - V69 (Anti-Duplicate Shield)

let tabTitles = {}; 
const processedUrls = new Set();
const processedBaseUrls = new Set(); 
// YENİ: Son kaydedilen dosyaları geçici tutan hafıza
const recentSaves = new Set();

const trMap = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};

try { importScripts('jszip.min.js'); } catch (e) {}

function sanitizeFilename(name) {
    if (!name || name === "undefined" || name === "null") return "Media_" + Date.now();
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

// --- ANA KAYIT FONKSİYONU ---
function saveToStorage(url, title, sizeInfo, isHLS = false, detectedExt = ".mp3") {
    const baseUrl = getBaseUrl(url);
    
    // 1. URL BAZLI KONTROL (Aynı link mi?)
    if (processedBaseUrls.has(baseUrl)) return;

    // İsim Belirleme
    let finalTitle = title;
    if (!finalTitle || finalTitle === "Dosya" || finalTitle === "Audio_File" || finalTitle === "Medya_Dosyasi") {
        try {
            finalTitle = decodeURIComponent(url.split('/').pop().split('?')[0]);
            finalTitle = finalTitle.replace(/\.(mp3|m4a|wav|mp4|m3u8)$/i, '');
        } catch(e) { finalTitle = "Stream_" + Date.now(); }
    }

    let finalFilename = sanitizeFilename(finalTitle);
    
    // Uzantı Düzeltme (Video ve Ses için)
    if (detectedExt === ".mp4") {
        if (!finalFilename.toLowerCase().endsWith(".mp4")) {
            finalFilename = finalFilename.replace(/\.(mp3|wav|m4a)$/i, '');
            finalFilename += ".mp4";
        }
    } else if (isHLS) {
        if (!finalFilename.match(/\.(m3u8|mp3|mp4)$/i)) finalFilename += ".mp3"; 
    } else {
        if (!finalFilename.toLowerCase().endsWith(detectedExt)) {
            finalFilename = finalFilename.replace(/\.(mp3|m4a|wav|mp4|aac)$/i, '');
            finalFilename += detectedExt;
        }
    }

    // --- 2. İSİM VE ZAMAN BAZLI KİLİT (YENİ) ---
    // Eğer bu isimde bir dosya son 5 saniye içinde kaydedildiyse, bunu yoksay.
    // Bu, EBA'daki çift tıklama veya preload sorununu çözer.
    if (recentSaves.has(finalFilename)) {
        console.log("🚫 Çift kayıt engellendi (Zaman Kilidi):", finalFilename);
        return;
    }

    const newItem = { 
        url: url, 
        filename: finalFilename, 
        size: sizeInfo || "?",
        type: (detectedExt === ".mp4") ? "video" : (isHLS ? "stream" : "audio") 
    };

    chrome.storage.local.get({ mediaList: [] }, (result) => {
        const list = result.mediaList;
        
        // 3. KALICI LİSTE KONTROLÜ (Daha önceden var mı?)
        const isDuplicateName = list.some(i => i.filename === finalFilename);
        const isDuplicateUrl = list.some(i => getBaseUrl(i.url) === baseUrl);

        if (!isDuplicateUrl) {
            // Eğer isim listede VARSA ama zaman kilidine takılmadıysa (yani eski bir kayıtsa)
            // veya URL farklıysa, ismin sonuna numara ekleyip kaydet.
            // ANCAK: recentSaves kontrolü zaten 5 saniye içindeki aynı isimleri engellediği için,
            // buraya gelen "DuplicateName" durumu, gerçekten farklı bir dosya ama aynı isimli demektir.
            if (isDuplicateName) {
                const timestamp = Date.now().toString().slice(-4);
                newItem.filename = newItem.filename.replace(/(\.[^.]+)$/, `_${timestamp}$1`);
            }

            // Kayıt İşlemleri
            processedUrls.add(url);
            processedBaseUrls.add(baseUrl);
            
            // İsim Kalkanını Aktif Et (5 Saniye boyunca bu ismi kilitle)
            recentSaves.add(finalFilename);
            setTimeout(() => { recentSaves.delete(finalFilename); }, 5000);

            list.push(newItem);
            chrome.storage.local.set({ mediaList: list }, () => updateBadge());
        }
    });
}

// MESAJLAR (Aynı Kaldı)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SET_TITLE") {
        if (sender.tab) tabTitles[sender.tab.id] = request.payload;
        sendResponse("OK");
    }
    if (request.action === "CLEAR") {
        processedUrls.clear(); processedBaseUrls.clear(); tabTitles = {}; recentSaves.clear();
        chrome.storage.local.set({ mediaList: [] }, () => { updateBadge(); sendResponse("CLEARED"); });
        return true; 
    }
    if (request.action === "RENAME_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const list = result.mediaList;
            const itemIndex = list.findIndex(i => i.url === request.url);
            if (itemIndex !== -1) {
                let newName = sanitizeFilename(request.newName);
                const oldExt = list[itemIndex].filename.split('.').pop();
                if(!newName.includes('.')) newName += "." + oldExt;
                list[itemIndex].filename = newName;
                chrome.storage.local.set({ mediaList: list }, () => sendResponse({status: "Renamed"}));
            }
        }); return true;
    }
    if (request.action === "DOWNLOAD_ONE") {
        chrome.storage.local.get({ folderName: "MediaGrabber_Downloads" }, (settings) => {
            let fname = sanitizeFilename(request.filename);
            const folder = settings.folderName || "MediaGrabber_Downloads";
            chrome.downloads.download({
                url: request.url, filename: folder + "/" + fname, conflictAction: 'uniquify', saveAs: false
            }, (id) => { sendResponse({success: !chrome.runtime.lastError}); });
        }); return true;
    }
    if (request.action === "DOWNLOAD_ALL") {
        chrome.storage.local.get({ mediaList: [], folderName: "MediaGrabber_Downloads" }, async (result) => {
            const list = result.mediaList || [];
            const folder = result.folderName || "MediaGrabber_Downloads";
            for(let item of list) {
                let fname = sanitizeFilename(item.filename);
                chrome.downloads.download({
                    url: item.url, filename: folder + "/" + fname, conflictAction: 'uniquify', saveAs: false
                });
                await new Promise(r => setTimeout(r, 1200));
            }
        }); sendResponse("BATCH_STARTED");
    }
    if (request.action === "DELETE_ITEM") {
        chrome.storage.local.get({ mediaList: [] }, (result) => {
            const targetBase = getBaseUrl(request.url);
            const newList = result.mediaList.filter(item => item.url !== request.url);
            processedUrls.delete(request.url); processedBaseUrls.delete(targetBase);
            chrome.storage.local.set({ mediaList: newList }, () => { updateBadge(); sendResponse({status: "Deleted"}); });
        }); return true;
    }
    if (request.action === "DOWNLOAD_ZIP") { downloadAndZip(); sendResponse("ZIP_STARTED"); }
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

async function downloadAndZip() { /* Zip aynı */ 
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

// --- NETWORK DİNLEYİCİ ---
chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        const url = details.url;
        const tabId = details.tabId;

        // Filtreler
        if (url.includes('google') || url.includes('analytics') || url.includes('facebook')) return;
        if (url.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|ico|json|html|pdf|doc)(\?|$)/i)) return;

        const headers = details.responseHeaders;
        let isMedia = false;
        let isHLS = false;
        let detectedExt = ".mp3";
        let size = 0;

        if (headers) {
            for (let i = 0; i < headers.length; i++) {
                const name = headers[i].name.toLowerCase();
                const value = headers[i].value.toLowerCase();
                if (name === 'content-type') {
                    // SVG Kesin Engel
                    if (value.includes('svg') || value.includes('image')) return;

                    if (value.includes('audio/')) { 
                        isMedia = true; 
                        if(value.includes('wav')) detectedExt = ".wav";
                        else if(value.includes('aac')) detectedExt = ".aac";
                        else if(value.includes('m4a')) detectedExt = ".m4a";
                    }
                    else if (value.includes('video/mp4') || value.includes('video/webm')) { 
                        isMedia = true; 
                        detectedExt = ".mp4"; 
                    }
                    else if (value.includes('application/octet-stream')) {
                         if (url.match(/\.(mp3|m4a|wav|aac)(\?|$)/i) || url.includes('/assets/')) isMedia = true;
                         if (url.match(/\.mp4(\?|$)/i)) { isMedia = true; detectedExt = ".mp4"; }
                    }
                    if (value.includes('mpegurl') || value.includes('hls')) { isMedia = true; isHLS = true; }
                }
                if (name === 'content-length') size = parseInt(value);
            }
        }
        if (url.includes('.m3u8') || url.includes('playlist')) { isMedia = true; isHLS = true; }

        if (!isMedia) {
            if (url.match(/\.mp4(\?|$)/i)) { isMedia = true; detectedExt = ".mp4"; }
            else if (url.match(/\.mp3(\?|$)/i)) { isMedia = true; detectedExt = ".mp3"; }
        }

        if (isMedia) {
            if (isHLS || size === 0 || size > 20000) {
                let sizeStr = isHLS ? "Stream" : (size > 0 ? (size / 1024 / 1024).toFixed(2) + " MB" : "Unknown");
                
                setTimeout(() => {
                    let nameToUse = "Dosya";
                    if (tabId !== -1 && tabTitles[tabId]) nameToUse = tabTitles[tabId];
                    else { try { nameToUse = decodeURIComponent(url.split('/').pop().split('?')[0]); } catch(e){} }
                    saveToStorage(url, nameToUse, sizeStr, isHLS, detectedExt);
                }, 800);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);