/**
 * ড্রাফট — লিখতে লিখতে নেট চলে গেলে বা ভুলে পাতা বন্ধ হলে লেখা হারায় না।
 * সেভ হওয়ার পর ড্রাফট মুছে যায়।
 *
 * আলাদা পাতা (নতুন হিসাব / ইনভয়েস মেকার) আলাদা চাবিতে ড্রাফট রাখে,
 * যাতে একটার লেখা আরেকটার জায়গায় না বসে।
 */
const DEFAULT_KEY = "hisab:draft:new-entry";

export function saveDraft(value: unknown, key: string = DEFAULT_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* স্টোরেজ বন্ধ থাকলে চুপচাপ এগোবে */
  }
}

export function loadDraft<T>(
  maxAgeMs = 7 * 86_400_000,
  key: string = DEFAULT_KEY,
): { at: number; value: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: T };
    if (!parsed?.at || Date.now() - parsed.at > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(key: string = DEFAULT_KEY) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* উপেক্ষা */
  }
}
