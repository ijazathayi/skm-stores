/* Golden Grove — grocery shop debt book. No login. Data saved in this browser. */
const KEY = "golden-grove-data-v1";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

let state = load();
let selectedId = null;
let query = "";

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { customers: raw.customers || [], entries: raw.entries || [] };
  } catch {
    return { customers: [], entries: [] };
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
const initials = (name) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

const entriesOf = (id) =>
  state.entries
    .filter((e) => e.customerId === id)
    .sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
const balanceOf = (id) =>
  entriesOf(id).reduce((t, e) => t + (e.kind === "debt" ? e.amount : -e.amount), 0);

const $ = (id) => document.getElementById(id);

function render() {
  const totalDebt = state.entries.filter((e) => e.kind === "debt").reduce((t, e) => t + e.amount, 0);
  const totalPaid = state.entries.filter((e) => e.kind === "payment").reduce((t, e) => t + e.amount, 0);
  const balances = state.customers.map((c) => ({ c, bal: balanceOf(c.id) }));
  $("statOutstanding").textContent = money(balances.reduce((t, b) => t + Math.max(b.bal, 0), 0));
  $("statOpen").textContent = String(balances.filter((b) => b.bal > 0).length);
  $("statDebt").textContent = money(totalDebt);
  $("statPaid").textContent = money(totalPaid);

  const q = query.trim().toLowerCase();
  const list = balances
    .filter(({ c }) => !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q))
    .sort((a, b) => b.bal - a.bal || a.c.name.localeCompare(b.c.name));

  const ul = $("customerList");
  ul.innerHTML = "";
  if (!list.length) {
    ul.innerHTML = '<li class="empty">No customers yet. Register one above.</li>';
  }
  list.forEach(({ c, bal }) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = c.id === selectedId ? "active" : "";
    btn.innerHTML =
      `<span class="who"><span class="avatar">${initials(c.name)}</span>` +
      `<span><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.mobile)}</small></span></span>` +
      `<span class="due ${bal > 0 ? "" : "clear"}">${bal > 0 ? money(bal) : "Clear"}</span>`;
    btn.onclick = () => {
      selectedId = c.id;
      render();
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });

  const customer = state.customers.find((c) => c.id === selectedId);
  $("emptyDetail").hidden = !!customer;
  $("detailBody").hidden = !customer;
  if (!customer) return;

  $("detailName").textContent = customer.name;
  $("detailMobile").textContent = customer.mobile;
  $("detailBalance").textContent = money(balanceOf(customer.id));

  const tbody = $("ledgerBody");
  tbody.innerHTML = "";
  const rows = entriesOf(customer.id);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No entries yet.</td></tr>';
  }
  let running = 0;
  rows.forEach((e) => {
    running += e.kind === "debt" ? e.amount : -e.amount;
    const tr = document.createElement("tr");
    const details = e.kind === "debt"
      ? `${escapeHtml(e.product || "Purchase")}${e.quantity ? ` × ${e.quantity}` : ""}${e.note ? ` — ${escapeHtml(e.note)}` : ""}`
      : `Repayment${e.note ? ` — ${escapeHtml(e.note)}` : ""}`;
    tr.innerHTML =
      `<td>${fmtDate(e.date)}</td><td>${details}</td>` +
      `<td class="num">${e.kind === "debt" ? money(e.amount) : "—"}</td>` +
      `<td class="num">${e.kind === "payment" ? money(e.amount) : "—"}</td>` +
      `<td class="num">${money(running)}</td>`;
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.className = "del";
    del.type = "button";
    del.textContent = "✕";
    del.onclick = () => {
      state.entries = state.entries.filter((x) => x.id !== e.id);
      save();
      render();
    };
    td.appendChild(del);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("customerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("custName").value.trim();
  const mobile = $("custMobile").value.trim();
  if (!name || !mobile) return;
  const c = { id: uid(), name, mobile, createdAt: new Date().toISOString() };
  state.customers.push(c);
  selectedId = c.id;
  save();
  e.target.reset();
  render();
});

$("search").addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

$("debtForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedId) return;
  state.entries.push({
    id: uid(),
    customerId: selectedId,
    kind: "debt",
    product: $("debtProduct").value.trim(),
    quantity: $("debtQty").value ? Number($("debtQty").value) : null,
    amount: Number($("debtAmount").value),
    note: $("debtNote").value.trim() || null,
    date: $("debtDate").value || today(),
  });
  save();
  e.target.reset();
  $("debtDate").value = today();
  render();
});

$("payForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedId) return;
  state.entries.push({
    id: uid(),
    customerId: selectedId,
    kind: "payment",
    product: null,
    quantity: null,
    amount: Number($("payAmount").value),
    note: $("payNote").value.trim() || null,
    date: $("payDate").value || today(),
  });
  save();
  e.target.reset();
  $("payDate").value = today();
  render();
});

$("deleteCustomer").addEventListener("click", () => {
  if (!selectedId) return;
  if (!confirm("Delete this customer and all their entries?")) return;
  state.entries = state.entries.filter((e) => e.customerId !== selectedId);
  state.customers = state.customers.filter((c) => c.id !== selectedId);
  selectedId = null;
  save();
  render();
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "golden-grove-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    state = { customers: data.customers || [], entries: data.entries || [] };
    selectedId = null;
    save();
    render();
  } catch {
    alert("That file could not be read.");
  }
  e.target.value = "";
});

$("debtDate").value = today();
$("payDate").value = today();
render();
