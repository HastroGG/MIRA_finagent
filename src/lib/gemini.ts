import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  orderBy,
  limit 
} from 'firebase/firestore';

const API_URL = "";

const saveTransaction: FunctionDeclaration = {
  name: "saveTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Kullanıcının gelir veya giderini kaydeder.",
    properties: {
      tur: {
        type: Type.STRING,
        description: "İşlem türü: 'gelir' veya 'gider'",
        enum: ["gelir", "gider"]
      },
      kategori: {
        type: Type.STRING,
        description: "Harcama veya gelir kategorisi (örneğin: Market, Kira, Maaş, Eğlence)"
      },
      miktar: {
        type: Type.NUMBER,
        description: "İşlemin tutarı (TL cinsinden)"
      }
    },
    required: ["tur", "kategori", "miktar"]
  }
};

const getFinancialSummary: FunctionDeclaration = {
  name: "getFinancialSummary",
  parameters: {
    type: Type.OBJECT,
    description: "Finansal özet bilgilerini getirir (toplam gelir, gider ve bakiye).",
    properties: {}
  }
};

const addGoal: FunctionDeclaration = {
  name: "addGoal",
  parameters: {
    type: Type.OBJECT,
    description: "Yeni bir birikim hedefi ekler.",
    properties: {
      hedef_adi: {
        type: Type.STRING,
        description: "Hedefin adı (örneğin: Araba, Tatil)"
      },
      hedef_tutar: {
        type: Type.NUMBER,
        description: "Hedeflenen toplam tutar"
      }
    },
    required: ["hedef_adi", "hedef_tutar"]
  }
};

const addDebt: FunctionDeclaration = {
  name: "addDebt",
  parameters: {
    type: Type.OBJECT,
    description: "Yeni bir borç veya alacak kaydı ekler.",
    properties: {
      isim: {
        type: Type.STRING,
        description: "Borçlu veya alacaklı kişinin adı"
      },
      miktar: {
        type: Type.NUMBER,
        description: "Tutar"
      },
      tip: {
        type: Type.STRING,
        description: "Tür: 'borç' veya 'alacak'",
        enum: ["borç", "alacak"]
      }
    },
    required: ["isim", "miktar", "tip"]
  }
};

const deleteTransaction: FunctionDeclaration = {
  name: "deleteTransaction",
  parameters: {
    type: Type.OBJECT,
    description: "Belirli bir işlemi siler. Kullanıcı geçmişe yönelik silme istediğinde kullanılabilir.",
    properties: {
      id: {
        type: Type.STRING,
        description: "Silinecek işlemin benzersiz ID'si (Doc ID)"
      }
    },
    required: ["id"]
  }
};

const listTransactions: FunctionDeclaration = {
  name: "listTransactions",
  parameters: {
    type: Type.OBJECT,
    description: "Tüm işlemleri listeler. Silme işleminden önce doğru ID'yi bulmak için kullanılmalıdır.",
    properties: {}
  }
};

const createSavingsPlan: FunctionDeclaration = {
  name: "createSavingsPlan",
  parameters: {
    type: Type.OBJECT,
    description: "Kullanıcı için finansal analiz yaparak bir birikim veya harcama planı oluşturur.",
    properties: {
      baslik: {
        type: Type.STRING,
        description: "Planın kısa başlığı (örn: Yaz Tatili Planı)"
      },
      icerik: {
        type: Type.STRING,
        description: "Analiz sonuçları ve önerileri içeren detaylı plan metni (Markdown formatında). 'Güncel Durum' ve 'Öneriler' başlıklarını mutlaka içermelidir."
      },
      hedef_tutar: {
        type: Type.NUMBER,
        description: "Planlanan hedef tutar"
      },
      hedef_tarih: {
        type: Type.STRING,
        description: "Hedeflenen tarih (örn: 19 Mayıs 2026)"
      },
      ikon: {
        type: Type.STRING,
        description: "Plan için uygun bir Lucide ikon ismi (örn: Plane, Car, Home, TrendingUp, ShoppingBag, Landmark)"
      }
    },
    required: ["baslik", "icerik", "hedef_tutar", "hedef_tarih", "ikon"]
  }
};

