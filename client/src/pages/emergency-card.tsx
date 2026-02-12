import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Globe, Phone, Syringe, Heart, Download, Share2, Info } from "lucide-react";
import { storage, UserProfile, EmergencyContact } from "@/lib/storage";

const LANGUAGES = [
  { code: "en", name: "English", flag: "GB" },
  { code: "es", name: "Spanish", flag: "ES" },
  { code: "fr", name: "French", flag: "FR" },
  { code: "de", name: "German", flag: "DE" },
  { code: "it", name: "Italian", flag: "IT" },
  { code: "pt", name: "Portuguese", flag: "PT" },
  { code: "nl", name: "Dutch", flag: "NL" },
  { code: "pl", name: "Polish", flag: "PL" },
  { code: "el", name: "Greek", flag: "GR" },
  { code: "tr", name: "Turkish", flag: "TR" },
  { code: "ar", name: "Arabic", flag: "AR" },
  { code: "zh", name: "Chinese", flag: "CN" },
  { code: "ja", name: "Japanese", flag: "JP" },
  { code: "th", name: "Thai", flag: "TH" },
];

const TRANSLATIONS: Record<string, {
  title: string;
  hasDisease: string;
  needsInsulin: string;
  ifUnconscious: string;
  doNotGiveInsulin: string;
  giveGlucose: string;
  callEmergency: string;
  emergencyContact: string;
  medicalInfo: string;
}> = {
  en: {
    title: "MEDICAL ALERT",
    hasDisease: "I have DIABETES",
    needsInsulin: "I use insulin",
    ifUnconscious: "If I am unconscious or confused:",
    doNotGiveInsulin: "DO NOT give insulin",
    giveGlucose: "Give sugar/glucose if I can swallow",
    callEmergency: "Call emergency services",
    emergencyContact: "Emergency Contact",
    medicalInfo: "Medical Information",
  },
  es: {
    title: "ALERTA MÉDICA",
    hasDisease: "Tengo DIABETES",
    needsInsulin: "Uso insulina",
    ifUnconscious: "Si estoy inconsciente o confundido:",
    doNotGiveInsulin: "NO dar insulina",
    giveGlucose: "Dar azúcar/glucosa si puedo tragar",
    callEmergency: "Llamar a emergencias",
    emergencyContact: "Contacto de Emergencia",
    medicalInfo: "Información Médica",
  },
  fr: {
    title: "ALERTE MÉDICALE",
    hasDisease: "J'ai le DIABÈTE",
    needsInsulin: "J'utilise de l'insuline",
    ifUnconscious: "Si je suis inconscient ou confus:",
    doNotGiveInsulin: "NE PAS donner d'insuline",
    giveGlucose: "Donner du sucre/glucose si je peux avaler",
    callEmergency: "Appeler les urgences",
    emergencyContact: "Contact d'Urgence",
    medicalInfo: "Informations Médicales",
  },
  de: {
    title: "MEDIZINISCHER ALARM",
    hasDisease: "Ich habe DIABETES",
    needsInsulin: "Ich benutze Insulin",
    ifUnconscious: "Wenn ich bewusstlos oder verwirrt bin:",
    doNotGiveInsulin: "KEIN Insulin geben",
    giveGlucose: "Zucker/Glukose geben, wenn ich schlucken kann",
    callEmergency: "Notdienst anrufen",
    emergencyContact: "Notfallkontakt",
    medicalInfo: "Medizinische Informationen",
  },
  it: {
    title: "ALLERTA MEDICA",
    hasDisease: "Ho il DIABETE",
    needsInsulin: "Uso insulina",
    ifUnconscious: "Se sono incosciente o confuso:",
    doNotGiveInsulin: "NON somministrare insulina",
    giveGlucose: "Dare zucchero/glucosio se posso deglutire",
    callEmergency: "Chiamare i servizi di emergenza",
    emergencyContact: "Contatto di Emergenza",
    medicalInfo: "Informazioni Mediche",
  },
  pt: {
    title: "ALERTA MÉDICO",
    hasDisease: "Tenho DIABETES",
    needsInsulin: "Uso insulina",
    ifUnconscious: "Se eu estiver inconsciente ou confuso:",
    doNotGiveInsulin: "NÃO dar insulina",
    giveGlucose: "Dar açúcar/glicose se eu puder engolir",
    callEmergency: "Chamar os serviços de emergência",
    emergencyContact: "Contato de Emergência",
    medicalInfo: "Informações Médicas",
  },
  nl: {
    title: "MEDISCHE WAARSCHUWING",
    hasDisease: "Ik heb DIABETES",
    needsInsulin: "Ik gebruik insuline",
    ifUnconscious: "Als ik bewusteloos of verward ben:",
    doNotGiveInsulin: "GEEN insuline geven",
    giveGlucose: "Geef suiker/glucose als ik kan slikken",
    callEmergency: "Bel de hulpdiensten",
    emergencyContact: "Noodcontact",
    medicalInfo: "Medische Informatie",
  },
  pl: {
    title: "ALERT MEDYCZNY",
    hasDisease: "Mam CUKRZYCĘ",
    needsInsulin: "Stosuję insulinę",
    ifUnconscious: "Jeśli jestem nieprzytomny lub zdezorientowany:",
    doNotGiveInsulin: "NIE podawać insuliny",
    giveGlucose: "Podać cukier/glukozę jeśli mogę połknąć",
    callEmergency: "Wezwać pogotowie",
    emergencyContact: "Kontakt Alarmowy",
    medicalInfo: "Informacje Medyczne",
  },
  el: {
    title: "ΙΑΤΡΙΚΗ ΕΙΔΟΠΟΙΗΣΗ",
    hasDisease: "Έχω ΔΙΑΒΗΤΗ",
    needsInsulin: "Χρησιμοποιώ ινσουλίνη",
    ifUnconscious: "Αν είμαι αναίσθητος ή μπερδεμένος:",
    doNotGiveInsulin: "ΜΗΝ δίνετε ινσουλίνη",
    giveGlucose: "Δώστε ζάχαρη/γλυκόζη αν μπορώ να καταπιώ",
    callEmergency: "Καλέστε τις υπηρεσίες έκτακτης ανάγκης",
    emergencyContact: "Επαφή Έκτακτης Ανάγκης",
    medicalInfo: "Ιατρικές Πληροφορίες",
  },
  tr: {
    title: "TIBBİ UYARI",
    hasDisease: "DİYABETİM var",
    needsInsulin: "İnsülin kullanıyorum",
    ifUnconscious: "Bilinçsiz veya kafam karışıksa:",
    doNotGiveInsulin: "İnsülin VERMEYİN",
    giveGlucose: "Yutabiliyorsam şeker/glikoz verin",
    callEmergency: "Acil servisi arayın",
    emergencyContact: "Acil Durum İletişimi",
    medicalInfo: "Tıbbi Bilgiler",
  },
  ar: {
    title: "تنبيه طبي",
    hasDisease: "لدي مرض السكري",
    needsInsulin: "أستخدم الأنسولين",
    ifUnconscious: "إذا كنت فاقداً للوعي أو مشوشاً:",
    doNotGiveInsulin: "لا تعطني أنسولين",
    giveGlucose: "أعطني سكر/جلوكوز إذا كنت أستطيع البلع",
    callEmergency: "اتصل بخدمات الطوارئ",
    emergencyContact: "جهة اتصال الطوارئ",
    medicalInfo: "معلومات طبية",
  },
  zh: {
    title: "医疗警示",
    hasDisease: "我患有糖尿病",
    needsInsulin: "我使用胰岛素",
    ifUnconscious: "如果我失去意识或意识模糊：",
    doNotGiveInsulin: "不要给我胰岛素",
    giveGlucose: "如果我能吞咽，给我糖/葡萄糖",
    callEmergency: "呼叫急救服务",
    emergencyContact: "紧急联系人",
    medicalInfo: "医疗信息",
  },
  ja: {
    title: "医療警告",
    hasDisease: "私は糖尿病です",
    needsInsulin: "インスリンを使用しています",
    ifUnconscious: "意識がない、または混乱している場合：",
    doNotGiveInsulin: "インスリンを与えないでください",
    giveGlucose: "飲み込めるなら砂糖/ブドウ糖を与えてください",
    callEmergency: "救急サービスに電話してください",
    emergencyContact: "緊急連絡先",
    medicalInfo: "医療情報",
  },
  th: {
    title: "แจ้งเตือนทางการแพทย์",
    hasDisease: "ฉันเป็นโรคเบาหวาน",
    needsInsulin: "ฉันใช้อินซูลิน",
    ifUnconscious: "หากฉันหมดสติหรือสับสน:",
    doNotGiveInsulin: "ห้ามให้อินซูลิน",
    giveGlucose: "ให้น้ำตาล/กลูโคสถ้าฉันกลืนได้",
    callEmergency: "โทรเรียกบริการฉุกเฉิน",
    emergencyContact: "ติดต่อฉุกเฉิน",
    medicalInfo: "ข้อมูลทางการแพทย์",
  },
};

