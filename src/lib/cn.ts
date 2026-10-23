/* 汉字数字：十几不带“一”，中间缺位补“零”，过万写“万”。页面上一律不用阿拉伯数字 */
const NUM = '零一二三四五六七八九';
export function cn(n: number): string {
  if (n >= 10000) {
    const lo = n % 10000;
    return cn(Math.floor(n / 10000)) + '万' + (lo ? (lo < 1000 ? '零' : '') + cn(lo) : '');
  }
  if (n < 10) return NUM[n];
  if (n < 20) return '十' + (n % 10 ? NUM[n % 10] : '');
  const units = ['', '十', '百', '千'];
  const ds = String(n).split('').map(Number);
  let out = '', zero = false;
  ds.forEach((d, i) => {
    const u = units[ds.length - 1 - i];
    if (d === 0) { zero = true; return; }
    if (zero && out) out += '零';
    zero = false;
    out += NUM[d] + u;
  });
  return out;
}
