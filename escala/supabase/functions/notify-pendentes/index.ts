// =====================================================================
//  EDGE FUNCTION: notify-pendentes
//  A liderança chama para lembrar quem AINDA NÃO lançou a disponibilidade
//  da semana. Envia mensagem no Telegram para cada obreiro pendente que
//  já vinculou o bot.
//
//  Publicar (exige JWT — só a liderança logada chama):
//    supabase functions deploy notify-pendentes
//
//  Body: { "semana": "YYYY-MM-DD" }   (domingo da semana)
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const TG = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { semana } = await req.json();
    if (!semana) return json({ error: "semana obrigatória" }, 400);

    // confirma que quem chamou é admin
    const authClient = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);
    const admin = createClient(URL, SERVICE);
    const { data: me } = await admin.from("obreiros").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return json({ error: "apenas liderança" }, 403);

    // obreiros ativos que NÃO enviaram disponibilidade nesta semana
    const { data: ativos } = await admin.from("obreiros")
      .select("id,nome,telegram_chat_id").eq("ativo", true).eq("is_admin", false);
    const { data: envios } = await admin.from("disponibilidades").select("obreiro_id").eq("semana", semana);
    const enviaram = new Set((envios || []).map((e) => e.obreiro_id));

    const pendentes = (ativos || []).filter((o) => !enviaram.has(o.id));
    let enviados = 0;
    for (const o of pendentes) {
      if (!o.telegram_chat_id) continue;
      await send(o.telegram_chat_id,
        `🙏 Paz, <b>${o.nome}</b>!\nAinda não recebemos sua <b>disponibilidade</b> desta semana.\nPor favor, lance no sistema para entrar na escala.`);
      enviados++;
    }
    return json({ pendentes: pendentes.length, enviados });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
