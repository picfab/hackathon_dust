import {
  AMPLITUDE_API_KEY,
  AMPLITUDE_SECRET_KEY,
  AMPLITUDE_LEAD_EVENT,
  AMPLITUDE_PAGE_PROPERTY,
} from 'astro:env/server';

// EU data residency endpoint.
const BASE = 'https://analytics.eu.amplitude.com';

export interface PageLeads {
  page: string;
  total: number;
}

export interface LeadBoard {
  rows: PageLeads[];
  total: number;
  event: string;
  property: string;
  start: string;
  end: string;
  days: number;
}

export const isConfigured = Boolean(AMPLITUDE_API_KEY && AMPLITUDE_SECRET_KEY);

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ranks pages by the number of `lead_generated` events over the last `days`,
 * using Amplitude's Event Segmentation API grouped by the page property.
 */
export async function getLeadBoard(days = 30): Promise<LeadBoard> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const startStr = yyyymmdd(start);
  const endStr = yyyymmdd(end);

  const params = new URLSearchParams({
    e: JSON.stringify({ event_type: AMPLITUDE_LEAD_EVENT }),
    start: startStr,
    end: endStr,
    m: 'totals',
    g: AMPLITUDE_PAGE_PROPERTY,
    limit: '100',
  });

  const auth = Buffer.from(`${AMPLITUDE_API_KEY}:${AMPLITUDE_SECRET_KEY}`).toString('base64');

  const res = await fetch(`${BASE}/api/2/events/segmentation?${params.toString()}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Amplitude ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }

  const json = (await res.json()) as {
    data?: { series?: number[][]; seriesLabels?: Array<string | string[]> };
  };

  const series = json.data?.series ?? [];
  const labels = json.data?.seriesLabels ?? [];

  const rows: PageLeads[] = series
    .map((arr, i) => {
      const label = labels[i];
      const page = Array.isArray(label) ? String(label[label.length - 1]) : String(label ?? '—');
      const total = (arr ?? []).reduce((a, b) => a + (b || 0), 0);
      return { page, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    total: rows.reduce((a, r) => a + r.total, 0),
    event: AMPLITUDE_LEAD_EVENT,
    property: AMPLITUDE_PAGE_PROPERTY,
    start: startStr,
    end: endStr,
    days,
  };
}
