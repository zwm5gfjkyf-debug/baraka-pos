
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
let confirmCallback = null

function showConfirm(text, callback){

const modal = document.getElementById("confirmModal")
const textBox = document.getElementById("confirmText")
const okBtn = document.getElementById("confirmOkBtn")

textBox.innerText = text

confirmCallback = callback

okBtn.onclick = ()=>{
if(confirmCallback) confirmCallback()
closeConfirm()
}

modal.classList.remove("hidden")

}

function closeConfirm(){

document
.getElementById("confirmModal")
.classList.add("hidden")

}
