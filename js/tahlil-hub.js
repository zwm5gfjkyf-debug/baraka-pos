/**
 * Tahlil v2 — period analytics hub (Firestore via AnalyticsAPI).
 */
;(function () {
  let activePeriod = 'day'
  let selectedDate = ''
  let productTab = 'quantity'
  let trendChart = null
  let loadToken = 0

  function todayInputValue() {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function money(n) {
    if (typeof formatMoney === 'function') return formatMoney(n)
    return Math.round(Number(n) || 0).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS'
  }

  function moneyShort(n) {
    const x = Math.round(Number(n) || 0)
    if (x >= 1000000) {
      const m = x / 1000000
      return (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, '') + ' mln'
    }
    return x.toLocaleString('uz-UZ').replace(/,/g, ' ')
  }

  function pctBadge(el, pct) {
    if (!el) return
    const p = Math.round(Number(pct) || 0)
    const pos = p >= 0
    el.className = 'tahlil-hub-menu-badge ' + (pos ? 'tahlil-badge-weekly-pos' : 'tahlil-badge-weekly-neg')
    if (p === 0) {
      el.textContent = "— O'zgarish yo'q"
      return
    }
    el.textContent = pos ? ('↑ +' + p + '%') : ('↓ ' + Math.abs(p) + '%')
  }

  function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  function showLoading() {
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.remove('hidden')
    if (err) err.classList.add('hidden')
    if (content) content.classList.add('hidden')
  }

  function showError() {
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.add('hidden')
    if (err) err.classList.remove('hidden')
    if (content) content.classList.add('hidden')
  }

  function showContent() {
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.add('hidden')
    if (err) err.classList.add('hidden')
    if (content) content.classList.remove('hidden')
  }

  function syncPeriodUi() {
    document.querySelectorAll('#tahlilPeriodTabs .tahlil-period-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-period') === activePeriod)
    })
    const dateWrap = document.getElementById('tahlilDatePickerWrap')
    const dayLists = document.getElementById('tahlilDayLists')
    const trendCard = document.getElementById('tahlilTrendCard')
    const dayHeader = document.getElementById('tahlilDayHeader')
    const isDate = activePeriod === 'date'
    if (dateWrap) dateWrap.classList.toggle('hidden', !isDate)
    if (dayLists) dayLists.classList.toggle('hidden', !isDate)
    if (trendCard) trendCard.classList.toggle('hidden', isDate)
    if (dayHeader) dayHeader.classList.toggle('hidden', !isDate)
  }

  function renderTrend(points) {
    const canvas = document.getElementById('tahlilTrendChart')
    if (!canvas || typeof Chart === 'undefined') return
    const labels = (points || []).map(p => p.label)
    const data = (points || []).map(p => p.revenue)
    if (trendChart) {
      trendChart.data.labels = labels
      trendChart.data.datasets[0].data = data
      trendChart.update('none')
      return
    }
    trendChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tushum',
          data,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => money(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => moneyShort(v),
              font: { size: 10 }
            }
          }
        }
      }
    })
  }

  function renderRankList(el, rows, mode) {
    if (!el) return
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="tahlil-rank-empty">Ma\'lumot yo\'q</div>'
      return
    }
    el.innerHTML = rows.map((r, i) => {
      const right = mode === 'profit'
        ? money(r.profit)
        : (mode === 'slow'
          ? (r.quantity_sold + ' ta · zaxira ' + r.stock)
          : (r.quantity_sold + ' ta · ' + money(r.revenue)))
      return (
        '<div class="tahlil-rank-row">' +
          '<div class="tahlil-rank-left">' +
            '<span class="tahlil-rank-num">' + (i + 1) + '</span>' +
            '<span class="tahlil-rank-name">' + String(r.product_name || 'Mahsulot').replace(/</g, '&lt;') + '</span>' +
          '</div>' +
          '<div class="tahlil-rank-right">' + right + '</div>' +
        '</div>'
      )
    }).join('')
  }

  function renderDayLists(dayData) {
    const salesEl = document.getElementById('tahlilDaySalesList')
    const returnsEl = document.getElementById('tahlilDayReturnsList')
    const header = document.getElementById('tahlilDayHeader')
    if (header) {
      header.textContent = selectedDate || todayInputValue()
    }
    if (salesEl) {
      const sales = (dayData && dayData.sales) || []
      if (!sales.length) {
        salesEl.innerHTML = '<div class="tahlil-rank-empty">Bu kunda sotuv yo\'q</div>'
      } else {
        salesEl.innerHTML = sales.map(s => (
          '<button type="button" class="tahlil-day-sale-row" data-sale-id="' + String(s.id || '') + '">' +
            '<div>' +
              '<div class="tahlil-day-sale-title">' + String(s.transaction_number || 'Sotuv').replace(/</g, '&lt;') + '</div>' +
              '<div class="tahlil-day-sale-meta">' + String(s.time || '—') + '</div>' +
            '</div>' +
            '<div class="tahlil-day-sale-total">' + money(s.total) + '</div>' +
          '</button>'
        )).join('')
        salesEl.querySelectorAll('[data-sale-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-sale-id')
            if (id && typeof openSaleDetail === 'function') {
              openSaleDetail(id, { returnPage: 'tahlilHubPage' })
            }
          })
        })
      }
    }
    if (returnsEl) {
      const returns = (dayData && dayData.returns) || []
      if (!returns.length) {
        returnsEl.innerHTML = '<div class="tahlil-rank-empty">Bu kunda qaytarish yo\'q</div>'
      } else {
        returnsEl.innerHTML = returns.map(r => (
          '<div class="tahlil-rank-row">' +
            '<div class="tahlil-rank-name">' + String(r.product_name || 'Mahsulot').replace(/</g, '&lt;') +
              ' · ' + r.quantity + ' ta</div>' +
            '<div class="tahlil-rank-right">' + money(r.refund_amount) + '</div>' +
          '</div>'
        )).join('')
      }
    }
  }

  async function refreshTahlil() {
    if (typeof AnalyticsAPI === 'undefined') {
      showError()
      return
    }
    const token = ++loadToken
    const dateStr = selectedDate || todayInputValue()
    const period = activePeriod

    try {
      const [summary, trend, topQty, topProfit, slow, returnsSummary] = await Promise.all([
        AnalyticsAPI.getAnalyticsSummary(period, dateStr),
        activePeriod === 'date' ? Promise.resolve([]) : AnalyticsAPI.getAnalyticsTrend(period, dateStr),
        AnalyticsAPI.getTopProducts(period, dateStr, 'quantity', 10),
        AnalyticsAPI.getTopProducts(period, dateStr, 'profit', 10),
        AnalyticsAPI.getSlowMovingProducts(period, dateStr, 10),
        AnalyticsAPI.getReturnsSummary(period, dateStr)
      ])

      if (token !== loadToken) return

      setText('tahlilCardRevenue', moneyShort(summary.revenue))
      setText('tahlilCardProfit', moneyShort(summary.profit))
      setText('tahlilCardSalesCount', String(summary.sales_count))
      setText('tahlilCardReturnsCount', String(summary.returns_count))
      pctBadge(document.getElementById('tahlilCardRevenuePct'), summary.revenue_change_pct)
      pctBadge(document.getElementById('tahlilCardProfitPct'), summary.profit_change_pct)
      pctBadge(document.getElementById('tahlilCardSalesPct'), summary.sales_count_change_pct)
      pctBadge(document.getElementById('tahlilCardReturnsPct'), summary.returns_change_pct)

      if (activePeriod !== 'date') renderTrend(trend)

      window.__tahlilTopQty = topQty
      window.__tahlilTopProfit = topProfit
      renderRankList(
        document.getElementById('tahlilTopProductsList'),
        productTab === 'profit' ? topProfit : topQty,
        productTab === 'profit' ? 'profit' : 'quantity'
      )
      renderRankList(document.getElementById('tahlilSlowList'), slow, 'slow')

      setText('tahlilReturnsTotalCount', (returnsSummary.returns_count || 0) + ' ta')
      setText('tahlilReturnsTotalAmount', money(returnsSummary.returns_amount || 0))
      const topRet = returnsSummary.top_products || []
      const retList = document.getElementById('tahlilReturnsTopList')
      if (retList) {
        if (!topRet.length) {
          retList.innerHTML = '<div class="tahlil-rank-empty">Qaytarilgan mahsulot yo\'q</div>'
        } else {
          retList.innerHTML = topRet.map(r => (
            '<div class="tahlil-rank-row">' +
              '<span class="tahlil-rank-name">' + String(r.product_name).replace(/</g, '&lt;') + '</span>' +
              '<span class="tahlil-rank-right">' + r.quantity + ' ta · ' + money(r.refund_amount) + '</span>' +
            '</div>'
          )).join('')
        }
      }

      if (activePeriod === 'date') {
        const dayData = await AnalyticsAPI.getAnalyticsDay(dateStr)
        if (token !== loadToken) return
        renderDayLists(dayData)
      }

      showContent()
    } catch (err) {
      console.error('Tahlil refresh failed:', err)
      if (token === loadToken) showError()
    }
  }

  function bindUiOnce() {
    if (bindUiOnce.done) return
    bindUiOnce.done = true

    const tabs = document.getElementById('tahlilPeriodTabs')
    if (tabs) {
      tabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-period]')
        if (!btn) return
        activePeriod = btn.getAttribute('data-period') || 'day'
        if (activePeriod === 'date' && !selectedDate) {
          selectedDate = todayInputValue()
          const input = document.getElementById('tahlilDateInput')
          if (input) input.value = selectedDate
        }
        syncPeriodUi()
        showLoading()
        refreshTahlil()
      })
    }

    const dateInput = document.getElementById('tahlilDateInput')
    if (dateInput) {
      dateInput.value = todayInputValue()
      selectedDate = dateInput.value
      dateInput.addEventListener('change', () => {
        selectedDate = dateInput.value || todayInputValue()
        showLoading()
        refreshTahlil()
      })
    }

    const productTabs = document.getElementById('tahlilProductTabs')
    if (productTabs) {
      productTabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-product-tab]')
        if (!btn) return
        productTab = btn.getAttribute('data-product-tab') || 'quantity'
        productTabs.querySelectorAll('.tahlil-product-tab').forEach(b => {
          b.classList.toggle('is-active', b === btn)
        })
        renderRankList(
          document.getElementById('tahlilTopProductsList'),
          productTab === 'profit' ? (window.__tahlilTopProfit || []) : (window.__tahlilTopQty || []),
          productTab === 'profit' ? 'profit' : 'quantity'
        )
      })
    }

    const slowToggle = document.getElementById('tahlilSlowToggle')
    const slowPanel = document.getElementById('tahlilSlowPanel')
    if (slowToggle && slowPanel) {
      slowToggle.addEventListener('click', () => {
        const open = slowPanel.classList.contains('hidden')
        slowPanel.classList.toggle('hidden', !open)
        slowToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        slowToggle.classList.toggle('is-open', open)
      })
    }
  }

  function cleanupTahlilHubListeners() {
    loadToken += 1
    if (trendChart) {
      try { trendChart.destroy() } catch (e) { /* ignore */ }
      trendChart = null
    }
  }

  function loadTahlilHub() {
    bindUiOnce()
    if (!selectedDate) selectedDate = todayInputValue()
    syncPeriodUi()
    showLoading()
    refreshTahlil()
  }

  function retryTahlilHub() {
    loadTahlilHub()
  }

  window.loadTahlilHub = loadTahlilHub
  window.cleanupTahlilHubListeners = cleanupTahlilHubListeners
  window.retryTahlilHub = retryTahlilHub
})()
