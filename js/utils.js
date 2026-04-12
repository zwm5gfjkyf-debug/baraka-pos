/* =========================================
   UTILS
========================================= */

/* ===============================
FORMAT MONEY
=============================== */

function formatMoney(value){
  if (!value || isNaN(value)) return '0 so\'m';
  return Math.round(value).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}

function formatPercent(value){
  if (value >= 0) return `+${Math.round(value)}% kechagidan`;
  return `−${Math.round(Math.abs(value))}% kechagidan`;
}

function formatTime(timestamp){
  if (!timestamp) return '--:--';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(){
  const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
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
