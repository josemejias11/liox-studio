import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./src/sanity/schemaTypes";

export default defineConfig({
  basePath: "/studio",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "REPLACE_ME",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  title: "DeckTutor AI — Studio",
  schema: { types: schemaTypes },
  plugins: [
    structureTool(),
    visionTool(), // GROQ query explorer at /studio/vision
  ],
});
