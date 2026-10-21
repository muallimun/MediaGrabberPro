// background.js - Universal Media Grabber Pro v30.1.8 (Chrome Final)

try { importScripts('jszip.min.js'); } catch (e) { console.error("JSZip yüklenemedi"); }

let processedUrls = new Set();
let blockedUrls = new Set();
let domainRules = {};
let storageQueue = Promise.resolve();

let offscreenReady = false;
let offscreenTimeout = null;

let settings = {
    folderName: 'UMG_Downloads', namingMethod: 'smart', customName: '',
    addDomain: false, addDate: false, addTime: false, adShieldEnabled: true,
    organizeByType: false, devMode: false, autoClear: false, notificationsEnabled: true
};

function log(...args) { if (settings.devMode) console.log('[UMG]', ...args); }

function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(settings, (sync) => {
            Object.assign(settings, sync || {});
            chrome.storage.local.get({ domainRules: {}, blockedUrls: [] }, (local) => {
                domainRules = local.domainRules || {};
                blockedUrls = new Set(local.blockedUrls || []);
                resolve();
            });
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: "scan-page-menu", title: "Universal Media Grabber: Bu Sayfayı Tara", contexts: ["page", "link", "image", "video", "audio"] });
        chrome.contextMenus.create({ id: "open-popup-menu", title: "Universal Media Grabber: Paneli Aç", contexts: ["page", "link", "image", "video", "audio"] });
    });

    chrome.storage.local.get({ blacklistedDomains: [], domainRules: {}, autoClear: false }, (res) => {
        const rules = res.domainRules || {};
        let migrated = false;
        (res.blacklistedDomains || []).forEach(d => { if (!rules[d]) { rules[d] = 'muted'; migrated = true; } });
        if (migrated) chrome.storage.local.set({ domainRules: rules, blacklistedDomains: [] });
        if (res.autoClear) { chrome.storage.sync.set({ autoClear: true }); chrome.storage.local.remove('autoClear'); }
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-popup-menu") {
        chrome.action.openPopup();
    } else if (info.menuItemId === "scan-page-menu") {
        chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_SCAN_FROM_MENU" }).catch(() => {});
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "scan_page") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) chrome.tabs.sendMessage(tabs[0].id, { action: "TRIGGER_SCAN_FROM_MENU" }).catch(() => {});
        });
    }
});

const AD_PATTERNS = ['doubleclick', 'googlesyndication', 'adservice', 'adnxs', 'taboola', 'criteo', 'vpaid', 'adsystem', 'scorecardresearch', '/analytics', '/adserver', 'pubmatic', 'rubiconproject', '/openx', 'adcolony', 'applovin', '/ads/', 'banner', 'sponsor'];
function isAdUrl(url) { if (!settings.adShieldEnabled) return false; const low = url.toLowerCase(); return AD_PATTERNS.some(p => low.includes(p)); }

function atomicStorageUpdate(updaterFn) {
    storageQueue = storageQueue.then(() => new Promise((resolve) => {
        chrome.storage.local.get({ mediaList: [] }, (res) => {
            let list = res.mediaList || [];
            const result = updaterFn(list) || {};
            if (result.list) list = result.list;
            chrome.storage.local.set({ mediaList: list }, () => { updateBadge(); resolve(result); });
        });
    }));
    return storageQueue;
}

const trMap = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};
const WIN_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

function sanitizeFilename(name) {
    if (!name || name === "undefined" || name === "null" || name === "Dosya") return "Media_" + Date.now().toString().slice(-4);
    let cleanName = String(name).replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m] || m);
    cleanName = cleanName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '').substring(0, 110);
    cleanName = cleanName.replace(/[.\s]+$/, '');
    if (WIN_RESERVED.test(cleanName.replace(/\.[^.]+$/, ''))) cleanName = '_' + cleanName;
    return cleanName || ("Media_" + Date.now().toString().slice(-4));
}

function normalizeUrl(url) {
    try { const u = new URL(url); ['token', 'expire', 't', 'timestamp', 'sig'].forEach(p => u.searchParams.delete(p)); return u.origin + u.pathname; }
    catch(e) { return url.split('?')[0]; }
}

