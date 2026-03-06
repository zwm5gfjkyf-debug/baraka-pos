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

     const emailBox = document.getElementById("profileEmail")

if(emailBox){
    emailBox.innerText = user.email
}

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

    if(!currentShopId) return

    const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")

    const debtsRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("debts")

    const salesSnapshot = await salesRef.get()
    const debtsSnapshot = await debtsRef.get()

    let todayRevenue = 0
    let todayItems = 0
    let todayProfit = 0
    let todayDebt = 0

    const now = new Date()

    const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    )

    // SALES
    salesSnapshot.forEach(doc => {

        const sale = doc.data()

        const date = new Date(sale.createdAt.seconds * 1000)

        if(date >= todayStart){

            todayRevenue += sale.total

            if(sale.items){

                sale.items.forEach(item => {

                    const qty = item.qty || 0
                    const price = item.price || 0
                    const cost = item.cost || 0

                    todayItems += qty

                    todayProfit += (price - cost) * qty

                })

            }

        }

    })


    // NASIYA
    debtsSnapshot.forEach(doc => {

        const debt = doc.data()

        const date = new Date(debt.created)

        if(date >= todayStart){

            todayDebt += debt.total

        }

    })


    const revenueBox = document.getElementById("todayRevenue")
    const itemsBox = document.getElementById("todayItems")
    const profitBox = document.getElementById("todayProfit")
    const debtBox = document.getElementById("todayDebt")

    if(revenueBox) revenueBox.innerText = formatMoney(todayRevenue)
    if(itemsBox) itemsBox.innerText = todayItems
    if(profitBox) profitBox.innerText = formatMoney(todayProfit)
    if(debtBox) debtBox.innerText = formatMoney(todayDebt)

}

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
async function deleteAllShopData(){

    if(!currentShopId) return
    const confirmDelete = confirm("Hamma ma'lumotlar o'chiriladi. Ishonchingiz komilmi?")

    if(!confirmDelete) return

    const shopRef = db.collection("shops").doc(currentShopId)

    const collections = ["sales","debts","products"]

    for(const col of collections){

        const snapshot = await shopRef.collection(col).get()

        for(const doc of snapshot.docs){
            await doc.ref.delete()
        }

    }

    alert("Barcha ma'lumotlar o'chirildi")

}
