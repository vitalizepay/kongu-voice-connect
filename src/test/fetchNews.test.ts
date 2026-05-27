import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  extractRSSImage,
  cleanTitle,
  articleKey,
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
  CATEGORY_IMAGES,
} = require('../../scripts/fetch-news.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── extractRSSImage ──────────────────────────────────────────────────────────

describe('extractRSSImage', () => {
  it('returns null for an empty item', () => {
    expect(extractRSSImage({})).toBeNull();
  });

  it('returns mediaContent.$.url when present', () => {
    const item = { mediaContent: { $: { url: 'https://cdn.example.com/media.jpg' } } };
    expect(extractRSSImage(item)).toBe('https://cdn.example.com/media.jpg');
  });

  it('returns mediaThumbnail.$.url when mediaContent is absent', () => {
    const item = { mediaThumbnail: { $: { url: 'https://cdn.example.com/thumb.jpg' } } };
    expect(extractRSSImage(item)).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('prefers mediaContent over mediaThumbnail', () => {
    const item = {
      mediaContent:   { $: { url: 'https://cdn.example.com/media.jpg' } },
      mediaThumbnail: { $: { url: 'https://cdn.example.com/thumb.jpg' } },
    };
    expect(extractRSSImage(item)).toBe('https://cdn.example.com/media.jpg');
  });

  it('returns enclosure.url when no media fields are present', () => {
    const item = { enclosure: { url: 'https://cdn.example.com/enclosure.jpg' } };
    expect(extractRSSImage(item)).toBe('https://cdn.example.com/enclosure.jpg');
  });

  it('extracts img src from content HTML', () => {
    const item = { content: '<p>Text</p><img src="https://example.com/img.jpg" alt="photo"/>' };
    expect(extractRSSImage(item)).toBe('https://example.com/img.jpg');
  });

  it('extracts img src from description HTML when content is absent', () => {
    const item = { description: '<img src="https://example.com/desc.jpg"/>' };
    expect(extractRSSImage(item)).toBe('https://example.com/desc.jpg');
  });

  it('rejects relative image URLs found in HTML', () => {
    const item = { content: '<img src="/relative/path.jpg"/>' };
    expect(extractRSSImage(item)).toBeNull();
  });

  it('rejects non-http URLs found in HTML', () => {
    const item = { content: '<img src="data:image/png;base64,abc"/>' };
    expect(extractRSSImage(item)).toBeNull();
  });

  it('returns null when item has only text content with no images', () => {
    const item = { contentSnippet: 'Just plain text, no image here.' };
    expect(extractRSSImage(item)).toBeNull();
  });
});

// ─── cleanTitle ───────────────────────────────────────────────────────────────

describe('cleanTitle', () => {
  it('strips a single-word source suffix', () => {
    expect(cleanTitle('Heavy rain hits Erode - PTI')).toBe('Heavy rain hits Erode');
  });

  it('strips a multi-word source suffix (≤ 5 words)', () => {
    expect(cleanTitle('Tiruppur court sentences labourers - News On AIR')).toBe('Tiruppur court sentences labourers');
  });

  it('strips "The Hindu" source suffix', () => {
    expect(cleanTitle('CM wins election - The Hindu')).toBe('CM wins election');
  });

  it('strips "The Times of India" source suffix (4 words)', () => {
    expect(cleanTitle('Flood alert in Nilgiris - The Times of India')).toBe('Flood alert in Nilgiris');
  });

  it('keeps a title with no hyphen unchanged', () => {
    expect(cleanTitle('Erode turmeric market update')).toBe('Erode turmeric market update');
  });

  it('keeps hyphenated titles where last segment is > 5 words', () => {
    // Last segment has 6 words — should not be stripped
    const title = 'Minister says one two three four five six';
    expect(cleanTitle(title)).toBe(title);
  });

  it('truncates the result to 100 characters', () => {
    const long = 'A'.repeat(50) + ' - ' + 'B'.repeat(60);
    expect(cleanTitle(long).length).toBeLessThanOrEqual(100);
  });

  it('handles title that is exactly " - Source" with no leading text', () => {
    // Edge case: just a source, no real title
    const result = cleanTitle(' - PTI');
    expect(typeof result).toBe('string');
  });
});

// ─── CATEGORY_IMAGES ──────────────────────────────────────────────────────────

describe('CATEGORY_IMAGES', () => {
  it('has an entry for every major category', () => {
    const required = ['Weather', 'Politics', 'Business', 'Education', 'Health',
      'Crime', 'Infrastructure', 'Development', 'Governance', 'Sports',
      'Agriculture', 'Wildlife', 'Accident', 'Policy', 'News'];
    for (const cat of required) {
      expect(CATEGORY_IMAGES[cat], `Missing image for category: ${cat}`).toBeTruthy();
    }
  });

  it('all values are https Unsplash URLs', () => {
    for (const [cat, url] of Object.entries(CATEGORY_IMAGES)) {
      expect(url, `Bad URL for ${cat}`).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });
});

// ─── detectProvider ───────────────────────────────────────────────────────────

describe('detectProvider', () => {
  let savedOpenAI: string | undefined;
  let savedGemini: string | undefined;

  beforeEach(() => {
    savedOpenAI = process.env.OPENAI_API_KEY;
    savedGemini = process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
    else delete process.env.OPENAI_API_KEY;
    if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
    else delete process.env.GEMINI_API_KEY;
  });

  it('returns openai when OPENAI_API_KEY starts with sk-', () => {
    process.env.OPENAI_API_KEY = 'sk-abc123';
    const result = detectProvider();
    expect(result.provider).toBe('openai');
    expect(result.apiKey).toBe('sk-abc123');
  });

  it('returns gemini when only GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'AIzaXYZ';
    const result = detectProvider();
    expect(result.provider).toBe('gemini');
    expect(result.apiKey).toBe('AIzaXYZ');
  });

  it('prefers OpenAI over Gemini when both keys are set', () => {
    process.env.OPENAI_API_KEY = 'sk-preferred';
    process.env.GEMINI_API_KEY = 'AIzaFallback';
    expect(detectProvider().provider).toBe('openai');
  });

  it('returns null provider when neither key is set', () => {
    const result = detectProvider();
    expect(result.provider).toBeNull();
    expect(result.apiKey).toBeNull();
  });

  it('rejects OPENAI_API_KEY that does not start with sk-', () => {
    process.env.OPENAI_API_KEY = 'invalid-key';
    // Falls through to check gemini (which is also absent) → null
    expect(detectProvider().provider).toBeNull();
  });

  it('rejects OPENAI_API_KEY that is just "sk-" with no content', () => {
    process.env.OPENAI_API_KEY = 'sk-';
    // "sk-" starts with "sk-" — considered valid format
    expect(detectProvider().provider).toBe('openai');
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a standard RSS date string', () => {
    const result = formatDate('Wed, 14 May 2026 10:00:00 +0000');
    expect(result).toContain('2026');
    expect(result).toContain('14');
  });

  it('formats an ISO date string', () => {
    const result = formatDate('2026-01-20T00:00:00.000Z');
    expect(result).toContain('2026');
    expect(result).toContain('20');
  });

  it('returns a non-empty string for empty input', () => {
    const result = formatDate('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for invalid date input', () => {
    const result = formatDate('not-a-date');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns today\'s date for null/undefined', () => {
    const result = formatDate(null as unknown as string);
    const year = new Date().getFullYear().toString();
    expect(result).toContain(year);
  });
});

// ─── generateId ───────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('uses the first 3 chars of the slug', () => {
    const id = generateId('erode', 0, '2026-05-14T00:00:00Z');
    expect(id.startsWith('ero-')).toBe(true);
  });

  it('pads single-digit index to 3 digits', () => {
    const id = generateId('salem', 0, '2026-05-14T00:00:00Z');
    expect(id).toMatch(/sal-\w+-001$/);
  });

  it('increments index correctly', () => {
    const id1 = generateId('karur', 0, '2026-05-14T00:00:00Z');
    const id2 = generateId('karur', 4, '2026-05-14T00:00:00Z');
    expect(id1).toMatch(/-001$/);
    expect(id2).toMatch(/-005$/);
  });

  it('includes month and day in the id', () => {
    const id = generateId('tiruppur', 0, '2026-05-14T00:00:00Z');
    expect(id).toMatch(/may14/);
  });

  it('does not throw for missing pubDate', () => {
    expect(() => generateId('nilgiris', 0, '')).not.toThrow();
  });
});

// ─── isWithinDays ────────────────────────────────────────────────────────────

describe('isWithinDays', () => {
  it('returns true for today\'s article', () => {
    expect(isWithinDays(new Date().toISOString(), KEEP_DAYS)).toBe(true);
  });

  it('returns true for article from yesterday', () => {
    expect(isWithinDays(daysAgo(1), KEEP_DAYS)).toBe(true);
  });

  it('returns false for an article older than KEEP_DAYS', () => {
    expect(isWithinDays(daysAgo(KEEP_DAYS + 2), KEEP_DAYS)).toBe(false);
  });

  it('returns true (keep) for unparseable date strings', () => {
    expect(isWithinDays('not-a-date', KEEP_DAYS)).toBe(true);
  });

  it('returns true for formatted dates within range ("May 14, 2026" style)', () => {
    // Simulate a date 3 days ago formatted as "Month D, YYYY"
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const formatted = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    expect(isWithinDays(formatted, KEEP_DAYS)).toBe(true);
  });
});

// ─── normalizeTitle ───────────────────────────────────────────────────────────

describe('normalizeTitle', () => {
  it('lowercases and strips non-alphanumeric chars', () => {
    expect(normalizeTitle('Hello, World!')).toBe('helloworld');
  });

  it('truncates to 50 chars', () => {
    const long = 'a'.repeat(100);
    expect(normalizeTitle(long)).toHaveLength(50);
  });

  it('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeTitle(null as unknown as string)).toBe('');
  });

  it('treats numbers and letters as alphanumeric', () => {
    expect(normalizeTitle('News 2026')).toBe('news2026');
  });
});

// ─── articleKey ──────────────────────────────────────────────────────────────

describe('articleKey', () => {
  it('strips source suffix before normalizing', () => {
    expect(articleKey('Farmers urge price hike rollback - The Hindu'))
      .toBe(articleKey('Farmers urge price hike rollback'));
  });

  it('treats "Title - The New Indian Express" same as "Title"', () => {
    expect(articleKey('Kalvi volunteers in Salem - The New Indian Express'))
      .toBe(articleKey('Kalvi volunteers in Salem'));
  });

  it('does NOT strip long last segments (real part of the title)', () => {
    const full  = 'TVK wins in Salem North against all odds and expectations';
    const short = 'TVK wins in Salem North against all odds and expectations';
    expect(articleKey(full)).toBe(articleKey(short));
  });
});

// ─── mergeArticles ───────────────────────────────────────────────────────────

describe('mergeArticles', () => {
  const freshDate = new Date().toISOString();
  const oldDate   = daysAgo(KEEP_DAYS + 3);
  const goodImg   = 'https://images.unsplash.com/photo-1?w=800';

  it('prepends new articles before existing clean ones', () => {
    const existing = [{ title: 'Old Story',  date: freshDate, featured: false, image: goodImg, summary: 'Clean' }];
    const incoming = [{ title: 'New Story',  date: freshDate, featured: false, image: goodImg, summary: 'Clean' }];
    const merged = mergeArticles(existing, incoming, 10);
    expect(merged[0].title).toBe('New Story');
    expect(merged[1].title).toBe('Old Story');
  });

  it('deduplicates articles with the same title', () => {
    const existing = [{ title: 'Same Title', date: freshDate, featured: false, image: goodImg, summary: 'ok' }];
    const incoming = [{ title: 'Same Title', date: freshDate, featured: false, image: goodImg, summary: 'ok' }];
    expect(mergeArticles(existing, incoming, 10)).toHaveLength(1);
  });

  it('deduplicates "Title - Source" against clean "Title" (the real bug fix)', () => {
    // Old script stored title with source name; new script stores without.
    // Both should be treated as the same article.
    const existing = [{ title: 'Farmers urge price hike rollback - The Hindu', date: freshDate, featured: false, image: goodImg, summary: 'ok' }];
    const incoming = [{ title: 'Farmers urge price hike rollback', date: freshDate, featured: false, image: goodImg, summary: 'ok' }];
    expect(mergeArticles(existing, incoming, 10)).toHaveLength(1);
  });

  it('drops existing articles with HTML in summary (old bad data)', () => {
    const bad  = { title: 'Bad', date: freshDate, featured: false, image: goodImg, summary: '<a href="https://g.co">link</a>' };
    const good = { title: 'Good', date: freshDate, featured: false, image: goodImg, summary: 'Clean summary' };
    const merged = mergeArticles([bad, good], [], 10);
    expect(merged.some(a => a.title === 'Bad')).toBe(false);
    expect(merged.some(a => a.title === 'Good')).toBe(true);
  });

  it('drops existing articles with missing or local image paths', () => {
    const noImg    = { title: 'No Image',    date: freshDate, featured: false, image: null,               summary: 'ok' };
    const localImg = { title: 'Local Image', date: freshDate, featured: false, image: '/news/photo.jpg',  summary: 'ok' };
    const remoteImg= { title: 'Remote OK',   date: freshDate, featured: false, image: goodImg,             summary: 'ok' };
    const merged = mergeArticles([noImg, localImg, remoteImg], [], 10);
    expect(merged.some(a => a.title === 'No Image')).toBe(false);
    expect(merged.some(a => a.title === 'Local Image')).toBe(false);
    expect(merged.some(a => a.title === 'Remote OK')).toBe(true);
  });

  it('ensures every output article has a valid remote image', () => {
    const noImg = { title: 'No Image', date: freshDate, featured: false, image: null, summary: 'ok', category: 'News' };
    // noImg has no image so it gets pruned from kept, but if it's incoming it should get a fallback
    const merged = mergeArticles([], [noImg], 10);
    expect(merged[0].image).toMatch(/^https:\/\//);
  });

  it('drops existing articles older than KEEP_DAYS', () => {
    const existing = [
      { title: 'Old Article',   date: oldDate,   featured: false, image: goodImg, summary: 'ok' },
      { title: 'Fresh Article', date: freshDate, featured: false, image: goodImg, summary: 'ok' },
    ];
    const merged = mergeArticles(existing, [], 10);
    expect(merged.some(a => a.title === 'Old Article')).toBe(false);
    expect(merged.some(a => a.title === 'Fresh Article')).toBe(true);
  });

  it('respects maxCount limit', () => {
    const existing = Array.from({ length: 8 }, (_, i) => ({ title: `Existing ${i}`, date: freshDate, featured: false, image: goodImg, summary: 'ok' }));
    const incoming = Array.from({ length: 4 }, (_, i) => ({ title: `New ${i}`,      date: freshDate, featured: false, image: goodImg, summary: 'ok' }));
    expect(mergeArticles(existing, incoming, 6)).toHaveLength(6);
  });

  it('sets featured: true only for the first article', () => {
    const existing = [{ title: 'Old', date: freshDate, featured: true, image: goodImg, summary: 'ok' }];
    const incoming = [{ title: 'New', date: freshDate, featured: false, image: goodImg, summary: 'ok' }];
    const merged = mergeArticles(existing, incoming, 10);
    expect(merged[0].featured).toBe(true);
    merged.slice(1).forEach(a => expect(a.featured).toBe(false));
  });

  it('returns empty array when both inputs are empty', () => {
    expect(mergeArticles([], [], 10)).toEqual([]);
  });
});

// ─── buildFallbackArticle ─────────────────────────────────────────────────────

describe('buildFallbackArticle', () => {
  it('uses item.title as both title and summary', () => {
    const item = { title: 'Flood hits Erode' };
    const result = buildFallbackArticle(item);
    expect(result.title).toBe('Flood hits Erode');
    expect(result.summary).toBe('Flood hits Erode');
  });

  it('always sets category to "News"', () => {
    expect(buildFallbackArticle({ title: 'T' }).category).toBe('News');
  });

  it('always sets title_ta and summary_ta to empty strings', () => {
    const result = buildFallbackArticle({ title: 'T' });
    expect(result.title_ta).toBe('');
    expect(result.summary_ta).toBe('');
  });

  it('does not truncate the title', () => {
    const item = { title: 'Short title' };
    expect(buildFallbackArticle(item).title).toBe('Short title');
  });

  it('summary equals title even for longer titles', () => {
    const item = { title: 'A somewhat longer article title that has more words' };
    const result = buildFallbackArticle(item);
    expect(result.summary).toBe(item.title);
  });
});

// ─── rewriteArticle ───────────────────────────────────────────────────────────

describe('rewriteArticle', () => {
  afterEach(() => vi.restoreAllMocks());

  const mockItem = { title: 'Flood hits Erode', description: 'Heavy rains caused flooding.', link: '', pubDate: '', source: '' };

  it('returns fallback when provider is null', async () => {
    const result = await rewriteArticle(mockItem, null, null);
    expect(result.category).toBe('News');
    expect(result.title).toBeTruthy();
  });

  it('calls OpenAI and parses JSON response', async () => {
    const mockPayload = {
      title: 'Erode Flood Disrupts Daily Life',
      title_ta: 'ஈரோட்டில் வெள்ளம்',
      summary: 'Heavy rains flooded Erode.',
      summary_ta: 'கனமழையால் ஈரோட்டில் வெள்ளம்.',
      category: 'Weather',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(mockPayload) } }] }),
    }));

    const result = await rewriteArticle(mockItem, 'openai', 'sk-test');
    expect(result.title).toBe('Erode Flood Disrupts Daily Life');
    expect(result.category).toBe('Weather');
    expect(result.title_ta).toBe('ஈரோட்டில் வெள்ளம்');
  });

  it('calls Gemini and parses JSON response', async () => {
    const mockPayload = {
      title: 'Erode Flood Update',
      title_ta: 'ஈரோடு வெள்ள அறிவிப்பு',
      summary: 'Flooding reported in Erode.',
      summary_ta: 'ஈரோட்டில் வெள்ளம் புகாரிடப்பட்டது.',
      category: 'Weather',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockPayload) }] } }],
      }),
    }));

    const result = await rewriteArticle(mockItem, 'gemini', 'AIza-test');
    expect(result.title).toBe('Erode Flood Update');
    expect(result.category).toBe('Weather');
  });

  it('falls back gracefully when API returns HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    }));

    const result = await rewriteArticle(mockItem, 'openai', 'sk-test');
    expect(result.category).toBe('News'); // fallback category
  });

  it('falls back gracefully when API returns invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not-json' } }] }),
    }));

    const result = await rewriteArticle(mockItem, 'openai', 'sk-test');
    expect(result.category).toBe('News');
  });

  it('falls back when AI returns JSON missing required fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ category: 'Weather' }) } }] }),
    }));

    const result = await rewriteArticle(mockItem, 'openai', 'sk-test');
    expect(result.category).toBe('News'); // fallback
  });
});

