// ===============================
// BARAKA POS INVENTORY SYSTEM
// ===============================

let productsListener = null;

let currentStockFilter = "all"; // all | low | empty
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
const barcode = document.getElementById("stockBarcode")?.value.trim() || ""
const qty = Number(document.getElementById("stockQty")?.value || 0)
const cost = Number((document.getElementById("stockCost")?.value || "0").replace(/\s/g,""))
const price = Number((document.getElementById("stockSellingPrice")?.value || "0").replace(/\s/g,""))
if(!name || price <= 0){
showTopBanner("Mahsulot nomi va narx kerak","error")
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

try{

if(existing.empty){

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

const doc = existing.docs[0]
const data = doc.data()

await db.runTransaction(async (t) => {

const freshDoc = await t.get(doc.ref)
const freshData = freshDoc.data()

const newStock = Math.max(0, (freshData.stock || 0) + (qty || 0))

t.update(doc.ref, {
stock: newStock,
cost: cost || freshData.cost,
price: price
})

})
}

showTopBanner("Zaxira yangilandi", "success")

}catch(e){

showTopBanner("Xatolik yuz berdi", "error")

}

document.getElementById("stockName").value = ""
document.getElementById("stockBarcode").value = ""
document.getElementById("stockQty").value = ""
document.getElementById("stockCost").value = ""
document.getElementById("stockSellingPrice").value = ""
const preview = document.getElementById("profitPreview")
if(preview) preview.innerText = ""
}
finally{

stockProcessing = false

}

}
// ===============================
// LOAD PRODUCTS (REALTIME)
// ===============================
function setStockFilter(type){
  currentStockFilter = type;

  // active UI
  document.querySelectorAll(".stock-tab").forEach(el=>{
    el.classList.remove("active");
  });

  const active = document.getElementById("tab-" + type);
  if(active) active.classList.add("active");

  loadCurrentStock();
}
function loadCurrentStock(){

    if(productsListener) productsListener();

   productsListener = db
.collection("shops")
.doc(currentShopId)
.collection("products")
.orderBy("created","desc")
.limit(30)
.onSnapshot(snapshot => {

const container = document.getElementById("currentStockList");
if(!container) return

container.innerHTML = ""   // 🔥 CLEAR OLD ITEMS

snapshot.forEach(doc => {

const p = doc.data()

if(p.deleted === true) return;

// FILTER
if(currentStockFilter === "low" && p.stock > 10) return;
if(currentStockFilter === "empty" && p.stock > 0) return;
const div = document.createElement("div")

div.className = "stock-row-item";

div.innerHTML = `

<!-- MOBILE -->
<div class="mobile-view">

  <div style="display:flex; justify-content:space-between; align-items:center;">
    
    <div>
      <div style="font-size:16px; font-weight:600;">
        ${p.name}
      </div>
      <div style="font-size:12px; color:#64748b;">
        ${p.barcode || ""}
      </div>
    </div>

    ${getStockBadge(p.stock)}

  </div>

  <!-- SAFE GRID -->
  <div style="
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
    margin-top:10px;
  ">

    <div>
      <div style="font-size:11px; color:#64748b;">Kirim</div>
      <div style="font-family:monospace;">
        ${formatMoney(p.cost || 0)}&nbsp;so'm
      </div>
    </div>

    <div>
      <div style="font-size:11px; color:#64748b;">Sotuv</div>
      <div style="font-family:monospace;">
        ${formatMoney(p.price || 0)}&nbsp;so'm
      </div>
    </div>

    <div>
      <div style="font-size:11px; color:#64748b;">Foyda</div>
      <div style="font-family:monospace; color:#22c55e;">
        +${formatMoney((p.price||0)-(p.cost||0))}&nbsp;so'm
      </div>
    </div>

  </div>

</div>

<!-- DESKTOP -->
<div class="desktop-row">

  <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">

    <div style="flex:2;">
      <div style="font-weight:600;">${p.name}</div>
      <div style="font-size:12px; color:#64748b;">${p.barcode || ""}</div>
    </div>

    <div style="flex:1; text-align:right; font-family:monospace;">
      ${formatMoney(p.cost || 0)}
    </div>

    <div style="flex:1; text-align:right; font-family:monospace;">
      ${formatMoney(p.price || 0)}
    </div>

    <div style="flex:1; text-align:right; color:#22c55e; font-family:monospace;">
      +${formatMoney((p.price||0)-(p.cost||0))}
    </div>

    <div style="margin-left:10px;">
      ${getStockBadge(p.stock)}
    </div>

  </div>

</div>
`;
container.appendChild(div)

})

});
} // ✅ CLOSE loadCurrentStock FUNCTION

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

