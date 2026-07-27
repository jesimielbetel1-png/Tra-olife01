# Estrutura do projeto — Escala de Obreiros (ADVEC Vitória)

Este documento é o **mapa completo** do que foi construído, para você copiar
100%, entender e dar continuidade no seu computador. Tudo mora na pasta
`escala/` do repositório `jesimielbetel1-png/Tra-olife01`.

---

## 1. Como levar TUDO para o seu desktop

Você tem dois caminhos. Os arquivos estão na branch
**`claude/weekly-schedule-system-008214`**.

### Caminho 1 — Baixar o ZIP (não precisa saber Git)

1. Acesse: `https://github.com/jesimielbetel1-png/Tra-olife01`
2. No alto, troque a branch para **`claude/weekly-schedule-system-008214`**.
3. Botão verde **Code → Download ZIP**.
4. Descompacte. A pasta que interessa é **`escala/`**.

### Caminho 2 — Clonar com Git (recomendado para continuar o desenvolvimento)

```bash
git clone https://github.com/jesimielbetel1-png/Tra-olife01.git
cd Tra-olife01
git checkout claude/weekly-schedule-system-008214
cd escala
```

Pronto — você tem 100% do projeto igual ao que está aqui.

---

## 2. Árvore de arquivos (o que existe hoje)

```
Tra-olife01/                      ← repositório
├── index.html                    ← app ANTIGO "Tração Life" (não faz parte da escala)
├── tracao_life_01.html           ← cópia do app antigo
│
└── escala/                       ← ⭐ O SISTEMA DE ESCALA (é isto que importa)
    │
    ├── index.html                ← página que carrega o app (o "esqueleto")
    ├── styles.css                ← aparência (tema escuro/dourado ADVEC)
    ├── config.js                 ← SUAS CHAVES (Supabase, Telegram, WhatsApp)
    │
    ├── data.js                   ← camada de dados (Supabase OU modo demonstração)
    ├── engine.js                 ← motor que monta a escala da semana
    ├── app.js                    ← todas as telas (login, obreiro, liderança)
    │
    ├── schema.sql                ← banco de dados + segurança (roda no Supabase)
    │
    ├── supabase/
    │   └── functions/            ← o BOT do Telegram (3 funções de servidor)
    │       ├── telegram-webhook/index.ts   ← vincula o Telegram do obreiro
    │       ├── notify-pendentes/index.ts   ← cobra quem não lançou disponibilidade
    │       └── notify-escala/index.ts       ← avisa a escala publicada
    │
    ├── README.md                 ← guia de instalação (Supabase + Netlify + Telegram)
    ├── ESTRUTURA.md              ← este arquivo
    ├── netlify.toml              ← config para publicar no Netlify
    └── vercel.json               ← config para publicar no Vercel
```

---

## 3. O que cada arquivo faz (em detalhe)

### Frontend (o site que roda no navegador)

| Arquivo | Papel | Você mexe? |
|---|---|---|
| **index.html** | Só carrega os scripts na ordem certa e tem a `<div id="app">` onde tudo é desenhado. 25 linhas. | Raramente |
| **styles.css** | Todo o visual: cores, botões, tabelas, cards, abas. Tema escuro com dourado. | Para mudar aparência |
| **config.js** | Onde você cola a **Project URL** e a **anon key** do Supabase, o usuário do **bot do Telegram** e o **WhatsApp** da liderança. **Vazio = modo demonstração.** | **SIM** — é o primeiro que você edita |
| **data.js** | O "meio de campo": uma única API (`window.DB`) com todas as operações (listar obreiros, salvar disponibilidade, gerar escala, marcar presença...). Ela decide sozinha se fala com o **Supabase** (quando há chaves) ou com o **modo demonstração** (dados salvos no navegador, semeados com os 52 obreiros reais da planilha). | Ao adicionar novos campos/tabelas |
| **engine.js** | O **motor da escala**: recebe obreiros, aptidões, disponibilidade e histórico e devolve quem vai em cada posição. Contém as regras: balanceamento, Santa Ceia na 3ª terça, e as regras de liderança (Jesimiel/Abner nunca juntos fora da ceia). | Para mudar as regras da escala |
| **app.js** | Todas as **telas**: login, tela do obreiro (disponibilidade + Telegram), e o painel da liderança com as abas Escala, Disponibilidades, Obreiros, Frequência e Ajustes. Exporta PDF. | Para mudar telas/fluxo |

### Backend (Supabase — só quando você conecta de verdade)

