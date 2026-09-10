/**
 * Decorative food cut-outs from one sprite sheet (public/food-sprite.jpg, 5 × 4 grid on white).
 * `mix-blend-mode: multiply` makes the white cell background disappear on light surfaces, so use
 * these only on white / light-gray sections. Purely decorative: aria-hidden, no pointer events.
 */
const GRID: Record<string, [number, number]> = {
  burger: [0, 0], ramen: [1, 0], pizza: [2, 0], sushi: [3, 0], boba: [4, 0],
  wings: [0, 1], tacos: [1, 1], salad: [2, 1], chicken_sandwich: [3, 1], pad_thai: [4, 1],
  poke: [0, 2], dumplings: [1, 2], steak: [2, 2], breakfast_sandwich: [3, 2], burrito: [4, 2],
  curry: [0, 3], tempura: [1, 3], acai: [2, 3], fries: [3, 3], fried_rice: [4, 3],
}
export type FoodItem = keyof typeof GRID
const COLS = 5, ROWS = 4, CELL_RATIO = 1536 / 5 / (1024 / 4) // 1.2

export function Food({ item, size = 96, className = '', style }: { item: FoodItem; size?: number; className?: string; style?: React.CSSProperties }) {
  const [col, row] = GRID[item]
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block select-none ${className}`}
      style={{
        width: size, height: Math.round(size / CELL_RATIO),
        backgroundImage: 'url(/food-sprite.jpg)', backgroundRepeat: 'no-repeat',
        backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
        mixBlendMode: 'multiply',
        ...style,
      }}
    />
  )
}
