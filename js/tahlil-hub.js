/**
 * Tahlil hub — entry screen for analytics (real-time Firestore).
 */
;(function () {
  const UZ_MONTHS = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr'
  ]

  let hubUnsubs = []
  let hubBoot = {}
  let hubHadError = false

  let todaySales = []
  let weekCurrentSales = []
  let weekPrevSales = []
  let monthSales = []
  let nasiyaRows = []
  let productRows = []

  const BOOT_KEYS = ['today', 'weekCur', 'weekPrev', 'month', 'nasiya', 'products']

  function shopId() {
    return typeof currentShopId !== 'undefined' ? currentShopId : window.currentShopId
  }

  function safeInt(v) {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? n : 0
  }

  function saleTotal(raw) {
    return safeInt(raw.total ?? raw.amount)
  }

  function saleProfit(raw) {
    return safeInt(raw.profit ?? raw.totalProfit)
  }

  function shortMoney(n) {
    const x = safeInt(n)
    if (x >= 1000000) {
      const m = x / 1000000
      const s = (Math.round(m * 10) / 10).toFixed(1)
      return s.replace(/\.0$/, '') + ' mln'
    }
    if (x >= 1000) return Math.round(x / 1000) + 'k'
    return String(x)
  }

  function formatFullSom(n) {
    const v = safeInt(n)
    return v.toLocaleString('uz-UZ').replace(/,/g, ' ') + " so'm"
  }

  function monthYearLabel() {
    const d = new Date()
    return `${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }

  function monthStatsSubtitle() {
    return `${monthYearLabel()} statistikasi`
  }

  /** Monday 00:00 local, offsetWeeks from current week (0 = this week, -1 = previous). End is exclusive next Monday. */
  function weekRangeMonday(offsetWeeks) {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const day = d.getDay()
    const toMon = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + toMon + offsetWeeks * 7)
    d.setHours(0, 0, 0, 0)
    const start = d
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  function monthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
    return { start, end: tomorrow }
  }

  function todayRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  function weeklyChangePercent(curRev, prevRev) {
    const c = safeInt(curRev)
    const p = safeInt(prevRev)
    if (c === 0 && p === 0) return 0
    if (p === 0 && c > 0) return 100
    if (p === 0) return 0
    return Math.round(((c - p) / p) * 100)
  }

  function nasiyaRemaining(raw) {
    const amount = safeInt(raw.amount)
    const paid = safeInt(raw.paidAmount)
    let r = amount - paid
    if (!Number.isFinite(r) || r < 0) r = 0
    return r
  }

  function storeHealth(products) {
    if (!products.length) return { ok: true, label: "Sog'lom ✓", warn: false }
    const anyZero = products.some(p => safeInt(p.quantity) === 0)
    if (anyZero) return { ok: false, label: 'Diqqat ⚠', warn: true }
    return { ok: true, label: "Sog'lom ✓", warn: false }
  }

  function showHubLoading() {
    hubHadError = false
    hubBoot = {}
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.remove('hidden')
    if (err) err.classList.add('hidden')
    if (content) content.classList.add('hidden')
  }

  function showHubError() {
    hubHadError = true
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.add('hidden')
    if (err) err.classList.remove('hidden')
    if (content) content.classList.add('hidden')
  }

  function showHubContent() {
    if (hubHadError) return
    const load = document.getElementById('tahlilHubLoading')
    const err = document.getElementById('tahlilHubError')
    const content = document.getElementById('tahlilHubContent')
    if (load) load.classList.add('hidden')
    if (err) err.classList.add('hidden')
    if (content) content.classList.remove('hidden')
  }

  function tryFinishBoot() {
    const done = BOOT_KEYS.every(k => hubBoot[k])
    if (done) showHubContent()
  }

  function markBoot(key) {
    if (hubHadError) return
    hubBoot[key] = true
    tryFinishBoot()
    renderHub()
  }

  function onHubError(e) {
    console.error('Tahlil hub listener error:', e)
    hubHadError = true
    BOOT_KEYS.forEach(k => {
      hubBoot[k] = true
    })
    showHubError()
  }

  function renderHub() {
    if (hubHadError) return

    const pill = document.getElementById('tahlilHubMonthPill')
    if (pill) pill.textContent = monthYearLabel()

    const todayRev = todaySales.reduce((s, r) => s + saleTotal(r), 0)
    const todayPr = todaySales.reduce((s, r) => s + saleProfit(r), 0)
    const nasiyaTotal = nasiyaRows.reduce((s, r) => s + nasiyaRemaining(r), 0)

    const qr = document.getElementById('tahlilQuickRevenue')
    const qp = document.getElementById('tahlilQuickProfit')
    const qn = document.getElementById('tahlilQuickNasiya')
    if (qr) qr.textContent = shortMoney(todayRev)
    if (qp) qp.textContent = shortMoney(todayPr)
    if (qn) qn.textContent = shortMoney(nasiyaTotal)

    const curR = weekCurrentSales.reduce((s, r) => s + saleTotal(r), 0)
    const prevR = weekPrevSales.reduce((s, r) => s + saleTotal(r), 0)
    const wPct = weeklyChangePercent(curR, prevR)

    const weeklyBadge = document.getElementById('tahlilBadgeWeekly')
    if (weeklyBadge) {
      const pos = wPct >= 0
      weeklyBadge.className =
        'tahlil-hub-menu-badge ' + (pos ? 'tahlil-badge-weekly-pos' : 'tahlil-badge-weekly-neg')
      weeklyBadge.textContent = pos
        ? `↑ +${wPct}% o'tgan haftadan`
        : `↓ ${Math.abs(wPct)}% o'tgan haftadan`
    }

    const monthCount = monthSales.length
    const monthlyBadge = document.getElementById('tahlilBadgeMonthly')
    if (monthlyBadge) {
      monthlyBadge.textContent = `${monthCount} ta sotuv bu oy`
    }

    const subMonthly = document.getElementById('tahlilMonthlySubtitle')
    if (subMonthly) subMonthly.textContent = monthStatsSubtitle()

    const nasCount = nasiyaRows.length
    const nasBadge = document.getElementById('tahlilBadgeNasiya')
    if (nasBadge) {
      if (nasCount === 0) {
        nasBadge.className = 'tahlil-hub-menu-badge tahlil-badge-nasiya-zero'
        nasBadge.textContent = "Qarzdor yo'q"
      } else {
        nasBadge.className = 'tahlil-hub-menu-badge tahlil-badge-nasiya-pos'
        nasBadge.textContent = `${nasCount} ta faol qarzdor`
      }
    }

    const health = storeHealth(productRows)
    const dokBadge = document.getElementById('tahlilBadgeDokon')
    if (dokBadge) {
      if (health.warn) {
        dokBadge.className = 'tahlil-hub-menu-badge tahlil-badge-dokon-warn'
        dokBadge.textContent = 'Diqqat ⚠'
      } else {
        dokBadge.className = 'tahlil-hub-menu-badge tahlil-badge-dokon-ok'
        dokBadge.textContent = "Sog'lom ✓"
      }
    }

    const sumRevEl = document.getElementById('tahlilSummaryRevenue')
    const sumPrEl = document.getElementById('tahlilSummaryProfit')
    const sumCntEl = document.getElementById('tahlilSummaryCount')
    if (sumRevEl) sumRevEl.textContent = formatFullSom(todayRev)
    if (sumPrEl) sumPrEl.textContent = formatFullSom(todayPr)
    if (sumCntEl) sumCntEl.textContent = `${todaySales.length} ta`
  }

  function cleanupTahlilHubListeners() {
    hubUnsubs.forEach(fn => {
      if (typeof fn === 'function') fn()
    })
    hubUnsubs = []
  }

  function loadTahlilHub() {
    const sid = shopId()
    if (!sid) return

    cleanupTahlilHubListeners()
    showHubLoading()
    hubBoot = {}
    hubHadError = false

    const sales = db.collection('shops').doc(sid).collection('sales')
    const nasiya = db.collection('shops').doc(sid).collection('nasiya')
    const products = db.collection('shops').doc(sid).collection('products')

    const tr = todayRange()
    const w0 = weekRangeMonday(0)
    const w1 = weekRangeMonday(-1)
    const mr = monthRange()

    const u1 = sales
      .where('createdAt', '>=', tr.start)
      .where('createdAt', '<', tr.end)
      .onSnapshot(
        snap => {
          todaySales = []
          snap.forEach(doc => todaySales.push(doc.data() || {}))
          markBoot('today')
        },
        onHubError
      )
    hubUnsubs.push(u1)

    const u2 = sales
      .where('createdAt', '>=', w0.start)
      .where('createdAt', '<', w0.end)
      .onSnapshot(
        snap => {
          weekCurrentSales = []
          snap.forEach(doc => weekCurrentSales.push(doc.data() || {}))
          markBoot('weekCur')
        },
        onHubError
      )
    hubUnsubs.push(u2)

    const u3 = sales
      .where('createdAt', '>=', w1.start)
      .where('createdAt', '<', w1.end)
      .onSnapshot(
        snap => {
          weekPrevSales = []
          snap.forEach(doc => weekPrevSales.push(doc.data() || {}))
          markBoot('weekPrev')
        },
        onHubError
      )
    hubUnsubs.push(u3)

    const u4 = sales
      .where('createdAt', '>=', mr.start)
      .where('createdAt', '<', mr.end)
      .onSnapshot(
        snap => {
          monthSales = []
          snap.forEach(doc => monthSales.push(doc.data() || {}))
          markBoot('month')
        },
        onHubError
      )
    hubUnsubs.push(u4)

    const u5 = nasiya
      .where('status', '==', 'active')
      .onSnapshot(
        snap => {
          nasiyaRows = []
          snap.forEach(doc => nasiyaRows.push(doc.data() || {}))
          markBoot('nasiya')
        },
        onHubError
      )
    hubUnsubs.push(u5)

    const u6 = products.onSnapshot(
      snap => {
        productRows = []
        snap.forEach(doc => {
          const r = doc.data() || {}
          if (r.deleted === true) return
          if (r.status === 'inactive') return
          productRows.push({ quantity: safeInt(r.quantity) })
        })
        markBoot('products')
      },
      onHubError
    )
    hubUnsubs.push(u6)
  }

  function retryTahlilHub() {
    loadTahlilHub()
  }

  window.loadTahlilHub = loadTahlilHub
  window.cleanupTahlilHubListeners = cleanupTahlilHubListeners
  window.retryTahlilHub = retryTahlilHub
})()
