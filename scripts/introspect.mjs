import { buildClient } from '@datocms/cma-client-node';

const client = buildClient({ apiToken: process.env.DATOCMS_API_TOKEN });

const itemTypes = await client.itemTypes.list();
console.log('=== MODELS / BLOCKS ===');
for (const it of itemTypes) {
  console.log(`${it.api_key.padEnd(22)} id=${it.id}  ${it.modular_block ? '[block]' : '[model]'}`);
}

const interesting = itemTypes.filter((it) =>
  ['article', 'hero', 'content'].includes(it.api_key),
);

for (const it of interesting) {
  console.log(`\n=== FIELDS of "${it.api_key}" (id=${it.id}) ===`);
  const fields = await client.fields.list(it.id);
  for (const f of fields) {
    let extra = '';
    if (f.field_type === 'structured_text' || f.field_type === 'rich_text') {
      const v = f.validators || {};
      extra = ` validators=${JSON.stringify(v.rich_text_blocks || v.structured_text_blocks || v)}`;
    }
    if (f.field_type === 'single_block') {
      extra = ` validators=${JSON.stringify(f.validators)}`;
    }
    console.log(`  ${f.api_key.padEnd(16)} type=${f.field_type}${extra}`);
  }
}
