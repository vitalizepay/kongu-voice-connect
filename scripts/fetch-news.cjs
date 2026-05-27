'use strict';

// Allow self-signed / corporate proxy certs when LOCAL_DEV=1 is set.
// Never set in production (GitHub Actions has valid certs).
if (process.env.LOCAL_DEV === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

// ─── Configuration ─────────────────────────────────────────────────────────

const NEWS_DIR = path.join(__dirname, '..', 'src', 'data', 'news');

const DISTRICTS = [
  { slug: 'erode',      query: 'Erode district Tamil Nadu',           name: 'Erode' },
  { slug: 'coimbatore', query: 'Coimbatore Tamil Nadu news',          name: 'Coimbatore' },
  { slug: 'tiruppur',   query: 'Tiruppur Tamil Nadu news',            name: 'Tiruppur' },
  { slug: 'salem',      query: 'Salem district Tamil Nadu',           name: 'Salem' },
  { slug: 'namakkal',   query: 'Namakkal Tamil Nadu news',            name: 'Namakkal' },
  { slug: 'nilgiris',   query: 'Nilgiris Ooty Tamil Nadu',            name: 'Nilgiris' },
  { slug: 'karur',      query: 'Karur Tamil Nadu news',               name: 'Karur' },
  { slug: 'dharmapuri', query: 'Dharmapuri Tamil Nadu news',          name: 'Dharmapuri' },
];

const KONGU_QUERY = 'Kongu region Tamil Nadu news';
const MAX_ARTICLES_PER_DISTRICT = 6;
const MAX_TRENDING = 8;
const KEEP_DAYS = 7;
const AI_CALL_DELAY_MS = 1200;

const CATEGORY_IMAGES = {
  Weather:        'https://images.unsplash.com/photo-1504608524841-42584120d693?w=800&q=80',
  Politics:       'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
  Business:       'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
  Education:      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
  Health:         'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
  Crime:          'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
  Infrastructure: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  Development:    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80',
  Governance:     'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80',
  Sports:         'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
  Agriculture:    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80',
  Wildlife:       'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&q=80',
  Accident:       'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80',
  Policy:         'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
  News:           'https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=800&q=80',
};

// ─── RSS Parsing ────────────────────────────────────────────────────────────

function buildParser() {
  return new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    customFields: {
      item: [
        ['media:content',   'mediaContent',   { keepArray: false }],
        ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
        ['enclosure',       'enclosure'],
      ],
    },
  });
}

// Extracts the best available image from an RSS item WITHOUT making HTTP requests.
// Returns null when no inline image is found (Google News RSS has none).
function extractRSSImage(item) {
  if (item.mediaContent?.$.url)   return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url)        return item.enclosure.url;
  // Scan description / content HTML for any <img src="...">
  const html = item.content || item.contentSnippet || item.description || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m?.[1]?.startsWith('http')) return m[1];
  return null;
}

// Strips " - Source Name" suffix that Google News appends to every RSS title.
// Only strips when the last segment (after " - ") is ≤ 5 words.
function cleanTitle(title) {
  const parts = title.split(' - ');
  if (parts.length < 2) return title.slice(0, 100);
  const lastPart = parts[parts.length - 1].trim();
  if (lastPart.split(/\s+/).length <= 5) {
    return parts.slice(0, -1).join(' - ').trim().slice(0, 100);
  }
  return title.slice(0, 100);
}

async function fetchRSS(query) {
  const parser = buildParser();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const feed = await parser.parseURL(url);

  return feed.items
    .filter(item => item.title && (item.link || item.guid))
    .map(item => ({
      title:       cleanTitle((item.title || '').trim()),
      // contentSnippet is already HTML-stripped by rss-parser; for Google News
      // this equals "Title   Source" — AI is asked to expand it into a real summary.
      description: (item.contentSnippet || item.title || '').trim().slice(0, 400),
      link:        item.link || item.guid || '',
      pubDate:     item.isoDate || item.pubDate || '',
      source:      (item.source?.name || '').trim(),
      image:       extractRSSImage(item), // null for Google News
    }));
}

