export const TODAY='2026-10-30';
export const STATUS={DRAFT:'En preparación',BOOKING_CONFIRMED:'Reserva confirmada',IN_TRANSIT:'En tránsito',ARRIVED:'Arribado',CUSTOMS:'En aduana',DELIVERED:'Entregado',CANCELLED:'Cancelado'};
export const CUSTOMS={PENDING:'Sin oficializar',OFFICIALIZED:'Oficializado',CONTROL:'En control',RELEASED:'Librado'};
export const MODES={OCEAN:'Marítimo FCL',LCL:'Marítimo LCL',AIR:'Aéreo',ROAD:'Terrestre'};
export const DIRECTIONS={IMPORT:'Importación',EXPORT:'Exportación'};
export const DOC_STATUS={PENDING:'Pendiente',RECEIVED:'Recibido',VERIFIED:'Verificado',NA:'No aplica'};
export const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const shortDate=d=>d?new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(d.length===10?d+'T12:00:00Z':d)).replace('.',''):'A confirmar';
export const daysUntil=(d,today=TODAY)=>d?Math.round((Date.parse(d.slice(0,10)+'T12:00:00Z')-Date.parse(today.slice(0,10)+'T12:00:00Z'))/86400000):null;
export function checklist(direction,mode){return [
  {id:'invoice',label:direction==='EXPORT'?'Factura de exportación':'Factura comercial',required:true,status:'PENDING'},
  {id:'packing',label:'Packing list',required:false,status:'PENDING'},
  {id:'transport',label:mode==='AIR'?'Guía aérea · AWB':mode==='ROAD'?'Carta de porte · CRT':'Conocimiento de embarque · BL',required:true,status:'PENDING'},
  {id:'customs',label:direction==='EXPORT'?'Permiso de embarque':'Destinación de importación',required:true,status:'PENDING'},
  {id:'origin',label:'Certificado de origen',required:false,status:'NA'},
  {id:'permits',label:'Intervenciones de terceros organismos',required:false,status:'NA'},
  {id:'pod',label:'Constancia de entrega · POD',required:false,status:'PENDING'}];}
