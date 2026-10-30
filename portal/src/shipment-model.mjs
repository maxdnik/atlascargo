export function referenceFields(mode) {
  const common=[{key:'booking',label:'Booking'}];
  const transport=mode==='AIR'?
    [{key:'mawb',label:'MAWB / AWB'},{key:'hawb',label:'HAWB'}]:mode==='ROAD'?
    [{key:'crt',label:'CRT'}]:
    [{key:'mbl',label:'MBL'},{key:'hbl',label:'HBL'}];
  return [...common,...transport,{key:'customerReference',label:'Tu referencia / OC'}];
}
export function transportDocuments(mode) {
  return referenceFields(mode).filter(f=>!['booking','customerReference'].includes(f.key)).map((f,i)=>({id:f.key,label:f.label+' · '+(f.key==='crt'?'Carta de porte':f.key==='mbl'?'Conocimiento master':f.key==='hbl'?'Conocimiento house':f.key==='mawb'?'Guía aérea master':'Guía aérea house'),required:i===0,status:'PENDING',clientVisible:false}));
}
export function documentReference(op,doc) {
  const key={mbl:'mbl',hbl:'hbl',mawb:'mawb',hawb:'hawb',crt:'crt',customs:'customsRef'}[doc.id];
  return key?op[key]||'':'';
}
export function demoReferences(op) {
  const suffix=op.id.replace('AT-','');
  return {...Object.fromEntries(referenceFields(op.mode).map(f=>[f.key,f.key==='booking'?op.booking||'':f.key==='customerReference'?'DEMO-OC-'+suffix:'DEMO-'+f.key.toUpperCase()+'-'+suffix])),containerNumber:['OCEAN','LCL'].includes(op.mode)?'DEMO-CNTR-'+suffix:''};
}
export function upgradeShipment(op,seed=false) {
  const refs=seed?demoReferences(op):{};
  const merged={...refs,...op}; // Never overwrite a user's value, including an intentionally empty one.
  const missing=transportDocuments(op.mode).filter(doc=>!op.documents.some(d=>d.id===doc.id));
  // Keep unclassified legacy transport records and their uploads exactly as stored.
  return {...merged,documents:[...op.documents,...missing.map(d=>({...d,required:op.documents.some(x=>x.id==='transport')?false:d.required}))]};
}
export const shipmentSearch=(op,query)=>{
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const values=['id','customer','origin','destination','carrier','vessel','container','containerNumber',...referenceFields(op.mode).map(f=>f.key)];
  return normalize(values.map(k=>op[k]||'').join(' ')).includes(normalize(query).trim());
};
export function statusMatches(op,filter) {
  if(filter==='ALL')return true;
  if(filter==='ACTIVE')return !['DELIVERED','CANCELLED'].includes(op.status);
  if(filter==='CUSTOMS_PENDING')return ['ARRIVED','CUSTOMS'].includes(op.status)&&op.customs!=='RELEASED';
  return op.status===filter;
}
export function sortShipments(operations,sort='eta') {
  return [...operations].sort((a,b)=>sort==='reference'?b.id.localeCompare(a.id):Number(['DELIVERED','CANCELLED'].includes(a.status))-Number(['DELIVERED','CANCELLED'].includes(b.status))||(a.eta||'9999').localeCompare(b.eta||'9999'));
}

export function documentGroups(operations,{query='',filter='ALL'}={}) {
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const search=normalize(query);
  return operations.map(op=>({op,documents:op.documents.filter(doc=>
    doc.status!=='NA' &&
    (filter==='ALL'||(filter==='FILES'?!!doc.fileId:doc.status==='PENDING')) &&
    (shipmentSearch(op,query)||normalize([doc.label,doc.fileName,documentReference(op,doc)].join(' ')).includes(search))
  )})).filter(group=>group.documents.length>0);
}
