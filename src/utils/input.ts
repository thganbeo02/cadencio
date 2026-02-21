export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}
