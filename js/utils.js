
/* =========================================
   UTILS
========================================= */

function formatMoney(num) {
  return Number(num || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}
function animateNumber(el,value,duration=800){

let start=0

const step=Math.ceil(value/60)

const interval=setInterval(()=>{

start+=step

if(start>=value){
start=value
clearInterval(interval)
}

el.innerText=formatMoney(start)

},duration/60)

}
function formatMoney(num){

    return Number(num)
        .toLocaleString("ru-RU")
        .replace(/,/g," ")

}

function safeGetUserId() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

function getStartOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  if(day !== 1) {
    d.setDate(d.getDate() - (day - 1));
  }
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}
Is this correct for util.js
