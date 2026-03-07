// ===============================
// BARAKA POS INVENTORY SYSTEM
// ===============================

let productsListener = null;


// ===============================
// ADD PRODUCT
// ===============================
let stockProcessing = false

async function addStock(){

if(stockProcessing) return
stockProcessing = true

try{

const name = document.getElementById("stockName").value.trim().toLowerCase()
const qty = Number(document.getElementById("stockQty").value)
const cost = Number(document.getElementById("stockCost").value)
const price = Number(document.getElementById("stockSellingPrice").value)

if(!name || !price){
showToast("Mahsulot nomi va narx kerak")
return
}

const productsRef = db
.collection("shops")
.doc(currentShopId)
.collection("products")

// check if product exists
const existing = await productsRef
.where("name","==",name)
.get()

if(existing.empty){

// create new product
await productsRef.add({
name: name,
stock: qty || 0,
cost: cost || 0,
price: price,
created: Date.now()
})

}else{

// update existing product
const doc = existing.docs[0]
const data = doc.data()

await doc.ref.update({
stock: (data.stock || 0) + (qty || 0),
cost: cost || data.cost,
price: price
})

}

document.getElementById("stockName").value = ""
document.getElementById("stockQty").value = ""
document.getElementById("stockCost").value = ""
document.getElementById("stockSellingPrice").value = ""

showSuccess("Zaxira yangilandi")

loadCurrentStock()

}
finally{

stockProcessing = false

}

}
// ===============================
// LOAD PRODUCTS (REALTIME)
// ===============================

function loadCurrentStock(){

    if(productsListener) productsListener();

    productsListener = db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .onSnapshot(snapshot => {

            const container = document.getElementById("currentStockList");

            container.innerHTML = "";

            snapshot.forEach(doc => {

                const p = doc.data();

                const div = document.createElement("div");

                div.className = "stock-item";

              div.innerHTML = `

<div class="stock-card">

<div class="stock-title">
${p.name}
</div>

<div class="stock-divider"></div>

<div class="stock-row">
<span>Stock</span>
<span>${p.stock || 0}</span>
</div>

<div class="stock-row">
<span>Cost</span>
<span>${formatMoney(p.cost || 0)}</span>
</div>

<div class="stock-row">
<span>Price</span>
<span>${formatMoney(p.price || 0)}</span>
</div>

<div class="stock-divider"></div>

<div class="stock-actions">

<button onclick="editProductPrompt('${doc.id}')">
Edit
</button>

<button onclick="deleteProduct('${doc.id}')" class="danger-btn">
Delete
</button>

</div>

</div>

`;
                container.appendChild(div);

            });

        });

}


// ===============================
// EDIT PRODUCT
// ===============================

async function editProduct(id, field, value){

    if(field !== "name"){
        value = Number(value);
    }

    await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .doc(id)
        .update({
            [field]: value
        });

}


// ===============================
// DELETE PRODUCT
// ===============================

function deleteProduct(id){

showConfirm("Mahsulotni o'chirishni xohlaysizmi?", async () => {

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(id)

await ref.delete()

showSuccess("Mahsulot o'chirildi")

})

}
function editProductPrompt(id){

const newStock = prompt("New stock quantity")

if(newStock === null) return

editProduct(id,"stock",Number(newStock))

}
