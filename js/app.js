// =============================
// BARAKA POS MAIN ENGINE
// =============================

let currentShopId = null



// =============================
// AUTH STATE
// =============================

auth.onAuthStateChanged(user => {

    const loading = document.getElementById("loadingScreen")

    if(loading) loading.classList.add("hidden")

    if(user){

        currentShopId = user.uid

        document
            .getElementById("authScreen")
            .classList.add("hidden")

        document
            .getElementById("appScreen")
            .classList.remove("hidden")

        document
            .getElementById("shopTitle")
            .innerText = user.email

        loadProducts()

        loadDashboard()

        syncOfflineSales()

    }
    else{

        document
            .getElementById("appScreen")
            .classList.add("hidden")

        document
            .getElementById("authScreen")
            .classList.remove("hidden")

    }

})
// =============================
// DASHBOARD
// =============================

async function loadDashboard(){

    const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")

    const snapshot = await salesRef.get()

    let today = 0
    let week = 0
    let month = 0

    const now = new Date()

    const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    )

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())

    const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    )



    snapshot.forEach(doc => {

        const sale = doc.data()

        const date = new Date(
            sale.createdAt.seconds * 1000
        )

        if(date >= todayStart){

            today += sale.total

        }

        if(date >= weekStart){

            week += sale.total

        }

        if(date >= monthStart){

            month += sale.total

        }

    })



    document
        .getElementById("todaySales")
        .innerText = formatMoney(today)

    document
        .getElementById("weekSales")
        .innerText = formatMoney(week)

    document
        .getElementById("monthSales")
        .innerText = formatMoney(month)
}   // ← 

// ===============================
// SYNC OFFLINE SALES
// ===============================

async function syncOfflineSales(){

    if(!currentShopId) return

    const offline = JSON.parse(localStorage.getItem("offlineSales") || "[]")

    if(offline.length === 0) return

    const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")

    for(const sale of offline){

        await salesRef.add(sale)

    }

    localStorage.removeItem("offlineSales")

}
