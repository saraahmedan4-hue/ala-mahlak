// =============================================================
// الوسيط (proxy) · Supabase Edge Function باسم: llm
// -------------------------------------------------------------
// يستقبل طلب الوكيل من التطبيق، ويرسله لـ Gemini، ويرجّع الرد.
// مفتاح النموذج في أسرار Supabase بس (GEMINI_API_KEY)، ما يوصل للمتصفح أبداً.
//
// الطلب:  { "agent": "companion", "instructions": "...", "event": { ... } }
// الرد:   { "ok": true, "json": { ... } }   أو   { "ok": false, "why": "..." }
// لو النموذج تأخر أكثر من 5 ثواني يرجّع { ok: false } والتطبيق يكمل بالقواعد.
// =============================================================

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const TIMEOUT_MS = 5000;
const AGENTS = ["companion", "reports", "planner"]; // الوكلاء المسموح لهم بس
const MAX_INSTRUCTIONS = 8000; // حروف
const MAX_EVENT = 4000;        // حروف

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown) {
  // دايم 200، والتطبيق يقرأ ok ويقرر
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, why: "POST فقط" });

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return reply({ ok: false, why: "المفتاح مو موجود في الأسرار" });

  // 1) نقرأ الطلب ونتأكد منه
  let body: { agent?: string; instructions?: string; event?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, why: "الطلب مو JSON" });
  }
  const agent = String(body.agent ?? "");
  const instructions = String(body.instructions ?? "");
  const eventText = JSON.stringify(body.event ?? {});
  if (!AGENTS.includes(agent)) return reply({ ok: false, why: "وكيل غير معروف" });
  if (!instructions || instructions.length > MAX_INSTRUCTIONS) return reply({ ok: false, why: "التعليمات فاضية أو طويلة" });
  if (eventText.length > MAX_EVENT) return reply({ ok: false, why: "الحدث طويل" });

  // 2) نسأل Gemini، وإذا تأخر نوقف
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: eventText }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error("gemini error", res.status, detail); // يظهر في Logs حق الدالة
      return reply({ ok: false, why: `النموذج رجّع ${res.status}` });
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const clean = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return reply({ ok: true, json: JSON.parse(clean) });
  } catch (e) {
    const why = (e as Error).name === "AbortError" ? "النموذج تأخر" : "رد النموذج مو مفهوم";
    console.error(why, (e as Error).message);
    return reply({ ok: false, why });
  } finally {
    clearTimeout(timer);
  }
});
