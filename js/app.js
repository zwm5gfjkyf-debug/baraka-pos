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
