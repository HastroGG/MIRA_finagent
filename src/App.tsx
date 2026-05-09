import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  MessageSquare,
  MessageSquareShare,
  Zap,
  Mic,
  Download,
  X,
  Send,
  Calendar,
  Activity,
  Plus,
  Target,
  ArrowRight,
  User,
  LogIn,
  UserPlus,
  ChevronDown,
  FolderX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plane,
  Car,
  Home,
  ShoppingBag,
  Landmark,
  Edit2,
  Check,
  CircleDollarSign,
  Coins,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { getGeminiResponse } from "./lib/gemini";

import {
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "./lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

// --- TYPES ---
interface Transaction {
  id: string | number;
  tur: "gelir" | "gider";
  kategori: string;
  miktar: number;
  tarih: string;
  aciklama: string;
}

interface Stats {
  toplamGelir: number;
  toplamGider: number;
  kategoriler: string[];
  miktarlar: number[];
}

interface Analysis {
  gunluk: { gun: string; gelir: number; gider: number }[];
  aylik: { ay: string; gelir: number; gider: number }[];
}

interface Plan {
  id: string | number;
  baslik: string;
  icerik: string;
  hedef_tutar: number;
  birikmis_tutar: number;
  hedef_tarih: string;
  ikon: string;
  tarih: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState<"slate" | "matrix" | "bloomberg">("slate");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    toplamGelir: 0,
    toplamGider: 0,
    kategoriler: [],
    miktarlar: [],
  });
  const [analysis, setAnalysis] = useState<Analysis>({ gunluk: [], aylik: [] });
  const [trendData, setTrendData] = useState<
    { label: string; gelir: number; gider: number }[]
  >([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [marketRates, setMarketRates] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | number | null>(null);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [trendRange, setTrendRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [categoryFilter, setCategoryFilter] = useState({
    period: "monthly",
    type: "gider",
    month: (new Date().getMonth() + 1).toString().padStart(2, "0"),
    year: new Date().getFullYear().toString(),
  });
  const [categoryDistribution, setCategoryDistribution] = useState<
    { kategori: string; total: number }[]
  >([]);

  // MİRA Score Calculation
  const calculateMiraScore = () => {
    if (transactions.length === 0) return 0;
    
    const totalIncome = transactions
      .filter((t) => t.tur === "gelir")
      .reduce((sum, t) => sum + t.miktar, 0);
    const totalExpense = transactions
      .filter((t) => t.tur === "gider")
      .reduce((sum, t) => sum + t.miktar, 0);
      
    if (totalIncome === 0) return 0;

    // 1. Savings Rate (40 points)
    const savingsRate = ((totalIncome - totalExpense) / totalIncome) * 100;
    const savingsScore = Math.min(Math.max(savingsRate, 0), 100) * 0.4;
    
    // 2. Transaction Consistency (30 points) - at least 5 transactions
    const consistencyScore = Math.min(transactions.length / 5, 1) * 30;
    
    // 3. Balance Health (30 points) - not being in debt
    const balanceScore = totalIncome >= totalExpense ? 30 : (totalIncome / totalExpense) * 30;

    return Math.round(savingsScore + consistencyScore + balanceScore);
  };

  const miraScore = calculateMiraScore();

  const exportToCSV = () => {
    const headers = ["Tarih", "Açıklama", "Kategori", "Tür", "Miktar"];
    const rows = transactions.map(t => [
      new Date(t.tarih).toLocaleDateString("tr-TR"),
      t.aciklama,
      t.kategori,
      t.tur,
      t.miktar.toString()
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `MIRA_Rapor_${new Date().toLocaleDateString("tr-TR")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const themeConfig = {
    slate: {
      bg: "bg-[#0f172a]",
      card: "bg-slate-900",
      accent: "text-blue-400",
      border: "border-slate-800",
      text: "text-slate-100",
      sub: "text-slate-400"
    },
    matrix: {
      bg: "bg-black",
      card: "bg-zinc-900/50 border-green-500/30",
      accent: "text-green-500",
      border: "border-green-900",
      text: "text-green-400",
      sub: "text-green-700"
    },
    bloomberg: {
      bg: "bg-[#000033]",
      card: "bg-[#000066]/50 border-amber-500/30",
      accent: "text-amber-500",
      border: "border-amber-900",
      text: "text-white",
      sub: "text-amber-200/60"
    }
  };

  const currentTheme = themeConfig[theme];
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Transaction | null;
    direction: "asc" | "desc" | null;
  }>({
    key: null,
    direction: null,
  });
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [
      {
        role: "model",
        content:
          "Merhaba! Ben MİRA. Finansal asistanın olarak sana nasıl yardımcı olabilirim? Gelir/gider kaydedebilir veya durumunu sorabilirsin.",
      },
    ],
  );
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [shortcuts, setShortcuts] = useState([
    "Güncel maddi durumumu göster",
    "Önümüzdeki ay için birikim planı hazırla",
    "Anormal giderlerimi listele",
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMarketRates();
  }, [trendRange]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // Clear data when logged out
        setTransactions([]);
        setStats({
          toplamGelir: 0,
          toplamGider: 0,
          kategoriler: [],
          miktarlar: [],
        });
        setAnalysis({ gunluk: [], aylik: [] });
        setPlans([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = setupFirestoreListeners(user.uid);

      // Seed data for demo user
      if (user.email === "harunergene1@gmail.com") {
        const seedData = async () => {
          const txsCheck = await getDocs(query(collection(db, "transactions"), where("userId", "==", user.uid)));
          if (txsCheck.empty) {
            const sampleTransactions = [
              { type: "gelir", category: "Maaş", amount: 45000, timestamp: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(), description: "Aylık Maaş Ödemesi" },
              { type: "gider", category: "Kira", amount: 15000, timestamp: new Date(new Date().setDate(new Date().getDate() - 9)).toISOString(), description: "Ev Kirası" },
              { type: "gider", category: "Market", amount: 1250, timestamp: new Date(new Date().setDate(new Date().getDate() - 8)).toISOString(), description: "Haftalık Market Alışverişi" },
              { type: "gider", category: "Ulaşım", amount: 800, timestamp: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(), description: "Akbil Yüklemesi" },
              { type: "gider", category: "Yemek", amount: 450, timestamp: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString(), description: "Dışarıda Yemek" },
              { type: "gider", category: "Eğlence", amount: 1200, timestamp: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(), description: "Sinema ve Konser" },
              { type: "gider", category: "Sağlık", amount: 600, timestamp: new Date(new Date().setDate(new Date().getDate() - 4)).toISOString(), description: "Eczane Harcaması" },
              { type: "gider", category: "Eğitim", amount: 3000, timestamp: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(), description: "Online Kurs Ücreti" },
              { type: "gider", category: "Diğer", amount: 200, timestamp: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), description: "Bağış" },
              { type: "gelir", category: "Ek Gelir", amount: 5000, timestamp: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), description: "Freelance İş Ödemesi" },
            ];
            for (const tx of sampleTransactions) {
               await addDoc(collection(db, "transactions"), { ...tx, userId: user.uid });
            }
          }

          const plansCheck = await getDocs(query(collection(db, "plans"), where("userId", "==", user.uid)));
          if (plansCheck.empty) {
            const samplePlans = [
              { title: "Yeni Araba", targetAmount: 500000, currentAmount: 125000, endDate: "2027-12-31", icon: "Car" },
              { title: "Avrupa Tatili", targetAmount: 80000, currentAmount: 45000, endDate: "2026-08-15", icon: "Plane" },
              { title: "Ev Depozitosu", targetAmount: 150000, currentAmount: 60000, endDate: "2026-06-01", icon: "Home" },
            ];
            for (const p of samplePlans) {
               await addDoc(collection(db, "plans"), { ...p, userId: user.uid });
            }
          }
        };
        seedData();
      }

      return () => unsub();
    }
  }, [user, trendRange, categoryFilter]);

  const setupFirestoreListeners = (uid: string) => {
    // Transactions listener
    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", uid),
      orderBy("timestamp", "desc"),
    );
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const txs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];
      const mappedTxs = txs.map((t) => ({
        id: t.id,
        tur: t.type,
        kategori: t.category,
        miktar: t.amount,
        tarih: t.timestamp,
        aciklama: t.description || t.kategori || "",
      }));
      setTransactions(mappedTxs);

      // Update basic stats
      const totalGelir = txs
        .filter((t) => t.type === "gelir")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalGider = txs
        .filter((t) => t.type === "gider")
        .reduce((sum, t) => sum + t.amount, 0);

      const categories: Record<string, number> = {};
      txs
        .filter((t) => t.type === "gider")
        .forEach((t) => {
          categories[t.category] = (categories[t.category] || 0) + t.amount;
        });

      setStats({
        toplamGelir: totalGelir,
        toplamGider: totalGider,
        kategoriler: Object.keys(categories),
        miktarlar: Object.values(categories),
      });

      // Update Trend Data
      const trendMap: Record<string, { gelir: number; gider: number }> = {};
      // Initialize trend range days
      const currentAt = new Date(trendRange.startDate);
      const endAt = new Date(trendRange.endDate);
      while (currentAt <= endAt) {
        const key = currentAt.toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short",
        });
        trendMap[key] = { gelir: 0, gider: 0 };
        currentAt.setDate(currentAt.getDate() + 1);
      }

      txs.forEach((t) => {
        const d = new Date(t.timestamp);
        const key = d.toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short",
        });
        if (trendMap[key]) {
          if (t.type === "gelir") trendMap[key].gelir += t.amount;
          else trendMap[key].gider += t.amount;
        }
      });

      setTrendData(
        Object.entries(trendMap).map(([label, vals]) => ({ label, ...vals })),
      );

      // Update Category Distribution (reactive filter)
      const filteredForDist = mappedTxs.filter((t) => {
        const d = new Date(t.tarih);
        const m = (d.getMonth() + 1).toString().padStart(2, "0");
        const y = d.getFullYear().toString();
        return (
          t.tur === categoryFilter.type &&
          m === categoryFilter.month &&
          y === categoryFilter.year
        );
      });

      const distMap: Record<string, number> = {};
      filteredForDist.forEach((t) => {
        distMap[t.kategori] = (distMap[t.kategori] || 0) + t.miktar;
      });
      setCategoryDistribution(
        Object.entries(distMap).map(([kategori, total]) => ({
          kategori,
          total,
        })),
      );
    });

    // Plans listener
    const plansQuery = query(
      collection(db, "plans"),
      where("userId", "==", uid),
    );
    const unsubPlans = onSnapshot(plansQuery, (snapshot) => {
      setPlans(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          baslik: (doc.data() as any).title,
          hedef_tutar: (doc.data() as any).targetAmount,
          hedef_tarih: (doc.data() as any).endDate,
        })) as any,
      );
    });

    return () => {
      unsubTx();
      unsubPlans();
    };
  };

  const fetchMarketRates = async () => {
    try {
      const res = await fetch("/api/market/rates");
      setMarketRates(await res.json());
    } catch (error) {
      console.error("Market rates fetch error:", error);
    }
  };

  const handleDeleteTransaction = async (id: string | number) => {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "transactions", id.toString()));
    } catch (error) {
      console.error("Delete transaction error:", error);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setAuthModal(null);
    } catch (error: any) {
      console.error("Google login error:", error);
    }
  };

  const handleAuth = async () => {
    try {
      if (authModal === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        setAuthModal(null);
        setEmail("");
        setPassword("");
        setUsername("");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthModal(null);
        setEmail("");
        setPassword("");
        setUsername("");
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        alert("Hata: E-posta/Şifre girişi Firebase panelinden etkinleştirilmemiş. Lütfen Google ile giriş yapın veya yöneticiyle iletişime geçin.");
      } else {
        alert("Hata: " + error.message);
      }
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tarayıcınız ses tanımayı desteklemiyor.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };
    recognition.start();
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthMenuOpen(false);
  };

  const handleRenamePlan = async (id: string | number) => {
    if (!newPlanTitle.trim()) return;
    try {
      await updateDoc(doc(db, "plans", id.toString()), { title: newPlanTitle });
      setEditingPlanId(null);
      setNewPlanTitle("");
    } catch (error) {
      console.error("Rename plan error:", error);
    }
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || inputText;
    if (!msgText.trim()) return;

    const userMsg = { role: "user", content: msgText };
    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInputText("");
    setIsLoading(true);

    try {
      const response = await getGeminiResponse([...messages, userMsg]);
      setMessages((prev) => [...prev, { role: "model", content: response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Bir hata oluştu, lütfen tekrar deneyin." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const removeShortcut = (index: number) => {
    setShortcuts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSort = (key: keyof Transaction) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const getSortedTransactions = (data: Transaction[]) => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedTransactions = getSortedTransactions(transactions);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length > 6) strength += 25;
    if (/[A-Z]/.test(pass)) strength += 25;
    if (/[0-9]/.test(pass)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
    return strength;
  };

  const strength = getPasswordStrength(password);
  const strengthColor =
    strength <= 25
      ? "bg-red-500"
      : strength <= 50
        ? "bg-orange-500"
        : strength <= 75
          ? "bg-yellow-500"
          : "bg-green-500";

  const pieData = stats.kategoriler.map((k, i) => ({
    name: k,
    value: stats.miktarlar[i],
  }));

  const filteredPieData = categoryDistribution.map((item) => ({
    name: item.kategori,
    value: item.total,
  }));

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
  };

  const getDaysRemaining = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} font-sans selection:bg-blue-500/30 transition-colors duration-500`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 ${currentTheme.card} backdrop-blur-md border-b ${currentTheme.border} p-4`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
              {/* Theme Switcher Vertical */}
              <div className={`flex flex-col ${currentTheme.card} p-1 rounded-xl border ${currentTheme.border} gap-1 shadow-inner`}>
                {(["slate", "matrix", "bloomberg"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    title={t.toUpperCase()}
                    className={`w-8 h-8 flex items-center justify-center text-[10px] uppercase font-black rounded-lg transition-all ${
                      theme === t ? `${currentTheme.accent} bg-blue-500/10` : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t.charAt(0)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <span className="text-white font-black text-2xl tracking-tighter">M</span>
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter text-blue-500 leading-none">
                    MIRA
                  </h1>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 ml-1">
                  Mali İzleme ve Rehberlik Ağı
                </span>
              </div>

             <div className="hidden md:flex items-center gap-8 text-sm font-bold tracking-tight">
               <div className="flex gap-6">
                 {[
                   { id: "dashboard", label: "TERMİNAL", icon: LayoutDashboard },
                   { id: "reports", label: "İŞLEMLER", icon: BarChart3 },
                   { id: "status", label: "DURUM", icon: Wallet },
                   { id: "piyasa", label: "PİYASA", icon: Coins },
                   { id: "plan", label: "PLANIM", icon: Target },
                 ].map((item) => (
                   <button
                     key={item.id}
                     onClick={() => setActiveTab(item.id)}
                     className={`flex items-center gap-2 pb-1 transition-all ${
                       activeTab === item.id
                         ? `${currentTheme.accent} border-b-2 border-current`
                         : `${currentTheme.sub} hover:text-white`
                     }`}
                   >
                     <item.icon size={16} />
                     {item.label}
                   </button>
                 ))}
               </div>
             </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex flex-col items-end mr-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  NET BAKİYE
                </span>
                <span
                  className={`text-sm font-black ${stats.toplamGelir - stats.toplamGider >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {(stats.toplamGelir - stats.toplamGider).toLocaleString()}{" "}
                  <span className="text-[10px]">TL</span>
                </span>
              </div>
            )}
            <div className="hidden lg:flex items-center gap-3 text-slate-400 font-medium bg-slate-800/10 px-4 py-2 rounded-2xl border border-slate-800/50">
              <Calendar size={14} className="text-blue-400" />
              <span className="text-[10px] uppercase tracking-wider font-black">
                {new Date().toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>

            <div className="relative group">
              <button
                onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 px-3 py-2 rounded-2xl transition-all border border-slate-700/30"
              >
                <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-blue-500 border border-slate-700 font-black text-xs">
                  {user ? (
                    user.email?.charAt(0).toUpperCase()
                  ) : (
                    <User size={16} className="text-slate-500" />
                  )}
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-black text-slate-300">
                    {user ? user.email?.split("@")[0].toUpperCase() : "MİSAFİR"}
                  </span>
                  <ChevronDown
                    size={10}
                    className={`text-slate-500 transition-transform ${isAuthMenuOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isAuthMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsAuthMenuOpen(false)}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-20"
                    >
                      <div className="p-2 space-y-1">
                        {user ? (
                          <>
                            <div className="px-4 py-3 border-b border-slate-800 mb-1">
                              <p className="text-[10px] text-slate-500 font-bold uppercase">
                                Hesap
                              </p>
                              <p className="text-xs font-black text-blue-400 truncate">
                                {user.email}
                              </p>
                            </div>
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-red-400 hover:bg-red-500/10 rounded-xl transition-colors uppercase"
                            >
                              <LogIn size={14} />
                              Çıkış Yap
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setAuthModal("login");
                                setIsAuthMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-slate-300 hover:bg-slate-800 rounded-xl transition-colors uppercase"
                            >
                              <LogIn size={14} className="text-blue-400" />
                              Giriş Yap
                            </button>
                            <button
                              onClick={() => {
                                setAuthModal("register");
                                setIsAuthMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-slate-300 hover:bg-slate-800 rounded-xl transition-colors uppercase"
                            >
                              <UserPlus size={14} className="text-blue-400" />
                              Kayıt Ol
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      {/* Auth Modals */}
      <AnimatePresence>
        {authModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
            >
              <button
                onClick={() => setAuthModal(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-black mb-6 text-blue-500 uppercase tracking-tighter">
                {authModal === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </h2>

              <div className="space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 rounded-2xl transition-all active:scale-95 shadow-lg uppercase tracking-widest text-xs"
                >
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-4 h-4"
                  />
                  Google ile Devam Et
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-900 px-2">
                    Veya
                  </div>
                </div>

                {authModal === "register" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Kullanıcı adınız"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    E-Posta
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="ornek@mail.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Şifre
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  {authModal === "register" && (
                    <div className="mt-2">
                      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${strength}%` }}
                          className={`h-full ${strengthColor}`}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-widest">
                        Şifre Gücü:{" "}
                        {strength <= 50
                          ? "Zayıf"
                          : strength <= 75
                            ? "Orta"
                            : "Güçlü"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleAuth}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl mt-8 transition-all active:scale-95 shadow-xl shadow-blue-500/20 uppercase tracking-widest text-sm"
              >
                {authModal === "login" ? "Giriş Yap" : "Hesap Oluştur"}
              </button>

              <p className="text-center text-slate-500 text-[10px] mt-6 uppercase font-bold tracking-widest">
                {authModal === "login"
                  ? "Hesabınız yok mu?"
                  : "Zaten hesabınız var mı?"}
                <button
                  onClick={() =>
                    setAuthModal(authModal === "login" ? "register" : "login")
                  }
                  className="text-blue-400 ml-1 hover:underline"
                >
                  {authModal === "login" ? "KAYIT OL" : "GİRİŞ YAP"}
                </button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* MİRA Score and Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* MİRA Score Card */}
                <div className={`${currentTheme.card} border ${currentTheme.border} p-6 rounded-3xl shadow-xl flex flex-col justify-between group hover:scale-[1.02] transition-all relative overflow-hidden h-[180px]`}>
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl">
                      <Activity className="text-blue-400" size={24} />
                    </div>
                    <span className={`text-[10px] font-black tracking-widest ${currentTheme.sub}`}>MİRA SCORE</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <h4 className="text-5xl font-black tracking-tighter leading-none">{miraScore}</h4>
                    <span className={`text-xs font-bold ${currentTheme.sub} mb-1`}>/100</span>
                  </div>
                  <p className={`mt-4 text-[10px] font-black ${currentTheme.sub} uppercase tracking-tight`}>FİNANSAL SAĞLIK ENDEKSİ</p>
                  <div className="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${miraScore}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>

                <div className={`${currentTheme.card} border ${currentTheme.border} p-6 rounded-3xl shadow-xl flex flex-col justify-between h-[180px] hover:border-slate-700 transition-colors`}>
                  <h3 className="text-slate-400 mb-4 text-sm font-medium">
                    Bütçe Kullanım Oranı
                  </h3>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-200 bg-blue-600">
                          Harcama
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-200">
                          %
                          {stats.toplamGelir > 0
                            ? Math.round(
                                (stats.toplamGider / stats.toplamGelir) * 100,
                              )
                            : 0}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${stats.toplamGelir > 0 ? (stats.toplamGider / stats.toplamGelir) * 100 : 0}%`,
                        }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      ></motion.div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {stats.toplamGelir > 0 &&
                      stats.toplamGider / stats.toplamGelir > 0.8
                        ? "Dikkat! Bütçenizin büyük kısmını harcadınız."
                        : "Bütçe kullanımınız sağlıklı düzeyde."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${currentTheme.card} border ${currentTheme.border} p-6 rounded-3xl hover:border-slate-700 transition-colors`}>
                  <p className={`text-xs ${currentTheme.sub} uppercase font-bold mb-2 flex items-center gap-2`}>
                    <ArrowUpCircle size={14} className="text-green-400" />
                    Toplam Gelir
                  </p>
                  <h3 className="text-3xl font-black text-green-400">
                    {stats.toplamGelir.toLocaleString()}{" "}
                    <span className="text-xl">TL</span>
                  </h3>
                </div>
                <div className={`${currentTheme.card} border ${currentTheme.border} p-6 rounded-3xl hover:border-slate-700 transition-colors`}>
                  <p className={`text-xs ${currentTheme.sub} uppercase font-bold mb-2 flex items-center gap-2`}>
                    <ArrowDownCircle size={14} className="text-red-400" />
                    Toplam Gider
                  </p>
                  <h3 className="text-3xl font-black text-red-400">
                    {stats.toplamGider.toLocaleString()}{" "}
                    <span className="text-xl">TL</span>
                  </h3>
                </div>
                <div className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-500/10">
                  <p className="text-xs text-blue-100/60 uppercase font-bold mb-2 flex items-center gap-2">
                    <Activity size={14} />
                    Net Bakiye
                  </p>
                  <h3 className="text-3xl font-black text-white">
                    {(stats.toplamGelir - stats.toplamGider).toLocaleString()}{" "}
                    <span className="text-xl">TL</span>
                  </h3>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 gap-6">
                <div className={`${currentTheme.card} border ${currentTheme.border} p-6 rounded-3xl shadow-xl`}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h4 className={`text-xs font-bold ${currentTheme.sub} uppercase tracking-widest flex items-center gap-2`}>
                      <TrendingUp size={14} /> Nakit Akış Trendi
                    </h4>

                    <div className={`flex items-center gap-2 ${currentTheme.bg} p-1 rounded-xl border ${currentTheme.border}`}>
                      <input
                        type="date"
                        value={trendRange.startDate}
                        onChange={(e) =>
                          setTrendRange((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="bg-transparent text-[9px] font-bold text-slate-500 outline-none px-2 cursor-pointer hover:text-blue-400 transition-colors"
                      />
                      <div className="w-1.5 h-[1px] bg-slate-800"></div>
                      <input
                        type="date"
                        value={trendRange.endDate}
                        onChange={(e) =>
                          setTrendRange((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="bg-transparent text-[9px] font-bold text-slate-500 outline-none px-2 cursor-pointer hover:text-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={10}
                          tickFormatter={(val) => `${Math.floor(val)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "12px",
                          }}
                          itemStyle={{ fontSize: "12px" }}
                          formatter={(value: number) => [
                            `${Math.floor(value).toLocaleString()} TL`,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="gelir"
                          name="Gelir TL"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="gider"
                          name="Gider TL"
                          stroke="#ef4444"
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Transactions & Plans Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Son İşlemler
                    </h4>
                    <button
                      onClick={() => setActiveTab("reports")}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      TÜMÜNÜ GÖR
                    </button>
                  </div>
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex justify-between items-center p-3 bg-slate-800/30 rounded-2xl hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-xl ${tx.tur === "gelir" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                          >
                            {tx.tur === "gelir" ? (
                              <Plus size={16} />
                            ) : (
                              <TrendingUp size={16} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{tx.kategori}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {formatDate(tx.tarih)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`font-mono font-bold ${tx.tur === "gelir" ? "text-green-400" : "text-red-400"}`}
                          >
                            {tx.tur === "gelir" ? "+" : "-"}
                            {tx.miktar.toLocaleString()} TL
                          </div>
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div className="text-center py-8 text-slate-500 italic text-sm">
                        Henüz işlem kaydedilmedi. MİRA AI üzerinden kayıt
                        ekleyebilirsin.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Yaklaşan Hedefler
                    </h4>
                    <button
                      onClick={() => setActiveTab("plan")}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      TÜMÜNÜ GÖR
                    </button>
                  </div>
                  <div className="space-y-4">
                    {plans
                      .sort(
                        (a, b) =>
                          new Date(a.hedef_tarih).getTime() -
                          new Date(b.hedef_tarih).getTime(),
                      )
                      .slice(0, 4)
                      .map((plan) => {
                        const daysRemaining = getDaysRemaining(
                          plan.hedef_tarih,
                        );
                        const isExpired = daysRemaining < 0;

                        return (
                          <div
                            key={plan.id}
                            className="group relative bg-slate-800/20 border border-slate-800 hover:border-blue-500/30 p-4 rounded-2xl transition-all"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                  <Target size={16} />
                                </div>
                                <div>
                                  <h5 className="text-sm font-bold text-slate-100">
                                    {plan.baslik}
                                  </h5>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                    {plan.hedef_tarih}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${isExpired ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}
                              >
                                {isExpired
                                  ? "SÜRESİ GEÇTİ"
                                  : `${daysRemaining} GÜN KALDI`}
                              </div>
                            </div>
                            <div className="mt-3 space-y-4">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>Kalan Gün: {daysRemaining}</span>
                                <span>
                                  Hedef: {plan.hedef_tutar.toLocaleString()} TL
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(100, Math.max(0, 100 - (daysRemaining / 30) * 100))}%`,
                                  }}
                                  className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {plans.length === 0 && (
                      <div className="text-center py-12 flex flex-col items-center">
                        <Target size={32} className="text-slate-700 mb-3" />
                        <p className="text-xs text-slate-500 italic">
                          Henüz stratejik bir plan oluşturulmamış.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "piyasa" && (
            <motion.div
              key="piyasa"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-black text-blue-500 uppercase tracking-tighter">
                    Piyasa Analizi
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    Varlıklara tıklayarak MİRA'nın anlık yorumlarını gör
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  {marketRates.map((item, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 5 }}
                      onClick={() => setSelectedAsset(item)}
                      className={`w-full bg-slate-900/50 border ${selectedAsset?.id === item.id ? "border-blue-500 bg-blue-500/5" : "border-slate-800"} p-6 rounded-3xl flex justify-between items-center transition-all group`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div
                          className={`p-3 rounded-2xl ${selectedAsset?.id === item.id ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 group-hover:text-blue-400"} transition-colors`}
                        >
                          {item.id === "GOLD" ? (
                            <Landmark size={20} />
                          ) : (
                            <CircleDollarSign size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase mb-0.5">
                            {item.label}
                          </p>
                          <h3 className="text-lg font-black text-slate-100">
                            {item.id !== "GOLD"
                              ? `${item.id} / TRY`
                              : "ALTIN (XAU)"}
                          </h3>
                        </div>
                      </div>
                      <div className="text-right">
                        {item.isGold ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-yellow-500 uppercase tracking-widest">
                              Kuyumcu Canlı
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold">
                              Gram / Çeyrek Analiz
                            </span>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-xl font-black text-green-400">
                              {item.val?.toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </h3>
                            <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                              Canlı Döviz
                            </span>
                          </>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="space-y-6">
                  {selectedAsset && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-blue-600/5 border border-blue-500/30 p-6 rounded-[40px] shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4">
                        <Activity size={40} className="text-blue-500/10" />
                      </div>
                      <h4 className="text-sm font-black text-blue-400 uppercase tracking-tighter mb-4">
                        {selectedAsset.label} Gözlemi
                      </h4>

                      {selectedAsset.isGold ? (
                        <div className="space-y-3 mb-4">
                          {selectedAsset.items.map((gold: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-[11px] border-b border-blue-500/10 pb-1.5"
                            >
                              <span className="text-slate-400 font-medium">
                                {gold.label}
                              </span>
                              <div className="flex gap-4">
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] text-slate-500 uppercase">
                                    Alış
                                  </span>
                                  <span className="font-bold text-slate-300">
                                    {gold.buy.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] text-slate-500 uppercase">
                                    Satış
                                  </span>
                                  <span className="font-bold text-green-400">
                                    {gold.sell.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <p className="text-xs text-slate-300 leading-relaxed italic border-t border-blue-500/10 pt-4">
                        "MİRA: {selectedAsset.insight}"
                      </p>
                    </motion.div>
                  )}

                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[40px]">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter">
                          Portföy Kararı
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          MİRA AI Strateji Birimi
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30">
                      {stats.toplamGelir - stats.toplamGider < 0 ? (
                        <div className="space-y-4">
                          <p className="text-xs text-red-400 font-bold leading-relaxed">
                            Bakiyeniz şu an eksi durumda. Bu seviyede yatırım
                            önerisi risklidir. Öncelikle borçları minimize
                            etmeli ve nakit akışınızı dengelemelisiniz.
                          </p>
                          <button
                            onClick={() => setIsChatOpen(true)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                          >
                            MİRA İLE ÇIKIŞ YOLU PLANLA <ArrowRight size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Nakit fazlanız{" "}
                          <strong>
                            {(
                              stats.toplamGelir - stats.toplamGider
                            ).toLocaleString()}{" "}
                            TL
                          </strong>
                          . Mevcut piyasa koşullarında likiditeyi korumak adına
                          varlıklarınızı çeşitlendirmeniz önerilir. Detaylı
                          analiz için MİRA terminalini kullanabilirsiniz.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "status" && (
            <motion.div
              key="status"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Enhanced Category Distribution Section */}
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Kategorik Analiz
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={categoryFilter.period}
                      onChange={(e) =>
                        setCategoryFilter((prev) => ({
                          ...prev,
                          period: e.target.value,
                        }))
                      }
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="daily">Günlük</option>
                      <option value="monthly">Aylık</option>
                      <option value="yearly">Yıllık</option>
                    </select>

                    {categoryFilter.period === "monthly" && (
                      <select
                        value={categoryFilter.month}
                        onChange={(e) =>
                          setCategoryFilter((prev) => ({
                            ...prev,
                            month: e.target.value,
                          }))
                        }
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {[
                          "01",
                          "02",
                          "03",
                          "04",
                          "05",
                          "06",
                          "07",
                          "08",
                          "09",
                          "10",
                          "11",
                          "12",
                        ].map((m) => (
                          <option key={m} value={m}>
                            {new Date(2000, parseInt(m) - 1).toLocaleString(
                              "tr-TR",
                              { month: "long" },
                            )}
                          </option>
                        ))}
                      </select>
                    )}

                    {(categoryFilter.period === "monthly" ||
                      categoryFilter.period === "yearly") && (
                      <select
                        value={categoryFilter.year}
                        onChange={(e) =>
                          setCategoryFilter((prev) => ({
                            ...prev,
                            year: e.target.value,
                          }))
                        }
                        className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                          <option key={y} value={y.toString()}>
                            {y}
                          </option>
                        ))}
                      </select>
                    )}

                    <select
                      value={categoryFilter.type}
                      onChange={(e) =>
                        setCategoryFilter((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="gelir">Gelirler</option>
                      <option value="gider">Giderler</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[300px]">
                  {filteredPieData.length > 0 ? (
                    <>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={filteredPieData}
                              innerRadius={70}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {filteredPieData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                border: "1px solid #1e293b",
                                borderRadius: "12px",
                              }}
                              formatter={(value: number) => [
                                `${Math.floor(value).toLocaleString()} TL`,
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-4">
                        {filteredPieData.map((item, index) => (
                          <div
                            key={item.name}
                            className="flex justify-between items-center p-3 bg-slate-800/30 border-l-4 rounded-xl"
                            style={{
                              borderLeftColor: COLORS[index % COLORS.length],
                            }}
                          >
                            <span className="text-sm font-medium text-slate-300">
                              {item.name}
                            </span>
                            <span className="text-sm font-bold">
                              {item.value.toLocaleString()} TL
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="lg:col-span-2 py-12 flex flex-col items-center justify-center text-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative mb-6"
                      >
                        <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center">
                          <FolderX size={48} className="text-blue-400" />
                        </div>
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-2 -right-2 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-xl"
                        >
                          <X size={16} className="text-red-400" />
                        </motion.div>
                      </motion.div>
                      <h3 className="text-lg font-bold text-slate-300">
                        Kriterlere uygun veri bulunamadı
                      </h3>
                      <p className="text-sm text-slate-500 mt-2">
                        Filtreleme kriterlerini değiştirerek tekrar
                        deneyebilirsiniz.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                <h4 className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest italic">
                  Aylık Karşılaştırma
                </h4>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...analysis.aylik].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ay" stroke="#64748b" fontSize={10} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={10}
                        tickFormatter={(val) => `${Math.floor(val)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #1e293b",
                          borderRadius: "12px",
                        }}
                        formatter={(value: number) => [
                          `${Math.floor(value).toLocaleString()} TL`,
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="gelir"
                        name="Gelir TL"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="gider"
                        name="Gider TL"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`${currentTheme.card} border ${currentTheme.border} rounded-3xl p-8 shadow-2xl space-y-8`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h4 className={`text-2xl font-black tracking-tight ${currentTheme.text} uppercase`}>
                    Tüm İşlem Geçmişi
                  </h4>
                  <p className={`text-[10px] font-black ${currentTheme.sub} tracking-[0.2em] mt-1`}>FİNANSAL VERİ ARŞİVİ</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={exportToCSV}
                    className={`flex items-center gap-2 px-6 py-3 ${currentTheme.bg} border ${currentTheme.border} rounded-2xl text-xs font-black ${currentTheme.sub} hover:text-white transition-all shadow-lg active:scale-95`}
                  >
                    <Download size={18} />
                    CSV RAPORU İNDİR
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-3">
                  <thead>
                    <tr className={`${currentTheme.sub} text-[10px] uppercase font-black tracking-widest`}>
                      {[
                        { key: "tarih", label: "Tarih" },
                        { key: "kategori", label: "Kategori" },
                        { key: "tur", label: "Tür", center: true },
                        { key: "miktar", label: "Miktar", right: true },
                      ].map((header) => (
                        <th
                          key={header.key}
                          onClick={() =>
                            handleSort(header.key as keyof Transaction)
                          }
                          className={`px-4 py-2 cursor-pointer hover:text-blue-400 transition-colors group ${header.center ? "text-center" : ""} ${header.right ? "text-right" : ""}`}
                        >
                          <div
                            className={`flex items-center gap-1 ${header.center ? "justify-center" : ""} ${header.right ? "justify-end" : ""}`}
                          >
                            {header.label}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortConfig.key === header.key ? (
                                sortConfig.direction === "asc" ? (
                                  <ArrowUp size={10} />
                                ) : (
                                  <ArrowDown size={10} />
                                )
                              ) : (
                                <ArrowUpDown size={10} />
                              )}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="bg-slate-800/20 hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="px-4 py-3 rounded-l-2xl text-[10px] font-mono text-slate-400">
                          {new Date(tx.tarih).toLocaleString("tr-TR")}
                        </td>
                        <td className="px-4 py-3 font-bold text-sm">
                          {tx.kategori}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${tx.tur === "gelir" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                          >
                            {tx.tur}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 font-mono font-bold rounded-r-2xl ${tx.tur === "gelir" ? "text-green-400" : "text-red-400"}`}
                        >
                          {tx.tur === "gelir" ? "+" : "-"}
                          {tx.miktar.toLocaleString()} TL
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "plan" && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">
                    Finansal Strateji Terminali
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    MİRA AI Tarafından Optimize Edilmiştir
                  </p>
                </div>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Plus size={14} /> Yeni Plan Oluştur
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {plans.map((plan) => {
                  const IconComponent = (() => {
                    switch (plan.ikon) {
                      case "Plane":
                        return Plane;
                      case "Car":
                        return Car;
                      case "Home":
                        return Home;
                      case "ShoppingBag":
                        return ShoppingBag;
                      case "Landmark":
                        return Landmark;
                      case "TrendingUp":
                        return TrendingUp;
                      default:
                        return Target;
                    }
                  })();

                  return (
                    <motion.div
                      key={plan.id}
                      className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col hover:border-blue-500/30 transition-colors"
                    >
                      <div className="p-8 border-b border-slate-800 bg-slate-800/10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 shadow-inner">
                            <IconComponent size={24} />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Kayıt Tarihi
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              {formatDate(plan.tarih)}
                            </span>
                          </div>
                        </div>

                        {editingPlanId === plan.id ? (
                          <div className="flex gap-2 mb-6">
                            <input
                              autoFocus
                              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white w-full font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                              value={newPlanTitle}
                              onChange={(e) => setNewPlanTitle(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleRenamePlan(plan.id)
                              }
                            />
                            <button
                              onClick={() => handleRenamePlan(plan.id)}
                              className="p-2 bg-blue-600 rounded-xl text-white hover:bg-blue-500"
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-6 group">
                            <h3 className="text-2xl font-black tracking-tighter text-blue-500 uppercase leading-tight">
                              {plan.baslik}
                            </h3>
                            <button
                              onClick={() => {
                                setEditingPlanId(plan.id);
                                setNewPlanTitle(plan.baslik);
                              }}
                              className="p-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-all bg-slate-800/50 rounded-lg"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/50">
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                              Hedef Tutar
                            </p>
                            <p className="text-[10px] font-bold text-green-400">
                              {plan.hedef_tutar.toLocaleString()}{" "}
                              <span className="text-[8px]">TL</span>
                            </p>
                          </div>
                          <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/50">
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                              Bitiş Tarihi
                            </p>
                            <p className="text-[10px] font-bold text-slate-300 truncate">
                              {plan.hedef_tarih}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 prose prose-invert prose-sm max-w-none prose-headings:text-blue-500 prose-headings:uppercase prose-headings:tracking-tighter prose-headings:mb-4 prose-p:text-slate-400 prose-p:leading-relaxed prose-li:text-slate-400 prose-strong:text-blue-300">
                        <ReactMarkdown>{plan.icerik}</ReactMarkdown>
                      </div>
                    </motion.div>
                  );
                })}

                {plans.length === 0 && (
                  <div className="md:col-span-2 py-24 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700/50">
                      <Target size={48} className="text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-300">
                      Henüz bir planınız yok
                    </h3>
                    <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">
                      Finansal hedeflerine ulaşmak için MİRA AI sana özel yol
                      haritaları hazırlayabilir.
                    </p>
                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="mt-8 bg-slate-800 hover:bg-slate-700 text-blue-400 font-black uppercase text-[10px] px-6 py-3 rounded-2xl tracking-widest border border-slate-700/50 flex items-center gap-2 transition-all"
                    >
                      MİRA İLE KONUŞ <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* AI Trigger - Vertical Left Bar */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center">
        <div className="w-1.5 h-32 bg-slate-800 rounded-r-full mb-4"></div>
        <motion.button
          whileHover={{ scale: 1.1, x: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-blue-600 hover:bg-blue-500 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center relative border-4 border-[#0f172a] group"
        >
          <div className="w-full h-full rounded-full flex items-center justify-center bg-blue-600">
            {isChatOpen ? (
              <X size={24} className="text-white" />
            ) : (
              <MessageSquare size={24} className="text-white" />
            )}
          </div>
        </motion.button>
        <div className="w-1.5 h-32 bg-slate-800 rounded-r-full mt-4"></div>
      </div>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            className="fixed bottom-8 left-20 w-[380px] h-[520px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-[100]"
          >
            <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="font-bold text-blue-400 text-sm tracking-tight uppercase">
                  MİRA AI TERMINAL
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scroll-smooth custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`p-4 max-w-[85%] rounded-3xl ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 p-4 rounded-3xl rounded-bl-none border border-slate-700">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                      ></motion.div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          delay: 0.2,
                        }}
                        className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                      ></motion.div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          delay: 0.4,
                        }}
                        className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Collapsible Shortcuts with Management */}
            <div className="bg-slate-900 border-t border-slate-800 flex flex-col">
              <details className="group">
                <summary className="flex items-center justify-between px-4 py-2 cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Hızlı Komutlar
                  </span>
                  <div className="transition-transform group-open:rotate-180">
                    <ArrowDownCircle size={14} className="text-slate-500" />
                  </div>
                </summary>

                <div className="p-3 space-y-4">
                  {/* New Shortcut Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="newShortcutInput"
                      placeholder="Yeni komut ekle..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          if (val) {
                            setShortcuts((prev) => [...prev, val]);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                      className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(
                          "newShortcutInput",
                        ) as HTMLInputElement;
                        if (input.value) {
                          setShortcuts((prev) => [...prev, input.value]);
                          input.value = "";
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl border border-slate-700"
                    >
                      <Plus size={12} className="text-blue-400" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {shortcuts.map((s, i) => (
                      <div key={i} className="group relative">
                        <button
                          onClick={() => handleSendMessage(s)}
                          className="bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-blue-400 border border-slate-700/50 rounded-full px-3 py-1.5 text-[9px] font-bold transition-all"
                        >
                          {s}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeShortcut(i);
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 bg-red-500/80 text-white p-0.5 rounded-full transition-opacity shadow-lg"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Mira'ya bir şey sor..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 pr-10"
                />
                <button 
                  onClick={handleVoiceInput}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                >
                  <Mic size={16} />
                </button>
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 p-3 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
