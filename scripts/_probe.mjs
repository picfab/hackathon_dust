import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { parse } from 'parse5';
import { parse5ToStructuredText } from 'datocms-html-to-structured-text';

const url = process.argv[2] || 'https://payfit.com/fr/fiches-pratiques/budget-cse/';

const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
});
const html = await res.text();

const dom = new JSDOM(html, { url });
const doc = dom.window.document;

// --- meta (post meta) ---
const meta = (sel, attr = 'content') => doc.querySelector(sel)?.getAttribute(attr) ?? null;
const post = {
  title: doc.querySelector('title')?.textContent ?? null,
  description: meta('meta[name="description"]'),
  ogTitle: meta('meta[property="og:title"]'),
  ogDescription: meta('meta[property="og:description"]'),
  ogImage: meta('meta[property="og:image"]'),
  canonical: meta('link[rel="canonical"]', 'href'),
};

// --- article body (Readability strips nav/aside/footer/related) ---
const reader = new Readability(doc.cloneNode(true));
const article = reader.parse();

const dast = await parse5ToStructuredText(parse(article.content, { sourceCodeLocationInfo: true }));

// count node types
const counts = {};
const walk = (n) => {
  counts[n.type] = (counts[n.type] || 0) + 1;
  (n.children || []).forEach(walk);
};
walk(dast.document);

console.log('URL          :', url);
console.log('POST META    :', JSON.stringify(post, null, 2));
console.log('READ TITLE   :', article.title);
console.log('CONTENT chars:', article.textContent.trim().length);
console.log('DAST nodes   :', JSON.stringify(counts));
console.log('FIRST 300 txt:', article.textContent.trim().slice(0, 300).replace(/\s+/g, ' '));
