export { getObject, putObject, deleteObject } from './local-client';
export { collectAssetRefs, r2KeyFor, rewriteAssetUrls } from './asset-refs';
export {
  copyCourseAssetRefs,
  plannedCourseAssetDestinationKeys,
  CourseAssetCopyError,
} from './course-asset-copy';
export type { CopiedCourseAsset } from './course-asset-copy';
