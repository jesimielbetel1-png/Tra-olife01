// =====================================================================
//  CAMADA DE DADOS
//  Uma única API (window.DB) que funciona em dois modos:
//   - LIVE  : conectada ao Supabase (quando config.js tem as chaves)
//   - DEMO  : dados de exemplo no navegador (localStorage), sem servidor
//  O resto do app (app.js) não precisa saber em qual modo está.
// =====================================================================
(function () {
  const CFG = window.CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  // ---------- Catálogo de posições (do catálogo da planilha) ----------
  const POSICOES = [
    { cod: "A1a", cat: "altar" }, { cod: "A1b", cat: "altar" }, { cod: "A1c", cat: "altar" },
    { cod: "A2", cat: "altar" }, { cod: "A3", cat: "altar" },
    { cod: "M1", cat: "micro" }, { cod: "M2", cat: "micro" },
    { cod: "M3", cat: "micro" }, { cod: "M4", cat: "micro" },
    { cod: "P1", cat: "porta" }, { cod: "P2", cat: "porta" },
    { cod: "E1", cat: "entrada" }, { cod: "E2", cat: "entrada" },
    { cod: "RECEPCAO", cat: "recep" },
  ];
  const CAT_DE = {};
  POSICOES.forEach((p) => (CAT_DE[p.cod] = p.cat));

  // ---------- Cadastro real (planilha CADASTRO_OBREIROS_ADVEC) ----------
  // sexo é um palpite para a demonstração; a liderança confirma na tela.
  const NOMES = [
    ["Ob. Abner", "M"], ["Ob. Jesimiel", "M"], ["Dc. Bruno", "M"], ["Ob. Joan", "M"],
    ["Ob. Saymon", "M"], ["Ob. Flavia", "F"], ["Ob. Barbara", "F"], ["Ob. João Pedro", "M"],
    ["Ob. Karol", "F"], ["Ob. Charles", "M"], ["Ob. Silvana", "F"], ["Ob. Hanniere", "F"],
    ["Ob. Aline", "F"], ["Ob. Alesson", "M"], ["Ob. Alicia", "F"], ["Ob. Daniele", "F"],
    ["Dc. Eliabe", "M"], ["Dc. Sergio", "M"], ["Ob. Hugo", "M"], ["Ob. Paulo", "M"],
    ["Ob. Jackenilson", "M"], ["Ob. Noé Neto", "M"], ["Ob. Flavio", "M"], ["Ob. Arlindo", "M"],
    ["Ob. Nataly", "F"], ["Ob. Lara", "F"], ["Ob. Mariana", "F"], ["Ob. Raphaela", "F"],
    ["Ob. Rafael Alves", "M"], ["Ob. Edyane", "F"], ["Ob. Emily", "F"], ["Ob. Marcela", "F"],
    ["Ob. Monique", "F"], ["Ob. Jackeline", "F"], ["Ob. Sandrely", "F"], ["Ob. Lucas", "M"],
    ["Ob. Maxiele", "F"], ["Ob. Widiane", "F"], ["Ob. Cicerlanea", "F"], ["Ob. Leandro", "M"],
    ["Ob. Claudionor", "M"], ["Ob. Frazão", "M"], ["Ob. Renata", "F"], ["Ob. Caline", "F"],
    ["Ob. Iago", "M"], ["Ob. Gabryell", "M"], ["Ob. Luan", "M"], ["Ob. Adonias", "M"],
    ["Ob. Roseane", "F"], ["Ob. Flavia Lais", "F"], ["Ob. Laís", "F"], ["Ob. Natali", "F"],
  ];

  // Posições de altar/microfone/porta/entrada rotativas para os homens (demo)
  const POS_HOMEM = ["A1a", "A1b", "A1c", "A2", "A3", "M1", "M2", "M3", "M4", "P1", "P2", "E1", "E2"];

  function seedDemo() {
    const obreiros = [];
    const aptidoes = {}; // id -> [pos]
    NOMES.forEach(([nome, sexo], i) => {
      const id = "demo-" + (i + 1);
      const eLider = /jesimiel|abner/i.test(nome);
      obreiros.push({
        id,
        email: nome.replace(/^(Ob\.|Dc\.|Pb\.|Pr\.)\s*/i, "").trim().toLowerCase().replace(/\s+/g, ".") + "@demo.local",
        nome,
        sexo,
        ativo: true,
        is_admin: eLider,
        prioridade: "NORMAL",
        telegram_chat_id: null,
        obs: "",
      });
      // aptidões: homens recebem um leque de posições; mulheres recepção
      if (sexo === "M") {
        const apt = new Set(["RECEPCAO"]);
        if (eLider) apt.add("A1a");
        // distribui ~5 posições por homem, deterministicamente
        for (let k = 0; k < 5; k++) apt.add(POS_HOMEM[(i * 3 + k) % POS_HOMEM.length]);
        aptidoes[id] = [...apt];
      } else {
        aptidoes[id] = ["RECEPCAO"];
      }
    });
    return {
      obreiros,
      aptidoes,
      disponibilidades: {}, // "semana|id" -> row
      escalas: {},          // semana -> {status, itens:[]}
      presencas: {},        // itemId -> presente(bool)
      sessionId: null,      // quem está "logado" na demo
    };
  }

  // =============================== DEMO ================================
  const DEMO = {
    KEY: "escala_advec_demo_v1",
    store: null,
    load() {
      if (this.store) return this.store;
      try {
        this.store = JSON.parse(localStorage.getItem(this.KEY));
      } catch (_) { this.store = null; }
      if (!this.store || !this.store.obreiros) {
        this.store = seedDemo();
        this.save();
      }
      return this.store;
    },
    save() { localStorage.setItem(this.KEY, JSON.stringify(this.store)); },
    reset() { this.store = seedDemo(); this.save(); },
  };

  // =============================== LIVE ================================
  let sb = null;
  if (LIVE) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }

  // ----------------------------------------------------------------
  //  API pública
  // ----------------------------------------------------------------
  const listeners = [];
  const DB = {
    LIVE,
    POSICOES,
    CAT_DE,
    mode: LIVE ? "live" : "demo",

    onChange(cb) { listeners.push(cb); },
    _emit() { listeners.forEach((cb) => { try { cb(); } catch (_) {} }); },

    // ---------------- AUTENTICAÇÃO ----------------
    async init() {
      if (LIVE) {
        sb.auth.onAuthStateChange(() => this._emit());
      }
    },

    async me() {
      if (LIVE) {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        const { data } = await sb.from("obreiros").select("*").eq("id", user.id).maybeSingle();
        return data || { id: user.id, email: user.email, nome: "", ativo: false, is_admin: false };
      }
      const s = DEMO.load();
      return s.obreiros.find((o) => o.id === s.sessionId) || null;
    },

    // login LIVE: link mágico por e-mail
    async signIn(email) {
      if (!LIVE) throw new Error("Login por e-mail só no modo conectado.");
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    },

    async signOut() {
      if (LIVE) { await sb.auth.signOut(); }
      else { const s = DEMO.load(); s.sessionId = null; DEMO.save(); }
      this._emit();
    },

    // DEMO: lista para o seletor "entrar como" e login local
    demoUsers() { return DEMO.load().obreiros.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")); },
    demoLoginAs(id) { const s = DEMO.load(); s.sessionId = id; DEMO.save(); this._emit(); },
    demoReset() { DEMO.reset(); this._emit(); },

    // ---------------- OBREIROS ----------------
    async listObreiros() {
      if (LIVE) {
        const { data } = await sb.from("obreiros").select("*").order("nome");
        return data || [];
      }
      return DEMO.load().obreiros.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    async updateObreiro(id, patch) {
      if (LIVE) {
        const { error } = await sb.from("obreiros").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const s = DEMO.load();
        Object.assign(s.obreiros.find((o) => o.id === id), patch);
        DEMO.save();
      }
      this._emit();
    },

    async getAptidoes(id) {
      if (LIVE) {
        const { data } = await sb.from("aptidoes").select("posicao").eq("obreiro_id", id);
        return (data || []).map((r) => r.posicao);
      }
      return (DEMO.load().aptidoes[id] || []).slice();
    },

    async setAptidoes(id, arr) {
      if (LIVE) {
        await sb.from("aptidoes").delete().eq("obreiro_id", id);
        if (arr.length) {
          await sb.from("aptidoes").insert(arr.map((p) => ({ obreiro_id: id, posicao: p })));
        }
      } else {
        DEMO.load().aptidoes[id] = arr.slice(); DEMO.save();
      }
      this._emit();
    },

    // map completo de aptidões (para o motor de escala) — só admin
    async aptidoesMap() {
      if (LIVE) {
        const { data } = await sb.from("aptidoes").select("obreiro_id,posicao");
        const m = {};
        (data || []).forEach((r) => { (m[r.obreiro_id] = m[r.obreiro_id] || []).push(r.posicao); });
        return m;
      }
      return DEMO.load().aptidoes;
    },

    // ---------------- DISPONIBILIDADE ----------------
    async getDisponibilidade(semana, obreiroId) {
      if (LIVE) {
        const { data } = await sb.from("disponibilidades").select("*")
          .eq("semana", semana).eq("obreiro_id", obreiroId).maybeSingle();
        return data || null;
      }
      return DEMO.load().disponibilidades[semana + "|" + obreiroId] || null;
    },

    async saveDisponibilidade(semana, obreiroId, payload) {
      const row = { obreiro_id: obreiroId, semana, ...payload, enviado_em: new Date().toISOString() };
      if (LIVE) {
        const { error } = await sb.from("disponibilidades").upsert(row);
        if (error) throw error;
      } else {
        DEMO.load().disponibilidades[semana + "|" + obreiroId] = row; DEMO.save();
      }
      this._emit();
    },

    async listDisponibilidades(semana) {
      if (LIVE) {
        const { data } = await sb.from("disponibilidades").select("*").eq("semana", semana);
        return data || [];
      }
      const s = DEMO.load();
      return Object.keys(s.disponibilidades)
        .filter((k) => k.startsWith(semana + "|"))
        .map((k) => s.disponibilidades[k]);
    },

    // ---------------- ESCALA ----------------
    async getEscala(semana) {
      if (LIVE) {
        const { data: esc } = await sb.from("escalas").select("*").eq("semana", semana).maybeSingle();
        if (!esc) return null;
        const { data: itens } = await sb.from("escala_itens").select("*").eq("escala_id", esc.id);
        return { ...esc, itens: itens || [] };
      }
      const e = DEMO.load().escalas[semana];
      return e ? { semana, status: e.status, itens: e.itens } : null;
    },

    async saveEscala(semana, itens, status = "rascunho") {
      if (LIVE) {
        let { data: esc } = await sb.from("escalas").select("id").eq("semana", semana).maybeSingle();
        if (!esc) {
          const r = await sb.from("escalas").insert({ semana, status }).select("id").single();
          esc = r.data;
        } else {
          await sb.from("escalas").update({ status }).eq("id", esc.id);
          await sb.from("escala_itens").delete().eq("escala_id", esc.id);
        }
        const rows = itens.map((it) => ({ escala_id: esc.id, ...it }));
        if (rows.length) await sb.from("escala_itens").insert(rows);
      } else {
        // gera ids locais para permitir marcar presença
        let n = 0;
        const withIds = itens.map((it) => ({ id: semana + "-i" + (n++), ...it }));
        DEMO.load().escalas[semana] = { status, itens: withIds }; DEMO.save();
      }
      this._emit();
    },

    async setEscalaStatus(semana, status) {
      if (LIVE) { await sb.from("escalas").update({ status }).eq("semana", semana); }
      else { const e = DEMO.load().escalas[semana]; if (e) { e.status = status; DEMO.save(); } }
      this._emit();
    },

    // ---------------- PRESENÇA / FREQUÊNCIA ----------------
    async getPresencas(semana) {
      const esc = await this.getEscala(semana);
      if (!esc) return {};
      if (LIVE) {
        const ids = esc.itens.map((i) => i.id);
        if (!ids.length) return {};
        const { data } = await sb.from("presencas").select("*").in("item_id", ids);
        const m = {}; (data || []).forEach((p) => (m[p.item_id] = p.presente)); return m;
      }
      const s = DEMO.load(); const m = {};
      esc.itens.forEach((i) => { if (i.id in s.presencas) m[i.id] = s.presencas[i.id]; });
      return m;
    },

    async markPresenca(itemId, presente) {
      if (LIVE) {
        const me = await this.me();
        await sb.from("presencas").upsert({ item_id: itemId, presente, marcado_por: me.id, marcado_em: new Date().toISOString() });
      } else { DEMO.load().presencas[itemId] = presente; DEMO.save(); }
      this._emit();
    },

    // Frequência acumulada por obreiro (todas as semanas em memória/no banco)
    async freqStats() {
      const byId = {}; // id -> {escalado, presente}
      if (LIVE) {
        const { data: itens } = await sb.from("escala_itens").select("id,obreiro_id");
        const { data: pres } = await sb.from("presencas").select("item_id,presente");
        const presMap = {}; (pres || []).forEach((p) => (presMap[p.item_id] = p.presente));
        (itens || []).forEach((it) => {
          if (!it.obreiro_id) return;
          const r = (byId[it.obreiro_id] = byId[it.obreiro_id] || { escalado: 0, presente: 0, faltou: 0 });
          r.escalado++;
          if (presMap[it.id] === true) r.presente++;
          if (presMap[it.id] === false) r.faltou++;
        });
      } else {
        const s = DEMO.load();
        Object.values(s.escalas).forEach((e) => {
          e.itens.forEach((it) => {
            if (!it.obreiro_id) return;
            const r = (byId[it.obreiro_id] = byId[it.obreiro_id] || { escalado: 0, presente: 0, faltou: 0 });
            r.escalado++;
            if (s.presencas[it.id] === true) r.presente++;
            if (s.presencas[it.id] === false) r.faltou++;
          });
        });
      }
      return byId;
    },

    // ---------------- TELEGRAM ----------------
    // Gera um token de vínculo e devolve o link t.me/<bot>?start=<token>
    async gerarLinkTelegram(obreiroId) {
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      if (LIVE) {
        await sb.from("obreiros").update({ telegram_token: token }).eq("id", obreiroId);
      } else {
        // demo: já "vincula" na hora para ilustrar
        const o = DEMO.load().obreiros.find((x) => x.id === obreiroId);
        if (o) { o.telegram_chat_id = "demo-chat"; DEMO.save(); }
      }
      const bot = CFG.TELEGRAM_BOT || "SEU_BOT";
      return { token, link: `https://t.me/${bot}?start=${token}` };
    },

    // Chama uma Edge Function do Supabase (Telegram). Em demo, simula.
    async invoke(name, body) {
      if (!LIVE) return { simulado: true };
      const { data, error } = await sb.functions.invoke(name, { body });
      if (error) throw error;
      return data;
    },
  };

  window.DB = DB;
})();
