import { buildClient, buildBlockRecord } from '@datocms/cma-client-node';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { parse } from 'parse5';
import { parse5ToStructuredText } from 'datocms-html-to-structured-text';
import { URLS } from './urls.mjs';

// --- Schema IDs (from introspection) ---
const ARTICLE_MODEL = 'G8Wvh_e9Tg-F2jfFnwUpoA';
const CONTENT_BLOCK = 'QtFlNnPAS5GOFC0OgTp7uA';
const HERO_BLOCK = 'Q8GxJ5SATDS7GF4Lk9n0RA';

// --- CLI flags ---
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : null;

const client = DRY_RUN ? null : buildClient({ apiToken: process.env.DATOCMS_API_TOKEN });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const slugOf = (url) => url.replace(/\/$/, '').split('/').pop();

/** Fetch a page and extract title, clean body HTML, hero image URL and SEO post-meta. */
async function extract(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const attr = (sel, a = 'content') => doc.querySelector(sel)?.getAttribute(a) ?? null;
  const seo = {
    title: (attr('meta[property="og:title"]') || doc.querySelector('title')?.textContent || '').trim(),
    description: (attr('meta[name="description"]') || attr('meta[property="og:description"]') || '').trim(),
    ogImage: attr('meta[property="og:image"]'),
    canonical: attr('link[rel="canonical"]', 'href'),
  };

  // Readability isolates the article body (drops nav / aside / footer / related).
  const reader = new Readability(doc.cloneNode(true));
  const article = reader.parse();
  if (!article) throw new Error('Readability returned null');

  // Hero image: first real image inside the article body, else the og:image post-meta.
  const bodyDom = new JSDOM(article.content, { url });
  const firstImg = [...bodyDom.window.document.querySelectorAll('img')]
    .map((img) => img.getAttribute('src'))
    .find((src) => src && /^https?:/.test(src) && !/\.svg(\?|$)/i.test(src));
  const heroImageUrl = firstImg || seo.ogImage || null;

  const dast = await parse5ToStructuredText(parse(article.content, { sourceCodeLocationInfo: true }));

  return { title: (article.title || seo.title).trim(), dast, heroImageUrl, seo };
}

/** Find an existing article by slug (returns id or null). */
async function findBySlug(slug) {
  const items = await client.items.list({
    filter: { type: ARTICLE_MODEL, fields: { slug: { eq: slug } } },
    page: { limit: 1 },
  });
  return items[0]?.id ?? null;
}

async function importOne(url) {
  const slug = slugOf(url);
  const { title, dast, heroImageUrl, seo } = await extract(url);

  const chars = JSON.stringify(dast).length;
  if (DRY_RUN) {
    return { slug, action: 'dry', title, chars, hero: heroImageUrl ? 'yes' : 'no', seoTitleLen: seo.title.length };
  }

  // Upload hero image (deduped) and SEO image.
  let heroUploadId = null;
  if (heroImageUrl) {
    const up = await client.uploads.createFromUrl({
      url: heroImageUrl,
      skipCreationIfAlreadyExists: true,
      default_field_metadata: { fr: { alt: title, title, custom_data: {} } },
    });
    heroUploadId = up.id;
  }

  const heroBlock = buildBlockRecord({
    item_type: { type: 'item_type', id: HERO_BLOCK },
    title,
    image: heroUploadId ? { upload_id: heroUploadId } : null,
  });

  const contentBlock = buildBlockRecord({
    item_type: { type: 'item_type', id: CONTENT_BLOCK },
    content: dast,
  });

  const payload = {
    slug,
    hero: heroBlock,
    content: [contentBlock],
    seo: {
      title: seo.title.slice(0, 60) || title.slice(0, 60),
      description: seo.description.slice(0, 160),
      image: heroUploadId,
      twitter_card: 'summary_large_image',
      no_index: false,
    },
  };

  const existingId = await findBySlug(slug);
  if (existingId) {
    await client.items.update(existingId, payload);
    return { slug, action: 'updated', title, chars, hero: heroUploadId ? 'yes' : 'no' };
  }
  await client.items.create({ item_type: { type: 'item_type', id: ARTICLE_MODEL }, ...payload });
  return { slug, action: 'created', title, chars, hero: heroUploadId ? 'yes' : 'no' };
}

// --- Run with limited concurrency ---
const targets = (ONLY ? URLS.filter((u) => u.includes(ONLY)) : URLS).slice(0, LIMIT);
console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Importing ${targets.length} page(s)...\n`);

const CONCURRENCY = DRY_RUN ? 5 : 3;
const results = [];
let i = 0;
async function worker() {
  while (i < targets.length) {
    const url = targets[i++];
    const slug = slugOf(url);
    try {
      const r = await importOne(url);
      results.push(r);
      console.log(`✓ ${r.action.padEnd(7)} ${r.slug.padEnd(42)} ${r.chars} dast-bytes  hero:${r.hero ?? '-'}`);
    } catch (e) {
      results.push({ slug, action: 'ERROR', error: e.message });
      console.log(`✗ ERROR   ${slug.padEnd(42)} ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const ok = results.filter((r) => r.action !== 'ERROR').length;
const errs = results.filter((r) => r.action === 'ERROR');
console.log(`\nDone: ${ok}/${targets.length} ok, ${errs.length} error(s).`);
if (errs.length) console.log('Errors:', errs.map((e) => `${e.slug}: ${e.error}`).join('\n  '));