export function transitionError(op,next){
  if(next==='DELIVERED'&&op.customs!=='RELEASED')return 'Registrá el libramiento aduanero antes de confirmar la entrega.';
  if(next==='IN_TRANSIT'&&op.direction==='EXPORT'&&op.customs!=='RELEASED')return 'La exportación necesita libramiento en origen antes de registrar la salida internacional.';
  if(next==='DELIVERED'&&!op.ata)return 'Completá la fecha de arribo real (ATA) antes de confirmar la entrega.';
  return null;
}
export function alertsFor(ops,tasks,today=TODAY){
 const alerts=[];
 for(const o of ops){if(o.status==='CANCELLED')continue;
  if(o.cutoff&&['DRAFT','BOOKING_CONFIRMED'].includes(o.status)){const d=daysUntil(o.cutoff,today);if(d<=3)alerts.push({id:o.id+'cut',op:o.id,level:d<0?'red':'amber',title:`Cut-off ${d<0?'vencido':d===0?'hoy':`en ${d} días`}`,detail:`${o.id} · ${shortDate(o.cutoff)} · ${o.cutoffTime||'Horario a confirmar'} AR`,kind:'cutoff'});}
  for(const [key,label,closed] of [['freeUntil','Días libres de contenedor',o.emptyReturned],['storageUntil','Almacenaje de terminal',o.gateOut]]){const d=daysUntil(o[key],today);if(d!==null&&d<=5&&!closed)alerts.push({id:o.id+key,op:o.id,level:d<0?'red':'amber',title:`${label}: ${d<0?'vencidos':d===0?'vence hoy':`${d} días`}`,detail:`${o.id} · vence ${shortDate(o[key])}`,kind:key});}
  for(const [key,label] of [['vgm','Cut-off VGM'],['si','Shipping instructions']]){const d=daysUntil(o[key],today);if(['DRAFT','BOOKING_CONFIRMED'].includes(o.status)&&d!==null&&d<=3)alerts.push({id:o.id+key,op:o.id,level:d<0?'red':'amber',title:label+(d<0?' vencido':d===0?' vence hoy':` en ${d} días`),detail:`${o.id} · ${shortDate(o[key])}`,kind:key});}
  const missing=o.documents.filter(d=>d.required&&d.status!=='VERIFIED');
  if(['ARRIVED','CUSTOMS'].includes(o.status)&&missing.length)alerts.push({id:o.id+'doc',op:o.id,level:'amber',title:`${missing.length} documentos por validar`,detail:`${o.id} · ${o.customer}`,kind:'docs'});
 }
 for(const t of tasks.filter(t=>!t.done&&daysUntil(t.due,today)<0))alerts.push({id:t.id,op:t.op,level:'red',title:'Tarea vencida',detail:t.title,kind:'task'});
 return alerts;
}
export function timeline(o){
 const steps=o.direction==='EXPORT'?[['Reserva confirmada','booking'],['Libramiento en origen','customs'],['Salida internacional','departure'],['Arribo a destino','arrival'],['Entrega al consignatario','delivery']]:[['Reserva confirmada','booking'],['Salida de origen','departure'],['Arribo a Argentina','arrival'],['Libramiento aduanero','customs'],['Entrega al cliente','delivery']];
 const complete={booking:o.status!=='DRAFT',departure:!!o.atd,arrival:!!o.ata,customs:o.customs==='RELEASED',delivery:!!o.delivered};
 let active=false;
 return steps.map(([label,key])=>{const done=complete[key];const current=!done&&!active;if(current)active=true;return {label,key,done,current,date:({booking:o.bookingDate,departure:o.atd,arrival:o.ata,customs:o.released,delivery:o.delivered})[key],expected:({departure:o.etd,arrival:o.eta})[key]};});
}
export function validCuit(value){const d=value.replace(/\D/g,'');if(d.length!==11)return false;const sum=[5,4,3,2,7,6,5,4,3,2].reduce((n,w,i)=>n+w*Number(d[i]),0);return (11-sum%11)%11===Number(d[10]);}
export function csvCell(v){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
const base={cuit:'',ncm:'A validar por despachante',customsRef:'',channel:'Sin asignar',broker:'Equipo de despacho',incoterm:'FOB',namedPlace:'Puerto de origen',incotermVersion:'2020',container:'',seal:'',packages:120,weight:8400,volume:32,commodity:'Carga general',responsible:'Agustina',bookingDate:'2026-10-16',documents:[],notes:'',history:[],costs:[{id:'c1',concept:'Flete internacional',buy:2600,sell:3100,currency:'USD'},{id:'c2',concept:'Gastos en destino',buy:650,sell:800,currency:'USD'}]};
function op(id,data){const o={...base,id,...data};o.documents=checklist(o.direction,o.mode).map(d=>({...d,status:['invoice','packing','transport'].includes(d.id)?'VERIFIED':d.status}));if(o.customs==='RELEASED'||o.customs==='CONTROL')o.documents.find(d=>d.id==='customs').status='VERIFIED';if(o.status==='DELIVERED')o.documents.find(d=>d.id==='pod').status='VERIFIED';o.history=[{date:'2026-10-30T12:30:00Z',text:'Datos ilustrativos cargados en la demostración',by:'Atlas Cargo'}];return o;}
export function initialState(){return {version:1,operations:[
 op('AT-260038',{customer:'Industrias del Sur',direction:'IMPORT',mode:'OCEAN',origin:'Shanghai',originCode:'CNSHA',destination:'Buenos Aires',destinationCode:'ARBUE',status:'IN_TRANSIT',customs:'PENDING',carrier:'MSC',vessel:'MSC AURORA · 642E',booking:'DEMO-MSC-260038',container:'DEMO · 40 HC',etd:'2026-10-19',atd:'2026-10-20',eta:'2026-11-14',commodity:'Repuestos industriales',weight:12480,volume:54,packages:240}),
 op('AT-260037',{customer:'Pampa Alimentos',direction:'EXPORT',mode:'OCEAN',origin:'Buenos Aires',originCode:'ARBUE',destination:'Rotterdam',destinationCode:'NLRTM',status:'BOOKING_CONFIRMED',customs:'OFFICIALIZED',carrier:'Hapag-Lloyd',vessel:'BUENOS AIRES EXPRESS',booking:'DEMO-HL-260037',container:'DEMO · 40 RF',incoterm:'CFR',namedPlace:'Rotterdam',etd:'2026-11-03',eta:'2026-11-27',cutoff:'2026-11-01',cutoffTime:'16:00',vgm:'2026-10-31',si:'2026-10-31',commodity:'Alimentos refrigerados',temperature:'-18 °C'}),
 op('AT-260036',{customer:'Tecnología Austral',direction:'IMPORT',mode:'AIR',origin:'Miami',originCode:'MIA',destination:'Ezeiza',destinationCode:'EZE',status:'CUSTOMS',customs:'CONTROL',channel:'Naranja',carrier:'LATAM Cargo',vessel:'LA · vuelo de ejemplo',booking:'DEMO-AWB-260036',etd:'2026-10-26',atd:'2026-10-26',eta:'2026-10-28',ata:'2026-10-28',commodity:'Componentes electrónicos',weight:360,packages:18,volume:2.8}),
 op('AT-260035',{customer:'Casa Norte',direction:'IMPORT',mode:'OCEAN',origin:'Santos',originCode:'BRSSZ',destination:'Buenos Aires',destinationCode:'ARBUE',status:'ARRIVED',customs:'OFFICIALIZED',carrier:'Maersk',container:'DEMO · 20 GP',etd:'2026-10-21',atd:'2026-10-21',eta:'2026-10-25',ata:'2026-10-25',freeUntil:'2026-11-02',storageUntil:'2026-11-04',commodity:'Artículos para el hogar'}),
 op('AT-260034',{customer:'Andina Equipamientos',direction:'EXPORT',mode:'ROAD',origin:'Mendoza',originCode:'ARMDZ',destination:'Santiago',destinationCode:'CLSCL',status:'DELIVERED',customs:'RELEASED',carrier:'Transporte regional',etd:'2026-10-22',atd:'2026-10-22',eta:'2026-10-24',ata:'2026-10-24',delivered:'2026-10-25',released:'2026-10-21',incoterm:'FCA',namedPlace:'Mendoza'}),
 op('AT-260033',{customer:'Industrias del Sur',direction:'IMPORT',mode:'OCEAN',origin:'Ningbo',originCode:'CNNGB',destination:'Buenos Aires',destinationCode:'ARBUE',status:'IN_TRANSIT',customs:'PENDING',carrier:'COSCO',container:'DEMO · 40 HC',etd:'2026-10-23',atd:'2026-10-23',eta:'2026-11-22'}),
 op('AT-260032',{customer:'Patagonia Maquinarias',direction:'IMPORT',mode:'LCL',origin:'Hamburgo',originCode:'DEHAM',destination:'Buenos Aires',destinationCode:'ARBUE',status:'IN_TRANSIT',customs:'PENDING',carrier:'Consolidador de ejemplo',etd:'2026-10-17',atd:'2026-10-17',eta:'2026-11-19',incoterm:'FCA',namedPlace:'Hamburgo',commodity:'Repuestos de maquinaria'}),
 op('AT-260031',{customer:'Tecnología Austral',direction:'IMPORT',mode:'AIR',origin:'Miami',originCode:'MIA',destination:'Ezeiza',destinationCode:'EZE',status:'DELIVERED',customs:'RELEASED',channel:'Verde',carrier:'Aerolíneas Argentinas',etd:'2026-10-18',atd:'2026-10-18',eta:'2026-10-20',ata:'2026-10-20',released:'2026-10-22',delivered:'2026-10-23'})
 ],tasks:[{id:'t1',title:'Confirmar VGM y shipping instructions',op:'AT-260037',owner:'Agustina',due:'2026-10-31',priority:'Alta',done:false},{id:'t2',title:'Validar documentación para el despacho',op:'AT-260035',owner:'Despachante',due:'2026-10-30',priority:'Alta',done:false},{id:'t3',title:'Coordinar turno de retiro en terminal',op:'AT-260035',owner:'Operaciones',due:'2026-11-02',priority:'Media',done:false},{id:'t4',title:'Solicitar comprobante de entrega',op:'AT-260034',owner:'Agustina',due:'2026-10-26',priority:'Media',done:true}],quotes:[{id:'COT-260012',customer:'Industrias del Sur',direction:'IMPORT',mode:'OCEAN',origin:'Shanghai',destination:'Buenos Aires',incoterm:'FOB',validUntil:'2026-11-06',buy:3250,sell:3900,status:'Enviada',notes:'1 × 40 HC. Sujeto a espacio y equipo. Tributos, almacenaje y demoras no incluidos.'},{id:'COT-260013',customer:'Pampa Alimentos',direction:'EXPORT',mode:'OCEAN',origin:'Buenos Aires',destination:'Rotterdam',incoterm:'CFR',validUntil:'2026-11-10',buy:2850,sell:3500,status:'Borrador',notes:'1 × 40 RF. Condiciones de temperatura a confirmar.'}]};}
