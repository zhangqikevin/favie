/**
 * Extract image and video URLs from markdown-like agent output.
 *
 * Recognizes:
 *   - Markdown media references:  ![alt](url)
 *   - Raw URLs ending with an image/video extension
 *
 * Classifies each URL by its extension into images or videos. Unknown
 * extensions fall back to images (safer default — existing channel flow).
 * Returns the input text with media references removed.
 */

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?|#|$)/i;
const VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m4v)(?:\?|#|$)/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT_RE.test(url);
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

export interface ParsedMedia {
  cleanText: string;
  images: string[];
  videos: string[];
}

export function parseMarkdownMedia(raw: string): ParsedMedia {
  const images: string[] = [];
  const videos: string[] = [];

  // Markdown media syntax: ![alt](url)
  let text = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, _alt, url) => {
    const u = url.trim();
    if (isVideoUrl(u)) videos.push(u);
    else images.push(u);
    return "";
  });

  // Raw video URLs not wrapped in markdown
  text = text.replace(
    /(?<!\()(https?:\/\/\S+?\.(?:mp4|webm|mov|m4v)(?:\?\S*)?)/gi,
    (url) => {
      videos.push(url.trim());
      return "";
    },
  );

  // Raw image URLs not wrapped in markdown
  text = text.replace(
    /(?<!\()(https?:\/\/\S+?\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?\S*)?)/gi,
    (url) => {
      images.push(url.trim());
      return "";
    },
  );

  const cleanText = text.replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, images, videos };
}
