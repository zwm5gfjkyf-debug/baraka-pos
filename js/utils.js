/* =========================================
   UTILS
========================================= */

/* ===============================
FORMAT MONEY
=============================== */

function formatMoney(num){
return Number(num || 0).toLocaleString("ru-RU") + " so'm"
}

/* ===============================
ANIMATE NUMBER
=============================== */

function animateNumber(el,value,duration=800){

if(!el) return

let start = 0

const step = Math.max(1, Math.ceil(Math.abs(value)/80))
const interval = setInterval(()=>{

start += step

if(start >= value){

start = value
clearInterval(interval)

}

el.innerText = formatMoney(start)

}, duration/60)

}

/* ===============================
SAFE USER ID
=============================== */

function safeGetUserId(){

return auth.currentUser ? auth.currentUser.uid : null

}

/* ===============================
START OF TODAY
=============================== */

function getStartOfToday(){

const d = new Date()
d.setHours(0,0,0,0)

return d

}

/* ===============================
START OF WEEK
=============================== */

function getStartOfWeek(){

const d = new Date()

const day = d.getDay() || 7

if(day !== 1){
d.setDate(d.getDate() - (day - 1))
}

d.setHours(0,0,0,0)

return d

}

/* ===============================
START OF MONTH
=============================== */

function getStartOfMonth(){

const d = new Date()

d.setDate(1)
d.setHours(0,0,0,0)

return d

}
/* ===============================
FORMAT NUMBER INPUT (LIVE)
=============================== */

function formatNumberInput(input){

if(!input) return

// remove all non-numbers
let value = input.value.replace(/\D/g, "")

// convert to number
let number = Number(value)

// if empty → clear
if(!value){
input.value = ""
return
}

// format with spaces (RU style)
input.value = number.toLocaleString("ru-RU")

}
/* ===============================
USD RATE (LIVE)
=============================== */

let usdRate = 12500 // fallback

async function loadUsdRate(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD")
    const data = await res.json()

    if(data && data.rates && data.rates.UZS){
      usdRate = data.rates.UZS
      console.log("USD RATE:", usdRate)
    }

  }catch(e){
    console.warn("USD rate failed, using fallback:", usdRate)
  }
}
/* ===============================
CONVERT USD → UZS
=============================== */

function convertUsdToUzs(amount){
  return Math.round(amount * usdRate)
}
