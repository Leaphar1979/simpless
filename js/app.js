document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ===== Configurações de data/hora =====
  const TZ_OFFSET_HOURS = -3; // Brasília (UTC-3)
  const STORAGE_KEY = "simplessDataV2";
  const PALETTE = ["#f7941d","#2ecc71","#3498db","#9b59b6","#e67e22"];
  const ALLOWED_PERIODS = new Set(["diario","semanal","mensal"]);

  // ===== Utils gerais =====
  const el = (id) => document.getElementById(id);
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  function formatBRL(n) { return Number(n || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }

  // Parser robusto (aceita R$, espaços, ., , — usa o ÚLTIMO separador como decimal)
  function parseNum(input) {
    if (typeof input !== "string" && typeof input !== "number") return NaN;
    const s0 = String(input).trim().replace(/\s|R\$\s?/gi, "");
    if (!s0) return NaN;
    const m = s0.match(/[.,](?=[^.,]*$)/); // última vírgula ou ponto
    let s = s0;
    if (m) {
      const idx = m.index;
      const intPart  = s.slice(0, idx).replace(/[^\d]/g, "");
      const fracPart = s.slice(idx + 1).replace(/[^\d]/g, "");
      s = `${intPart}.${fracPart}`;
    } else {
      s = s.replace(/[^\d]/g, ""); // sem decimal: inteiro
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Sanitizador discreto para inputs numéricos (não altera layout)
  function attachNumericSanitizer(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
      const clean = inputEl.value.replace(/[^\d,\.]/g, "");
      if (clean !== inputEl.value) inputEl.value = clean;
    }, { passive: true });
  }

  function nowUtcMinus3() {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + TZ_OFFSET_HOURS);
    return d;
  }
  function isoDateUTC3(d = nowUtcMinus3()) { return d.toISOString().split("T")[0]; }
  function brDateStr(iso) { const [y,m,da] = iso.split("-"); return `${da}/${m}/${y}`; }
  function getRadio(name) {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : "diario";
  }

  // ===== Validação / Sanitização do estado =====
  function isValidBox(b) {
    return b
      && typeof b.id === "string"
      && typeof b.name === "string"
      && ALLOWED_PERIODS.has(b.period)
      && typeof b.amountPerPeriod === "number"
      && typeof b.lastBalance === "number"
      && typeof b.currentPeriod === "string"
      && Array.isArray(b.expenses)
      && b.expenses.every(e => e && typeof e.amount === "number" && Number.isFinite(e.amount));
  }

  function sanitizeBox(b) {
    const period = ALLOWED_PERIODS.has(b.period) ? b.period : "diario";
    const amount = Number.isFinite(b.amountPerPeriod) ? b.amountPerPeriod : 0;
    const lastBal = Number.isFinite(b.lastBalance) ? b.lastBalance : 0;
    const cur = typeof b.currentPeriod === "string" ? b.currentPeriod : periodKey({ period });
    const expenses = Array.isArray(b.expenses) ? b.expenses : [];
    const cleanExp = expenses
      .map(e => ({ amount: Number(e?.amount) }))
      .filter(e => Number.isFinite(e.amount) && e.amount >= 0);
    return {
      id: String(b.id || crypto.randomUUID()),
      name: String(b.name || "Caixa"),
      period,
      amountPerPeriod: round2(amount),
      lastBalance: round2(lastBal),
      currentPeriod: cur,
      expenses: cleanExp
    };
  }

  function sanitizeState(state) {
    const base = { activeBoxId: null, boxes: [] };
    if (!state || typeof state !== "object") return base;
    const boxesIn = Array.isArray(state.boxes) ? state.boxes : [];
    const boxes = boxesIn.map(sanitizeBox).filter(isValidBox);
    let active = boxes.find(b => b.id === state.activeBoxId) ? state.activeBoxId : (boxes[0]?.id || null);
    return { activeBoxId: active, boxes };
  }

  // ===== Persistência =====
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { activeBoxId: null, boxes: [] };
      const parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch {
      // JSON corrompido → zera somente esta chave
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return { activeBoxId: null, boxes: [] };
    }
  }
  function save(state) {
    try {
      const clean = sanitizeState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      console.warn("Falha ao salvar estado:", e);
    }
  }

  // ===== Modelo / Períodos =====
  function colorForIndex(i){ return PALETTE[i % PALETTE.length]; }

  function weekKeyUTC3(d = nowUtcMinus3()){
    // Segunda-feira (ISO-like)
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayIdx = (t.getUTCDay() + 6) % 7; // 0 = segunda
    t.setUTCDate(t.getUTCDate() - dayIdx);
    return t.toISOString().split("T")[0]; // YYYY-MM-DD (segunda)
  }

  function periodKey(box, d = nowUtcMinus3()){
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,"0");
    const day = String(d.getUTCDate()).padStart(2,"0");
    if (box.period === "diario")  return `${y}-${m}-${day}`;
    if (box.period === "mensal")  return `${y}-${m}`;
    return `W:${weekKeyUTC3(d)}`; // semanal
  }

  function calcBalance(box){
    const spent = (box.expenses || []).reduce((s,e)=> s + Number(e.amount || 0), 0);
    return round2((box.lastBalance || 0) + (box.amountPerPeriod || 0) - spent);
  }

  function rolloverIfNeeded(box){
    const cur = periodKey(box);
    if (box.currentPeriod !== cur){
      const spent = (box.expenses || []).reduce((s,e)=> s + Number(e.amount || 0), 0);
      box.lastBalance = round2((box.lastBalance || 0) + (box.amountPerPeriod || 0) - spent);
      box.expenses = [];
      box.currentPeriod = cur;
      return true;
    }
    return false;
  }

  function rolloverAll(state){
    state.boxes.forEach(rolloverIfNeeded);
  }

  function badgeForPeriod(p){ return p==="diario"?"D":p==="semanal"?"S":"M"; }

  // ===== Elementos globais (DOM) =====
  const dashboard   = el("dashboard");
  const boxView     = el("boxView");

  const boxList     = el("boxList");
  const totalWrap   = el("totalWrap");
  const totalBalEl  = el("totalBalance");

  const newBoxBtn   = el("newBoxBtn");
  const resetAllBtn = el("resetAll");
  const newBoxForm  = el("newBoxForm");
  const cancelNew   = el("cancelNewBox");
  const createBox   = el("createBox");
  const boxNameInp  = el("boxName");
  const boxAmtInp   = el("boxAmount");

  const backBtn     = el("backToDashboard");
  const boxColorBar = el("boxColor");
  const boxNameH2   = el("boxNameTitle");
  const boxMeta     = el("boxMeta");
  const boxBalance  = el("boxBalance");
  const expenseVal  = el("expenseValue");
  const addExpense  = el("addExpense");
  const expList     = el("expenseList");
  const editBoxBtn  = el("editBox");
  const delBoxBtn   = el("deleteBox");

  const editForm    = el("editBoxForm");
  const editName    = el("editName");
  const editAmount  = el("editAmount");

  // Sanitizador nos campos numéricos
  attachNumericSanitizer(boxAmtInp);
  attachNumericSanitizer(expenseVal);
  attachNumericSanitizer(editAmount);

  // ===== Dashboard =====
  function renderDashboard(){
    const state = load();
    rolloverAll(state); save(state);

    boxList.innerHTML = "";
    state.boxes.forEach((box, idx) => {
      const li = document.createElement("li");
      li.className = "box-item";
      li.addEventListener("click", () => openBox(box.id));

      const left = document.createElement("div");
      left.className = "box-left";

      const dot = document.createElement("div");
      dot.className = "color-dot";
      dot.style.background = colorForIndex(idx);

      const title = document.createElement("div");
      title.innerHTML = `<strong>${box.name}</strong> <span class="badge">${badgeForPeriod(box.period)}</span>`;

      const right = document.createElement("div");
      const bal = calcBalance(box);
      const b = document.createElement("strong");
      b.textContent = formatBRL(bal);
      b.className = bal < 0 ? "balance-negative" : "balance-positive";

      left.appendChild(dot);
      left.appendChild(title);
      right.appendChild(b);

      li.appendChild(left);
      li.appendChild(right);
      boxList.appendChild(li);
    });

    if (state.boxes.length) {
      totalWrap.classList.remove("hidden");
      const total = round2(state.boxes.reduce((s, bx)=> s + calcBalance(bx), 0));
      totalBalEl.textContent = formatBRL(total);
    } else {
      totalWrap.classList.add("hidden");
    }

    dashboard.classList.remove("hidden");
    boxView.classList.add("hidden");
    newBoxForm.classList.add("hidden");
  }

  // ===== Abrir caixa =====
  function getActiveBox(state, preferId=null){
    const id = preferId ?? state.activeBoxId;
    let box = state.boxes.find(b => b.id === id);
    if (!box && state.boxes.length) {
      state.activeBoxId = state.boxes[0].id;
      box = state.boxes[0];
      save(state);
    }
    return box || null;
  }

  function openBox(id){
    const state = load();

    // ✅ garante que a caixa clicada vire a ativa (corrige débitos caindo na caixa errada)
    if (id && state.activeBoxId !== id) {
      state.activeBoxId = id;
      save(state);
    }

    const box = getActiveBox(state, id);
    if (!box) { renderDashboard(); return; }

    rolloverIfNeeded(box);
    save(state);

    // Header
    const idx = state.boxes.findIndex(b => b.id === box.id);
    boxNameH2.textContent = box.name;
    boxColorBar.style.background = colorForIndex(idx >= 0 ? idx : 0);
    boxMeta.textContent = metaForBox(box);

    // Saldo
    const bal = calcBalance(box);
    boxBalance.textContent = formatBRL(bal);
    boxBalance.classList.toggle("balance-negative", bal < 0);
    boxBalance.classList.toggle("balance-positive", bal >= 0);

    // Lista de gastos
    renderExpenses(box);

    // Preencher form de edição
    editName.value = box.name;
    editAmount.value = String(box.amountPerPeriod);
    document.querySelectorAll('input[name="editPeriod"]').forEach(r => {
      r.checked = (r.value === box.period);
    });

    dashboard.classList.add("hidden");
    boxView.classList.remove("hidden");
    editForm.classList.add("hidden");
  }

  function metaForBox(box){
    if (box.period === "diario")  return `Diário — ${brDateStr(isoDateUTC3())}`;
    if (box.period === "semanal"){
      const k = box.currentPeriod?.startsWith("W:") ? box.currentPeriod.slice(2) : weekKeyUTC3();
      return `Semanal — semana iniciada em ${brDateStr(k)}`;
    }
    const iso = isoDateUTC3();
    const [y,m] = iso.split("-");
    return `Mensal — ${m}/${y}`;
  }

  function renderExpenses(box){
    expList.innerHTML = "";
    if (!box.expenses.length){
      const li = document.createElement("li");
      li.className = "small";
      li.textContent = "Sem gastos registrados neste período.";
      expList.appendChild(li);
      return;
    }
    box.expenses.forEach((e, i)=>{
      const li = document.createElement("li");
      li.className = "exp-item";

      const left = document.createElement("span");
      left.textContent = `- ${formatBRL(e.amount)}`;

      const act = document.createElement("div");
      act.className = "actions";

      const edit = document.createElement("button");
      edit.className = "edit-btn";
      edit.textContent = "Editar";
      edit.addEventListener("click", ()=>{
        const nv = prompt("Novo valor:", String(e.amount).replace(".", ","));
        if (nv === null) return; // cancelado
        const p = parseNum(nv);
        if (!isNaN(p) && p > 0){
          const state = load();
          const b = getActiveBox(state);
          if (!b) return renderDashboard();
          rolloverIfNeeded(b);
          b.expenses[i].amount = round2(p);
          save(state);
          openBox(b.id);
        }
      });

      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "Apagar";
      del.addEventListener("click", ()=>{
        const state = load();
        const b = getActiveBox(state);
        if (!b) return renderDashboard();
        rolloverIfNeeded(b);
        b.expenses.splice(i,1);
        save(state);
        openBox(b.id);
      });

      act.appendChild(edit);
      act.appendChild(del);
      li.appendChild(left);
      li.appendChild(act);
      expList.appendChild(li);
    });
  }

  // ===== Eventos: Painel =====
  newBoxBtn.addEventListener("click", ()=>{
    newBoxForm.classList.toggle("hidden");
    boxNameInp.focus();
  });

  cancelNew.addEventListener("click", ()=>{
    newBoxForm.classList.add("hidden");
    boxNameInp.value = ""; boxAmtInp.value = "";
  });

  createBox.addEventListener("click", ()=>{
    const name = boxNameInp.value.trim();
    const amount = parseNum(boxAmtInp.value);
    const period = getRadio("period");
    if (!name || isNaN(amount) || amount <= 0 || !ALLOWED_PERIODS.has(period)){
      alert("Preencha nome, valor e período válidos.");
      return;
    }
    const state = load();
    const box = {
      id: crypto.randomUUID(),
      name,
      period,                    // 'diario' | 'semanal' | 'mensal'
      amountPerPeriod: round2(amount),
      currentPeriod: periodKey({ period }),
      lastBalance: 0,
      expenses: []
    };
    state.boxes.push(box);
    state.activeBoxId = box.id;
    save(state);
    boxNameInp.value = ""; boxAmtInp.value = "";
    newBoxForm.classList.add("hidden");
    renderDashboard();
  });

  resetAllBtn.addEventListener("click", ()=>{
    if (!confirm("Tem certeza que deseja apagar todas as caixas e gastos?")) return;
    localStorage.removeItem(STORAGE_KEY);
    renderDashboard();
  });

  // ===== Eventos: Caixa =====
  backBtn.addEventListener("click", renderDashboard);

  addExpense.addEventListener("click", ()=>{
    const v = parseNum(expenseVal.value);
    if (isNaN(v) || v <= 0){
      alert("Valor inválido.");
      return;
    }
    const state = load();
    const box = getActiveBox(state);
    if (!box) { renderDashboard(); return; }
    rolloverIfNeeded(box);
    box.expenses.push({ amount: round2(v) });
    save(state);
    expenseVal.value = "";
    openBox(box.id);
  });

  editBoxBtn.addEventListener("click", ()=> editForm.classList.toggle("hidden"));

  delBoxBtn.addEventListener("click", ()=>{
    if (!confirm("Excluir esta caixa? Esta ação não pode ser desfeita.")) return;
    const state = load();
    const id = state.activeBoxId;
    state.boxes = state.boxes.filter(b => b.id !== id);
    state.activeBoxId = state.boxes[0]?.id || null;
    save(state);
    renderDashboard();
  });

  el("cancelEdit").addEventListener("click", ()=> editForm.classList.add("hidden"));

  el("saveEdit").addEventListener("click", ()=>{
    const state = load();
    const box = getActiveBox(state);
    if (!box) { renderDashboard(); return; }

    const newName   = editName.value.trim();
    const newAmount = parseNum(editAmount.value);
    const newPeriod = getRadio("editPeriod");
    if (!newName || isNaN(newAmount) || newAmount <= 0 || !ALLOWED_PERIODS.has(newPeriod)){
      alert("Preencha dados válidos.");
      return;
    }

    const periodChanged = box.period !== newPeriod;
    box.name = newName;
    box.amountPerPeriod = round2(newAmount);
    box.period = newPeriod;
    if (periodChanged){
      box.currentPeriod = periodKey(box);
      box.expenses = [];
    }
    save(state);
    openBox(box.id);
    editForm.classList.add("hidden");
  });

  // ===== Inicialização =====
  renderDashboard();
});


