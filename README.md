##  MIRA: Mali İzleme ve Rehberlik Ağı

MIRA, geleneksel gider takip uygulamalarının ötesine geçerek, kullanıcıların finansal verilerini anlamlandıran, geleceğe yönelik stratejiler geliştiren ve **Gemini AI** ile kişiselleştirilmiş danışmanlık sunan bir ekosistemdir.

###  Başlıca Özellikler

-   **Akıllı İşlem Takibi:** SQLite tabanlı hızlı ve güvenilir veritabanı yapısı ile tüm gelir ve giderlerin kategorize edilerek anlık kaydedilmesi.
    
-   **Gemini AI Analiz Motoru:** Finansal verilerin yapay zeka tarafından taranarak harcama alışkanlıklarının analiz edilmesi ve iyileştirme önerileri sunulması.
    
-   **İnteraktif Veri Görselleştirme:** `recharts` kütüphanesi kullanılarak hazırlanan, geçmiş yılları kapsayan dinamik trend grafikleri ve kategori dağılım haritaları.
    
-   **Hedef ve Borç Yönetimi:** Belirlenen finansal hedeflere (ev, araba, tatil vb.) ne kadar yaklaşıldığının takibi ve borç/alacak dengesinin yönetilmesi.
    
-   **Anomali Tespiti:** Standart dışı harcamaları (ortalamanın 2.5 katı üzerindeki giderler) otomatik olarak tespit eden akıllı uyarı sistemi.
    
-   **Gerçek Zamanlı Piyasa Entegrasyonu:** Güncel döviz kurları (Dolar ,Euro ve Altın) fiyatları ile varlık değerlemesi yapabilme özelliği.
    

----------

###  Sunduğu Ayrıcalıklar (Neden MIRA?)

1.  **Kişiselleştirilmiş Stratejiler:** AI Studio entegrasyonu sayesinde her kullanıcıya özel, "Yaz Tatili Planı" veya "Araba Birikimi" gibi somut ve uygulanabilir finansal yol haritaları hazırlar.
    
2.  **Hız ve Hafiflik:** `better-sqlite3` ve `Vite` kullanımı sayesinde düşük kaynak tüketimi ile çok hızlı bir kullanıcı deneyimi sunar.
    
3.  **Güvenli ve Yerel Depolama:** Verilerin kullanıcı kontrolünde, optimize edilmiş bir yerel veritabanında saklanması.
    
4.  **Karar Destek Sistemi:** Piyasa verilerini kullanıcı harcamalarıyla birleştirerek, "Altın mı almalıyım yoksa borç mu kapatmalıyım?" gibi sorulara karşılık verir.
    

----------

###  Teknik Yığın (Tech Stack)

-   **Frontend:** React, TypeScript, Tailwind CSS, Recharts, Lucide Icons.
    
-   **Backend:** Node.js, Express.js, Tsx.
    
-   **Veritabanı:** Better-SQLite3.
    
-   **AI:** Google Gemini AI (AI Studio).
    
-   **Deployment:** Railway 
    
