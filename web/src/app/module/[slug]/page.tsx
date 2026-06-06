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

  // Flatten slides across all lessons
  const slides = module.lessons?.flatMap((lesson: any) =>
    (lesson.slides ?? []).map((slide: any) => ({
      ...slide,
      lessonTitle: lesson.title,
    }))
  ) ?? [];

  return (
    <div className="w-full h-dvh overflow-hidden bg-moto-black">
      <DeckViewer module={module} slides={slides} />
    </div>
  );
}
