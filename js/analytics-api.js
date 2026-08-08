/**
 * Client-side analytics "API" over Firestore.
 * Paths: shops/{shopId}/sales, shops/{shopId}/returns, shops/{shopId}/products
 * buyPrice on products = tannarx (cost_price). Sale items snapshot unit_price + cost.
 */
;(function () {
  const DAY_LABELS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
  const MONTH_LABELS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

  function shopId() {
    return window.currentShopId || (typeof currentShopId !== 'undefined' ? currentShopId : null) || null
  }

  function safeNum(v) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  function saleTotal(raw) {
    return Math.round(safeNum(raw.total != null ? raw.total : raw.amount))
  }

  function saleProfit(raw) {
    if (raw.profit != null || raw.totalProfit != null) {
      return Math.round(safeNum(raw.profit != null ? raw.profit : raw.totalProfit))
    }
    const items = Array.isArray(raw.items) ? raw.items : []
    return Math.round(items.reduce((s, it) => {
      const qty = safeNum(it.quantity != null ? it.quantity : it.qty)
      const price = safeNum(it.unit_price != null ? it.unit_price : it.price)
      const cost = safeNum(it.cost_price != null ? it.cost_price : it.cost)
      return s + (price - cost) * qty
    }, 0))
  }

  function tsToDate(ts) {
    if (!ts) return null
    if (typeof ts.toDate === 'function') {
      try { return ts.toDate() } catch (e) { return null }
    }
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000)
    const d = new Date(ts)
    return Number.isFinite(d.getTime()) ? d : null
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  }

  function addDays(d, n) {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  }

  function parseDateInput(dateStr) {
    if (!dateStr) return startOfDay(new Date())
    const parts = String(dateStr).split('-').map(Number)
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return startOfDay(new Date())
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
  }

  function weekStartMonday(d) {
    const x = startOfDay(d)
    const day = x.getDay()
    const toMon = day === 0 ? -6 : 1 - day
    x.setDate(x.getDate() + toMon)
    return x
  }

  /** Returns { start, end } with end exclusive. period: day|week|month|year */
  function getPeriodBounds(period, dateStr) {
    const base = parseDateInput(dateStr)
    if (period === 'day' || period === 'date') {
      const start = startOfDay(base)
      return { start, end: addDays(start, 1) }
    }
    if (period === 'week') {
      const start = weekStartMonday(base)
      return { start, end: addDays(start, 7) }
    }
    if (period === 'month') {
      const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0)
      return { start, end }
    }
    // year
    const start = new Date(base.getFullYear(), 0, 1, 0, 0, 0, 0)
    const end = new Date(base.getFullYear() + 1, 0, 1, 0, 0, 0, 0)
    return { start, end }
  }

  function getPreviousPeriodBounds(period, dateStr) {
    const { start } = getPeriodBounds(period === 'date' ? 'day' : period, dateStr)
    if (period === 'day' || period === 'date') {
      const prev = addDays(start, -1)
      return { start: prev, end: start }
    }
    if (period === 'week') {
      const prevStart = addDays(start, -7)
      return { start: prevStart, end: start }
    }
    if (period === 'month') {
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0)
      return { start: prevStart, end: start }
    }
    const prevStart = new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    return { start: prevStart, end: start }
  }

  function changePct(current, previous) {
    const c = safeNum(current)
    const p = safeNum(previous)
    if (c === 0 && p === 0) return 0
    if (p === 0 && c > 0) return 100
    if (p === 0) return 0
    return Math.round(((c - p) / p) * 100)
  }

  async function fetchSalesRange(start, end) {
    const sid = shopId()
    if (!sid || typeof db === 'undefined') return []
    const snap = await db.collection('shops').doc(sid).collection('sales')
      .where('createdAt', '>=', start)
      .where('createdAt', '<', end)
      .get()
    const rows = []
    snap.forEach(doc => rows.push(Object.assign({ id: doc.id }, doc.data() || {})))
    return rows
  }

  async function fetchReturnsRange(start, end) {
    const sid = shopId()
    if (!sid || typeof db === 'undefined') return []
    try {
      const snap = await db.collection('shops').doc(sid).collection('returns')
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .get()
      const rows = []
      snap.forEach(doc => rows.push(Object.assign({ id: doc.id }, doc.data() || {})))
      return rows
    } catch (err) {
      // Collection/index may not exist yet
      console.warn('Returns query skipped:', err && err.message)
      return []
    }
  }

  async function fetchProducts() {
    const sid = shopId()
    if (!sid || typeof db === 'undefined') return []
    const snap = await db.collection('shops').doc(sid).collection('products').get()
    const rows = []
    snap.forEach(doc => {
      const raw = doc.data() || {}
      if (raw.deleted === true) return
      rows.push(Object.assign({
        id: doc.id,
        cost_price: safeNum(raw.cost_price != null ? raw.cost_price : raw.buyPrice),
        buyPrice: safeNum(raw.buyPrice != null ? raw.buyPrice : raw.cost_price)
      }, raw))
    })
    return rows
  }

  function summarizeSales(sales) {
    let revenue = 0
    let profit = 0
    sales.forEach(s => {
      revenue += saleTotal(s)
      profit += saleProfit(s)
    })
    return { revenue, profit, sales_count: sales.length }
  }

  function summarizeReturns(returns) {
    let returns_amount = 0
    returns.forEach(r => {
      returns_amount += Math.round(safeNum(r.refund_amount != null ? r.refund_amount : r.refundAmount))
    })
    return { returns_count: returns.length, returns_amount }
  }

  async function getAnalyticsSummary(period, dateStr) {
    const p = period === 'date' ? 'day' : period
    const cur = getPeriodBounds(p, dateStr)
    const prev = getPreviousPeriodBounds(p, dateStr)
    const [sales, prevSales, returns, prevReturns] = await Promise.all([
      fetchSalesRange(cur.start, cur.end),
      fetchSalesRange(prev.start, prev.end),
      fetchReturnsRange(cur.start, cur.end),
      fetchReturnsRange(prev.start, prev.end)
    ])
    const s = summarizeSales(sales)
    const ps = summarizeSales(prevSales)
    const r = summarizeReturns(returns)
    const pr = summarizeReturns(prevReturns)
    return {
      revenue: s.revenue,
      profit: s.profit,
      sales_count: s.sales_count,
      returns_count: r.returns_count,
      returns_amount: r.returns_amount,
      revenue_change_pct: changePct(s.revenue, ps.revenue),
      profit_change_pct: changePct(s.profit, ps.profit),
      sales_count_change_pct: changePct(s.sales_count, ps.sales_count),
      returns_change_pct: changePct(r.returns_count, pr.returns_count)
    }
  }

  function buildTrendBuckets(period, start, end, sales) {
    const points = []
    if (period === 'day' || period === 'date') {
      for (let h = 0; h < 24; h++) {
        points.push({ key: h, label: String(h).padStart(2, '0') + ':00', revenue: 0 })
      }
      sales.forEach(s => {
        const d = tsToDate(s.createdAt)
        if (!d) return
        const h = d.getHours()
        if (points[h]) points[h].revenue += saleTotal(s)
      })
      return points.map(({ label, revenue }) => ({ label, revenue }))
    }
    if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i)
        const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
        points.push({ key, label: DAY_LABELS[d.getDay()], revenue: 0, sort: i })
      }
      const map = {}
      points.forEach(p => { map[p.key] = p })
      sales.forEach(s => {
        const d = tsToDate(s.createdAt)
        if (!d) return
        const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
        if (map[key]) map[key].revenue += saleTotal(s)
      })
      return points.map(({ label, revenue }) => ({ label, revenue }))
    }
    if (period === 'month') {
      const cursor = new Date(start)
      while (cursor < end) {
        const key = cursor.getFullYear() + '-' + cursor.getMonth() + '-' + cursor.getDate()
        points.push({
          key,
          label: String(cursor.getDate()),
          revenue: 0
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      const map = {}
      points.forEach(p => { map[p.key] = p })
      sales.forEach(s => {
        const d = tsToDate(s.createdAt)
        if (!d) return
        const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
        if (map[key]) map[key].revenue += saleTotal(s)
      })
      return points.map(({ label, revenue }) => ({ label, revenue }))
    }
    // year — monthly
    for (let m = 0; m < 12; m++) {
      points.push({ key: m, label: MONTH_LABELS[m], revenue: 0 })
    }
    sales.forEach(s => {
      const d = tsToDate(s.createdAt)
      if (!d) return
      const m = d.getMonth()
      if (points[m]) points[m].revenue += saleTotal(s)
    })
    return points.map(({ label, revenue }) => ({ label, revenue }))
  }

  async function getAnalyticsTrend(period, dateStr) {
    const p = period === 'date' ? 'day' : period
    const { start, end } = getPeriodBounds(p, dateStr)
    const sales = await fetchSalesRange(start, end)
    return buildTrendBuckets(p, start, end, sales)
  }

  function transactionLabel(sale) {
    return sale.transactionNumber || sale.transaction_number ||
      (sale.saleNumberLabel != null ? ('Sotuv #' + sale.saleNumberLabel) :
        (sale.saleNumber != null ? ('Sotuv #' + sale.saleNumber) : 'Sotuv'))
  }

  async function getAnalyticsDay(dateStr) {
    const { start, end } = getPeriodBounds('day', dateStr)
    const [sales, returns] = await Promise.all([
      fetchSalesRange(start, end),
      fetchReturnsRange(start, end)
    ])
    sales.sort((a, b) => {
      const da = tsToDate(a.createdAt)
      const db_ = tsToDate(b.createdAt)
      return (db_ ? db_.getTime() : 0) - (da ? da.getTime() : 0)
    })
    const summary = Object.assign({}, summarizeSales(sales), summarizeReturns(returns))
    return {
      summary,
      sales: sales.map(s => {
        const d = tsToDate(s.createdAt)
        const time = d
          ? d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '—'
        return {
          id: s.id,
          transaction_number: transactionLabel(s),
          time,
          total: saleTotal(s)
        }
      }),
      returns: returns.map(r => ({
        id: r.id,
        product_name: r.product_name || r.productName || 'Mahsulot',
        quantity: Math.round(safeNum(r.quantity)),
        refund_amount: Math.round(safeNum(r.refund_amount != null ? r.refund_amount : r.refundAmount)),
        sale_id: r.sale_id || r.saleId || null
      }))
    }
  }

  function aggregateProducts(sales) {
    const map = {}
    sales.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : []
      items.forEach(it => {
        const pid = it.productId || it.id || it.product_name || it.name || 'unknown'
        const name = it.product_name || it.name || 'Mahsulot'
        const qty = safeNum(it.quantity != null ? it.quantity : it.qty)
        const price = safeNum(it.unit_price != null ? it.unit_price : it.price)
        const cost = safeNum(it.cost_price != null ? it.cost_price : it.cost)
        if (!map[pid]) {
          map[pid] = { product_id: pid, product_name: name, quantity_sold: 0, revenue: 0, profit: 0 }
        }
        map[pid].quantity_sold += qty
        map[pid].revenue += price * qty
        map[pid].profit += (price - cost) * qty
      })
    })
    return Object.values(map)
  }

  async function getTopProducts(period, dateStr, by, limit) {
    const p = period === 'date' ? 'day' : period
    const { start, end } = getPeriodBounds(p, dateStr)
    const sales = await fetchSalesRange(start, end)
    const rows = aggregateProducts(sales)
    const key = by === 'profit' ? 'profit' : 'quantity_sold'
    rows.sort((a, b) => b[key] - a[key])
    return rows.slice(0, limit || 10).map(r => ({
      product_name: r.product_name,
      quantity_sold: Math.round(r.quantity_sold),
      revenue: Math.round(r.revenue),
      profit: Math.round(r.profit)
    }))
  }

  async function getSlowMovingProducts(period, dateStr, limit) {
    const p = period === 'date' ? 'day' : period
    const { start, end } = getPeriodBounds(p, dateStr)
    const [sales, products] = await Promise.all([
      fetchSalesRange(start, end),
      fetchProducts()
    ])
    const sold = aggregateProducts(sales)
    const soldMap = {}
    sold.forEach(r => { soldMap[r.product_id] = r })

    const rows = products.map(pr => {
      const hit = soldMap[pr.id]
      return {
        product_name: pr.name || 'Mahsulot',
        quantity_sold: hit ? Math.round(hit.quantity_sold) : 0,
        revenue: hit ? Math.round(hit.revenue) : 0,
        profit: hit ? Math.round(hit.profit) : 0,
        stock: Math.round(safeNum(pr.quantity))
      }
    })
    rows.sort((a, b) => {
      if (a.quantity_sold !== b.quantity_sold) return a.quantity_sold - b.quantity_sold
      return b.stock - a.stock
    })
    return rows.slice(0, limit || 10)
  }

  function mostReturnedProducts(returns, limit) {
    const map = {}
    returns.forEach(r => {
      const name = r.product_name || r.productName || 'Mahsulot'
      const key = r.product_id || r.productId || name
      if (!map[key]) map[key] = { product_name: name, quantity: 0, refund_amount: 0 }
      map[key].quantity += Math.round(safeNum(r.quantity))
      map[key].refund_amount += Math.round(safeNum(r.refund_amount != null ? r.refund_amount : r.refundAmount))
    })
    return Object.values(map)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit || 5)
  }

  async function getReturnsSummary(period, dateStr) {
    const p = period === 'date' ? 'day' : period
    const { start, end } = getPeriodBounds(p, dateStr)
    const returns = await fetchReturnsRange(start, end)
    const s = summarizeReturns(returns)
    return Object.assign({}, s, {
      top_products: mostReturnedProducts(returns, 5)
    })
  }

  window.AnalyticsAPI = {
    getPeriodBounds,
    getAnalyticsSummary,
    getAnalyticsTrend,
    getAnalyticsDay,
    getTopProducts,
    getSlowMovingProducts,
    getReturnsSummary
  }
})()