function getCleanUrlFilename(url) {
    try {
        let raw = decodeURIComponent(new URL(url).pathname.split('/').pop().split('?')[0]);
        raw = raw.replace(/\.(mp3|mp4|m4a|wav|aac|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i, '').replace(/\.(plus|aac|ep|m4a)$/i, '');
        const junkPatterns = [/^mzaf_/i, /^aqp/i, /^aqm/i, /^aqn/i, /^aqo/i, /^videoplayback/i, /^chunk/i, /^segment/i, /^frag/i, /^media_?\d*$/i, /^dosya$/i, /^sanatci$/i, /^track$/i, /^unknown$/i, /^stream$/i, /^index$/i, /^[0-9a-f]{16,}$/i, /^[0-9_\-]+$/];
        if (!raw || raw.length < 3 || junkPatterns.some(rx => rx.test(raw))) return null;
        return raw;
    } catch(e) { return null; }
}

function getDomainRule(tabUrl) {
    try { return domainRules[new URL(tabUrl).hostname.replace('www.', '')] || 'all'; }
    catch(e) { return 'all'; }
}

function ruleAllows(rule, type) {
    if (rule === 'muted') return false;
    if (rule === 'all') return true;
    if (rule === 'audio') return type === 'Ses';
    if (rule === 'video') return type === 'Video';
    if (rule === 'documents') return type === 'PDF' || type === 'PDF/Belge' || type === 'SCORM' || type === 'Arşiv';
    return true;
}

function getTypeFolder(type) {
    if (!settings.organizeByType) return '';
    if (type === 'Ses') return 'Sesler';
    if (type === 'Video') return 'Videolar';
    if (type === 'PDF' || type === 'PDF/Belge') return 'Belgeler';
    if (type === 'SCORM' || type === 'Arşiv') return 'Arsiv';
    return 'Diger';
}

function updateBadge() {
    chrome.storage.local.get({ mediaList: [] }, (res) => {
        const count = (res.mediaList || []).length;
        if (count > 0) { 
            chrome.action.setBadgeText({ text: count.toString() }); 
            chrome.action.setBadgeBackgroundColor({ color: "#27ae60" }); 
            if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: "#ffffff" });
        } else {
            chrome.action.setBadgeText({ text: "" }); 
        }
    });
}

function addToMediaList(url, capturedTitle, sizeStr, sizeBytes, type, ext, source, tabId, pageTabTitle, sourceDomain) {
    const normUrl = normalizeUrl(url);
    return atomicStorageUpdate((list) => {
        if (list.some(i => normalizeUrl(i.url) === normUrl)) return { added: false };
        if (list.length >= 500) {
            const oldestDownloadedIdx = list.findIndex(i => i.downloaded);
            if (oldestDownloadedIdx !== -1) list.splice(oldestDownloadedIdx, 1); else list.shift();
        }

        let urlFilename = getCleanUrlFilename(url);
        let clickTitle = (capturedTitle && capturedTitle !== "Dosya" && capturedTitle !== "Web_Medyasi") ? capturedTitle : "";
        let cleanPageTitle = pageTabTitle ? pageTabTitle.split('-')[0].split('|')[0].trim() : "";
        let baseName = "Media";

        if (source === "EBA") baseName = (settings.namingMethod === 'custom' && settings.customName) ? settings.customName : (clickTitle || "Content_Package");
        else if (settings.namingMethod === 'smart') {
            if (clickTitle && !clickTitle.toLowerCase().includes("sanatci") && !clickTitle.toLowerCase().includes("canlı dinle") && !clickTitle.toLowerCase().includes("canli dinle")) baseName = clickTitle;
            else if (urlFilename) baseName = urlFilename;
            else if (cleanPageTitle && cleanPageTitle.length > 2) baseName = cleanPageTitle;
        } else if (settings.namingMethod === 'pageTitle') baseName = cleanPageTitle || clickTitle || urlFilename || "Page";
        else if (settings.namingMethod === 'urlSuffix') baseName = urlFilename || clickTitle || cleanPageTitle || "Media";
        else if (settings.namingMethod === 'custom') baseName = settings.customName || "Record";

        if (settings.addDomain) { try { baseName += "_" + new URL(url).hostname.replace('www.', '').replace(/\./g, '_'); } catch(e) {} }
        if (settings.addDate || settings.addTime) {
            const now = new Date();
            if (settings.addDate) baseName += "_" + now.getDate().toString().padStart(2,'0') + "_" + (now.getMonth()+1).toString().padStart(2,'0') + "_" + now.getFullYear();
            if (settings.addTime) baseName += "_" + now.getHours().toString().padStart(2,'0') + "_" + now.getMinutes().toString().padStart(2,'0') + "_" + now.getSeconds().toString().padStart(2,'0');
        }

        let finalName = sanitizeFilename(baseName);
        if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) finalName += ext;

        if (list.some(i => i.filename.toLowerCase() === finalName.toLowerCase())) {
            finalName = finalName.replace(/(\.[^.]+)$/, `_${Date.now().toString().slice(-6)}$1`);
        }

        processedUrls.add(normUrl);
        list.push({ url: url, filename: finalName, size: sizeStr || "? MB", sizeBytes: sizeBytes || null, type: type, source: source, sourceDomain: sourceDomain || "", pageTitle: cleanPageTitle || "", timestamp: Date.now(), downloaded: false, downloading: false, downloadError: null, downloadedAt: null });

        if (settings.notificationsEnabled) {
            chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Universal Media Grabber', message: `Yeni dosya: ${finalName}`, silent: true });
        }
        return { added: true };
    });
}

