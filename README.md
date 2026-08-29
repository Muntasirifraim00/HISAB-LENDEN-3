# হিসাব — দোকানের খাতা ও গুদাম

ছোট ব্যবসার জন্য বাংলা হিসাব-খাতা: ক্রয়, বিক্রয়, খরচ, FIFO স্টক, লাভ, বাকি ও
কিস্তি, গ্রাহক-বিক্রেতা, গুদাম, ব্যবসায়িক পুঁজি ও রিপোর্ট — সব এক জায়গায়।
মোবাইলে "হোম স্ক্রিনে যোগ করুন" দিলে অ্যাপের মতো চলে (PWA)।

অ্যাপটি `/hisab` ঠিকানায় থাকে; মূল ঠিকানা (`/`) সেখানেই রিডাইরেক্ট করে।

## স্ট্যাক

- React 19 + TanStack Start / Router (SSR, Cloudflare Workers)
- Vite + Tailwind CSS 4 + shadcn/ui
- Supabase (Postgres, Auth, Storage) — সব লেখালেখি `hb_*` RPC দিয়ে, এক ট্রানজেকশনে
- Vitest

## ডেভেলপমেন্ট

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm run build
npm run test
npm run lint
```

## ফোল্ডার

| পথ | কী আছে |
| --- | --- |
| `src/routes/hisab.*.tsx` | অ্যাপের পাতাগুলো (ড্যাশবোর্ড, নতুন হিসাব, তালিকা, স্টক, রিপোর্ট…) |
| `src/routes/api/hisab/*` | সার্ভার এন্ডপয়েন্ট (রিপোর্ট, সার্চ, পুঁজি, AI স্ক্যান…) |
| `src/lib/hisab/*` | ডেটা স্তর, টাইপ, ফরম্যাট, সেভ করার আগের পরীক্ষা |
| `src/components/hisab/*` | অ্যাপের নিজস্ব UI অংশ |
| `supabase/migrations/*` | টেবিল, ভিউ, RPC ও RLS |

বৈশিষ্ট্যের বিস্তারিত ব্যাখ্যা: [`FEATURES.md`](./FEATURES.md)