export const miraTools = [saveTransaction, getFinancialSummary, addGoal, addDebt, createSavingsPlan];

export async function handleToolCall(name: string, args: any) {
  const user = auth.currentUser;
  if (!user) return { error: "Lütfen güncel finansal işlemler için önce giriş yapın." };

  switch (name) {
    case "saveTransaction": {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...args,
        userId: user.uid,
        amount: Number(args.miktar),
        type: args.tur,
        category: args.kategori,
        timestamp: new Date().toISOString().replace('T', ' ').split('.')[0]
      });
      return { success: true, id: docRef.id };
    }
    case "getFinancialSummary": {
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(doc => doc.data() as any);
      const totalGelir = txs.filter((t: any) => t.type === 'gelir').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const totalGider = txs.filter((t: any) => t.type === 'gider').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      return {
        toplamGelir: totalGelir,
        toplamGider: totalGider,
        netBakiye: totalGelir - totalGider
      };
    }
    case "addGoal": {
      const docRef = await addDoc(collection(db, 'goals'), {
        userId: user.uid,
        title: args.hedef_adi,
        targetAmount: Number(args.hedef_tutar),
        currentAmount: 0,
        targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 3, new Date().getDate()).toISOString().split('T')[0]
      });
      return { success: true, id: docRef.id };
    }
    case "addDebt": {
      const docRef = await addDoc(collection(db, 'debts'), {
        userId: user.uid,
        title: args.isim,
        amount: Number(args.miktar),
        isPaid: false,
        type: args.tip,
        dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).toISOString().split('T')[0]
      });
      return { success: true, id: docRef.id };
    }
    case "createSavingsPlan": {
      const docRef = await addDoc(collection(db, 'plans'), {
        userId: user.uid,
        title: args.baslik,
        targetAmount: Number(args.hedef_tutar),
        currentAmount: 0,
        endDate: args.hedef_tarih,
        content: args.icerik,
        icon: args.ikon,
        timestamp: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    }
    default:
      return { error: "Unknown tool" };
  }
}

export const getGeminiResponse = async (history: { role: string, content: string }[]) => {
  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const systemInstruction = `Sen MİRA AI Finans Terminali'sin. Kullanıcıların finansal asistanısın. 
  Görevin kullanıcıların gelir ve giderlerini takip etmelerine, bütçe yapmalarına ve finansal durumlarını analiz etmelerine yardımcı olmaktır.
  Verilen araçları kullanarak işlem kaydedebilir, özet getirebilir veya hedef/borç ekleyebilirsin.
  Cevaplarını her zaman profesyonel, yardımsever ve finansal bir asistan gibi ver.
  Kullanıcı Türkçe konuşursa Türkçe cevap ver.
  Eğer bir işlem başarılıysa kullanıcıya konfirme et.`;

  const contents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: miraTools }]
    }
  });

  const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => !!p.functionCall);
  if (functionCalls && functionCalls.length > 0) {
    const toolResults: any[] = [];
    for (const fcPart of functionCalls) {
      const fc = fcPart.functionCall;
      if (!fc) continue;
      const result = await handleToolCall(fc.name, fc.args);
      toolResults.push({
        functionResponse: {
          name: fc.name,
          response: result
        }
      });
    }

    // Call again with tool results
    try {
      const secondResult = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...contents,
          { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] },
          { role: 'function', parts: toolResults }
        ]
      });
      return secondResult.text || "İşlem tamamlandı.";
    } catch (err) {
      console.error("Gemini second call error:", err);
      return "İşlemi gerçekleştirdim ancak onay mesajı oluştururken bir hata oluştu. Lütfen güncel tabloyu kontrol edin.";
    }
  }

  return response.text || "Anlayamadım, tekrar eder misiniz?";
} catch (error) {
  console.error("Gemini API Error:", error);
  throw error;
}
};
