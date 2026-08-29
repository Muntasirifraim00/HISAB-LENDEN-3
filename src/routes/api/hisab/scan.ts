import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * AI স্ক্যান (OCR) — মেমোর ছবি থেকে তারিখ, টাকা, পরিশোধ, পার্টির নাম ও
 * বিবরণ পড়ার চেষ্টা করে। ফলাফল ফর্ম ভরে দেয়, সরাসরি সেভ করে না —
 * ব্যবহারকারীকে সবসময় মিলিয়ে নিতে হয়।
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3-flash-preview";

const BodySchema = z.object({
  // data URL: data:image/jpeg;base64,....  (সর্বোচ্চ ~৮ MB)
  image: z.string().min(64).max(11_000_000),
  type: z.enum(["expense", "purchase", "sale"]).optional(),
});

const PROMPT = `তুমি একটা বাংলাদেশি দোকানের হিসাবরক্ষক। ছবিটা একটা মেমো / রসিদ / চালান / ইনভয়েস।
ছবি থেকে যা পড়তে পারো তা বের করে শুধু JSON দাও, আর কিছু নয়।

JSON-এর কাঠামো:
{
  "invoice_date": "YYYY-MM-DD বা null",
  "memo_no": "মেমো/চালান নম্বর বা null",
  "party_name": "দোকান বা পার্টির নাম বা null",
  "total_amount": সংখ্যা বা null,
  "paid_amount": সংখ্যা বা null,
  "details": "সংক্ষিপ্ত বিবরণ, বাংলায়, ১৫০ অক্ষরের কম",
  "items": [{ "product_name": "নাম", "qty": সংখ্যা, "unit_price": সংখ্যা }],
  "confidence": ০ থেকে ১ এর মধ্যে সংখ্যা
}

নিয়ম:
- যা ছবিতে স্পষ্ট নেই, সেটা null দাও — অনুমান করো না।
- টাকার অঙ্ক শুধু সংখ্যা, কোনো চিহ্ন বা কমা নয়।
- বাংলা অঙ্ক (০-৯) দেখলে ইংরেজি সংখ্যায় বদলে দাও।
- হাতে লেখা মেমো হলে confidence কম দাও।
- items না থাকলে খালি অ্যারে দাও।`;

export const Route = createFileRoute("/api/hisab/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json(
            { error: "AI স্ক্যান চালু নেই (LOVABLE_API_KEY নেই)।" },
            { status: 503 },
          );
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "ছবিটা পড়া গেল না।" }, { status: 400 });
        }

        if (!/^data:image\/(jpe?g|png|webp|heic);base64,/i.test(body.image)) {
          return Response.json({ error: "শুধু ছবি ফাইল দেওয়া যাবে।" }, { status: 400 });
        }

        let res: Response;
        try {
          res = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: VISION_MODEL,
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: PROMPT },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `এই মেমোটা পড়ো। ধরন: ${body.type ?? "অজানা"}`,
                    },
                    { type: "image_url", image_url: { url: body.image } },
                  ],
                },
              ],
            }),
          });
        } catch {
          return Response.json({ error: "AI সার্ভারে পৌঁছানো গেল না।" }, { status: 502 });
        }

        if (res.status === 429) {
          return Response.json(
            { error: "একটু পরে আবার চেষ্টা করুন (অনেক বেশি অনুরোধ)।" },
            { status: 429 },
          );
        }
        if (res.status === 402) {
          return Response.json({ error: "AI ক্রেডিট শেষ।" }, { status: 402 });
        }
        if (!res.ok) {
          return Response.json({ error: `AI ত্রুটি ${res.status}` }, { status: 502 });
        }

        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content ?? "";

        try {
          const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
          const parsed = JSON.parse((fence ? fence[1] : raw).trim());
          return Response.json({ ok: true, result: sanitize(parsed) });
        } catch {
          return Response.json({ error: "AI যা দিল তা বোঝা গেল না।" }, { status: 502 });
        }
      },
    },
  },
});

/** AI যা দিল তা ছেঁকে নিরাপদ আকারে ফেরত */
function sanitize(input: unknown) {
  const o = (input ?? {}) as Record<string, unknown>;

  const numeric = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };
  const text = (v: unknown, max: number) => {
    const s = String(v ?? "").trim();
    return s && s !== "null" ? s.slice(0, max) : null;
  };
  const isoDate = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const today = new Date().toISOString().slice(0, 10);
    return s > today ? null : s; // ভবিষ্যতের তারিখ নেওয়া হয় না
  };

  const items = Array.isArray(o.items)
    ? o.items.slice(0, 30).map((raw) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          product_name: text(it.product_name, 120) ?? "পণ্য",
          qty: numeric(it.qty) ?? 1,
          unit_price: numeric(it.unit_price) ?? 0,
        };
      })
    : [];

  const conf = Number(o.confidence);

  return {
    invoice_date: isoDate(o.invoice_date),
    memo_no: text(o.memo_no, 60),
    party_name: text(o.party_name, 120),
    total_amount: numeric(o.total_amount),
    paid_amount: numeric(o.paid_amount),
    details: text(o.details, 300),
    items,
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
  };
}
