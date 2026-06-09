import { createClient } from "next-sanity";

const config = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "REPLACE_ME",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2024-01-01",
};

// CDN-enabled read-only client for course content fetching (no write token)
export const readClient = createClient({
  ...config,
  useCdn: true,
});

// Editor-token client for Studio mutations — never import in client components
export const sanityClient = createClient({
  ...config,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});
