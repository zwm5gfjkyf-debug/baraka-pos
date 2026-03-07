
// ===============================
// BARAKA POS DEBT SYSTEM
// ===============================

let debtCart = []
let debtProcessing = false
let debtPaymentProcessing = false
let lastClick = 0
// ===============================
// SEARCH PRODUCTS FOR DEBT
// ===============================

function searchDebtProducts(text){

    const results = document.getElementById("debtSearchResults");

    results.innerHTML = "";

    if(!text) return;

    const query = text.toLowerCase();

  const filtered = productCache.filter(p =>
        p.name.toLowerCase().includes(query)
    );

    filtered.slice(0,10).forEach(product => {

        const div = document.createElement("div");

        div.className = "search-item";

        div.innerHTML = `
            <b>${product.name}</b>
            <span>${product.price} so'm</span>
        `;

        div.onclick = () => addDebtToCart(product);

        results.appendChild(div);

    });

}

// ===============================
// ADD PRODUCT TO DEBT CART
// ===============================



function addDebtToCart(product){

    const now = Date.now()

    if(now - lastClick < 300) return

    lastClick = now

    // STOCK CHECK
    if(product.stock <= 0){
    showToast("Zaxirada qolmadi")
        return
    }

    const existing = debtCart.find(i => i.id === product.id)

    if(existing){

        if(existing.qty + 1 > product.stock){
   showToast("Zaxirada yetarli mahsulot yo'q")
            return
        }

        existing.qty++

    }else{

        debtCart.push({
            ...product,
            qty:1
        })

    }

    renderDebtCart()
}


// ===============================
// RENDER DEBT CART
// ===============================

function renderDebtCart(){

    const list = document.getElementById("debtCartList");

    list.innerHTML = "";

    debtCart.forEach(item => {

        const total = item.price * item.qty;

        const div = document.createElement("div");

        div.className = "cart-item";

        div.innerHTML = `

        <b>${item.name}</b>

     <div>

<button onclick="decreaseDebtQty('${item.id}')">-</button>

${item.qty}

<button onclick="increaseDebtQty('${item.id}')">+</button>

</div>

<input
type="number"
value="${item.price}"
class="price-input"
onchange="changeDebtPrice('${item.id}',this.value)"
>

<strong>${formatMoney(total)}</strong>

        `;

        list.appendChild(div);

    });

}


// ===============================
// QTY CONTROLS
// ===============================

function increaseDebtQty(id){

    const item = debtCart.find(i => i.id === id)

    const product = productCache.find(p => p.id === id)

    if(!product){
    showToast("Mahsulot topilmadi")
        return
    }

   if(item.qty + 1 > product.stock){
    showToast("Zaxirada yetarli mahsulot yo'q")
    return
}

    item.qty++

    renderDebtCart()

}
function decreaseDebtQty(id){

    const item = debtCart.find(i => i.id === id);

    item.qty--;

    if(item.qty <= 0){

        debtCart = debtCart.filter(i => i.id !== id);

    }

    renderDebtCart();

}


// ===============================
// COMPLETE DEBT SALE
// ===============================

