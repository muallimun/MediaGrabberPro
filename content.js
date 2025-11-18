function findBestTitle(element) {
    let current = element;
    const blackList = ["play", "pause", "stop", "indir", "download", "oynat", "kapat", "daha", "yükle", "listen", "click", "button", "menu", "list"];

    // 1. Diyanet Radyo Özel Kart Yapısı (broadcastFlowCard)
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

    // 2. Genel Durum
    current = element;
    for (let i = 0; i < 6; i++) {
        if (!current || current.tagName === 'BODY') break;
        
        const label = current.getAttribute('aria-label') || current.title;
        if (label && label.length > 3 && !blackList.some(b => label.toLowerCase().includes(b))) {
            return label.trim();
        }
        
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

// Olay Dinleyicileri
const handleInteraction = (e) => {
    const title = findBestTitle(e.target);
    if (title) {
        let safeName = title.replace(/[\/\\?%*:|"<>]/g, '').trim();
        chrome.runtime.sendMessage({ action: "SET_TITLE", payload: safeName });
    }
};

document.addEventListener('mousedown', handleInteraction, true);
document.addEventListener('play', handleInteraction, true);