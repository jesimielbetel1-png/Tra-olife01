# Escala de Obreiros — ADVEC Vitória

Sistema para montar a **escala semanal** dos obreiros com base na
**disponibilidade** que cada um lança, controlar **frequência (presença)**,
ver **quem ainda não lançou** a disponibilidade e **avisar pelo Telegram**.

## Como funciona (o fluxo que você pediu)

1. **A liderança cadastra o obreiro.** O obreiro entra pela primeira vez com o
   e-mail dele (link mágico, sem senha). A conta nasce **inativa**.
2. **A liderança ativa** esse obreiro em *Obreiros*, define **sexo**,
   **prioridade** e as **posições que ele pode assumir** (as posições são
   confidenciais — o obreiro nunca vê).
3. **O obreiro acessa e lança a disponibilidade** da semana (quais cultos pode
   servir).
4. **A liderança gera a escala** — o sistema distribui as posições respeitando
   disponibilidade, aptidões e equilíbrio, e depois **publica**.
5. **Frequência:** após o culto, a liderança marca quem esteve presente. O
   sistema acumula o **% de presença** de cada um.
6. **Telegram:** o bot avisa a escala publicada e cobra quem não lançou.

Os cultos da semana: **Celebração Manhã**, **Celebração Noite**,
**Culto da Palavra** (terça) e **Culto da Vitória** (quinta). Na 3ª terça do
mês a terça vira **Santa Ceia** (todos os disponíveis entram).

---

## Testar agora (modo demonstração)

Não precisa de nada instalado. Abra o `index.html` (ou publique a pasta no
Netlify) **sem preencher o `config.js`**. O site roda com os **52 obreiros
reais** da planilha, salvos no seu navegador. Entre como **Ob. Jesimiel** ou
**Ob. Abner** para ver o painel da liderança; entre como outro obreiro para ver
a tela de disponibilidade.

> Tudo o que você faz no modo demonstração fica só no seu navegador. Para virar
> sistema de verdade (contas, dados compartilhados, Telegram), siga abaixo.

---

## Colocar no ar de verdade

### 1. Supabase (login + banco)

1. Crie um projeto em [supabase.com](https://supabase.com) (região **South
   America / São Paulo**).
2. **SQL Editor → New query** → cole todo o `schema.sql` → **Run**.
3. **Authentication → Providers → Email**: deixe ligado (link mágico).
4. **Project Settings → API**: copie a **Project URL** e a **anon public key**.

Cole as duas no `config.js`:

```js
window.CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_ANON_KEY: "sua-anon-key",
  TELEGRAM_BOT: "SeuBot",            // sem @
  WHATSAPP_LIDERANCA: "5581999998888",
};
```

### 2. Criar o primeiro admin (você)

Entre uma vez no site com seu e-mail (recebe o link, entra). Depois, no
Supabase → **SQL Editor**:

```sql
update public.obreiros
   set is_admin = true, ativo = true, nome = 'Jesimiel Barros', sexo = 'M'
 where email = 'SEU-EMAIL@exemplo.com';
```

Recarregue o site — agora você tem o painel da liderança.

### 3. Publicar no Netlify

- **Caminho A (arrastar):** [app.netlify.com](https://app.netlify.com) → *Add new
  site → Deploy manually* → arraste a pasta `escala/`.
- **Caminho B (GitHub):** *Import from Git* → escolha o repositório e defina o
  diretório de publicação como `escala`. Atualiza sozinho a cada push.

Depois, no Supabase → **Authentication → URL Configuration → Site URL**, cole o
endereço que o Netlify gerou (ex.: `https://escala-advec.netlify.app`), para o
link mágico voltar ao site certo.

### 4. Telegram (notificações)

1. No Telegram, fale com o **@BotFather** → `/newbot` → escolha nome e usuário.
   Guarde o **token** que ele te dá. Coloque o usuário do bot em
   `TELEGRAM_BOT` no `config.js`.
2. Instale a CLI do Supabase e faça deploy das funções (pasta
   `supabase/functions`):

   ```bash
   supabase login
   supabase link --project-ref SEU_REF
   supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...   # token do BotFather
   supabase functions deploy telegram-webhook --no-verify-jwt
   supabase functions deploy notify-pendentes
   supabase functions deploy notify-escala
   ```

3. Registre o webhook do bot (uma vez), apontando para a function:

   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SEU_REF.functions.supabase.co/telegram-webhook
   ```

Pronto. Cada obreiro toca em **“Vincular meu Telegram”** na tela dele, abre o
bot e toca em **Iniciar** — o `chat_id` é gravado e ele passa a receber avisos.
Na aba **Disponibilidades**, o botão **“Cobrar no Telegram”** avisa quem não
lançou; na aba **Escala**, **“Avisar no Telegram”** manda para cada um a sua
escala.

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Página do app (carrega os scripts) |
| `styles.css` | Aparência (tema ADVEC) |
| `config.js` | **Suas chaves** (Supabase / Telegram / WhatsApp) |
| `data.js` | Camada de dados (Supabase **ou** demonstração) |
| `engine.js` | Motor que monta a escala da semana |
| `app.js` | Telas (login, disponibilidade, painel da liderança) |
| `schema.sql` | Banco + segurança (RLS) do Supabase |
| `supabase/functions/*` | Bot do Telegram (webhook + avisos) |

## Segurança

As regras **RLS** garantem que cada obreiro só vê a própria linha e a própria
disponibilidade; **aptidões são confidenciais** (só a liderança lê); a escala
publicada é visível a todos; só a liderança edita escala, aptidões e presença.
A `anon key` pode ficar no site — quem protege os dados são as regras RLS.
