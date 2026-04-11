// ===============================
// BARAKA POS INVENTORY SYSTEM
// ===============================

let productsListener = null;
let stockContainer = null;
let currentStockFilter = "all"; // all | active | inactive | low
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
const artikul = document.getElementById("stockArtikul")?.value.trim() || ""
const unit = document.getElementById("selectedUnit")?.innerText.toLowerCase() || "dona"
const qty = Number(document.getElementById("stockQty")?.value || 0)
let cost = Number((document.getElementById("stockCost")?.value || "0").replace(/\s/g,""))
const currency = currentCurrency || "UZS"
const price = Number((document.getElementById("stockSellingPrice")?.value || "0").replace(/\s/g,""))

if(!name || price <= 0){
  showTopBanner("Mahsulot nomi va narx kerak","error")
  stockProcessing = false
  return
}
let imageUrl = ""

if(selectedImageFile){

  try{

    const formData = new FormData()
    formData.append("file", selectedImageFile)
    formData.append("upload_preset", "unsigned_upload")

    const res = await fetch("https://api.cloudinary.com/v1_1/dii93l98n/image/upload", {
      method: "POST",
      body: formData
    })

    const data = await res.json()

    imageUrl = data.secure_url

  }catch(e){

    console.error("CLOUDINARY ERROR:", e)
    imageUrl = ""

  }

}
  // 💱 USD → UZS conversion (simple fast rate)
if(currency === "USD"){
  const rate = window.usdRate || 12500
  cost = Math.round(cost * rate)
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
barcode: barcode,
artikul: artikul,
unit: unit,

stock: qty,
initialStock: qty, // ✅ ADD THIS LINE
cost: cost || 0,
price: price,
image: imageUrl || "",
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
price: price,
barcode: barcode || freshData.barcode,
artikul: artikul || freshData.artikul,
unit: unit || freshData.unit
})

})
}

showTopBanner("Zaxira yangilandi", "success") 
}catch(e){

console.error("SAVE ERROR:", e)
showTopBanner("Xatolik yuz berdi", "error")
}

document.getElementById("stockName").value = ""
document.getElementById("stockBarcode").value = ""
document.getElementById("stockArtikul").value = ""
document.getElementById("stockCost").value = ""
document.getElementById("stockSellingPrice").value = ""
document.getElementById("stockQty").value = ""
const preview = document.getElementById("profitPreview")
if(preview) preview.innerText = ""
  selectedImageFile = null
  // ✅ ADD THIS HERE
const unitEl = document.getElementById("selectedUnit")
if(unitEl) unitEl.innerText = "Dona"
}
finally{

Processing = false

}

}
// ===============================
// LOAD PRODUCTS (REALTIME)
// ===============================

// ✅ THIS matches your HTML onclick="setStockFilter(...)"
function setStockFilter(type){

  currentStockFilter = type

  document.querySelectorAll(".stock-tab").forEach(el=>{
    el.classList.remove("active")
  })

  const active = document.getElementById("tab-" + type)
  if(active) active.classList.add("active")

  loadCurrent()
}

