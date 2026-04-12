// ===============================
// BARAKA POS DEBT ANALYTICS SYSTEM
// Real-time Firebase integration
// ===============================

let debtAnalyticsListener = null;
let currentDebtCustomers = [];
let filteredDebtCustomers = [];
let debtSortByNewest = false;

// ===============================
// UTILITY FUNCTIONS
// ===============================

function formatMoney(value) {
  if (!value || isNaN(value)) return '0 so\'m';
  return Math.round(value).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}

function formatMoneyShort(value) {
  if (!value || isNaN(value)) return '0';
  if (value >= 1000000) return (value/1000000).toFixed(1).replace('.0','') + ' mln';
  if (value >= 1000) return Math.round(value/1000) + ' 000';
  return Math.round(value).toString();
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun',
                  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const d = timestamp.toDate();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function normalizeCustomerId(name) {
  if (!name) return 'unknown_customer';
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function getTodayLabel() {
  const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun',
                  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ===============================
// DATA FETCHING & CALCULATIONS
// ===============================

async function loadDebtAnalytics() {
  if (!currentShopId) return;

  showDebtLoading();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Set up real-time listener
    if (debtAnalyticsListener) {
      debtAnalyticsListener();
    }

    debtAnalyticsListener = db.collection('nasiya')
      .where('shopId', '==', currentShopId)
      .where('status', '==', 'active')
      .onSnapshot(snapshot => {
        processDebtData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => {
        console.error('Debt analytics error:', error);
        showDebtError();
      });

  } catch (error) {
    console.error('Failed to load debt analytics:', error);
    showDebtError();
  }
}

function processDebtData(records) {
  // 1. Calculate remaining debt per record
  records.forEach(r => {
    r.remainingDebt = (r.amount || 0) - (r.paidAmount || 0);
  });

  // Remove fully paid ones
  const activeRecords = records.filter(r => r.remainingDebt > 0);

  // 2. Group by customer
  const customerMap = {};
  activeRecords.forEach(r => {
    const customerName = r.customerName || 'Noma\'lum mijoz';
    const id = r.customerId || normalizeCustomerId(customerName);
    if (!customerMap[id]) {
      customerMap[id] = {
        customerId: id,
        customerName: customerName,
        totalDebt: 0,
        latestNasiyaDate: r.createdAt,
        earliestDueDate: r.dueDate,
        records: []
      };
    }
    customerMap[id].totalDebt += r.remainingDebt;
    customerMap[id].records.push(r);
    // Track latest nasiya date
    if (r.createdAt?.toDate() > customerMap[id].latestNasiyaDate?.toDate()) {
      customerMap[id].latestNasiyaDate = r.createdAt;
    }
    // Track earliest due date (most urgent)
    if (r.dueDate?.toDate() < customerMap[id].earliestDueDate?.toDate()) {
      customerMap[id].earliestDueDate = r.dueDate;
    }
  });

  const customers = Object.values(customerMap);

  // 3. Calculate summary stats
  const totalDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);
  const customerCount = customers.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 4. Overdue customers
  const overdueCustomers = customers.filter(c => {
    const due = c.earliestDueDate?.toDate();
    return due && due < today;
  });
  const overdueCount = overdueCustomers.length;

  // 5. New this month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const newThisMonth = activeRecords.filter(r => {
    const created = r.createdAt?.toDate();
    return created && created >= thisMonthStart;
  });
  const newThisMonthCustomers = new Set(newThisMonth.map(r => r.customerId)).size;

  // 6. Largest single debt
  const largestDebt = customers.length > 0
    ? Math.max(...customers.map(c => c.totalDebt))
    : 0;

  // 7. Add days diff and status to customers
  customers.forEach(customer => {
    const due = customer.earliestDueDate?.toDate();
    if (due) {
      const diffMs = due - today;
      customer.daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
    } else {
      customer.daysDiff = null;
    }

    // Calculate days since created for "new" badge
    const created = customer.latestNasiyaDate?.toDate();
    if (created) {
      const createdDiffMs = today - created;
      customer.daysSinceCreated = Math.round(createdDiffMs / (1000 * 60 * 60 * 24));
    } else {
      customer.daysSinceCreated = null;
    }
  });

  // 8. Sort customers
  sortDebtCustomers(customers);

  // 9. Update UI
  hideDebtLoading();
  updateDebtSummary(totalDebt, customerCount, overdueCount, newThisMonthCustomers, largestDebt);
  renderDebtCustomers(customers, largestDebt);

  currentDebtCustomers = customers;
  filteredDebtCustomers = [...customers];
}