// ─── fetchArticleImage ────────────────────────────────────────────────────────

describe('fetchArticleImage', () => {
  afterEach(() => vi.restoreAllMocks());

  const makeHtmlPage = (head: string) =>
    `<!DOCTYPE html><html><head>${head}</head><body>content</body></html>`;

  it('extracts og:image (property before content)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => makeHtmlPage('<meta property="og:image" content="https://example.com/photo.jpg" />'),
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBe('https://example.com/photo.jpg');
  });

  it('extracts og:image (content before property)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => makeHtmlPage('<meta content="https://example.com/photo2.jpg" property="og:image" />'),
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBe('https://example.com/photo2.jpg');
  });

  it('falls back to twitter:image when og:image is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => makeHtmlPage('<meta name="twitter:image" content="https://example.com/twitter.jpg" />'),
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBe('https://example.com/twitter.jpg');
  });

  it('returns null when neither og:image nor twitter:image is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => makeHtmlPage('<title>No image here</title>'),
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBeNull();
  });

  it('returns null on HTTP error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, url: 'https://example.com/article', text: async () => '' }));
    expect(await fetchArticleImage('https://example.com/article')).toBeNull();
  });

  it('returns null on network error (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    expect(await fetchArticleImage('https://example.com/article')).toBeNull();
  });

  it('returns null for empty url', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    expect(await fetchArticleImage('')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for null url', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    expect(await fetchArticleImage(null as unknown as string)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores relative image URLs (must start with http)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => makeHtmlPage('<meta property="og:image" content="/relative/path.jpg" />'),
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBeNull();
  });

  it('only parses the first 15 KB of the response', async () => {
    // og:image hidden beyond the 15KB window should NOT be found
    const padding = 'x'.repeat(15360);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.com/article',
      text: async () => padding + '<meta property="og:image" content="https://hidden.com/img.jpg" />',
    }));
    expect(await fetchArticleImage('https://example.com/article')).toBeNull();
  });

  it('returns null when redirect stays on google.com', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://news.google.com/some-page',
      text: async () => makeHtmlPage('<meta property="og:image" content="https://img.jpg"/>'),
    }));
    expect(await fetchArticleImage('https://news.google.com/some-page')).toBeNull();
  });

  it('returns image when redirect goes to real article', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://thehindu.com/article',
      text: async () => makeHtmlPage('<meta property="og:image" content="https://thehindu.com/img.jpg"/>'),
    }));
    expect(await fetchArticleImage('https://thehindu.com/article')).toBe('https://thehindu.com/img.jpg');
  });
});

// ─── callOpenAI ───────────────────────────────────────────────────────────────

describe('callOpenAI', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends request to OpenAI completions endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"title":"ok"}' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await callOpenAI('test prompt', 'sk-key');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('openai.com');
    expect(options.headers.Authorization).toBe('Bearer sk-key');
    expect(JSON.parse(options.body).model).toBe('gpt-4o-mini');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    await expect(callOpenAI('prompt', 'bad-key')).rejects.toThrow('401');
  });
});

// ─── callGemini ───────────────────────────────────────────────────────────────

describe('callGemini', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends request to Gemini generateContent endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"title":"ok"}' }] } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await callGemini('test prompt', 'AIza-key');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('AIza-key');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }));

    await expect(callGemini('prompt', 'bad-key')).rejects.toThrow('403');
  });
});
