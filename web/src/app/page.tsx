import Link from "next/link";
import { Bot, BarChart2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sanityClient } from "@/sanity/lib/client";
import { FIRST_MODULE_QUERY } from "@/sanity/lib/queries";
import DeckViewer from "@/components/DeckViewer";

export default async function Home() {
  const module = await sanityClient.fetch(FIRST_MODULE_QUERY);

  // Flatten all slides across all lessons into a single ordered array
  const slides =
    module?.lessons?.flatMap((lesson: any) =>
      (lesson.slides ?? []).map((slide: any) => ({
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
