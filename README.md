# 🎵 Universal Media Grabber Pro

**Web sitelerindeki medya akışlarını (MP3, M4A, WAV, M3U8) otomatik yakalayan, akıllı isimlendiren ve toplu indiren profesyonel Chrome eklentisi.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-orange.svg)

## 🌟 Özellikler

Bu eklenti, sıradan indiricilerin yapamadığını yapar:

* **🕵️‍♂️ Akıllı Yakalama (Smart Sniffer):** Bir medyayı oynattığınız anda ağ trafiğini dinler ve linki yakalar.
* **🏷️ Akıllı İsimlendirme:** "Dosya.mp3" gibi anlamsız isimler yerine, tıkladığınız başlığı veya sayfa içeriğini analiz ederek dosyayı doğru isimlendirir (Örn: `001_Fatiha_Suresi.mp3`).
* **📦 Toplu İndirme:** Listelenen 100'lerce dosyayı tek tıkla sırayla indirir.
* **📁 Klasörleme:** İndirilen dosyaları `İndirilenler/Radyo_Arsiv` (veya sizin belirlediğiniz) klasöründe toplar.
* **🎧 Dahili Oynatıcı:** Dosyayı indirmeden önce eklenti penceresinde dinlemenizi sağlar.
* **🌍 Çoklu Dil Desteği:** Türkçe ve İngilizce dillerini otomatik tanır.
* **🛡️ Duplicate Koruması:** Aynı dosyayı listeye tekrar tekrar eklemez.

## 🚀 Kurulum (Geliştirici Modu)

Bu eklenti henüz Chrome Web Mağazası'nda olmadığı için manuel yüklenir:

1.  Bu depoyu (repository) **ZIP olarak indirin** ve bir klasöre çıkarın.
2.  Google Chrome tarayıcısını açın ve adres çubuğuna şunu yazın: `chrome://extensions`
3.  Sağ üst köşedeki **"Geliştirici Modu" (Developer Mode)** anahtarını açın.
4.  Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load Unpacked)** butonuna tıklayın.
5.  İndirdiğiniz klasörün içindeki `grabber_extension` klasörünü seçin.
6.  Tebrikler! Eklenti yüklendi.

## 📖 Nasıl Kullanılır?

1.  Müzik, Podcast veya Radyo içeren bir web sitesine gidin (Örn: Diyanet Radyo, SoundCloud, Archive.org).
2.  İstediğiniz parçayı **oynatın** veya başlığına tıklayın.
3.  Eklenti simgesindeki sayının arttığını göreceksiniz.
4.  Eklentiyi açın:
    * **Dinlemek için:** ▶ butonuna basın.
    * **İndirmek için:** ⬇ butonuna basın.
    * **İsmi Değiştirmek için:** Kalem ikonuna basın.
    * **Hepsini İndirmek için:** En alttaki "Tümünü İndir" butonunu kullanın.

## ⚠️ Önemli Ayar (Toplu İndirme İçin)

Eğer çok sayıda dosyayı "Tümünü İndir" butonuyla indirecekseniz, Chrome'un her dosya için *"Nereye kaydedilsin?"* diye sormasını engellemelisiniz.

1.  Chrome **Ayarlar** > **İndirmeler** menüsüne gidin.
2.  **"İndirmeden önce her dosyanın nereye kaydedileceğini sor"** seçeneğini **KAPATIN**.

## 🛠️ Kullanılan Teknolojiler

* **JavaScript (ES6+)** - Core Logic
* **Chrome Extensions API (Manifest V3)** - Background & Content Scripts
* **JSZip** - Dosya sıkıştırma işlemleri için
* **HTML5 & CSS3** - Modern ve Responsive Arayüz

## 🤝 Katkıda Bulunma

Projeyi geliştirmek isterseniz Pull Request göndermekten çekinmeyin! Hataları "Issues" bölümünden bildirebilirsiniz.

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır. Açık kaynaklıdır ve özgürce dağıtılabilir.

---
Developed with ❤️ by **[Muallimun.Net](https://www.muallimun.com/)**