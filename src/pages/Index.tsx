import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Clock, Flame, Zap } from "lucide-react";
import modiCoimbatore from "@/assets/modi-coimbatore.jpg";

// 100% JSON-driven content. Edit the JSON files in /src/data/news/ to update the site.
import coimbatoreNews from "@/data/news/coimbatore.json";
import erodeNews from "@/data/news/erode.json";
import tiruppurNews from "@/data/news/tiruppur.json";
import salemNews from "@/data/news/salem.json";
import namakkalNews from "@/data/news/namakkal.json";
import nilgirisNews from "@/data/news/nilgiris.json";
import karurNews from "@/data/news/karur.json";
import dharmapuriNews from "@/data/news/dharmapuri.json";
import mainNews from "@/data/news/main.json";

// ---------- Types & helpers (kept local; no extra files needed) ----------
interface RawNews {
  id: string;
  title: string;
  title_ta?: string;   // written by auto-fetch script when AI is available
  summary: string;
  summary_ta?: string; // written by auto-fetch script when AI is available
  category: string;
  date: string;
  featured?: boolean;
  image?: string;
  link?: string;       // original source URL saved by fetch-news script
}

interface DisplayArticle {
  id: string;
  districtSlug: string;   // e.g. "coimbatore" — used in route /:district/article/:id
  originalId: string;     // the raw item.id from JSON — used in the route
  title_en: string;
  title_ta: string;
  summary_en: string;
  summary_ta: string;
  district: string;
  category: string;
  date: string;
  image: string;
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=600&h=400&fit=crop",
];

const DISTRICT_LABEL: Record<string, string> = {
  coimbatore: "Coimbatore",
  erode: "Erode",
  tiruppur: "Tiruppur",
  salem: "Salem",
  namakkal: "Namakkal",
  nilgiris: "Nilgiris",
  karur: "Karur",
  dharmapuri: "Dharmapuri",
};

// Convert raw JSON item -> display article (keeps single-language JSON working in bilingual UI)
function toDisplay(item: RawNews, district: string, idx: number): DisplayArticle {
  return {
    id: `${district}-${item.id}`,
    districtSlug: district,
    originalId:   item.id,
    title_en:   item.title,
    title_ta:   item.title_ta  || item.title,   // use AI-generated Tamil if present
    summary_en: item.summary,
    summary_ta: item.summary_ta || item.summary, // use AI-generated Tamil if present
    district: DISTRICT_LABEL[district] ?? district,
    category: item.category,
    date: item.date,
    image: item.image ?? DEFAULT_IMAGES[idx % DEFAULT_IMAGES.length],
  };
}

// Robust date sort (newest first). Handles "May 2, 2026" and ISO style strings.
function sortByDateDesc(a: DisplayArticle, b: DisplayArticle) {
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (isNaN(ta) && isNaN(tb)) return 0;
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return tb - ta;
}

// ---------- Build aggregated feed from JSON (runs once at module load) ----------
const sources: Array<[string, RawNews[]]> = [
  ["coimbatore", coimbatoreNews as RawNews[]],
  ["erode", erodeNews as RawNews[]],
  ["tiruppur", tiruppurNews as RawNews[]],
  ["salem", salemNews as RawNews[]],
  ["namakkal", namakkalNews as RawNews[]],
  ["nilgiris", nilgirisNews as RawNews[]],
  ["karur", karurNews as RawNews[]],
  ["dharmapuri", dharmapuriNews as RawNews[]],
];

// Build aggregated feed, deduplicating cross-district articles by normalised title
// (the auto-fetch script already deduplicates at write time, but this guards against
// older JSON files that may still share the same regional story).
const featuredIds = new Set<string>();
const allNews: DisplayArticle[] = [];
{
  const seenTitles = new Set<string>();
  for (const [district, items] of sources) {
    let localIdx = 0;
    for (const it of items as RawNews[]) {
      const key = it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      const article = toDisplay(it, district, localIdx++);
      if (it.featured) featuredIds.add(article.id);
      allNews.push(article);
    }
  }
}

const sortedNews = [...allNews].sort(sortByDateDesc);

// Hero: pulled from main.json (region-wide top story for the day).
const mainHero = (mainNews as any).hero;
const heroNews: DisplayArticle = {
  id: `main-${mainHero.id}`,
  title_en: mainHero.title_en,
  title_ta: mainHero.title_ta,
  summary_en: mainHero.summary_en,
  summary_ta: mainHero.summary_ta,
  district: "Kongu Region",
  category: mainHero.category,
  date: mainHero.date ?? "May 14, 2026",
  image: mainHero.image ?? "/news/2026-05-14/hero-flyover-closure.jpg",
};

