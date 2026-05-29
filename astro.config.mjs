// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  env: {
    schema: {
      DATOCMS_API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      // When true, include unpublished (draft) records via the X-Include-Drafts header.
      DATOCMS_INCLUDE_DRAFTS: envField.boolean({
        context: 'server',
        access: 'public',
        optional: true,
        default: false,
      }),
      // Amplitude Dashboard REST API (EU region) — for the /amplitude board.
      AMPLITUDE_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      AMPLITUDE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      AMPLITUDE_LEAD_EVENT: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'lead_generated',
      }),
      AMPLITUDE_PAGE_PROPERTY: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: '[Amplitude] Page Path',
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: netlify()
});