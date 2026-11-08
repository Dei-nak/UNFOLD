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
export {months,weekdays,parse,keyOf,plusDays,weekStart,dateLabel,cap,shortDate,minutes};