// ✅ MAIN LOADER
function loadCurrent(){

  productsListener = db
    .collection("shops")
    .doc(currentShopId)
    .collection("products")
    .orderBy("created","desc")
    .onSnapshot(snapshot => {

      if(!stockContainer){
        stockContainer = document.getElementById("currentStockList")
      }

      const container = stockContainer
      if(!container) return

      container.innerHTML = ""

      const fragment = document.createDocumentFragment()

      let countAll = 0
      let countActive = 0
      let countInactive = 0
      let countLow = 0
      let countOut = 0 // 🔥 NEW (QOLMADI)
      snapshot.forEach(doc => {

        const p = doc.data()
        if(p.deleted === true) return

        const stock = Number(p.stock || 0)

        // ✅ COUNTING
       countAll++

if(stock > 0) countActive++
if(stock <= 0){
  countInactive++
  countOut++ // 🔥 NEW
}

if(stock > 0 && stock <= 10){
  countLow++
}
        // ✅ FILTERS
        if(currentStockFilter === "active" && stock <= 0) return
        if(currentStockFilter === "inactive" && stock > 0) return
        if(currentStockFilter === "low" && stock > 10) return

        const level = stock <= 0 ? "out" : stock <= 10 ? "low" : "high"
        const badgeClass = stock <= 0 ? "out" : stock <= 10 ? "low" : "high"
        const badgeText = stock <= 0 ? "Qolmadi" : `${stock} ${p.unit || "dona"}`
        const initial = p.initialStock || stock || 1
        const percent = Math.max(2, Math.min(100, (stock / initial) * 100))
        const formattedPrice = formatMoney(p.price || 0)

        const div = document.createElement("div")
        div.className = `stock-card ${level}`

        div.innerHTML = `
          <div class="product-img">
            ${
              p.image && p.image.trim() !== ""
                ? `<img src="${p.image}" class="product-img-tag">`
                : `<div class="product-placeholder">📦</div>`
            }
          </div>

          <div class="stock-info">
            <div class="stock-name">${p.name || "Noma'lum"}</div>
            <div class="stock-meta">${p.artikul || "-"}</div>
            <div class="stock-price">${formattedPrice}</div>
            <div class="bar-bg">
              <div class="bar-fill" style="width:${percent}%; background:${stock <= 0 ? '#ef4444' : stock <= 10 ? '#f59e0b' : '#22c55e'}"></div>
            </div>
          </div>

          <div class="stock-right">
            <div class="stock-badge ${badgeClass}">${badgeText}</div>
            <button onclick="openEditModal('${doc.id}')" class="stock-menu-btn">
              ⋮
            </button>
          </div>
        `

        fragment.appendChild(div)
      })

      container.appendChild(fragment)

      // ✅ COUNTS UI
      const elAll = document.getElementById("count-all")
      const elActive = document.getElementById("count-active")
      const elInactive = document.getElementById("count-inactive")
      const elLow = document.getElementById("count-low")

      if(elAll) elAll.innerText = countAll
      if(elActive) elActive.innerText = countActive
      if(elInactive) elInactive.innerText = countInactive
      if(elLow) elLow.innerText = countLow
      // 🔥 NEW STATS UI
const statTotal = document.getElementById("stat-total")
const statLow = document.getElementById("stat-low")
const statOut = document.getElementById("stat-out")

if(statTotal) statTotal.innerText = countAll
if(statLow) statLow.innerText = countLow
if(statOut) statOut.innerText = countOut
      // ⚠️ LOW STOCK WARNING
const warningBox = document.getElementById("lowStockWarning")
const warningText = document.getElementById("lowStockText")

if(countOut > 0){
  if(warningBox) {
    warningBox.classList.remove("hidden")
    warningBox.style.display = "flex"
  }
  if(warningText) warningText.innerText = `${countOut} ta mahsulot tugagan, zaxirani to‘ldiring`
}else{
  if(warningBox) {
    warningBox.classList.add("hidden")
    warningBox.style.display = "none"
  }
}
    })
}

