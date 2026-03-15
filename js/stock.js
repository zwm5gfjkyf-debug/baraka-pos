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

const name = document.getElementById("stockName").value.trim()
const nameKey = name.toLowerCase()
const barcode = document.getElementById("stockBarcode").value.trim()
const qty = Number(document.getElementById("stockQty").value)
const cost = Number(document.getElementById("stockCost").value)
const price = Number(document.getElementById("stockSellingPrice").value)

if(!name || !price){
showToast("Mahsulot nomi va narx kerak")
stockProcessing = false
return
}

const productsRef = db
.collection("shops")
.doc(currentShopId)
.collection("products")

// check if product exists
const existing = await productsRef
.where("nameKey","==",nameKey).limit(1)
.get()

if(existing.empty){

// create new product
await productsRef.add({
name: name,
nameKey: nameKey,
barcode: barcode || "",
stock: Math.max(0, qty || 0),
cost: cost || 0,
price: price,
created: Date.now()
})

}else{

// update existing product
const doc = existing.docs[0]
const data = doc.data()

await doc.ref.update({
stock: Math.max(0,(data.stock || 0) + (qty || 0)),
cost: cost || data.cost,
price: price
})

}

document.getElementById("stockName").value = ""
document.getElementById("stockBarcode").value = ""
document.getElementById("stockQty").value = ""
document.getElementById("stockCost").value = ""
document.getElementById("stockSellingPrice").value = ""

showTopBanner("Zaxira yangilandi")
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
.orderBy("created","desc")
.limit(50)
.onSnapshot(snapshot => {

           const container = document.getElementById("currentStockList");
if(!container) return

container.innerHTML = ""

snapshot.forEach(doc => {

const p = doc.data()
                const div = document.createElement("div");

                div.className = "stock-item";

            div.innerHTML = `
<div class="stock-card">

<div class="stock-header">
<b>${p.name}</b>
<span class="barcode">${p.barcode || ""}</span>
</div>

<div class="stock-stats">

<div class="stock-stat">
<span>Miqdor</span>
<strong>${p.stock || 0}</strong>
</div>

<div class="stock-stat">
<span>Kelgan</span>
<strong>${formatMoney(p.cost || 0)}</strong>
</div>

<div class="stock-stat">
<span>Sotish</span>
<strong>${formatMoney(p.price || 0)}</strong>
</div>

</div>

<div class="stock-actions">

<button onclick="openEditModal('${doc.id}')">
Tahrirlash
</button>

<button onclick="deleteProduct('${doc.id}')" class="danger-btn">
O'chirish
</button>

</div>

</div>
`
                container.appendChild(div);

            });

        });

}
let editingProductId = null

async function openEditModal(id){

editingProductId = id

const doc = await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(id)
.get()

if(!doc.exists) return

const p = doc.data()

document.getElementById("currentStock").value = p.stock || 0
document.getElementById("editCost").value = p.cost || 0
document.getElementById("editPrice").value = p.price || 0

document.getElementById("addStockInput").value = ""

const modal = document.getElementById("editModal")
if(modal) modal.classList.remove("hidden")

}
function closeEditModal(){

const modal = document.getElementById("editModal")
if(modal) modal.classList.add("hidden")

}

async function saveProductEdit(){

const current = Number(document.getElementById("currentStock").value)
const add = Number(document.getElementById("addStockInput").value) || 0

const newStock = Math.max(0, current + add)
const cost = Number(document.getElementById("editCost").value)
const price = Number(document.getElementById("editPrice").value)

await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(editingProductId)
.update({

stock: newStock,
cost: cost,
price: price

})

closeEditModal()

showSuccess("Mahsulot yangilandi")

}
// ===============================
// EDIT PRODUCT
// ===============================

async function editProduct(id, field, value){

if(value === null || value === "") return

if(field !== "name"){
value = Number(value)
}

await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(id)
.update({
[field]: value
})

showSuccess("Yangilandi")

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
async function editProductPrompt(id){

const value = window.prompt("Yangi miqdor")

if(!value) return

await editProduct(id,"stock",Number(value))

}
function openAddProductModal(){
document.getElementById("addProductModal").classList.remove("hidden")
}

function closeAddProductModal(){
document.getElementById("addProductModal").classList.add("hidden")
}
function filterStock(text){

text = text.toLowerCase()

const cards = document.querySelectorAll(".stock-item")

cards.forEach(card => {

const name = card.querySelector("b").innerText.toLowerCase()
if(name.includes(text)){
card.style.display = "block"
}else{
card.style.display = "none"
}

})

}
function setProfit(percent){

const cost = Number(document.getElementById("stockCost").value)

if(!cost) return

const price = Math.round(cost + (cost * percent / 100))

document.getElementById("stockSellingPrice").value = price

}
function setEditProfit(percent){

const cost = Number(document.getElementById("editCost").value)

if(!cost) return

const price = Math.round(cost + (cost * percent / 100))

document.getElementById("editPrice").value = price

}
async function generateBarcode(){

if(!currentShopId) return

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("settings")
.doc("barcode")

const doc = await ref.get()

let counter = 1

if(doc.exists){
counter = doc.data().barcodeCounter || 1
}

counter++

ref.set({ barcodeCounter: counter }, { merge:true })

const barcode = String(counter).padStart(9,"0")

const input = document.getElementById("stockBarcode")

if(input){
input.value = barcode
}

}
function openLabelPreview(){

const name = document.getElementById("stockName").value
const price = document.getElementById("stockSellingPrice").value
const barcode = document.getElementById("stockBarcode").value

document.getElementById("previewName").innerText = name
document.getElementById("previewPrice").innerText = price + " so'm"
document.getElementById("previewBarcodeNumber").innerText = barcode

JsBarcode("#previewBarcode", barcode, {
format: "CODE128",
width: 1.5,
height: 30,
displayValue: false
})

document.getElementById("labelPreviewModal").classList.remove("hidden")

}

function closeLabelPreview(){
document.getElementById("labelPreviewModal").classList.add("hidden")
}
