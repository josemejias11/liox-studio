import { notFound } from "next/navigation";
import { sanityClient } from "@/sanity/lib/client";
import { MODULE_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import DeckViewer from "@/components/DeckViewer";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  
  const courseModule = await sanityClient.fetch(MODULE_BY_SLUG_QUERY, { slug: resolvedParams.slug });

  if (!courseModule) {
    notFound();
  }

  // Flatten lessons across all chapters
  const lessons = courseModule.chapters?.flatMap((chapter: Record<string, unknown>) =>
    ((chapter.lessons as Record<string, unknown>[]) ?? []).map((lesson: Record<string, unknown>) => ({
      ...lesson,
      chapterTitle: chapter.title,
    }))
  ) ?? [];

  return (
    <div className="w-full h-dvh overflow-hidden bg-background">
      <DeckViewer module={courseModule} lessons={lessons} />
    </div>
  );
}
