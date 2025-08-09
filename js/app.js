document.addEventListener("DOMContentLoaded", () => {
  // ===== Configurações de data/hora =====
  const TZ_OFFSET_HOURS = -3; // Brasília (UTC-3)
  const STORAGE_KEY = "simplessDataV2";
  const PALETTE = ["#f7941d","#2ecc71","#3498db","#9b59b6","#e67e22"];

  // ===== Elementos globais =====
  const el = (id) => document.getElementById(id);

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

  // ===== Utilitários de número/data/moeda =====
  function parseNum(input) {
    // Aceita "12,34" e "12.34", ignora espaços
    if (typeof input !== "string" && typeof input !== "number") return NaN;
    const s = String(input).trim().replace(/\./g, "").replace(",", ".");
    // Remover separadores de milhar (.) mantendo decimal final
    // Ex.: "1.234,56" -> "1234.56" | "1234.56" -> "1234.56"
    return parseFloat(s);
  }

  function nowUtcMinus3() {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + TZ_OFFSET_HOURS);
    return d;
  }
  function isoDateUTC3(d = nowUtcMinus3()) { return d.toISOString().split("T")[0]; }
  function brDateStr(iso) { const [y,m,da] = iso.split("-"); return `${da}/${m}/${y}`; }
  function formatBRL(n) { return n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
  function getRadio(name) {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : "diario";
  }

  // ===== Persistência =====
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { activeBoxId: null, boxes: [] };
      const state = JSON.parse(raw);
      if (!state || !Array.isArray(state.boxes)) return { activeBoxId: null, boxes: [] };
      return state;
    } catch (_) {
      return { activeBoxId: null, boxes: [] };
    }
  }
  function save(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
    const spent = box.expenses.reduce((s,e)=> s + e.amount, 0);
    return box.lastBalance + box.amountPerPeriod - spent;
  }

  function rolloverIfNeeded(box){
    const cur = periodKey(box);
    if (box.currentPeriod !== cur){
      const spent = box.expenses.reduce((s,e)=> s + e.amount, 0);
      box.lastBalance = box.lastBalance + box.amountPerPeriod - spent;
      box.expenses = [];
      box.currentPeriod = cur;
      return true;
    }
    return false;
  }

  function rolloverAll(state){ state.boxes.forEach(rolloverIfNeeded); }

  function badgeForPeriod(p){ return p==="diario"?"D":p==="semanal"?"S":"M"; }

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
      const total = state.boxes.reduce((s, bx)=> s + calcBalance(bx), 0);
      totalBalEl.textContent = formatBRL(total);
    } else {
      totalWrap.classList.add("hidden");
    }

    dashboard.classList.remove("hidden");
    boxView.classList.add("hidden");
    newBoxForm.classList.add("hidden");
  }

  // ===== Abrir caixa =====
  function openBox(id){
    const state = load();
    const idx = state.boxes.findIndex(b => b.id === id);
    if (idx < 0) return;

    const box = state.boxes[idx];
    state.activeBoxId = id;
    rolloverIfNeeded(box);
    save(state);

    // Header
    boxNameH2.textContent = box.name;
    boxColorBar.style.background = colorForIndex(idx);
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
        const nv = prompt("Novo valor:", String(e.amount));
        if (nv === null) return; // cancelado
        const p = parseNum(nv);
        if (!isNaN(p) && p>0){
          const state = load();
          const b = state.boxes.find(b=> b.id === state.activeBoxId);
          b.expenses[i].amount = p;
          save(state);
          openBox(b.id);
        }
      });

      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "Apagar";
      del.addEventListener("click", ()=>{
        const state = load();
        const b = state.boxes.find(b=> b.id === state.activeBoxId);
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
    if (!name || isNaN(amount) || amount <= 0){
      alert("Preencha nome e valor válidos.");
      return;
    }
    const state = load();
    const box = {
      id: crypto.randomUUID(),
      name,
      period,                    // 'diario' | 'semanal' | 'mensal'
      amountPerPeriod: amount,
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
    const box = state.boxes.find(b => b.id === state.activeBoxId);
    rolloverIfNeeded(box);
    box.expenses.push({ amount: v });
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
    const box = state.boxes.find(b => b.id === state.activeBoxId);

    const newName   = editName.value.trim();
    const newAmount = parseNum(editAmount.value);
    const newPeriod = getRadio("editPeriod");
    if (!newName || isNaN(newAmount) || newAmount <= 0){
      alert("Preencha dados válidos.");
      return;
    }

    const periodChanged = box.period !== newPeriod;
    box.name = newName;
    box.amountPerPeriod = newAmount;
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
