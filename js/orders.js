/**
 * Buyurtma (stock order / delivery) — shops/{shopId}/orders/{orderId}
 */
(function () {
  let currentOrderId = null
  let currentOrder = null
  let productsCache = []
  let productsUnsub = null
  let activeFilter = 'order'
  let searchQuery = ''
  let saveTimer = null
  let finalizing = false
  let scannerRunning = false
  let suppressSave = false
  let orderReadonly = false
  let ordersListCache = []
  let ordersListUnsub = null
  let ordersListSearch = ''

  const ORDER_NUMBER_START = 1000001

  function shopId() {
    return window.currentShopId || (typeof currentShopId !== 'undefined' ? currentShopId : null) || null
  }

  function ordersCol() {
    return db.collection('shops').doc(shopId()).collection('orders')
  }

  function productsCol() {
    return db.collection('shops').doc(shopId()).collection('products')
  }

  function orderCounterRef() {
    return db.collection('shops').doc(shopId()).collection('counters').doc('orderCounter')
  }

  function safeNum(v) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function shopDisplayName() {
    if (typeof sidebarData !== 'undefined' && sidebarData && sidebarData.shopName) {
      return sidebarData.shopName
    }
    const el = document.getElementById('sidebarShopName')
    if (el && el.textContent && el.textContent.trim()) return el.textContent.trim()
    return "Do'kon"
  }

  function formatOrderStamp(d) {
    const pad = n => String(n).padStart(2, '0')
    return (
      d.getFullYear() + '.' +
      pad(d.getMonth() + 1) + '.' +
      pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes())
    )
  }

  function defaultOrderTitle(d) {
    return shopDisplayName() + ' Buyurtma ' + formatOrderStamp(d || new Date())
  }

  function calcMarkup(deliveryPrice, salePrice) {
    const cost = safeNum(deliveryPrice)
    if (cost <= 0) return 0
    return Math.round(((safeNum(salePrice) - cost) / cost) * 1000) / 10
  }

  function saleFromMarkup(deliveryPrice, markupPercent) {
    const cost = safeNum(deliveryPrice)
    return Math.round(cost + (cost * safeNum(markupPercent) / 100))
  }

  function money(n) {
    if (typeof formatMoney === 'function') return formatMoney(n)
    return Math.round(safeNum(n)).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS'
  }

  function isFinalizedStatus(status) {
    // 'yaratildi' kept for backward compatibility with older drafts
    return status === 'tasdiqlangan' || status === 'yaratildi'
  }

  function statusLabel(status) {
    if (isFinalizedStatus(status)) return 'Tasdiqlangan'
    if (status === 'bekor qilindi') return 'Bekor qilindi'
    return 'Qoralama'
  }

  function orderUnits(items) {
    return (items || []).reduce((s, it) => s + safeNum(it.orderQty), 0)
  }

  function orderDeliverySum(items) {
    return (items || []).reduce((s, it) => s + safeNum(it.deliveryPrice) * safeNum(it.orderQty), 0)
  }

  function orderSaleSum(items) {
    return (items || []).reduce((s, it) => s + safeNum(it.salePrice) * safeNum(it.orderQty), 0)
  }

  function moneyCellHtml(amount) {
    const n = safeNum(amount)
    const amountText = typeof formatMoneyAmount === 'function'
      ? formatMoneyAmount(n)
      : Math.round(n).toLocaleString('uz-UZ').replace(/,/g, ' ')
    const label = typeof CURRENCY_LABEL !== 'undefined' ? CURRENCY_LABEL : 'UZS'
    return (
      '<span class="buyurtmalar-money">' +
      '<span class="buyurtmalar-money-amount">' + escapeHtml(amountText) + '</span>' +
      '<span class="buyurtmalar-money-currency">' + escapeHtml(label) + '</span>' +
      '</span>'
    )
  }

  function timestampToDate(ts) {
    if (!ts) return null
    if (typeof ts.toDate === 'function') {
      try { return ts.toDate() } catch (e) { return null }
    }
    if (typeof ts === 'string') {
      const d = new Date(ts)
      return Number.isFinite(d.getTime()) ? d : null
    }
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000)
    return null
  }

  function formatDateTime(ts) {
    const d = timestampToDate(ts)
    if (!d) return '—'
    const pad = n => String(n).padStart(2, '0')
    return (
      d.getFullYear() + '.' +
      pad(d.getMonth() + 1) + '.' +
      pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes())
    )
  }

  function applyOrderReadonlyUi() {
    const readonly = !!orderReadonly
    const page = document.getElementById('buyurtmaPage')
    if (page) page.classList.toggle('is-readonly', readonly)

    const renameBtn = document.querySelector('#buyurtmaPage .buyurtma-rename-btn')
    if (renameBtn) renameBtn.style.display = readonly ? 'none' : ''

    const cancelBtn = document.querySelector('#buyurtmaPage .buyurtma-btn-cancel')
    const confirmBtn = document.getElementById('buyurtmaConfirmBtn')
    if (cancelBtn) cancelBtn.style.display = readonly ? 'none' : ''
    if (confirmBtn) confirmBtn.style.display = readonly ? 'none' : ''

    const scanBtn = document.getElementById('buyurtmaScanBtn')
    const addBtn = document.querySelector('#buyurtmaPage .buyurtma-actions-row .buyurtma-btn-primary')
    if (scanBtn) scanBtn.style.display = readonly ? 'none' : ''
    if (addBtn) addBtn.style.display = readonly ? 'none' : ''

    document.querySelectorAll('#buyurtmaTableBody input').forEach(input => {
      input.disabled = readonly
    })
  }

  function scheduleSave() {
    if (suppressSave || orderReadonly || !currentOrderId || !currentOrder) return
    if (currentOrder.status !== 'qoralama') return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persistDraft, 400)
  }

  async function persistDraft() {
    if (!currentOrderId || !currentOrder || currentOrder.status !== 'qoralama') return
    try {
      await ordersCol().doc(currentOrderId).update({
        title: currentOrder.title || '',
        supplierName: currentOrder.supplierName || '',
        items: currentOrder.items || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      })
    } catch (err) {
      console.error('Buyurtma draft save failed:', err)
    }
  }

  function flushSave() {
    clearTimeout(saveTimer)
    return persistDraft()
  }

  function itemFromProduct(p, orderQty) {
    const deliveryPrice = safeNum(p.buyPrice)
    const salePrice = safeNum(p.sellPrice)
    return {
      productId: p.id,
      name: p.name || '',
      artikul: p.artikul || '',
      barcode: p.barcode || '',
      currentQty: safeNum(p.quantity),
      orderQty: safeNum(orderQty),
      deliveryPrice,
      markupPercent: calcMarkup(deliveryPrice, salePrice),
      salePrice
    }
  }

  function findItemIndex(productId) {
    if (!currentOrder || !currentOrder.items) return -1
    return currentOrder.items.findIndex(it => it.productId === productId)
  }

  function ensureItemForProduct(productId, defaultOrderQty) {
    if (!currentOrder) return null
    let idx = findItemIndex(productId)
    if (idx >= 0) return currentOrder.items[idx]
    const p = productsCache.find(x => x.id === productId)
    if (!p) return null
    const item = itemFromProduct(p, defaultOrderQty != null ? defaultOrderQty : 1)
    currentOrder.items.push(item)
    scheduleSave()
    return item
  }

  function updateStats() {
    const items = (currentOrder && currentOrder.items) || []
    const names = items.length
    const units = orderUnits(items)
    const deliverySum = orderDeliverySum(items)
    const saleSum = orderSaleSum(items)

    const nEl = document.getElementById('buyurtmaStatNames')
    const uEl = document.getElementById('buyurtmaStatUnits')
    const dEl = document.getElementById('buyurtmaStatDelivery')
    const sEl = document.getElementById('buyurtmaStatSale')
    if (nEl) nEl.textContent = String(names)
    if (uEl) uEl.textContent = String(units)
    if (dEl) dEl.textContent = money(deliverySum)
    if (sEl) sEl.textContent = money(saleSum)
  }

  function updateFilterCounts() {
    const orderCount = (currentOrder && currentOrder.items) ? currentOrder.items.length : 0
    const set = (id, v) => {
      const el = document.getElementById(id)
      if (el) el.textContent = String(v)
    }
    set('buyurtmaCountOrder', orderCount)
    set('buyurtmaCountAll', productsCache.length)
  }

  function matchesSearch(p, item) {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const name = (item ? item.name : p.name) || ''
    const artikul = (item ? item.artikul : p.artikul) || ''
    const barcode = (item ? item.barcode : p.barcode) || ''
    return (
      name.toLowerCase().includes(q) ||
      artikul.toLowerCase().includes(q) ||
      barcode.toLowerCase().includes(q)
    )
  }

  function rowsToRender() {
    const items = (currentOrder && currentOrder.items) || []
    const itemById = {}
    items.forEach(it => {
      if (it.productId) itemById[it.productId] = it
    })

    if (activeFilter === 'order') {
      return items
        .filter(it => matchesSearch(null, it))
        .map(it => ({ kind: 'order', productId: it.productId, item: it, product: productsCache.find(p => p.id === it.productId) || null }))
    }

    return productsCache
      .filter(p => {
        const item = itemById[p.id]
        return matchesSearch(p, item)
      })
      .map(p => ({
        kind: itemById[p.id] ? 'order' : 'catalog',
        productId: p.id,
        item: itemById[p.id] || null,
        product: p
      }))
  }

  function renderHeader() {
    if (!currentOrder) return
    const titleEl = document.getElementById('buyurtmaTitle')
    const statusEl = document.getElementById('buyurtmaStatus')
    if (titleEl) titleEl.textContent = currentOrder.title || 'Buyurtma'
    if (statusEl) statusEl.textContent = statusLabel(currentOrder.status)
  }

  function rowValuesFromProduct(p) {
    const deliveryPrice = safeNum(p && p.buyPrice)
    const salePrice = safeNum(p && p.sellPrice)
    return {
      orderQty: 0,
      deliveryPrice,
      markupPercent: calcMarkup(deliveryPrice, salePrice),
      salePrice
    }
  }

  function editableRowHtml(pid, name, artikul, barcode, currentQty, values) {
    return (
      '<tr class="buyurtma-row" data-product-id="' + escapeHtml(pid) + '">' +
      '<td class="buyurtma-name-cell">' + escapeHtml(name || '—') + '</td>' +
      '<td>' + escapeHtml(artikul || '—') + '</td>' +
      '<td>' + escapeHtml(barcode || '—') + '</td>' +
      '<td>' + escapeHtml(String(currentQty)) + '</td>' +
      '<td><input type="number" min="0" step="1" class="buyurtma-input" data-field="orderQty" value="' + escapeHtml(String(safeNum(values.orderQty))) + '"></td>' +
      '<td><input type="number" min="0" step="1" class="buyurtma-input" data-field="deliveryPrice" value="' + escapeHtml(String(safeNum(values.deliveryPrice))) + '"></td>' +
      '<td><input type="number" step="0.1" class="buyurtma-input" data-field="markupPercent" value="' + escapeHtml(String(safeNum(values.markupPercent))) + '"></td>' +
      '<td><input type="number" min="0" step="1" class="buyurtma-input" data-field="salePrice" value="' + escapeHtml(String(safeNum(values.salePrice))) + '"></td>' +
      '</tr>'
    )
  }

  function readRowFieldValues(tr) {
    const get = field => {
      const input = tr.querySelector('input[data-field="' + field + '"]')
      return input ? safeNum(input.value) : 0
    }
    return {
      orderQty: Math.max(0, Math.round(get('orderQty'))),
      deliveryPrice: Math.max(0, Math.round(get('deliveryPrice'))),
      markupPercent: get('markupPercent'),
      salePrice: Math.max(0, Math.round(get('salePrice')))
    }
  }

  function removeItemByProductId(productId) {
    if (!currentOrder || !Array.isArray(currentOrder.items)) return false
    const idx = findItemIndex(productId)
    if (idx < 0) return false
    currentOrder.items.splice(idx, 1)
    return true
  }

  function upsertItemFromRow(productId, values) {
    if (!currentOrder) return null
    let idx = findItemIndex(productId)
    if (idx < 0) {
      const p = productsCache.find(x => x.id === productId)
      if (!p) return null
      const item = itemFromProduct(p, values.orderQty)
      item.orderQty = values.orderQty
      item.deliveryPrice = values.deliveryPrice
      item.markupPercent = values.markupPercent
      item.salePrice = values.salePrice
      currentOrder.items.push(item)
      return item
    }
    const item = currentOrder.items[idx]
    item.orderQty = values.orderQty
    item.deliveryPrice = values.deliveryPrice
    item.markupPercent = values.markupPercent
    item.salePrice = values.salePrice
    return item
  }

  function renderTable() {
    const tbody = document.getElementById('buyurtmaTableBody')
    if (!tbody) return
    const rows = rowsToRender()
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="buyurtma-empty-cell">Mos mahsulot topilmadi</td></tr>'
      updateStats()
      updateFilterCounts()
      return
    }

    tbody.innerHTML = rows.map(row => {
      const inOrder = !!row.item
      const p = row.product
      const name = inOrder ? row.item.name : (p && p.name) || ''
      const artikul = inOrder ? row.item.artikul : (p && p.artikul) || ''
      const barcode = inOrder ? row.item.barcode : (p && p.barcode) || ''
      const currentQty = inOrder
        ? safeNum(row.item.currentQty)
        : safeNum(p && p.quantity)
      const pid = row.productId || ''
      const values = inOrder
        ? {
          orderQty: safeNum(row.item.orderQty),
          deliveryPrice: safeNum(row.item.deliveryPrice),
          markupPercent: safeNum(row.item.markupPercent),
          salePrice: safeNum(row.item.salePrice)
        }
        : rowValuesFromProduct(p)

      return editableRowHtml(pid, name, artikul, barcode, currentQty, values)
    }).join('')

    updateStats()
    updateFilterCounts()
  }

  function refreshUi() {
    renderHeader()
    renderTable()
    applyOrderReadonlyUi()
  }

  function bindProductsListener() {
    if (typeof productsUnsub === 'function') {
      productsUnsub()
      productsUnsub = null
    }
    if (!shopId()) return
    productsUnsub = productsCol()
      .orderBy('created', 'desc')
      .onSnapshot(snap => {
        productsCache = []
        snap.forEach(doc => {
          const raw = doc.data() || {}
          if (raw.deleted === true) return
          productsCache.push(Object.assign({ id: doc.id }, raw))
        })
        // Refresh currentQty snapshots for order items from live stock
        if (currentOrder && Array.isArray(currentOrder.items)) {
          currentOrder.items.forEach(it => {
            const p = productsCache.find(x => x.id === it.productId)
            if (p) it.currentQty = safeNum(p.quantity)
          })
        }
        refreshUi()
      }, err => {
        console.error('Buyurtma products listener error:', err)
      })
  }

  function bindUiOnce() {
    if (bindUiOnce.done) return
    bindUiOnce.done = true

    const tbody = document.getElementById('buyurtmaTableBody')
    if (tbody) {
      tbody.addEventListener('change', e => {
        if (orderReadonly) return
        const input = e.target.closest('input[data-field]')
        if (!input) return
        const tr = input.closest('tr[data-product-id]')
        if (!tr || !currentOrder) return
        const pid = tr.getAttribute('data-product-id')
        if (!pid) return

        const field = input.getAttribute('data-field')
        const values = readRowFieldValues(tr)

        if (field === 'orderQty') {
          values.orderQty = Math.max(0, Math.round(safeNum(input.value)))
        } else if (field === 'deliveryPrice') {
          values.deliveryPrice = Math.max(0, Math.round(safeNum(input.value)))
          values.markupPercent = calcMarkup(values.deliveryPrice, values.salePrice)
        } else if (field === 'markupPercent') {
          values.markupPercent = safeNum(input.value)
          values.salePrice = saleFromMarkup(values.deliveryPrice, values.markupPercent)
        } else if (field === 'salePrice') {
          values.salePrice = Math.max(0, Math.round(safeNum(input.value)))
          values.markupPercent = calcMarkup(values.deliveryPrice, values.salePrice)
        }

        // Auto-add when Buyurtmaga > 0; remove when it returns to 0
        if (values.orderQty <= 0) {
          const removed = removeItemByProductId(pid)
          if (removed) {
            scheduleSave()
            refreshUi()
            return
          }
          // Still catalog-only: keep price/markup math live in the row without saving
          const markupInput = tr.querySelector('input[data-field="markupPercent"]')
          const saleInput = tr.querySelector('input[data-field="salePrice"]')
          if (markupInput) markupInput.value = String(values.markupPercent)
          if (saleInput) saleInput.value = String(values.salePrice)
          return
        }

        upsertItemFromRow(pid, values)
        scheduleSave()
        refreshUi()
      })
    }
  }

  async function openOrder(orderId, opts) {
    bindUiOnce()
    stopBuyurtmaScanner()
    currentOrderId = orderId
    window.__currentBuyurtmaId = orderId
    activeFilter = 'order'
    searchQuery = ''
    const searchEl = document.getElementById('buyurtmaSearch')
    if (searchEl) searchEl.value = ''

    document.querySelectorAll('#buyurtmaFilterTabs .buyurtma-filter-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-order-filter') === 'order')
    })

    const snap = await ordersCol().doc(orderId).get()
    if (!snap.exists) {
      showTopBanner('Buyurtma topilmadi', 'error')
      navigate('buyurtmalarPage')
      return
    }
    currentOrder = Object.assign({ id: snap.id }, snap.data())
    if (!Array.isArray(currentOrder.items)) currentOrder.items = []
    // Keep only lines with Buyurtmaga > 0 (auto-add/remove contract)
    if (!isFinalizedStatus(currentOrder.status)) {
      currentOrder.items = currentOrder.items.filter(it => safeNum(it.orderQty) > 0)
    }
    orderReadonly = !!(opts && opts.readonly) || isFinalizedStatus(currentOrder.status)

    bindProductsListener()
    refreshUi()
    applyOrderReadonlyUi()
  }

  async function allocateOrderNumber(t) {
    const ref = orderCounterRef()
    const snap = await t.get(ref)
    let next = ORDER_NUMBER_START
    if (snap.exists) {
      const current = Number((snap.data() || {}).sequence) || 0
      next = current >= ORDER_NUMBER_START ? current + 1 : ORDER_NUMBER_START
      t.update(ref, { sequence: next })
    } else {
      t.set(ref, { sequence: next }, { merge: true })
    }
    return next
  }

  async function startNewBuyurtma() {
    const sid = shopId()
    if (!sid || typeof db === 'undefined') {
      showTopBanner('Do\'kon topilmadi', 'error')
      return
    }
    try {
      const now = new Date()
      const orderRef = ordersCol().doc()
      let orderNumber = ORDER_NUMBER_START

      await db.runTransaction(async t => {
        orderNumber = await allocateOrderNumber(t)
        t.set(orderRef, {
          title: defaultOrderTitle(now),
          supplierName: '',
          status: 'qoralama',
          orderNumber,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          finalizedAt: null,
          items: [],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      })

      orderReadonly = false
      navigate('buyurtmaPage')
      await openOrder(orderRef.id, { readonly: false })
    } catch (err) {
      console.error('Create buyurtma failed:', err)
      showTopBanner('Buyurtmani ochib bo\'lmadi', 'error')
    }
  }

  function leaveBuyurtmaPage() {
    flushSave()
    stopBuyurtmaScanner()
    // navigation.js loads the list when entering buyurtmalarPage
    navigate('buyurtmalarPage')
  }

  function cleanupBuyurtmaPage() {
    stopBuyurtmaScanner()
    clearTimeout(saveTimer)
    if (typeof productsUnsub === 'function') {
      productsUnsub()
      productsUnsub = null
    }
    window.__creatingProductForOrder = false
    window.__currentBuyurtmaId = currentOrderId
    orderReadonly = false
  }

  function setBuyurtmaFilter(filter) {
    activeFilter = filter
    document.querySelectorAll('#buyurtmaFilterTabs .buyurtma-filter-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-order-filter') === filter)
    })
    renderTable()
  }

  function onBuyurtmaSearch(value) {
    searchQuery = value || ''
    renderTable()
  }

  function renameBuyurtma() {
    if (!currentOrder || orderReadonly) return
    const next = window.prompt('Buyurtma nomi', currentOrder.title || '')
    if (next == null) return
    const trimmed = String(next).trim()
    if (!trimmed) return
    currentOrder.title = trimmed
    renderHeader()
    scheduleSave()
  }

  function openAddProductForBuyurtma() {
    if (!currentOrderId || orderReadonly) return
    flushSave()
    window.__creatingProductForOrder = true
    window.__currentBuyurtmaId = currentOrderId
    navigate('addProductPage')
  }

  function appendProductToCurrentOrder(productInfo) {
    if (!productInfo || !productInfo.productId || !currentOrder) return
    const existingIdx = findItemIndex(productInfo.productId)
    const deliveryPrice = safeNum(productInfo.buyPrice)
    const salePrice = safeNum(productInfo.sellPrice)
    const orderQty = Math.max(0, Math.round(safeNum(productInfo.orderQty)))

    if (existingIdx >= 0) {
      const it = currentOrder.items[existingIdx]
      it.orderQty = safeNum(it.orderQty) + orderQty
      it.deliveryPrice = deliveryPrice
      it.salePrice = salePrice
      it.markupPercent = calcMarkup(deliveryPrice, salePrice)
      it.name = productInfo.name || it.name
      it.artikul = productInfo.artikul || it.artikul
      it.barcode = productInfo.barcode || it.barcode
      it.currentQty = safeNum(productInfo.currentQty)
    } else {
      currentOrder.items.push({
        productId: productInfo.productId,
        name: productInfo.name || '',
        artikul: productInfo.artikul || '',
        barcode: productInfo.barcode || '',
        currentQty: safeNum(productInfo.currentQty),
        orderQty,
        deliveryPrice,
        markupPercent: calcMarkup(deliveryPrice, salePrice),
        salePrice
      })
    }
    activeFilter = 'order'
    scheduleSave()
    refreshUi()
  }

  async function finishAddProductForOrder(productInfo) {
    window.__creatingProductForOrder = false
    const orderId = window.__currentBuyurtmaId || currentOrderId
    if (!orderId) {
      navigate('stockPage')
      return
    }
    navigate('buyurtmaPage')
    if (!currentOrder || currentOrderId !== orderId) {
      await openOrder(orderId)
    }
    appendProductToCurrentOrder(productInfo)
    await flushSave()
  }

  function cancelAddProductForOrder() {
    window.__creatingProductForOrder = false
    const orderId = window.__currentBuyurtmaId || currentOrderId
    if (orderId) {
      navigate('buyurtmaPage')
      if (!currentOrder || currentOrderId !== orderId) openOrder(orderId)
    } else {
      navigate('stockPage')
    }
  }

  async function deleteCurrentDraft() {
    if (!currentOrderId) return
    stopBuyurtmaScanner()
    try {
      await ordersCol().doc(currentOrderId).delete()
    } catch (err) {
      console.error('Delete draft failed:', err)
      showTopBanner('O\'chirishda xato', 'error')
      return
    }
    currentOrderId = null
    currentOrder = null
    window.__currentBuyurtmaId = null
    cleanupBuyurtmaPage()
    navigate('buyurtmalarPage')
  }

  function cancelBuyurtma() {
    if (orderReadonly) {
      leaveBuyurtmaPage()
      return
    }
    if (!currentOrder || currentOrder.status !== 'qoralama') {
      leaveBuyurtmaPage()
      return
    }
    const hasItems = Array.isArray(currentOrder.items) && currentOrder.items.length > 0
    if (hasItems) {
      showConfirm('Bekor qilinsinmi?', () => {
        deleteCurrentDraft()
      }, 'Buyurtmani bekor qilish', 'Ha', 'Yo\'q')
    } else {
      deleteCurrentDraft()
    }
  }

  async function finalizeBuyurtma() {
    if (finalizing || orderReadonly || !currentOrderId || !currentOrder) return
    if (currentOrder.status !== 'qoralama') {
      showTopBanner('Bu buyurtma allaqachon tasdiqlangan', 'error')
      return
    }

    await flushSave()

    const items = (currentOrder.items || []).filter(it => safeNum(it.orderQty) > 0)
    if (!items.length) {
      showTopBanner('Kamida 1 ta mahsulot uchun Buyurtmaga > 0 kiriting', 'error')
      return
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) {
        showTopBanner('Ba\'zi mahsulotlarda productId yo\'q', 'error')
        return
      }
    }

    finalizing = true
    const confirmBtn = document.getElementById('buyurtmaConfirmBtn')
    if (confirmBtn) {
      confirmBtn.disabled = true
      confirmBtn.textContent = 'Tasdiqlanmoqda...'
    }
    try {
      // Transaction: fresh product reads before stock writes (safe vs double-tap / concurrent finalize)
      await db.runTransaction(async t => {
        const orderRef = ordersCol().doc(currentOrderId)
        const orderSnap = await t.get(orderRef)
        if (!orderSnap.exists) throw new Error('ORDER_MISSING')
        const orderData = orderSnap.data() || {}
        if (orderData.status !== 'qoralama') throw new Error('ORDER_NOT_DRAFT')

        const productRefs = items.map(it => productsCol().doc(it.productId))
        const productSnaps = []
        for (let i = 0; i < productRefs.length; i++) {
          productSnaps.push(await t.get(productRefs[i]))
        }

        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const snap = productSnaps[i]
          if (!snap.exists) throw new Error('PRODUCT_MISSING:' + it.productId)
          const fresh = snap.data() || {}
          const addQty = Math.round(safeNum(it.orderQty))
          const newStock = Math.max(0, safeNum(fresh.quantity) + addQty)
          const updateData = {
            quantity: newStock,
            buyPrice: safeNum(it.deliveryPrice),
            sellPrice: safeNum(it.salePrice)
          }
          if (addQty > 0) {
            updateData.initialStock = newStock
          }
          t.update(productRefs[i], updateData)
        }

        t.update(orderRef, {
          status: 'tasdiqlangan',
          finalizedAt: firebase.firestore.FieldValue.serverTimestamp(),
          items: currentOrder.items || [],
          title: currentOrder.title || '',
          supplierName: currentOrder.supplierName || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      })

      currentOrder.status = 'tasdiqlangan'
      showTopBanner('Buyurtma tasdiqlandi', 'success')
      stopBuyurtmaScanner()
      cleanupBuyurtmaPage()
      currentOrderId = null
      currentOrder = null
      window.__currentBuyurtmaId = null
      navigate('buyurtmalarPage')
    } catch (err) {
      console.error('Finalize buyurtma failed:', err)
      const msg = String(err && err.message || '')
      if (msg.indexOf('PRODUCT_MISSING') === 0) {
        showTopBanner('Mahsulot topilmadi', 'error')
      } else if (msg === 'ORDER_NOT_DRAFT') {
        showTopBanner('Bu buyurtma allaqachon tasdiqlangan', 'error')
      } else {
        showTopBanner('Tasdiqlashda xato', 'error')
      }
    } finally {
      finalizing = false
      if (confirmBtn) {
        confirmBtn.disabled = false
        confirmBtn.textContent = 'Tasdiqlash'
      }
    }
  }

  function stopBuyurtmaScanner() {
    const wrap = document.getElementById('buyurtmaScanner')
    const btn = document.getElementById('buyurtmaScanBtn')
    if (wrap) wrap.classList.add('hidden')
    if (btn) btn.textContent = 'Skanerlashni yoqish'
    if (scannerRunning && window.Quagga) {
      try {
        Quagga.stop()
        if (Quagga.offDetected) Quagga.offDetected()
      } catch (e) { /* ignore */ }
    }
    scannerRunning = false
  }

  function handleOrderBarcode(code) {
    const barcode = String(code || '').trim()
    if (!barcode) return
    const product = productsCache.find(p => String(p.barcode || '') === barcode)
    if (!product) {
      showTopBanner('Mahsulot topilmadi', 'error')
      return
    }
    ensureItemForProduct(product.id, 1)
    activeFilter = 'order'
    document.querySelectorAll('#buyurtmaFilterTabs .buyurtma-filter-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-order-filter') === 'order')
    })
    const searchEl = document.getElementById('buyurtmaSearch')
    if (searchEl) {
      searchEl.value = barcode
      searchQuery = barcode
    }
    refreshUi()
    showTopBanner(product.name || 'Qo\'shildi', 'success')
    stopBuyurtmaScanner()
  }

  function toggleBuyurtmaScanner() {
    if (orderReadonly) return
    if (scannerRunning) {
      stopBuyurtmaScanner()
      return
    }
    const wrap = document.getElementById('buyurtmaScanner')
    const viewport = document.getElementById('buyurtmaScannerViewport')
    const btn = document.getElementById('buyurtmaScanBtn')
    if (!wrap || !viewport || !window.Quagga) {
      showTopBanner('Skaner mavjud emas', 'error')
      return
    }
    wrap.classList.remove('hidden')
    if (btn) btn.textContent = 'Skanerni o\'chirish'
    scannerRunning = true

    if (Quagga.offDetected) Quagga.offDetected()
    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: viewport,
        constraints: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      decoder: {
        readers: ['ean_reader', 'code_128_reader', 'upc_reader', 'ean_8_reader']
      },
      locate: true
    }, err => {
      if (err) {
        console.error('Order scanner error:', err)
        scannerRunning = false
        wrap.classList.add('hidden')
        if (btn) btn.textContent = 'Skanerlashni yoqish'
        showTopBanner('Kamerani yoqib bo\'lmadi', 'error')
        return
      }
      Quagga.start()
    })

    let last = 0
    Quagga.onDetected(data => {
      if (!data || !data.codeResult || !data.codeResult.code) return
      const now = Date.now()
      if (now - last < 700) return
      last = now
      handleOrderBarcode(data.codeResult.code)
    })
  }

  function renderBuyurtmalarTable() {
    const tbody = document.getElementById('buyurtmalarTableBody')
    if (!tbody) return

    const q = ordersListSearch.trim().toLowerCase()
    const rows = ordersListCache.filter(order => {
      if (!q) return true
      const title = String(order.title || '').toLowerCase()
      const num = order.orderNumber != null ? String(order.orderNumber) : ''
      const id = String(order.id || '').toLowerCase()
      return title.includes(q) || num.includes(q) || id.includes(q)
    })

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="buyurtma-empty-cell">Buyurtmalar topilmadi</td></tr>'
      return
    }

    tbody.innerHTML = rows.map(order => {
      const finalized = isFinalizedStatus(order.status)
      const badgeClass = finalized ? 'is-confirmed' : 'is-draft'
      const idLabel = order.orderNumber != null ? String(order.orderNumber) : '—'
      const units = orderUnits(order.items)
      const deliverySum = orderDeliverySum(order.items)
      const saleSum = orderSaleSum(order.items)
      const when = finalized ? formatDateTime(order.finalizedAt) : '—'
      return (
        '<tr class="buyurtmalar-row" data-order-id="' + escapeHtml(order.id) + '">' +
        '<td class="buyurtmalar-id-cell">' + escapeHtml(idLabel) + '</td>' +
        '<td class="buyurtmalar-name-cell"><button type="button" class="buyurtmalar-name-link" title="' + escapeHtml(order.title || 'Buyurtma') + '">' + escapeHtml(order.title || 'Buyurtma') + '</button></td>' +
        '<td><span class="buyurtmalar-status-badge ' + badgeClass + '">' + escapeHtml(statusLabel(order.status)) + '</span></td>' +
        '<td class="buyurtmalar-qty-cell">' + escapeHtml(String(units)) + '</td>' +
        '<td class="buyurtmalar-money-cell">' + moneyCellHtml(deliverySum) + '</td>' +
        '<td class="buyurtmalar-money-cell">' + moneyCellHtml(saleSum) + '</td>' +
        '<td class="buyurtmalar-time-cell">' + escapeHtml(when) + '</td>' +
        '</tr>'
      )
    }).join('')
  }

  function bindBuyurtmalarListUi() {
    if (bindBuyurtmalarListUi.done) return
    bindBuyurtmalarListUi.done = true
    const tbody = document.getElementById('buyurtmalarTableBody')
    if (!tbody) return
    tbody.addEventListener('click', e => {
      const tr = e.target.closest('tr[data-order-id]')
      if (!tr) return
      const id = tr.getAttribute('data-order-id')
      if (!id) return
      openBuyurtmaFromList(id)
    })
  }

  function loadBuyurtmalarList() {
    bindBuyurtmalarListUi()
    if (typeof ordersListUnsub === 'function') {
      ordersListUnsub()
      ordersListUnsub = null
    }
    const sid = shopId()
    if (!sid || typeof db === 'undefined') {
      const tbody = document.getElementById('buyurtmalarTableBody')
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="buyurtma-empty-cell">Do\'kon topilmadi</td></tr>'
      return
    }

    ordersListUnsub = ordersCol()
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        ordersListCache = []
        snap.forEach(doc => {
          const data = doc.data() || {}
          ordersListCache.push(Object.assign({ id: doc.id }, data))
        })
        renderBuyurtmalarTable()
      }, err => {
        console.error('Buyurtmalar list listener error:', err)
        // Fallback without orderBy if index/missing createdAt causes issues
        ordersCol().get().then(snap => {
          ordersListCache = []
          snap.forEach(doc => {
            ordersListCache.push(Object.assign({ id: doc.id }, doc.data() || {}))
          })
          ordersListCache.sort((a, b) => {
            const am = timestampToDate(a.createdAt)
            const bm = timestampToDate(b.createdAt)
            return (bm ? bm.getTime() : 0) - (am ? am.getTime() : 0)
          })
          renderBuyurtmalarTable()
        }).catch(e2 => {
          console.error('Buyurtmalar fallback load failed:', e2)
          const tbody = document.getElementById('buyurtmalarTableBody')
          if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="buyurtma-empty-cell">Yuklashda xato</td></tr>'
        })
      })
  }

  function cleanupBuyurtmalarPage() {
    if (typeof ordersListUnsub === 'function') {
      ordersListUnsub()
      ordersListUnsub = null
    }
  }

  function openBuyurtmalarPage() {
    navigate('buyurtmalarPage')
    loadBuyurtmalarList()
  }

  function leaveBuyurtmalarPage() {
    cleanupBuyurtmalarPage()
    navigate('stockPage')
  }

  function onBuyurtmalarSearch(value) {
    ordersListSearch = value || ''
    renderBuyurtmalarTable()
  }

  async function openBuyurtmaFromList(orderId) {
    const cached = ordersListCache.find(o => o.id === orderId)
    const readonly = cached ? isFinalizedStatus(cached.status) : false
    navigate('buyurtmaPage')
    await openOrder(orderId, { readonly })
  }

  window.startNewBuyurtma = startNewBuyurtma
  window.openBuyurtmaPage = openOrder
  window.leaveBuyurtmaPage = leaveBuyurtmaPage
  window.cleanupBuyurtmaPage = cleanupBuyurtmaPage
  window.setBuyurtmaFilter = setBuyurtmaFilter
  window.onBuyurtmaSearch = onBuyurtmaSearch
  window.renameBuyurtma = renameBuyurtma
  window.cancelBuyurtma = cancelBuyurtma
  window.finalizeBuyurtma = finalizeBuyurtma
  window.openAddProductForBuyurtma = openAddProductForBuyurtma
  window.finishAddProductForOrder = finishAddProductForOrder
  window.cancelAddProductForOrder = cancelAddProductForOrder
  window.toggleBuyurtmaScanner = toggleBuyurtmaScanner
  window.appendProductToCurrentOrder = appendProductToCurrentOrder
  window.openBuyurtmalarPage = openBuyurtmalarPage
  window.leaveBuyurtmalarPage = leaveBuyurtmalarPage
  window.cleanupBuyurtmalarPage = cleanupBuyurtmalarPage
  window.onBuyurtmalarSearch = onBuyurtmalarSearch
  window.loadBuyurtmalarList = loadBuyurtmalarList
})()
