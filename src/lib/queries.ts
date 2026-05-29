import { request } from './datocms';
import type { SeoOrFaviconTag } from '@datocms/astro/Seo';

/** Fields needed by the @datocms/astro <Image> component. */
const responsiveImageFragment = `
  fragment responsiveImageFragment on ResponsiveImage {
    src
    srcSet
    webpSrcSet
    sizes
    alt
    title
    width
    height
    aspectRatio
    base64
    bgColor
  }
`;

export interface ResponsiveImage {
  src: string;
  srcSet: string;
  webpSrcSet: string | null;
  sizes: string | null;
  alt: string | null;
  title: string | null;
  width: number;
  height: number;
  aspectRatio: number;
  base64: string | null;
  bgColor: string | null;
}

/** The `hero` single-block field on an Article (HeroRecord). */
export interface Hero {
  title: string | null;
  image: { responsiveImage: ResponsiveImage | null } | null;
}

/** One block of the `content` modular-content field (ContentRecord). */
export interface ContentBlock {
  id: string;
  content: { value: unknown };
}

export interface ArticleListItem {
  id: string;
  slug: string;
  _publishedAt: string | null;
  _createdAt: string;
  hero: Hero | null;
}

export interface Article {
  id: string;
  slug: string;
  _publishedAt: string | null;
  _createdAt: string;
  hero: Hero | null;
  content: ContentBlock[];
  seo: SeoOrFaviconTag[];
}

/** All articles, most recent first, for the homepage listing. */
export async function getAllArticles(): Promise<ArticleListItem[]> {
  const data = await request<{ allArticles: ArticleListItem[] }>(
    `
      ${responsiveImageFragment}
      query AllArticles {
        allArticles(orderBy: _createdAt_DESC, first: 100) {
          id
          slug
          _publishedAt
          _createdAt
          hero {
            title
            image {
              responsiveImage(imgixParams: { fit: crop, w: 800, h: 500, auto: format }) {
                ...responsiveImageFragment
              }
            }
          }
        }
      }
    `,
  );
  return data.allArticles;
}

/** A single article by slug, or null when not found. */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const data = await request<{ article: Article | null }>(
    `
      ${responsiveImageFragment}
      query ArticleBySlug($slug: String!) {
        article(filter: { slug: { eq: $slug } }) {
          id
          slug
          _publishedAt
          _createdAt
          hero {
            title
            image {
              responsiveImage(imgixParams: { fit: max, w: 1600, auto: format }) {
                ...responsiveImageFragment
              }
            }
          }
          content {
            id
            content {
              value
            }
          }
          seo: _seoMetaTags {
            tag
            attributes
            content
          }
        }
      }
    `,
    { slug },
  );
  return data.article;
}
