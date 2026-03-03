/* =========================
   GLOBAL HELPERS
========================= */

function formatMoney(num){
  return Number(num || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}

function getStartOfToday(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfWeek(){
  const d = new Date();
  const day = d.getDay() || 7;
  if(day !== 1){
    d.setHours(-24 * (day - 1));
  }
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfMonth(){
  const d = new Date();
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}

/* =========================
   AUTH STATE
========================= */

auth.onAuthStateChanged(user => {

  document.getElementById("loadingScreen").classList.add("hidden");

  if(user){
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    document.getElementById("shopTitle").innerText = user.email;

    loadDashboard();
  } else {
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
  }
});

/* =========================
   REGISTER / LOGIN
========================= */

async function register(){
  const shopName = shopName.value.trim();
  const emailVal = email.value.trim();
  const passVal = password.value;

  if(!shopName || !emailVal || !passVal){
    alert("Barcha maydonlarni to'ldiring");
    return;
  }

  const cred = await auth.createUserWithEmailAndPassword(emailVal, passVal);

  await db.collection("shops")
    .doc(cred.user.uid)
    .set({
      shopName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function login(){
  await auth.signInWithEmailAndPassword(
    email.value.trim(),
    password.value
  );
}

function logout(){
  auth.signOut();
}

function toggleProfileMenu(){
  profileMenu.classList.toggle("hidden");
}

/* =========================
   NAVIGATION
========================= */

function navigate(pageId){

  document.querySelectorAll(".page")
    .forEach(p=>p.classList.add("hidden"));

  document.getElementById(pageId)
    .classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
    .forEach(btn=>btn.classList.remove("active"));

  event.target.classList.add("active");

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") loadSaleProducts();
  if(pageId==="debtPage") loadDebtCustomers();
  if(pageId==="analyticsPage") loadAnalytics();
}

/* =========================
   DASHBOARD (REAL CALC)
========================= */

function loadDashboard(){

  const shopId = auth.currentUser.uid;
  const salesRef = db.collection("shops")
    .doc(shopId)
    .collection("sales");

  salesRef.onSnapshot(snapshot=>{

    let today=0, week=0, month=0;

    const startToday = getStartOfToday();
    const startWeek = getStartOfWeek();
    const startMonth = getStartOfMonth();

    snapshot.forEach(doc=>{
      const s = doc.data();
      if(!s.createdAt) return;

      const date = s.createdAt.toDate();

      if(s.type==="cash"){
        if(date >= startToday) today += s.total;
        if(date >= startWeek) week += s.total;
        if(date >= startMonth) month += s.total;
      }
    });

    todaySales.innerText = formatMoney(today);
    weekSales.innerText = formatMoney(week);
    monthSales.innerText = formatMoney(month);
  });
}

/* =========================
   SALE ENGINE
========================= */

let saleProducts=[];
let cart=[];
let isProcessing=false;

function loadSaleProducts(){
  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{
      saleProducts=[];
      snapshot.forEach(doc=>{
        saleProducts.push({id:doc.id,...doc.data()});
      });
    });
}

function searchProducts(keyword){
  searchResults.innerHTML="";
  if(!keyword) return;

  saleProducts
    .filter(p=>p.name.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p=>{
      searchResults.innerHTML+=`
        <div class="card" onclick="addToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>`;
    });
}

function addToCart(id){
  const product = saleProducts.find(p=>p.id===id);
  const existing = cart.find(i=>i.id===id);

  if(existing) existing.quantity++;
  else cart.push({
    id,
    name:product.name,
    price:product.sellingPrice||0,
    quantity:1
  });

  renderCart();
}

function renderCart(){

  const container = document.getElementById("cartList");
  container.innerHTML = "";

  let total = 0;

  cart.forEach(item => {

    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>

        Narx:
        <input type="number"
          value="${item.price}"
          onchange="changePrice('${item.id}', this.value)">

        <div class="quantity-controls">
          <button class="qty-btn"
            onclick="changeQty('${item.id}', -1)">-</button>

          <input type="number"
            value="${item.quantity}"
            style="width:60px"
            onchange="changeQtyManual('${item.id}', this.value)">

          <button class="qty-btn"
            onclick="changeQty('${item.id}', 1)">+</button>
        </div>

        <div>Jami: ${formatMoney(itemTotal)} so'm</div>

        <button style="background:red"
          onclick="removeFromCart('${item.id}')">
          O'chirish
        </button>
      </div>
    `;
  });

  document.getElementById("saleTotal").innerText = formatMoney(total);
}

async function completeSale(){

  if(isProcessing) return;
  isProcessing=true;

  if(cart.length===0){
    alert("Savatcha bo'sh");
    isProcessing=false;
    return;
  }

  const shopId=auth.currentUser.uid;
  const total=cart.reduce((s,i)=>s+i.price*i.quantity,0);

  await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add({
      items:cart,
      total,
      type:"cash",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

  cart=[];
  renderCart();
  alert("Sotuv muvaffaqiyatli");
  isProcessing=false;
}

/* =========================
   NASIYA SYSTEM
========================= */

/* =========================
   NASIYA SYSTEM (FULL)
========================= */

let debtProducts = [];
let debtCart = [];

/* Load products for Nasiya search */
function searchDebtProducts(keyword){

  const resultsDiv = document.getElementById("debtSearchResults");
  resultsDiv.innerHTML = "";

  if(!keyword) return;

  debtProducts = saleProducts; // reuse loaded products

  debtProducts
    .filter(p=>p.name.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p=>{
      resultsDiv.innerHTML += `
        <div class="card" onclick="addDebtToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>
      `;
    });
}

/* Add to Debt Cart */
function addDebtToCart(id){

  const product = saleProducts.find(p=>p.id===id);
  if(!product) return;

  const existing = debtCart.find(i=>i.id===id);

  if(existing){
    existing.quantity++;
  } else {
    debtCart.push({
      id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1
    });
  }

  renderDebtCart();
}

/* Render Debt Cart */
function renderDebtCart(){

  const container = document.getElementById("debtCartList");
  container.innerHTML = "";

  let total = 0;

  debtCart.forEach(item=>{
    total += item.price * item.quantity;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>
        ${formatMoney(item.price)} × ${item.quantity}
        <div>${formatMoney(item.price * item.quantity)} so'm</div>
      </div>
    `;
  });

}
function changePrice(id,newPrice){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  item.price = Number(newPrice);
  renderCart();
}

function changeQtyManual(id,value){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  item.quantity = Number(value);
  renderCart();
}

function removeFromCart(id){
  cart = cart.filter(i=>i.id!==id);
  renderCart();
}
/* Complete Debt Sale */
async function completeDebtSale(){

  const customerName = document.getElementById("debtCustomerName").value.trim();

  if(!customerName || debtCart.length===0){
    alert("Mijoz yoki mahsulot yo'q");
    return;
  }

  const shopId = auth.currentUser.uid;
  const total = debtCart.reduce((s,i)=>s+i.price*i.quantity,0);

  await db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .add({
      customer: customerName,
      items: debtCart,
      total,
      remaining: total,
      status: "unpaid",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  debtCart = [];
  document.getElementById("debtCustomerName").value = "";
  renderDebtCart();

  alert("Nasiya saqlandi");
}

/* Load Debt Customers */
function loadDebtCustomers(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .onSnapshot(snapshot=>{

      const container = document.getElementById("debtCustomersList");
      container.innerHTML = "";

      snapshot.forEach(doc=>{
        const d = doc.data();

        container.innerHTML += `
          <div class="card">
            <strong>${d.customer}</strong><br>
            Jami: ${formatMoney(d.total)}<br>
            Qolgan: ${formatMoney(d.remaining)}<br>

            <input type="number"
              placeholder="To'lov miqdori"
              id="pay_${doc.id}">
            <button onclick="payDebt('${doc.id}')">
              To'lov qo'shish
            </button>
          </div>
        `;
      });

    });
}

/* Pay Debt */
async function payDebt(debtId){

  const shopId = auth.currentUser.uid;
  const input = document.getElementById("pay_"+debtId);
  const amount = Number(input.value);

  if(amount <= 0){
    alert("To'g'ri summa kiriting");
    return;
  }

  const debtRef = db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .doc(debtId);

  const docSnap = await debtRef.get();
  const debt = docSnap.data();

  if(!debt) return;

  if(amount > debt.remaining){
    alert("Qoldiqdan ko'p to'lov mumkin emas");
    return;
  }

  const newRemaining = debt.remaining - amount;

  await debtRef.update({
    remaining: newRemaining,
    status: newRemaining === 0 ? "paid" : "partial"
  });

  /* ADD PAYMENT TO TODAY REVENUE */
  await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add({
      type: "debt_payment",
      total: amount,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  alert("To'lov qabul qilindi");
}
/* =========================
   ANALYTICS PRO VERSION
========================= */

let weeklyChartInstance = null;
let monthlyChartInstance = null;

function loadAnalytics(){

  const shopId = auth.currentUser.uid;
  const salesRef = db.collection("shops")
    .doc(shopId)
    .collection("sales");

  salesRef.get().then(snapshot => {

    const startWeek = getStartOfWeek();
    const startMonth = getStartOfMonth();

    const weeklyCash = [0,0,0,0,0,0,0];
    const weeklyDebt = [0,0,0,0,0,0,0];

    const monthlyCash = new Array(31).fill(0);
    const monthlyDebt = new Array(31).fill(0);

    snapshot.forEach(doc => {

      const s = doc.data();
      if(!s.createdAt) return;

      const date = s.createdAt.toDate();

      const dayIndex = (date.getDay() + 6) % 7; // Monday start
      const monthDay = date.getDate() - 1;

      if(date >= startWeek){

        if(s.type === "cash"){
          weeklyCash[dayIndex] += s.total;
        }

        if(s.type === "debt_payment"){
          weeklyDebt[dayIndex] += s.total;
        }
      }

      if(date >= startMonth){

        if(s.type === "cash"){
          monthlyCash[monthDay] += s.total;
        }

        if(s.type === "debt_payment"){
          monthlyDebt[monthDay] += s.total;
        }
      }

    });

    renderWeeklyChart(weeklyCash, weeklyDebt);
    renderMonthlyChart(monthlyCash, monthlyDebt);

  });
}

/* =========================
   WEEKLY CHART
========================= */

function renderWeeklyChart(cashData, debtData){

  if(weeklyChartInstance) weeklyChartInstance.destroy();

  weeklyChartInstance = new Chart(
    document.getElementById("weeklyChart"),
    {
      type: "bar",
      data: {
        labels: ["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],
        datasets: [
          {
            label: "Naqd",
            data: cashData,
            backgroundColor: "rgba(16,185,129,0.7)"
          },
          {
            label: "Nasiya to'lov",
            data: debtData,
            backgroundColor: "rgba(59,130,246,0.7)"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: "#f1f5f9" }
          }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" } },
          y: { ticks: { color: "#94a3b8" } }
        }
      }
    }
  );
}

/* =========================
   MONTHLY CHART
========================= */

function renderMonthlyChart(cashData, debtData){

  if(monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(
    document.getElementById("monthlyChart"),
    {
      type: "line",
      data: {
        labels: cashData.map((_,i)=>i+1),
        datasets: [
          {
            label: "Naqd",
            data: cashData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.2)",
            tension: 0.3,
            fill: true
          },
          {
            label: "Nasiya to'lov",
            data: debtData,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.2)",
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: "#f1f5f9" }
          }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" } },
          y: { ticks: { color: "#94a3b8" } }
        }
      }
    }
  );
}
