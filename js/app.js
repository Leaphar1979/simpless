const boxListEl = document.getElementById("boxList");
const totalWrapEl = document.getElementById("totalWrap");
const totalBalanceEl = document.getElementById("totalBalance");

const newBoxBtn = document.getElementById("newBoxBtn");
const newBoxForm = document.getElementById("newBoxForm");
const boxNameInput = document.getElementById("boxName");
const boxAmountInput = document.getElementById("boxAmount");
const cancelNewBoxBtn = document.getElementById("cancelNewBox");
const createBoxBtn = document.getElementById("createBox");

const resetAllBtn = document.getElementById("resetAll");

let boxes = JSON.parse(localStorage.getItem("boxes") || "[]");

// Atualiza cor do saldo
function updateBalanceColor(element, value) {
  element.classList.remove("balance-positive", "balance-negative");
  if (value >= 0) {
    element.classList.add("balance-positive");
  } else {
    element.classList.add("balance-negative");
  }
}

// Renderiza lista de caixas
function renderBoxes() {
  boxListEl.innerHTML = "";
  let total = 0;
  boxes.forEach((box, index) => {
    const li = document.createElement("li");
    li.className = "box-item";
    li.innerHTML = `
      <div class="box-left">
        <div class="color-dot" style="background:${box.color}"></div>
        <strong>${box.name}</strong>
        <span class="badge">${box.period[0].toUpperCase()}</span>
      </div>
      <strong style="color:${box.balance >= 0 ? 'var(--ok)' : 'var(--danger)'}">
        R$ ${box.balance.toFixed(2)}
      </strong>
    `;
    li.addEventListener("click", () => openBox(index));
    boxListEl.appendChild(li);
    total += box.balance;
  });
  if (boxes.length > 0) {
    totalWrapEl.classList.remove("hidden");
    totalBalanceEl.textContent = `R$ ${total.toFixed(2)}`;
  } else {
    totalWrapEl.classList.add("hidden");
  }
}

// Abre formulário de nova caixa
newBoxBtn.addEventListener("click", () => {
  newBoxForm.classList.remove("hidden");
});
cancelNewBoxBtn.addEventListener("click", () => {
  newBoxForm.classList.add("hidden");
});

// Cria nova caixa
createBoxBtn.addEventListener("click", () => {
  const name = boxNameInput.value.trim();
  const amount = parseFloat(boxAmountInput.value) || 0;
  const period = document.querySelector('input[name="period"]:checked').value;
  if (!name || amount <= 0) return;

  const colors = ["#f39c12", "#27ae60", "#2980b9", "#8e44ad", "#e74c3c"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  boxes.push({ name, amount, balance: amount, period, expenses: [], color });
  localStorage.setItem("boxes", JSON.stringify(boxes));
  boxNameInput.value = "";
  boxAmountInput.value = "";
  newBoxForm.classList.add("hidden");
  renderBoxes();
});

// Reset total
resetAllBtn.addEventListener("click", () => {
  if (confirm("Tem certeza que deseja apagar todas as caixas e gastos?")) {
    boxes = [];
    localStorage.clear();
    renderBoxes();
  }
});

// Inicializa
renderBoxes();
