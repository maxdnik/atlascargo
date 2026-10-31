import {DEMO_CUSTOMERS,clientOperations} from './client-access.mjs';

// This policy drives the local prototype. It must also run on a future backend;
// the demo selector and browser storage are not authentication or authorization.
export const ROLES={ADMIN:'Administrador',FF:'Freight Forwarder',CLIENT:'Cliente'};
export const MODULES={operations:'Operaciones',documents:'Documentación',invoices:'Facturas emitidas'};
export const DEFAULT_PERMISSIONS={
  ADMIN:{operations:'edit',documents:'edit',invoices:'edit',users:'edit'},
  FF:{operations:'edit',documents:'edit',invoices:'view'},
  CLIENT:{operations:'view',documents:'view',invoices:'view'},
};
export function permissionsFor(role,input=DEFAULT_PERMISSIONS[role]){
  if(role==='ADMIN')return {...DEFAULT_PERMISSIONS.ADMIN};
  if(!['FF','CLIENT'].includes(role))return {};
  return Object.fromEntries(Object.keys(MODULES).map(key=>{
    const value=input?.[key];
    return [key,value==='edit'&&role==='FF'&&key!=='invoices'?'edit':['view','edit'].includes(value)?'view':'none'];
  }));
}
export function can(profile,module,action='view'){
  if(!profile?.active||!Object.hasOwn(ROLES,profile.role))return false;
  const level=permissionsFor(profile.role,profile.permissions)[module];
  return action==='edit'?level==='edit':['view','edit'].includes(level);
}
export function initialProfiles(){return [
  {id:'admin-demo',name:'Administrador Atlas',email:'admin@atlas.example',role:'ADMIN',active:true,permissions:permissionsFor('ADMIN')},
  {id:'ff-demo',name:'Operaciones Atlas',email:'operaciones@atlas.example',role:'FF',active:true,permissions:permissionsFor('FF')},
  {id:'client-sur-demo',name:'Usuario Industrias del Sur',email:'operaciones@industriasdelsur.example',role:'CLIENT',customerId:'client-sur',active:true,permissions:permissionsFor('CLIENT')},
  {id:'client-pampa-demo',name:'Usuario Pampa Alimentos',email:'operaciones@pampaalimentos.example',role:'CLIENT',customerId:'client-pampa',active:true,permissions:permissionsFor('CLIENT')},
];}
export function migrateProfiles(data){
  const customers=[...(Array.isArray(data.customers)?data.customers:DEMO_CUSTOMERS)].map(c=>({...c}));
  for(const op of data.operations){if(op.customerId&&!customers.some(c=>c.id===op.customerId))customers.push({id:op.customerId,name:op.customer});}
  const profiles=(Array.isArray(data.profiles)?data.profiles:initialProfiles()).map(p=>({...p,permissions:permissionsFor(p.role,p.permissions)}));
  return {...data,customers,profiles,invoices:Array.isArray(data.invoices)?data.invoices:[]};
}
export function profileFromUrl(profiles,search){
  const params=new URLSearchParams(search),view=params.get('vista'),id=params.get('perfil');
  const active=profiles.filter(p=>p.active);
  if(id)return active.find(p=>p.id===id)||null;
  if(view==='importador'||view==='exportador')return active.find(p=>p.role==='CLIENT'&&p.customerId===(view==='importador'?'client-sur':'client-pampa'))||null;
  const role=view==='cliente'?'CLIENT':view==='ff'?'FF':'ADMIN';
  return active.find(p=>p.role===role)||null;
}
export function saveProfile(data,actor,input){
  if(!can(actor,'users','edit'))throw Error('No tenés permiso para administrar usuarios.');
  const previous=data.profiles.find(p=>p.id===input.id);
  const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase();
  if(!name||name.length>100)throw Error('Completá el nombre del usuario.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Ingresá un email válido.');
  if(data.profiles.some(p=>p.id!==input.id&&p.email.toLowerCase()===email))throw Error('Ya existe un usuario con ese email.');
  if(!Object.hasOwn(ROLES,input.role))throw Error('Seleccioná un perfil válido.');
  if(input.role==='CLIENT'&&!data.customers.some(c=>c.id===input.customerId))throw Error('Seleccioná la empresa del cliente.');
  if(previous?.role==='ADMIN'&&(input.role!=='ADMIN'||!input.active)&&!data.profiles.some(p=>p.id!==input.id&&p.active&&p.role==='ADMIN'))throw Error('Debe quedar al menos un administrador activo.');
  const profile={id:previous?.id||input.id,name,email,role:input.role,active:input.active===true,customerId:input.role==='CLIENT'?input.customerId:null,permissions:permissionsFor(input.role,input.permissions)};
  if(!profile.id)throw Error('Falta la referencia del usuario.');
  return {...data,profiles:previous?data.profiles.map(p=>p.id===profile.id?profile:p):[...data.profiles,profile]};
}
export function detailTabs(profile){
  if(profile?.role==='ADMIN'&&profile.active)return ['summary','tracking','customs','documents','costs','history'];
  return [...(can(profile,'operations')?['summary','tracking',...(profile.role==='FF'?['customs']:[])]:[]),...(can(profile,'documents')?['documents']:[])];
}
export function canPatchOperation(profile,patch){
  const keys=Object.keys(patch);
  if(!keys.length)return false;
  if(profile?.role==='ADMIN'&&profile.active)return true;
  if(profile?.role!=='FF')return false;
  const fields=['status','responsible','carrier','vessel','incoterm','namedPlace','booking','mbl','hbl','mawb','hawb','crt','customerReference','etd','eta','atd','ata','bookingDate','delivered','containerNumber','container','seal','temperature','storageUntil','gateOut','freeUntil','emptyReturned','cutoff','vgm','si','cutoffTime','notes','customs','channel','customsRef','broker','ncm','released','customsNotes'];
  return keys.every(key=>key==='documents'?can(profile,'documents','edit'):fields.includes(key)&&can(profile,'operations','edit'));
}
export function profileOperations(operations,profile){
  if(!profile?.active)return [];
  if(profile.role==='CLIENT'){
    if(!can(profile,'operations')&&!can(profile,'documents'))return [];
    return clientOperations(operations,profile.customerId).map(op=>({...op,documents:can(profile,'documents')?op.documents:[]}));
  }
  if(profile.role==='ADMIN')return operations;
  if(profile.role!=='FF'||(!can(profile,'operations')&&!can(profile,'documents')))return [];
  const fields=['id','customer','customerId','direction','mode','origin','originCode','destination','destinationCode','status','customs','channel','customsRef','broker','ncm','customsNotes','carrier','vessel','incoterm','namedPlace','booking','mbl','hbl','mawb','hawb','crt','customerReference','containerNumber','container','seal','temperature','commodity','weight','volume','packages','bookingDate','etd','eta','atd','ata','released','delivered','storageUntil','gateOut','freeUntil','emptyReturned','cutoff','vgm','si','cutoffTime','responsible','notes'];
  return operations.map(op=>({...Object.fromEntries(fields.filter(k=>Object.hasOwn(op,k)).map(k=>[k,op[k]])),documents:can(profile,'documents')?op.documents.map(d=>({...d})):[]}));
}
export function visibleInvoices(invoices,profile){
  if(!can(profile,'invoices'))return [];
  return invoices.filter(i=>['ISSUED','PAID'].includes(i.status)&&(profile.role!=='CLIENT'||(i.customerId===profile.customerId&&i.clientVisible===true))).map(i=>({...i}));
}
export function invoiceError(invoice,operations,invoices){
  const op=operations.find(o=>o.id===invoice.operationId);
  if(!op||op.customerId!==invoice.customerId)return 'Seleccioná el embarque de la empresa correspondiente.';
  if(!String(invoice.number||'').trim())return 'Completá el número de factura.';
  if(invoices.some(i=>i.id!==invoice.id&&i.number.toLowerCase()===invoice.number.trim().toLowerCase()))return 'Ese número de factura ya está registrado.';
  if(!['ARS','USD','EUR'].includes(invoice.currency)||!Number.isFinite(Number(invoice.total))||Number(invoice.total)<=0)return 'Ingresá un importe y una moneda válidos.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issuedAt||''))return 'Completá la fecha de emisión.';
  return '';
}
