import { useParams, Link, useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";
import { districtNews, districtMeta, type DistrictNewsItem } from "@/data/districtNews";
import { Calendar, ArrowLeft, ExternalLink, MapPin, Tag } from "lucide-react";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=1200&q=80";

const CATEGORY_COLOURS: Record<string, string> = {
  Politics:       "bg-violet-100 text-violet-800",
  Business:       "bg-amber-100  text-amber-800",
  Education:      "bg-blue-100   text-blue-800",
  Health:         "bg-green-100  text-green-800",
  Crime:          "bg-red-100    text-red-800",
  Weather:        "bg-cyan-100   text-cyan-800",
  Infrastructure: "bg-slate-100  text-slate-700",
  Agriculture:    "bg-lime-100   text-lime-800",
  Sports:         "bg-indigo-100 text-indigo-800",
  Accident:       "bg-orange-100 text-orange-800",
  Wildlife:       "bg-teal-100   text-teal-800",
  Development:    "bg-purple-100 text-purple-800",
  Governance:     "bg-gray-100   text-gray-700",
  Policy:         "bg-stone-100  text-stone-700",
  Election:       "bg-sky-100    text-sky-800",
  Campaign:       "bg-orange-100 text-orange-800",
  Awareness:      "bg-emerald-100 text-emerald-800",
  Enforcement:    "bg-rose-100   text-rose-800",
  News:           "bg-slate-100  text-slate-600",
};

export default function ArticlePage() {
  const { district, id } = useParams<{ district: string; id: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const articles = (districtNews[district ?? ""] || []) as DistrictNewsItem[];
  const article  = articles.find(a => a.id === id);
  const meta     = districtMeta[district ?? ""];

  // Not found fallback
  if (!article || !meta) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <SiteHeader />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500 px-4">
          <p className="text-xl font-semibold">{t("Article not found", "கட்டுரை கிடைக்கவில்லை")}</p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sky-600 hover:text-sky-800 font-semibold"
          >
            <ArrowLeft size={16} /> {t("Go back", "திரும்பு")}
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const title   = t(article.title,   article.title_ta   || article.title);
  const summary = t(article.summary, article.summary_ta || article.summary);
  const img     = article.image?.startsWith("http") ? article.image : FALLBACK_IMAGE;
  const catClass = CATEGORY_COLOURS[article.category] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero image */}
        <div className="w-full aspect-[21/9] max-h-[480px] overflow-hidden bg-slate-200">
          <img
            src={img}
            alt={title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
          />
        </div>

        {/* Article body */}
        <article className="max-w-[820px] mx-auto px-4 md:px-6 py-10">
          {/* Back link */}
          <Link
            to={`/${district}`}
            className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800 font-semibold mb-6 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            {t(`Back to ${meta.name}`, `${meta.name} திரும்பு`)}
          </Link>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-3 mb-5">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${catClass}`}>
              <Tag size={11} /> {article.category}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={13} /> {meta.name}
            </span>
            <time className="inline-flex items-center gap-1 text-sm text-slate-500">
              <Calendar size={13} /> {article.date}
            </time>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-6">
            {title}
          </h1>

          {/* Divider */}
          <div className="w-16 h-1 bg-sky-500 rounded mb-6" />

          {/* Summary / body */}
          <div className="prose prose-lg prose-slate max-w-none">
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </div>

          {/* AI note */}
          <p className="mt-6 text-xs text-slate-400 italic">
            {t(
              "This article was rewritten by AI based on regional news sources for The Kongu Times.",
              "இந்தக் கட்டுரை கொங்கு டைம்ஸுக்காக பிராந்திய செய்தி மூலங்களின் அடிப்படையில் AI ஆல் மறுதயாரிக்கப்பட்டது."
            )}
          </p>

          {/* Source link */}
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              <ExternalLink size={15} />
              {t("Read original article", "மூல கட்டுரை படிக்க")}
            </a>
          )}

          {/* Related articles */}
          <RelatedArticles articles={articles} currentId={article.id} district={district!} />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

// ── Related articles strip ────────────────────────────────────────────────────
function RelatedArticles({
  articles,
  currentId,
  district,
}: {
  articles: DistrictNewsItem[];
  currentId: string;
  district: string;
}) {
  const { t } = useLanguage();
  const related = articles.filter(a => a.id !== currentId).slice(0, 3);
  if (!related.length) return null;

  return (
    <section className="mt-12 pt-8 border-t border-slate-200">
      <h2 className="font-display text-xl font-black text-slate-900 mb-5">
        {t("More from this district", "இந்த மாவட்டத்திலிருந்து மேலும்")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {related.map((a, i) => {
          const img = a.image?.startsWith("http")
            ? a.image
            : `https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=400&q=70`;
          return (
            <Link
              key={a.id}
              to={`/${district}/article/${a.id}`}
              className="group block rounded-xl overflow-hidden border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all"
            >
              <div className="aspect-video overflow-hidden bg-slate-100">
                <img
                  src={img}
                  alt={a.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={e => { (e.target as HTMLImageElement).src = img; }}
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-sky-700 transition-colors">
                  {t(a.title, a.title_ta || a.title)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">{a.date}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
