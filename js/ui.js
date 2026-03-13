/* =========================================
   UI FUNCTIONS
========================================= */

function toggleProfileMenu(){

    const menu = document.getElementById("profileMenu")

    if(menu){
        menu.classList.toggle("hidden")
    }

}

function showSuccess(message){

  const overlay = document.getElementById("successOverlay")
  const text = document.getElementById("successText")

  if(!overlay || !text) return

  text.innerText = message

  overlay.classList.remove("hidden")

  setTimeout(()=>{
    overlay.classList.add("hidden")
  },1500)

}


/* =========================================
   CONFIRM MODAL
========================================= */

let confirmCallback = null

function showConfirm(text, callback){

  const modal = document.getElementById("confirmModal")
  const textBox = document.getElementById("confirmText")
  const okBtn = document.getElementById("confirmOkBtn")

  if(!modal || !textBox || !okBtn) return

  textBox.innerText = text

  confirmCallback = callback

  okBtn.onclick = ()=>{
      if(confirmCallback) confirmCallback()
      closeConfirm()
  }

  modal.classList.remove("hidden")

}

function closeConfirm(){

  const modal = document.getElementById("confirmModal")

  if(modal){
    modal.classList.add("hidden")
  }

}
function showToast(message){

const overlay = document.getElementById("successOverlay")
const text = document.getElementById("successText")

if(!overlay || !text) return

text.innerText = message

overlay.classList.remove("hidden")

setTimeout(()=>{
overlay.classList.add("hidden")
},2000)

}

function updateChartsTheme(){

if(window.todayChart){
todayChart.destroy()
}

if(window.weeklyChart){
weeklyChart.destroy()
}

if(window.monthlyChart){
monthlyChart.destroy()
}

loadDashboard()
loadWeeklyAnalytics()
loadMonthlyAnalytics()

}
function toggleTheme(){

document.body.classList.toggle("light-mode")

updateChartsTheme()

}
