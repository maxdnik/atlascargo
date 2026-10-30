import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,checklist} from './domain.mjs';
import {clientOperations,sharedDocument,migrateDemoData} from './client-access.mjs';

test('client scope uses an exact stable identity, including operations in either direction',()=>{
  const {operations}=initialState();
  const otherSameName={...operations[0],id:'OTHER',customerId:'different-client'};
  const sameClientExport={...operations[0],id:'EXPORT',direction:'EXPORT'};
  const result=clientOperations([...operations,otherSameName,sameClientExport],'client-sur');
  assert.deepEqual(result.map(o=>o.id),['AT-260038','AT-260033','EXPORT']);
  assert.deepEqual(clientOperations(operations,'client-pampa').map(o=>o.id),['AT-260037']);
  for(const id of [null,undefined,'',' ', 'unknown'])assert.deepEqual(clientOperations(operations,id),[]);
});
test('public projection excludes internal fields and future fields by default',()=>{
  const op={...initialState().operations[0],privateSecret:'secret',supplierRate:4000,customsNotes:'Private note'};
  const [result]=clientOperations([op],op.customerId);
  for(const key of ['costs','notes','history','cuit','ncm','broker','responsible','customerId','privateSecret','supplierRate','customsNotes'])assert.ok(!Object.hasOwn(result,key),key);
  assert.equal(result.eta,op.eta);
  assert.equal(result.customs,op.customs);
});
test('documents require explicit sharing and expose only public metadata',()=>{
  const op=initialState().operations[0];
  op.documents=[{id:'shared',label:'BL',status:'VERIFIED',fileId:'file-1',clientVisible:true,internalNote:'internal'},{id:'private',fileId:'file-2',clientVisible:false},{id:'unset',fileId:'file-3'}];
  const [result]=clientOperations([op],op.customerId);
  assert.deepEqual(result.documents,[{id:'shared',label:'BL',status:'VERIFIED',fileId:'file-1'}]);
  result.documents[0].label='Changed';
  assert.equal(op.documents[0].label,'BL');
  assert.ok(checklist('IMPORT','OCEAN').every(doc=>doc.clientVisible===false));
});
test('download lookup rechecks customer, shipment and current publication',()=>{
  const {operations}=initialState();
  const op=operations[0];op.documents[0].fileId='file-1';
  assert.equal(sharedDocument(operations,'client-sur',op.id,'invoice').fileId,'file-1');
  assert.equal(sharedDocument(operations,'client-pampa',op.id,'invoice'),null);
  assert.equal(sharedDocument(operations,'client-sur','missing','invoice'),null);
  op.documents[0].clientVisible=false;
  assert.equal(sharedDocument(operations,'client-sur',op.id,'invoice'),null);
});
test('legacy migration assigns only recognized demo records and preserves explicit decisions',()=>{
  const data=initialState();
  for(const op of data.operations){delete op.customerId;for(const doc of op.documents)delete doc.clientVisible;}
  data.operations[0].documents[0].fileId='existing-upload';
  data.operations[0].documents[1].clientVisible=false;
  data.operations.push({...data.operations[0],id:'NEW-SAME-NAME'});
  const next=migrateDemoData(data);
  assert.equal(next.operations[0].customerId,'client-sur');
  assert.equal(next.operations[0].documents[0].clientVisible,false);
  assert.equal(next.operations[0].documents[1].clientVisible,false);
  assert.equal(next.operations[0].documents[2].clientVisible,true);
  assert.equal(clientOperations(next.operations,'client-sur').length,2);
  assert.deepEqual(migrateDemoData(next),next);
});
