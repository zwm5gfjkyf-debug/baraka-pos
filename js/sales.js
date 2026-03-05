// ===============================
// BARAKA POS SALES ENGINE
// ===============================

let products = [];
let cart = [];

// ===============================
// LOAD PRODUCTS
// ===============================

async function loadProducts() {

    if (!currentShopId) return;

    const snapshot = await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .get();

    products = [];

    snapshot.forEach(doc => {

        const data = doc.data();

        products.push({
            id: doc.id,
            name: data.name,
            price: data.price,
            cost: data.cost,
            stock: data.stock
        });

    });

}

// ===============================
// SEARCH PRODUCTS
// ===============================

function searchProducts(text) {

    const results = document.getElementById("searchResults");

    results.innerHTML = "";

    if (!text) return;

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

        div.onclick = () => addToCart(product);

        results.appendChild(div);

    });

}

// ===============================
// ADD PRODUCT TO CART
// ===============================

function addToCart(product) {

    const existing = cart.find(i => i.id === product.id);

    if (existing) {

        existing.qty++;

    } else {

        cart.push({
            ...product,
            qty: 1
        });

    }

    renderCart();

}

// ===============================
// CART UI
// ===============================

function renderCart() {

    const list = document.getElementById("cartList");

    list.innerHTML = "";

    let total = 0;

    cart.forEach(item => {

        const itemTotal = item.price * item.qty;

        total += itemTotal;

        const div = document.createElement("div");

        div.className = "cart-item";

        div.innerHTML = `

        <b>${item.name}</b>

        <div>

            <button onclick="decreaseQty('${item.id}')">-</button>

            ${item.qty}

            <button onclick="increaseQty('${item.id}')">+</button>

        </div>

        <span>${itemTotal} so'm</span>

        `;

        list.appendChild(div);

    });

    document.getElementById("saleTotal").innerText = total;

}

// ===============================
// QTY CONTROLS
// ===============================

function increaseQty(id) {

    const item = cart.find(i => i.id === id);

    item.qty++;

    renderCart();

}

function decreaseQty(id) {

    const item = cart.find(i => i.id === id);

    item.qty--;

    if (item.qty <= 0) {

        cart = cart.filter(i => i.id !== id);

    }

    renderCart();

}

// ===============================
// COMPLETE SALE
// ===============================

async function completeSale() {

    if (cart.length === 0) return;

    let total = 0;

    cart.forEach(i => total += i.price * i.qty);

    const sale = {

        items: cart,
        total: total,
        created: Date.now()

    };

    await db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")
        .add(sale);

    for (const item of cart) {

        const ref = db
            .collection("shops")
            .doc(currentShopId)
            .collection("products")
            .doc(item.id);

        await db.runTransaction(async t => {

            const doc = await t.get(ref);

            const stock = doc.data().stock || 0;

            t.update(ref, {
                stock: stock - item.qty
            });

        });

    }

    cart = [];

    renderCart();

    showSuccess("Sotuv yakunlandi");

}
