// ===============================
// BARAKA POS INVENTORY SYSTEM
// ===============================

let productsListener = null;
let stockContainer = null;
let currentStockFilter = "all"; // all | active | inactive | low

async function checkBarcodeExists(barcode, excludeId = null){
  const productsRef = db.collection("shops").doc(currentShopId).collection("products")
  let query = productsRef.where("barcode", "==", barcode)
  if(excludeId){
    query = query.where(firebase.firestore.FieldPath.documentId(), "!=", excludeId)
  }
  const snapshot = await query.limit(1).get()
  return !snapshot.empty
}

async function checkArtikulExists(artikul, excludeId = null){
  const productsRef = db.collection("shops").doc(currentShopId).collection("products")
  let query = productsRef.where("artikul", "==", artikul)
  if(excludeId){
    query = query.where(firebase.firestore.FieldPath.documentId(), "!=", excludeId)
  }
  const snapshot = await query.limit(1).get()
  return !snapshot.empty
}

// ===============================
// ADD PRODUCT
// ===============================
let stockProcessing = false

async function addStock(){

if(stockProcessing) return
stockProcessing = true

try{

const name = (document.getElementById("stockName")?.value || "").trim()
const nameKey = name.toLowerCase()
const barcode = document.getElementById("stockBarcode")?.value.trim() || ""
const artikul = document.getElementById("stockArtikul")?.value.trim() || ""
const unit = document.getElementById("selectedUnit")?.innerText.toLowerCase() || "dona"
const qty = Number(document.getElementById("stockQty")?.value || 0)
let buyPrice = Number((document.getElementById("stockCost")?.value || "0").replace(/\s/g,""))
const currency = currentCurrency || "UZS"
const sellPrice = Number((document.getElementById("stockSellingPrice")?.value || "0").replace(/\s/g,""))

if(barcode){
  const barcodeExists = await checkBarcodeExists(barcode)
  if(barcodeExists){
    showTopBanner("Bu barkod allaqachon mavjud","error")
    stockProcessing = false
    return
  }
}

if(artikul){
  const artikulExists = await checkArtikulExists(artikul)
  if(artikulExists){
    showTopBanner("Bu artikul allaqachon mavjud","error")
    stockProcessing = false
    return
  }
}

if(!name || sellPrice <= 0){
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
  buyPrice = Math.round(buyPrice * rate)
}


const productsRef = db
.collection("shops")
.doc(currentShopId)
.collection("products")

const forOrder = !!window.__creatingProductForOrder

// check if product exists
const existing = await productsRef
.where("nameKey","==",nameKey).limit(1)
.get()

let savedProduct = null

try{

if(existing.empty){

// From Buyurtma: create product at qty 0 — stock is applied on order finalize
const createQty = forOrder ? 0 : qty
const docRef = await productsRef.add({
name: name,
nameKey: nameKey,
barcode: barcode,
artikul: artikul,
unit: unit,

quantity: createQty,
initialStock: createQty,
buyPrice: buyPrice || 0,
sellPrice: sellPrice,
image: imageUrl || "",
created: Date.now()
})

savedProduct = {
  productId: docRef.id,
  name,
  artikul,
  barcode,
  buyPrice: buyPrice || 0,
  sellPrice,
  orderQty: forOrder ? qty : 0,
  currentQty: createQty
}

showTopBanner("Mahsulot qo'shildi", "success")
document.getElementById("barcodeError").textContent = ""
document.getElementById("artikulError").textContent = ""

}else{

const doc = existing.docs[0]
const data = doc.data()

if(barcode && barcode !== data.barcode){
  const barcodeExists = await checkBarcodeExists(barcode, doc.id)
  if(barcodeExists){
    showTopBanner("Bu barkod allaqachon mavjud","error")
    stockProcessing = false
    return null
  }
}

if(artikul && artikul !== data.artikul){
  const artikulExists = await checkArtikulExists(artikul, doc.id)
  if(artikulExists){
    showTopBanner("Bu artikul allaqachon mavjud","error")
    stockProcessing = false
    return null
  }
}

if(forOrder){
  // Don't mutate stock here — finalize will increment; just refresh prices/meta
  await doc.ref.update({
    buyPrice: buyPrice || data.buyPrice || 0,
    sellPrice: sellPrice,
    barcode: barcode || data.barcode || "",
    artikul: artikul || data.artikul || "",
    unit: unit || data.unit || "dona"
  })
  savedProduct = {
    productId: doc.id,
    name: data.name || name,
    artikul: artikul || data.artikul || "",
    barcode: barcode || data.barcode || "",
    buyPrice: buyPrice || data.buyPrice || 0,
    sellPrice,
    orderQty: qty,
    currentQty: Number(data.quantity || 0)
  }
  showTopBanner("Mahsulot buyurtmaga tayyor", "success")
}else{

await db.runTransaction(async (t) => {

const freshDoc = await t.get(doc.ref)
const freshData = freshDoc.data()

const newStock = Math.max(0, (freshData.quantity || 0) + (qty || 0))

const updateData = {
quantity: newStock,
buyPrice: buyPrice || freshData.buyPrice,
sellPrice: sellPrice,
barcode: barcode || freshData.barcode,
artikul: artikul || freshData.artikul,
unit: unit || freshData.unit
}

if(qty > 0){
updateData.initialStock = newStock
}

t.update(doc.ref, updateData)

})

savedProduct = {
  productId: doc.id,
  name: data.name || name,
  artikul: artikul || data.artikul || "",
  barcode: barcode || data.barcode || "",
  buyPrice: buyPrice || data.buyPrice || 0,
  sellPrice,
  orderQty: 0,
  currentQty: Math.max(0, (data.quantity || 0) + (qty || 0))
}

showTopBanner("Zaxira yangilandi", "success")
}

document.getElementById("barcodeError").textContent = ""
document.getElementById("artikulError").textContent = ""
}
}catch(e){

console.error("SAVE ERROR:", e)
showTopBanner("Xatolik yuz berdi", "error")
savedProduct = null
}

if(savedProduct){
  document.getElementById("stockName").value = ""
  document.getElementById("stockBarcode").value = ""
  document.getElementById("stockArtikul").value = ""
  document.getElementById("stockCost").value = ""
  document.getElementById("stockSellingPrice").value = ""
  document.getElementById("stockQty").value = ""
  const preview = document.getElementById("profitPreview")
  if(preview) preview.innerText = ""
  selectedImageFile = null
  const unitEl = document.getElementById("selectedUnit")
  if(unitEl) unitEl.innerText = "Dona"
}

return savedProduct
}
finally{

stockProcessing = false

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

  if(!currentShopId){
    return
  }

  if(typeof productsListener === "function"){
    productsListener()
    productsListener = null
  }

  productsListener = db
    .collection("shops")
    .doc(currentShopId)
    .collection("products")
    .orderBy("created","desc")
    .onSnapshot(snapshot => {
      try{

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
      let countOut = 0 // product count (QOLMADI)
      let totalUnits = 0 // sum of stock quantity for Jami
      snapshot.forEach(doc => {

        const p = doc.data()
        if(p.deleted === true) return

        const quantity = Number(p.quantity || 0)
        const initial = p.initialStock || quantity || 1
        const percent = Math.max(2, Math.min(100, (quantity / initial) * 100))

        // ✅ COUNTING
        countAll++
        totalUnits += quantity
        if(quantity > 0) countActive++
        if(quantity <= 0){
          countInactive++
          countOut++
        }
        if(percent <= 20 && quantity > 0){
          countLow++
        }

        // ✅ FILTERS
        if(currentStockFilter === "active" && quantity <= 0) return
        if(currentStockFilter === "inactive" && quantity > 0) return
        if(currentStockFilter === "low" && !(percent <= 20 && quantity > 0)) return

        let level, badgeClass, badgeText, color;
        if(quantity === 0){
          level = "out";
          badgeClass = "out";
          badgeText = "Qolmadi";
          color = "#ef4444";
        } else if(percent <= 20){
          level = "low";
          badgeClass = "low";
          badgeText = `${quantity} ${p.unit || "dona"}`;
          color = "#f59e0b";
        } else {
          level = "high";
          badgeClass = "high";
          badgeText = `${quantity} ${p.unit || "dona"}`;
          color = "#22c55e";
        }

        const formattedPrice = formatMoney(p.sellPrice || 0)

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
              <div class="bar-fill" style="width:${percent}%; background:${color};"></div>
            </div>
          </div>

          <div class="stock-right">
            <div class="stock-badge ${badgeClass}">${badgeText}</div>
            <button type="button" onclick="openProductDetails('${doc.id}')" class="stock-menu-btn" aria-label="Mahsulot ma'lumotlari">
              ⋮
            </button>
          </div>
        `

        fragment.appendChild(div)
      })

      if (countAll === 0) {
        const empty = document.createElement('div')
        empty.className = 'stock-empty-state'
        empty.innerHTML = `
          <div class="stock-empty-state-icon" aria-hidden="true">📦</div>
          <div class="stock-empty-state-copy">
            <div class="stock-empty-state-title">Zaxirada hozircha mahsulot yo‘q</div>
            <div class="stock-empty-state-subtitle">Buyurtma yaratish uchun + tugmasini bosing.</div>
          </div>
        `
        container.appendChild(empty)
      } else {
        container.appendChild(fragment)
      }

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

if(statTotal) statTotal.innerText = totalUnits
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
      }catch(processErr){
        const container = stockContainer || document.getElementById("currentStockList")
        if(container){
          container.innerHTML =
            '<div class="stock-empty-state"><div class="stock-empty-state-copy"><div class="stock-empty-state-title">Hali ma\'lumot yo\'q</div><div class="stock-empty-state-subtitle">Zaxira ro\'yxati hozircha bo\'sh.</div></div></div>'
        }
      }
    },
    err => {
      const container = document.getElementById("currentStockList")
      if(container){
        container.innerHTML =
          '<div class="stock-empty-state"><div class="stock-empty-state-copy"><div class="stock-empty-state-title">Ma\'lumotlarni yuklashda xato</div><div class="stock-empty-state-subtitle">Internet ulanishini tekshirib, sahifani yangilang.</div></div></div>'
      }
      console.error("Stock listener error:", err)
    }
    )
}

// ✅ FIX FOR navigation.js CALL
function loadCurrentStock(){
  loadCurrent()
}
let productDetailsCache = null
let labelPreviewMode = "save" // 'save' (add product) | 'print' (stock details)

async function openProductDetails(id){
  if(!id || !currentShopId) return

  const doc = await db
    .collection("shops")
    .doc(currentShopId)
    .collection("products")
    .doc(id)
    .get()

  if(!doc.exists){
    showTopBanner("Mahsulot topilmadi", "error")
    return
  }

  const p = doc.data() || {}
  productDetailsCache = Object.assign({ id: doc.id }, p)

  const setText = (elId, value) => {
    const el = document.getElementById(elId)
    if(el) el.textContent = value
  }

  setText("productDetailsName", p.name || "Noma'lum")
  setText("productDetailsArtikul", p.artikul || "—")
  setText("productDetailsBarcode", p.barcode || "—")
  setText("productDetailsBuyPrice", formatMoney(p.buyPrice || 0))
  setText("productDetailsSellPrice", formatMoney(p.sellPrice || 0))
  setText(
    "productDetailsStock",
    String(Number(p.quantity || 0)) + (p.unit ? (" " + p.unit) : " dona")
  )

  const modal = document.getElementById("productDetailsModal")
  if(modal) modal.classList.remove("hidden")
}

// Alias kept for stock-page barcode scan in sales.js
function openEditModal(id){
  return openProductDetails(id)
}

function closeProductDetailsModal(){
  const modal = document.getElementById("productDetailsModal")
  if(modal) modal.classList.add("hidden")
}

function closeEditModal(){
  closeProductDetailsModal()
}

function fillLabelPreview(name, price, barcode, qty){
  document.getElementById("previewName").innerText = name || ""
  document.getElementById("previewPrice").innerText =
    (typeof formatMoney === "function" ? formatMoney(price) : (Number(price || 0).toLocaleString("ru-RU") + " UZS"))

  const code = String(barcode || "")
  const codeEl = document.getElementById("previewCode")
  if(codeEl) codeEl.innerText = code ? code.slice(-4) : ""

  const numEl = document.getElementById("previewBarcodeNumber")
  if(numEl) numEl.innerText = code

  const qtyInput = document.getElementById("labelQty")
  if(qtyInput) qtyInput.value = qty > 0 ? qty : 1

  if(code && typeof JsBarcode === "function"){
    JsBarcode("#previewBarcode", code, {
      format: "CODE128",
      width: 1.5,
      height: 50,
      margin: 0,
      displayValue: false
    })
  }

  const qtyWrap = document.getElementById("labelQtyWrap")
  const titleEl = document.getElementById("labelPreviewTitle")
  if(labelPreviewMode === "print"){
    if(qtyWrap) qtyWrap.classList.add("hidden")
    if(titleEl) titleEl.textContent = "Narx yorlig'i"
  }else{
    if(qtyWrap) qtyWrap.classList.remove("hidden")
    if(titleEl) titleEl.textContent = "Label Preview"
  }

  document.getElementById("labelPreviewModal").classList.remove("hidden")
}

function openProductLabelPreview(){
  const p = productDetailsCache
  if(!p){
    showTopBanner("Mahsulot topilmadi", "error")
    return
  }
  const barcode = String(p.barcode || "").trim()
  if(!barcode){
    showTopBanner("Shtrix-kod yo'q", "error")
    return
  }
  labelPreviewMode = "print"
  fillLabelPreview(p.name || "", Number(p.sellPrice || 0), barcode, 1)
}

function confirmLabelPreviewAction(){
  if(labelPreviewMode === "print"){
    window.print()
    return
  }
  confirmSaveWithLabel()
}
// ===============================
// EDIT PRODUCT
// ===============================

async function editProduct(id, field, value){

if(value === null || value === "") return

if(field !== "name"){
value = Number(value)
}

const updateData = {
[field]: value
}

if(field === "quantity"){
const doc = await db.collection("shops").doc(currentShopId).collection("products").doc(id).get()
const currentQuantity = doc.data().quantity || 0
if(value > currentQuantity){
updateData.initialStock = value
}
}

await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(id)
.update(updateData)

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

await editProduct(id,"quantity",Number(value))

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
let localBarcodeCounter = Number(localStorage.getItem("barcodeCounter") || 100000000)

function generateBarcode(){

  generateUniqueBarcode()

}

async function generateUniqueBarcode(){

  let attempts = 0

  while(attempts < 10){

    localBarcodeCounter++

    const barcode = String(localBarcodeCounter).padStart(9,"0")

    const exists = await checkBarcodeExists(barcode)

    if(!exists){

      localStorage.setItem("barcodeCounter", localBarcodeCounter)

      const input = document.getElementById("stockBarcode")

      if(input){

        input.value = barcode

        document.getElementById("barcodeError").textContent = ""

      }

      // 🔥 OPTIONAL: sync in background (no waiting)

      syncBarcodeCounter(localBarcodeCounter)

      return

    }

    attempts++

  }

  showTopBanner("Barkod yaratib bo'lmadi","error")

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
  const price = Number(String(priceRaw || "").replace(/\s/g,""))

  const barcode = document.getElementById("stockBarcode").value

  if(!name || price <= 0){
    showTopBanner("Mahsulot nomi va narx kerak","error")
    return
  }

  const qtyInput = document.getElementById("stockQty")
  const qty = qtyInput ? Number(qtyInput.value) : 1

  labelPreviewMode = "save"
  fillLabelPreview(name, price, barcode, qty)
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

  generateUniqueArtikul()

}

async function generateUniqueArtikul(){

  let attempts = 0

  while(attempts < 10){

    const random = Math.floor(100000 + Math.random() * 900000)

    const artikul = "ART-" + random

    const exists = await checkArtikulExists(artikul)

    if(!exists){

      const input = document.getElementById("stockArtikul")

      if(input){

        input.value = artikul

        document.getElementById("artikulError").textContent = ""

      }

      return

    }

    attempts++

  }

  showTopBanner("Artikul yaratib bo'lmadi","error")

}
let selectedImageFile = null

function selectProductImage(){
  const backdrop = document.getElementById("imagePickerBackdrop")
  const modal = document.getElementById("imagePickerModal")
  if(backdrop) backdrop.classList.remove("hidden")
  if(modal) modal.classList.remove("hidden")
  document.body.style.overflow = 'hidden'
}

function closeImagePicker(){
  const backdrop = document.getElementById("imagePickerBackdrop")
  const modal = document.getElementById("imagePickerModal")
  if(backdrop) backdrop.classList.add("hidden")
  if(modal) modal.classList.add("hidden")
  document.body.style.overflow = ''
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
  const saved = await addStock()
  if(window.__creatingProductForOrder && typeof finishAddProductForOrder === "function"){
    if(saved && saved.productId){
      await finishAddProductForOrder(saved)
    }else{
      if(typeof cancelAddProductForOrder === "function") cancelAddProductForOrder()
    }
    return
  }
  navigate("stockPage")
}
async function confirmSaveWithLabel(){
  const saved = await addStock()
  closeLabelPreview()
  if(window.__creatingProductForOrder && typeof finishAddProductForOrder === "function"){
    if(saved && saved.productId){
      await finishAddProductForOrder(saved)
    }else{
      if(typeof cancelAddProductForOrder === "function") cancelAddProductForOrder()
    }
    return
  }
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
  const page = (typeof currentPage !== "undefined" && currentPage) || window.__barakaCurrentPage
  if(page === "unitPage"){
    navigate("addProductPage")
    return
  }
  if(page === "addProductPage" && window.__creatingProductForOrder){
    if(typeof cancelAddProductForOrder === "function"){
      cancelAddProductForOrder()
    }else{
      navigate("buyurtmaPage")
    }
    return
  }
  navigate("stockPage")
}
document.addEventListener("DOMContentLoaded", () => {
  const defaultCheck = document.getElementById("check-dona")
  if(defaultCheck) defaultCheck.classList.remove("hidden")
})

// Add event listeners for uniqueness validation
document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("stockBarcode")
  const artikulInput = document.getElementById("stockArtikul")

  if(barcodeInput){
    barcodeInput.addEventListener("blur", async () => {
      const val = barcodeInput.value.trim()
      const errorEl = document.getElementById("barcodeError")
      if(val){
        const exists = await checkBarcodeExists(val)
        errorEl.textContent = exists ? "Bu barkod allaqachon mavjud" : ""
      }else{
        errorEl.textContent = ""
      }
    })
  }

  if(artikulInput){
    artikulInput.addEventListener("blur", async () => {
      const val = artikulInput.value.trim()
      const errorEl = document.getElementById("artikulError")
      if(val){
        const exists = await checkArtikulExists(val)
        errorEl.textContent = exists ? "Bu artikul allaqachon mavjud" : ""
      }else{
        errorEl.textContent = ""
      }
    })
  }
})