// ─── HTTP / Image ───────────────────────────────────────────────────────────

// Fetches the og:image (or twitter:image) from the article's own page.
// Returns null on any error, timeout, or if Google didn't redirect us to the real article.
async function fetchArticleImage(url, timeoutMs = 5000) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    // If the redirect kept us on Google's own domain, we didn't reach the real article
    try {
      const finalHost = new URL(response.url).hostname;
      if (finalHost.endsWith('google.com') || finalHost.endsWith('google.co.in')) return null;
    } catch { /* invalid URL — continue */ }

    const html = (await response.text()).slice(0, 15360); // 15 KB covers any <head>

    // og:image (two attribute orderings)
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (og?.[1]?.startsWith('http')) return og[1];

    // twitter:image fallback
    const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (tw?.[1]?.startsWith('http')) return tw[1];

    return null;
  } catch {
    return null;
  }
}

// ─── AI Provider ────────────────────────────────────────────────────────────

function detectProvider() {
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (openaiKey.startsWith('sk-')) return { provider: 'openai', apiKey: openaiKey };
  if (geminiKey.length > 0)        return { provider: 'gemini', apiKey: geminiKey };
  return { provider: null, apiKey: null };
}

async function callOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 512,
        temperature: 0.7,
      },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function buildFallbackArticle(item) {
  // Google News description ≈ "Title   Source" — not a useful summary.
  // Just use the cleaned title and let the UI show it without a summary.
  return { title: item.title, title_ta: '', summary: item.title, summary_ta: '', category: 'News' };
}

const REWRITE_PROMPT = (title) =>
  `You are a news editor for The Kongu Times, a Tamil Nadu regional news portal.

A news article titled below has been published. Write an original news piece based on what you know about this topic.

Title: ${title}

Return ONLY a JSON object with exactly these fields:
{
  "title": "Rewritten English headline (under 100 characters, factual, no source name)",
  "title_ta": "Tamil translation of the headline in Tamil script",
  "summary": "2-3 sentence English summary based on the topic, informative and neutral",
  "summary_ta": "Tamil translation of the summary in Tamil script",
  "category": "One of: Education, Business, Politics, Governance, Weather, Crime, Health, Sports, Infrastructure, Development, Accident, Wildlife, Policy, Agriculture, News"
}`;

async function rewriteArticle(item, provider, apiKey) {
  if (!provider) return buildFallbackArticle(item);
  try {
    const rawJson = provider === 'openai'
      ? await callOpenAI(REWRITE_PROMPT(item.title), apiKey)
      : await callGemini(REWRITE_PROMPT(item.title), apiKey);
    const parsed = JSON.parse(rawJson);
    if (!parsed.title || !parsed.summary) throw new Error('Missing required fields');
    return parsed;
  } catch (err) {
    console.warn(`  AI rewrite failed (${err.message}), using fallback`);
    return buildFallbackArticle(item);
  }
}

// ─── Date / ID / File utilities ──────────────────────────────────────────────

function formatDate(dateStr) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return formatDate(null);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

function isWithinDays(dateStr, days) {
  try {
    const articleDate = new Date(dateStr);
    if (isNaN(articleDate.getTime())) return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return articleDate >= cutoff;
  } catch {
    return true;
  }
}

function generateId(slug, index, pubDate) {
  const d = pubDate ? new Date(pubDate) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const mon = safe.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  return `${slug.slice(0, 3)}-${mon}${safe.getDate()}-${String(index + 1).padStart(3, '0')}`;
}

function normalizeTitle(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

function mergeArticles(existing, incoming, maxCount) {
  const existingKeys = new Set(existing.map(a => normalizeTitle(a.title)));
  const fresh  = incoming.filter(a => !existingKeys.has(normalizeTitle(a.title)));
  const kept   = existing.filter(a => isWithinDays(a.date, KEEP_DAYS));
  let merged   = [...fresh, ...kept].slice(0, maxCount);

  // Safety net: never leave a district empty.
  // If pruning removed everything and there are no fresh replacements (e.g. a quiet
  // district where the RSS only returns the same old articles), fall back to the
  // incoming articles so the page always has content.
  if (merged.length === 0 && incoming.length > 0) {
    merged = incoming.slice(0, maxCount);
  }

  return merged.map((a, i) => ({ ...a, featured: i === 0 }));
}

function readNewsFile(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(NEWS_DIR, `${slug}.json`), 'utf8'));
  } catch { return []; }
}