const remaining = sortedNews.filter((n) => n.id !== heroNews.id);
const sideNews = remaining.slice(0, 5);
const trendingNews = remaining.slice(5, 9);
const latestNews = remaining.slice(9, 15);

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Breaking News */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-4 pb-2">
          <div className="flex items-center gap-2 animate-fade-up">
            <span className="flex items-center gap-1 bg-destructive text-destructive-foreground px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse">
              <Zap size={10} /> {t("Breaking", "முக்கிய")}
            </span>
            <p className="text-sm font-semibold truncate">{t(heroNews.title_en, heroNews.title_ta)}</p>
          </div>
        </div>

        {/* Hero Grid — dense Google Trends style */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 py-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main hero */}
            <div className="lg:col-span-8 animate-fade-up">
              <div className="hero-card aspect-[16/9] relative group cursor-pointer">
                <img src={heroNews.image} alt={t(heroNews.title_en, heroNews.title_ta)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 md:p-7">
                  <div className="flex gap-2 mb-2">
                    <span className="district-tag bg-white/20 text-white backdrop-blur-sm">{heroNews.district}</span>
                    <span className="category-tag bg-white/20 text-white backdrop-blur-sm">{heroNews.category}</span>
                  </div>
                  <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight mb-2 story-link">
                    {t(heroNews.title_en, heroNews.title_ta)}
                  </h1>
                  <p className="text-sm text-white/80 line-clamp-2 max-w-lg">{t(heroNews.summary_en, heroNews.summary_ta)}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/60">
                    <Clock size={11} /> <span>{heroNews.date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side stories — compact list */}
            <div className="lg:col-span-4 flex flex-col gap-2">
              {sideNews.map((article, i) => (
                <Link
                  key={article.id}
                  to={`/${article.districtSlug}/article/${article.originalId}`}
                  className="news-card-v2 group animate-fade-up block"
                  style={{ animationDelay: `${(i + 1) * 0.06}s` }}
                >
                  <div className="flex gap-2.5 p-2.5">
                    {article.image && (
                      <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={article.image}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={e => { (e.target as HTMLImageElement).src = DEFAULT_IMAGES[i % DEFAULT_IMAGES.length]; }}
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-center min-w-0">
                      <span className="district-tag w-fit mb-0.5 text-[8px]">{article.district}</span>
                      <h3 className="font-display text-[11px] font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {t(article.title_en, article.title_ta)}
                      </h3>
                      <span className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock size={8} /> {article.date}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trending — horizontal strip */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-2 mb-3 animate-fade-up">
            <Flame size={16} className="text-primary" />
            <h2 className="section-heading text-lg">{t("Trending Now", "இப்போது பிரபலமானவை")}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trendingNews.map((article, i) => (
              <Link
                key={`trending-${article.id}`}
                to={`/${article.districtSlug}/article/${article.originalId}`}
                className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-colors animate-fade-up group"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <span className="font-display text-2xl font-black text-primary/20 leading-none mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-display text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{t(article.title_en, article.title_ta)}</h3>
                  <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Clock size={9} /> {article.date}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 pb-4">
          <Link to="/candidates-2026" className="flex items-center justify-between bg-gradient-to-r from-primary to-secondary text-white rounded-xl px-5 py-4 group hover:shadow-lg transition-all duration-500 animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-float">🗳</span>
              <div>
                <div className="font-display text-base md:text-lg font-bold">{t("Election 2026 — Full Candidate List", "தேர்தல் 2026 — முழு வேட்பாளர் பட்டியல்")}</div>
                <div className="font-tamil text-[11px] opacity-80">{t("234 constituencies · All major parties", "234 தொகுதிகள் · அனைத்து முக்கிய கட்சிகள்")}</div>
              </div>
            </div>
            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform duration-300" />
          </Link>
        </section>

        {/* Latest News Grid — high density */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="animate-fade-up">
              <h2 className="section-heading text-lg">{t("Latest News", "சமீபத்திய செய்திகள்")}</h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
              <TrendingUp size={13} />
              <span>{t("View All", "அனைத்தும்")}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latestNews.map((article, i) => (
              <Link
                key={article.id}
                to={`/${article.districtSlug}/article/${article.originalId}`}
                className="news-card-v2 animate-fade-up group block"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {article.image && (
                  <div className="aspect-[16/9] overflow-hidden relative">
                    <img
                      src={article.image}
                      alt={t(article.title_en, article.title_ta)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={e => { (e.target as HTMLImageElement).src = DEFAULT_IMAGES[i % DEFAULT_IMAGES.length]; }}
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="district-tag bg-white/90 backdrop-blur-sm text-[8px]">{article.district}</span>
                      <span className="category-tag bg-white/90 backdrop-blur-sm text-[8px]">{article.category}</span>
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-display text-sm font-bold leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">{t(article.title_en, article.title_ta)}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{t(article.summary_en, article.summary_ta)}</p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock size={9} /> {article.date}</span>
                    <span className="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{t("Read more →", "மேலும் →")}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Districts grid — compact */}
        <section className="bg-muted/40 py-8 px-4 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <h2 className="section-heading text-lg mb-5 animate-fade-up">{t("Explore Districts", "மாவட்டங்களை ஆராயுங்கள்")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { path: "/erode", label: "Erode", emoji: "🌾", color: "from-amber-500 to-orange-600" },
                { path: "/coimbatore", label: "Coimbatore", emoji: "🏭", color: "from-blue-500 to-indigo-600" },
                { path: "/tiruppur", label: "Tiruppur", emoji: "👕", color: "from-teal-500 to-emerald-600" },
                { path: "/salem", label: "Salem", emoji: "⚙️", color: "from-gray-600 to-slate-700" },
                { path: "/namakkal", label: "Namakkal", emoji: "🥚", color: "from-yellow-500 to-amber-600" },
                { path: "/nilgiris", label: "Nilgiris", emoji: "🍃", color: "from-green-500 to-emerald-700" },
                { path: "/karur", label: "Karur", emoji: "🧵", color: "from-purple-500 to-violet-600" },
                { path: "/dharmapuri", label: "Dharmapuri", emoji: "🥭", color: "from-orange-500 to-red-600" },
              ].map((d, i) => (
                <Link key={d.path} to={d.path} className="animate-scale-in group relative overflow-hidden rounded-xl p-4 text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-lg" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${d.color} opacity-90`} />
                  <div className="relative z-10">
                    <div className="text-2xl mb-1 group-hover:animate-float">{d.emoji}</div>
                    <div className="font-display text-sm font-bold">{d.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
