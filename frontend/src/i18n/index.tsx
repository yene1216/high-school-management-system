import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type Lang = "en" | "am";

// English text is the key's default (passed to t()); only Amharic needs a table. Have a native speaker review these.
const am: Record<string, string> = {
  "nav.dashboard": "ዳሽቦርድ", "nav.students": "ተማሪዎች", "nav.myChildren": "ልጆቼ", "nav.myRecord": "የእኔ መዝገብ",
  "nav.guardians": "አሳዳጊዎች", "nav.enrollments": "ምዝገባ", "nav.attendance": "ተገኝነት", "nav.gradebook": "የውጤት መዝገብ",
  "nav.corrections": "ማስተካከያዎች", "nav.invoices": "ደረሰኞች", "nav.payments": "ክፍያዎች", "nav.refunds": "ተመላሽ ገንዘብ",
  "nav.announcements": "ማስታወቂያዎች", "nav.notifications": "ማሳወቂያዎች", "nav.reports": "ሪፖርቶች", "nav.audit": "የእንቅስቃሴ መዝገብ",
  "nav.deliveries": "የመልእክት ሁኔታ", "nav.setup": "ማዋቀር", "nav.users": "ተጠቃሚዎች", "nav.schools": "ትምህርት ቤቶች", "nav.settings": "ቅንብሮች",
  "group.overview": "አጠቃላይ", "group.people": "ሰዎች", "group.teaching": "ማስተማር", "group.finance": "ፋይናንስ",
  "group.communication": "ግንኙነት", "group.insights": "ትንታኔ", "group.administration": "አስተዳደር",
  "auth.signIn": "ግባ", "auth.signOut": "ውጣ", "auth.email": "ኢሜይል", "auth.password": "የይለፍ ቃል", "auth.forgot": "የይለፍ ቃል ረሱ?",
  "common.save": "አስቀምጥ", "common.cancel": "ሰርዝ", "common.delete": "አጥፋ", "common.edit": "አርትዕ", "common.add": "ጨምር",
  "common.search": "ፈልግ", "common.loading": "በመጫን ላይ…", "common.view": "ይመልከቱ", "common.print": "አትም", "common.back": "ተመለስ",
  "status.present": "ተገኝቷል", "status.absent": "ቀርቷል", "status.late": "ዘግይቷል", "status.excused": "በፈቃድ", "status.unmarked": "አልተመዘገበም",
  "dash.today": "ዛሬ", "dash.balance": "ቀሪ ሂሳብ", "dash.latest": "የቅርብ ውጤቶች", "dash.none": "ምንም የለም",
  "att.save": "ተገኝነትን አስቀምጥ", "att.markAll": "ሁሉንም ተገኝቷል አድርግ",
};

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (key: string, fallback?: string) => string }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return saved === "am" ? "am" : "en";
  });
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("lang", l);
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  const t = useCallback((key: string, fallback?: string) => (lang === "am" && am[key]) || fallback || key.split(".").pop() || key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
