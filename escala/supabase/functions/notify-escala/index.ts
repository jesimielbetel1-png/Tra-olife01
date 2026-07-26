// =====================================================================
//  EDGE FUNCTION: notify-escala
//  A liderança chama depois de publicar a escala. Envia para cada obreiro,
//  no Telegram, as posições em que ele foi escalado na semana.
//
//  Publicar (exige JWT):  supabase functions deploy notify-escala
//  Body: { "semana": "YYYY-MM-DD" }
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const TG = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

const NOME_CULTO: Record<string, string> = {
  DOM_M: "Celebração Manhã", DOM_N: "Celebração Noite",
  PALAVRA: "Culto da Palavra", VITORIA: "Culto da Vitória", CEIA: "Santa Ceia",
};
const brData = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

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

    const authClient = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);
    const admin = createClient(URL, SERVICE);
    const { data: me } = await admin.from("obreiros").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return json({ error: "apenas liderança" }, 403);

    const { data: esc } = await admin.from("escalas").select("id,status").eq("semana", semana).maybeSingle();
    if (!esc) return json({ error: "sem escala nesta semana" }, 404);

    const { data: itens } = await admin.from("escala_itens")
      .select("culto,data,posicao,obreiro_id").eq("escala_id", esc.id);
    const { data: obreiros } = await admin.from("obreiros")
      .select("id,nome,telegram_chat_id").eq("ativo", true);

    const porObreiro: Record<string, { nome: string; chat: string | null; linhas: string[] }> = {};
    for (const o of obreiros || []) porObreiro[o.id] = { nome: o.nome, chat: o.telegram_chat_id, linhas: [] };
    for (const it of itens || []) {
      if (!it.obreiro_id || !porObreiro[it.obreiro_id]) continue;
      porObreiro[it.obreiro_id].linhas.push(
        `• ${NOME_CULTO[it.culto] || it.culto} (${brData(it.data)}) — <b>${it.posicao}</b>`);
    }

    let enviados = 0;
    for (const id of Object.keys(porObreiro)) {
      const p = porObreiro[id];
      if (!p.chat || !p.linhas.length) continue;
      await send(p.chat, `📅 <b>Sua escala da semana</b>\n${p.linhas.join("\n")}\n\nDeus abençoe seu serviço! 🙏`);
      enviados++;
    }
    return json({ enviados });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
