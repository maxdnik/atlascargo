import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from './domain.mjs';
import {migrateDemoData} from './client-access.mjs';
import {permissionsFor,can,migrateProfiles,saveProfile,profileFromUrl,detailTabs,canPatchOperation,profileOperations,visibleInvoices,invoiceError} from './profiles.mjs';
const setup=()=>migrateProfiles(migrateDemoData(initialState()));

test('FF permissions cannot grant administration, finances or invoice writes',()=>{
  const p={id:'ff',role:'FF',active:true,permissions:{operations:'edit',documents:'edit',invoices:'edit',users:'edit',costs:'edit'}};
  assert.equal(can(p,'operations','edit'),true);
  assert.equal(can(p,'documents','edit'),true);
  assert.equal(can(p,'invoices'),true);
  for(const module of ['users','costs','invoices'])assert.equal(can(p,module,'edit'),false);
  assert.deepEqual(detailTabs(p),['summary','tracking','customs','documents']);
  assert.equal(canPatchOperation(p,{status:'IN_TRANSIT',atd:'2026-10-30'}),true);
  for(const patch of [{costs:[]},{history:[]},{customerId:'other'},{eta:'2026-11-01',costs:[]}])assert.equal(canPatchOperation(p,patch),false);
});
test('read-only and inactive permissions block modifications, including mixed patches',()=>{
  const p={role:'FF',active:true,permissions:{operations:'view',documents:'edit',invoices:'none'}};
  assert.equal(canPatchOperation(p,{documents:[]}),true);
  assert.equal(canPatchOperation(p,{documents:[],status:'DRAFT'}),false);
  assert.equal(can(p,'invoices'),false);
  assert.deepEqual(detailTabs({...p,permissions:{documents:'view'}}),['documents']);
  assert.equal(can({...p,active:false},'documents'),false);
  assert.deepEqual(profileOperations(initialState().operations,{...p,active:false}),[]);
});
test('client permissions remain read-only even if inputs request management',()=>{
  const p={role:'CLIENT',active:true,customerId:'client-sur',permissions:{operations:'edit',documents:'edit',invoices:'edit',users:'edit'}};
  assert.deepEqual(permissionsFor('CLIENT',p.permissions),{operations:'view',documents:'view',invoices:'view'});
  assert.equal(canPatchOperation(p,{documents:[]}),false);
  assert.equal(can(p,'users'),false);
  assert.equal(can({role:'UNKNOWN',active:true,permissions:p.permissions},'operations'),false);
});
test('client profile includes both directions for its company without cross-company leakage',()=>{
  const data=setup(),p=data.profiles.find(p=>p.customerId==='client-sur');
  const extra={...data.operations[0],id:'EXPORT-SUR',direction:'EXPORT'};
  const result=profileOperations([...data.operations,extra],p);
  assert.deepEqual(result.map(o=>o.id),['AT-260038','AT-260033','EXPORT-SUR']);
  assert.ok(!result.some(o=>o.id==='AT-260037'));
  assert.ok(result.every(o=>!Object.hasOwn(o,'costs')));
  assert.ok(profileOperations(data.operations,{...p,permissions:{operations:'view',documents:'none'}}).every(o=>o.documents.length===0));
});
test('FF projection never includes costs, financial history or newly added private fields',()=>{
  const data=setup(),p=data.profiles.find(p=>p.role==='FF');
  const [op]=profileOperations([{...data.operations[0],privateSecret:'secret'}],p);
  for(const field of ['costs','history','privateSecret'])assert.equal(Object.hasOwn(op,field),false);
  assert.equal(op.booking,data.operations[0].booking);
  assert.notEqual(op.documents,data.operations[0].documents);
});
test('only administrators can create users; email uniqueness and company association are checked',()=>{
  const data=setup(),admin=data.profiles[0],input={id:'new',name:' Nuevo usuario ',email:'CLIENTE@EXAMPLE.COM',role:'CLIENT',customerId:'client-sur',active:true,permissions:permissionsFor('CLIENT')};
  const saved=saveProfile(data,admin,input);
  assert.equal(saved.profiles.at(-1).email,'cliente@example.com');
  assert.equal(saved.profiles.at(-1).name,'Nuevo usuario');
  assert.throws(()=>saveProfile(data,data.profiles[1],input),/permiso/);
  assert.throws(()=>saveProfile(saved,admin,{...input,id:'duplicate'}),/email/);
  assert.throws(()=>saveProfile(data,admin,{...input,customerId:'missing'}),/empresa/);
  assert.throws(()=>saveProfile(data,admin,{...input,email:'invalid'}),/email/);
});
test('the last active administrator cannot be deactivated or demoted',()=>{
  const data=setup(),admin=data.profiles[0];
  assert.throws(()=>saveProfile(data,admin,{...admin,active:false}),/administrador activo/);
  assert.throws(()=>saveProfile(data,admin,{...admin,role:'FF'}),/administrador activo/);
  const next=saveProfile(data,admin,{...admin,id:'second-admin',email:'second@example.com'});
  assert.equal(saveProfile(next,admin,{...admin,active:false}).profiles.find(p=>p.id===admin.id).active,false);
});
test('migration is additive and preserves edited profiles, clients, invoices and assignments',()=>{
  const data=setup();data.profiles[1].permissions.documents='none';data.profiles[2].active=false;data.invoices=[{id:'invoice-1'}];
  const next=migrateProfiles(data);
  assert.deepEqual(next,data);
  assert.deepEqual(migrateProfiles(next),next);
  assert.equal(profileFromUrl(next.profiles,'?perfil=client-sur-demo'),null);
  assert.equal(profileFromUrl(next.profiles,'?perfil=missing'),null);
  assert.equal(profileFromUrl(next.profiles,'?vista=exportador').customerId,'client-pampa');
  assert.equal(profileFromUrl(next.profiles,'?vista=ff').role,'FF');
});
test('issued invoices are scoped by company, publication, status and module permission',()=>{
  const data=setup(),client=data.profiles.find(p=>p.customerId==='client-sur'),ff=data.profiles.find(p=>p.role==='FF');
  const invoices=[{id:'visible',customerId:'client-sur',status:'ISSUED',clientVisible:true},{id:'paid',customerId:'client-sur',status:'PAID',clientVisible:true},{id:'internal',customerId:'client-sur',status:'ISSUED',clientVisible:false},{id:'draft',customerId:'client-sur',status:'DRAFT',clientVisible:true},{id:'other',customerId:'client-pampa',status:'ISSUED',clientVisible:true}];
  assert.deepEqual(visibleInvoices(invoices,client).map(i=>i.id),['visible','paid']);
  assert.deepEqual(visibleInvoices(invoices,ff).map(i=>i.id),['visible','paid','internal','other']);
  assert.deepEqual(visibleInvoices(invoices,{...client,permissions:{invoices:'none'}}),[]);
  assert.deepEqual(visibleInvoices(invoices,{...ff,active:false}),[]);
});
test('invoice registration validates ownership, duplicate number and positive currency amount',()=>{
  const data=setup(),invoice={id:'i',number:'A 0001-00000001',operationId:'AT-260038',customerId:'client-sur',issuedAt:'2026-10-30',currency:'USD',total:123};
  assert.equal(invoiceError(invoice,data.operations,[]),'');
  for(const change of [{customerId:'other'},{total:0},{total:NaN},{currency:'XYZ'},{number:''},{operationId:'missing'}])assert.ok(invoiceError({...invoice,...change},data.operations,[]));
  assert.ok(invoiceError({...invoice,id:'duplicate'},data.operations,[invoice]));
});
