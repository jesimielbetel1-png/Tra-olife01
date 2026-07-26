// =====================================================================
//  APLICATIVO — telas de login, obreiro (disponibilidade) e liderança
// =====================================================================
(function () {
  const CFG = window.CONFIG || {};
  const app = document.getElementById("app");
  const state = { me: null, semana: domingoAtual() };

  // ------------------------------ utils ------------------------------
  function toast(msg, type = "") {
    const t = document.createElement("div");
    t.className = "toast " + type; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4200);
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const nomeCurto = (n) => (n || "").replace(/^(Ob\.|Dc\.|Pb\.|Pr\.)\s*/i, "");

  function domingoAtual() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // volta ao domingo
    return d.toISOString().slice(0, 10);
  }
  function addSemana(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d)); x.setUTCDate(x.getUTCDate() + 7 * n);
    return x.toISOString().slice(0, 10);
  }
  function weekNo(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 6048e5); // semanas desde a época
  }
  function br(iso) { const [y, m, d] = iso.split("-").map(Number); return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`; }
  function labelSemana(iso) {
    const fim = addSemana(iso, 0);
    const [y, m, d] = iso.split("-").map(Number);
    const sab = new Date(Date.UTC(y, m - 1, d)); sab.setUTCDate(sab.getUTCDate() + 6);
    return `Semana de ${br(iso)} a ${br(sab.toISOString().slice(0, 10))}`;
  }

  // ordem de exibição das posições na grade
  const GRID_POS = ["A1a", "A1b", "A1c", "A2", "A3", "M1", "M2", "P1", "P2", "E1", "RECEPCAO"];

  // =====================================================================
  //  ROTEADOR
  // =====================================================================
  async function render() {
    state.me = await DB.me();
    if (!state.me) return telaLogin();
    if (!state.me.ativo && !state.me.is_admin) return telaAguardando();
    if (state.me.is_admin) return telaAdmin();
    return telaObreiro();
  }

  function header(extra = "") {
    const m = state.me;
    const demo = DB.mode === "demo" ? `<span class="badge-demo">DEMONSTRAÇÃO</span>` : "";
    const adm = m && m.is_admin ? `<span class="badge-admin">LIDERANÇA</span>` : "";
    return `<header>
      <div class="brand"><div class="brand-mark">A</div>
        <div><h1>Escala de Obreiros</h1><p>ADVEC Vitória</p></div></div>
      <div class="userbox">${demo}${adm}
        ${m ? `<span>${esc(nomeCurto(m.nome) || m.email)}</span>` : ""}
        ${extra}
        ${m ? `<button class="btn btn-ghost btn-sm" id="btnSair">Sair</button>` : ""}
      </div></header>`;
  }
  function wireHeader() {
    const b = $("#btnSair");
    if (b) b.onclick = async () => { await DB.signOut(); };
  }

  // =====================================================================
  //  LOGIN
  // =====================================================================
  function telaLogin() {
    if (DB.mode === "demo") {
      const users = DB.demoUsers();
      app.innerHTML = `<div class="login-wrap">
        <div class="brand-mark">A</div>
        <h1>Escala de Obreiros</h1>
        <p>ADVEC Vitória — modo demonstração</p>
        <div class="login-card">
          <div class="hint">Sem Supabase configurado, o site roda com dados de exemplo salvos neste navegador.
          Entre como um obreiro (ex.: <b>Ob. Jesimiel</b> ou <b>Ob. Abner</b> são a liderança) para explorar as telas.</div>
          <label class="field">Entrar como</label>
          <select id="demoUser">${users.map((u) => `<option value="${u.id}">${esc(u.nome)}${u.is_admin ? " — liderança" : ""}</option>`).join("")}</select>
          <div class="row" style="margin-top:14px">
            <button class="btn" id="btnDemoEntrar">Entrar</button>
            <button class="btn btn-sec btn-sm" id="btnDemoReset">Recomeçar dados</button>
          </div>
        </div>
      </div>`;
      $("#btnDemoEntrar").onclick = () => DB.demoLoginAs($("#demoUser").value);
      $("#btnDemoReset").onclick = () => { DB.demoReset(); toast("Dados de exemplo recriados.", "success"); };
      return;
    }
    app.innerHTML = `<div class="login-wrap">
      <div class="brand-mark">A</div>
      <h1>Escala de Obreiros</h1>
      <p>ADVEC Vitória</p>
      <div class="login-card">
        <label class="field">Seu e-mail</label>
        <input type="email" id="email" placeholder="voce@exemplo.com" autocomplete="email">
        <button class="btn" id="btnEntrar" style="margin-top:14px;width:100%">Entrar / Receber link</button>
        <p class="muted" style="font-size:12px;margin-top:12px">Você recebe um link no e-mail para entrar sem senha.
        No primeiro acesso, sua conta fica aguardando a liberação da liderança.</p>
      </div></div>`;
    $("#btnEntrar").onclick = async () => {
      const email = $("#email").value.trim();
      if (!email) return toast("Digite seu e-mail.", "error");
      try { await DB.signIn(email); toast("Link enviado! Confira seu e-mail.", "success"); }
      catch (e) { toast("Erro: " + e.message, "error"); }
    };
  }

  function telaAguardando() {
    app.innerHTML = header() + `<div class="container"><div class="empty">
      <h3>Conta aguardando liberação</h3>
      <p>Seu cadastro foi criado. A liderança precisa ativar seu acesso e definir suas posições.<br>
      Assim que for liberado, você poderá lançar sua disponibilidade aqui.</p>
      <p class="muted" style="margin-top:16px">${esc(state.me.email || "")}</p>
    </div></div>`;
    wireHeader();
  }

  // =====================================================================
  //  TELA DO OBREIRO — disponibilidade da semana
  // =====================================================================
  async function telaObreiro() {
    const semana = state.semana;
    const disp = (await DB.getDisponibilidade(semana, state.me.id)) || {};
    const cultos = ENGINE.cultosDaSemana(semana);
    const escala = await DB.getEscala(semana);

    const card = (c) => {
      const on = !!disp[c.flag];
      return `<div class="avail-card ${on ? "on" : ""}" data-flag="${c.flag}">
        <h4>${esc(c.nome)}</h4>
        <div class="d">${esc(ENGINE.NOMES_DIA[new Date(c.data + "T12:00:00Z").getUTCDay()])} · ${br(c.data)}${c.ceia ? " · 🍷 Santa Ceia" : ""}</div>
        <label class="toggle"><input type="checkbox" ${on ? "checked" : ""}> Estou disponível</label>
      </div>`;
    };

    // atribuições do próprio obreiro (se escala publicada)
    let minhas = "";
    if (escala && escala.status === "publicada") {
      const meus = escala.itens.filter((i) => i.obreiro_id === state.me.id);
      minhas = `<div class="card"><h2>Minha escala</h2><div class="sub">${labelSemana(semana)} — já publicada</div>` +
        (meus.length ? `<div class="tbl-wrap"><table><thead><tr><th>Culto</th><th>Data</th><th>Posição</th></tr></thead><tbody>` +
          meus.map((i) => `<tr><td>${nomeCulto(i.culto)}</td><td>${br(i.data)}</td><td><span class="pill ${DB.CAT_DE[i.posicao] || "recep"}">${i.posicao}</span></td></tr>`).join("") +
          `</tbody></table></div>` : `<div class="empty"><p>Você não foi escalado nesta semana.</p></div>`) + `</div>`;
    }

    app.innerHTML = header() + `<div class="container">
      ${weekNavHTML()}
      <div class="card">
        <h2>Minha disponibilidade</h2>
        <div class="sub">Marque os cultos em que você pode servir nesta semana e salve.</div>
        <div class="avail-grid">${cultos.map(card).join("")}</div>
        <label class="field">Observação (opcional)</label>
        <input id="obs" value="${esc(disp.obs || "")}" placeholder="ex.: chego atrasado na quinta">
        <div class="row" style="margin-top:14px">
          <button class="btn" id="btnSalvar">Salvar disponibilidade</button>
          ${disp.enviado_em ? `<span class="muted">Enviado em ${new Date(disp.enviado_em).toLocaleString("pt-BR")}</span>` : `<span class="pill wait">Ainda não enviado</span>`}
        </div>
      </div>
      ${minhas}
      ${telegramCardHTML()}
    </div>`;

    wireHeader(); wireWeekNav(render); wireTelegram();
    $$(".avail-card").forEach((el) => {
      el.onclick = (e) => {
        if (e.target.tagName !== "INPUT") { const cb = $("input", el); cb.checked = !cb.checked; }
        el.classList.toggle("on", $("input", el).checked);
      };
    });
    $("#btnSalvar").onclick = async () => {
      const payload = { obs: $("#obs").value.trim() };
      $$(".avail-card").forEach((el) => (payload[el.dataset.flag] = $("input", el).checked));
      await DB.saveDisponibilidade(semana, state.me.id, payload);
      toast("Disponibilidade salva!", "success"); render();
    };
  }

  function telegramCardHTML() {
    const vinc = state.me.telegram_chat_id;
    return `<div class="card"><h2>Telegram</h2>
      <div class="sub">Receba no Telegram o aviso quando a escala sair e o lembrete de lançar disponibilidade.</div>
      ${vinc
        ? `<span class="pill ok">✓ Telegram vinculado</span>`
        : `<div class="row"><button class="btn btn-tg" id="btnTg">Vincular meu Telegram</button>
           <span class="muted">Abre o bot ${CFG.TELEGRAM_BOT ? "@" + esc(CFG.TELEGRAM_BOT) : "da igreja"} e toca em Iniciar.</span></div>
           <div id="tgLink"></div>`}
    </div>`;
  }
  function wireTelegram() {
    const b = $("#btnTg"); if (!b) return;
    b.onclick = async () => {
      const { link } = await DB.gerarLinkTelegram(state.me.id);
      if (DB.mode === "demo") { toast("Vinculado (demonstração).", "success"); return render(); }
      $("#tgLink").innerHTML = `<div class="hint">Toque para abrir: <a href="${link}" target="_blank">${esc(link)}</a><br>
        No Telegram, toque em <b>Iniciar</b>. Depois recarregue esta página.</div>`;
    };
  }

  // =====================================================================
  //  NAVEGAÇÃO DE SEMANA (compartilhada)
  // =====================================================================
  function weekNavHTML() {
    return `<div class="card"><div class="row">
      <div class="week-nav">
        <button class="btn btn-sec btn-sm" id="wkPrev">←</button>
        <span class="wk">${labelSemana(state.semana)}</span>
        <button class="btn btn-sec btn-sm" id="wkNext">→</button>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost btn-sm" id="wkHoje">Semana atual</button>
    </div></div>`;
  }
  function wireWeekNav(cb) {
    if ($("#wkPrev")) $("#wkPrev").onclick = () => { state.semana = addSemana(state.semana, -1); cb(); };
    if ($("#wkNext")) $("#wkNext").onclick = () => { state.semana = addSemana(state.semana, 1); cb(); };
    if ($("#wkHoje")) $("#wkHoje").onclick = () => { state.semana = domingoAtual(); cb(); };
  }

  function nomeCulto(k) {
    return { DOM_M: "Celebração Manhã", DOM_N: "Celebração Noite", PALAVRA: "Culto da Palavra", VITORIA: "Culto da Vitória", CEIA: "Santa Ceia" }[k] || k;
  }

  // =====================================================================
  //  PAINEL DA LIDERANÇA
  // =====================================================================
  let adminTab = "escala";
  async function telaAdmin() {
    app.innerHTML = header() + `<div class="container">
      <div class="tabs">
        <button class="tab" data-t="escala">📅 Escala</button>
        <button class="tab" data-t="disp">📥 Disponibilidades</button>
        <button class="tab" data-t="obreiros">👥 Obreiros</button>
        <button class="tab" data-t="freq">✅ Frequência</button>
        <button class="tab" data-t="config">⚙️ Ajustes</button>
      </div>
      <div id="pane"></div></div>`;
    wireHeader();
    $$(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.t === adminTab);
      t.onclick = () => { adminTab = t.dataset.t; telaAdmin(); };
    });
    const pane = $("#pane");
    if (adminTab === "escala") return paneEscala(pane);
    if (adminTab === "disp") return paneDisp(pane);
    if (adminTab === "obreiros") return paneObreiros(pane);
    if (adminTab === "freq") return paneFreq(pane);
    if (adminTab === "config") return paneConfig(pane);
  }

  // ---------------- ESCALA ----------------
  async function paneEscala(pane) {
    const semana = state.semana;
    const escala = await DB.getEscala(semana);
    const cultos = ENGINE.cultosDaSemana(semana);

    let grade = `<div class="empty"><h3>Sem escala nesta semana</h3><p>Clique em “Gerar escala” para montar a partir das disponibilidades enviadas.</p></div>`;
    if (escala) {
      const nomeDe = await mapNomes();
      const temApoio = escala.itens.some((i) => i.posicao === "APOIO");
      const linhas = GRID_POS.filter((p) => escala.itens.some((i) => i.posicao === p) || p !== "RECEPCAO");
      const cell = (culto, pos) => {
        const its = escala.itens.filter((i) => i.culto === culto.key && i.posicao === pos);
        if (!its.length) return `<td class="muted">—</td>`;
        const nomes = its.map((i) => i.obreiro_id ? nomeCurto(nomeDe[i.obreiro_id] || "?") : "—").join(", ");
        return `<td>${esc(nomes)}</td>`;
      };
      grade = `<div class="tbl-wrap"><table>
        <thead><tr><th>Posição</th>${cultos.map((c) => `<th>${esc(c.nome)}<br><span class="muted" style="font-weight:400">${br(c.data)}</span></th>`).join("")}</tr></thead>
        <tbody>
        ${linhas.map((p) => `<tr><td><span class="pill ${DB.CAT_DE[p] || ""}">${p}</span></td>${cultos.map((c) => cell(c, p)).join("")}</tr>`).join("")}
        ${temApoio ? `<tr><td><span class="pill recep">APOIO</span></td>${cultos.map((c) => cell(c, "APOIO")).join("")}</tr>` : ""}
        </tbody></table></div>`;
    }

    const statusPill = escala
      ? (escala.status === "publicada" ? `<span class="pill ok">Publicada</span>` : `<span class="pill wait">Rascunho</span>`)
      : "";

    pane.innerHTML = weekNavHTML() + `<div class="card">
      <div class="row">
        <div><h2>Escala da semana ${statusPill}</h2><div class="sub">${labelSemana(semana)}</div></div>
        <div class="spacer"></div>
        <button class="btn" id="btnGerar">✨ Gerar escala</button>
        ${escala ? `<button class="btn btn-ok" id="btnPublicar">${escala.status === "publicada" ? "Republicar" : "Publicar"}</button>` : ""}
        ${escala ? `<button class="btn btn-sec btn-sm" id="btnPdf">📄 PDF</button>` : ""}
        ${escala && escala.status === "publicada" ? `<button class="btn btn-tg btn-sm" id="btnNotif">Avisar no Telegram</button>` : ""}
      </div>
      ${grade}
    </div>`;

    wireWeekNav(() => telaAdmin());
    $("#btnGerar").onclick = () => gerarEscala(semana);
    if ($("#btnPublicar")) $("#btnPublicar").onclick = async () => {
      await DB.setEscalaStatus(semana, "publicada"); toast("Escala publicada!", "success"); telaAdmin();
    };
    if ($("#btnPdf")) $("#btnPdf").onclick = () => exportarPdf(semana, escala, cultos);
    if ($("#btnNotif")) $("#btnNotif").onclick = async () => {
      try { await DB.invoke("notify-escala", { semana }); toast(DB.LIVE ? "Avisos enviados no Telegram." : "Simulado (conecte o Supabase).", "success"); }
      catch (e) { toast("Erro: " + e.message, "error"); }
    };
  }

  async function gerarEscala(semana) {
    const obreiros = await DB.listObreiros();
    const aptidoes = await DB.aptidoesMap();
    const dispRows = await DB.listDisponibilidades(semana);
    const disp = {}; dispRows.forEach((r) => (disp[r.obreiro_id] = r));
    const freq = await DB.freqStats();
    const historico = {}; Object.keys(freq).forEach((id) => (historico[id] = freq[id].escalado));

    const nEnviaram = dispRows.length;
    if (nEnviaram === 0 && !confirm("Ninguém enviou disponibilidade nesta semana. Gerar mesmo assim? (a escala virá vazia)")) return;

    const { itens } = ENGINE.gerar({ obreiros, aptidoes, disp, historico, semana, weekNo: weekNo(semana) });
    await DB.saveEscala(semana, itens, "rascunho");
    const vazias = itens.filter((i) => !i.obreiro_id && i.posicao !== "APOIO").length;
    toast(`Escala gerada. ${nEnviaram} enviaram disponibilidade${vazias ? ` · ${vazias} posições sem obreiro apto/disponível` : ""}.`, "success");
    telaAdmin();
  }

  // ---------------- DISPONIBILIDADES ----------------
  async function paneDisp(pane) {
    const semana = state.semana;
    const obreiros = (await DB.listObreiros()).filter((o) => o.ativo && !o.is_admin);
    const rows = await DB.listDisponibilidades(semana);
    const byId = {}; rows.forEach((r) => (byId[r.obreiro_id] = r));
    const enviaram = obreiros.filter((o) => byId[o.id]);
    const pendentes = obreiros.filter((o) => !byId[o.id]);

    const flags = [["dom_manha", "Dom M"], ["dom_noite", "Dom N"], ["terca", "Terça"], ["quinta", "Quinta"]];
    const linha = (o) => {
      const r = byId[o.id];
      return `<tr><td>${esc(nomeCurto(o.nome))}</td>${flags.map(([f]) => `<td>${r && r[f] ? '<span class="pill ok">sim</span>' : '<span class="muted">—</span>'}</td>`).join("")}
        <td>${r ? `<span class="pill ok">enviado</span>` : `<span class="pill no">pendente</span>`}</td></tr>`;
    };

    const msg = `Paz, obreiro! Ainda não recebemos sua disponibilidade da ${labelSemana(semana).toLowerCase()}. Por favor, lance no sistema: ${location.href}`;
    const waNums = pendentes.map((o) => nomeCurto(o.nome)).join(", ");

    pane.innerHTML = weekNavHTML() + `<div class="card">
      <div class="stat-grid" style="margin-bottom:16px">
        <div class="stat"><div class="l">Ativos</div><div class="v">${obreiros.length}</div></div>
        <div class="stat"><div class="l">Enviaram</div><div class="v" style="color:var(--ok)">${enviaram.length}</div></div>
        <div class="stat"><div class="l">Faltam lançar</div><div class="v" style="color:var(--danger)">${pendentes.length}</div></div>
      </div>
      <div class="row">
        <h2 style="margin:0">Quem ainda não lançou (${pendentes.length})</h2>
        <div class="spacer"></div>
        <button class="btn btn-tg btn-sm" id="btnCobrarTg">Cobrar no Telegram</button>
        <button class="btn btn-sec btn-sm" id="btnCobrarWa">Cobrar no WhatsApp</button>
      </div>
      ${pendentes.length ? `<div class="chips" style="margin-top:12px">${pendentes.map((o) => `<span class="chip">${esc(nomeCurto(o.nome))}</span>`).join("")}</div>`
        : `<div class="hint">🎉 Todos os obreiros ativos já lançaram a disponibilidade desta semana.</div>`}
    </div>
    <div class="card"><h2>Detalhe das disponibilidades</h2>
      <div class="tbl-wrap"><table>
      <thead><tr><th>Obreiro</th>${flags.map(([, l]) => `<th>${l}</th>`).join("")}<th>Status</th></tr></thead>
      <tbody>${obreiros.map(linha).join("")}</tbody></table></div>
    </div>`;

    wireWeekNav(() => telaAdmin());
    $("#btnCobrarTg").onclick = async () => {
      if (!pendentes.length) return toast("Ninguém pendente. 🎉", "success");
      try { await DB.invoke("notify-pendentes", { semana }); toast(DB.LIVE ? "Lembrete enviado no Telegram." : "Simulado (conecte o Supabase).", "success"); }
      catch (e) { toast("Erro: " + e.message, "error"); }
    };
    $("#btnCobrarWa").onclick = () => {
      if (!pendentes.length) return toast("Ninguém pendente. 🎉", "success");
      const num = (CFG.WHATSAPP_LIDERANCA || "").replace(/\D/g, "");
      const texto = encodeURIComponent(`Faltam lançar disponibilidade (${labelSemana(semana)}): ${waNums}.\n\n${msg}`);
      window.open(`https://wa.me/${num}?text=${texto}`, "_blank");
    };
  }

  // ---------------- OBREIROS ----------------
  async function paneObreiros(pane) {
    const obreiros = await DB.listObreiros();
    const linha = (o) => `<tr>
      <td>${esc(o.nome || o.email)}<div class="muted" style="font-size:11px">${esc(o.email || "")}</div></td>
      <td>${o.sexo ? `<span class="pill ${o.sexo === "M" ? "micro" : "entrada"}">${o.sexo}</span>` : '<span class="muted">—</span>'}</td>
      <td>${o.ativo ? '<span class="pill ok">ativo</span>' : '<span class="pill wait">inativo</span>'}${o.is_admin ? ' <span class="badge-admin">líder</span>' : ""}</td>
      <td>${o.telegram_chat_id ? '<span class="pill ok">✓</span>' : '<span class="muted">—</span>'}</td>
      <td><button class="btn btn-sec btn-sm" data-edit="${o.id}">Editar</button></td>
    </tr>`;

    pane.innerHTML = `<div class="card">
      <h2>Obreiros</h2>
      <div class="sub">Ative o obreiro, defina sexo, prioridade e as posições que ele pode assumir (as posições são confidenciais — o obreiro não vê).</div>
      <div class="tbl-wrap"><table>
      <thead><tr><th>Nome</th><th>Sexo</th><th>Situação</th><th>Telegram</th><th></th></tr></thead>
      <tbody>${obreiros.map(linha).join("")}</tbody></table></div>
    </div><div id="editor"></div>`;

    $$("[data-edit]").forEach((b) => (b.onclick = () => editorObreiro(b.dataset.edit)));
  }

  async function editorObreiro(id) {
    const obreiros = await DB.listObreiros();
    const o = obreiros.find((x) => x.id === id);
    const apt = await DB.getAptidoes(id);
    const aptSet = new Set(apt);
    const ed = $("#editor");
    ed.innerHTML = `<div class="card">
      <h2>Editar — ${esc(o.nome || o.email)}</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div><label class="field">Nome</label><input id="e_nome" value="${esc(o.nome || "")}"></div>
        <div><label class="field">Sexo</label><select id="e_sexo">
          <option value="">—</option><option value="M" ${o.sexo === "M" ? "selected" : ""}>Masculino</option>
          <option value="F" ${o.sexo === "F" ? "selected" : ""}>Feminino</option></select></div>
        <div><label class="field">Prioridade</label><select id="e_prio">
          ${["ALTA", "NORMAL", "BAIXA"].map((p) => `<option ${o.prioridade === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div><label class="field">Situação</label><select id="e_ativo">
          <option value="1" ${o.ativo ? "selected" : ""}>Ativo</option><option value="0" ${!o.ativo ? "selected" : ""}>Inativo</option></select></div>
        <div><label class="field">Liderança (admin)</label><select id="e_admin">
          <option value="0" ${!o.is_admin ? "selected" : ""}>Não</option><option value="1" ${o.is_admin ? "selected" : ""}>Sim</option></select></div>
      </div>
      <label class="field" style="margin-top:14px">Posições que pode assumir (confidencial)</label>
      <div class="chips" id="aptChips">
        ${DB.POSICOES.map((p) => `<label class="chip ${aptSet.has(p.cod) ? "on" : ""}"><input type="checkbox" value="${p.cod}" ${aptSet.has(p.cod) ? "checked" : ""}> ${p.cod}</label>`).join("")}
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn" id="e_salvar">Salvar</button>
        <button class="btn btn-ghost btn-sm" id="e_fechar">Fechar</button>
      </div>
    </div>`;
    ed.scrollIntoView({ behavior: "smooth", block: "start" });
    $$("#aptChips .chip").forEach((c) => (c.querySelector("input").onchange = (e) => c.classList.toggle("on", e.target.checked)));
    $("#e_fechar").onclick = () => (ed.innerHTML = "");
    $("#e_salvar").onclick = async () => {
      await DB.updateObreiro(id, {
        nome: $("#e_nome").value.trim(),
        sexo: $("#e_sexo").value || null,
        prioridade: $("#e_prio").value,
        ativo: $("#e_ativo").value === "1",
        is_admin: $("#e_admin").value === "1",
      });
      const marc = $$("#aptChips input:checked").map((i) => i.value);
      await DB.setAptidoes(id, marc);
      toast("Obreiro atualizado.", "success");
      paneObreiros($("#pane"));
    };
  }

  // ---------------- FREQUÊNCIA ----------------
  async function paneFreq(pane) {
    const semana = state.semana;
    const escala = await DB.getEscala(semana);
    const nomeDe = await mapNomes();
    const pres = escala ? await DB.getPresencas(semana) : {};

    let marc = `<div class="empty"><h3>Sem escala nesta semana</h3><p>Gere e publique a escala para marcar a frequência.</p></div>`;
    if (escala) {
      const its = escala.itens.filter((i) => i.obreiro_id);
      marc = `<div class="tbl-wrap"><table>
        <thead><tr><th>Culto</th><th>Data</th><th>Posição</th><th>Obreiro</th><th>Presença</th></tr></thead>
        <tbody>${its.map((i) => {
        const p = pres[i.id];
        return `<tr><td>${nomeCulto(i.culto)}</td><td>${br(i.data)}</td>
          <td><span class="pill ${DB.CAT_DE[i.posicao] || "recep"}">${i.posicao}</span></td>
          <td>${esc(nomeCurto(nomeDe[i.obreiro_id] || "?"))}</td>
          <td class="row">
            <button class="btn btn-sm ${p === true ? "btn-ok" : "btn-sec"}" data-pres="${i.id}" data-v="1">Presente</button>
            <button class="btn btn-sm ${p === false ? "btn-danger" : "btn-sec"}" data-pres="${i.id}" data-v="0">Faltou</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>`;
    }

    // estatística acumulada
    const freq = await DB.freqStats();
    const linhasFreq = Object.keys(freq).map((id) => {
      const f = freq[id]; const marcados = f.presente + f.faltou;
      const pct = marcados ? Math.round((f.presente / marcados) * 100) : null;
      return { nome: nomeCurto(nomeDe[id] || "?"), ...f, pct };
    }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

    pane.innerHTML = weekNavHTML() + `<div class="card">
      <h2>Frequência da semana</h2><div class="sub">${labelSemana(semana)} — marque quem esteve presente.</div>
      ${marc}
    </div>
    <div class="card"><h2>Frequência acumulada</h2>
      <div class="tbl-wrap"><table>
      <thead><tr><th>Obreiro</th><th>Escalado</th><th>Presente</th><th>Faltou</th><th>% Presença</th></tr></thead>
      <tbody>${linhasFreq.length ? linhasFreq.map((l) => `<tr><td>${esc(l.nome)}</td><td>${l.escalado}</td>
        <td style="color:var(--ok)">${l.presente}</td><td style="color:var(--danger)">${l.faltou}</td>
        <td>${l.pct == null ? '<span class="muted">—</span>' : `<b>${l.pct}%</b>`}</td></tr>`).join("")
        : `<tr><td colspan="5" class="muted">Sem dados ainda.</td></tr>`}</tbody></table></div>
    </div>`;

    wireWeekNav(() => telaAdmin());
    $$("[data-pres]").forEach((b) => (b.onclick = async () => {
      await DB.markPresenca(b.dataset.pres, b.dataset.v === "1");
      paneFreq($("#pane"));
    }));
  }

  // ---------------- AJUSTES ----------------
  async function paneConfig(pane) {
    pane.innerHTML = `<div class="card">
      <h2>Ajustes</h2>
      <div class="sub">Informações do sistema e ferramentas.</div>
      <table>
        <tr><td>Modo</td><td>${DB.mode === "live" ? '<span class="pill ok">Conectado ao Supabase</span>' : '<span class="pill wait">Demonstração (dados neste navegador)</span>'}</td></tr>
        <tr><td>Bot do Telegram</td><td>${CFG.TELEGRAM_BOT ? "@" + esc(CFG.TELEGRAM_BOT) : '<span class="muted">não configurado (config.js)</span>'}</td></tr>
        <tr><td>WhatsApp da liderança</td><td>${CFG.WHATSAPP_LIDERANCA ? esc(CFG.WHATSAPP_LIDERANCA) : '<span class="muted">não configurado</span>'}</td></tr>
      </table>
      ${DB.mode === "demo" ? `<div class="row" style="margin-top:16px">
        <button class="btn btn-sec btn-sm" id="cfgReset">Recriar dados de exemplo</button></div>
        <div class="hint">Para virar sistema de verdade: preencha <b>config.js</b> com as chaves do Supabase e rode o <b>schema.sql</b>. Veja o <b>README.md</b>.</div>` : ""}
    </div>`;
    if ($("#cfgReset")) $("#cfgReset").onclick = () => { DB.demoReset(); toast("Dados recriados.", "success"); telaAdmin(); };
  }

  // ------------------------------ helpers admin ----------------------
  async function mapNomes() {
    const obreiros = await DB.listObreiros();
    const m = {}; obreiros.forEach((o) => (m[o.id] = o.nome)); return m;
  }

  function exportarPdf(semana, escala, cultos) {
    if (!window.jspdf) { toast("Exportar PDF está disponível na versão publicada (Netlify).", "error"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(31, 41, 55); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 16, "F");
    doc.setTextColor(201, 169, 97); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("ADVEC VITÓRIA — ESCALA DE OBREIROS", 14, 10);
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(labelSemana(semana), doc.internal.pageSize.getWidth() - 14, 10, { align: "right" });

    mapNomes().then((nomeDe) => {
      const temApoio = escala.itens.some((i) => i.posicao === "APOIO");
      const linhas = [...GRID_POS, ...(temApoio ? ["APOIO"] : [])];
      const head = [["Posição", ...cultos.map((c) => `${c.nome}\n${br(c.data)}`)]];
      const body = linhas.map((p) => [p, ...cultos.map((c) => {
        const its = escala.itens.filter((i) => i.culto === c.key && i.posicao === p);
        return its.length ? its.map((i) => nomeCurto(nomeDe[i.obreiro_id] || "—")).join(", ") : "—";
      })]);
      doc.autoTable({
        startY: 20, head, body, theme: "grid",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55], textColor: [201, 169, 97], fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", fillColor: [201, 169, 97], textColor: [31, 41, 55], halign: "center" } },
      });
      doc.save(`Escala_${semana}.pdf`);
      toast("PDF gerado!", "success");
    });
  }

  // =====================================================================
  //  START
  // =====================================================================
  DB.onChange(render);
  DB.init().then(render);
})();
