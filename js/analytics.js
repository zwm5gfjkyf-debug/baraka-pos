// ===============================
// BARAKA POS DO'KON TAHLILI
// Live inventory analytics loaded from Firestore products collection
// ===============================

let storeAnalysisListener = null

function formatNumberValue(value){
  return Number(value || 0).toLocaleString('ru-RU')
}

function getProductEmoji(name){
  const label = (name || '').toLowerCase()
  if(label.includes('suv') || label.includes('ichimlik') || label.includes('sharbat')) return '🥤'
  if(label.includes('sut') || label.includes('qatiq') || label.includes('sariyog')) return '🥛'
  if(label.includes('non') || label.includes('tuxum') || label.includes('tort')) return '🍞'
  if(label.includes('meva') || label.includes('olma') || label.includes('banan') || label.includes('sabzi') || label.includes('kartoshka')) return '🍎'
  if(label.includes("go'sht") || label.includes('tovuq') || label.includes('moll') || label.includes('go’sht')) return '🍗'
  return '📦'
}

function retryStoreAnalysis(){
  loadStoreAnalytics()
}

function loadStoreAnalytics(){
  if(!currentShopId) return

  const content = document.getElementById('storeAnalysisContent')
  const loading = document.getElementById('storeAnalysisLoading')
  const error = document.getElementById('storeAnalysisError')
  const empty = document.getElementById('storeAnalysisEmpty')

  if(content) content.classList.add('hidden')
  if(error) error.classList.add('hidden')
  if(empty) empty.classList.add('hidden')
  if(loading) loading.classList.remove('hidden')

  if(typeof storeAnalysisListener === 'function'){
    storeAnalysisListener()
    storeAnalysisListener = null
  }

  const productsQuery = db
    .collection('products')
    .where('shopId', '==', currentShopId)
    .where('status', '==', 'active')

  storeAnalysisListener = productsQuery.onSnapshot(snapshot => {
    const products = []

    snapshot.forEach(doc => {
      const raw = doc.data() || {}
      products.push({
        id: doc.id,
        name: raw.name || "Noma'lum mahsulot",
        buyPrice: Number(raw.buyPrice) || 0,
        sellPrice: Number(raw.sellPrice) || 0,
        quantity: Number(raw.quantity) || 0,
        unit: raw.unit || 'dona',
        imageUrl: raw.imageUrl || ''
      })
    })

    if(loading) loading.classList.add('hidden')

    if(products.length === 0){
      if(content) content.classList.add('hidden')
      if(empty) empty.classList.remove('hidden')
      return
    }

    if(error) error.classList.add('hidden')
    if(empty) empty.classList.add('hidden')
    if(content) content.classList.remove('hidden')

    renderStoreAnalysis(products)
  }, () => {
    if(loading) loading.classList.add('hidden')
    if(content) content.classList.add('hidden')
    if(error) error.classList.remove('hidden')
    if(empty) empty.classList.add('hidden')
  })
}

