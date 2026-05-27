import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";
import { districtNews, districtMeta, type DistrictNewsItem } from "@/data/districtNews";
import { Calendar, ArrowRight, Newspaper, ExternalLink } from "lucide-react";

// ── Category badge colours (falls back to a neutral style) ───────────────────
const CATEGORY_COLOURS: Record<string, string> = {
  Election:       "bg-sky-50   text-sky-700   border-sky-200",
  Campaign:       "bg-orange-50 text-orange-700 border-orange-200",
  Awareness:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Enforcement:    "bg-rose-50  text-rose-700   border-rose-200",
  Politics:       "bg-violet-50 text-violet-700 border-violet-200",
  Business:       "bg-amber-50  text-amber-700  border-amber-200",
  Education:      "bg-blue-50   text-blue-700   border-blue-200",
  Health:         "bg-green-50  text-green-700  border-green-200",
  Crime:          "bg-red-50    text-red-700    border-red-200",
  Weather:        "bg-cyan-50   text-cyan-700   border-cyan-200",
  Infrastructure: "bg-slate-50  text-slate-700  border-slate-200",
  Agriculture:    "bg-lime-50   text-lime-700   border-lime-200",
  Sports:         "bg-indigo-50 text-indigo-700 border-indigo-200",
  Accident:       "bg-orange-50 text-orange-700 border-orange-200",
  Wildlife:       "bg-teal-50   text-teal-700   border-teal-200",
  Development:    "bg-purple-50 text-purple-700 border-purple-200",
  Governance:     "bg-gray-50   text-gray-700   border-gray-200",
  Policy:         "bg-stone-50  text-stone-700  border-stone-200",
  News:           "bg-slate-50  text-slate-600  border-slate-200",
};

function categoryClass(cat: string) {
  return CATEGORY_COLOURS[cat] ?? "bg-slate-50 text-slate-600 border-slate-200";
}

// ── Default fallback images (used when article has no image) ─────────────────
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=600&q=80",
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80",
  "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80",
];
function fallback(idx: number) {
  return FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DistrictPage({ district }: { district: string }) {
  const { t } = useLanguage();
  const meta    = districtMeta[district];
  const allNews = (districtNews[district] || []) as DistrictNewsItem[];

  // Derive categories dynamically from data so new AI categories appear automatically
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allNews.map(n => n.category))).sort();
    return ["All", ...cats];
  }, [allNews]);

  const [activeCategory, setActiveCategory] = useState("All");

  const featured = allNews.find(n => n.featured);
  const filteredNews = useMemo(() => {
    const rest = allNews.filter(n => !n.featured);
    return activeCategory === "All" ? rest : rest.filter(n => n.category === activeCategory);
  }, [allNews, activeCategory]);

  if (!meta) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center text-slate-500">District not found</main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* Page title */}
        <section className="bg-gradient-to-b from-sky-50 to-white border-b border-slate-200">
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-8 md:py-10">
            <h1 className="font-display text-4xl md:text-5xl font-black text-slate-900 tracking-tight animate-fade-up">
              {meta.name}
            </h1>
            <p className="text-sm md:text-base text-slate-600 mt-2">{meta.tagline}</p>
          </div>
        </section>

        {/* Featured headline */}
        {featured && (
          <section className="max-w-[1280px] mx-auto px-4 md:px-6 pt-8">
            <FeaturedCard item={featured} district={district} />
          </section>
        )}

        {/* Category filters */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 pt-8 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-3">
            <h2 className="font-display text-xl md:text-2xl font-black text-slate-900">
              {t("Latest News", "சமீபத்திய செய்திகள்")}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    activeCategory === cat
                      ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* News grid */}
        <section className="max-w-[1280px] mx-auto px-4 md:px-6 pb-16">
          {filteredNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredNews.map((item, i) => (
                <NewsArticleCard key={item.id} item={item} district={district} idx={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <Newspaper size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-display text-lg font-bold">
                {t("No articles in this category", "இந்த பிரிவில் செய்திகள் இல்லை")}
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// ── Featured card (hero) ──────────────────────────────────────────────────────
function FeaturedCard({ item, district }: { item: DistrictNewsItem; district: string }) {
  const { t } = useLanguage();
  const title   = t(item.title, item.title_ta || item.title);
  const summary = t(item.summary, item.summary_ta || item.summary);
  const img     = item.image?.startsWith("http") ? item.image : FALLBACK_IMAGES[0];

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white shadow-lg hover:shadow-xl transition-shadow animate-fade-up">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
      <div className="relative grid md:grid-cols-2 gap-0">
        {/* Image */}
        <div className="md:order-2 overflow-hidden bg-slate-900/20">
          <img
            src={img}
            alt={title}
            className="w-full h-full max-h-[420px] object-cover group-hover:scale-105 transition-transform duration-700"
            onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[0]; }}
          />
        </div>

        {/* Text */}
        <div className="p-6 md:p-10 md:order-1 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
              ★ {t("Featured", "சிறப்பு")}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border bg-white/95 ${categoryClass(item.category)}`}>
              {item.category}
            </span>
          </div>

          <h2 className="font-display text-2xl md:text-4xl font-black leading-tight mb-3 max-w-3xl">
            {title}
          </h2>
          <p className="text-white/85 text-sm md:text-base max-w-2xl leading-relaxed mb-5">
            {summary}
          </p>

          <div className="flex items-center gap-4 text-xs text-white/70 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} /> {item.date}
            </span>
            {/* Article detail link */}
            <Link
              to={`/${district}/article/${item.id}`}
              className="flex items-center gap-1.5 font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-all"
            >
              {t("Read more", "மேலும் படிக்க")} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Article grid card ─────────────────────────────────────────────────────────
function NewsArticleCard({ item, district, idx }: { item: DistrictNewsItem; district: string; idx: number }) {
  const { t } = useLanguage();
  const title   = t(item.title, item.title_ta || item.title);
  const summary = t(item.summary, item.summary_ta || item.summary);
  const img     = item.image?.startsWith("http") ? item.image : fallback(idx);

  return (
    <article
      className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-sky-300 hover:shadow-md transition-all animate-fade-up flex flex-col"
      style={{ animationDelay: `${idx * 0.05}s` }}
    >
      {/* Article image */}
      <Link to={`/${district}/article/${item.id}`} className="block overflow-hidden aspect-[16/9] bg-slate-100 flex-shrink-0">
        <img
          src={img}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { (e.target as HTMLImageElement).src = fallback(idx); }}
        />
      </Link>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${categoryClass(item.category)}`}>
            {item.category}
          </span>
          <time className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Calendar size={10} /> {item.date}
          </time>
        </div>

        <Link to={`/${district}/article/${item.id}`}>
          <h3 className="font-display text-base md:text-lg font-bold text-slate-900 leading-snug mb-2 group-hover:text-sky-700 transition-colors line-clamp-2">
            {title}
          </h3>
        </Link>

        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 flex-1">{summary}</p>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <Link
            to={`/${district}/article/${item.id}`}
            className="font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition-colors"
          >
            {t("Read article", "கட்டுரை படிக்க")} <ArrowRight size={11} />
          </Link>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
              title={t("Open source article", "மூல கட்டுரை திற")}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
