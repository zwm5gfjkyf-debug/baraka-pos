/**
 * Asosiy (Home) — real-time Firestore dashboard
 * Paths: shops/{shopId}/sales, shops/{shopId}/nasiya
 */
(function () {
  let todaySalesUnsub = null
  let yesterdaySalesUnsub = null
  let nasiyaUnsub = null
  let todayHistoryUnsub = null

  let revenueChart = null
  let todaySalesRows = []
  let yesterdaySalesRows = []
  let nasiyaRows = []

  let dashboardBoot = { today: false, yesterday: false, nasiya: false }
  let dashboardHadError = false

  const CHART_LINE = '#166534'
  const CHART_LABELS = ['09:00', '11:00', '13:00', '15:00', 'Hozir']

  function safeInt(v) {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? n : 0
  }

  function formatSom(amount) {
    const n = safeInt(amount)
    const s = n.toLocaleString('uz-UZ').replace(/,/g, ' ')
    return `${s} so'm`
  }

  function formatTrendPercent(pct) {
    const n = safeInt(pct)
    if (n > 0) return { arrow: '↑', text: `+${n}% kechagidan`, pos: true }
    if (n < 0) return { arrow: '↓', text: `−${Math.abs(n)}% kechagidan`, pos: false }
    return { arrow: '↑', text: '+0% kechagidan', pos: true }
  }

  function getTodayBounds() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    return { todayStart, tomorrowStart, now }
  }

  function getYesterdayBounds() {
    const { todayStart } = getTodayBounds()
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    return { yesterdayStart, todayStart }
  }

  function saleCreatedAtMs(raw) {
    const ts = raw && raw.createdAt
    if (!ts || typeof ts.toDate !== 'function') return null
    try {
      const d = ts.toDate()
      const t = d.getTime()
      return Number.isFinite(t) ? t : null
    } catch (e) {
      return null
    }
  }

  function normalizeSaleDoc(doc) {
    const raw = doc.data() || {}
    let itemsCount = safeInt(raw.itemsCount)
    if (itemsCount === 0 && Array.isArray(raw.items)) {
      itemsCount = raw.items.reduce((sum, it) => sum + safeInt(it && it.qty), 0)
    }
    const total = safeInt(raw.total ?? raw.amount)
    const profit = safeInt(raw.profit ?? raw.totalProfit)
    const sn = raw.saleNumber
    const saleNumberLabel =
      sn !== undefined && sn !== null && String(sn).trim() !== '' && Number.isFinite(Number(sn))
        ? String(Number(sn))
        : '—'
    const paymentType = raw.paymentType != null && raw.paymentType !== undefined
      ? String(raw.paymentType)
      : String(raw.type || '')
    return {
      id: doc.id,
      saleNumberLabel,
      total,
      profit,
      itemsCount,
      paymentType,
      createdAt: raw.createdAt || null,
      _sortMs: saleCreatedAtMs(raw)
    }
  }

  function normalizeNasiyaDoc(doc) {
    const raw = doc.data() || {}
    const amount = safeInt(raw.amount)
    const paid = safeInt(raw.paidAmount)
    let remaining = amount - paid
    if (!Number.isFinite(remaining) || remaining < 0) remaining = 0
    return { id: doc.id, remaining }
  }

  function sumYesterdayRevenue(rows) {
    return rows.reduce((s, r) => s + safeInt(r.total ?? r.amount), 0)
  }

  function revenueChangePercent(todayRev, yesterdayRev) {
    const t = safeInt(todayRev)
    const y = safeInt(yesterdayRev)
    if (t === 0 && y === 0) return 0
    if (y === 0 && t > 0) return 100
    if (y === 0) return 0
    return Math.round(((t - y) / y) * 100)
  }

  function averageCheck(todayRev, saleCount) {
    const n = safeInt(saleCount)
    if (n <= 0) return 0
    return safeInt(todayRev) / n
  }

  function cumulativeUpTo(sortedSales, endMs) {
    if (endMs == null || !Number.isFinite(endMs)) return 0
    let sum = 0
    for (let i = 0; i < sortedSales.length; i++) {
      const row = sortedSales[i]
      const ms = row._sortMs
      if (ms == null) continue
      if (ms <= endMs) sum += safeInt(row.total)
    }
    return sum
  }

  function buildMonotonicChartValues(sortedToday, now) {
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()
    const slotEnds = [
      new Date(y, m, d, 9, 0, 0, 0).getTime(),
      new Date(y, m, d, 11, 0, 0, 0).getTime(),
      new Date(y, m, d, 13, 0, 0, 0).getTime(),
      new Date(y, m, d, 15, 0, 0, 0).getTime(),
      now.getTime()
    ]
    const withSale = sortedToday.some(r => r._sortMs != null && safeInt(r.total) > 0)
    const values = slotEnds.map(end => {
      const cap = Math.min(end, now.getTime())
      return cumulativeUpTo(sortedToday, cap)
    })
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[i - 1]) values[i] = values[i - 1]
    }
    return { values, withSale }
  }

  function sortTodayNewestFirst(rows) {
    return rows.slice().sort((a, b) => {
      const am = a._sortMs
      const bm = b._sortMs
      if (am == null && bm == null) return 0
      if (am == null) return 1
      if (bm == null) return -1
      return bm - am
    })
  }

  function showDashboardLoading() {
    dashboardHadError = false
    dashboardBoot = { today: false, yesterday: false, nasiya: false }
    const loading = document.getElementById('loadingState')
    const stats = document.getElementById('statsGrid')
    const chart = document.getElementById('chartCard')
    const recent = document.getElementById('recentSection')
    const err = document.getElementById('errorState')
    if (loading) loading.classList.remove('hidden')
    if (stats) stats.classList.add('hidden')
    if (chart) chart.classList.add('hidden')
    if (recent) recent.classList.add('hidden')
    if (err) err.classList.add('hidden')
  }

  function showDashboardContent() {
    const loading = document.getElementById('loadingState')
    const stats = document.getElementById('statsGrid')
    const chart = document.getElementById('chartCard')
    const recent = document.getElementById('recentSection')
    const err = document.getElementById('errorState')
    if (loading) loading.classList.add('hidden')
    if (stats) stats.classList.remove('hidden')
    if (chart) chart.classList.remove('hidden')
    if (recent) recent.classList.remove('hidden')
    if (err) err.classList.add('hidden')
  }

  function showDashboardError() {
    dashboardHadError = true
    const loading = document.getElementById('loadingState')
    const stats = document.getElementById('statsGrid')
    const chart = document.getElementById('chartCard')
    const recent = document.getElementById('recentSection')
    const err = document.getElementById('errorState')
    if (loading) loading.classList.add('hidden')
    if (stats) stats.classList.add('hidden')
    if (chart) chart.classList.add('hidden')
    if (recent) recent.classList.add('hidden')
    if (err) err.classList.remove('hidden')
  }

  function updateStatsAndRecent(sortedToday) {
    const todayRev = sortedToday.reduce((s, r) => s + safeInt(r.total), 0)
    const todayProfit = sortedToday.reduce((s, r) => s + safeInt(r.profit), 0)
    const productsSold = sortedToday.reduce((s, r) => s + safeInt(r.itemsCount), 0)
    const yesterdayRev = sumYesterdayRevenue(yesterdaySalesRows)
    const pct = revenueChangePercent(todayRev, yesterdayRev)
    const trend = formatTrendPercent(pct)

    const nasiyaTotal = nasiyaRows.reduce((s, r) => s + safeInt(r.remaining), 0)
    void averageCheck(todayRev, sortedToday.length)

    const revEl = document.getElementById('todayRevenueValue')
    if (revEl) {
      revEl.textContent = todayRev.toLocaleString('uz-UZ').replace(/,/g, ' ')
    }
    const trendEl = document.getElementById('todayRevenueTrend')
    if (trendEl) {
      trendEl.textContent = `${trend.arrow} ${trend.text}`
      trendEl.style.color = 'rgba(255,255,255,0.95)'
    }

    const profitVal = document.getElementById('todayProfitValue')
    if (profitVal) {
      profitVal.textContent = formatSom(todayProfit)
      profitVal.style.color = todayProfit > 0 ? '#16A34A' : '#94A3B8'
    }
    const profitStatus = document.getElementById('todayProfitStatus')
    if (profitStatus) {
      if (todayProfit > 0) {
        profitStatus.textContent = "↑ Yaxshi ko'rsatkich"
        profitStatus.style.color = '#16A34A'
      } else {
        profitStatus.textContent = "Hozircha sotuv yo'q"
        profitStatus.style.color = '#94A3B8'
      }
    }

    const prodEl = document.getElementById('productsSoldValue')
    if (prodEl) prodEl.textContent = String(productsSold)

    const nasiyaVal = document.getElementById('nasiyaDebtValue')
    if (nasiyaVal) {
      nasiyaVal.textContent = formatSom(nasiyaTotal)
      nasiyaVal.style.color = '#FB8C00'
    }
    const nasiyaStatus = document.getElementById('nasiyaDebtStatus')
    if (nasiyaStatus) {
      if (nasiyaTotal > 0) {
        nasiyaStatus.textContent = 'Faol qarzdorlik'
        nasiyaStatus.style.color = '#FB8C00'
      } else {
        nasiyaStatus.textContent = "Qarzdorlik yo'q"
        nasiyaStatus.style.color = '#94A3B8'
      }
    }

    renderRecentSales(sortedToday.slice(0, 3))
  }

  function renderRecentSales(top3) {
    const container = document.getElementById('recentSalesContainer')
    if (!container) return

    container.innerHTML = ''
    const palettes = [
      { bg: '#E8F5E9', fg: '#2E7D32' },
      { bg: '#E3F2FD', fg: '#1976D2' },
      { bg: '#FFF8E1', fg: '#F57C00' }
    ]

    if (top3.length === 0) {
      const wrap = document.createElement('div')
      wrap.className = 'dashboard-empty-state'
      wrap.innerHTML =
        '<div class="dashboard-empty-state-icon" aria-hidden="true">🛒</div>' +
        '<div class="dashboard-empty-state-title">Bugun hali sotuv yo\'q</div>' +
        '<div class="dashboard-empty-state-sub">Sotuv qo\'shish uchun + tugmasini bosing</div>'
      container.appendChild(wrap)
      return
    }

    top3.forEach((sale, index) => {
      const pal = palettes[index % palettes.length]
      let timeStr = '—'
      if (sale.createdAt && typeof sale.createdAt.toDate === 'function') {
        try {
          timeStr = sale.createdAt.toDate().toLocaleTimeString('uz-UZ', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        } catch (e) {
          timeStr = '—'
        }
      }
      const card = document.createElement('div')
      card.className = 'dashboard-recent-card'
      card.innerHTML = `
        <div class="dashboard-recent-icon" style="background:${pal.bg};color:${pal.fg};">🛒</div>
        <div class="dashboard-recent-details">
          <div class="dashboard-recent-title">Sotuv #${sale.saleNumberLabel}</div>
          <div class="dashboard-recent-meta">${timeStr} · ${safeInt(sale.itemsCount)} ta mahsulot</div>
        </div>
        <div class="dashboard-recent-amount">${formatSom(sale.total)}</div>
      `
      container.appendChild(card)
    })
  }

  function updateChart(sortedToday) {
    const canvas = document.getElementById('revenueChart')
    if (!canvas || typeof Chart === 'undefined') return

    const { now } = getTodayBounds()
    const { values, withSale } = buildMonotonicChartValues(sortedToday, now)
    const ctx = canvas.getContext('2d')
    if (revenueChart) revenueChart.destroy()

    const lastIdx = values.length - 1
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.22)')
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')

    revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: CHART_LABELS.slice(),
        datasets: [
          {
            data: values,
            borderColor: CHART_LINE,
            backgroundColor: withSale ? gradient : 'transparent',
            borderWidth: 2.5,
            fill: withSale,
            tension: 0.42,
            cubicInterpolationMode: 'monotone',
            pointRadius(ctx) {
              const i = ctx.dataIndex
              if (!withSale) return i === 0 ? 5 : 0
              if (i === 0) return 5
              if (i === lastIdx) return 7
              return 0
            },
            pointBackgroundColor: CHART_LINE,
            pointBorderColor: CHART_LINE,
            pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false, grid: { display: false } },
          y: { display: false, grid: { display: false }, min: 0 }
        },
        elements: {
          line: { borderJoinStyle: 'round' }
        }
      }
    })
  }

  function renderDashboardFromCache() {
    if (dashboardHadError) return
    const sorted = sortTodayNewestFirst(todaySalesRows)
    updateStatsAndRecent(sorted)
    updateChart(sorted)
  }

  function markBoot(key) {
    if (dashboardHadError) return
    if (!dashboardBoot[key]) dashboardBoot[key] = true
    if (dashboardBoot.today && dashboardBoot.yesterday && dashboardBoot.nasiya) {
      showDashboardContent()
    }
    renderDashboardFromCache()
  }

  function onListenerError(err) {
    console.error('Asosiy listener error:', err)
    dashboardHadError = true
    dashboardBoot = { today: true, yesterday: true, nasiya: true }
    showDashboardError()
  }

  function cleanupDashboardListeners() {
    if (typeof todaySalesUnsub === 'function') todaySalesUnsub()
    if (typeof yesterdaySalesUnsub === 'function') yesterdaySalesUnsub()
    if (typeof nasiyaUnsub === 'function') nasiyaUnsub()
    todaySalesUnsub = null
    yesterdaySalesUnsub = null
    nasiyaUnsub = null
    if (revenueChart) {
      revenueChart.destroy()
      revenueChart = null
    }
  }

  function cleanupTodaySalesHistoryListeners() {
    if (typeof todayHistoryUnsub === 'function') todayHistoryUnsub()
    todayHistoryUnsub = null
  }

  function loadDashboard() {
    const shopId = typeof currentShopId !== 'undefined' ? currentShopId : window.currentShopId
    if (!shopId) return

    cleanupDashboardListeners()
    showDashboardLoading()

    const { todayStart, tomorrowStart } = getTodayBounds()
    const { yesterdayStart, todayStart: yEnd } = getYesterdayBounds()

    const salesCol = db.collection('shops').doc(shopId).collection('sales')
    const nasiyaCol = db.collection('shops').doc(shopId).collection('nasiya')

    todaySalesUnsub = salesCol
      .where('createdAt', '>=', todayStart)
      .where('createdAt', '<', tomorrowStart)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snap => {
          todaySalesRows = []
          snap.forEach(doc => todaySalesRows.push(normalizeSaleDoc(doc)))
          markBoot('today')
        },
        err => onListenerError(err)
      )

    yesterdaySalesUnsub = salesCol
      .where('createdAt', '>=', yesterdayStart)
      .where('createdAt', '<', yEnd)
      .onSnapshot(
        snap => {
          yesterdaySalesRows = []
          snap.forEach(doc => {
            const raw = doc.data() || {}
            yesterdaySalesRows.push({ total: safeInt(raw.total ?? raw.amount) })
          })
          markBoot('yesterday')
        },
        err => onListenerError(err)
      )

    nasiyaUnsub = nasiyaCol
      .where('status', '==', 'active')
      .onSnapshot(
        snap => {
          nasiyaRows = []
          snap.forEach(doc => nasiyaRows.push(normalizeNasiyaDoc(doc)))
          markBoot('nasiya')
        },
        err => onListenerError(err)
      )
  }

  function retryLoad() {
    cleanupDashboardListeners()
    loadDashboard()
  }

  function renderTodaySalesHistoryList(rows) {
    const list = document.getElementById('todaySalesHistoryList')
    if (!list) return
    const sorted = sortTodayNewestFirst(rows)
    list.innerHTML = ''
    if (sorted.length === 0) {
      list.innerHTML =
        '<div class="today-sales-history-empty">Bugun hali sotuv yo\'q</div>'
      return
    }
    sorted.forEach((sale, index) => {
      const palettes = [
        { bg: '#E8F5E9', fg: '#2E7D32' },
        { bg: '#E3F2FD', fg: '#1976D2' },
        { bg: '#FFF8E1', fg: '#F57C00' }
      ]
      const pal = palettes[index % palettes.length]
      let timeStr = '—'
      if (sale.createdAt && typeof sale.createdAt.toDate === 'function') {
        try {
          timeStr = sale.createdAt.toDate().toLocaleTimeString('uz-UZ', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        } catch (e) {
          timeStr = '—'
        }
      }
      const row = document.createElement('div')
      row.className = 'dashboard-recent-card today-sales-history-row'
      row.innerHTML = `
        <div class="dashboard-recent-icon" style="background:${pal.bg};color:${pal.fg};">🛒</div>
        <div class="dashboard-recent-details">
          <div class="dashboard-recent-title">Sotuv #${sale.saleNumberLabel}</div>
          <div class="dashboard-recent-meta">${timeStr} · ${safeInt(sale.itemsCount)} ta mahsulot</div>
        </div>
        <div class="dashboard-recent-amount">${formatSom(sale.total)}</div>
      `
      list.appendChild(row)
    })
  }

  function loadTodaySalesHistory() {
    const shopId = typeof currentShopId !== 'undefined' ? currentShopId : window.currentShopId
    if (!shopId) return

    cleanupTodaySalesHistoryListeners()
    const { todayStart, tomorrowStart } = getTodayBounds()
    const salesCol = db.collection('shops').doc(shopId).collection('sales')

    todayHistoryUnsub = salesCol
      .where('createdAt', '>=', todayStart)
      .where('createdAt', '<', tomorrowStart)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snap => {
          const rows = []
          snap.forEach(doc => rows.push(normalizeSaleDoc(doc)))
          renderTodaySalesHistoryList(rows)
        },
        err => {
          console.error('Today sales history error:', err)
          const list = document.getElementById('todaySalesHistoryList')
          if (list) {
            list.innerHTML =
              '<div class="today-sales-history-empty">Ma\'lumotlarni yuklashda xato</div>'
          }
        }
      )
  }

  function goToNewSaleFromFab() {
    if (typeof finishSaleFlow === 'function') finishSaleFlow()
    else {
      ;['successPage', 'paymentPage', 'debtCustomerPage'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.classList.add('hidden')
      })
      const nav = document.querySelector('.bottom-nav')
      if (nav) nav.style.display = ''
      const actions = document.getElementById('saleActions')
      if (actions) actions.style.display = ''
    }
    if (typeof navigate === 'function') navigate('salePage')
  }

  window.loadDashboard = loadDashboard
  window.cleanupDashboardListeners = cleanupDashboardListeners
  window.retryLoad = retryLoad
  window.loadTodaySalesHistory = loadTodaySalesHistory
  window.cleanupTodaySalesHistoryListeners = cleanupTodaySalesHistoryListeners
  window.goToNewSaleFromFab = goToNewSaleFromFab
})()