export default function EmergencyCard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [selectedLang, setSelectedLang] = useState("en");

  useEffect(() => {
    setProfile(storage.getProfile());
    setContacts(storage.getEmergencyContacts());
  }, []);

  const t = TRANSLATIONS[selectedLang] || TRANSLATIONS.en;
  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
  const selectedLangInfo = LANGUAGES.find(l => l.code === selectedLang);

  const handleShare = async () => {
    const insulinInfo = profile?.usingInsulin 
      ? `${t.needsInsulin}${profile.insulinDeliveryMethod === "pump" ? " (Insulin Pump)" : ""}`
      : "";
    const text = `${t.title}\n${t.hasDisease}\n${insulinInfo}\n\n${t.ifUnconscious}\n• ${t.doNotGiveInsulin}\n• ${t.giveGlucose}\n• ${t.callEmergency}${primaryContact ? `\n\n${t.emergencyContact}: ${primaryContact.name} - ${primaryContact.phone}` : ""}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Card text copied to clipboard!");
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          Emergency Card
        </h1>
        <p className="text-muted-foreground">Digital medical alert card in multiple languages</p>
      </div>

      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-primary" />
        <Select value={selectedLang} onValueChange={setSelectedLang}>
          <SelectTrigger className="flex-1" data-testid="select-language">
            <SelectValue>
              {selectedLangInfo && (
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{selectedLangInfo.flag}</span>
                  <span>{selectedLangInfo.name}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} data-testid={`option-lang-${lang.code}`}>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/30" data-testid="card-emergency">
        <CardHeader className="bg-red-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6" />
            {t.title}
            <AlertTriangle className="h-6 w-6" />
          </CardTitle>
          {selectedLangInfo && (
            <p className="text-center text-red-100 text-sm">
              {selectedLangInfo.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">
              {t.hasDisease}
            </h2>
            {profile?.usingInsulin && (
              <p className="text-lg font-medium text-red-600 dark:text-red-400 flex items-center justify-center gap-2 mt-2">
                <Syringe className="h-5 w-5" />
                {t.needsInsulin}
                {profile.insulinDeliveryMethod === "pump" && " (Insulin Pump)"}
              </p>
            )}
          </div>

          <div className="border-t border-red-200 dark:border-red-800 pt-4">
            <h3 className="font-bold text-red-700 dark:text-red-400 mb-3">
              {t.ifUnconscious}
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 bg-red-100 dark:bg-red-900/50 p-2 rounded font-medium">
                <span className="text-red-600">1.</span>
                <span className="text-red-800 dark:text-red-200">{t.doNotGiveInsulin}</span>
              </li>
              <li className="flex items-start gap-2 bg-amber-100 dark:bg-amber-900/50 p-2 rounded font-medium">
                <span className="text-amber-600">2.</span>
                <span className="text-amber-800 dark:text-amber-200">{t.giveGlucose}</span>
              </li>
              <li className="flex items-start gap-2 bg-blue-100 dark:bg-blue-900/50 p-2 rounded font-medium">
                <span className="text-blue-600">3.</span>
                <span className="text-blue-800 dark:text-blue-200">{t.callEmergency}</span>
              </li>
            </ul>
          </div>

          {primaryContact && (
            <div className="border-t border-red-200 dark:border-red-800 pt-4">
              <h4 className="font-medium text-sm text-red-600 dark:text-red-400 mb-2">
                {t.emergencyContact}
              </h4>
              <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-lg border">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <Phone className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">{primaryContact.name}</p>
                  <p className="text-sm text-muted-foreground">{primaryContact.phone}</p>
                </div>
              </div>
            </div>
          )}

          {profile?.name && (
            <div className="border-t border-red-200 dark:border-red-800 pt-4 text-center">
              <p className="text-sm text-muted-foreground">{t.medicalInfo}</p>
              <p className="font-medium">{profile.name}</p>
              {profile.diabetesType && (
                <Badge variant="outline" className="mt-1">
                  {profile.diabetesType === "type1" ? "Type 1" : profile.diabetesType === "type2" ? "Type 2" : "Gestational"} Diabetes
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={handleShare}
          data-testid="button-share-card"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share / Copy
        </Button>
      </div>

      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-medium mb-1">Tips for using this card</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>Save a screenshot to your phone's home screen</li>
                <li>Print a copy to keep in your wallet</li>
                <li>Select the local language when travelling abroad</li>
                <li>Add your emergency contact in Settings for it to appear here</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