| Arquivo | Papel |
|---|---|
| **schema.sql** | Cria as tabelas (`obreiros`, `aptidoes`, `disponibilidades`, `escalas`, `escala_itens`, `presencas`, `matriz_quantidade`), as **regras de segurança (RLS)** e o **gatilho** que faz toda conta nova nascer *inativa*. Você roda uma vez no SQL Editor do Supabase. |
| **supabase/functions/telegram-webhook** | Recebe as mensagens do bot. Quando o obreiro toca em *Iniciar*, grava o `chat_id` dele. |
| **supabase/functions/notify-pendentes** | A liderança dispara para lembrar quem **não lançou** a disponibilidade da semana. |
| **supabase/functions/notify-escala** | A liderança dispara depois de publicar; envia a cada obreiro **as posições dele**. |

### Publicação e documentação

| Arquivo | Papel |
|---|---|
| **README.md** | Passo a passo completo: criar Supabase, virar admin, publicar no Netlify, ligar o Telegram. |
| **netlify.toml** / **vercel.json** | Configurações prontas para publicar (site estático, sem build). |

---

## 4. Como tudo se conecta (o fluxo dos dados)

```
        NAVEGADOR (o obreiro / a liderança)
   ┌───────────────────────────────────────────┐
   │  index.html                                │
   │     ├─ styles.css      (aparência)         │
   │     ├─ config.js       (chaves)            │
   │     ├─ app.js  ────────► desenha as telas  │
   │     │        │                             │
   │     │        ▼ chama                        │
   │     ├─ data.js  (window.DB)                │
   │     │     │                                 │
   │     │     ├─ modo DEMO ► localStorage       │
   │     │     └─ modo LIVE ► Supabase ──────────┼──►  SUPABASE (nuvem)
   │     │                                       │      ├─ Auth (login por e-mail)
   │     └─ engine.js  (monta a escala)          │      ├─ Banco + RLS (schema.sql)
   │                                             │      └─ Edge Functions ──► Telegram
   └───────────────────────────────────────────┘
```

**Regra de ouro:** `app.js` e `engine.js` **nunca** falam direto com o Supabase.
Eles só chamam `window.DB` (em `data.js`). Assim o mesmo código funciona na
demonstração e no sistema de verdade — e você troca o "motor de dados" num
lugar só.

---

## 5. Rodar no seu desktop (para testar/desenvolver)

O site é **HTML puro** — não precisa instalar nada para ver funcionando em
modo demonstração. Só precisa servir a pasta por HTTP (abrir o arquivo com
duplo clique também funciona, mas servir por HTTP evita erros de navegador).

**Opção A — com Python (já vem no Mac/Linux):**
```bash
cd escala
python3 -m http.server 8000
# abra no navegador:  http://localhost:8000
```

**Opção B — com Node (se você usa):**
```bash
cd escala
npx serve .
```

**Opção C — VS Code:** instale a extensão *Live Server* e clique em
"Go Live". (Recomendo o **VS Code** como editor para continuar.)

Entre como **Ob. Jesimiel** ou **Ob. Abner** para ver o painel da liderança.

---

## 6. Modelo de dados (as tabelas do banco)

| Tabela | Guarda | Campos principais |
|---|---|---|
| `obreiros` | Uma linha por conta | id, email, nome, sexo, ativo, is_admin, prioridade, telegram_chat_id |
| `aptidoes` | Posições que cada um pode assumir (**confidencial**) | obreiro_id, posicao |
| `disponibilidades` | O que o obreiro lançou por semana | obreiro_id, semana, dom_manha, dom_noite, terca, quinta |
| `escalas` | Uma por semana | id, semana, status (rascunho/publicada) |
| `escala_itens` | Cada posição atribuída | escala_id, culto, data, posicao, obreiro_id |
| `presencas` | Frequência | item_id, presente, marcado_por |
| `matriz_quantidade` | Quantos por posição em cada culto | posicao, categoria, qtd_padrao |

---

## 7. Para dar continuidade — próximos passos sugeridos

1. **Abrir no VS Code** e rodar em modo demonstração (seção 5) para se
   familiarizar.
2. **Criar o projeto Supabase** e rodar o `schema.sql` (ver `README.md`).
3. **Preencher o `config.js`** com as chaves → o site vira "de verdade".
4. **Virar admin** com o comando SQL do `README.md`.
5. **Publicar** no Vercel ou Netlify (arquivos de config já prontos).
6. **Ligar o Telegram** (BotFather + deploy das 3 funções).

### Ideias de evolução (quando quiser)
- Importar o cadastro direto da planilha `.xlsx` para dentro do Supabase.
- Disparo **automático** do lembrete de disponibilidade toda sexta (hoje é
  manual, por botão) — exige agendamento (pg_cron) no Supabase.
- Relatório mensal de frequência em PDF.
- App instalável no celular (PWA).

---

## 8. Onde pedir ajuda ao continuar

Cada arquivo tem **comentários em português** explicando os blocos. Comece
lendo, nesta ordem: `config.js` → `data.js` → `engine.js` → `app.js`. O
`README.md` cobre a instalação; este `ESTRUTURA.md` cobre o entendimento.
