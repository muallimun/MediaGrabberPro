// content.js - V29.2.0 (Robust Title Detection - FULL)

function isContextValid() { return !!chrome.runtime && !!chrome.runtime.id; }

function findBestTitle(element) {
    if (!element) return "";
    const blackList = ["play", "pause", "indir", "download", "oynat", "menu", "kapat"];

    if (element.tagName === 'VIDEO' || element.closest('video') || element.closest('.player')) {
        const container = element.closest('article, .video-container, .player-wrapper, [class*="video"], body');
        if (container) {
            const titleEl = container.querySelector('h1, h2, .video-title, [class*="title"]');
            if (titleEl && titleEl.innerText.length > 3) return titleEl.innerText.trim();
        }
    }

    const card = element.closest('div[class*="broadcastFlowCard"], div[class*="card"], div[class*="item"], li, tr');
    if (card) {
        const h = card.querySelector('h3, h4, h5, strong, .title, [class*="title"]');
        if (h && h.innerText.trim().length > 3) return h.innerText.trim();
    }

    let cur = element;
    for (let i = 0; i < 6; i++) {
        if (!cur || cur.tagName === 'BODY') break;
        const text = cur.innerText || cur.title || cur.getAttribute('aria-label');
        if (text && text.trim().length > 3 && text.length < 120 && !blackList.some(b => text.toLowerCase().includes(b))) return text.trim();
        cur = cur.parentElement;
    }
    return "";
}

const handle = (e) => {
    if (!isContextValid()) return;
    const title = findBestTitle(e.target);
    if (title) {
        let safeName = title.replace(/[\/\\?%*:|"<>]/g, '').trim();
        chrome.runtime.sendMessage({ action: "SET_TITLE", payload: safeName }).catch(() => {});
    }
};

document.addEventListener('mousedown', handle, true);
document.addEventListener('play', handle, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isContextValid()) return;
    if (request.action === "SCAN_PAGE") {
        const found = [];
        document.querySelectorAll('a[href]').forEach(a => {
            if (a.href.match(/\.(mp3|mp4|wav|m4a|aac)(\?|$)/i)) {
                found.push({ url: a.href, title: a.innerText.trim() || "Media_File" });
            }
        });
        chrome.runtime.sendMessage({ action: "ADD_SCANNED_LINKS", payload: found });
    }
});