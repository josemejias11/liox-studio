import Link from 'next/link';
import Image from 'next/image';
import { Bot, BarChart2, BookOpen, PlayCircle } from 'lucide-react';
import { listPublishedCourseSummaries } from '@moto-ai/database';
import type { CourseSummary } from '@/lib/contracts/player-course';
import { toPlayerCourseSummary } from '@/lib/course-player-adapter';
import { ThemeToggle } from '@/components/theme';

export const revalidate = 60;

export default async function Home() {
  const records = await listPublishedCourseSummaries();
  const courses: CourseSummary[] = records.flatMap((record) => {
    const course = toPlayerCourseSummary(record);
    return course ? [course] : [];
  });

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center gap-4 border-b px-6">
        <div className="text-primary flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-6 w-6" />
          <span>Moto Tutor AI</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/analytics"
            className="text-muted-foreground hover:text-foreground border-border hover:border-foreground/20 hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
          >
            <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
            Analytics
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto flex-1 px-6 py-12 md:py-16">
        <div className="mb-12 max-w-2xl space-y-3">
          <h1 className="text-foreground text-4xl font-semibold">Explore Courses</h1>
          <p className="text-muted-foreground text-lg font-light">
            Select a course to begin your learning journey.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="text-muted-foreground border-border rounded-xl border border-dashed py-24 text-center">
            <p className="text-lg font-light">No published courses yet.</p>
            <Link
              href="/studio"
              className="text-primary mt-4 inline-block text-sm underline hover:no-underline"
            >
              Open Studio →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course, index) => (
              <Link
                key={course._id}
                href={`/course/${course.slug.current}`}
                className="group focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label={`Start course: ${course.title}`}
              >
                <div className="group/card border-border bg-card text-card-foreground ring-foreground/10 flex h-full flex-col gap-(--card-spacing) overflow-hidden rounded-xl py-(--card-spacing) text-sm ring-1 [--card-spacing:--spacing(4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                    {course.thumbnail?.asset?.url ? (
                      <Image
                        src={course.thumbnail.asset.url as string}
                        alt={course.title}
                        width={800}
                        height={450}
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        priority={index === 0}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="bg-background flex h-full w-full items-center justify-center">
                        <BookOpen className="text-muted-foreground/30 h-10 w-10" />
                      </div>
                    )}
                    <div className="bg-background/0 group-hover:bg-background/20 absolute inset-0 flex items-center justify-center transition-colors duration-300">
                      <div className="bg-background text-foreground translate-y-4 transform rounded-full p-3 opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <div className="group/card-header @container/card-header grid flex-1 auto-rows-min items-start gap-1 space-y-2 rounded-t-xl p-5">
                    <h2 className="group-hover:text-primary line-clamp-2 text-lg leading-tight font-semibold transition-colors">
                      {course.title}
                    </h2>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {course.courseMode === 'canvas' ? 'Canvas course' : 'Standard course'}
                    </p>
                    {course.description && (
                      <p className="text-muted-foreground line-clamp-2 text-sm font-light">
                        {course.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto p-5 pt-0">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <BookOpen className="h-3.5 w-3.5" />
                      {course.chapterCount} {course.chapterCount === 1 ? 'Chapter' : 'Chapters'}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