chrome.webRequest.onHeadersReceived.addListener((details) => {
    const url = details.url;
    const urlLow = url.toLowerCase();
    const normUrl = normalizeUrl(url);

    if (blockedUrls.has(normUrl)) return;
    if (urlLow.includes('eba.gov.tr') || urlLow.includes('fatihprojesi')) return;
    if (isAdUrl(url)) return;
    if (urlLow.includes('google') || urlLow.includes('facebook.com') || urlLow.includes('fbcdn.net') || urlLow.includes('instagram.com') || urlLow.includes('twitter.com') || urlLow.includes('twimg.com') || urlLow.includes('tiktok.com')) return;
    if (urlLow.match(/\.(ts|m4s|m3u8|vtt)(\?|$)/i)) return;

    let isMedia = false, size = 0, ext = ".mp3", mediaType = "Ses";
    if (details.responseHeaders) {
        details.responseHeaders.forEach(h => {
            const n = h.name.toLowerCase(), v = (h.value || '').toLowerCase();
            if (n === 'content-type') {
                if (v.includes('audio/')) { isMedia = true; ext = ".mp3"; mediaType = "Ses"; }
                else if (v.includes('video/')) { isMedia = true; ext = ".mp4"; mediaType = "Video"; }
                else if (v.includes('application/pdf')) { isMedia = true; ext = ".pdf"; mediaType = "PDF"; }
            }
            if (n === 'content-length') size = parseInt(v, 10) || 0;
        });
    }

    let minSize = 25000;
    if (settings.adShieldEnabled && mediaType === 'Video') minSize = 2 * 1024 * 1024;

    if (isMedia && (size > minSize || size === 0)) {
        if (processedUrls.has(normUrl)) return;
        const sizeStr = size > 0 ? (size / 1024 / 1024).toFixed(2) + " MB" : "Akış (Stream)";

        setTimeout(() => {
            chrome.storage.session.get({ tabTitles: {} }, (sess) => {
                const tabTitles = sess.tabTitles || {};
                const capturedTitle = tabTitles[details.tabId] || "";
                if (details.tabId && details.tabId !== -1) {
                    chrome.tabs.get(details.tabId, (tab) => {
                        if (chrome.runtime.lastError || !tab) { addToMediaList(url, capturedTitle, sizeStr, size, mediaType, ext, "Genel", details.tabId, "", ""); return; }
                        const pageTitle = tab.title || "";
                        let sourceDomain = "";
                        try { sourceDomain = new URL(tab.url).hostname.replace('www.', ''); } catch(e) {}
                        const rule = getDomainRule(tab.url || "");
                        if (!ruleAllows(rule, mediaType)) return;
                        addToMediaList(url, capturedTitle, sizeStr, size, mediaType, ext, "Genel", details.tabId, pageTitle, sourceDomain);
                    });
                } else {
                    addToMediaList(url, capturedTitle, sizeStr, size, mediaType, ext, "Genel", details.tabId, "", "");
                }
            });
        }, 800);
    }
}, { urls: ["<all_urls>"] }, ["responseHeaders"]);