function renderStoreAnalysis(products){
  const totalProducts = products.length
  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0)
  const inventoryValue = products.reduce((sum, product) => sum + (product.buyPrice * product.quantity), 0)
  const sellValue = products.reduce((sum, product) => sum + (product.sellPrice * product.quantity), 0)
  const potentialProfit = sellValue - inventoryValue
  const averageMargin = sellValue === 0 ? 0 : Math.round((potentialProfit / sellValue) * 100)
  const outOfStockCount = products.filter(product => product.quantity === 0).length
  const lowStockProducts = products.filter(product => product.quantity > 0 && product.quantity <= 5)
  const outOfStockProducts = products.filter(product => product.quantity === 0)

  const healthPill = document.getElementById('healthPill')
  if(healthPill){
    healthPill.classList.toggle('safe', outOfStockCount === 0)
    healthPill.classList.toggle('warning', outOfStockCount !== 0)
    healthPill.innerText = outOfStockCount === 0 ? 'Sog'lom ✓' : 'Diqqat ⚠'
  }

  const inventoryValueLabel = document.getElementById('inventoryValueLabel')
  const inventoryHeroSubtitle = document.getElementById('inventoryHeroSubtitle')
  if(inventoryValueLabel) inventoryValueLabel.innerText = `${formatMoney(inventoryValue)}`
  if(inventoryHeroSubtitle) inventoryHeroSubtitle.innerText = `${formatNumberValue(totalProducts)} xil mahsulot · ${formatNumberValue(totalUnits)} ta birlik`

  const buyValueText = formatNumberValue(inventoryValue)
  const sellValueText = formatNumberValue(sellValue)
  const profitValueText = formatNumberValue(potentialProfit)

  const buyBar = document.getElementById('buyBar')
  const sellBar = document.getElementById('sellBar')
  const profitBar = document.getElementById('profitBar')
  const buyPercent = document.getElementById('buyPercent')
  const sellPercent = document.getElementById('sellPercent')
  const profitPercent = document.getElementById('profitPercent')

  const buyWidth = sellValue === 0 ? 0 : Math.round((inventoryValue / sellValue) * 100)
  const profitWidth = sellValue === 0 ? 0 : Math.max(0, Math.round((potentialProfit / sellValue) * 100))

  if(buyBar){
    buyBar.style.width = `${buyWidth}%`
    buyBar.innerText = buyValueText
  }
  if(sellBar){
    sellBar.style.width = '100%'
    sellBar.innerText = sellValueText
  }
  if(profitBar){
    profitBar.style.width = `${profitWidth}%`
    profitBar.innerText = profitValueText
  }
  if(buyPercent) buyPercent.innerText = `${buyWidth}%`
  if(sellPercent) sellPercent.innerText = '100%'
  if(profitPercent) profitPercent.innerText = `${profitWidth}%`

  const potentialProfitValue = document.getElementById('potentialProfitValue')
  const averageMarginValue = document.getElementById('averageMarginValue')
  const productTypesValue = document.getElementById('productTypesValue')
  const outOfStockValue = document.getElementById('outOfStockValue')

  if(potentialProfitValue) potentialProfitValue.innerText = formatNumberValue(potentialProfit)
  if(averageMarginValue) averageMarginValue.innerText = `${averageMargin}%`
  if(productTypesValue) productTypesValue.innerText = `${formatNumberValue(totalProducts)} ta`
  if(outOfStockValue) outOfStockValue.innerText = `${formatNumberValue(outOfStockCount)} ta`

  const productsList = document.getElementById('productsList')
  if(productsList){
    productsList.innerHTML = ''
    products.forEach(product => {
      const productRow = document.createElement('div')
      productRow.className = 'product-row'

      const imageElement = product.imageUrl ?
        `<img src="${product.imageUrl}" alt="${product.name}" class="product-image-tag">` :
        `<div class="product-emoji">${getProductEmoji(product.name)}</div>`

      const quantityLabel = product.quantity === 0 ?
        `0 ta · ${formatNumberValue(product.sellPrice)} so'm/dona · <span class="product-meta-out">× tugagan</span>` :
        `${product.quantity} ta · ${formatNumberValue(product.sellPrice)} so'm/dona${product.quantity > 0 && product.quantity <= 5 ? ' · <span class="product-meta-warning">△ kam</span>' : ''}`

      const sellValue = product.quantity > 0 ? product.sellPrice * product.quantity : 0
      const productMargin = product.sellPrice === 0 ? 0 : Math.round(((product.sellPrice - product.buyPrice) / product.sellPrice) * 100)

      productRow.innerHTML = `
        <div class="product-image">${imageElement}</div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-meta">${quantityLabel}</div>
        </div>
        <div class="product-right">
          ${product.quantity > 0 ? `<div class="product-value">${formatMoney(sellValue)}</div><div class="product-margin">↑ ${formatNumberValue(productMargin)}% foyda</div>` : `<div class="product-value product-out">0 so'm</div><div class="product-out-small">Qolmadi</div>`}
        </div>
      `

      productsList.appendChild(productRow)
    })
  }

  renderStoreStatus(products, averageMargin, lowStockProducts, outOfStockProducts)
}

function renderStoreStatus(products, averageMargin, lowStockProducts, outOfStockProducts){
  const statusRows = document.getElementById('statusRows')
  if(!statusRows) return

  const healthyProducts = products.filter(product => product.quantity > 5)
  statusRows.innerHTML = ''

  const rows = []
  rows.push({
    color: 'green',
    text: "Marja darajasi yaxshi",
    badge: `${averageMargin}% o'rtacha`,
    badgeClass: 'green'
  })

  lowStockProducts.forEach(product => {
    rows.push({
      color: 'orange',
      text: `${product.name} zaxirasi kam qoldi`,
      badge: `${formatNumberValue(product.quantity)} dona`,
      badgeClass: 'orange'
    })
  })

  outOfStockProducts.forEach(product => {
    rows.push({
      color: 'red',
      text: `${product.name} tamom — daromad yo'qotilmoqda`,
      badge: 'Shoshilinch',
      badgeClass: 'red'
    })
  })

  healthyProducts.forEach(product => {
    rows.push({
      color: 'green',
      text: `${product.name} zaxirasi etarli`,
      badge: `${formatNumberValue(product.quantity)} dona`,
      badgeClass: 'green'
    })
  })

  rows.forEach(row => {
    const item = document.createElement('div')
    item.className = 'status-row'
    item.innerHTML = `
      <div class="status-dot status-dot-${row.color}"></div>
      <div class="status-text">${row.text}</div>
      <div class="badge ${row.badgeClass}">${row.badge}</div>
    `
    statusRows.appendChild(item)
  })
}
