// content.js - V68

function findBestTitle(element) {
    let current = element;
    const blackList = ["play", "pause", "stop", "indir", "download", "oynat", "kapat", "daha", "yükle", "listen", "click", "button", "menu", "list", "volume"];

    // 1. Diyanet Radyo Özel Kart Yapısı (KORUNDU)
    const cardContainer = element.closest('div[class*="broadcastFlowCard"], div[class*="card"], div[class*="item"], li, tr');
    if (cardContainer) {
        const headers = cardContainer.querySelectorAll('h3, h4, h5, strong, .title, [class*="title"]');
        for (let h of headers) {
            let text = h.innerText.trim();
            if (text.length > 3 && !blackList.some(b => text.toLowerCase().includes(b))) {
                if (!text.match(/^\d{1,2}:\d{2}$/)) return text;
            }
        }
    }

    // 2. YENİ: Video Başlığı
    if (element.tagName === 'VIDEO' || element.closest('video') || element.closest('.player')) {
        const videoContainer = element.closest('article, .video-container, .player-wrapper, body');
        if (videoContainer) {
            const h1 = videoContainer.querySelector('h1');
            if (h1 && h1.innerText.length > 3) return h1.innerText.trim();
            const vTitle = videoContainer.querySelector('.video-title, .entry-title');
            if (vTitle) return vTitle.innerText.trim();
        }
    }

    // 3. Genel Arama (KORUNDU)
    current = element;
    for (let i = 0; i < 6; i++) {
        if (!current || current.tagName === 'BODY') break;
        
        const label = current.getAttribute('aria-label') || current.title;
        if (label && label.length > 3 && !blackList.some(b => label.toLowerCase().includes(b))) return label.trim();
        
        if (current.innerText && current.innerText.length > 3 && current.innerText.length < 150) {
             const lines = current.innerText.split('\n');
             for(let line of lines) {
                 line = line.trim();
                 if(line.length > 3 && !blackList.some(b => line.toLowerCase().includes(b))) return line;
             }
        }
        current = current.parentElement;
    }
    return "";
}

const handleInteraction = (e) => {
    const title = findBestTitle(e.target);
    if (title) {
        let safeName = title.replace(/[\/\\?%*:|"<>]/g, '').trim();
        chrome.runtime.sendMessage({ action: "SET_TITLE", payload: safeName });
    }
};

document.addEventListener('mousedown', handleInteraction, true);
document.addEventListener('play', handleInteraction, true);

// Scanner (Aynı)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCAN_PAGE") {
        const results = scanPageForAudio();
        chrome.runtime.sendMessage({ action: "ADD_SCANNED_LINKS", payload: results }, (res) => {
            sendResponse({count: res ? res.addedCount : 0});
        });
        return true;
    }
});
function scanPageForAudio() {
    const foundItems = [];
    const urlsSeen = new Set();
    document.querySelectorAll('a[href]').forEach(link => {
        if (link.href.match(/\.(mp3|m4a|wav|aac|mp4)(\?|$)/i)) {
            if (!urlsSeen.has(link.href)) {
                foundItems.push({ url: link.href, title: link.innerText.trim() || "Media_File" });
                urlsSeen.add(link.href);
            }
        }
    });
    return foundItems;
}