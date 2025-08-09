document.addEventListener("DOMContentLoaded", () => {
  // ===== Configurações de data/hora =====
  const TZ_OFFSET_HOURS = -3; // Brasília (UTC-3) fixo
  const STORAGE_KEY = "simplessDataV2";
  const PALETTE = ["#f7941d","#2ecc71","#3498db","#9b59b6","#e67e22"]; // cores automáticas

  // ===== Elementos =====
  const el = (id) => document.getElementById(id);
  const dashboard = el("dashboard");
  const boxView = el("boxView");
  const boxList = el("boxList");
  const totalWrap = el("totalWrap");
  const totalBalanceEl = el("totalBalance");

  const newBoxBtn = el("newBoxBtn");
  const newBoxForm = el("newBoxForm");
  const cancelNewBox = el("cancelNewBox");
  const createBoxBtn = el("createBox");
  const boxNameInput = el("boxName");
  const boxAmountInput = el("boxAmount");

  const backBtn = el("backToDashboard");
  const boxNameTitle = el("boxNameTitle");
  const boxMeta = el("boxMeta");
  const boxColor = el("boxColor");
  const boxBalance = el("boxBalance");

  const expenseValue = el("expenseValue");
  const addExpenseBtn = el("addExpense");
  const expenseList = el("expenseList");

  const editBoxBtn = el("editBox");
  const deleteBoxBtn = el("deleteBox");
  const editBoxForm = el("editBoxForm");
  const editName = el("editName");
  const editAmount = el("editAmount");

  // ===== Utils de data e moeda =====
  function nowUtcMinus3() {
    const d = new Date();
    d.setUTCHours(d.getUTCHours() + TZ_OFFSET_HOURS); // ajusta para UTC-3
    return d;
  }
  function isoDateUTC3(d = nowUtcMinus3()) {
    return d.toISOString().split("T")[0];
  }
  function brDateStr(iso) {
    const [y,m,da] = iso.split("-");
    return `${da}/${m}/${y}`;
  }
  function formatBRL(n) {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function getSelectedPeriod(radioname) {
    const r = document.querySelector(`input[name="${radioname}"]:checked`);
    return r ? r.value : "diario";
  }

  // ===== Persistência =====
  function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"activeBoxId":null,"boxes":[]}');
  }
  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ===== Modelo =====
  function colorForIndex(i){ return PALETTE[i % PALETTE.length]; }

  function currentWeekKeyUTC3(d = nowUtcMinus3()){
    // chave da semana = ISO da segunda-feira correspondente
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayIdx = (tmp.getUTCDay() + 6) % 7; // 0 = segunda
    tmp.setUTCDate(tmp.getUTCDate() - dayIdx);
    return tmp.toISOString().split("T")[0];
  }

  function periodKey(box, d = nowUtcMinus3()) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,"0");
    const day = String(d.getUTCDate()).padStart(2,"0");
    if (box.period === "diario") return `${y}-${m}-${day}`; // dia
    if (box.period === "mensal") return `${y}-${m}`;        // mês
    // semanal
    return `W:${currentWeekKeyUTC3(d)}`;                    // segunda da semana
  }

  function calcBalance(box){
    const spent = box.expenses.reduce((s,e)=>s+e.amount,0);
    return box.lastBalance + box.amountPerPeriod - spent;
  }

  function rolloverIfNeeded(box){
    const k = periodKey(box);
    if (box.currentPeriod !== k){
      const spent = box.expenses.reduce((s,e)=>s+e.amount,0);
      box.lastBalance = box.lastBalance + box.amountPerPeriod - spent;
      box.expenses = [];
      box.currentPeriod = k;
      return true;
    }
    return false;
  }

  function rolloverAll(state){
    state.boxes.forEach(rolloverIfNeeded);
  }

  // ===== Render Painel =====
  function renderDashboard(){
    const state = load();
    rolloverAll(state);
    save(state);

    boxList.innerHTML = "";
    state.boxes.forEach((box, idx)=>{
      const li = document.createElement("li");
      li.className = "box-item";
      li.addEventListener("click", ()=> openBox(box.id));

      const left = document.createElement("div");
      left.className = "box-left";

      const dot = document.createElement("div");
      dot.className = "color-dot";
      dot.style.background = colorForIndex(idx);

      const title = document.createElement("div");
      title.innerHTML = `<strong>${box.name}</strong> <span class="badge">${badgeForPeriod(box.period)}</span>`;

      left.appendChild(dot);
      left.appendChild(title);

      const right = document.createElement("div");
      const bal = calcBalance(box);
      const b = document.createElement("strong");
      b.textContent = formatBRL(bal);
      b.className = bal < 0 ? "balance-negative" : "balance-positive";
      right.appendChild(b);

      li.appendChild(left);
      li.appendChild(right);
      boxList.appendChild(li);
    });

    if (state.boxes.length){
      totalWrap.classList.remove("hidden");
      const total = state.boxes.reduce((s,b)=> s + calcBalance(b), 0);
      totalBalanceEl.textContent = formatBRL(total);
    } else {
      totalWrap.classList.add("hidden");
    }

    // toggles
    dashboard.classList.remove("hidden");
    boxView.classList.add("hidden");
    newBoxForm.classList.add("hidden");
  }

  function badgeForPeriod(p){
    if (p==="diario") return "D";
    if (p==="semanal") return "S";
    return "M";
  }

  // ===== Abrir caixa =====
  function openBox(id){
    const state = load();
    const idx = state.boxes.findIndex(b=>b.id===id);
    if (idx<0) return;

    state.activeBoxId = id;
    save(state);

    const box = state.boxes[idx];
    rolloverIfNeeded(box);
    save(state);

    // header
    boxNameTitle.textContent = box.name;
    boxColor.style.background = colorForIndex(idx);
    boxMeta.textContent = metaForBox(box);

    // balance
    const bal = calcBalance(box);
    boxBalance.textContent = formatBRL(bal);
    boxBalance.classList.toggle("balance-negative", bal<0);
    boxBalance.classList.toggle("balance-positive", bal>=0);

    // expenses list
    renderExpenses(box);

    // editar form preenchido
    editName.value = box.name;
    editAmount.value = String(box.amountPerPeriod);
    document.querySelectorAll('input[name="editPeriod"]').forEach(r => {
      r.checked = (r.value === box.period);
    });

    dashboard.classList.add("hidden");
    boxView.classList.remove("hidden");
    editBoxForm.classList.add("hidden");
  }

  function metaForBox(box){
    if (box.period==="diario"){
      return `Diário — ${brDateStr(isoDateUTC3())}`;
    }
    if (box.period==="semanal"){
      const k = box.currentPeriod?.startsWith("W:") ? box.currentPeriod.slice(2) : currentWeekKeyUTC3();
      return `Semanal — semana iniciada em ${brDateStr(k)}`;
    }
    // mensal
    const iso = isoDateUTC3();
    const [y,m] = iso.split("-");
    return `Mensal — ${m}/${y}`;
  }

  function renderExpenses(box){
    expenseList.innerHTML = "";
    if (!box.expenses.length){
      const li = document.createElement("li");
      li.className = "small";
      li.textContent = "Sem gastos registrados neste período.";
      expenseList.appendChild(li);
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
      edit.className = "edit-btn"; edit.textContent = "Editar";
      edit.addEventListener("click", ()=>{
        const nv = prompt("Novo valor:", String(e.amount));
        const p = parseFloat(nv);
        if (!isNaN(p) && p>0){
          const state = load();
          const b = state.boxes.find(b=>b.id===state.activeBoxId);
          b.expenses[i].amount = p;
          save(state);
          openBox(b.id);
        }
      });

      const del = document.createElement("button");
      del.className = "del-btn"; del.textContent = "Apagar";
      del.addEventListener("click", ()=>{
        const state = load();
        const b = state.boxes.find(b=>b.id===state.activeBoxId);
        b.expenses.splice(i,1);
        save(state);
        openBox(b.id);
      });

      act.appendChild(edit);
      act.appendChild(del);
      li.appendChild(left);
      li.appendChild(act);
      expenseList.appendChild(li);
    });
  }

  // ===== Eventos Painel =====
  newBoxBtn.addEventListener("click", ()=>{
    newBoxForm.classList.toggle("hidden");
    boxNameInput.focus();
  });
  cancelNewBox.addEventListener("click", ()=>{
    newBoxForm.classList.add("hidden");
    boxNameInput.value = ""; boxAmountInput.value = "";
  });
  createBoxBtn.addEventListener("click", ()=>{
    const name = boxNameInput.value.trim();
    const amount = parseFloat(boxAmountInput.value);
    const period = getSelectedPeriod("period");

    if (!name || isNaN(amount) || amount<=0){
      alert("Preencha nome e valor válidos.");
      return;
    }

    const state = load();
    const box = {
      id: crypto.randomUUID(),
      name,
      period,                   // 'diario' | 'semanal' | 'mensal'
      amountPerPeriod: amount,
      currentPeriod: periodKey({period}), // inicia já no período atual
      lastBalance: 0,
      expenses: []
    };
    state.boxes.push(box);
    state.activeBoxId = box.id;
    save(state);

    boxNameInput.value = ""; boxAmountInput.value = "";
    newBoxForm.classList.add("hidden");
    renderDashboard();
  });

  // ===== Eventos Caixa =====
  backBtn.addEventListener("click", renderDashboard);

  addExpenseBtn.addEventListener("click", ()=>{
    const v = parseFloat(expenseValue.value);
    if (isNaN(v) || v<=0){
      alert("Valor inválido.");
      return;
    }
    const state = load();
    const box = state.boxes.find(b=>b.id===state.activeBoxId);
    rolloverIfNeeded(box);
    box.expenses.push({ amount: v });
    save(state);
    expenseValue.value = "";
    openBox(box.id);
  });

  editBoxBtn.addEventListener("click", ()=> editBoxForm.classList.toggle("hidden"));

  deleteBoxBtn.addEventListener("click", ()=>{
    if (!confirm("Excluir esta caixa? Esta ação não pode ser desfeita.")) return;
    const state = load();
    const id = state.activeBoxId;
    state.boxes = state.boxes.filter(b=>b.id!==id);
    state.activeBoxId = state.boxes[0]?.id || null;
    save(state);
    renderDashboard();
  });

  el("cancelEdit").addEventListener("click", ()=> editBoxForm.classList.add("hidden"));
  el("saveEdit").addEventListener("click", ()=>{
    const state = load();
    const box = state.boxes.find(b=>b.id===state.activeBoxId);

    const newName = editName.value.trim();
    const newAmount = parseFloat(editAmount.value);
    const newPeriod = getSelectedPeriod("editPeriod");

    if (!newName || isNaN(newAmount) || newAmount<=0){
      alert("Preencha dados válidos.");
      return;
    }

    const periodChanged = box.period !== newPeriod;
    box.name = newName;
    box.amountPerPeriod = newAmount;
    box.period = newPeriod;

    if (periodChanged){
      // ao mudar o período, reinicia o marcador de período atual e zera gastos correntes
      box.currentPeriod = periodKey(box);
      box.expenses = [];
    }

    save(state);
    openBox(box.id);
    editBoxForm.classList.add("hidden");
  });

  // ===== Inicialização =====
  renderDashboard();
});
