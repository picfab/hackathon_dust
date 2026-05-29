import { DATOCMS_API_TOKEN, DATOCMS_INCLUDE_DRAFTS } from 'astro:env/server';

const DATOCMS_ENDPOINT = 'https://graphql.datocms.com/';

type Variables = Record<string, unknown>;

/**
 * Minimal GraphQL client for the DatoCMS Content Delivery API.
 * Throws on network or GraphQL errors so pages can decide how to handle them.
 */
export async function request<T = unknown>(
  query: string,
  variables: Variables = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${DATOCMS_API_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (DATOCMS_INCLUDE_DRAFTS) {
    headers['X-Include-Drafts'] = 'true';
  }

  const response = await fetch(DATOCMS_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`DatoCMS request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`DatoCMS GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  if (!json.data) {
    throw new Error('DatoCMS returned no data');
  }

  return json.data;
}
