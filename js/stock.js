// ===============================
// BARAKA POS INVENTORY SYSTEM
// ===============================

let productsListener = null;


// ===============================
// ADD PRODUCT
// ===============================

async function addStock(){

    const name = document.getElementById("stockName").value.trim();
    const qty = Number(document.getElementById("stockQty").value);
    const cost = Number(document.getElementById("stockCost").value);
    const price = Number(document.getElementById("stockSellingPrice").value);

    if(!name || !price){
        alert("Mahsulot nomi va narx kerak");
        return;
    }

    await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .add({
            name: name,
            stock: qty || 0,
            cost: cost || 0,
            price: price,
            created: Date.now()
        });

    document.getElementById("stockName").value = "";
    document.getElementById("stockQty").value = "";
    document.getElementById("stockCost").value = "";
    document.getElementById("stockSellingPrice").value = "";

}


// ===============================
// LOAD PRODUCTS (REALTIME)
// ===============================

function loadCurrentStock(){

    if(productsListener) productsListener();

    productsListener = db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .onSnapshot(snapshot => {

            const container = document.getElementById("currentStockList");

            container.innerHTML = "";

            snapshot.forEach(doc => {

                const p = doc.data();

                const div = document.createElement("div");

                div.className = "stock-item";

                div.innerHTML = `

                <input
                value="${p.name}"
                onchange="editProduct('${doc.id}','name',this.value)"
                >

                <input
                type="number"
                value="${p.stock || 0}"
                onchange="editProduct('${doc.id}','stock',this.value)"
                >

                <input
                type="number"
                value="${p.cost || 0}"
                onchange="editProduct('${doc.id}','cost',this.value)"
                >

                <input
                type="number"
                value="${p.price || 0}"
                onchange="editProduct('${doc.id}','price',this.value)"
                >

                <button onclick="deleteProduct('${doc.id}')">
                O'chirish
                </button>

                `;

                container.appendChild(div);

            });

        });

}


// ===============================
// EDIT PRODUCT
// ===============================

async function editProduct(id, field, value){

    if(field !== "name"){
        value = Number(value);
    }

    await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .doc(id)
        .update({
            [field]: value
        });

}


// ===============================
// DELETE PRODUCT
// ===============================

async function deleteProduct(id){

    if(!confirm("Mahsulotni o'chirishni xohlaysizmi?")) return;

    await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .doc(id)
        .delete();

}