// ===============================
// SORTING & FILTERING
// ===============================

function sortDebtCustomers(customers) {
  customers.sort((a, b) => {
    const daysA = a.daysDiff ?? 999;
    const daysB = b.daysDiff ?? 999;

    // Overdue first
    if (daysA < 0 && daysB >= 0) return -1;
    if (daysB < 0 && daysA >= 0) return 1;
    if (daysA < 0 && daysB < 0) return daysA - daysB; // most overdue first

    // Then by debt amount (highest first)
    return b.totalDebt - a.totalDebt;
  });
}

function toggleDebtSort() {
  debtSortByNewest = !debtSortByNewest;
  const sortBtn = document.getElementById('debtSortBtn');

  if (debtSortByNewest) {
    // Sort by newest first
    filteredDebtCustomers.sort((a, b) => {
      const dateA = a.latestNasiyaDate?.toDate() || new Date(0);
      const dateB = b.latestNasiyaDate?.toDate() || new Date(0);
      return dateB - dateA;
    });
    sortBtn.textContent = 'Yangi';
  } else {
    // Sort by debt amount
    sortDebtCustomers(filteredDebtCustomers);
    sortBtn.textContent = 'Ko\'p qarz ↓';
  }

  renderDebtCustomers(filteredDebtCustomers, Math.max(...filteredDebtCustomers.map(c => c.totalDebt)));
}

function filterDebtCustomers() {
  const searchTerm = document.getElementById('debtSearchInput').value.toLowerCase().trim();

  if (!searchTerm) {
    filteredDebtCustomers = [...currentDebtCustomers];
  } else {
    filteredDebtCustomers = currentDebtCustomers.filter(customer =>
      (customer.customerName || '').toLowerCase().includes(searchTerm)
    );
  }

  // Re-apply current sort
  if (debtSortByNewest) {
    filteredDebtCustomers.sort((a, b) => {
      const dateA = a.latestNasiyaDate?.toDate() || new Date(0);
      const dateB = b.latestNasiyaDate?.toDate() || new Date(0);
      return dateB - dateA;
    });
  } else {
    sortDebtCustomers(filteredDebtCustomers);
  }

  renderDebtCustomers(filteredDebtCustomers, Math.max(...filteredDebtCustomers.map(c => c.totalDebt)));
}

// ===============================
// UI RENDERING
// ===============================

function updateDebtSummary(totalDebt, customerCount, overdueCount, newThisMonthCount, largestDebt) {
  document.getElementById('totalDebtAmount').textContent = formatMoneyShort(totalDebt) + ' so\'m';
  document.getElementById('totalDebtSubtitle').textContent = `${customerCount} ta mijoz · ${getTodayLabel()} holatiga`;
  document.getElementById('overdueCount').textContent = `${overdueCount} ta`;
  document.getElementById('newThisMonthCount').textContent = `${newThisMonthCount} ta`;
  document.getElementById('largestDebtAmount').textContent = formatMoneyShort(largestDebt);
  document.getElementById('customersTitle').textContent = `Mijozlar (${customerCount} ta)`;
}

