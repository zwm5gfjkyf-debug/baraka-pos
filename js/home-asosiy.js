/**
 * Asosiy (Home) — real-time Firestore dashboard
 * Paths: shops/{shopId}/sales
 */
(function () {
  let todaySalesUnsub = null
  let todayHistoryUnsub = null
  let chartRangeUnsub = null

  let revenueChart = null
  let todaySalesRows = []
  let chartSalesRows = []
  let chartFilter = 'bugun'
  let chartRequestId = 0
  let chartTabsBound = false

  let dashboardBoot = { today: false }
  let dashboardHadError = false

  const CHART_LINE = '#166534'
  const CHART_FILTERS = ['kecha', 'bugun', 'hafta', 'oy', 'yil']
  const MONTH_LABELS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
  const DAY_LABELS_UZ = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']

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
    
    const currencySuffix = element.parentElement && element.parentElement.querySelector('.stat-currency')
    if (currencySuffix) {
      currencySuffix.style.fontSize = (numberFontSize - 6) + 'px'
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
    
    const currencySuffix = element.parentElement && element.parentElement.querySelector('.stat-currency')
    if (currencySuffix) {
      currencySuffix.style.fontSize = (numberFontSize - 6) + 'px'
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
    if (typeof formatMoney === 'function') return formatMoney(amount)
    const n = safeInt(amount)
    const s = n.toLocaleString('uz-UZ').replace(/,/g, ' ')
    return `${s} UZS`
  }

  function getTodayBounds() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    return { todayStart, tomorrowStart, now }
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

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  }

  function addDays(d, n) {
    const x = new Date(d.getTime())
    x.setDate(x.getDate() + n)
    return x
  }

  function pad2(n) {
    return String(n).padStart(2, '0')
  }

  function getChartRange(filter) {
    const now = new Date()
    const todayStart = startOfDay(now)
    const tomorrowStart = addDays(todayStart, 1)

    if (filter === 'kecha') {
      const yesterdayStart = addDays(todayStart, -1)
      return { start: yesterdayStart, end: todayStart, mode: 'hourly', dayAnchor: yesterdayStart }
    }
    if (filter === 'bugun') {
      return { start: todayStart, end: tomorrowStart, mode: 'hourly', dayAnchor: todayStart, live: true }
    }
    if (filter === 'hafta') {
      const start = addDays(todayStart, -6)
      return { start, end: tomorrowStart, mode: 'daily' }
    }
    if (filter === 'oy') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { start, end: tomorrowStart, mode: 'daily' }
    }
    // yil
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    return { start, end: tomorrowStart, mode: 'monthly' }
  }

  function groupingLabelFor(filter) {
    if (filter === 'yil') return "Tafsilotlar: oylar bo'yicha"
    if (filter === 'hafta' || filter === 'oy') return "Tafsilotlar: kunlar bo'yicha"
    return "Tafsilotlar: soatlar bo'yicha"
  }

  function formatAxisAmount(value) {
    const n = Number(value) || 0
    if (Math.abs(n) >= 1000000) {
      const m = n / 1000000
      const text = (Math.abs(m) >= 10 ? m.toFixed(0) : m.toFixed(1)).replace(/\.0$/, '')
      return text + 'M'
    }
    if (Math.abs(n) >= 1000) {
      return Math.round(n / 1000) + 'K'
    }
    return String(Math.round(n))
  }

  function buildHourlyBuckets(rows, dayAnchor, isLiveToday) {
    const y = dayAnchor.getFullYear()
    const m = dayAnchor.getMonth()
    const d = dayAnchor.getDate()
    const now = new Date()
    const dayStartMs = new Date(y, m, d, 0, 0, 0, 0).getTime()
    const dayEndMs = new Date(y, m, d, 23, 59, 59, 999).getTime()
    // 2-hour shop-day buckets; first bucket includes pre-08:00 sales
    const hours = [8, 10, 12, 14, 16, 18, 20, 22]
    const labels = []
    const values = []

    hours.forEach((hour, idx) => {
      const slotStartMs = idx === 0
        ? dayStartMs
        : new Date(y, m, d, hour, 0, 0, 0).getTime()
      const nextHour = hours[idx + 1]
      let slotEndMs = nextHour != null
        ? new Date(y, m, d, nextHour, 0, 0, 0).getTime()
        : dayEndMs + 1

      if (isLiveToday && slotStartMs > now.getTime()) return

      let label = pad2(hour) + ':00'
      const isCurrentSlot = isLiveToday &&
        slotStartMs <= now.getTime() &&
        now.getTime() < slotEndMs

      if (isCurrentSlot) {
        slotEndMs = Math.min(slotEndMs, now.getTime() + 1)
        label = 'Hozir'
      }

      const sum = rows.reduce((acc, row) => {
        const ms = row._sortMs
        if (ms == null) return acc
        if (ms >= slotStartMs && ms < slotEndMs) return acc + safeInt(row.total)
        return acc
      }, 0)

      labels.push(label)
      values.push(sum)
    })

    if (!labels.length) {
      labels.push('08:00', '12:00', '16:00', '20:00')
      values.push(0, 0, 0, 0)
    }

    return { labels, values }
  }

  function buildDailyBuckets(rows, start, end) {
    const labels = []
    const values = []
    let cursor = startOfDay(start)
    const endMs = end.getTime()

    while (cursor.getTime() < endMs) {
      const next = addDays(cursor, 1)
      const sum = rows.reduce((acc, row) => {
        const ms = row._sortMs
        if (ms == null) return acc
        if (ms >= cursor.getTime() && ms < next.getTime()) return acc + safeInt(row.total)
        return acc
      }, 0)

      // Hafta: weekday short name; Oy: day number
      const daySpan = Math.round((endMs - start.getTime()) / 86400000)
      if (daySpan <= 8) {
        labels.push(DAY_LABELS_UZ[cursor.getDay()])
      } else {
        labels.push(String(cursor.getDate()))
      }
      values.push(sum)
      cursor = next
    }

    return { labels, values }
  }

  function buildMonthlyBuckets(rows, year) {
    const labels = MONTH_LABELS_UZ.slice()
    const values = new Array(12).fill(0)
    const now = new Date()
    const maxMonth = year === now.getFullYear() ? now.getMonth() : 11

    rows.forEach(row => {
      const ms = row._sortMs
      if (ms == null) return
      const d = new Date(ms)
      if (d.getFullYear() !== year) return
      const m = d.getMonth()
      if (m < 0 || m > 11) return
      values[m] += safeInt(row.total)
    })

    return {
      labels: labels.slice(0, maxMonth + 1),
      values: values.slice(0, maxMonth + 1)
    }
  }

  function buildChartSeries(rows, filter) {
    const range = getChartRange(filter)
    if (range.mode === 'hourly') {
      return buildHourlyBuckets(rows, range.dayAnchor, !!range.live)
    }
    if (range.mode === 'daily') {
      return buildDailyBuckets(rows, range.start, range.end)
    }
    return buildMonthlyBuckets(rows, range.start.getFullYear())
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
    dashboardBoot = { today: false }
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

    const revEl = document.getElementById('todayRevenueValue')
    if (revEl) {
      revEl.textContent = formatNumberWithSpaces(todayRev)
      adjustFontSizeForRevenueCard(revEl)
    }

    const profitVal = document.getElementById('todayProfitValue')
    if (profitVal) {
      profitVal.textContent = formatNumberWithSpaces(todayProfit)
      adjustFontSizeForProfitCard(profitVal)
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
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'dashboard-recent-card dashboard-recent-card-btn'
      card.setAttribute('data-sale-id', sale.id || '')
      card.setAttribute('aria-label', 'Sotuv #' + sale.saleNumberLabel + ' tafsiloti')
      card.innerHTML = `
        <div class="dashboard-recent-icon" style="background:${pal.bg};color:${pal.fg};">🛒</div>
        <div class="dashboard-recent-details">
          <div class="dashboard-recent-title">Sotuv #${sale.saleNumberLabel}</div>
          <div class="dashboard-recent-meta">${timeStr} · ${safeInt(sale.itemsCount)} ta mahsulot</div>
        </div>
        <div class="dashboard-recent-amount">${formatSom(sale.total)}</div>
      `
      card.addEventListener('click', () => {
        if (!sale.id || typeof openSaleDetail !== 'function') return
        openSaleDetail(sale.id, { returnPage: 'dashboardPage' })
      })
      container.appendChild(card)
    })
  }

  function setChartLoading(on) {
    const overlay = document.getElementById('chartLoadingOverlay')
    if (!overlay) return
    if (on) {
      overlay.classList.remove('hidden')
      overlay.setAttribute('aria-hidden', 'false')
    } else {
      overlay.classList.add('hidden')
      overlay.setAttribute('aria-hidden', 'true')
    }
  }

  function updateChartStatusPill(filter) {
    const pill = document.getElementById('chartStatusPill')
    if (!pill) return
    if (filter === 'bugun') {
      pill.textContent = 'Jonli'
      pill.classList.remove('is-historical')
    } else {
      pill.textContent = 'Yangilangan'
      pill.classList.add('is-historical')
    }
  }

  function updateGroupingLabel(filter) {
    const el = document.getElementById('chartGroupingLabel')
    if (el) el.textContent = groupingLabelFor(filter)
  }

  function setActiveChartTab(filter) {
    const tabs = document.querySelectorAll('#chartFilterTabs [data-chart-filter]')
    tabs.forEach(btn => {
      const active = btn.getAttribute('data-chart-filter') === filter
      btn.classList.toggle('is-active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })
  }

  function renderChartXLabels(labels) {
    const el = document.getElementById('chartXLabels')
    if (!el) return
    el.innerHTML = ''
    const n = labels.length
    if (!n) return
    let showEvery = 1
    if (n > 16) showEvery = Math.ceil(n / 8)
    else if (n > 10) showEvery = 2

    labels.forEach((label, i) => {
      const span = document.createElement('span')
      const show = i === 0 || i === n - 1 || i % showEvery === 0
      span.textContent = show ? label : ''
      el.appendChild(span)
    })
  }

  function destroyRevenueChart() {
    if (!revenueChart) return
    try {
      revenueChart.destroy()
    } catch (error) {
      console.warn('Error destroying existing chart:', error)
    }
    revenueChart = null
  }

  function renderRevenueChart(series) {
    const canvas = document.getElementById('revenueChart')
    if (!canvas) {
      console.warn('Revenue chart canvas not found')
      return
    }
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not available')
      return
    }

    const labels = series.labels || []
    const values = series.values || []
    const withSale = values.some(v => safeInt(v) > 0)
    const lastIdx = values.length - 1

    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.warn('Could not get canvas context')
        return
      }

      destroyRevenueChart()

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 240)
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.22)')
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')

      revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels.slice(),
          datasets: [
            {
              data: values,
              borderColor: CHART_LINE,
              backgroundColor: withSale ? gradient : 'transparent',
              borderWidth: 2.5,
              fill: withSale,
              tension: 0.35,
              cubicInterpolationMode: 'monotone',
              pointRadius(ctxPt) {
                const i = ctxPt.dataIndex
                if (!withSale) return i === 0 ? 4 : 0
                if (i === 0) return 4
                if (i === lastIdx) return 6
                return 0
              },
              pointBackgroundColor: CHART_LINE,
              pointBorderColor: CHART_LINE,
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          interaction: { mode: 'index', intersect: false },
          layout: {
            padding: { top: 4, right: 6, bottom: 0, left: 0 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              displayColors: false,
              callbacks: {
                label(ctxTip) {
                  return formatSom(ctxTip.parsed.y)
                }
              }
            }
          },
          scales: {
            x: {
              display: false,
              grid: { display: false }
            },
            y: {
              display: true,
              min: 0,
              grace: '8%',
              border: { display: false },
              grid: {
                color: 'rgba(148, 163, 184, 0.22)',
                drawBorder: false
              },
              ticks: {
                maxTicksLimit: 5,
                padding: 6,
                color: '#94A3B8',
                font: { size: 11, weight: '500' },
                callback(value) {
                  return formatAxisAmount(value)
                }
              }
            }
          },
          elements: {
            line: { borderJoinStyle: 'round' }
          }
        }
      })

      renderChartXLabels(labels)
    } catch (error) {
      console.error('Error creating revenue chart:', error)
      destroyRevenueChart()
    }
  }

  function stopChartRangeFetch() {
    if (typeof chartRangeUnsub === 'function') {
      try { chartRangeUnsub() } catch (e) { /* ignore */ }
    }
    chartRangeUnsub = null
  }

  function paintChartFromRows(rows) {
    updateChartStatusPill(chartFilter)
    updateGroupingLabel(chartFilter)
    const series = buildChartSeries(rows || [], chartFilter)
    renderRevenueChart(series)
    setChartLoading(false)
  }

  function fetchChartRange(filter) {
    const shopId = typeof currentShopId !== 'undefined' ? currentShopId : window.currentShopId
    if (!shopId || typeof db === 'undefined') {
      paintChartFromRows([])
      return
    }

    const requestId = ++chartRequestId
    setChartLoading(true)
    stopChartRangeFetch()

    const range = getChartRange(filter)
    let query
    try {
      query = db.collection('shops').doc(shopId).collection('sales')
        .where('createdAt', '>=', range.start)
        .where('createdAt', '<', range.end)
    } catch (error) {
      console.error('Failed to build chart range query:', error)
      if (requestId === chartRequestId) {
        paintChartFromRows([])
      }
      return
    }

    query.get()
      .then(snap => {
        if (requestId !== chartRequestId || chartFilter !== filter) return
        const rows = []
        snap.forEach(doc => rows.push(normalizeSaleDoc(doc)))
        chartSalesRows = rows
        paintChartFromRows(rows)
      })
      .catch(err => {
        console.error('Chart range fetch failed:', err)
        if (requestId !== chartRequestId || chartFilter !== filter) return
        chartSalesRows = []
        paintChartFromRows([])
      })
  }

  function refreshChart({ showLoading } = {}) {
    if (chartFilter === 'bugun') {
      stopChartRangeFetch()
      chartRequestId += 1
      if (showLoading) setChartLoading(true)
      chartSalesRows = todaySalesRows
      paintChartFromRows(chartSalesRows)
      return
    }
    if (showLoading !== false) setChartLoading(true)
    fetchChartRange(chartFilter)
  }

  function bindChartFilterTabs() {
    if (chartTabsBound) return
    const tabs = document.getElementById('chartFilterTabs')
    if (!tabs) return
    chartTabsBound = true
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-chart-filter]')
      if (!btn || !tabs.contains(btn)) return
      const filter = btn.getAttribute('data-chart-filter')
      if (!CHART_FILTERS.includes(filter) || filter === chartFilter) return
      chartFilter = filter
      setActiveChartTab(filter)
      refreshChart({ showLoading: true })
    })
  }

  function resetChartFilterUi() {
    chartFilter = 'bugun'
    setActiveChartTab('bugun')
    updateChartStatusPill('bugun')
    updateGroupingLabel('bugun')
    setChartLoading(false)
  }

  function renderDashboardFromCache() {
    if (dashboardHadError) return
    const sorted = sortTodayNewestFirst(todaySalesRows)
    updateStatsAndRecent(sorted)
    if (chartFilter === 'bugun') {
      refreshChart({ showLoading: false })
    }
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
    if (dashboardBoot.today) {
      showDashboardContent()
    }
    renderDashboardFromCache()
  }

  function onListenerError(err) {
    console.error('Asosiy listener error:', err)
    dashboardHadError = true
    dashboardBoot = { today: true }
    showDashboardError()
  }

  function cleanupDashboardListeners() {
    if (typeof todaySalesUnsub === 'function') todaySalesUnsub()
    todaySalesUnsub = null
    stopChartRangeFetch()
    chartRequestId += 1
    chartSalesRows = []
    destroyRevenueChart()
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
    bindChartFilterTabs()
    resetChartFilterUi()

    const { todayStart, tomorrowStart } = getTodayBounds()

    let salesCol
    try {
      salesCol = db.collection('shops').doc(shopId).collection('sales')
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
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'dashboard-recent-card today-sales-history-row dashboard-recent-card-btn'
      row.setAttribute('data-sale-id', sale.id || '')
      row.setAttribute('aria-label', 'Sotuv #' + sale.saleNumberLabel + ' tafsiloti')
      row.innerHTML = `
        <div class="dashboard-recent-icon" style="background:${pal.bg};color:${pal.fg};">🛒</div>
        <div class="dashboard-recent-details">
          <div class="dashboard-recent-title">Sotuv #${sale.saleNumberLabel}</div>
          <div class="dashboard-recent-meta">${timeStr} · ${safeInt(sale.itemsCount)} ta mahsulot</div>
        </div>
        <div class="dashboard-recent-amount">${formatSom(sale.total)}</div>
      `
      row.addEventListener('click', () => {
        if (!sale.id || typeof openSaleDetail !== 'function') return
        openSaleDetail(sale.id, { returnPage: 'todaySalesHistoryPage' })
      })
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

