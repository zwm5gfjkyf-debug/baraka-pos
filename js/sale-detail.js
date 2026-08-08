/**
 * Sotuv tafsiloti — shops/{shopId}/sales/{saleId}
 * SPA equivalent of /sotuv/[id]
 */
(function () {
  let currentSaleId = null
  let currentSale = null
  let returnPage = 'dashboardPage'

  function shopId() {
    return window.currentShopId || (typeof currentShopId !== 'undefined' ? currentShopId : null) || null
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function money(n) {
    if (typeof formatMoney === 'function') return formatMoney(n)
    const amount = Math.round(Number(n) || 0)
    return amount.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS'
  }

  function safeNum(v) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  function paymentLabel(method) {
    const m = String(method || '').toLowerCase()
    if (m === 'cash' || m === 'naqd') return 'Naqd'
    if (m === 'card' || m === 'karta' || m === 'plastic' || m === 'plastik') return 'Karta'
    if (m === 'debt' || m === 'nasiya') return 'Nasiya'
    if (m === 'transfer' || m === "o'tkazma") return "O'tkazma"
    return method ? String(method) : '—'
  }

  function formatDateTime(ts) {
    if (!ts) return '—'
    let d = null
    if (typeof ts.toDate === 'function') {
      try { d = ts.toDate() } catch (e) { d = null }
    } else if (typeof ts === 'string' || typeof ts === 'number') {
      d = new Date(ts)
    } else if (typeof ts.seconds === 'number') {
      d = new Date(ts.seconds * 1000)
    }
    if (!d || !Number.isFinite(d.getTime())) return '—'
    const pad = n => String(n).padStart(2, '0')
    return (
      d.getFullYear() + '.' +
      pad(d.getMonth() + 1) + '.' +
      pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes())
    )
  }

  function normalizeItems(rawItems) {
    if (!Array.isArray(rawItems)) return []
    return rawItems.map(it => {
      const qty = safeNum(it.quantity != null ? it.quantity : it.qty)
      const unit = safeNum(it.unit_price != null ? it.unit_price : it.price)
      const line = it.line_total != null ? safeNum(it.line_total) : unit * qty
      return {
        productId: it.productId || it.id || null,
        name: it.product_name || it.name || 'Mahsulot',
        qty,
        unitPrice: unit,
        lineTotal: line
      }
    })
  }

  function deriveTotals(raw, items) {
    const itemsSubtotal = items.reduce((s, it) => s + it.lineTotal, 0)
    const subtotal = raw.subtotal != null ? safeNum(raw.subtotal) : itemsSubtotal
    const total = safeNum(raw.total != null ? raw.total : raw.amount)
    let discountAmount = raw.discountAmount != null
      ? safeNum(raw.discountAmount)
      : Math.max(0, subtotal - total)
    let discountPercent = raw.discountPercent != null
      ? safeNum(raw.discountPercent)
      : (subtotal > 0 ? Math.round((discountAmount / subtotal) * 1000) / 10 : 0)
    if (raw.discountType === 'percent' && raw.discountValue != null && raw.discountAmount == null) {
      discountPercent = safeNum(raw.discountValue)
      discountAmount = subtotal * discountPercent / 100
    }
    return { subtotal, discountAmount, discountPercent, total }
  }

  function transactionLabel(raw) {
    const tn = raw.transactionNumber || raw.transaction_number
    if (tn) return String(tn)
    const sn = raw.saleNumberLabel ?? raw.saleNumber ?? raw.dailySequence
    if (sn !== undefined && sn !== null && String(sn).trim() !== '') {
      return 'Sotuv #' + String(sn)
    }
    return 'Sotuv'
  }

  function renderSaleDetail(raw) {
    const items = normalizeItems(raw.items)
    const totals = deriveTotals(raw, items)
    const payment = paymentLabel(raw.payment_method || raw.paymentType || raw.type)
    const cashier = raw.cashierName || raw.cashier_name ||
      ((typeof sidebarData !== 'undefined' && sidebarData && sidebarData.shopName) ? sidebarData.shopName : '—')
    const title = transactionLabel(raw)

    const titleEl = document.getElementById('saleDetailTitle')
    const metaEl = document.getElementById('saleDetailMeta')
    const itemsEl = document.getElementById('saleDetailItems')
    const subEl = document.getElementById('saleDetailSubtotal')
    const discEl = document.getElementById('saleDetailDiscount')
    const totalEl = document.getElementById('saleDetailTotal')
    const payEl = document.getElementById('saleDetailPayment')
    const cashierEl = document.getElementById('saleDetailCashier')

    if (titleEl) titleEl.textContent = title
    if (metaEl) metaEl.textContent = formatDateTime(raw.createdAt)
    if (cashierEl) cashierEl.textContent = cashier
    if (payEl) payEl.textContent = payment
    if (subEl) subEl.textContent = money(totals.subtotal)
    if (discEl) {
      discEl.textContent = totals.discountAmount > 0
        ? (money(totals.discountAmount) + ' (' + totals.discountPercent + '%)')
        : '—'
    }
    if (totalEl) totalEl.textContent = money(totals.total)

    if (itemsEl) {
      if (!items.length) {
        itemsEl.innerHTML = '<div class="sale-detail-empty">Mahsulotlar topilmadi</div>'
      } else {
        itemsEl.innerHTML = items.map(it => (
          '<div class="sale-detail-item">' +
            '<div class="sale-detail-item-main">' +
              '<div class="sale-detail-item-name">' + escapeHtml(it.name) + '</div>' +
              '<div class="sale-detail-item-meta">' +
                escapeHtml(String(it.qty)) + ' × ' + escapeHtml(money(it.unitPrice)) +
              '</div>' +
            '</div>' +
            '<div class="sale-detail-item-total">' + escapeHtml(money(it.lineTotal)) + '</div>' +
          '</div>'
        )).join('')
      }
    }

    // Print area mirror
    const printTitle = document.getElementById('saleReceiptTitle')
    const printMeta = document.getElementById('saleReceiptMeta')
    const printCashier = document.getElementById('saleReceiptCashier')
    const printItems = document.getElementById('saleReceiptItems')
    const printSub = document.getElementById('saleReceiptSubtotal')
    const printDisc = document.getElementById('saleReceiptDiscount')
    const printTotal = document.getElementById('saleReceiptTotal')
    const printPay = document.getElementById('saleReceiptPayment')

    if (printTitle) printTitle.textContent = title
    if (printMeta) printMeta.textContent = formatDateTime(raw.createdAt)
    if (printCashier) printCashier.textContent = cashier
    if (printPay) printPay.textContent = payment
    if (printSub) printSub.textContent = money(totals.subtotal)
    if (printDisc) {
      printDisc.textContent = totals.discountAmount > 0
        ? (money(totals.discountAmount) + ' (' + totals.discountPercent + '%)')
        : '—'
    }
    if (printTotal) printTotal.textContent = money(totals.total)
    if (printItems) {
      printItems.innerHTML = items.map(it => (
        '<tr>' +
          '<td>' + escapeHtml(it.name) + '</td>' +
          '<td class="sale-receipt-num">' + escapeHtml(String(it.qty)) + '</td>' +
          '<td class="sale-receipt-num">' + escapeHtml(money(it.unitPrice)) + '</td>' +
          '<td class="sale-receipt-num">' + escapeHtml(money(it.lineTotal)) + '</td>' +
        '</tr>'
      )).join('')
    }
  }

  async function openSaleDetail(saleId, opts) {
    if (!saleId) return
    const sid = shopId()
    if (!sid || typeof db === 'undefined') {
      showTopBanner("Do'kon topilmadi", 'error')
      return
    }

    currentSaleId = saleId
    returnPage = (opts && opts.returnPage) || 'dashboardPage'
    window.__currentSaleDetailId = saleId

    navigate('saleDetailPage')

    const loading = document.getElementById('saleDetailLoading')
    const content = document.getElementById('saleDetailContent')
    const errorEl = document.getElementById('saleDetailError')
    if (loading) loading.classList.remove('hidden')
    if (content) content.classList.add('hidden')
    if (errorEl) errorEl.classList.add('hidden')

    try {
      const snap = await db.collection('shops').doc(sid).collection('sales').doc(saleId).get()
      if (!snap.exists) {
        if (loading) loading.classList.add('hidden')
        if (errorEl) {
          errorEl.classList.remove('hidden')
          errorEl.textContent = 'Sotuv topilmadi'
        }
        return
      }
      currentSale = Object.assign({ id: snap.id }, snap.data() || {})
      renderSaleDetail(currentSale)
      if (loading) loading.classList.add('hidden')
      if (content) content.classList.remove('hidden')
    } catch (err) {
      console.error('Sale detail load failed:', err)
      if (loading) loading.classList.add('hidden')
      if (errorEl) {
        errorEl.classList.remove('hidden')
        errorEl.textContent = "Ma'lumotlarni yuklashda xato"
      }
    }
  }

  function leaveSaleDetailPage() {
    const back = returnPage || 'dashboardPage'
    currentSaleId = null
    currentSale = null
    window.__currentSaleDetailId = null
    navigate(back)
  }

  function printSaleReceipt() {
    if (!currentSale) {
      showTopBanner('Sotuv yuklanmagan', 'error')
      return
    }
    document.body.classList.add('printing-sale-receipt')
    const cleanup = () => {
      document.body.classList.remove('printing-sale-receipt')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => {
      window.print()
      // Fallback if afterprint doesn't fire
      setTimeout(cleanup, 1000)
    }, 50)
  }

  window.openSaleDetail = openSaleDetail
  window.leaveSaleDetailPage = leaveSaleDetailPage
  window.printSaleReceipt = printSaleReceipt
})()