function renderDebtCustomers(customers, largestDebt) {
  const container = document.getElementById('debtCustomersList');
  const emptyState = document.getElementById('debtEmptyState');

  if (customers.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = customers.map(customer => {
    const daysDiff = customer.daysDiff;
    const daysSinceCreated = customer.daysSinceCreated;

    // Determine status and styling
    let borderColor, avatarBg, avatarColor, debtColor, statusBadge;

    if (daysDiff < 0) {
      // Overdue
      borderColor = '#E53935';
      avatarBg = '#FFEBEE';
      avatarColor = '#C62828';
      debtColor = '#E53935';
      statusBadge = `${Math.abs(daysDiff)} kun muddati o'tgan`;
    } else if (daysDiff <= 7) {
      // Due within 7 days
      borderColor = '#FF9800';
      avatarBg = '#FFF3E0';
      avatarColor = '#E65100';
      debtColor = '#E65100';
      statusBadge = daysDiff === 0 ? 'Bugun muddati' : `${daysDiff} kun qoldi`;
    } else {
      // Safe
      borderColor = '#43A047';
      avatarBg = '#E8F5E9';
      avatarColor = '#2E7D32';
      debtColor = '#E65100'; // Orange for debt amount
      if (daysSinceCreated !== null && daysSinceCreated <= 7) {
        statusBadge = `Yangi · ${daysSinceCreated} kun oldin`;
      } else {
        statusBadge = 'Faol';
      }
    }

    const barWidth = largestDebt > 0 ? (customer.totalDebt / largestDebt) * 100 : 0;

    return `
      <div class="debt-customer-card" style="border-left-color: ${borderColor}">
        <div class="debt-customer-header">
          <div class="debt-customer-avatar" style="background-color: ${avatarBg}; color: ${avatarColor}">
            ${getInitials(customer.customerName)}
          </div>
          <div class="debt-customer-info">
            <div class="debt-customer-name">${customer.customerName || 'Noma\'lum mijoz'}</div>
            <div class="debt-customer-date">Oxirgi nasiya: ${formatDate(customer.latestNasiyaDate)}</div>
          </div>
          <div class="debt-customer-amount" style="color: ${debtColor}">
            ${formatMoneyShort(customer.totalDebt)}
            <div class="debt-customer-unit">so'm qarz</div>
          </div>
        </div>
        <div class="debt-customer-progress">
          <div class="debt-progress-bar">
            <div class="debt-progress-fill" style="width: ${barWidth}%; background-color: ${borderColor}"></div>
          </div>
        </div>
        <div class="debt-customer-footer">
          <div class="debt-customer-status" style="background-color: ${avatarBg}; color: ${avatarColor}">
            ${statusBadge}
          </div>
          <button class="debt-payment-btn" onclick="openPaymentModal('${customer.customerId}', '${customer.customerName}', ${customer.totalDebt})">
            To'lov qabul qilish →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ===============================
// MODAL FUNCTIONS
// ===============================

function openPaymentModal(customerId, customerName, totalDebt) {
  document.getElementById('paymentModalCustomer').textContent = customerName;
  document.getElementById('paymentModalDebt').textContent = formatMoney(totalDebt) + ' qarz';
  document.getElementById('paymentAmountInput').value = '';

  // Store current payment target
  window.currentPaymentTarget = { customerId, customerName, totalDebt };

  document.getElementById('debtPaymentModal').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('debtPaymentModal').classList.add('hidden');
  window.currentPaymentTarget = null;
}

function setQuickAmount(percentage) {
  if (!window.currentPaymentTarget) return;
  const amount = Math.round(window.currentPaymentTarget.totalDebt * percentage);
  document.getElementById('paymentAmountInput').value = amount;
}

async function submitDebtPayment() {
  if (!window.currentPaymentTarget) return;

  const amount = parseFloat(document.getElementById('paymentAmountInput').value);
  if (!amount || amount <= 0) {
    showTopBanner('To\'lov summasini kiriting', 'error');
    return;
  }

  if (amount > window.currentPaymentTarget.totalDebt) {
    showTopBanner('To\'lov summasi qarzdan oshib ketdi', 'error');
    return;
  }

  try {
    // Find the customer's records and distribute payment
    const customerRecords = currentDebtCustomers.find(c => c.customerId === window.currentPaymentTarget.customerId)?.records || [];

    let remainingPayment = amount;
    const updates = [];

    // Sort records by due date (earliest first)
    customerRecords.sort((a, b) => {
      const dateA = a.dueDate?.toDate() || new Date(9999, 0, 1);
      const dateB = b.dueDate?.toDate() || new Date(9999, 0, 1);
      return dateA - dateB;
    });

    for (const record of customerRecords) {
      if (remainingPayment <= 0) break;

      const recordRemaining = record.remainingDebt;
      const paymentForThisRecord = Math.min(remainingPayment, recordRemaining);

      updates.push({
        docId: record.id,
        incrementAmount: paymentForThisRecord,
        newPaidAmount: (record.paidAmount || 0) + paymentForThisRecord,
        shouldMarkPaid: ((record.paidAmount || 0) + paymentForThisRecord) >= record.amount
      });

      remainingPayment -= paymentForThisRecord;
    }

    // Execute updates
    for (const update of updates) {
      await db.collection('nasiya').doc(update.docId).update({
        paidAmount: firebase.firestore.FieldValue.increment(update.incrementAmount)
      });

      if (update.shouldMarkPaid) {
        await db.collection('nasiya').doc(update.docId).update({ status: 'paid' });
      }
    }

    // Log the payment
    await db.collection('nasiyaPayments').add({
      nasiyaId: updates[0]?.docId, // Use first record ID
      customerId: window.currentPaymentTarget.customerId,
      customerName: window.currentPaymentTarget.customerName,
      amount: amount,
      createdAt: firebase.firestore.Timestamp.now(),
      shopId: currentShopId
    });

    showTopBanner('To\'lov muvaffaqiyatli qabul qilindi', 'success');
    closePaymentModal();

  } catch (error) {
    console.error('Payment submission error:', error);
    showTopBanner('To\'lovda xato yuz berdi', 'error');
  }
}

function openNewDebtModal() {
  document.getElementById('newDebtCustomerName').value = '';
  document.getElementById('newDebtAmount').value = '';
  document.getElementById('newDebtDueDate').value = '';
  document.getElementById('debtNewModal').classList.remove('hidden');
}

function closeNewDebtModal() {
  document.getElementById('debtNewModal').classList.add('hidden');
}

async function submitNewDebt() {
  const customerName = document.getElementById('newDebtCustomerName').value.trim();
  const amount = parseFloat(document.getElementById('newDebtAmount').value);
  const dueDateValue = document.getElementById('newDebtDueDate').value;

  if (!customerName) {
    showTopBanner('Mijoz nomini kiriting', 'error');
    return;
  }

  if (!amount || amount <= 0) {
    showTopBanner('To\'g\'ri summa kiriting', 'error');
    return;
  }

  if (!dueDateValue) {
    showTopBanner('Muddati kiriting', 'error');
    return;
  }

  try {
    const customerId = normalizeCustomerId(customerName);
    const dueDate = firebase.firestore.Timestamp.fromDate(new Date(dueDateValue));

    await db.collection('nasiya').add({
      customerId: customerId,
      customerName: customerName,
      amount: amount,
      paidAmount: 0,
      dueDate: dueDate,
      createdAt: firebase.firestore.Timestamp.now(),
      status: 'active',
      shopId: currentShopId
    });

    showTopBanner('Yangi nasiya muvaffaqiyatli qo\'shildi', 'success');
    closeNewDebtModal();

  } catch (error) {
    console.error('New debt submission error:', error);
    showTopBanner('Nasiya qo\'shishda xato yuz berdi', 'error');
  }
}

// ===============================
// LOADING & ERROR STATES
// ===============================

function showDebtLoading() {
  document.getElementById('debtLoadingSkeleton').classList.remove('hidden');
  document.getElementById('debtCustomersList').innerHTML = '';
  document.getElementById('debtEmptyState').classList.add('hidden');
}

function hideDebtLoading() {
  document.getElementById('debtLoadingSkeleton').classList.add('hidden');
}

function showDebtError() {
  hideDebtLoading();
  // Could add error state UI here
  showTopBanner('Ma\'lumotlarni yuklashda xato', 'error');
}

// ===============================
// CLEANUP
// ===============================

function cleanupDebtAnalytics() {
  if (debtAnalyticsListener) {
    debtAnalyticsListener();
    debtAnalyticsListener = null;
  }
}