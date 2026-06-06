import Link from "next/link";
import { Bot, BarChart2, BookOpen, PlayCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { sanityClient } from "@/sanity/lib/client";
import { MODULES_QUERY } from "@/sanity/lib/queries";

export interface ModuleSummary {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  thumbnail?: { asset?: { url?: string } };
  chapterCount: number;
}

export default async function Home() {
  const modules = await sanityClient.fetch<ModuleSummary[]>(MODULES_QUERY);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className="flex items-center gap-2 font-semibold text-lg text-primary">
          <Bot className="h-6 w-6" />
          <span>DeckTutor AI</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border hover:border-foreground/20 hover:bg-accent transition-all duration-150"
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

      <main className="flex-1 container mx-auto px-6 py-12 md:py-16">
        <div className="max-w-2xl mb-12 space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Explore Courses</h1>
          <p className="text-lg text-muted-foreground font-light">
            Select a module to begin your learning journey.
          </p>
        </div>

        {modules.length === 0 ? (
          <div className="text-center text-muted-foreground py-24 border border-dashed rounded-xl border-border">
            <p className="text-lg font-light">No published courses yet.</p>
            <Link href="/studio" className="mt-4 inline-block text-primary underline text-sm hover:no-underline">
              Open Studio →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modules.map((module) => (
              <Link 
                key={module._id} 
                href={`/module/${module.slug.current}`}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                aria-label={`Start course: ${module.title}`}
              >
                <Card className="overflow-hidden border-border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full flex flex-col bg-card">
                  <div className="relative aspect-[16/9] w-full bg-muted overflow-hidden">
                    {module.thumbnail?.asset?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={module.thumbnail.asset.url} 
                        alt="" 
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-moto-frost">
                        <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-moto-black/0 group-hover:bg-moto-black/20 transition-colors duration-300 flex items-center justify-center">
                      <div className="bg-moto-frost text-moto-black rounded-full p-3 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <CardHeader className="p-5 flex-1 space-y-2">
                    <h2 className="text-lg font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {module.title}
                    </h2>
                    {module.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 font-light">
                        {module.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="p-5 pt-0 mt-auto">
                    <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {module.chapterCount} {module.chapterCount === 1 ? 'Chapter' : 'Chapters'}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
