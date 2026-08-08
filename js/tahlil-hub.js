/**
 * Tahlil v2 — period analytics hub (Firestore via AnalyticsAPI).
 * Tab switches update local state only — no full-page skeleton flash.
 */
;(function () {
  let activePeriod = 'day'
  let selectedDate = ''
  let productTab = 'quantity'
  let trendChart = null
  let loadToken = 0
  let refreshTimer = null
  let hasLoadedOnce = false

  const animatedValues = {
    revenue: 0,
    profit: 0,
    sales_count: 0,
    returns_count: 0
  }
  const animFrames = {}

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
    el.style.transition = 'opacity 180ms ease'
    el.style.opacity = '0.55'
    if (p === 0) {
      el.textContent = "— O'zgarish yo'q"
    } else {
      el.textContent = pos ? ('↑ +' + p + '%') : ('↓ ' + Math.abs(p) + '%')
    }
    requestAnimationFrame(() => {
      el.style.opacity = '1'
    })
  }

  /** Smooth count-up/down for summary card numbers (~200ms). */
  function animateNumber(key, toValue, elId, formatter, duration) {
    const el = document.getElementById(elId)
    if (!el) return
    const to = Number(toValue) || 0
    const from = Number(animatedValues[key]) || 0
    animatedValues[key] = to
    const ms = duration != null ? duration : 200

    if (animFrames[key]) {
      cancelAnimationFrame(animFrames[key])
      animFrames[key] = null
    }

    if (!hasLoadedOnce || Math.abs(to - from) < 0.5) {
      el.textContent = formatter(to)
      return
    }

    const start = performance.now()
    function tick(now) {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const cur = from + (to - from) * eased
      el.textContent = formatter(cur)
      if (t < 1) {
        animFrames[key] = requestAnimationFrame(tick)
      } else {
        el.textContent = formatter(to)
        animFrames[key] = null
      }
    }
    animFrames[key] = requestAnimationFrame(tick)
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

  function setRefreshing(on) {
    const content = document.getElementById('tahlilHubContent')
    if (content) content.classList.toggle('is-refreshing', !!on)
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
      // Built-in Chart.js tween between old and new points
      trendChart.update()
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
        animation: {
          duration: 250,
          easing: 'easeOutQuart'
        },
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
    el.style.transition = 'opacity 160ms ease'
    el.style.opacity = '0.55'
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="tahlil-rank-empty">Ma\'lumot yo\'q</div>'
    } else {
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
    requestAnimationFrame(() => {
      el.style.opacity = '1'
    })
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
    const soft = hasLoadedOnce

    if (soft) setRefreshing(true)

    try {
      const [summary, trend, topQty, topProfit, slow, returnsSummary] = await Promise.all([
        AnalyticsAPI.getAnalyticsSummary(period, dateStr),
        period === 'date' ? Promise.resolve([]) : AnalyticsAPI.getAnalyticsTrend(period, dateStr),
        AnalyticsAPI.getTopProducts(period, dateStr, 'quantity', 10),
        AnalyticsAPI.getTopProducts(period, dateStr, 'profit', 10),
        AnalyticsAPI.getSlowMovingProducts(period, dateStr, 10),
        AnalyticsAPI.getReturnsSummary(period, dateStr)
      ])

      // Stale response from a previous tab — discard
      if (token !== loadToken) return

      animateNumber('revenue', summary.revenue, 'tahlilCardRevenue', moneyShort, 200)
      animateNumber('profit', summary.profit, 'tahlilCardProfit', moneyShort, 200)
      animateNumber('sales_count', summary.sales_count, 'tahlilCardSalesCount', v => String(Math.round(v)), 200)
      animateNumber('returns_count', summary.returns_count, 'tahlilCardReturnsCount', v => String(Math.round(v)), 200)

      pctBadge(document.getElementById('tahlilCardRevenuePct'), summary.revenue_change_pct)
      pctBadge(document.getElementById('tahlilCardProfitPct'), summary.profit_change_pct)
      pctBadge(document.getElementById('tahlilCardSalesPct'), summary.sales_count_change_pct)
      pctBadge(document.getElementById('tahlilCardReturnsPct'), summary.returns_change_pct)

      if (period !== 'date') renderTrend(trend)

      window.__tahlilTopQty = topQty
      window.__tahlilTopProfit = topProfit
      renderRankList(
        document.getElementById('tahlilTopProductsList'),
        productTab === 'profit' ? topProfit : topQty,
        productTab === 'profit' ? 'profit' : 'quantity'
      )
      renderRankList(document.getElementById('tahlilSlowList'), slow, 'slow')

      const retCountEl = document.getElementById('tahlilReturnsTotalCount')
      const retAmountEl = document.getElementById('tahlilReturnsTotalAmount')
      if (retCountEl) retCountEl.textContent = (returnsSummary.returns_count || 0) + ' ta'
      if (retAmountEl) retAmountEl.textContent = money(returnsSummary.returns_amount || 0)

      const topRet = returnsSummary.top_products || []
      const retList = document.getElementById('tahlilReturnsTopList')
      if (retList) {
        retList.style.transition = 'opacity 160ms ease'
        retList.style.opacity = '0.55'
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
        requestAnimationFrame(() => { retList.style.opacity = '1' })
      }

      if (period === 'date') {
        const dayData = await AnalyticsAPI.getAnalyticsDay(dateStr)
        if (token !== loadToken) return
        renderDayLists(dayData)
      }

      hasLoadedOnce = true
      showContent()
      setRefreshing(false)
    } catch (err) {
      console.error('Tahlil refresh failed:', err)
      if (token === loadToken) {
        setRefreshing(false)
        if (!hasLoadedOnce) showError()
      }
    }
  }

  /** Debounce rapid tab taps; bump loadToken so in-flight work is ignored. */
  function scheduleRefresh() {
    clearTimeout(refreshTimer)
    // Invalidate any in-flight request immediately so it cannot overwrite newer tab data
    loadToken += 1
    refreshTimer = setTimeout(() => {
      refreshTahlil()
    }, 120)
  }

  function bindUiOnce() {
    if (bindUiOnce.done) return
    bindUiOnce.done = true

    const tabs = document.getElementById('tahlilPeriodTabs')
    if (tabs) {
      tabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-period]')
        if (!btn) return
        const next = btn.getAttribute('data-period') || 'day'
        if (next === activePeriod && next !== 'date') return

        activePeriod = next
        if (activePeriod === 'date' && !selectedDate) {
          selectedDate = todayInputValue()
          const input = document.getElementById('tahlilDateInput')
          if (input) input.value = selectedDate
        }
        syncPeriodUi()
        // Soft update only — keep previous numbers/chart visible
        if (hasLoadedOnce) setRefreshing(true)
        scheduleRefresh()
      })
    }

    const dateInput = document.getElementById('tahlilDateInput')
    if (dateInput) {
      dateInput.value = todayInputValue()
      selectedDate = dateInput.value
      dateInput.addEventListener('change', () => {
        selectedDate = dateInput.value || todayInputValue()
        if (hasLoadedOnce) setRefreshing(true)
        scheduleRefresh()
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
    clearTimeout(refreshTimer)
    loadToken += 1
    Object.keys(animFrames).forEach(k => {
      if (animFrames[k]) cancelAnimationFrame(animFrames[k])
      animFrames[k] = null
    })
    if (trendChart) {
      try { trendChart.destroy() } catch (e) { /* ignore */ }
      trendChart = null
    }
    hasLoadedOnce = false
    setRefreshing(false)
  }

  function loadTahlilHub() {
    bindUiOnce()
    if (!selectedDate) selectedDate = todayInputValue()
    syncPeriodUi()

    const content = document.getElementById('tahlilHubContent')
    const alreadyVisible = content && !content.classList.contains('hidden') && hasLoadedOnce
    if (alreadyVisible) {
      setRefreshing(true)
      scheduleRefresh()
    } else {
      showLoading()
      refreshTahlil()
    }
  }

  function retryTahlilHub() {
    hasLoadedOnce = false
    showLoading()
    refreshTahlil()
  }

  window.loadTahlilHub = loadTahlilHub
  window.cleanupTahlilHubListeners = cleanupTahlilHubListeners
  window.retryTahlilHub = retryTahlilHub
})()
