/**
 * Decorative food cut-outs from one sprite sheet (public/food-sprite.jpg, 1536 × 1024, white background).
 * The sheet is not a uniform grid, so each dish has its own measured pixel box (computed once from the
 * image's non-white pixels, padded 6 px). `mix-blend-mode: multiply` hides the white background on light
 * surfaces, so only use these on white / light-gray sections. Purely decorative: aria-hidden, no pointer events.
 */
const SHEET_W = 1536, SHEET_H = 1024
// [x, y, w, h] in sheet pixels
const BOX: Record<string, [number, number, number, number]> = {
  burger: [18, 34, 264, 228], ramen: [322, 2, 308, 272], pizza: [634, 30, 320, 260], sushi: [954, 66, 296, 184], boba: [1286, 6, 204, 276],
  wings: [14, 278, 300, 232], tacos: [326, 298, 304, 216], salad: [634, 270, 300, 244], chicken_sandwich: [938, 286, 280, 236], pad_thai: [1218, 286, 304, 228],
  poke: [18, 514, 280, 224], dumplings: [306, 526, 328, 208], steak: [634, 522, 316, 220], breakfast_sandwich: [954, 542, 280, 192], burrito: [1238, 518, 280, 212],
  curry: [14, 746, 296, 236], tempura: [310, 730, 344, 252], acai: [658, 746, 264, 232], fries: [922, 730, 308, 256], fried_rice: [1222, 734, 304, 244],
}
export type FoodItem = keyof typeof BOX

export function Food({ item, size = 96, className = '', style }: { item: FoodItem; size?: number; className?: string; style?: React.CSSProperties }) {
  const [x, y, w, h] = BOX[item]
  const height = Math.round((size * h) / w)
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block select-none ${className}`}
      style={{
        width: size, height,
        backgroundImage: 'url(/food-sprite.jpg)', backgroundRepeat: 'no-repeat',
        backgroundSize: `${(SHEET_W / w) * 100}% ${(SHEET_H / h) * 100}%`,
        backgroundPosition: `${(x / (SHEET_W - w)) * 100}% ${(y / (SHEET_H - h)) * 100}%`,
        mixBlendMode: 'multiply',
        ...style,
      }}
    />
  )
}

const ALL: FoodItem[] = ['ramen', 'dumplings', 'sushi', 'fried_rice', 'boba', 'pad_thai', 'tempura', 'curry', 'poke', 'wings', 'burger', 'tacos', 'pizza', 'salad', 'steak', 'burrito', 'chicken_sandwich', 'breakfast_sandwich', 'fries', 'acai']

/**
 * Endless horizontal marquee of every dish (CSS-only; the row is duplicated so the loop is seamless; pauses on hover).
 * The animated track is its own stacking context, so `multiply` would blend against a transparent group and the
 * sprite's white cells would show. Giving the track the section's solid color (`bg`) makes white × bg = bg, i.e. invisible.
 */
export function FoodMarquee({ size = 64, bg = '#F5F7FA' }: { size?: number; bg?: string }) {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-end gap-6 pr-6" aria-hidden="true">
      {ALL.map((f) => <Food key={f} item={f} size={size} />)}
    </div>
  )
  return (
    <div className="food-marquee relative mb-8 overflow-hidden" style={{ background: bg }}>
      <div className="food-marquee-track flex w-max" style={{ background: bg }}>{row('a')}{row('b')}</div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24" style={{ background: `linear-gradient(90deg, ${bg}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24" style={{ background: `linear-gradient(270deg, ${bg}, transparent)` }} />
    </div>
  )
}
