// Supabase Edge Function: "traer"
// Intermediario confiable para que el cancionero pueda leer la hoja de acordes
// de La Cuerda / Cifra Club (y buscar) sin el bloqueo CORS del navegador.
//
// Deploy (una sola vez):
//   supabase login
//   supabase link --project-ref kqpgabjavqdhjukdgunz
//   supabase functions deploy traer --no-verify-jwt
//
// Uso desde la app:
//   https://<tu-proyecto>.supabase.co/functions/v1/traer?url=<link>
//
// Seguridad: solo deja pasar los sitios de acordes y el buscador, así no queda
// como un proxy abierto para cualquier cosa.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dominios permitidos: lacuerda.net, cifraclub.com(.br) y duckduckgo.com (buscador)
const ALLOWED = /(^|\.)(lacuerda\.net|cifraclub\.com(\.br)?|duckduckgo\.com)$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const target = new URL(req.url).searchParams.get("url") || "";
    if (!/^https?:\/\//i.test(target)) {
      return new Response("Falta el parámetro ?url=", { status: 400, headers: CORS });
    }

    let host = "";
    try { host = new URL(target).hostname; } catch { /* url inválida */ }
    if (!ALLOWED.test(host)) {
      return new Response("Dominio no permitido: " + host, { status: 403, headers: CORS });
    }

    // Headers de navegador real: algunos sitios (ej. Cifra Club / Akamai) rechazan
    // pedidos que no parecen un navegador.
    let referer = "/";
    try { referer = new URL(target).origin + "/"; } catch { /* ignore */ }
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Referer": referer,
      },
      redirect: "follow",
    });

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    return new Response(
      "Error al traer: " + (e instanceof Error ? e.message : String(e)),
      { status: 502, headers: CORS },
    );
  }
});