async function completeDebtSale(){

    if(debtProcessing) return
    debtProcessing = true

    const btn = document.getElementById("debtCompleteBtn")
    btn.innerText = "Berilyapti..."
    btn.disabled = true
    try{
    const customer = document
        .getElementById("debtCustomerName")
        .value
        .trim();

   if(!customer){
    showToast("Mijoz ismini kiriting")
    debtProcessing = false
    btn.innerText = "Nasiya berish"
    btn.disabled = false
    return
}

   if(debtCart.length === 0){
    showToast("Mahsulot tanlang")

    debtProcessing = false
    btn.innerText = "Nasiya berish"
    btn.disabled = false

    return
}
   let total = 0;
let profit = 0;

debtCart.forEach(i => {

total += i.price * i.qty

profit += (i.price - i.cost) * i.qty

})

    const debtsRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("debts");

    const existing = await debtsRef
        .where("customer","==",customer)
        .where("status","in",["unpaid","partial"])
        .get();

    if(existing.empty){

        await debtsRef.add({
customer: customer,
items: debtCart,
total: total,
remaining: total,
profit: profit,
status: "unpaid",
created: Date.now()
});

    }else{

        const doc = existing.docs[0];

        const data = doc.data();

        await doc.ref.update({

            items: [...data.items, ...debtCart],
            total: data.total + total,
            remaining: data.remaining + total

        });

    }

    // UPDATE STOCK

 for(const item of debtCart){

    const ref = db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .doc(item.id);

   await db.runTransaction(async t => {

    const doc = await t.get(ref);

    const stock = doc.data().stock || 0;

  if(stock < item.qty){
    showToast("Zaxirada yetarli mahsulot yo'q")
    throw new Error("Not enough stock")
}

    t.update(ref,{
        stock: stock - item.qty
    });

});

    const p = productCache.find(p => p.id === item.id)
    if(p){
        p.stock -= item.qty
    }

}

// CLEAR CART
  debtCart = []
    renderDebtCart()

    showSuccess("Nasiya saqlandi")
btn.innerText = "Nasiya berish"
btn.disabled = false
 }
finally{
    debtProcessing = false
}
}


// ===============================
// LOAD DEBT CUSTOMERS
// ===============================

function loadDebtCustomers(){

    if(!currentShopId) return

    db.collection("shops")
    .doc(currentShopId)
    .collection("debts")
    .onSnapshot(snapshot => {

        const container = document.getElementById("debtCustomersList")

        // CLEAR OLD UI
        container.innerHTML = ""

        snapshot.forEach(doc => {

            const d = doc.data()

            const div = document.createElement("div")

            div.className = "debt-item"

            div.innerHTML = `

            <b>${d.customer}</b>

            <div>
           Qolgan: ${formatMoney(d.remaining)}
            </div>

            <input
            type="number"
            id="pay_${doc.id}"
            placeholder="To'lov"
            >

          <button onclick="payDebt('${doc.id}', this)">
To'lash
</button>

            `

            container.appendChild(div)

        })

    })

}


// ===============================
// PAY DEBT
// ===============================

async function payDebt(id, btn){

    if(debtPaymentProcessing) return
    debtPaymentProcessing = true

    btn.innerText = "To'lanmoqda..."
    btn.disabled = true

    try{

        const input = document.getElementById("pay_"+id)
        const amount = Number(input.value)

        if(!amount){
            showToast("To'lov summasini kiriting")
            return
        }

        const ref = db
            .collection("shops")
            .doc(currentShopId)
            .collection("debts")
            .doc(id)

        const doc = await ref.get()

        if(!doc.exists){
            showToast("Qarz topilmadi")
            return
        }

        const data = doc.data()

        // VALIDATION
        if(amount > data.remaining){
            showToast("To'lov qarzdan katta bo'lishi mumkin emas")
            return
        }
const profitRatio = data.profit / data.total
const profitPart = amount * profitRatio
        const newRemaining = data.remaining - amount

        // UPDATE DEBT
        if(newRemaining <= 0){
            await ref.delete()
        }else{
            await ref.update({
                remaining: newRemaining,
                status: "partial"
            })
        }

        // ADD PAYMENT TO SALES
        const salesRef = db
            .collection("shops")
            .doc(currentShopId)
            .collection("sales")

       await salesRef.add({
items: [{
name:"Debt payment",
price:amount,
cost:amount - profitPart,
qty:1
}],
total: amount,
createdAt: new Date(),
type: "debt_payment"
})

        showSuccess("To'lov qabul qilindi")

        input.value = ""

    }
    finally{

        debtPaymentProcessing = false
        btn.innerText = "To'lash"
        btn.disabled = false

    }

}

function changeDebtPrice(id,newPrice){

    const item = debtCart.find(i => i.id === id)

    item.price = Number(newPrice)

    renderDebtCart()

}