showTopBanner("Mahsulot yangilandi", "success")
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

showTopBanner("Yangilandi", "success")
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

try{

await ref.update({
deleted: true
})
showTopBanner("Mahsulot o'chirildi", "success")

}catch(e){

showTopBanner("O'chirishda xatolik", "error")

}

}) // ✅ CLOSE showConfirm

} // ✅ CLOSE function
async function editProductPrompt(id){

const value = prompt("Yangi miqdor")
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

const cards = Array.from(document.getElementById("currentStockList").children)
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

const cost = Number(document.getElementById("stockCost").value.replace(/\s/g,""))
if(!cost) return

const price = Math.round(cost + (cost * percent / 100))

document.getElementById("stockSellingPrice").value = price
updateProfitPreview()
}
function setEditProfit(percent){

const cost = Number(document.getElementById("editCost").value)

if(!cost) return

const price = Math.round(cost + (cost * percent / 100))

document.getElementById("editPrice").value = price

}
let localBarcodeCounter = Number(localStorage.getItem("barcodeCounter") || 100000000)

function generateBarcode(){

localBarcodeCounter++

localStorage.setItem("barcodeCounter", localBarcodeCounter)

const barcode = String(localBarcodeCounter).padStart(9,"0")

const input = document.getElementById("stockBarcode")

if(input){
input.value = barcode
}

// 🔥 OPTIONAL: sync in background (no waiting)
syncBarcodeCounter(localBarcodeCounter)

}
function syncBarcodeCounter(counter){

if(!currentShopId) return

db.collection("shops")
.doc(currentShopId)
.collection("settings")
.doc("barcode")
.set({ barcodeCounter: counter }, { merge:true })

}
function openLabelPreview(){

const nameInput = document.getElementById("stockName")
const name = nameInput ? nameInput.value.trim() : ""
const price = Number(document.getElementById("stockSellingPrice").value.replace(/\s/g,""))
const barcode = document.getElementById("stockBarcode").value
const qty = document.getElementById("stockQty").value

if(!name || price <= 0){
showTopBanner("Mahsulot nomi va narx kerak","error")
return
}

document.getElementById("previewName").innerText = name
document.getElementById("previewPrice").innerText =
Number(price).toLocaleString("ru-RU") + " &nbsp;so'm"

document.getElementById("previewBarcodeNumber").innerText = barcode

document.getElementById("labelQty").value = Number(qty) > 0 ? qty : 1
JsBarcode("#previewBarcode", barcode, {
format: "CODE128",
width: 2,
height: 40,
margin: 0,
displayValue: false
})

document.getElementById("labelPreviewModal").classList.remove("hidden")

}
function closeLabelPreview(){
document.getElementById("labelPreviewModal").classList.add("hidden")
}
function updateProfitPreview(){

const costRaw = document.getElementById("stockCost")?.value || "0"
const priceRaw = document.getElementById("stockSellingPrice")?.value || "0"

const cost = Number(costRaw.replace(/\s/g,""))
const price = Number(priceRaw.replace(/\s/g,""))

const el = document.getElementById("profitPreview")
if(!el) return

if(cost > 0 && price > 0){

const percent = Math.round(((price - cost) / cost) * 100)

// 🔥 PROFIT (GREEN)
if(percent > 0){
el.innerText = `+${percent}% foyda`
el.style.color = "#22c55e"
}

// 🔴 LOSS (RED)
else if(percent < 0){
el.innerText = `${percent}% zarar`
el.style.color = "#ef4444"
}

// ⚪ ZERO
else{
el.innerText = `0%`
el.style.color = "#94a3b8"
}

}else{
el.innerText = ""
}
}
function getStockBadge(stock){

let color = "#22c55e"

if(stock <= 0) color = "#ef4444"
else if(stock <= 10) color = "#f59e0b"

return `
<span style="
  background:${color};
  color:black;
  padding:4px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:500;
">
  ${stock} dona
</span>
`
}
