
import Database from "better-sqlite3";

const db = new Database("finans.db");

// Tabloları temizle ve yeniden oluştur (Emin olmak için)
db.exec(`
  DROP TABLE IF EXISTS islemler;
  DROP TABLE IF EXISTS hedefler;
  DROP TABLE IF EXISTS borclar;
  DROP TABLE IF EXISTS planlar;

  CREATE TABLE islemler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tur TEXT,
    kategori TEXT,
    miktar REAL,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE hedefler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hedef_adi TEXT,
    hedef_tutar REAL,
    biriken_tutar REAL DEFAULT 0
  );
  
  CREATE TABLE borclar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isim TEXT,
    miktar REAL,
    tip TEXT
  );

  CREATE TABLE planlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    baslik TEXT,
    icerik TEXT,
    hedef_tutar REAL,
    hedef_tarih TEXT,
    ikon TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertTx = db.prepare("INSERT INTO islemler (tur, kategori, miktar, tarih) VALUES (?, ?, ?, ?)");

// --- GELİRLER (Geçmiş 2 Yıl) ---
const years = [2024, 2025, 2026];
const categories = {
  gelir: ['Maaş', 'Yatırım', 'Ek İş', 'Hediye'],
  gider: ['Kira', 'Market', 'Ulaşım', 'Eğlence', 'Faturalar', 'Dışarıda Yemek', 'Abonelikler', 'Sağlık', 'Eğitim']
};

years.forEach(year => {
  const maxMonth = year === 2026 ? 5 : 12; // 2026'da sadece Mayıs'a kadar
  for (let month = 1; month <= maxMonth; month++) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    
    // Her ay maaş
    insertTx.run('gelir', 'Maaş', 40000 + (Math.random() * 5000), `${year}-${monthStr}-01 09:00:00`);
    
    // Arada bir ek iş
    if (Math.random() > 0.5) {
      insertTx.run('gelir', 'Ek İş', 2000 + (Math.random() * 3000), `${year}-${monthStr}-15 14:00:00`);
    }

    // Giderler (Rastgele dağılım)
    categories.gider.forEach(cat => {
      let amount = 0;
      if (cat === 'Kira') amount = 10000 + (year === 2025 ? 2000 : year === 2026 ? 4000 : 0);
      else if (cat === 'Market') amount = 3000 + (Math.random() * 2000);
      else if (cat === 'Faturalar') amount = 1500 + (Math.random() * 1000);
      else amount = 100 + (Math.random() * 2000);

      const day = Math.floor(Math.random() * 25) + 2;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      insertTx.run('gider', cat, amount, `${year}-${monthStr}-${dayStr} 12:00:00`);
    });
  }
});

// --- HEDEFLER & PLANLAR ---
db.prepare("INSERT INTO hedefler (hedef_adi, hedef_tutar, biriken_tutar) VALUES (?, ?, ?)").run('Ev Peşinatı', 500000, 120000);
db.prepare("INSERT INTO planlar (baslik, icerik, hedef_tutar, hedef_tarih, ikon) VALUES (?, ?, ?, ?, ?)").run(
  'Yaz Tatili 2026', 
  '## 🏖️ Plan Özeti\n\nGüzel bir tatil için birikim planı.\n\n### Güncel Durum\n- Birikim Kapasitesi: Yüksek\n\n### Öneriler\n- Erken rezervasyon yap.', 
  30000, 
  '2026-06-15', 
  'Plane'
);
db.prepare("INSERT INTO planlar (baslik, icerik, hedef_tutar, hedef_tarih, ikon) VALUES (?, ?, ?, ?, ?)").run(
  'Yeni Araba', 
  '## 🚗 Araba Birikimi\n\nYeni bir araç için strateji.\n\n### Güncel Durum\n- Mevcut birikim hızı orta.\n\n### Öneriler\n- Ek gelir kanalları oluştur.', 
  800000, 
  '2027-12-30', 
  'Car'
);

// --- BORÇLAR ---
db.prepare("INSERT INTO borclar (isim, miktar, tip) VALUES (?, ?, ?)").run('Ahmet (Borç)', 2000, 'borç');
db.prepare("INSERT INTO borclar (isim, miktar, tip) VALUES (?, ?, ?)").run('Mehmet (Alacak)', 1500, 'alacak');

console.log("Örnek finans veri seti başarıyla oluşturuldu.");
db.close();
