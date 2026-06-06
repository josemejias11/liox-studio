import { createClient } from "@sanity/client";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

async function main() {
  const chapters = await client.fetch(`*[_type == "chapter"]{ _id, title, lessons }`);
  if (!chapters.length) {
    console.log("No chapters found");
    return;
  }
  
  // Find a chapter that has lessons
  const chapter = chapters.find((c: any) => c.lessons && c.lessons.length > 0);
  if (!chapter) {
    console.log("No lessons found in any chapter");
    return;
  }

  const lesson = chapter.lessons[0];
  console.log(`Adding layer to lesson "${lesson.headline}" in chapter "${chapter.title}"`);

  // We need to patch the chapter document to add a layer to the first lesson
  const newLayer = {
    _key: randomUUID(),
    _type: "layer",
    headline: "Lenses Deep Dive",
    body: "This is a deep dive into the camera lenses. We have ultra-wide, wide, and telephoto lenses. Each lens serves a specific photographic purpose.",
    layerType: "content"
  };

  const updatedLessons = chapter.lessons.map((l: any, i: number) => {
    if (i === 0) {
      return {
        ...l,
        layers: [...(l.layers || []), newLayer]
      };
    }
    return l;
  });

  await client
    .patch(chapter._id)
    .set({ lessons: updatedLessons })
    .commit();
  
  console.log("Successfully added mock layer to Sanity!");
}

main().catch(console.error);
