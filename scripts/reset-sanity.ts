import { createClient } from 'next-sanity';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'e7l925v5';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const token = process.env.SANITY_API_TOKEN;

if (!token) {
  console.error('Error: SANITY_API_TOKEN is not set.');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
});

const CONTENT_TYPES = [
  'course',
  'chapter',
  'lesson',
  'specification',
  'disclaimer',
  'layer',
] as const;

async function main() {
  console.log(`Querying Sanity (project: ${projectId}, dataset: ${dataset})...\n`);

  // GROQ matches _type regardless of draft prefix — returns both published and draft docs
  const docs = await client.fetch<Array<{ _id: string; _type: string }>>(
    `*[_type in $types]{ _id, _type }`,
    { types: CONTENT_TYPES },
  );

  if (docs.length === 0) {
    console.log('No documents found — nothing to delete.');
    return;
  }

  const counts: Record<string, number> = {};
  for (const doc of docs) {
    counts[doc._type] = (counts[doc._type] ?? 0) + 1;
  }

  // Delete in batches (Sanity transaction limit is well above 100 but batching is safer)
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const tx = client.transaction();
    for (const doc of batch) {
      tx.delete(doc._id);
    }
    await tx.commit();
    deleted += batch.length;
  }

  for (const type of CONTENT_TYPES) {
    const count = counts[type] ?? 0;
    if (count > 0) {
      console.log(`✓ ${type.padEnd(15)} — ${count} document(s) deleted`);
    }
  }
  console.log(`\nTotal: ${deleted} document(s) deleted from Sanity.`);
}

main().catch((err: unknown) => {
  console.error('Sanity reset failed:', err);
  process.exit(1);
});
