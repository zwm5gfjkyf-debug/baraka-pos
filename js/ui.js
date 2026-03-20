/* =========================================
   UI FUNCTIONS
========================================= */

function toggleProfileMenu(){

    const menu = document.getElementById("profileMenu")

    if(menu){
        menu.classList.toggle("hidden")
    }

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

function updateChartsTheme(){

if(typeof todayChart !== "undefined" && todayChart){
todayChart.destroy()
}

if(typeof weeklyChart !== "undefined" && weeklyChart){
weeklyChart.destroy()
}

if(typeof monthlyChart !== "undefined" && monthlyChart){
monthlyChart.destroy()
}

if(typeof loadDashboard === "function"){
loadDashboard()
}

if(typeof loadWeeklyAnalytics === "function"){
loadWeeklyAnalytics()
}

if(typeof loadMonthlyAnalytics === "function"){
loadMonthlyAnalytics()
}

}
// Restore saved theme
const savedTheme = localStorage.getItem("theme")

if(savedTheme === "light"){
document.body.classList.add("light-mode")
}
function toggleTheme(){

document.body.classList.toggle("light-mode")

if(document.body.classList.contains("light-mode")){
localStorage.setItem("theme","light")
}else{
localStorage.setItem("theme","dark")
}

updateChartsTheme()

}
function showTopBanner(message, type = "success"){

  const banner = document.getElementById("topBanner")
  const text = document.getElementById("bannerMessage")
  const icon = document.getElementById("bannerIcon")

  if(!banner || !text || !icon) return

  // set text
  text.innerText = message

  // reset classes
  banner.classList.remove("success","error")

  // set type
  if(type === "success"){
    banner.classList.add("success")
    icon.innerText = "✔"
  }else{
    banner.classList.add("error")
    icon.innerText = "✖"
  }

  // show instantly
  banner.classList.add("show")

  // auto hide (FAST)
  clearTimeout(window.bannerTimeout)
  window.bannerTimeout = setTimeout(()=>{
    banner.classList.remove("show")
  },1800) // ⚡ faster
}
document.addEventListener("DOMContentLoaded", ()=>{
  const banner = document.getElementById("topBanner")
  if(banner){
    banner.style.transition = "all 0.2s ease"
  }
})
