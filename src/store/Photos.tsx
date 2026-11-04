import React, { useRef, useState } from 'react';
import { api } from './api';
export default function Photos({ images, setImages, max = 3, onBusyChange }: { images: string[]; setImages: (images: string[]) => void; max?: number; onBusyChange?: (busy: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [previews, setPreviews] = useState<Record<string, string>>({});
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])]; e.target.value = ''; if (!files.length) return;
    if (files.length + images.length > max) { setError(`Choose at most ${max} photos.`); return; }
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const data: string[] = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) throw new Error('Use JPEG, PNG or WebP photos under 6 MB each.');
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        try {
          if (bitmap.width * bitmap.height > 20_000_000 || Math.min(bitmap.width, bitmap.height) < 64) throw new Error('Use photos between 64px and 20 megapixels.');
          const canvas = document.createElement('canvas'), scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
          const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          let photo = canvas.toDataURL('image/webp', .78); if (photo.length > 350000) photo = canvas.toDataURL('image/webp', .55);
          if (photo.length > 350000) throw new Error('This photo is too detailed to upload. Please use a smaller photo.');
          data.push(photo);
        } finally { bitmap.close(); }
      }
      const result = await api('/api/media', 'POST', { images: data });
      setPreviews(prev => ({ ...prev, ...Object.fromEntries(result.images.map((url: string, i: number) => [url, data[i]])) })); setImages([...images, ...result.images]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); onBusyChange?.(false); }
  };
  return <div className="photo-picker"><div className="photo-thumbs">{images.map((url, i) => <div key={url}><img src={previews[url] || url} alt={`Photo ${i + 1}`} /><button type="button" disabled={busy} aria-label={`Remove photo ${i + 1}`} onClick={() => { setImages(images.filter(u => u !== url)); setError(''); }}>×</button></div>)}</div><button type="button" className="btn outline" disabled={busy || images.length >= max} onClick={() => inputRef.current?.click()}>{busy ? 'Uploading photos…' : `Add photos (${images.length}/${max})`}</button><input ref={inputRef} type="file" aria-label="Choose photos" hidden multiple accept="image/jpeg,image/png,image/webp" disabled={busy || images.length >= max} onChange={pick} /><p className="fine-print">Up to {max} photos · JPEG, PNG or WebP · 6 MB maximum each. Photos become public when you publish.</p>{error && <p role="alert" className="error-text">{error}</p>}</div>;
}
