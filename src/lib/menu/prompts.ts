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

/** Placeholders: {name} {category} {cuisine} {description_en} — empty when unknown. */
export const DEFAULT_IMAGE_PROMPT = `Professional food photograph of "{name}" ({category}, {cuisine}) for a restaurant delivery app listing.
The dish: {description_en}
Single plated dish, centered, filling most of the frame, on a clean neutral table with soft natural daylight from the side, shallow depth of field, appetizing steam or glossy sauce where natural, realistic colors.
No people, no hands, no text, no logos, no extra props. Square 1:1 composition, sharp focus on the food.`

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
