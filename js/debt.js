
// ===============================
// BARAKA POS DEBT SYSTEM
// ===============================

let debtCart = [];

// ===============================
// SEARCH PRODUCTS FOR DEBT
// ===============================

function searchDebtProducts(text){

    const results = document.getElementById("debtSearchResults");

    results.innerHTML = "";

    if(!text) return;

    const query = text.toLowerCase();

    const filtered = products.filter(p =>
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

    const existing = debtCart.find(i => i.id === product.id);

    if(existing){

        existing.qty++;

    } else {

        debtCart.push({
            ...product,
            qty: 1
        });

    }

    renderDebtCart();

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

        <span>${total} so'm</span>

        `;

        list.appendChild(div);

    });

}


// ===============================
// QTY CONTROLS
// ===============================

function increaseDebtQty(id){

    const item = debtCart.find(i => i.id === id);

    item.qty++;

    renderDebtCart();

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

    const customer = document
        .getElementById("debtCustomerName")
        .value
        .trim();

    if(!customer){
        alert("Mijoz ismini kiriting");
        return;
    }

    if(debtCart.length === 0){
        alert("Mahsulot tanlang");
        return;
    }

    let total = 0;

    debtCart.forEach(i => total += i.price * i.qty);

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

            t.update(ref,{
                stock: stock - item.qty
            });

        });

    }

    debtCart = [];

    renderDebtCart();

    showSuccess("Nasiya saqlandi");

}


// ===============================
// LOAD DEBT CUSTOMERS
// ===============================

function loadDebtCustomers(){

    db.collection("shops")
    .doc(currentShopId)
    .collection("debts")
    .onSnapshot(snapshot => {

        const container = document.getElementById("debtCustomersList");

        container.innerHTML = "";

        snapshot.forEach(doc => {

            const d = doc.data();

            const div = document.createElement("div");

            div.className = "debt-item";

            div.innerHTML = `

            <b>${d.customer}</b>

            <div>
            Qolgan: ${d.remaining} so'm
            </div>

            <input
            type="number"
            id="pay_${doc.id}"
            placeholder="To'lov"
            >

            <button onclick="payDebt('${doc.id}')">
            To'lash
            </button>

            `;

            container.appendChild(div);

        });

    });

}


// ===============================
// PAY DEBT
// ===============================

async function payDebt(id){

    const input = document.getElementById("pay_"+id);

    const amount = Number(input.value);

    if(!amount) return;

    const ref = db
        .collection("shops")
        .doc(currentShopId)
        .collection("debts")
        .doc(id);

    const doc = await ref.get();

    const data = doc.data();

    const newRemaining = data.remaining - amount;

    if(newRemaining <= 0){

        await ref.delete();

    }else{

        await ref.update({

            remaining: newRemaining,
            status: "partial"

        });

    }

}
