// =====================================================================
//  EDGE FUNCTION: telegram-webhook
//  Recebe as mensagens do bot. Quando o obreiro toca em "Iniciar",
//  o Telegram envia "/start <token>". Achamos o obreiro por esse token
//  e gravamos o chat_id dele para conseguir notificá-lo depois.
//
//  Publicar SEM exigir JWT (é o Telegram que chama):
//    supabase functions deploy telegram-webhook --no-verify-jwt
//
//  Registrar o webhook no Telegram (uma vez):
//    https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL_DA_FUNCTION>
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TG = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function send(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return new Response("ok");

    const chatId = msg.chat.id;
    const text: string = msg.text.trim();

    if (text.startsWith("/start")) {
      const token = text.split(/\s+/)[1];
      if (!token) {
        await send(chatId, "Olá! Abra o link de vínculo pelo site da escala para conectar sua conta.");
        return new Response("ok");
      }
      const { data: obreiro } = await admin
        .from("obreiros").select("id,nome").eq("telegram_token", token).maybeSingle();

      if (!obreiro) {
        await send(chatId, "Link expirado ou inválido. Gere um novo vínculo no site.");
        return new Response("ok");
      }
      await admin.from("obreiros")
        .update({ telegram_chat_id: String(chatId), telegram_token: null })
        .eq("id", obreiro.id);
      await send(chatId, `✅ Telegram vinculado, <b>${obreiro.nome}</b>!\nVocê receberá aqui os avisos de escala e os lembretes de disponibilidade.`);
      return new Response("ok");
    }

    await send(chatId, "Sou o bot da escala da ADVEC Vitória. Os avisos chegam por aqui automaticamente. 🙏");
    return new Response("ok");
  } catch (_e) {
    return new Response("ok"); // sempre 200 para o Telegram não reenviar
  }
});
