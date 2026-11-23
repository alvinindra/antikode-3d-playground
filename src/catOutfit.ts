export const catOutfits = { brazil: 'Brazil', jounin: 'Jounin' } as const;
export type CatOutfit = keyof typeof catOutfits;

const storageKey = 'antikode-playground.coretax-outfit';

export function readCatOutfit(): CatOutfit {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'konoha') return 'jounin';
    if (saved && Object.hasOwn(catOutfits, saved)) return saved as CatOutfit;
  } catch { /* Storage may be disabled. */ }
  return 'brazil';
}

export function saveCatOutfit(outfit: CatOutfit) {
  try { localStorage.setItem(storageKey, outfit); }
  catch { /* The outfit still applies for this visit. */ }
}
