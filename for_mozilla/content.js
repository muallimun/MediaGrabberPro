// content.js - Universal Media Grabber Pro v30.1.1

function isContextValid() { return !!chrome.runtime && !!chrome.runtime.id; }

function findEbaToken() {
    for (let s of [window.localStorage, window.sessionStorage]) {
        if (!s) continue;
        for (let i = 0; i < s.length; i++) {
            let val = s.getItem(s.key(i));
            if (val && val.includes('eyJ')) {
                let m = val.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
                if (m) {
                    try {
                        const payload = JSON.parse(atob(m[0].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                        if (payload.exp && payload.exp * 1000 < Date.now()) continue;
                    } catch (e) {}
                    return 'Bearer ' + m[0];
                }
            }
        }
    }
    return null;
}

function extractSmartTitle(container) {
    if (!container) return "";
    let fullText = container.innerText || container.textContent || "";
    const labelRegex = /(sanatçı|sanatci|artist|şarkı|sarki|song|track|eser|title|parça|parca|müzik|music)\s*[:\-]\s*([^\n\r]+)/gi;
    
    let artist = "";
    let song = "";
    let match;
    while ((match = labelRegex.exec(fullText)) !== null) {
        let label = match[1].toLowerCase();
        let val = match[2].trim();
        if (val && val.length > 1 && val.length < 100) {
            if (label.includes('sanat') || label.includes('artist')) {
                if (!artist) artist = val;
            } else if (label.includes('şark') || label.includes('sark') || label.includes('song') || label.includes('track') || label.includes('eser') || label.includes('parça') || label.includes('parca')) {
                if (!song) song = val;
            }
        }
    }
    
    if (!artist && !song) {
        const rows = container.querySelectorAll('tr, .row, .item, [class*="info"]');
        for (let row of rows) {
            let rowText = (row.innerText || "").toLowerCase();
            if ((rowText.includes('sanatçı') || rowText.includes('sanatci') || rowText.includes('artist')) && !artist) {
                let clean = row.innerText.replace(/(?:sanatçı|sanatci|artist)\s*[:\-]?/gi, '').trim();
                if (clean && clean.length > 1 && clean.length < 100) artist = clean;
            }
            if ((rowText.includes('şarkı') || rowText.includes('sarki') || rowText.includes('song') || rowText.includes('eser')) && !song) {
                let clean = row.innerText.replace(/(?:şarkı|sarki|song|track|eser)\s*[:\-]?/gi, '').trim();
                if (clean && clean.length > 1 && clean.length < 100) song = clean;
            }
        }
    }
    
    if (artist && song && artist.toLowerCase() !== song.toLowerCase()) return `${artist} - ${song}`;
    if (song) return song;
    if (artist) return artist;
    return "";
}

function findBestTitle(element) {
    if (!element) return "";
    const blackList = ["play", "pause", "indir", "download", "oynat", "menu", "kapat", "0:00", "canlı dinle", "canli dinle", "canlı yayın", "daha fazla yükle", "türkçe", "arapça", "ingilizce", "almanca", "fransızca", "rusça", "hutbeler", "ana sayfa", "anasayfa", "kurumsal", "alt birimler", "hizmetler", "iletişim", "site haritası", "yayınlarımız", "başkanlık", "cumhurbaşkanlığı", "diyanet", "sanatçı", "sanatci", "artist", "şarkı", "sarki", "song", "track", "albüm", "album"];

    if (window.location.hostname.includes("eba.gov.tr")) {
        let ebaTitleEl = document.querySelector('[ng-bind="contentTitle"]') || document.querySelector('.content-title');
        if (ebaTitleEl && ebaTitleEl.innerText.trim().length > 2) return ebaTitleEl.innerText.trim();
    }

    const cleanAndValidate = (rawText) => {
        if (!rawText) return "";
        let txt = rawText.replace(/\d{1,2}:\d{2}/g, '').replace(/\d{2}\.\d{2}\.\d{4}/g, '').replace(/\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4}/g, '').trim();
        let lines = txt.split('\n').map(l => l.trim()).filter(l => l.length > 2 && !blackList.some(b => l.toLowerCase() === b || l.toLowerCase().includes("canlı dinle") || l.toLowerCase().includes("canli dinle")));
        if (lines.length === 0) return "";
        let candidate = lines[0];
        if (candidate.length > 3 && candidate.length < 130 && !blackList.some(b => candidate.toLowerCase() === b)) return candidate;
        return "";
    };

    if (window.location.hostname.includes("music.apple.com")) {
        const appleRow = element.closest('.songs-list-row, [class*="songs-list-row"], [data-testid="track-list-item"], li, tr, [role="row"]');
        if (appleRow) {
            const songTitleEl = appleRow.querySelector('.songs-list-row__song-name, [class*="song-name"], [data-testid="track-title"], .track-title');
            if (songTitleEl && songTitleEl.innerText.trim().length > 1) return songTitleEl.innerText.trim();
        }
    }

    if (element.tagName === 'VIDEO' || element.closest('video') || element.closest('.player')) {
        const container = element.closest('article, .video-container, .player-wrapper, [class*="video"], body');
        if (container) {
            let smart = extractSmartTitle(container);
            if (smart) return smart;
            const titleEl = container.querySelector('h1, h2, .video-title, [class*="title"]');
            if (titleEl) { let t = cleanAndValidate(titleEl.innerText); if (t) return t; }
        }
    }

    const card = element.closest('div[class*="broadcastFlowCard"], div[class*="Card"], div[class*="card"], div[class*="item"], li, tr, .audio-player, .list-item, article, [role="row"]');
    if (card) {
        let smartTitle = extractSmartTitle(card);
        if (smartTitle) return smartTitle;
        const headings = card.querySelectorAll('h1, h2, h3, h4, h5, strong, b, .title, [class*="title"], [class*="name"], td');
        for (let h of headings) { let t = cleanAndValidate(h.innerText || h.textContent); if (t) return t; }
        let rawText = card.innerText || card.textContent || "";
        if (rawText.length < 300) { let cardText = cleanAndValidate(rawText); if (cardText) return cardText; }
    }

    let cur = element;
    for (let i = 0; i < 6; i++) {
        if (!cur || cur.tagName === 'BODY' || cur.tagName === 'MAIN' || cur.tagName === 'HTML' || cur.tagName === 'HEADER' || cur.tagName === 'NAV') break;
        let rawText = cur.innerText || cur.title || cur.getAttribute('aria-label') || "";
        if (rawText.length < 300) { let t = cleanAndValidate(rawText); if (t) return t; }
        cur = cur.parentElement;
    }

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) { let t = cleanAndValidate(ogTitle.content); if (t) return t; }
    let docTitle = document.title;
    if (docTitle) {
        docTitle = docTitle.split('-')[0].split('|')[0].replace(/[\/\\?%*:|"<>]/g, '').trim();
        let tDoc = cleanAndValidate(docTitle); if (tDoc) return tDoc;
    }
    return "Media_File";
}

function showArakomToast(msg) {
    if (document.getElementById('arakom-toast')) document.getElementById('arakom-toast').remove();
    let toast = document.createElement('div');
    toast.id = 'arakom-toast';
    toast.innerHTML = msg;
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#27ae60; color:#fff; padding:12px 20px; border-radius:8px; font-family:"Segoe UI", sans-serif; font-size:14px; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.2); z-index:999999; transition:opacity 0.5s ease-in-out;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

let lastTitleTime = 0;
const handleGeneralMedia = (e) => {
    if (!isContextValid()) return;
    const title = findBestTitle(e.target);
    if (title && title !== "Media_File") {
        let now = Date.now();
        if (e.type === 'play' && (now - lastTitleTime < 2000)) return;
        if (e.type === 'mousedown' || e.type === 'click') lastTitleTime = now;
        let safeName = title.replace(/[\/\\?%*:|"<>]/g, '').trim();
        chrome.runtime.sendMessage({ action: "SET_TITLE", payload: safeName }).catch(() => {});
    }
};

document.addEventListener('mousedown', handleGeneralMedia, true);
document.addEventListener('click', handleGeneralMedia, true);
document.addEventListener('play', handleGeneralMedia, true);

let lastProcessedUrl = "";
let ebaDebounce = null;
function checkAndProcessEBA() {
    if (!isContextValid()) return;
    const currentUrl = window.location.href;
    if (currentUrl.includes("eba.gov.tr/dersler/detay/icerik") || currentUrl.includes("/icerik/")) {
        if (currentUrl !== lastProcessedUrl) {
            lastProcessedUrl = currentUrl;
            setTimeout(() => {
                if (!isContextValid()) return;
                let token = findEbaToken();
                let title = findBestTitle(document.body) || document.title;
                chrome.runtime.sendMessage({ action: "EBA_FOUND", url: currentUrl, title: title, token: token }, () => {
                    if (!chrome.runtime.lastError) showArakomToast('📥 Universal Media Grabber: İçerik Çözümleniyor...');
                });
            }, 2500);
        }
    }
}

if (document.body) {
    const observer = new MutationObserver(() => {
        clearTimeout(ebaDebounce);
        ebaDebounce = setTimeout(checkAndProcessEBA, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    checkAndProcessEBA();
}

// ============================================================
// YENİ: SAĞ TIK MENÜSÜNDEN GELEN TARAMA SİNYALİ
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_SCAN_FROM_MENU") {
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

        const links = Array.from(new Map(found.map(item => [item.url, item])).values());
        if (links.length > 0) {
            chrome.runtime.sendMessage({ action: "ADD_SCANNED_LINKS", payload: links, tabUrl: window.location.href }, (res) => {
                if (!chrome.runtime.lastError && res) showArakomToast(`🔍 ${res.count || links.length} yeni dosya bulundu`);
            });
        } else {
            showArakomToast('Sayfada indirilebilir medya bulunamadı.');
        }
        sendResponse({ status: "OK" });
    }
    return true;
});