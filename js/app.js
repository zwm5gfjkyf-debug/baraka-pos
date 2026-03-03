/* =========================
   SCREEN REFERENCES
========================= */

const loadingScreen = document.getElementById("loadingScreen");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");


/* =========================
   AUTH STATE
========================= */

auth.onAuthStateChanged(user => {

  loadingScreen.classList.add("hidden");

  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    document.getElementById("shopTitle").innerText = user.email;

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
    alert("Fill all fields");
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
   NAVIGATION
========================= */

function navigate(pageId){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");

  if(pageId === "stockPage"){
    loadCurrentStock();
  }

  if(pageId === "salePage"){
    loadSaleProducts();
  }

}


/* =========================
   ADD STOCK
========================= */

async function addStock(){

  const name = document.getElementById("stockName").value.trim();
  const qty = Number(document.getElementById("stockQty").value);
  const cost = Number(document.getElementById("stockCost").value);

  if(!name || qty <= 0){
    alert("Ma'lumot to'g'ri emas");
    return;
  }

  const shopId = auth.currentUser.uid;

  const productsRef = db.collection("shops")
    .doc(shopId)
    .collection("products");

  const snapshot = await productsRef
    .where("name","==",name)
    .get();

  let productId;

  if(snapshot.empty){

    // CREATE NEW PRODUCT
    const newProduct = await productsRef.add({
      name: name,
      sellingPrice: 0,   // default
      stock: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    productId = newProduct.id;

  } else {

    // UPDATE EXISTING PRODUCT
    const docSnap = snapshot.docs[0];
    productId = docSnap.id;

    const currentStock = docSnap.data().stock || 0;

    await productsRef.doc(productId).update({
      stock: currentStock + qty
    });

  }

  // SAVE STOCK LOG
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

  // CLEAR INPUTS
  document.getElementById("stockName").value = "";
  document.getElementById("stockQty").value = "";
  document.getElementById("stockCost").value = "";

  loadCurrentStock();
}


/* =========================
   LOAD CURRENT STOCK
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
            Stock: ${p.stock || 0}<br>
            Selling:
            <input type="number"
              value="${p.sellingPrice || 0}"
              onchange="updatePrice('${doc.id}', this.value)">
          </div>
        `;
      });

    });

}


/* =========================
   UPDATE SELLING PRICE
========================= */

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


/* Load products for search */
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


/* Search Autocomplete */
function searchProducts(keyword){

  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if(!keyword) return;

  const filtered = saleProducts.filter(p =>
    p.name.toLowerCase().includes(keyword.toLowerCase())
  );

  filtered.forEach(p => {

    resultsDiv.innerHTML += `
      <div class="card" onclick="addToCart('${p.id}')">
        ${p.name} — ${p.sellingPrice || 0}
      </div>
    `;
  });

}


/* Add to Cart */
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


/* Render Cart */
function renderCart(){

  const container = document.getElementById("cartList");
  container.innerHTML = "";

  let total = 0;

  cart.forEach(item => {

    total += item.price * item.quantity;

    container.innerHTML += `
      <div class="card">
        <strong>${item.name}</strong><br>
        <input type="number"
          value="${item.price}"
          onchange="changePrice('${item.id}', this.value)">
        <br>
        <button onclick="changeQty('${item.id}', -1)">-</button>
        ${item.quantity}
        <button onclick="changeQty('${item.id}', 1)">+</button>
        <br>
        ${item.price} × ${item.quantity} = ${item.price * item.quantity}
      </div>
    `;
  });

  document.getElementById("saleTotal").innerText = total;

}


/* Change Quantity */
function changeQty(id, amount){

  const item = cart.find(i => i.id === id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    cart = cart.filter(i => i.id !== id);
  }

  renderCart();

}


/* Change Price (only for this sale) */
function changePrice(id, newPrice){

  const item = cart.find(i => i.id === id);
  if(!item) return;

  item.price = Number(newPrice);
  renderCart();

}


/* Complete Sale */
let isProcessingSale = false;

async function completeSale(){

  if(isProcessingSale) return; // prevent double click
  isProcessingSale = true;

  const button = document.querySelector("#salePage button");
  button.disabled = true;
  button.innerText = "Yuklanmoqda...";

  try {

    if(cart.length === 0){
      alert("Savatcha bo'sh");
      return;
    }

    const shopId = auth.currentUser.uid;

    const total = cart.reduce((sum, item) =>
      sum + item.price * item.quantity, 0);

    const saleRef = db.collection("shops")
      .doc(shopId)
      .collection("sales")
      .doc();

    const batch = db.batch();

    batch.set(saleRef, {
      items: cart,
      total,
      type: "cash",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    for(const item of cart){

      const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

      batch.update(productRef, {
        stock: firebase.firestore.FieldValue.increment(-item.quantity)
      });

    }

    await batch.commit();
// ===== UPDATE SMART STATS =====

const statsRef = db.collection("shops")
  .doc(shopId)
  .collection("stats")
  .doc("summary");

await statsRef.set({
  todayRevenue: firebase.firestore.FieldValue.increment(total),
  todayQuantity: firebase.firestore.FieldValue.increment(
    cart.reduce((sum,i)=>sum+i.quantity,0)
  ),
  weekRevenue: firebase.firestore.FieldValue.increment(total),
  weekQuantity: firebase.firestore.FieldValue.increment(
    cart.reduce((sum,i)=>sum+i.quantity,0)
  ),
  monthRevenue: firebase.firestore.FieldValue.increment(total),
  monthQuantity: firebase.firestore.FieldValue.increment(
    cart.reduce((sum,i)=>sum+i.quantity,0)
  ),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
},{ merge:true });
    cart = [];
    renderCart();

    alert("Sotuv muvaffaqiyatli!");

  } catch(error){
    console.error("SALE ERROR:", error);
    alert("Xatolik yuz berdi.");
  }

  isProcessingSale = false;
  button.disabled = false;
  button.innerText = "Sotuvni yakunlash";
}
/* =========================
   LOAD DASHBOARD STATS
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
        data.todayRevenue || 0;

      document.getElementById("weekSales").innerText =
        data.weekRevenue || 0;

      document.getElementById("monthSales").innerText =
        data.monthRevenue || 0;

    });

}
