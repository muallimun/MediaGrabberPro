// offscreen.js - Universal Media Grabber Pro v30.9.9 (Chrome)
// Bu dosya arka planda çalışır ve büyük ZIP dosyalarını oluşturup indirir.

function downloadBlobInOffscreen(blob, filename, saveAs) {
    return new Promise((resolve, reject) => {
        try {
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({ url, filename, saveAs: !!saveAs }, (id) => {
                setTimeout(() => URL.revokeObjectURL(url), 300000); // 5 dakika sonra belleği temizle
                if (chrome.runtime.lastError || !id) {
                    reject(new Error(chrome.runtime.lastError?.message || 'İndirme başlatılamadı'));
                } else {
                    resolve(id);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function buildScormZip(baseDir, originalUrl, filename, saveAs) {
    try {
        // 1. DURUM: URL doğrudan bir .zip dosyası ise fetch ile indir
        if (originalUrl && originalUrl.toLowerCase().includes('.zip')) {
            const r = await fetch(originalUrl, { credentials: 'include' }); 
            if (!r.ok) throw new Error('Zip dosyası sunucudan indirilemedi (HTTP ' + r.status + ')');
            const blob = await r.blob();
            return downloadBlobInOffscreen(blob, filename, saveAs);
        }

        // 2. DURUM: URL bir klasör ise imsmanifest.xml üzerinden birleştir
        const manifestUrl = `${baseDir}/imsmanifest.xml`;
        const manRes = await fetch(manifestUrl, { credentials: 'include' });
        if (!manRes.ok) throw new Error('imsmanifest.xml bulunamadı');
        const manifestText = await manRes.text();

        const files = [];
        for (const m of manifestText.matchAll(/<file\s+[^>]*href=["']([^"']+)["']/gi)) {
            const h = m[1].replace(/\\/g, '/').replace(/^\/+/, '');
            if (!files.includes(h)) files.push(h);
        }
        if (files.length === 0) throw new Error('Manifest boş');

        const zip = new JSZip();
        zip.file('imsmanifest.xml', manifestText);

        await Promise.all(files.map(async (fp) => {
            const safe = fp.split('/').map(encodeURIComponent).join('/');
            try {
                const r = await fetch(`${baseDir}/${safe}`, { credentials: 'include' });
                if (r.ok) zip.file(fp, await r.blob());
            } catch (e) {}
        }));

        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return downloadBlobInOffscreen(content, filename, saveAs);
    } catch (error) {
        // 3. DURUM: Her şey başarısız olursa son çare doğrudan orijinal URL'yi indirmeyi dene
        try {
            const r = await fetch(originalUrl, { credentials: 'include' });
            if (r.ok) {
                const blob = await r.blob();
                return downloadBlobInOffscreen(blob, filename, saveAs);
            }
        } catch(e) {}
        throw new Error('SCORM indirilemedi: ' + error.message);
    }
}

async function buildBulkZip(items, filename) {
    const zip = new JSZip();
    let count = 0;
    for (const item of items) {
        try {
            const r = await fetch(item.url, { credentials: 'include' });
            if (r.ok) {
                zip.file(item.filename, await r.blob());
                count++;
            }
        } catch (e) {}
    }
    if (count === 0) throw new Error('İndirilebilir dosya bulunamadı');
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return downloadBlobInOffscreen(content, filename, true);
}

// Background'dan gelen mesajları dinle
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'BUILD_SCORM_ZIP') {
        buildScormZip(req.baseDir, req.originalUrl, req.filename, req.saveAs)
            .then(id => sendResponse({ ok: true, downloadId: id }))
            .catch(e => sendResponse({ ok: false, err: e.message }));
        return true;
    }
    if (req.action === 'BUILD_BULK_ZIP') {
        buildBulkZip(req.items, req.filename)
            .then(id => sendResponse({ ok: true, downloadId: id }))
            .catch(e => sendResponse({ ok: false, err: e.message }));
        return true;
    }
    if (req.action === 'PING') {
        sendResponse({ ok: true });
        return true;
    }
});