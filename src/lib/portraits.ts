/* 画像按 people.ts 里的 portrait 键取图，构建时由 astro:assets 压成 webp */
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/portraits/*.{webp,png,jpg}', { eager: true });
const map = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) map.set(path.replace(/^.*\/|\.\w+$/g, ''), mod.default);

export const portraitImage = (key?: string) => (key ? map.get(key) : undefined);

/* 给客户端用的小图地址 */
export async function portraitThumb(key?: string, width = 240) {
  const img = portraitImage(key);
  if (!img) return '';
  const r = await getImage({ src: img, width, format: 'webp', quality: 78 });
  return r.src;
}
