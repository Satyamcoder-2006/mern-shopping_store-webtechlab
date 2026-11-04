// FORME general body-measurement chart; not a brand-certified garment chart.
export const SIZE_CHART = [
  { size: 'XS', chest: [81, 86], waist: [66, 71], shoulder: [38, 40] },
  { size: 'S', chest: [89, 94], waist: [74, 79], shoulder: [40, 42] },
  { size: 'M', chest: [97, 102], waist: [81, 86], shoulder: [42, 44] },
  { size: 'L', chest: [104, 109], waist: [89, 94], shoulder: [44, 46] },
  { size: 'XL', chest: [112, 117], waist: [97, 102], shoulder: [46, 48] },
];
export type Measurements = { height: number; weight: number; waist: number; shoulder: number; chest?: number; hip?: number; fit: 'regular' | 'relaxed' };
export function recommendSize(input: Measurements, category: string, variants: {size: string; stock: number}[] = []) {
  const bounds: Record<string, number[]> = { height: [120, 230], weight: [30, 250], waist: [45, 180], shoulder: [25, 70], chest: [60, 180], hip: [60, 190] };
  for (const [key, range] of Object.entries(bounds)) {
    const value = input[key as keyof Measurements];
    if (value === undefined && ['chest', 'hip'].includes(key)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error('Enter realistic measurements in cm and kg.');
  }
  if (!['regular', 'relaxed'].includes(input.fit) || !['Tops', 'Layers', 'Bottoms', 'Sets'].includes(category)) throw new Error('Choose a valid fit and category.');
  const notes: string[] = [];
  // Height/weight cannot identify chest, waist or body composition reliably.
  // They provide length/context advice, never an invented circumference.
  const dimensions = category === 'Bottoms' ? [{ key: 'waist', value: input.waist }] : [
    { key: 'shoulder', value: input.shoulder }, { key: 'waist', value: input.waist },
    ...(input.chest ? [{ key: 'chest', value: input.chest }] : []),
  ];
  let index = 0, beyond = false, between = false;
  for (const dimension of dimensions) {
    const slot = SIZE_CHART.findIndex(row => dimension.value <= row[dimension.key as 'waist' | 'shoulder' | 'chest'][1]);
    if (slot < 0) { beyond = true; continue; }
    if (slot > 0 && dimension.value < SIZE_CHART[slot][dimension.key as 'waist' | 'shoulder' | 'chest'][0]) between = true;
    index = Math.max(index, slot);
  }
  if (beyond) return { size: null, available: false, confidence: 'outside chart', notes: ['Your measurements extend beyond the current XS–XL guide. Check the garment measurements before ordering.'], chart: SIZE_CHART };
  if (input.fit === 'relaxed') { if (index === 4) notes.push('XL is the largest listed size; a relaxed fit cannot be confirmed.'); else index++; }
  if (between) notes.push('You fall between chart ranges; the roomier size is suggested.');
  if (!input.chest && category !== 'Bottoms') notes.push('Add chest/bust circumference for a more useful top recommendation.');
  if (category === 'Bottoms' && !input.hip) notes.push('Check hip and inseam measurements too; waist alone cannot confirm trouser fit.');
  if (input.hip) notes.push('Hip circumference is recorded for context; this general guide has no calibrated hip range. Check the product measurements.');
  if (input.height > 183) notes.push('Check body/sleeve or inseam length; a larger width is not a substitute for a tall cut.');
  if (input.height < 160) notes.push('Check garment length; you may prefer a shorter cut or alteration.');
  notes.push('Height and weight provide context only. Different people with the same height and weight can need different sizes.');
  if (category === 'Sets') notes.push('A set may need different top and bottom sizes. Check both pieces.');
  const size = SIZE_CHART[index].size, available = variants.some(v => v.size === size && v.stock > 0);
  return { size, available, confidence: input.chest && category !== 'Bottoms' ? 'general chart estimate' : 'limited estimate', notes, chart: SIZE_CHART };
}
