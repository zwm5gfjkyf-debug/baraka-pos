const loadingScreen = document.getElementById("loadingScreen");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

auth.onAuthStateChanged(user => {

  // Always hide loading first
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

async function register() {
  const shopName = document.getElementById("shopName").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const cred = await auth.createUserWithEmailAndPassword(email, password);

  await db.collection("shops").doc(cred.user.uid).set({
    shopName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  await auth.signInWithEmailAndPassword(email, password);
}

function logout() {
  auth.signOut();
}

function navigate(pageId){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");

  if(pageId === "stockPage"){
    loadCurrentStock();
  }
}
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

    // Auto create product
    const newProduct = await productsRef.add({
      name: name,
    if(snapshot.empty){

  const newProduct = await productsRef.add({
    name: name,
    sellingPrice: 0, // default 0 until you set it
    stock: qty,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  productId = newProduct.id;

} else {

  const doc = snapshot.docs[0];
  productId = doc.id;

  const currentStock = doc.data().stock || 0;

  await productsRef.doc(productId).update({
    stock: currentStock + qty
  });
}
      stock: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    productId = newProduct.id;

  } else {

    const doc = snapshot.docs[0];
    productId = doc.id;

    const currentStock = doc.data().stock || 0;

    await productsRef.doc(productId).update({
      stock: currentStock + qty
    });
  }

  // Save stock log
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
}
