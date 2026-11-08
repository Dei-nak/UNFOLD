const months = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const parse = key => new Date(key+'T12:00:00');
const keyOf = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
function plusDays(key,offset){const date=parse(key);date.setDate(date.getDate()+offset);return keyOf(date);}
const weekStart = key => plusDays(key,-((parse(key).getDay()+6)%7));
const dateLabel = (key, options) => new Intl.DateTimeFormat('uk-UA',options).format(parse(key));
const cap = value => value[0].toLocaleUpperCase('uk-UA')+value.slice(1);
const shortDate = key => dateLabel(key,{day:'numeric',month:'long'});
const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
const clockTime = date => [date.getHours(),date.getMinutes()].map(value=>String(value).padStart(2,'0')).join(':');
function overlaps(a,b){
 const aEnd=a.end||a.time;
 const bEnd=b.end||b.time;
 if(a.time===b.time)return true;
 return a.time<bEnd&&b.time<aEnd;
}
function timeSummary(events){
 const intervals=events.filter(event=>event.end>event.time)
  .map(event=>[minutes(event.time),minutes(event.end)]).sort(([a],[b])=>a-b);
 let busy=0, coveredUntil=0;
 for(const [start,end] of intervals){
  busy+=Math.max(0,end-Math.max(start,coveredUntil));
  coveredUntil=Math.max(coveredUntil,end);
 }
 return {busy,free:1440-busy,unknown:events.length-intervals.length};
}
const durationLabel = value => [Math.floor(value/60)?Math.floor(value/60)+' год':'',value%60?value%60+' хв':''].filter(Boolean).join(' ')||'0 хв';
export {months,weekdays,parse,keyOf,plusDays,weekStart,dateLabel,cap,shortDate,minutes,clockTime,overlaps,timeSummary,durationLabel};