function writeNewsFile(slug, articles) {
  fs.writeFileSync(path.join(NEWS_DIR, `${slug}.json`), JSON.stringify(articles, null, 2) + '\n', 'utf8');
}

// ─── Orchestration ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function processDistrict(district, providerInfo, globalSeenTitles) {
  console.log(`\nProcessing ${district.name}...`);
  let rssItems;
  try {
    rssItems = await fetchRSS(district.query);
  } catch (err) {
    console.error(`  RSS fetch failed: ${err.message}`);
    return;
  }

  // ── Fix 1: Discard RSS articles older than KEEP_DAYS right away.
  //    No point rewriting or storing news that will be pruned immediately.
  const recentItems = rssItems.filter(item => isWithinDays(item.pubDate, KEEP_DAYS));
  const skippedOld  = rssItems.length - recentItems.length;
  if (skippedOld > 0) console.log(`  Skipped ${skippedOld} articles older than ${KEEP_DAYS} days`);

  // ── Fix 2: Cross-district deduplication (unchanged)
  const uniqueItems = recentItems.filter(item => {
    const key = normalizeTitle(item.title);
    if (globalSeenTitles.has(key)) return false;
    globalSeenTitles.add(key);
    return true;
  }).slice(0, MAX_ARTICLES_PER_DISTRICT);

  if (!uniqueItems.length) {
    console.log('  No unique recent items — skipping');
    return;
  }

  // ── Fix 3: Load existing JSON once; skip AI for articles already stored.
  //    Only truly NEW articles (not yet in JSON) get an AI rewrite call.
  const existing     = readNewsFile(district.slug);
  const existingKeys = new Set(existing.map(a => normalizeTitle(a.title)));

  const newArticles = [];
  let   aiCallCount = 0;

  for (let i = 0; i < uniqueItems.length; i++) {
    const item = uniqueItems[i];
    const key  = normalizeTitle(item.title);

    if (existingKeys.has(key)) {
      console.log(`  [skip] already stored: ${item.title.slice(0, 70)}`);
      continue; // no AI call, no image fetch — already in JSON
    }

    console.log(`  [new]  ${item.title.slice(0, 70)}`);

    // RSS image + AI rewrite run in parallel (only for genuinely new articles)
    const [rewritten, rssImage] = await Promise.all([
      rewriteArticle(item, providerInfo.provider, providerInfo.apiKey),
      item.image ? Promise.resolve(item.image) : fetchArticleImage(item.link),
    ]);

    const category = rewritten.category || 'News';
    newArticles.push({
      id:         generateId(district.slug, i, item.pubDate),
      category,
      featured:   false, // mergeArticles sets featured on the first item
      image:      rssImage || CATEGORY_IMAGES[category] || CATEGORY_IMAGES.News,
      title:      rewritten.title,
      title_ta:   rewritten.title_ta || '',
      summary:    rewritten.summary,
      summary_ta: rewritten.summary_ta || '',
      date:       formatDate(item.pubDate),
    });

    aiCallCount++;
    // Only rate-limit when AI is active
    if (providerInfo.provider && i < uniqueItems.length - 1) await sleep(AI_CALL_DELAY_MS);
  }

  if (newArticles.length === 0) {
    console.log(`  All items already stored — no changes written`);
    return;
  }

  console.log(`  Rewrote ${aiCallCount} new article(s), skipped ${uniqueItems.length - aiCallCount} existing`);
  const merged = mergeArticles(existing, newArticles, MAX_ARTICLES_PER_DISTRICT * 2);
  writeNewsFile(district.slug, merged);
  console.log(`  Saved ${merged.length} articles → ${district.slug}.json`);
}

