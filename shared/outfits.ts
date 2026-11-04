export function suggestOutfits<T extends { productId: string; category: string; gender: string; color: string; quantity: number; active: boolean; productPrice: number }>(products: T[], ids: string[]) {
  const bag = products.filter(p => ids.includes(p.productId));
  if (!bag.length) return [];
  const categories = new Set(bag.map(p => p.category)), genders = new Set(bag.map(p => p.gender).filter(g => g !== 'Unisex'));
  const neutrals = ['chalk', 'sand', 'stone', 'olive', 'oat', 'ink', 'indigo', 'black', 'white', 'beige', 'grey', 'navy'];
  const rank = (p: T) => {
    let score = 0, reason = '';
    if (p.category === 'Bottoms' && (categories.has('Tops') || categories.has('Layers')) && !categories.has('Bottoms')) { score += 10; reason = 'A bottom to finish your top-and-layer outfit.'; }
    else if (p.category === 'Tops' && categories.has('Bottoms') && !categories.has('Tops')) { score += 10; reason = 'An everyday top to pair with your bottoms.'; }
    else if (p.category === 'Layers' && !categories.has('Layers')) { score += 8; reason = 'An extra layer to bring your outfit together.'; }
    else { return { score: -1, reason: '' }; }
    if (neutrals.includes(p.color.toLowerCase())) score += 2;
    if (!bag.some(b => b.color === p.color)) score++;
    return { score, reason };
  };
  return products.filter(p => p.active && p.quantity > 0 && !ids.includes(p.productId) && (genders.size !== 1 || p.gender === 'Unisex' || genders.has(p.gender)))
    .map(product => ({ product, ...rank(product) })).filter(p => p.score >= 0).sort((a, b) => b.score - a.score || a.product.productPrice - b.product.productPrice).slice(0, 3);
}
