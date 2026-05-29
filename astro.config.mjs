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
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: netlify()
});