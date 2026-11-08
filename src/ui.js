const paths = {
 home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
 note:'<path d="M12 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5l-9 9zM12 20v-7a2 2 0 0 1 2-2h7M7 8h7"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 user:'<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
 shield:'<path d="M12 22s7-3.5 7-10V5l-7-3-7 3v7c0 6.5 7 10 7 10z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
 sliders:'<path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
 parallel:'<path d="M5 20V4m0 7c0 4 9 4 9 9m-3-3 3 3 3-3m-9-9-3-4-3 4"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
 spark:'<path d="M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10Z"/>',
 work:'<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M2 20h20"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.7 2.5-2 .9L4 6l-2 3 1.8 1.8v2.4L2 15l2 3 2.3-.4 2 .9L9 21h6l.7-2.5 2-.9 2.3.4 2-3-1.8-1.8v-2.4L22 9l-2-3-2.3.4-2-.9L15 3z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', left:'<path d="m15 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function action(label,act,value,options=''){
 return '<button type="button" data-act="'+act+'"'+(value===undefined?'':' data-value="'+escape(value)+'"')+' '+options+'>'+label+'</button>';
}
const iconButton = (name,act,label,value,style='icon') => action(icon(name),act,value,'class="'+style+'" aria-label="'+label+'" title="'+label+'"');
const textLink = (label,act,value) => action(label+icon('arrow'),act,value,'class="link"');
function segment(items,active,act,label){
 return '<div class="seg" role="group" aria-label="'+label+'">'+Object.entries(items).map(([key,text])=>action(text,act,key,'aria-pressed="'+(key===active)+'"')).join('')+'</div>';
}
function header(kicker,title,sub='',quick=true){
 return '<div class="heading"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1>'+(sub?'<p class="sub">'+sub+'</p>':'')+'</div>'+(quick?action(icon('plus')+'<span>Швидкі дії</span>','quick',undefined,'class="add" aria-label="Швидкі дії" aria-keyshortcuts="Alt+N" title="Швидкі дії · Alt+N"'):'')+'</div>';
}
export {escape,icon,action,iconButton,textLink,segment,header};
