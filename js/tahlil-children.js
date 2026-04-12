/**
 * Tahlil child screens: weekly, monthly, nasiya lists.
 */
;(function () {
  let weeklyUnsubs = []
  let monthlyUnsub = null
  let nasiyaChildUnsub = null

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

  function weeklyPct(cur, prev) {
    const c = safeInt(cur)
    const p = safeInt(prev)
    if (c === 0 && p === 0) return 0
    if (p === 0 && c > 0) return 100
    if (p === 0) return 0
    return Math.round(((c - p) / p) * 100)
  }

  function formatSom(n) {
    const v = safeInt(n)
    return v.toLocaleString('uz-UZ').replace(/,/g, ' ') + " so'm"
  }

  function cleanupWeeklyTahliliListeners() {
    weeklyUnsubs.forEach(u => typeof u === 'function' && u())
    weeklyUnsubs = []
  }

  function cleanupMonthlyTahliliListeners() {
    if (typeof monthlyUnsub === 'function') monthlyUnsub()
    monthlyUnsub = null
  }

  function cleanupNasiyaTahliliListeners() {
    if (typeof nasiyaChildUnsub === 'function') nasiyaChildUnsub()
    nasiyaChildUnsub = null
  }

  function renderWeeklyBody(curRev, prevRev) {
    const el = document.getElementById('weeklyTahlilBody')
    if (!el) return
    const pct = weeklyPct(curRev, prevRev)
    const pos = pct >= 0
    el.innerHTML = `
      <div class="tahlil-child-card">
        <div class="tahlil-child-stat-row">
          <span class="tahlil-child-stat-label">Bu hafta tushum</span>
          <span class="tahlil-child-stat-val tahlil-stat-blue">${formatSom(curRev)}</span>
        </div>
        <div class="tahlil-child-stat-row">
          <span class="tahlil-child-stat-label">O'tgan hafta tushum</span>
          <span class="tahlil-child-stat-val">${formatSom(prevRev)}</span>
        </div>
        <div class="tahlil-child-pill-row">
          <span class="tahlil-hub-menu-badge ${pos ? 'tahlil-badge-weekly-pos' : 'tahlil-badge-weekly-neg'}">
            ${pos ? `↑ +${pct}%` : `↓ ${Math.abs(pct)}%`} o'tgan haftadan
          </span>
        </div>
      </div>
    `
  }

  function loadWeeklyTahliliPage() {
    const sid = shopId()
    if (!sid) return
    cleanupWeeklyTahliliListeners()
    const body = document.getElementById('weeklyTahlilBody')
    if (body) {
      body.innerHTML = '<div class="tahlil-child-loading">Yuklanmoqda…</div>'
    }
    const sales = db.collection('shops').doc(sid).collection('sales')
    const w0 = weekRangeMonday(0)
    const w1 = weekRangeMonday(-1)
    let curRev = 0
    let prevRev = 0
    let got = 0

    function tryRender() {
      got += 1
      if (got >= 2) renderWeeklyBody(curRev, prevRev)
    }

    const u1 = sales
      .where('createdAt', '>=', w0.start)
      .where('createdAt', '<', w0.end)
      .onSnapshot(
        snap => {
          curRev = 0
          snap.forEach(doc => {
            curRev += saleTotal(doc.data() || {})
          })
          tryRender()
        },
        () => {
          if (body) body.innerHTML = '<div class="tahlil-child-error">Ma\'lumotlarni yuklashda xato</div>'
        }
      )
    weeklyUnsubs.push(u1)

    const u2 = sales
      .where('createdAt', '>=', w1.start)
      .where('createdAt', '<', w1.end)
      .onSnapshot(
        snap => {
          prevRev = 0
          snap.forEach(doc => {
            prevRev += saleTotal(doc.data() || {})
          })
          tryRender()
        },
        () => {
          if (body) body.innerHTML = '<div class="tahlil-child-error">Ma\'lumotlarni yuklashda xato</div>'
        }
      )
    weeklyUnsubs.push(u2)
  }

  function loadMonthlyTahliliPage() {
    const sid = shopId()
    if (!sid) return
    cleanupMonthlyTahliliListeners()
    const body = document.getElementById('monthlyTahlilBody')
    if (body) body.innerHTML = '<div class="tahlil-child-loading">Yuklanmoqda…</div>'

    const mr = monthRange()
    const sales = db.collection('shops').doc(sid).collection('sales')

    monthlyUnsub = sales
      .where('createdAt', '>=', mr.start)
      .where('createdAt', '<', mr.end)
      .onSnapshot(
        snap => {
          const rows = []
          snap.forEach(doc => {
            const raw = doc.data() || {}
            rows.push({ id: doc.id, raw })
          })
          rows.sort((a, b) => {
            const ta = a.raw.createdAt && a.raw.createdAt.toDate ? a.raw.createdAt.toDate().getTime() : 0
            const tb = b.raw.createdAt && b.raw.createdAt.toDate ? b.raw.createdAt.toDate().getTime() : 0
            return tb - ta
          })
          if (!body) return
          if (rows.length === 0) {
            body.innerHTML =
              '<div class="tahlil-child-empty">Bu oyda hali sotuv yo\'q</div>'
            return
          }
          let html = `<div class="tahlil-month-summary">${rows.length} ta sotuv bu oy</div>`
          html += '<div class="tahlil-month-list">'
          rows.slice(0, 50).forEach(r => {
            const t = r.raw.createdAt && r.raw.createdAt.toDate
              ? r.raw.createdAt.toDate().toLocaleString('uz-UZ', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '—'
            html += `<div class="tahlil-month-row">
              <span class="tahlil-month-time">${t}</span>
              <span class="tahlil-month-amt">${formatSom(saleTotal(r.raw))}</span>
            </div>`
          })
          html += '</div>'
          body.innerHTML = html
        },
        () => {
          if (body) body.innerHTML = '<div class="tahlil-child-error">Ma\'lumotlarni yuklashda xato</div>'
        }
      )
  }

  function nasiyaRemain(raw) {
    const amount = safeInt(raw.amount)
    const paid = safeInt(raw.paidAmount)
    let x = amount - paid
    if (!Number.isFinite(x) || x < 0) x = 0
    return x
  }

  function loadNasiyaTahliliPage() {
    const sid = shopId()
    if (!sid) return
    cleanupNasiyaTahliliListeners()
    const list = document.getElementById('nasiyaTahlilList')
    if (list) list.innerHTML = '<div class="tahlil-child-loading">Yuklanmoqda…</div>'

    nasiyaChildUnsub = db
      .collection('shops')
      .doc(sid)
      .collection('nasiya')
      .where('status', '==', 'active')
      .onSnapshot(
        snap => {
          if (!list) return
          list.innerHTML = ''
          if (snap.empty) {
            list.innerHTML = '<div class="tahlil-child-empty">Faol qarzdorlar yo\'q</div>'
            return
          }
          snap.forEach(doc => {
            const raw = doc.data() || {}
            const name = String(raw.customerName || raw.name || 'Noma\'lum')
            const rem = nasiyaRemain(raw)
            const row = document.createElement('div')
            row.className = 'tahlil-nasiya-row'
            row.innerHTML = `
              <div class="tahlil-nasiya-name">${name}</div>
              <div class="tahlil-nasiya-amt">${formatSom(rem)}</div>
            `
            list.appendChild(row)
          })
        },
        () => {
          if (list) list.innerHTML = '<div class="tahlil-child-error">Ma\'lumotlarni yuklashda xato</div>'
        }
      )
  }

  window.loadWeeklyTahliliPage = loadWeeklyTahliliPage
  window.cleanupWeeklyTahliliListeners = cleanupWeeklyTahliliListeners
  window.loadMonthlyTahliliPage = loadMonthlyTahliliPage
  window.cleanupMonthlyTahliliListeners = cleanupMonthlyTahliliListeners
  window.loadNasiyaTahliliPage = loadNasiyaTahliliPage
  window.cleanupNasiyaTahliliListeners = cleanupNasiyaTahliliListeners
})()
