/**
 * One-time READ-ONLY helper: list specific products by artikul + scan orders/sales refs.
 * Usage:
 *   BARAKA_EMAIL=... BARAKA_PASSWORD=... node scripts/list-test-products.mjs
 * Optional:
 *   BARAKA_SHOP_ID=... (defaults to signed-in uid)
 *   BARAKA_DELETE=1   (only deletes the exact matched product ids after listing — off by default)
 */
const API_KEY = 'AIzaSyBzs6n66fLSWBhobX-GOnROx-QvR8eH9gU'
const PROJECT = 'baraka-pos-2'
const TARGET_ARTIKULS = ['ART-352981', 'ART-704258', 'ART-331911']

const email = process.env.BARAKA_EMAIL
const password = process.env.BARAKA_PASSWORD
const doDelete = process.env.BARAKA_DELETE === '1'

if (!email || !password) {
  console.error('Set BARAKA_EMAIL and BARAKA_PASSWORD')
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
  return { id, path: doc.name, ...data }
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

async function runQuery(token, structuredQuery) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery })
    }
  )
  const json = await res.json()
  if (!Array.isArray(json)) {
    throw new Error('runQuery failed: ' + JSON.stringify(json))
  }
  return json.filter(r => r.document).map(r => docToObject(r.document))
}

async function listCollection(token, shopId, collectionId, pageSize = 300) {
  const docs = []
  let pageToken = ''
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shops/${shopId}/${collectionId}`
    )
    url.searchParams.set('pageSize', String(pageSize))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    if (json.error) throw new Error(JSON.stringify(json.error))
    for (const doc of json.documents || []) docs.push(docToObject(doc))
    pageToken = json.nextPageToken || ''
  } while (pageToken)
  return docs
}

async function deleteDoc(token, shopId, productId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shops/${shopId}/products/${productId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Delete ${productId} failed: ${res.status} ${text}`)
  }
}

async function main() {
  const { token, uid } = await signIn()
  const shopId = process.env.BARAKA_SHOP_ID || uid
  console.log('=== AUTH OK ===')
  console.log('uid / shopId:', shopId)
  console.log('mode:', doDelete ? 'DELETE ENABLED' : 'READ-ONLY (no deletes)')
  console.log('')

  const products = []
  for (const artikul of TARGET_ARTIKULS) {
    // Parent must be the shop doc; collectionId selects products under it.
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
            from: [{ collectionId: 'products' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'artikul' },
                op: 'EQUAL',
                value: { stringValue: artikul }
              }
            }
          }
        })
      }
    )
    const json = await res.json()
    if (!Array.isArray(json)) {
      throw new Error(`Query ${artikul} failed: ` + JSON.stringify(json))
    }
    const rows = json.filter(r => r.document).map(r => docToObject(r.document))
    products.push(...rows.map(r => ({ queriedArtikul: artikul, ...r })))
  }

  console.log('=== MATCHED PRODUCTS (by artikul) ===')
  console.log('count:', products.length)
  console.log(JSON.stringify(products, null, 2))
  console.log('')

  // Sanity: also find by name lowercase in case artikul mismatches
  const allProducts = await listCollection(token, shopId, 'products')
  const byName = allProducts.filter(p => {
    const n = String(p.name || '').toLowerCase()
    return n === 'ruchka' || n === 'damas' || n === 'motor'
  })
  console.log('=== NAME FALLBACK (ruchka/damas/motor) ===')
  console.log('count:', byName.length)
  console.log(JSON.stringify(byName.map(p => ({
    id: p.id, name: p.name, artikul: p.artikul, quantity: p.quantity, buyPrice: p.buyPrice, sellPrice: p.sellPrice
  })), null, 2))
  console.log('')

  const targetIds = new Set(products.map(p => p.id))
  if (targetIds.size === 0) {
    console.log('No products matched by artikul — stopping before any delete.')
    return
  }

  const orders = await listCollection(token, shopId, 'orders')
  const orderHits = []
  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : []
    const hits = items.filter(it => it && targetIds.has(it.productId))
    if (hits.length) {
      orderHits.push({
        orderId: order.id,
        title: order.title,
        status: order.status,
        matchingItems: hits.map(it => ({
          productId: it.productId,
          name: it.name,
          artikul: it.artikul,
          orderQty: it.orderQty
        }))
      })
    }
  }
  console.log('=== ORDERS REFERENCING THESE PRODUCT IDS (flag only) ===')
  console.log('orders scanned:', orders.length)
  console.log('orders with refs:', orderHits.length)
  console.log(JSON.stringify(orderHits, null, 2))
  console.log('')

  const sales = await listCollection(token, shopId, 'sales')
  const saleHits = []
  for (const sale of sales) {
    const items = Array.isArray(sale.items) ? sale.items : []
    const hits = items.filter(it => {
      if (!it) return false
      if (it.productId && targetIds.has(it.productId)) return true
      if (it.id && targetIds.has(it.id)) return true
      const art = String(it.artikul || '')
      return TARGET_ARTIKULS.includes(art)
    })
    if (hits.length) {
      saleHits.push({
        saleId: sale.id,
        saleNumberLabel: sale.saleNumberLabel || sale.saleNumber || null,
        createdAt: sale.createdAt || null,
        matchingItems: hits.map(it => ({
          productId: it.productId || it.id || null,
          name: it.name,
          artikul: it.artikul,
          qty: it.qty || it.quantity
        }))
      })
    }
  }
  console.log('=== SALES REFERENCING THESE PRODUCTS (flag only) ===')
  console.log('sales scanned:', sales.length)
  console.log('sales with refs:', saleHits.length)
  console.log(JSON.stringify(saleHits, null, 2))
  console.log('')

  if (!doDelete) {
    console.log('STOPPING after listing. Re-run with BARAKA_DELETE=1 only after you confirm the product list.')
    return
  }

  console.log('=== DELETING EXACT PRODUCT DOCS ===')
  for (const p of products) {
    console.log('Deleting', p.id, p.name, p.artikul)
    await deleteDoc(token, shopId, p.id)
    console.log('  deleted OK')
  }
  console.log('Done. Deleted', products.length, 'documents.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
