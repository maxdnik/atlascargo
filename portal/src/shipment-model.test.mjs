import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentReference,referenceFields,transportDocuments,upgradeShipment,shipmentSearch,sortShipments,statusMatches} from './shipment-model.mjs';
import {initialState} from './domain.mjs';
import {clientOperations} from './client-access.mjs';

test('transport references distinguish booking, master and house by mode',()=>{
  assert.deepEqual(referenceFields('OCEAN').map(f=>f.key),['booking','mbl','hbl','customerReference']);
  assert.deepEqual(referenceFields('AIR').map(f=>f.key),['booking','mawb','hawb','customerReference']);
  assert.deepEqual(referenceFields('ROAD').map(f=>f.key),['booking','crt','customerReference']);
  assert.equal(transportDocuments('AIR').find(d=>d.id==='hawb').required,false);
});
test('migration preserves legacy attachments, explicit publication, numbers and empty fields',()=>{
  const old={...initialState().operations[0],mbl:'',hbl:'CUSTOM-HOUSE',documents:[{id:'transport',label:'BL anterior',fileId:'existing-file',status:'VERIFIED',clientVisible:true,required:true}]};
  const updated=upgradeShipment(old,true);
  assert.equal(updated.mbl,'');assert.equal(updated.hbl,'CUSTOM-HOUSE');
  assert.deepEqual(updated.documents[0],old.documents[0]);
  assert.ok(updated.documents.filter(d=>d.id!=='transport').every(d=>d.status==='PENDING'&&d.clientVisible===false));
  assert.deepEqual(upgradeShipment(updated,true),updated);
});
test('reference search includes master, house, booking and container with accent normalization',()=>{
  const op={...initialState().operations[0],mbl:'M123456',hbl:'H654321',booking:'B12345',containerNumber:'CONT-987',customerReference:'OC-99',customer:'Tecnología'};
  for(const query of ['M123','h654','b123','cont-987','oc-99','tecnologia'])assert.equal(shipmentSearch(op,query),true,query);
  assert.equal(shipmentSearch(op,'no-match'),false);
});
test('client projection includes relevant reference numbers while retaining account scope',()=>{
  const data=initialState();const result=clientOperations(data.operations,'client-sur');
  assert.ok(result[0].mbl);assert.ok(result[0].hbl);assert.ok(result[0].booking);assert.ok(result[0].containerNumber);
  assert.equal(result.some(op=>op.id==='AT-260037'),false);
  assert.ok(!Object.hasOwn(result[0],'costs'));
});
test('arrival sorting keeps undated operations last and does not mutate data',()=>{
  const ops=[{id:'3',eta:''},{id:'1',eta:'2026-11-15'},{id:'2',eta:'2026-11-01'}];
  assert.deepEqual(sortShipments(ops).map(o=>o.id),['2','1','3']);assert.equal(ops[0].id,'3');
  assert.equal(statusMatches({status:'CANCELLED'},'ACTIVE'),false);
  assert.equal(statusMatches({status:'ARRIVED',customs:'OFFICIALIZED'},'CUSTOMS_PENDING'),true);
  assert.equal(statusMatches({status:'ARRIVED',customs:'RELEASED'},'CUSTOMS_PENDING'),false);
});

test("customs document reference never displays the customs status as a number",()=>{assert.equal(documentReference({customs:"CONTROL"},{id:"customs"}),"");assert.equal(documentReference({customs:"CONTROL",customsRef:"DEST-123"},{id:"customs"}),"DEST-123");});
