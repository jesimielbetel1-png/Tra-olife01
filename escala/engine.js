// =====================================================================
//  MOTOR DE ESCALA — semanal
//  Recebe obreiros ativos, aptidões, disponibilidade da semana e o
//  histórico (para balancear) e devolve a lista de atribuições.
//  Regras de liderança (Jesimiel / Abner) preservadas do protótipo.
// =====================================================================
(function () {
  const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Posições preenchidas em um culto comum
  const ALTAR = ["A1a", "A1b", "A1c", "A2", "A3"];
  const MICROS = ["M1", "M2"];       // padrão 2 (ajustável)
  const PORTA = ["P1", "P2"];
  const ENTRADA = ["E1"];
  const RECEP_QTD = 6;

  // ---- monta os cultos da semana a partir do domingo (YYYY-MM-DD) ----
  function cultosDaSemana(semanaISO) {
    const [y, m, d] = semanaISO.split("-").map(Number);
    const dom = new Date(Date.UTC(y, m - 1, d));
    const add = (n) => {
      const x = new Date(dom); x.setUTCDate(x.getUTCDate() + n);
      return x.toISOString().slice(0, 10);
    };
    const terca = add(2), quinta = add(4);

    // Ceia = 3ª terça do mês
    const tDate = new Date(Date.UTC(y, m - 1, d)); tDate.setUTCDate(tDate.getUTCDate() + 2);
    const terceiraTerca = Math.ceil(tDate.getUTCDate() / 7) === 3;

    return [
      { key: "DOM_M", nome: "Celebração Manhã", data: semanaISO, flag: "dom_manha" },
      { key: "DOM_N", nome: "Celebração Noite", data: semanaISO, flag: "dom_noite" },
      terceiraTerca
        ? { key: "CEIA", nome: "Santa Ceia", data: terca, flag: "terca", ceia: true }
        : { key: "PALAVRA", nome: "Culto da Palavra", data: terca, flag: "terca" },
      { key: "VITORIA", nome: "Culto da Vitória", data: quinta, flag: "quinta" },
    ];
  }

  // ------------------------------ gerar ------------------------------
  //  ctx = { obreiros, aptidoes, disp, historico, semana, weekNo }
  //   obreiros : [{id, nome, sexo, ativo, prioridade}]
  //   aptidoes : { id: [pos...] }
  //   disp     : { id: {dom_manha,dom_noite,terca,quinta} }   (só quem enviou)
  //   historico: { id: nºatuações anteriores }  (para balancear)
  function gerar(ctx) {
    const { obreiros, aptidoes, disp, historico, semana } = ctx;
    const ativos = obreiros.filter((o) => o.ativo);
    const cultos = cultosDaSemana(semana);

    const cont = {};      // id -> atuações nesta semana
    const contPos = {};   // id -> {pos:count}
    ativos.forEach((o) => { cont[o.id] = 0; contPos[o.id] = {}; });

    const lider = {
      jes: ativos.find((o) => /jesimiel/i.test(o.nome)),
      abn: ativos.find((o) => /abner/i.test(o.nome)),
    };
    const weekNo = ctx.weekNo || 0;

    function disponivel(o, culto) {
      const d = disp[o.id];
      if (!d) return false;               // não enviou disponibilidade => fora
      return !!d[culto.flag];
    }
    function apto(o, pos) { return (aptidoes[o.id] || []).includes(pos); }

    function score(o, pos) {
      const h = historico[o.id] || 0;
      const atual = cont[o.id] || 0;
      const posCount = (contPos[o.id] || {})[pos] || 0;
      let prio = 0;
      if (o.prioridade === "ALTA") prio = -3;
      if (o.prioridade === "BAIXA") prio = 3;
      return (h + atual) * 2 + posCount * 5 + prio;
    }

    function usar(o, pos, culto, atrib, usados) {
      atrib.push({ culto: culto.key, data: culto.data, posicao: pos, obreiro_id: o.id });
      usados.add(o.id);
      cont[o.id]++; contPos[o.id][pos] = (contPos[o.id][pos] || 0) + 1;
    }

    const itens = [];

    cultos.forEach((culto) => {
      const usados = new Set();

      // ---- reservas de liderança ----
      const reservas = {}; // id -> pos
      if (culto.ceia) {
        if (lider.jes) reservas[lider.jes.id] = "A1a";
        if (lider.abn) reservas[lider.abn.id] = "A1b";
      } else if (culto.key === "DOM_M" && lider.jes) {
        reservas[lider.jes.id] = "A1a";
      } else if (culto.key === "DOM_N" && lider.abn) {
        reservas[lider.abn.id] = "A1a";
      } else if (culto.key === "PALAVRA") {
        const l = weekNo % 2 === 0 ? lider.jes : lider.abn; if (l) reservas[l.id] = "A1a";
      } else if (culto.key === "VITORIA") {
        const l = weekNo % 2 === 0 ? lider.abn : lider.jes; if (l) reservas[l.id] = "A1a";
      }
      Object.entries(reservas).forEach(([id, pos]) => {
        const o = ativos.find((x) => x.id === id);
        if (o && disponivel(o, culto) && apto(o, pos)) usar(o, pos, culto, itens, usados);
        else delete reservas[id];
      });
      // Jesimiel e Abner nunca juntos fora da ceia
      if (!culto.ceia && lider.jes && lider.abn) {
        if (reservas[lider.jes.id] && !reservas[lider.abn.id]) usados.add(lider.abn.id);
        if (reservas[lider.abn.id] && !reservas[lider.jes.id]) usados.add(lider.jes.id);
      }

      // ---- posições fixas ----
      const posFixas = culto.ceia
        ? ["A1a", "A1b", "A1c", "A2", "A3"]                 // ceia: altar + apoio geral
        : [...ALTAR, ...MICROS, ...PORTA, ...ENTRADA];

      posFixas.forEach((pos) => {
        if (itens.some((i) => i.data === culto.data && i.culto === culto.key && i.posicao === pos)) return;
        const cands = ativos.filter((o) =>
          !usados.has(o.id) && disponivel(o, culto) && apto(o, pos));
        if (!cands.length) { itens.push({ culto: culto.key, data: culto.data, posicao: pos, obreiro_id: null }); return; }
        cands.sort((a, b) => score(a, pos) - score(b, pos));
        usar(cands[0], pos, culto, itens, usados);
      });

      // ---- recepção ----
      const recepCands = ativos.filter((o) => !usados.has(o.id) && disponivel(o, culto) && apto(o, "RECEPCAO"));
      recepCands.sort((a, b) => score(a, "RECEPCAO") - score(b, "RECEPCAO"));
      const nRecep = culto.ceia ? recepCands.length : Math.min(RECEP_QTD, recepCands.length);
      recepCands.slice(0, nRecep).forEach((o) => usar(o, "RECEPCAO", culto, itens, usados));

      // ---- ceia: todo mundo que sobrou entra como APOIO ----
      if (culto.ceia) {
        ativos.filter((o) => !usados.has(o.id) && disponivel(o, culto))
          .forEach((o) => usar(o, "APOIO", culto, itens, usados));
      }
    });

    return { cultos, itens };
  }

  window.ENGINE = { gerar, cultosDaSemana, NOMES_DIA };
})();
