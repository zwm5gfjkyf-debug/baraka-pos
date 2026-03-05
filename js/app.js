// ===============================
// BARAKA POS MAIN APP
// ===============================

let currentUser = null;
let currentShopId = null;

// ===============================
// AUTH STATE
// ===============================

auth.onAuthStateChanged(async (user) => {

    const loading = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const appScreen = document.getElementById("appScreen");

    loading.style.display = "none";

    if (!user) {

        authScreen.classList.remove("hidden");
        appScreen.classList.add("hidden");

        return;
    }

    currentUser = user;

    currentShopId = user.uid;

    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    document.getElementById("shopTitle").innerText = user.email;

    // load products for POS
    if (typeof loadProducts === "function") {
        loadProducts();
    }

});
