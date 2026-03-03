/* =========================
   SCREEN REFERENCES
========================= */

const loadingScreen = document.getElementById("loadingScreen");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

/* =========================
   FORMAT MONEY
========================= */

function formatMoney(num){
  return Number(num || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}

/* =========================
   AUTH STATE
========================= */

auth.onAuthStateChanged(user => {

  loadingScreen.classList.add("hidden");

  if (user) {

    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    document.getElementById("shopTitle").innerText = user.email;

    loadDashboard(); // IMPORTANT

  } else {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
  }

});

/* =========================
   REGISTER
========================= */

async function register() {

  const shopName = document.getElementById("shopName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if(!shopName || !email || !password){
    alert("Barcha maydonlarni to'ldiring");
    return;
  }

  const cred = await auth.createUserWithEmailAndPassword(email, password);

  await db.collection("shops")
    .doc(cred.user.uid)
    .set({
      shopName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

}

/* =========================
   LOGIN
========================= */

async function login() {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  await auth.signInWithEmailAndPassword(email, password);

}

/* =========================
   LOGOUT
========================= */

function logout(){
  auth.signOut();
}

/* =========================
   PROFILE MENU
========================= */

function toggleProfileMenu(){
  document.getElementById("profileMenu").classList.toggle("hidden");
}

/* =========================
   NAVIGATION
========================= */

function navigate(pageId){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");

  // bottom nav active state
  document.querySelectorAll(".bottom-nav button")
    .forEach(btn => btn.classList.remove("active"));

  event.target.classList.add("active");

  if(pageId === "dashboardPage"){
    loadDashboard();
  }

  if(pageId === "stockPage"){
    loadCurrentStock();
  }

  if(pageId === "salePage"){
    loadSaleProducts();
  }

}

/* =========================
   DASHBOARD
========================= */

function loadDashboard(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("stats")
    .doc("summary")
    .onSnapshot(doc => {

      if(!doc.exists) return;

      const data = doc.data();

      document.getElementById("todaySales").innerText =
        formatMoney(data.todayRevenue);

      document.getElementById("weekSales").innerText =
        formatMoney(data.weekRevenue);

      document.getElementById("monthSales").innerText =
        formatMoney(data.monthRevenue);

    });

}

/* =========================
   ADD STOCK
========================= */

async function addStock(){

  const name = document.getElementById("stockName").value.trim();
  const qty = Number(document.getElementById("stockQty").value);
  const cost = Number(document.getElementById("stockCost").value);

  if(!name || qty <= 0){
    alert("Ma'lumot noto'g'ri");
    return;
  }

  const shopId = auth.currentUser.uid;
  const productsRef = db.collection("shops")
    .doc(shopId)
    .collection("products");

  const snapshot = await productsRef.where("name","==",name).get();

  let productId;

  if(snapshot.empty){

    const newProduct = await productsRef.add({
      name,
      sellingPrice: 0,
      stock: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    productId = newProduct.id;

  } else {

    const docSnap = snapshot.docs[0];
    productId = docSnap.id;

    await productsRef.doc(productId).update({
      stock: firebase.firestore.FieldValue.increment(qty)
    });

  }

  await db.collection("shops")
    .doc(shopId)
    .collection("stockLogs")
    .add({
      productId,
      name,
      quantityAdded: qty,
      costPrice: cost,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  document.getElementById("stockName").value = "";
  document.getElementById("stockQty").value = "";
  document.getElementById("stockCost").value = "";

  loadCurrentStock();
}

/* =========================
   LOAD STOCK
========================= */

function loadCurrentStock(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot => {

      const container = document.getElementById("currentStockList");
      container.innerHTML = "";

      snapshot.forEach(doc => {

        const p = doc.data();

        container.innerHTML += `
          <div class="card">
            <strong>${p.name}</strong><br>
            Ombor: ${p.stock || 0}<br>
            Sotish narxi:
            <input type="number"
              value="${p.sellingPrice || 0}"
              onchange="updatePrice('${doc.id}', this.value)">
          </div>
        `;
      });

    });

}

async function updatePrice(productId, newPrice){

  const shopId = auth.currentUser.uid;

  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(productId)
    .update({
      sellingPrice: Number(newPrice)
    });

}

/* =========================
   SALE ENGINE
========================= */

let saleProducts = [];
let cart = [];
let isProcessingSale = false;

function loadSaleProducts(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot => {

      saleProducts = [];

      snapshot.forEach(doc => {
        saleProducts.push({
          id: doc.id,
          ...doc.data()
        });
      });

    });
}

function searchProducts(keyword){

  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if(!keyword) return;

  saleProducts
    .filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p => {

      resultsDiv.innerHTML += `
        <div class="card" onclick="addToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>
      `;
    });
}

function addToCart(productId){

  const product = saleProducts.find(p => p.id === productId);
  if(!product) return;

  const existing = cart.find(item => item.id === productId);

  if(existing){
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1
    });
  }

  renderCart();
}

function renderCart(){

  const container = document.getElementById("cartList");
  container.innerHTML = "";

  let total = 0;

  cart.forEach(item => {

    total += item.price * item.quantity;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>
        ${formatMoney(item.price)} × ${item.quantity}
        <div class="quantity-controls">
          <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
          <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
        </div>
        <div>${formatMoney(item.price * item.quantity)} so'm</div>
      </div>
    `;
  });

  document.getElementById("saleTotal").innerText = formatMoney(total);
}

function changeQty(id, amount){

  const item = cart.find(i => i.id === id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    cart = cart.filter(i => i.id !== id);
  }

  renderCart();
}

async function completeSale(){

  if(isProcessingSale) return;
  isProcessingSale = true;

  const button = document.getElementById("completeSaleBtn");
  button.disabled = true;
  button.innerText = "Yuklanmoqda...";

  try {

    if(cart.length === 0){
      alert("Savatcha bo'sh");
      return;
    }

    const shopId = auth.currentUser.uid;
    const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);

    const saleRef = db.collection("shops")
      .doc(shopId)
      .collection("sales")
      .doc();

    const batch = db.batch();

    batch.set(saleRef,{
      items: cart,
      total,
      type:"cash",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    cart.forEach(item=>{
      const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

      batch.update(productRef,{
        stock: firebase.firestore.FieldValue.increment(-item.quantity)
      });
    });

    await batch.commit();

    const statsRef = db.collection("shops")
      .doc(shopId)
      .collection("stats")
      .doc("summary");

    await statsRef.set({
      todayRevenue: firebase.firestore.FieldValue.increment(total),
      weekRevenue: firebase.firestore.FieldValue.increment(total),
      monthRevenue: firebase.firestore.FieldValue.increment(total),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },{ merge:true });

    cart = [];
    renderCart();

    alert("Sotuv muvaffaqiyatli!");

  } catch(error){
    console.error(error);
    alert("Xatolik yuz berdi");
  }

  isProcessingSale = false;
  button.disabled = false;
  button.innerText = "Sotuvni yakunlash";
}
