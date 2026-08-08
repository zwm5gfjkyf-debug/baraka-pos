/**
 * Phase 0 — READ-ONLY audit of historical nasiya (debt) sales.
 *
 * There is no Firebase Admin SDK / service-account config in this repo.
 * This script uses the same REST + email/password pattern as
 * scripts/list-test-products.mjs (client API key from js/firebase.js).
 *
 * Usage:
 *   BARAKA_EMAIL=... BARAKA_PASSWORD=... node scripts/audit-debt-sales.mjs
 * Optional:
 *   BARAKA_SHOP_ID=...   (defaults to signed-in uid)
 *   BARAKA_ALL_SHOPS=1   (scan every shop the signed-in user can list under /shops)
 *
 * Writes nothing. Exit code 0 on success.
 */
const API_KEY = 'AIzaSyBzs6n66fLSWBhobX-GOnROx-QvR8eH9gU'
const PROJECT = 'baraka-pos-2'

const email = process.env.BARAKA_EMAIL
const password = process.env.BARAKA_PASSWORD
const allShops = process.env.BARAKA_ALL_SHOPS === '1'

if (!email || !password) {
  console.error('Set BARAKA_EMAIL and BARAKA_PASSWORD (same as list-test-products.mjs)')
  process.exit(1)
}

function firestoreValueToJs(v) {
  if (v == null) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('mapValue' in v) {
    const out = {}
    const fields = v.mapValue.fields || {}
    for (const [k, val] of Object.entries(fields)) out[k] = firestoreValueToJs(val)
    return out
  }
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(firestoreValueToJs)
  }
  return v
}

function docToObject(doc) {
  const id = doc.name.split('/').pop()
  const data = {}
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = firestoreValueToJs(v)
  }
  return { id, ...data }
}

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  )
  const json = await res.json()
  if (!json.idToken || !json.localId) {
    throw new Error('Sign-in failed: ' + JSON.stringify(json))
  }
  return { token: json.idToken, uid: json.localId }
}

async function listShopIds(token) {
  const docs = []
  let pageToken = ''
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shops`
    )
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    if (json.error) throw new Error('list shops failed: ' + JSON.stringify(json.error))
    for (const doc of json.documents || []) {
      docs.push(doc.name.split('/').pop())
    }
    pageToken = json.nextPageToken || ''
  } while (pageToken)
  return docs
}

async function queryDebtSales(token, shopId) {
  // Query paymentType == "debt", and also type / payment_method aliases
  // Firestore only allows one fieldFilter per query without composite indexes,
  // so we run three queries and merge by id.
  const fieldPaths = ['paymentType', 'payment_method', 'type']
  const byId = new Map()

  for (const fieldPath of fieldPaths) {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shops/${shopId}:runQuery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'sales' }],
            where: {
              fieldFilter: {
                field: { fieldPath },
                op: 'EQUAL',
                value: { stringValue: 'debt' }
              }
            }
          }
        })
      }
    )
    const json = await res.json()
    if (!Array.isArray(json)) {
      // Missing index or permission — surface and continue other fields
      console.warn(`Query shops/${shopId}/sales where ${fieldPath}==debt failed:`, JSON.stringify(json))
      continue
    }
    for (const row of json) {
      if (!row.document) continue
      const obj = docToObject(row.document)
      byId.set(obj.id, obj)
    }
  }

  // Also catch legacy "nasiya" string if any
  for (const fieldPath of fieldPaths) {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shops/${shopId}:runQuery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'sales' }],
            where: {
              fieldFilter: {
                field: { fieldPath },
                op: 'EQUAL',
                value: { stringValue: 'nasiya' }
              }
            }
          }
        })
      }
    )
    const json = await res.json()
    if (!Array.isArray(json)) continue
    for (const row of json) {
      if (!row.document) continue
      const obj = docToObject(row.document)
      byId.set(obj.id, obj)
    }
  }

  return [...byId.values()]
}

function formatCreatedAt(v) {
  if (!v) return null
  if (typeof v === 'string') return v
  return String(v)
}

function toReportRow(shopId, sale) {
  return {
    shopId,
    saleId: sale.id,
    customer: sale.customer ?? sale.customerName ?? null,
    phone: sale.phone ?? sale.customerPhone ?? null,
    total: sale.total ?? sale.amount ?? null,
    createdAt: formatCreatedAt(sale.createdAt),
    paymentType: sale.paymentType ?? sale.payment_method ?? sale.type ?? null,
    transactionNumber: sale.transactionNumber ?? sale.transaction_number ?? null
  }
}

async function main() {
  console.log('=== Phase 0: READ-ONLY debt sales audit ===')
  console.log('mode: READ-ONLY (no writes)')
  console.log('')

  const { token, uid } = await signIn()
  console.log('auth ok, uid:', uid)

  let shopIds = []
  if (allShops) {
    shopIds = await listShopIds(token)
    console.log('BARAKA_ALL_SHOPS=1 — shops visible:', shopIds.length)
  } else {
    shopIds = [process.env.BARAKA_SHOP_ID || uid]
  }

  const allRows = []
  for (const shopId of shopIds) {
    console.log('')
    console.log('--- shop:', shopId, '---')
    const sales = await queryDebtSales(token, shopId)
    const rows = sales.map(s => toReportRow(shopId, s))
    rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    console.log('debt/nasiya sales found:', rows.length)
    if (rows.length) {
      console.table(rows.map(r => ({
        saleId: r.saleId,
        customer: r.customer,
        phone: r.phone,
        total: r.total,
        createdAt: r.createdAt
      })))
    }
    allRows.push(...rows)
  }

  console.log('')
  console.log('=== SUMMARY ===')
  console.log('shops scanned:', shopIds.length)
  console.log('total debt sales:', allRows.length)
  const sumTotal = allRows.reduce((s, r) => s + (Number(r.total) || 0), 0)
  console.log('sum of totals:', sumTotal)
  console.log('')
  console.log('=== JSON ===')
  console.log(JSON.stringify({ shopsScanned: shopIds, count: allRows.length, sumTotal, rows: allRows }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
