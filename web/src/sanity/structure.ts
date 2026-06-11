import type { StructureBuilder } from 'sanity/structure';
import {
  BookIcon,
  DocumentIcon,
  FolderIcon,
  ImagesIcon,
  ComposeIcon,
  SparklesIcon,
} from '@sanity/icons';

export function structure(S: StructureBuilder) {
  return S.list()
    .title('Moto Tutor AI')
    .items([
      // ── Courses ───────────────────────────────────────────────────────────
      S.listItem()
        .title('Courses')
        .icon(BookIcon)
        .child(
          S.documentTypeList('course')
            .title('Courses')
            .child((courseId) =>
              S.list()
                .title('Course')
                .items([
                  S.documentListItem()
                    .id(courseId)
                    .schemaType('course')
                    .title('Edit Course')
                    .icon(BookIcon),

                  S.divider(),

                  // Chapters that belong to this course
                  S.listItem()
                    .title('Chapters')
                    .icon(FolderIcon)
                    .child(
                      S.documentList()
                        .title('Chapters')
                        .apiVersion('2024-01-01')
                        .filter(
                          '_type == "chapter" && _id in *[_type == "course" && _id == $courseId][0].chapters[]._ref',
                        )
                        .params({ courseId })
                        .child((chapterId) =>
                          S.list()
                            .title('Chapter')
                            .items([
                              S.documentListItem()
                                .id(chapterId)
                                .schemaType('chapter')
                                .title('Edit Chapter')
                                .icon(FolderIcon),

                              S.divider(),

                              // Lessons that belong to this chapter
                              S.listItem()
                                .title('Lessons')
                                .icon(DocumentIcon)
                                .child(
                                  S.documentList()
                                    .title('Lessons')
                                    .apiVersion('2024-01-01')
                                    .filter(
                                      '_type == "lesson" && _id in *[_type == "chapter" && _id == $chapterId][0].lessons[]._ref',
                                    )
                                    .params({ chapterId }),
                                ),
                            ]),
                        ),
                    ),

                  S.divider(),

                  // Quiz linked to this course
                  S.listItem()
                    .title('Quiz')
                    .icon(SparklesIcon)
                    .child(
                      S.documentList()
                        .title('Quiz')
                        .apiVersion('2024-01-01')
                        .filter(
                          '_type == "quiz" && _id == *[_type == "course" && _id == $courseId][0].quiz._ref',
                        )
                        .params({ courseId }),
                    ),

                  // Specifications linked to this course
                  S.listItem()
                    .title('Specifications')
                    .icon(ImagesIcon)
                    .child(
                      S.documentList()
                        .title('Specifications')
                        .apiVersion('2024-01-01')
                        .filter(
                          '_type == "specification" && _id in *[_type == "course" && _id == $courseId][0].specifications[]._ref',
                        )
                        .params({ courseId }),
                    ),

                  // Disclaimer linked to this course
                  S.listItem()
                    .title('Disclaimer')
                    .icon(ComposeIcon)
                    .child(
                      S.documentList()
                        .title('Disclaimer')
                        .apiVersion('2024-01-01')
                        .filter(
                          '_type == "disclaimer" && _id == *[_type == "course" && _id == $courseId][0].disclaimer._ref',
                        )
                        .params({ courseId }),
                    ),
                ]),
            ),
        ),

      S.divider(),

      // ── Standalone archives (for authoring before assigning) ──────────────
      S.listItem()
        .title('All Lessons')
        .icon(DocumentIcon)
        .child(S.documentTypeList('lesson').title('All Lessons')),

      S.listItem()
        .title('All Quizzes')
        .icon(SparklesIcon)
        .child(S.documentTypeList('quiz').title('All Quizzes')),

      S.listItem()
        .title('All Specifications')
        .icon(ImagesIcon)
        .child(S.documentTypeList('specification').title('All Specifications')),

      S.listItem()
        .title('All Disclaimers')
        .icon(ComposeIcon)
        .child(S.documentTypeList('disclaimer').title('All Disclaimers')),
    ]);
}
