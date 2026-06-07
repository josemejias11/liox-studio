import { notFound } from "next/navigation";
import { sanityClient } from "@/sanity/lib/client";
import { MODULE_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import DeckViewer from "@/components/DeckViewer";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  
  const module = await sanityClient.fetch(MODULE_BY_SLUG_QUERY, { slug: resolvedParams.slug });

  if (!module) {
    notFound();
  }

  // Flatten lessons across all chapters
  const lessons = module.chapters?.flatMap((chapter: any) =>
    (chapter.lessons ?? []).map((lesson: any) => ({
      ...lesson,
      chapterTitle: chapter.title,
    }))
  ) ?? [];

  return (
    <div className="w-full h-dvh overflow-hidden bg-background">
      <DeckViewer module={module} lessons={lessons} />
    </div>
  );
}
