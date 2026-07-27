import { layerType } from './layer';
import { lessonType } from './lesson';
import { chapterType } from './chapter';
import { courseType } from './course';
import { courseLocaleReleaseType } from './courseLocaleRelease';
import { quizType } from './quiz';
import { specificationType } from './specification';
import { disclaimerType } from './disclaimer';

export const schemaTypes = [
  courseType,
  courseLocaleReleaseType,
  chapterType,
  lessonType,
  layerType,
  quizType,
  specificationType,
  disclaimerType,
];