async function processMainJSON(providerInfo) {
  console.log('\nProcessing main.json (trending)...');
  let rssItems;
  try {
    rssItems = await fetchRSS(KONGU_QUERY);
  } catch (err) {
    console.error(`  RSS fetch failed: ${err.message}`);
    return;
  }

  // Fix 1: Only process recent articles
  const recentItems = rssItems.filter(item => isWithinDays(item.pubDate, KEEP_DAYS));
  const topItems    = recentItems.slice(0, MAX_TRENDING);

  // Fix 2: Load existing trending to skip already-stored items
  const mainPath = path.join(NEWS_DIR, 'main.json');
  let mainData = {};
  try { mainData = JSON.parse(fs.readFileSync(mainPath, 'utf8')); } catch {}
  const existingTrending  = mainData.trending || [];
  const existingTrendKeys = new Set(existingTrending.map(a => normalizeTitle(a.title_en)));

  const trending = [...existingTrending.filter(a => isWithinDays(a.date, KEEP_DAYS))];

  for (let i = 0; i < topItems.length; i++) {
    const item = topItems[i];
    const key  = normalizeTitle(item.title);

    if (existingTrendKeys.has(key)) {
      console.log(`  [skip] already stored: ${item.title.slice(0, 70)}`);
      continue;
    }

    console.log(`  [new]  ${item.title.slice(0, 70)}`);

    const [rewritten, rssImage] = await Promise.all([
      rewriteArticle(item, providerInfo.provider, providerInfo.apiKey),
      item.image ? Promise.resolve(item.image) : fetchArticleImage(item.link),
    ]);
    const cat = rewritten.category || 'News';

    trending.unshift({                          // newest at the front
      id:         `main-trd-${String(i + 1).padStart(3, '0')}`,
      title_en:   rewritten.title,
      title_ta:   rewritten.title_ta || '',
      summary_en: rewritten.summary,
      summary_ta: rewritten.summary_ta || '',
      district:   'Region',
      category:   cat,
      date:       formatDate(item.pubDate),
      image:      rssImage || CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.News,
    });

    // Only rate-limit when AI is active
    if (providerInfo.provider && i < topItems.length - 1) await sleep(AI_CALL_DELAY_MS);
  }

  // Always keep hero fresh — promote top trending article to hero slot.
  // This ensures the hero image is always a valid remote URL, never a broken local path.
  if (trending.length > 0) {
    const top = trending[0];
    mainData.hero = {
      id:         'main-hero-auto',
      title_en:   top.title_en,
      title_ta:   top.title_ta,
      summary_en: top.summary_en,
      summary_ta: top.summary_ta,
      category:   top.category,
      date:       top.date,
      image:      top.image,
    };
  }

  mainData.trending = trending.slice(0, MAX_TRENDING); // cap at max
  mainData.updated  = new Date().toISOString().split('T')[0];
  fs.writeFileSync(mainPath, JSON.stringify(mainData, null, 2) + '\n', 'utf8');
  console.log(`  Saved ${mainData.trending.length} trending items → main.json`);
}

async function main() {
  console.log('=== Kongu Times — Automated News Fetcher ===');
  console.log(`Time: ${new Date().toISOString()}`);
  const providerInfo = detectProvider();
  console.log(`AI Provider: ${providerInfo.provider ?? 'none (fallback mode)'}`);

  const globalSeenTitles = new Set();
  for (const district of DISTRICTS) {
    await processDistrict(district, providerInfo, globalSeenTitles);
  }
  await processMainJSON(providerInfo);
  console.log('\n=== Done ===');
}

// ─── Exports (used by tests) ─────────────────────────────────────────────────
module.exports = {
  extractRSSImage,
  cleanTitle,
  fetchRSS,
  fetchArticleImage,
  detectProvider,
  formatDate,
  generateId,
  isWithinDays,
  mergeArticles,
  normalizeTitle,
  buildFallbackArticle,
  rewriteArticle,
  callOpenAI,
  callGemini,
  KEEP_DAYS,
  DISTRICTS,
  CATEGORY_IMAGES,
};

if (require.main === module) {
  main().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
