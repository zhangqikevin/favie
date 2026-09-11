/**
 * Menu Clinic generation prompts. Both are editable in /admin/menu-prompts (stored in app_settings) and
 * fall back to these defaults. The output FORMAT the backend parses (the favie-menu-text block, the image
 * size) stays in code; only the creative guidance lives here.
 */
import { getSetting, SETTING_KEYS } from '@/server/settings'

export const DEFAULT_DESCRIBE_PROMPT = `Write two descriptions for each dish: \`description_en\` (English) and \`description_zh\` (Simplified Chinese), 3–4 sentences each.
Cover the flavor profile, the main ingredients, the cooking method, and what it comes with or who it suits.
Be specific to this dish and this restaurant's cuisine; vary sentence openings across dishes.
No clichés ("mouth-watering", "authentic", "delicious"), no health or allergen claims you cannot know, no prices, no emojis.
Keep each description at or under 380 characters. If the current description already says something specific (portion, spice level, sides), keep those facts.`

/** Placeholders: {name} {category} {cuisine} {description_en} — empty when unknown. Tuned for Uber Eats / DoorDash listing photos (square, food-first, no props). */
export const DEFAULT_IMAGE_PROMPT = `Ultra-realistic food photograph of "{name}" ({category}, {cuisine}) for a restaurant delivery app listing.
The dish: {description_en}
Show the dish exactly as a customer would receive it: generous portion, fresh and glossy, natural textures (glaze, steam, crisp edges) rendered faithfully, plated in a simple white ceramic bowl or plate. Camera at a 45-degree angle with an 85mm lens look, shallow depth of field, soft natural window light from the left, faint steam where the dish is served hot.
Clean light-grey linen table, minimal background. No people, no hands, no chopsticks or cutlery, no text, no logos, no watermark, no extra props, nothing outside the frame. Centered composition, square 1:1, tack-sharp focus on the food.`

/** Default image model for the agent's image_generate tool ("provider/model"; provider alone picks its default). */
export const DEFAULT_IMAGE_MODEL = 'openai/gpt-image-1.5'
export const IMAGE_MODEL_CHOICES = ['openai/gpt-image-1.5', 'openai/gpt-image-2', 'gemini', 'grok'] as const

export async function menuImageModel(): Promise<string> {
  return (await getSetting(SETTING_KEYS.menuImageModel))?.value?.trim() || DEFAULT_IMAGE_MODEL
}

export async function menuDescribePrompt(): Promise<string> {
  return (await getSetting(SETTING_KEYS.menuDescribePrompt))?.value?.trim() || DEFAULT_DESCRIBE_PROMPT
}

export async function menuImagePromptTemplate(): Promise<string> {
  return (await getSetting(SETTING_KEYS.menuImagePrompt))?.value?.trim() || DEFAULT_IMAGE_PROMPT
}

/** Fill the image template; drops empty "(…)" hints and collapses blank placeholders. */
export function renderImagePrompt(template: string, vars: { name: string; category?: string | null; cuisine?: string | null; descriptionEn?: string | null }) {
  const v: Record<string, string> = { name: vars.name, category: vars.category ?? '', cuisine: vars.cuisine ?? '', description_en: vars.descriptionEn ?? '' }
  return template
    .replace(/\{(name|category|cuisine|description_en)\}/g, (_, k: string) => v[k] ?? '')
    .replace(/\(\s*,\s*\)/g, '').replace(/\(\s*,\s*/g, '(').replace(/\s*,\s*\)/g, ')').replace(/\(\s*\)/g, '')
    .replace(/^The dish:\s*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim()
}
