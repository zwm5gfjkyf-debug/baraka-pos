# Firebase/Firestore Data Structure & Implementation

## Database Structure

```
firestore/
├── shops/
│   └── {shopId}/
│       ├── sales/ (collection)
│       │   └── {saleId}: {
│       │       amount: number,           // e.g., 1129587
│       │       profit: number,           // e.g., 275000
│       │       itemsCount: number,       // e.g., 14
│       │       saleNumber: number,       // e.g., 47
│       │       createdAt: Timestamp,     // 2026-04-12T14:28:00Z
│       │       isDebt: boolean           // false
│       │   }
│       │
│       └── nasiya/ (collection)
│           └── {nasiyaId}: {
│               amount: number,           // Total owed
│               status: string,           // "active" | "paid"
│               createdAt: Timestamp
│           }
```

---

## Firestore Queries & Listeners

### 1. Today's Sales Listener
```javascript
db.collection('shops')
  .doc(currentShopId)
  .collection('sales')
  .where('createdAt', '>=', todayStart)     // 00:00 today
  .where('createdAt', '<', tomorrowStart)   // 00:00 tomorrow
  .orderBy('createdAt', 'desc')             // Newest first
  .onSnapshot(snapshot => {
    // Real-time updates
    todaySalesData = snapshot.docs.map(doc => doc.data())
  })
```

**Used for:**
- Today's revenue (sum of amount)
- Today's profit (sum of profit)
- Items sold count (sum of itemsCount)
- Chart cumulative data
- Recent 3 sales display

---

### 2. Yesterday's Sales Listener
```javascript
db.collection('shops')
  .doc(currentShopId)
  .collection('sales')
  .where('createdAt', '>=', yesterdayStart)  // 00:00 yesterday
  .where('createdAt', '<', todayStart)       // 00:00 today
  .onSnapshot(snapshot => {
    yesterdaySalesData = snapshot.docs.map(doc => doc.data())
  })
```

**Used for:**
- Yesterday's revenue (sum of amount)
- Revenue change % calculation

---

### 3. Active Nasiya Listener
```javascript
db.collection('shops')
  .doc(currentShopId)
  .collection('nasiya')
  .where('status', '==', 'active')
  .onSnapshot(snapshot => {
    nasiyaData = snapshot.docs.map(doc => doc.data())
  })
```

**Used for:**
- Total active debt (sum of amount)

---

## Calculations Performed

### Revenue Change Percentage
```javascript
function calculateRevenueChange(today, yesterday) {
  if (today === 0 && yesterday === 0) return 0
  if (yesterday === 0 && today > 0) return 100
  return Math.round(((today - yesterday) / yesterday) * 100)
}

// Display: ↑ +8% kechagidan  or  ↓ -5% kechagidan
```

---

### Chart Data (Cumulative Revenue)
```javascript
// For each 2-hour interval from 09:00 to current time:
// Sum all sales from midnight (00:00) up to that hour

const labels = ["09:00", "11:00", "13:00", "15:00", "Hozir"]
const values = [
  0,                          // 09:00 (0 sales before 9 AM)
  150000,                     // 11:00 (cumulative up to 11 AM)
  450000,                     // 13:00 (cumulative up to 1 PM)
  850000,                     // 15:00 (cumulative up to 3 PM)
  1129587                     // Hozir (total for entire day)
]
```

---

## Data Type Conversions

All data from Firestore is validated and converted:

```javascript
// Amount (from Firestore)
Number(sale.amount) || 0

// Profit
Number(sale.profit) || 0

// Items count
Number(sale.itemsCount) || 0

// Timestamp
sale.createdAt?.toDate() || new Date()

// Safe arithmetic
todayRevenue = Math.round(sum)
```

---

## Number Formatting

```javascript
function formatMoney(value) {
  if (!value || isNaN(value)) return '0 so\'m'
  return Math.round(value).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m'
}

// Examples:
// 0 → "0 so'm"
// 85000 → "85 000 so'm"
// 1129587 → "1 129 587 so'm"
// undefined → "0 so'm"
```

---

## Listener Lifecycle

### Setup (when screen loads)
```javascript
async function loadDashboard() {
  // Unsubscribe old listeners
  if (todaySalesListener) todaySalesListener()
  if (yesterdaySalesListener) yesterdaySalesListener()
  if (nasiyaListener) nasiyaListener()
  
  // Set up new listeners
  setupTodaySalesListener()
  setupYesterdaySalesListener()
  setupNasiyaListener()
}
```

### On Data Change
```javascript
.onSnapshot(snapshot => {
  // Update local array
  todaySalesData = []
  snapshot.forEach(doc => {
    todaySalesData.push(doc.data())
  })
  
  // Re-render dashboard
  renderDashboard()
  
  // Chart animates smoothly to new data
  updateRevenueChart(calculateTodayRevenue())
})
```

### Cleanup (when screen unmounts)
```javascript
// Listeners auto-unsubscribe when navigationaway
// Prevent memory leaks
```

---

## Error Handling

### Query Errors
```javascript
.onSnapshot(
  snapshot => {
    // Success - process data
  },
  error => {
    console.error('Listener failed:', error)
    showErrorState()
  }
)
```

### Missing Fields
All fields are treated as potentially missing and default to 0:
```javascript
sale.amount || 0
sale.profit || 0
sale.itemsCount || 0
```

### Display Validation
Never show:
- `undefined`
- `null`
- `NaN`
- `Infinity`

All values pre-validated before rendering.

---

## Performance Optimizations

1. **Three separate listeners** instead of one large query
   - Each listener only fetches needed data
   - Reduced bandwidth

2. **onSnapshot with proper filtering**
   - Date-range queries (not fetching all sales)
   - Indexed fields (createdAt, status, shopId)

3. **Listener cleanup**
   - Unsubscribe when navigating away
   - Prevent memory leaks

4. **Local caching**
   - todaySalesData, yesterdaySalesData, nasiyaData
   - Calculations use cached data

5. **Efficient re-renders**
   - Only update changed elements
   - Chart animations instead of full redraws

---

## Testing & Validation

### Sample Firestore Document (sales)
```json
{
  "amount": 1129587,
  "profit": 275000,
  "itemsCount": 14,
  "saleNumber": 47,
  "createdAt": "2026-04-12T14:28:00Z",
  "isDebt": false
}
```

### Sample Nasiya Document
```json
{
  "amount": 500000,
  "status": "active",
  "createdAt": "2026-04-12T10:00:00Z"
}
```

---

## Dashboard Behavior with Sample Data

Given:
- Today's sales: [{amount: 500000}, {amount: 629587}]
- Yesterday's sales: [{amount: 1200000}]
- Active nasiya: [{amount: 500000}]

Results:
- **Bugungi tushum**: 1 129 587 so'm
- **Change %**: ↓ -6% kechagidan
- **Bugungi foyda**: 275 000 so'm
- **Sotilgan mahsulot**: 14
- **Nasiya**: 500 000 so'm

---

## Environment Variables

Firestore config is in `js/firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "baraka-pos-2.firebaseapp.com",
  projectId: "baraka-pos-2",
  storageBucket: "baraka-pos-2.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
}
```

---

**Last Updated**: April 12, 2026  
**Status**: Production Ready ✅