async function resolveEbaRealMedia(cdnUrl, title, code, ebaToken) {
    if (!cdnUrl || !cdnUrl.includes('/')) return null;
    let baseDir = cdnUrl.substring(0, cdnUrl.lastIndexOf('/'));
    let packageCode = baseDir.split('/').pop();
    let hint = (title + " " + code).toLowerCase();
    let candidates = [];
    let mp3 = `${baseDir}/sco1/resources/sound/${packageCode}.mp3`;
    let mp4 = `${baseDir}/sco1/resources/video/${packageCode}.mp4`;
    let pdf1 = `${baseDir}/resources/pdf/${packageCode}.pdf`;
    let pdf2 = `${baseDir}/sco1/resources/pdf/${packageCode}.pdf`;

    if (hint.includes("ses") || hint.includes("dinleme") || hint.includes("audio") || hint.includes("mp3")) candidates = [mp3, pdf1, pdf2, mp4];
    else if (hint.includes("video") || hint.includes("animasyon") || hint.includes("mp4")) candidates = [mp4, mp3, pdf1, pdf2];
    else candidates = [pdf1, pdf2, mp3, mp4];

    let reqHeaders = { "Range": "bytes=0-0" };
    if (ebaToken) reqHeaders["authorization"] = ebaToken;

    for (let url of candidates) {
        try {
            let r = await fetch(url, { method: 'GET', headers: reqHeaders, credentials: 'include' }); 
            if (r.ok || r.status === 206) {
                let cType = (r.headers.get('content-type') || '').toLowerCase();
                if (!cType.includes('text/html')) {
                    let ext = url.split('.').pop().toLowerCase();
                    return { url: url, type: ext === 'pdf' ? 'PDF' : (ext === 'mp4' ? 'Video' : 'Ses'), ext: '.' + ext };
                }
            }
        } catch (e) {}
    }

    let htmlUrls = [`${baseDir}/sco1/dataLevel.html`, `${baseDir}/dataLevel.html`, cdnUrl];
    for (let hUrl of htmlUrls) {
        try {
            let r = await fetch(hUrl, { headers: ebaToken ? { "authorization": ebaToken } : {}, credentials: 'include' }); 
            if (r.ok || r.status === 206) {
                let text = await r.text();
                let matches = text.match(/([a-zA-Z0-9_\-\/]+\.(?:mp3|mp4|pdf))/gi);
                if (matches) {
                    for (let match of matches) {
                        let cleanMatch = match.replace(/^\//, '');
                        let possibleUrls = [`${baseDir}/sco1/${cleanMatch}`, `${baseDir}/${cleanMatch}`];
                        for (let pUrl of possibleUrls) {
                            try {
                                let cr = await fetch(pUrl, { method: 'GET', headers: reqHeaders, credentials: 'include' }); 
                                if (cr.ok || cr.status === 206) {
                                    let cType = (cr.headers.get('content-type') || '').toLowerCase();
                                    if (!cType.includes('text/html')) {
                                        let ext = pUrl.split('.').pop().toLowerCase();
                                        let type = ext === 'mp4' ? 'Video' : (ext === 'mp3' ? 'Ses' : 'PDF');
                                        return { url: pUrl, type: type, ext: '.' + ext };
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

async function processEbaApi(url, title, ebaToken) {
    try {
        let uuidMatch = url.match(/\/icerik\/([a-f0-9\-]{36})/);
        if (!uuidMatch) return;
        let uuid = uuidMatch[1];
        let headers = { "x-platform": "web", "Accept": "application/json" };
        if (ebaToken) headers["authorization"] = ebaToken;

        let res = await fetch(`https://eba.gov.tr/api/v1/content/management/${uuid}`, { headers, credentials: 'include' }); 
        if (!res.ok) return;
        let data = await res.json();
        if (!data || !data.data) return;

        let cdnUrl = data.data.file?.cdn_url || data.data.external_link;
        if (!cdnUrl) return;
        if (processedUrls.has(normalizeUrl(cdnUrl)) || blockedUrls.has(normalizeUrl(cdnUrl))) return;

        let contentType = (data.data.content_type || "").toUpperCase();
        let apiTitle = data.data.name || title;
        let fileExt = (data.data.file?.file_extension || "").toLowerCase();
        let ext = ".bin"; let type = "Bilinmiyor";

        if (contentType.includes("INTERACTIVE") || cdnUrl.includes("start.htm") || cdnUrl.includes("index.html") || fileExt === 'zip') {
            let realMedia = await resolveEbaRealMedia(cdnUrl, apiTitle, data.data.code, ebaToken);
            if (realMedia) { cdnUrl = realMedia.url; type = realMedia.type; ext = realMedia.ext; }
            else { type = "SCORM"; ext = ".zip"; }
        } else if (contentType.includes("VIDEO") || cdnUrl.endsWith(".mp4")) { type = "Video"; ext = ".mp4"; }
        else if (contentType.includes("AUDIO") || cdnUrl.endsWith(".mp3")) { type = "Ses"; ext = ".mp3"; }
        else if (contentType.includes("DOCUMENT") || cdnUrl.endsWith(".pdf")) { type = "PDF"; ext = ".pdf"; }

        const ebaRule = domainRules['eba.gov.tr'] || 'all';
        if (!ruleAllows(ebaRule, type)) return;

        await addToMediaList(cdnUrl, apiTitle, "API Çözümlendi", null, type, ext, "EBA", -1, url, "eba.gov.tr");
    } catch (e) { console.error("EBA API Hatası:", e); }
}

async function ensureOffscreen() {
    if (offscreenTimeout) clearTimeout(offscreenTimeout);
    offscreenTimeout = setTimeout(() => {
        chrome.offscreen.closeDocument().catch(() => {});
        offscreenReady = false;
    }, 5 * 60 * 1000);
    
    if (offscreenReady) return;
    try { await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Büyük ZIP dosyaları için blob URL oluşturma' }); } catch (e) { }
    offscreenReady = true;
}

function dispatchScormDownload(baseDir, originalUrl, filename, folderName, saveAs) {
    return new Promise(async (resolve) => {
        await ensureOffscreen();
        const targetPath = folderName ? `${folderName}/${filename}` : filename;
        
        chrome.runtime.sendMessage({ action: 'BUILD_SCORM_ZIP', baseDir: baseDir, originalUrl: originalUrl, filename: targetPath, saveAs: !!saveAs }, (response) => {
            if (response && response.ok && response.downloadId) {
                chrome.storage.session.get({ downloadIdMap: {} }, (s) => {
                    const map = s.downloadIdMap || {};
                    map[response.downloadId] = { normalizedUrl: normalizeUrl(originalUrl), url: originalUrl };
                    chrome.storage.session.set({ downloadIdMap: map }, resolve);
                });
            } else {
                const errMsg = response?.err || 'SCORM paketi indirilemedi';
                atomicStorageUpdate((list) => {
                    const idx = list.findIndex(i => normalizeUrl(i.url) === normalizeUrl(originalUrl));
                    if (idx !== -1) { list[idx].downloading = false; list[idx].downloadError = errMsg; }
                    return { list };
                }).then(resolve);
            }
        });
    });
}

function dispatchBulkZip(items, filename) {
    return new Promise(async (resolve) => {
        await ensureOffscreen();
        const zipItems = items.filter(i => i.type !== 'SCORM').map(i => ({ url: i.url, filename: i.filename }));
        chrome.runtime.sendMessage({ action: 'BUILD_BULK_ZIP', items: zipItems, filename: filename }, (response) => resolve(response));
    });
}

async function dispatchDownload(url, filename, type, saveAs = false) {
    return new Promise((resolve) => {
        const rootFolder = (settings.folderName && settings.folderName.trim() !== "") ? settings.folderName.trim() : "";
        const subFolder = getTypeFolder(type);
        let rootPath = rootFolder;
        if (subFolder) rootPath = rootPath ? `${rootPath}/${subFolder}` : subFolder;
        const targetFilename = rootPath ? `${rootPath}/${filename}` : filename;

        atomicStorageUpdate((list) => {
            const idx = list.findIndex(i => normalizeUrl(i.url) === normalizeUrl(url));
            if (idx !== -1) { list[idx].downloading = true; list[idx].downloadError = null; }
            return { list };
        }).then(() => {
            if (type === "SCORM") {
                chrome.tabs.query({ url: "*://*.eba.gov.tr/*" }, (tabs) => {
                    if (tabs && tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: "DOWNLOAD_VIA_PAGE", url: url, filename: targetFilename }, (response) => {
                            if (response && response.ok) {
                                atomicStorageUpdate((list) => {
                                    const idx = list.findIndex(i => normalizeUrl(i.url) === normalizeUrl(url));
                                    if (idx !== -1) { list[idx].downloaded = true; list[idx].downloading = false; list[idx].downloadedAt = Date.now(); list[idx].downloadError = null; }
                                    return { list };
                                }).then(resolve);
                            } else {
                                const baseDir = url.substring(0, url.lastIndexOf('/'));
                                dispatchScormDownload(baseDir, url, filename, rootPath, saveAs).then(resolve);
                            }
                        });
                    } else {
                        const baseDir = url.substring(0, url.lastIndexOf('/'));
                        dispatchScormDownload(baseDir, url, filename, rootPath, saveAs).then(resolve);
                    }
                });
                return;
            }
            chrome.downloads.download({ url: url, filename: targetFilename, conflictAction: 'uniquify', saveAs: !!saveAs }, (downloadId) => {
                if (chrome.runtime.lastError || !downloadId) {
                    atomicStorageUpdate((list) => {
                        const idx = list.findIndex(i => normalizeUrl(i.url) === normalizeUrl(url));
                        if (idx !== -1) { list[idx].downloading = false; list[idx].downloadError = chrome.runtime.lastError?.message || 'İndirme başlatılamadı'; }
                        return { list };
                    }).then(resolve);
                    return;
                }
                chrome.storage.session.get({ downloadIdMap: {} }, (s) => {
                    const map = s.downloadIdMap || {};
                    map[downloadId] = { normalizedUrl: normalizeUrl(url), url: url };
                    chrome.storage.session.set({ downloadIdMap: map }, resolve);
                });
            });
        });
    });
}

class DownloadQueue {
    constructor(concurrency = 3) { this.concurrency = concurrency; this.running = 0; this.queue = []; }
    add(task) { return new Promise((resolve, reject) => { this.queue.push({ task, resolve, reject }); this.process(); }); }
    process() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const { task, resolve, reject } = this.queue.shift();
            this.running++;
            task().then(resolve).catch(reject).finally(() => { this.running--; this.process(); });
        }
    }
}
const downloadQueue = new DownloadQueue(3);

chrome.downloads.onChanged.addListener((delta) => {
    if (!delta.state || !delta.id) return;
    chrome.storage.session.get({ downloadIdMap: {} }, (sess) => {
        const map = sess.downloadIdMap || {};
        const entry = map[delta.id];
        if (!entry) return;
        if (delta.state.current === 'complete') {
            atomicStorageUpdate((list) => {
                const idx = list.findIndex(i => normalizeUrl(i.url) === entry.normalizedUrl);
                if (idx !== -1) { list[idx].downloaded = true; list[idx].downloading = false; list[idx].downloadedAt = Date.now(); list[idx].downloadError = null; }
                return { list };
            }).then(() => { delete map[delta.id]; chrome.storage.session.set({ downloadIdMap: map }); });
        } else if (delta.state.current === 'interrupted') {
            atomicStorageUpdate((list) => {
                const idx = list.findIndex(i => normalizeUrl(i.url) === entry.normalizedUrl);
                if (idx !== -1) { list[idx].downloading = false; list[idx].downloadError = (delta.error && delta.error.current) || 'Bilinmeyen hata'; }
                return { list };
            }).then(() => { delete map[delta.id]; chrome.storage.session.set({ downloadIdMap: map }); });
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SET_TITLE" && sender.tab) {
        chrome.storage.session.get({ tabTitles: {} }, (sess) => {
            const tt = sess.tabTitles || {};
            tt[sender.tab.id] = request.payload;
            chrome.storage.session.set({ tabTitles: tt }, () => sendResponse({ status: "OK" }));
        });
        return true;
    }

    if (request.action === "EBA_FOUND") { processEbaApi(request.url, request.title, request.token); sendResponse({ status: "OK" }); return true; }

    // YENİ: Content Script'ten gelen Data URL'yi (Base64) indirme
    if (request.action === "DOWNLOAD_FROM_DATA_URL") {
        chrome.downloads.download({
            url: request.dataUrl,
            filename: request.filename,
            conflictAction: 'uniquify',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError || !downloadId) {
                sendResponse({ ok: false, err: chrome.runtime.lastError?.message || 'İndirme başlatılamadı' });
            } else {
                chrome.storage.session.get({ downloadIdMap: {} }, (s) => {
                    const map = s.downloadIdMap || {};
                    map[downloadId] = { normalizedUrl: '', url: '' }; // Data URL olduğu için eşleşme gerekmez, anında yeşil yapılacak
                    chrome.storage.session.set({ downloadIdMap: map }, () => {
                        // Listeyi hemen güncelle
                        atomicStorageUpdate((list) => {
                            const idx = list.findIndex(i => i.filename === request.filename || i.filename.includes(request.filename));
                            if (idx !== -1) { list[idx].downloaded = true; list[idx].downloading = false; list[idx].downloadedAt = Date.now(); list[idx].downloadError = null; }
                            return { list };
                        }).then(() => sendResponse({ ok: true }));
                    });
                });
            }
        });
        return true;
    }

    if (request.action === "ADD_SCANNED_LINKS") {
        let senderUrl = request.tabUrl || (sender.tab && sender.tab.url) || '';
        let senderDomain = '';
        try { senderDomain = new URL(senderUrl).hostname.replace('www.', ''); } catch(e) {}
        const rule = getDomainRule(senderUrl);

        (async () => {
            let addedCount = 0;
            for (const item of (request.payload || [])) {
                if (!item || !item.url) continue;
                if (blockedUrls.has(normalizeUrl(item.url))) continue;
                if (!ruleAllows(rule, item.type)) continue;

                let ext = item.ext || ".pdf"; if (!ext.startsWith('.')) ext = '.' + ext;
                let type = item.type || "PDF";
                let urlFile = getCleanUrlFilename(item.url);
                let baseName = item.title || urlFile || "Document";

                if (settings.namingMethod === 'urlSuffix' && urlFile) baseName = urlFile;
                else if (settings.namingMethod === 'custom' && settings.customName) baseName = settings.customName;
                if (settings.addDomain) { try { baseName += "_" + new URL(item.url).hostname.replace('www.', '').replace(/\./g, '_'); } catch(e) {} }
                if (settings.addDate) { const now = new Date(); baseName += "_" + now.getDate().toString().padStart(2,'0') + "_" + (now.getMonth()+1).toString().padStart(2,'0') + "_" + now.getFullYear(); }

                let finalName = sanitizeFilename(baseName);
                if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) finalName += ext;

                const result = await addToMediaList(item.url, item.title || '', "Sayfa Linki", null, type, ext, "Tarayıcı", -1, "", senderDomain);
                if (result && result.added) addedCount++;
            }
            sendResponse({ status: "Eklendi", count: addedCount });
        })();
        return true;
    }

    if (request.action === "BLOCK_URL") {
        const normUrl = normalizeUrl(request.url);
        blockedUrls.add(normUrl);
        chrome.storage.local.set({ blockedUrls: Array.from(blockedUrls) }, () => {
            atomicStorageUpdate((list) => { return { list: list.filter(i => normalizeUrl(i.url) !== normUrl) }; }).then(() => sendResponse({ status: "Engellendi" }));
        });
        return true;
    }

    if (request.action === "BLOCK_SITE") {
        const domain = request.domain.replace('www.', '');
        domainRules[domain] = 'muted';
        chrome.storage.local.set({ domainRules: domainRules }, () => {
            atomicStorageUpdate((list) => { return { list: list.filter(i => i.sourceDomain !== domain) }; }).then(() => sendResponse({ status: "Engellendi" }));
        });
        return true;
    }

    if (request.action === "DOWNLOAD_ITEM") { dispatchDownload(request.url, request.filename, request.type, request.saveAs || false); sendResponse({ status: "Başlatıldı" }); return true; }

    if (request.action === "DOWNLOAD_LIST") {
        (async () => {
            const res = await chrome.storage.local.get({ mediaList: [] });
            const items = res.mediaList || [];
            const selectedSet = new Set(request.urls || []);
            const toDownload = items.filter(i => { const isSelected = selectedSet.size === 0 || selectedSet.has(i.url); return isSelected && !i.downloaded; });
            const skipped = (selectedSet.size === 0 ? items.length : selectedSet.size) - toDownload.length;
            for (const item of toDownload) downloadQueue.add(() => dispatchDownload(item.url, item.filename, item.type, false));
            sendResponse({ status: "Toplu Başlatıldı", count: toDownload.length, skipped: skipped });
        })();
        return true;
    }

    if (request.action === "DOWNLOAD_ZIP") {
        (async () => {
            const res = await chrome.storage.local.get({ mediaList: [] });
            const items = res.mediaList || [];
            const selectedSet = new Set(request.urls || []);
            const toZip = items.filter(i => selectedSet.size === 0 || selectedSet.has(i.url));
            dispatchBulkZip(toZip, `UMG_Archive_${Date.now()}.zip`);
            sendResponse({ status: "ZIP Başlatıldı" });
        })();
        return true;
    }

    if (request.action === "CLEAR_LIST") {
        if (request.urls && Array.isArray(request.urls) && request.urls.length > 0) {
            const toDelete = new Set(request.urls);
            atomicStorageUpdate((list) => {
                const newList = list.filter(i => !toDelete.has(i.url));
                toDelete.forEach(u => processedUrls.delete(normalizeUrl(u)));
                return { list: newList };
            }).then(() => sendResponse({ status: "Temizlendi" }));
        } else {
            processedUrls.clear();
            chrome.storage.local.set({ mediaList: [] }, () => { updateBadge(); sendResponse({ status: "Temizlendi" }); });
        }
        return true;
    }

    if (request.action === "CLEAR_DOWNLOADED") {
        atomicStorageUpdate((list) => { return { list: list.filter(i => !i.downloaded) }; }).then((res) => sendResponse({ status: "OK" }));
        return true;
    }

    if (request.action === "RENAME_ITEM") {
        atomicStorageUpdate((list) => {
            const idx = list.findIndex(i => i.url === request.url);
            if (idx !== -1) { const ext = list[idx].filename.split('.').pop(); list[idx].filename = sanitizeFilename(request.newName) + "." + ext; }
            return { list };
        }).then(() => sendResponse("OK"));
        return true;
    }

    if (request.action === "DELETE_ITEM") {
        atomicStorageUpdate((list) => { return { list: list.filter(i => i.url !== request.url) }; }).then(() => {
            processedUrls.delete(normalizeUrl(request.url));
            sendResponse("OK");
        });
        return true;
    }

    if (request.action === "SET_DOMAIN_RULE") {
        chrome.storage.local.get({ domainRules: {} }, (res) => {
            const rules = res.domainRules || {};
            if (request.rule === 'all') delete rules[request.domain]; else rules[request.domain] = request.rule;
            chrome.storage.local.set({ domainRules: rules }, () => { domainRules = rules; sendResponse({ status: "OK" }); });
        });
        return true;
    }

    if (request.action === "GET_DOMAIN_RULE") {
        chrome.storage.local.get({ domainRules: {} }, (res) => {
            const rules = res.domainRules || {};
            sendResponse({ rule: rules[request.domain] || 'all' });
        });
        return true;
    }

    if (request.action === "GET_SETTINGS") { sendResponse(settings); return true; }

    if (request.action === "SAVE_SETTINGS") {
        const toSave = request.settings || {};
        Object.assign(settings, toSave);
        chrome.storage.sync.set(toSave, () => sendResponse({ status: "OK" }));
        return true;
    }

    return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.get({ tabTitles: {} }, (sess) => {
        const tt = sess.tabTitles || {};
        if (tt[tabId]) { delete tt[tabId]; chrome.storage.session.set({ tabTitles: tt }); }
    });
});

loadSettings();