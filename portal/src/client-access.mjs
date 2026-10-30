import {upgradeShipment} from './shipment-model.mjs';
// Demo projections only. Production must derive customerId from an authenticated
// server session and apply the same scope to queries, counts and file downloads.
export const DEMO_CUSTOMERS = [
  {id:'client-sur',name:'Industrias del Sur'},
  {id:'client-pampa',name:'Pampa Alimentos'},
  {id:'client-austral',name:'Tecnología Austral'},
  {id:'client-norte',name:'Casa Norte'},
  {id:'client-andina',name:'Andina Equipamientos'},
  {id:'client-patagonia',name:'Patagonia Maquinarias'},
];
export const DEMO_VIEWS = [
  {id:'atlas',label:'Equipo Atlas · Gestión'},
  {id:'importador',label:'Importador · Consulta',customerId:'client-sur',name:'Industrias del Sur'},
  {id:'exportador',label:'Exportador · Consulta',customerId:'client-pampa',name:'Pampa Alimentos'},
];
const seedOwners = {'AT-260038':'client-sur','AT-260037':'client-pampa','AT-260036':'client-austral','AT-260035':'client-norte','AT-260034':'client-andina','AT-260033':'client-sur','AT-260032':'client-patagonia','AT-260031':'client-austral'};
const sharedDemoDocs = ['invoice','packing','transport','mbl','hbl','mawb','hawb','crt','customs','pod'];
export function migrateDemoData(data) {
  return {...data,quotes:data.quotes.map(quote=>({...quote,customerId:quote.customerId||(quote.id==='COT-260012'&&quote.customer==='Industrias del Sur'?'client-sur':quote.id==='COT-260013'&&quote.customer==='Pampa Alimentos'?'client-pampa':'unassigned-'+quote.id)})),operations:data.operations.map(op=>{
    const owner = DEMO_CUSTOMERS.find(c=>c.id===seedOwners[op.id]&&c.name===op.customer);
    return upgradeShipment({...op,customerId:op.customerId||(owner?.id??'unassigned-'+op.id),documents:op.documents.map(d=>({...d,clientVisible:typeof d.clientVisible==='boolean'?d.clientVisible:!!owner&&!d.fileId&&sharedDemoDocs.includes(d.id)}))},!!owner);
  })};
}
const PUBLIC_FIELDS = ['id','direction','mode','origin','originCode','destination','destinationCode','status','customs','carrier','vessel','mbl','hbl','mawb','hawb','crt','customerReference','containerNumber','booking','container','seal','packages','weight','volume','commodity','incoterm','namedPlace','temperature','bookingDate','etd','eta','atd','ata','released','delivered','cutoff','cutoffTime','freeUntil','storageUntil','gateOut','emptyReturned'];
const PUBLIC_DOC_FIELDS = ['id','label','status','fileId','fileName'];
const pick = (obj,fields) => Object.fromEntries(fields.filter(key=>Object.hasOwn(obj,key)).map(key=>[key,obj[key]]));
export function clientOperations(operations,customerId) {
  if(typeof customerId!=='string'||!customerId.trim())return [];
  return operations.filter(op=>op.customerId===customerId).map(op=>({
    ...pick(op,PUBLIC_FIELDS),
    documents:op.documents.filter(doc=>doc.clientVisible===true).map(doc=>pick(doc,PUBLIC_DOC_FIELDS)),
  }));
}
export function sharedDocument(operations,customerId,operationId,documentId) {
  return clientOperations(operations,customerId).find(op=>op.id===operationId)?.documents.find(doc=>doc.id===documentId)??null;
}
