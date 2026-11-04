// FORME general body-measurement chart; not a brand-certified garment chart.
export const SIZE_CHART = [
  { size: 'XS', chest: [81, 86], waist: [66, 71], shoulder: [38, 40] },
  { size: 'S', chest: [89, 94], waist: [74, 79], shoulder: [40, 42] },
  { size: 'M', chest: [97, 102], waist: [81, 86], shoulder: [42, 44] },
  { size: 'L', chest: [104, 109], waist: [89, 94], shoulder: [44, 46] },
  { size: 'XL', chest: [112, 117], waist: [97, 102], shoulder: [46, 48] },
];
export const MEASUREMENT_FIELDS = [
  { key: 'height', label: 'Height', unit: 'cm', min: 120, max: 230, optional: false, placeholder: '175' },
  { key: 'weight', label: 'Weight', unit: 'kg', min: 30, max: 250, optional: false, placeholder: '70' },
  { key: 'waist', label: 'Waist circumference', unit: 'cm', min: 45, max: 180, optional: false, placeholder: '83' },
  { key: 'shoulder', label: 'Shoulder width, point to point', unit: 'cm', min: 25, max: 70, optional: false, placeholder: '43' },
  { key: 'chest', label: 'Chest / bust circumference', unit: 'cm', min: 60, max: 180, optional: true, placeholder: '100' },
  { key: 'hip', label: 'Hip circumference', unit: 'cm', min: 60, max: 190, optional: true, placeholder: '100' },
] as const;
export const measurementMessage = (field: typeof MEASUREMENT_FIELDS[number]) =>
  `${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`;

export type Measurements = { height: number; weight: number; waist: number; shoulder: number; chest?: number; hip?: number; fit: 'regular' | 'relaxed' };
export function recommendSize(input: Measurements, category: string, variants: {size: string; stock: number}[] = []) {
  for (const field of MEASUREMENT_FIELDS) {
    const value = input[field.key];
    if (value === undefined && field.optional) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max) {
      throw new Error(measurementMessage(field));
    }
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
