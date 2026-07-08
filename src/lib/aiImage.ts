/** Shared image validation for the two vision-based AI routes (parse-screenshot, hand-review) —
 *  both accept a base64-encoded table screenshot and must agree on what's an acceptable upload. */

export type AllowedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export const ALLOWED_IMAGE_MEDIA_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** ~6MB raw — plenty for a screenshot, caps cost/timeout abuse. */
export const MAX_IMAGE_BASE64_LENGTH = 8_000_000;
