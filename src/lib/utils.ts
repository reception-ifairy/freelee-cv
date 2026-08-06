import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is stored in minor units; format only at the edge. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function formatCredits(credits: number) {
  if (credits >= 1_000_000) return `${(credits / 1_000_000).toFixed(1)}M`;
  if (credits >= 10_000) return `${(credits / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US').format(credits);
}

export function formatDate(date: Date | string | null | undefined, style: 'short' | 'long' = 'short') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { dateStyle: style === 'long' ? 'long' : 'medium' }).format(d);
}

export function relativeTime(date: Date | string | null | undefined) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) return rtf.format(Math.round(seconds / secondsInUnit), unit);
  }

  return rtf.format(seconds, 'second');
}

export function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function truncate(input: string | null | undefined, length: number) {
  if (!input) return '';
  return input.length <= length ? input : `${input.slice(0, length - 1).trimEnd()}…`;
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function readingMinutes(markdown: string) {
  const words = markdown.replace(/[#*_>`[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
