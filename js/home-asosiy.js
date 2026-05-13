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

  /* ========================================
     DYNAMIC FONT SIZING FOR STAT CARDS
     ======================================== */
  
  function formatNumberWithSpaces(amount) {
    const n = safeInt(amount)
    return n.toLocaleString('uz-UZ').replace(/,/g, ' ')
  }
  
  function adjustFontSizeForRevenueCard(element) {
    if (!element) return
    const text = element.textContent
    // Count actual digits (excluding spaces)
    const digitCount = text.replace(/\s/g, '').length
    
    let numberFontSize
    if (digitCount <= 5) {
      numberFontSize = 28
    } else if (digitCount <= 7) {
      numberFontSize = 26
    } else if (digitCount <= 9) {
      numberFontSize = 22
    } else if (digitCount <= 11) {
      numberFontSize = 18
    } else {
      numberFontSize = 14
    }
    
    element.style.fontSize = numberFontSize + 'px'
    
    // Set "so'm" to be 6px smaller
    const somSuffix = element.parentElement.querySelector('.stat-som')
    if (somSuffix) {
      somSuffix.style.fontSize = (numberFontSize - 6) + 'px'
    }
  }
  
  function adjustFontSizeForProfitCard(element) {
    if (!element) return
    const text = element.textContent
    // Count actual digits (excluding spaces)
    const digitCount = text.replace(/\s/g, '').length
    
    let numberFontSize
    if (digitCount <= 5) {
      numberFontSize = 28
    } else if (digitCount <= 7) {
      numberFontSize = 26
    } else if (digitCount <= 9) {
      numberFontSize = 22
    } else if (digitCount <= 11) {
      numberFontSize = 18
    } else {
      numberFontSize = 14
    }
    
    element.style.fontSize = numberFontSize + 'px'
    
    // Set "so'm" to be 6px smaller
    const somSuffix = element.parentElement.querySelector('.stat-som')
    if (somSuffix) {
      somSuffix.style.fontSize = (numberFontSize - 6) + 'px'
    }
  }
  
  function adjustFontSizeForStatNumber(element) {
    if (!element) return
    const text = element.textContent.replace(/\s/g, '')
    const length = text.length
    
    if (length <= 7) {
      element.style.fontSize = '26px'
    } else if (length <= 9) {
      element.style.fontSize = '22px'
    } else if (length <= 11) {
      element.style.fontSize = '18px'
    } else {
      element.style.fontSize = '15px'
    }
  }

  function adjustAllStatNumbers() {
    // Special handling for revenue card
    const revenueEl = document.getElementById('todayRevenueValue')
    if (revenueEl) {
      adjustFontSizeForRevenueCard(revenueEl)
    }
    
    // Special handling for profit card
    const profitEl = document.getElementById('todayProfitValue')
    if (profitEl) {
      adjustFontSizeForProfitCard(profitEl)
    }
    
    // Handle other stat numbers
    document.querySelectorAll('.stat-number:not(#todayRevenueValue):not(#todayProfitValue)').forEach(el => {
      adjustFontSizeForStatNumber(el)
    })
  }

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
    if (n === 0) return { arrow: '', text: "— O'zgarish yo'q", pos: true }
    if (n > 0) return { arrow: '↑', text: `+${n}% kechagidan`, pos: true }
    if (n < 0) return { arrow: '↓', text: `−${Math.abs(n)}% kechagidan`, pos: false }
    return { arrow: '', text: "— O'zgarish yo'q", pos: true }
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
    const sn = raw.saleNumberLabel ?? raw.saleNumber ?? raw.dailySequence
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
      revEl.textContent = formatNumberWithSpaces(todayRev)
      adjustFontSizeForRevenueCard(revEl)
    }
    const trendEl = document.getElementById('todayRevenueTrend')
    if (trendEl) {
      trendEl.textContent = trend.arrow ? `${trend.arrow} ${trend.text}` : trend.text
      trendEl.style.color = 'rgba(255,255,255,0.95)'
    }

    const profitVal = document.getElementById('todayProfitValue')
    if (profitVal) {
      profitVal.textContent = formatNumberWithSpaces(todayProfit)
      adjustFontSizeForProfitCard(profitVal)
    }
    const profitStatus = document.getElementById('todayProfitStatus')
    if (profitStatus) {
      if (todayProfit > 0) {
        profitStatus.textContent = "↑ Yaxshi ko'rsatkich"
        profitStatus.style.color = '#43A047'
      } else {
        profitStatus.textContent = "Hozircha sotuv yo'q"
        profitStatus.style.color = '#9E9E9E'
      }
    }

    const prodEl = document.getElementById('productsSoldValue')
    if (prodEl) {
      prodEl.textContent = String(productsSold)
    }

    const nasiyaVal = document.getElementById('nasiyaDebtValue')
    if (nasiyaVal) {
      nasiyaVal.textContent = formatNumberWithSpaces(nasiyaTotal)
      adjustFontSizeForStatNumber(nasiyaVal)
    }
    const nasiyaStatus = document.getElementById('nasiyaDebtStatus')
    if (nasiyaStatus) {
      if (nasiyaTotal > 0) {
        nasiyaStatus.textContent = 'Faol qarzdorlik'
        nasiyaStatus.style.color = '#FB8C00'
      } else {
        nasiyaStatus.textContent = "Qarzdorlik yo'q"
        nasiyaStatus.style.color = '#9E9E9E'
      }
    }

    renderRecentSales(sortedToday.slice(0, 3))

    // Apply intelligent typography scaling after all values are set
    if (typeof applyResponsiveTypography === 'function') {
      applyResponsiveTypography()
    }
    
    // Final pass to ensure all stat numbers are sized correctly
    adjustAllStatNumbers()
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
        '<div class="dashboard-empty-state-title">Hali ma\'lumot yo\'q</div>' +
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
    if (!canvas) {
      console.warn('Revenue chart canvas not found')
      return
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not available')
      return
    }

    try {
      const { now } = getTodayBounds()
      const { values, withSale } = buildMonotonicChartValues(sortedToday, now)
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        console.warn('Could not get canvas context')
        return
      }

      // Destroy existing chart
      if (revenueChart) {
        try {
          revenueChart.destroy()
        } catch (error) {
          console.warn('Error destroying existing chart:', error)
        }
        revenueChart = null
      }

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
    } catch (error) {
      console.error('Error creating revenue chart:', error)
      if (revenueChart) {
        try {
          revenueChart.destroy()
        } catch (destroyError) {
          console.warn('Error destroying chart after creation failure:', destroyError)
        }
        revenueChart = null
      }
    }
  }

  function renderDashboardFromCache() {
    if (dashboardHadError) return
    const sorted = sortTodayNewestFirst(todaySalesRows)
    updateStatsAndRecent(sorted)
    updateChart(sorted)
    // Adjust font sizes after data updates
    adjustAllStatNumbers()
    // Setup resize observer after content is rendered
    if (typeof setupResizeObserver === 'function') {
      setupResizeObserver()
    }
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
    // Cleanup resize observer
    if (typeof cleanupResizeObserver === 'function') {
      cleanupResizeObserver()
    }
  }

  function cleanupTodaySalesHistoryListeners() {
    if (typeof todayHistoryUnsub === 'function') todayHistoryUnsub()
    todayHistoryUnsub = null
  }

  function loadDashboard() {
    const shopId = typeof currentShopId !== 'undefined' ? currentShopId : window.currentShopId
    if (!shopId) {
      console.warn('No shopId available for dashboard loading')
      return
    }

    // Validate Firebase is available
    if (typeof db === 'undefined') {
      console.error('Firebase Firestore not available')
      showDashboardError()
      return
    }

    cleanupDashboardListeners()
    showDashboardLoading()

    const { todayStart, tomorrowStart } = getTodayBounds()
    const { yesterdayStart, todayStart: yEnd } = getYesterdayBounds()

    let salesCol, nasiyaCol
    try {
      salesCol = db.collection('shops').doc(shopId).collection('sales')
      nasiyaCol = db.collection('shops').doc(shopId).collection('nasiya')
    } catch (error) {
      console.error('Failed to create Firestore collection references:', error)
      showDashboardError()
      return
    }

    todaySalesUnsub = salesCol
      .where('createdAt', '>=', todayStart)
      .where('createdAt', '<', tomorrowStart)
      .onSnapshot(
        snap => {
          try {
            todaySalesRows = []
            snap.forEach(doc => todaySalesRows.push(normalizeSaleDoc(doc)))
            markBoot('today')
          } catch (e) {
            onListenerError(e)
          }
        },
        err => onListenerError(err)
      )

    yesterdaySalesUnsub = salesCol
      .where('createdAt', '>=', yesterdayStart)
      .where('createdAt', '<', yEnd)
      .onSnapshot(
        snap => {
          try {
            yesterdaySalesRows = []
            snap.forEach(doc => {
              const raw = doc.data() || {}
              yesterdaySalesRows.push({ total: safeInt(raw.total ?? raw.amount) })
            })
            markBoot('yesterday')
          } catch (e) {
            onListenerError(e)
          }
        },
        err => onListenerError(err)
      )

    nasiyaUnsub = nasiyaCol
      .where('status', '==', 'active')
      .onSnapshot(
        snap => {
          try {
            nasiyaRows = []
            snap.forEach(doc => nasiyaRows.push(normalizeNasiyaDoc(doc)))
            markBoot('nasiya')
          } catch (e) {
            onListenerError(e)
          }
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
        '<div class="today-sales-history-empty">Hali ma\'lumot yo\'q</div>'
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
      .onSnapshot(
        snap => {
          try {
            const rows = []
            snap.forEach(doc => rows.push(normalizeSaleDoc(doc)))
            renderTodaySalesHistoryList(rows)
          } catch (e) {
            console.error('Today sales history parse error:', e)
            const list = document.getElementById('todaySalesHistoryList')
            if (list) {
              list.innerHTML =
                '<div class="today-sales-history-empty">Ma\'lumotlarni yuklashda xato. Qayta urinib ko\'ring.</div>'
            }
          }
        },
        err => {
          console.error('Today sales history error:', err)
          const list = document.getElementById('todaySalesHistoryList')
          if (list) {
            list.innerHTML =
              '<div class="today-sales-history-empty">Ma\'lumotlarni yuklashda xato. Qayta urinib ko\'ring.</div>'
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

  // Intelligent responsive typography for dashboard cards
  function applyResponsiveTypography() {
    try {
      const statCards = document.querySelectorAll('.dashboard-card-value')
      if (statCards.length === 0) return

      statCards.forEach(card => {
        try {
          card.classList.remove('large-value', 'very-large-value', 'ultra-large-value')
          card.style.transform = ''
          card.style.whiteSpace = 'nowrap'
          card.style.wordBreak = 'normal'
          card.style.lineHeight = '1'
          card.style.fontSize = ''

          const computedStyle = window.getComputedStyle(card)
          const baseFontSize = Math.max(16, parseFloat(computedStyle.fontSize) || 28)
          const isPrimary = card.closest('.dashboard-card-primary') !== null
          const maxFontSize = isPrimary ? Math.max(baseFontSize, 32) : baseFontSize
          const minFontSize = isPrimary ? 16 : 14

          card.style.fontSize = `${maxFontSize}px`

          const availableWidth = card.clientWidth - 6
          if (availableWidth <= 0) return

          const textLength = (card.textContent || '').replace(/\s+/g, ' ').trim().length
          const textDensity = textLength / availableWidth

          if (textDensity > 0.22 || textLength > (isPrimary ? 22 : 20)) {
            card.style.fontSize = `${Math.max(minFontSize, maxFontSize - 4)}px`
          }

          let currentSize = parseFloat(card.style.fontSize)
          let tries = 0
          while (card.scrollWidth > availableWidth && currentSize > minFontSize && tries < 10) {
            currentSize = Math.max(minFontSize, currentSize - 1)
            card.style.fontSize = `${currentSize}px`
            tries += 1
          }

          // For blue revenue card, NEVER allow wrapping - keep single line
          if (isPrimary) {
            card.style.whiteSpace = 'nowrap'
            card.style.wordBreak = 'normal'
            card.style.lineHeight = '1'
            // If still overflowing after max scaling, continue scaling down
            while (card.scrollWidth > availableWidth && currentSize > 12 && tries < 20) {
              currentSize = Math.max(12, currentSize - 1)
              card.style.fontSize = `${currentSize}px`
              tries += 1
            }
          } else if (card.scrollWidth > availableWidth) {
            card.style.whiteSpace = 'normal'
            card.style.wordBreak = 'break-word'
            card.style.lineHeight = '1.05'
          }
        } catch (cardError) {
          console.warn('Error processing card for responsive typography:', cardError)
        }
      })
    } catch (error) {
      console.error('Error in applyResponsiveTypography:', error)
    }
  }

  // Setup resize observer for dynamic typography
  let resizeObserver = null
  
  function setupResizeObserver() {
    // Feature detection for ResizeObserver
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver not supported, using window resize fallback')
      // Fallback to window resize listener
      window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimeout)
        window.resizeTimeout = setTimeout(() => {
          applyResponsiveTypography()
        }, 100)
      })
      return
    }
    
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    
    try {
      resizeObserver = new ResizeObserver(entries => {
        // Debounce resize events
        clearTimeout(window.resizeTimeout)
        window.resizeTimeout = setTimeout(() => {
          applyResponsiveTypography()
        }, 100)
      })
      
      // Observe all dashboard cards
      const statCards = document.querySelectorAll('.dashboard-card-value')
      statCards.forEach(card => {
        resizeObserver.observe(card)
        resizeObserver.observe(card.parentElement)
      })
    } catch (error) {
      console.warn('ResizeObserver setup failed:', error)
      // Fallback to window resize listener
      window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimeout)
        window.resizeTimeout = setTimeout(() => {
          applyResponsiveTypography()
        }, 100)
      })
    }
  }
  
  function cleanupResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (window.resizeTimeout) {
      clearTimeout(window.resizeTimeout)
    }
  }

  // Initialize font sizing on page load
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(adjustAllStatNumbers, 100) // Small delay to ensure DOM is ready
    })
  }

  window.loadDashboard = loadDashboard
  window.cleanupDashboardListeners = cleanupDashboardListeners
  window.retryLoad = retryLoad
  window.loadTodaySalesHistory = loadTodaySalesHistory
  window.cleanupTodaySalesHistoryListeners = cleanupTodaySalesHistoryListeners
  window.goToNewSaleFromFab = goToNewSaleFromFab
  window.applyResponsiveTypography = applyResponsiveTypography
  window.setupResizeObserver = setupResizeObserver
  window.cleanupResizeObserver = cleanupResizeObserver
  window.adjustFontSizeForRevenueCard = adjustFontSizeForRevenueCard
  window.adjustFontSizeForProfitCard = adjustFontSizeForProfitCard
  window.adjustFontSizeForStatNumber = adjustFontSizeForStatNumber
  window.adjustAllStatNumbers = adjustAllStatNumbers
  window.formatNumberWithSpaces = formatNumberWithSpaces
})()

