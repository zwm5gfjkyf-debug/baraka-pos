
/* =========================================
   UI FUNCTIONS
========================================= */

function toggleProfileMenu(){

    const menu = document.getElementById("profileMenu")

    menu.classList.toggle("hidden")

}

function showSuccess(message){

  const overlay = document.getElementById("successOverlay");
  const text = document.getElementById("successText");

  if(!overlay || !text) return;

  text.innerText = message;

  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1500);
}
