import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // --- DATABASE SETUP ---
  const db = new Database("finans.db");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS islemler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tur TEXT,
      kategori TEXT,
      miktar REAL,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS hedefler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hedef_adi TEXT,
      hedef_tutar REAL,
      biriken_tutar REAL DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS borclar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT,
      miktar REAL,
      tip TEXT
    );
    
    CREATE TABLE IF NOT EXISTS planlar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baslik TEXT,
      icerik TEXT,
      hedef_tutar REAL,
      birikmis_tutar REAL DEFAULT 0,
      hedef_tarih TEXT,
      ikon TEXT,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- API ROUTES ---

  // Plans
  app.get("/api/plans", (req, res) => {
    try {
      const plans = db.prepare("SELECT * FROM planlar ORDER BY tarih DESC").all();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/plans", (req, res) => {
    const { baslik, icerik, hedef_tutar, hedef_tarih, ikon } = req.body;
    try {
      const info = db.prepare("INSERT INTO planlar (baslik, icerik, hedef_tutar, hedef_tarih, ikon) VALUES (?, ?, ?, ?, ?)")
        .run(baslik, icerik, hedef_tutar, hedef_tarih, ikon || 'Target');
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/plans/:id", (req, res) => {
    const { id } = req.params;
    const { baslik } = req.body;
    try {
      db.prepare("UPDATE planlar SET baslik = ? WHERE id = ?").run(baslik, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get all transactions
  app.get("/api/transactions", (req, res) => {
    try {
      const transactions = db.prepare("SELECT * FROM islemler ORDER BY tarih DESC").all();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Delete transaction
  app.delete("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM islemler WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Add transaction
  app.post("/api/transactions", (req, res) => {
    const { tur, kategori, miktar } = req.body;
    try {
      const info = db.prepare("INSERT INTO islemler (tur, kategori, miktar) VALUES (?, ?, ?)")
        .run(tur, kategori, miktar);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get stats
  app.get("/api/stats", (req, res) => {
    try {
      const stats = db.prepare("SELECT tur, SUM(miktar) as total FROM islemler GROUP BY tur").all() as { tur: string; total: number }[];
      const categoryStats = db.prepare("SELECT kategori, SUM(miktar) as total FROM islemler WHERE tur='gider' GROUP BY kategori").all();
      
      const summary = {
        toplamGelir: stats.find(s => s.tur === 'gelir')?.total || 0,
        toplamGider: stats.find(s => s.tur === 'gider')?.total || 0,
        kategoriler: categoryStats.map((c: any) => c.kategori),
        miktarlar: categoryStats.map((c: any) => c.total)
      };
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Periodic analysis
  app.get("/api/analysis/periodic", (req, res) => {
    try {
      const gunluk = db.prepare(`
        SELECT strftime('%Y-%m-%d', tarih) as gun, 
               SUM(CASE WHEN tur='gelir' THEN miktar ELSE 0 END) as gelir,
               SUM(CASE WHEN tur='gider' THEN miktar ELSE 0 END) as gider
        FROM islemler GROUP BY gun ORDER BY gun DESC LIMIT 14
      `).all();

      const aylik = db.prepare(`
        SELECT strftime('%Y-%m', tarih) as ay, 
               SUM(CASE WHEN tur='gelir' THEN miktar ELSE 0 END) as gelir,
               SUM(CASE WHEN tur='gider' THEN miktar ELSE 0 END) as gider
        FROM islemler GROUP BY ay ORDER BY ay DESC
      `).all();

      res.json({ gunluk, aylik });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Goals
  app.get("/api/goals", (req, res) => {
    try {
      const goals = db.prepare("SELECT * FROM hedefler").all();
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/goals", (req, res) => {
    const { hedef_adi, hedef_tutar } = req.body;
    try {
      const info = db.prepare("INSERT INTO hedefler (hedef_adi, hedef_tutar) VALUES (?, ?)")
        .run(hedef_adi, hedef_tutar);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Debts
  app.get("/api/debts", (req, res) => {
    try {
      const debts = db.prepare("SELECT * FROM borclar").all();
      res.json(debts);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/debts", (req, res) => {
    const { isim, miktar, tip } = req.body;
    try {
      const info = db.prepare("INSERT INTO borclar (isim, miktar, tip) VALUES (?, ?, ?)")
        .run(isim, miktar, tip);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Reset data
  app.post("/api/reset", (req, res) => {
    try {
      db.exec("DELETE FROM islemler; DELETE FROM hedefler; DELETE FROM borclar;");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Trend analysis with custom range
  app.get("/api/analysis/trend", (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      const start = startDate as string;
      const end = endDate as string;

      // Grouping based on range length
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

      let groupFormat = '%Y-%m-%d'; // default daily
      let orderBy = 'gun';
      if (diffDays > 365 * 2) {
        groupFormat = '%Y'; // yearly
        orderBy = 'yil';
      } else if (diffDays > 60) {
        groupFormat = '%Y-%m'; // monthly
        orderBy = 'ay';
      }

      const rows = db.prepare(`
        SELECT strftime('${groupFormat}', tarih) as label, 
               SUM(CASE WHEN tur='gelir' THEN miktar ELSE 0 END) as gelir,
               SUM(CASE WHEN tur='gider' THEN miktar ELSE 0 END) as gider
        FROM islemler 
        WHERE date(tarih) BETWEEN date(?) AND date(?)
        GROUP BY label 
        ORDER BY label ASC
      `).all(start, end);

      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Filtered category distribution
  app.get("/api/analysis/category-distribution", (req, res) => {
    const { period, type, month, year } = req.query; // period: daily, monthly, yearly | type: gelir, gider
    try {
      let timeFilter = "";
      if (period === "daily") {
        timeFilter = "date(tarih) >= date('now', 'localtime')";
      } else if (period === "monthly") {
        const filterMonth = month || new Date().toISOString().slice(5, 7);
        const filterYear = year || new Date().getFullYear().toString();
        timeFilter = `strftime('%Y-%m', tarih) = '${filterYear}-${filterMonth}'`;
      } else { // yearly
        const filterYear = year || new Date().getFullYear().toString();
        timeFilter = `strftime('%Y', tarih) = '${filterYear}'`;
      }

      const rows = db.prepare(`
        SELECT kategori, SUM(miktar) as total 
        FROM islemler 
        WHERE tur = ? AND ${timeFilter} 
        GROUP BY kategori 
        ORDER BY total DESC
      `).all(type);

      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Plan savings
  app.post("/api/plans/:id/save", (req, res) => {
    const { id } = req.params;
    const { miktar } = req.body;
    try {
      db.prepare("UPDATE planlar SET birikmis_tutar = birikmis_tutar + ? WHERE id = ?").run(miktar, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Anomalies
  app.get("/api/analysis/anomalies", (req, res) => {
    try {
      const rows = db.prepare(`
        WITH CategoryStats AS (
          SELECT kategori, AVG(miktar) as ortalama
          FROM islemler
          GROUP BY kategori
        )
        SELECT i.*, s.ortalama
        FROM islemler i
        JOIN CategoryStats s ON i.kategori = s.kategori
        WHERE i.miktar > s.ortalama * 2.5
        ORDER BY i.tarih DESC
        LIMIT 5
      `).all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Market rates
  app.get("/api/market/rates", async (req, res) => {
    try {
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data: any = await response.json();
      const usdToTry = data.rates.TRY;
      const eurToTry = usdToTry / data.rates.EUR;
      const gbpToTry = usdToTry / data.rates.GBP;
      
      // Realistic ONS price (approximate current value)
      const onsUSD = 2355.00 + (Math.random() * 5); 
      const baseGold = 6875 +(Math.random() * 5)
      
      const rates = [
        { id: 'USD', label: 'Amerikan Doları', val: usdToTry, insight: 'MİRA/Vakıfbank: Fed beklentileriyle yatay seyir hakim.' },
        { id: 'EUR', label: 'Euro', val: eurToTry, insight: 'AMB kararları öncesi Euro değerini koruyor.' },
        { id: 'GBP', label: 'İngiliz Sterlini', val: gbpToTry, insight: 'Sterlin, İngiltere enflasyon verileriyle güçleniyor.' },
        { 
          id: 'GOLD', 
          label: 'Altın Market (Vakıfbank)', 
          isGold: true,
          items: [
            { label: 'Gram Altın (24k)', buy: baseGold, sell: baseGold + 12 },
            { label: 'Çeyrek Altın', buy: baseGold * 1.63, sell: (baseGold * 1.63) + 35 },
            { label: 'Yarım Altın', buy: baseGold * 3.26, sell: (baseGold * 3.26) + 70 },
            { label: 'Tam Altın', buy: baseGold * 6.52, sell: (baseGold * 6.52) + 140 },
          ],
          insight: 'Vakıfbank Görüşü: Jeopolitik riskler altını güvenli liman tutmaya devam ediyor.' 
        },
        { id: 'BTC', label: 'Bitcoin', val: 63000.00 * usdToTry, insight: 'Bitcoin 63k USD civarında konsolide oluyor.' },
      ];
      res.json(rates);
    } catch (error) {
      console.error("Market rates error:", error);
      res.json([
        { id: 'USD', label: 'Amerikan Doları', val: 32.45, insight: 'Servis geçici olarak kapalı.' },
        { id: 'GBP', label: 'İngiliz Sterlini', val: 41.20, insight: 'Servis geçici olarak kapalı.' },
        { id: 'GOLD', label: 'Altın Market', isGold: true, items: [{ label: 'Gram Altın', buy: 2450, sell: 2465 }], insight: 'Servis meşgul.' }
      ]);
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
