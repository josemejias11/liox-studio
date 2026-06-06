import Link from "next/link";
import { Bot, BarChart2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sanityClient } from "@/sanity/lib/client";
import { FIRST_MODULE_QUERY } from "@/sanity/lib/queries";
import { SanityDocument } from "next-sanity";
import DeckViewer from "@/components/DeckViewer";

export interface SanityHotspot {
  _key: string;
  label: string;
  topic: string;
  body?: string;
  photos?: { asset?: { url?: string } }[];
  x: number;
  y: number;
}

export interface SanitySlide {
  _key: string;
  headline: string;
  body?: string;
  slideType: "content" | "interaction" | "stage" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  stageBackground?: { asset?: { url?: string } };
  completionTransition?: "spin" | "rise" | "fade";
  hotspots?: SanityHotspot[];
  videoUrl?: string;
  videoFile?: { asset?: { url?: string } };
  speakerNotes?: string;
}

export interface SanitySlideWithLesson extends SanitySlide {
  lessonTitle?: string;
}

export interface LessonQueryData {
  _id: string;
  title: string;
  slug: { current: string };
  estimatedDuration?: number;
  slides?: SanitySlide[];
}

export interface ModuleQueryData extends SanityDocument {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  thumbnail?: { asset?: { url?: string } };
  learningObjectives?: string[];
  lessons?: LessonQueryData[];
}

export default async function Home() {
  const module = await sanityClient.fetch<ModuleQueryData | null>(FIRST_MODULE_QUERY);

  // Flatten all slides across all lessons into a single ordered array
  const slides: SanitySlideWithLesson[] =
    module?.lessons?.flatMap((lesson: LessonQueryData) =>
      (lesson.slides ?? []).map((slide: SanitySlide) => ({
        ...slide,
        lessonTitle: lesson.title,
      }))
    ) ?? [];

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className="flex items-center gap-2 font-semibold text-lg text-primary">
          <Bot className="h-6 w-6" />
          <span>DeckTutor AI</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[12px] font-medium
              px-3 py-1.5 rounded-lg border border-border hover:border-foreground/20 hover:bg-accent
              transition-all duration-150"
          >
            <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
            Analytics
          </Link>
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex items-center justify-center">
        {!module ? (
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-light">No published courses yet.</p>
            <p className="text-sm mt-1">Create and publish a Module in the Studio to get started.</p>
            <a href="/studio" className="mt-4 inline-block text-primary underline text-sm">Open Studio →</a>
          </div>
        ) : (
          <DeckViewer module={module} slides={slides} />
        )}
      </main>
    </div>
  );
}