// ✅ FIX FOR navigation.js CALL
function loadCurrentStock(){
  loadCurrent()
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

const name = card.querySelector(".stock-name")?.innerText.toLowerCase() || ""
if(name.includes(text)){
card.style.display = "block"
}else{
card.style.display = "none"
}

})

}
function setProfit(percent){

const cost = Number((document.getElementById("stockCost")?.value || "0").replace(/\s/g,""))
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

  const priceRaw = document.getElementById("stockSellingPrice").value
  const price = Number(priceRaw.replace(/\s/g,""))

  const barcode = document.getElementById("stockBarcode").value

  if(!name || price <= 0){
    showTopBanner("Mahsulot nomi va narx kerak","error")
    return
  }

  // ✅ NAME
  document.getElementById("previewName").innerText = name

  // ✅ PRICE (FIXED — no &nbsp bug)
  document.getElementById("previewPrice").innerText =
    price.toLocaleString("ru-RU") + " so'm"

  // ✅ SMALL CODE (NEW 🔥)
  const shortCode = barcode.slice(-4)   // last 4 digits
  const codeEl = document.getElementById("previewCode")
  if(codeEl){
    codeEl.innerText = shortCode
  }

  // ✅ BARCODE NUMBER
  document.getElementById("previewBarcodeNumber").innerText = barcode

  // ✅ QTY RESET
  const qtyInput = document.getElementById("stockQty")
const qty = qtyInput ? Number(qtyInput.value) : 1

document.getElementById("labelQty").value = qty > 0 ? qty : 1

  // ✅ BARCODE (BETTER SIZE)
  JsBarcode("#previewBarcode", barcode, {
    format: "CODE128",
    width: 1.5,
    height: 50,
    margin: 0,
    displayValue: false
  })

  // ✅ OPEN MODAL
  document.getElementById("labelPreviewModal").classList.remove("hidden")
}


function closeLabelPreview(){
  document.getElementById("labelPreviewModal").classList.add("hidden")
}
function updateProfitPreview(){

const costRaw = document.getElementById("stockCost")?.value || "0"
const priceRaw = document.getElementById("stockSellingPrice")?.value || "0"

let cost = Number(costRaw.replace(/\s/g,""))

if(currentCurrency === "USD"){
  cost = cost * (window.usdRate || 12500)
}
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
  color:white;
  padding:4px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:600;
">
  ${stock} dona
</span>
`
}
function generateArtikul(){

const random = Math.floor(100000 + Math.random() * 900000)

const artikul = "ART-" + random

const input = document.getElementById("stockArtikul")

if(input){
input.value = artikul
}

}
let selectedImageFile = null

function selectProductImage(){
  document.getElementById("imagePickerModal").classList.remove("hidden")
}

function closeImagePicker(){
  document.getElementById("imagePickerModal").classList.add("hidden")
}

function pickImage(type){

  closeImagePicker()

  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"

  if(type === "camera"){
    input.setAttribute("capture","environment")
  }

  input.onchange = (e) => {

    const file = e.target.files[0]
    if(!file) return

    selectedImageFile = file

    const reader = new FileReader()

    reader.onload = function(ev){

      const block = document.querySelector("[onclick='selectProductImage()']")

      if(block){

        block.innerHTML = `
        <img src="${ev.target.result}" style="
        width:50px;
        height:50px;
        border-radius:12px;
        object-fit:cover;
        ">

        <div>
          <div style="font-weight:600;">Rasm tanlandi</div>
          <div style="font-size:12px;color:#64748b;">
          O'zgartirish uchun bosing
          </div>
        </div>
        `
      }

    }

    reader.readAsDataURL(file)

  }

  input.click()
}
async function saveAndGoBack(){
  await addStock()
  navigate("stockPage")
}
async function confirmSaveWithLabel(){
  await addStock()
  closeLabelPreview()
  navigate("stockPage")
}
function goToLabelPreview(){

  const name = document.getElementById("stockName").value.trim()
const price = Number((document.getElementById("stockSellingPrice")?.value || "0").replace(/\s/g,""))
  if(!name || price <= 0){
    showTopBanner("Mahsulot nomi va narx kerak","error")
    return
  }

  openLabelPreview()
}
function selectUnit(unit){

  const map = {
    dona: "Dona",
    kg: "Kg",
    litr: "Litr",
    metr: "Metr"
  };

  document.getElementById("selectedUnit").innerText = map[unit];

  ["dona","kg","litr","metr"].forEach(u=>{
    const el = document.getElementById("check-"+u);
    if(el) el.classList.add("hidden");
  });

  const active = document.getElementById("check-"+unit);
  if(active) active.classList.remove("hidden");

  goBack();
}
function goBack(){
  navigate("stockPage")
}
document.addEventListener("DOMContentLoaded", () => {
  const defaultCheck = document.getElementById("check-dona")
  if(defaultCheck) defaultCheck.classList.remove("hidden")
})
