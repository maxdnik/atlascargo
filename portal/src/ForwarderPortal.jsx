import React,{useEffect,useState} from 'react';
import {Ship,FolderOpen,FileText,Building2,ShieldCheck,Menu,ChevronRight,Plus,Upload,Eye} from 'lucide-react';
import {can,detailTabs} from './profiles.mjs';
import {ShipmentCollection,DocumentBrowser} from './ShipmentUI.jsx';
import {InvoicePanel} from './ProfilesUI.jsx';

export default function ForwarderPortal({profile,operations,invoices,customers,switcher,Modal,Detail,OperationForm,onCreate,onUpdate,onInvoiceDownload,notify}){
  const nav=[['operations','Operaciones',Ship],['documents','Documentación',FolderOpen],['invoices','Facturas emitidas',FileText]].filter(([module])=>can(profile,module));
  const [page,setPage]=useState(nav[0]?.[0]||''),[mobile,setMobile]=useState(false),[opened,setOpened]=useState(null),[tab,setTab]=useState('summary'),[creating,setCreating]=useState(false),[uploading,setUploading]=useState(false),[direction,setDirection]=useState('ALL');
  useEffect(()=>{window.scrollTo(0,0);},[page]);
  const current=nav.some(([id])=>id===page)?page:nav[0]?.[0]||'';
  const selected=operations.find(op=>op.id===opened),tabs=detailTabs(profile);
  const open=(id,nextTab='summary')=>{if(!tabs.length)return;setOpened(id);setTab(tabs.includes(nextTab)?nextTab:tabs[0]);};
  return <div className="app-shell fresh-shell"><aside className={'sidebar '+(mobile?'mobile-open':'')}><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage(nav[0]?.[0]||'');}}><img src="/brand/logo-dark.png" alt="Atlas Cargo"/><span>PLATAFORMA OPERATIVA</span></a><div className="workspace-select"><span className="workspace-icon"><Building2 size={18}/></span><span><strong>Atlas Cargo SRL</strong><small>Freight Forwarder</small></span></div><div className="nav-label">ESPACIO DE TRABAJO</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={'nav-item '+(current===id?'active':'')} onClick={()=>{setPage(id);setMobile(false);}}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{profile.name.split(' ').slice(0,2).map(s=>s[0]).join('')}</span><div><strong>{profile.name}</strong><small>Freight Forwarder</small></div><ShieldCheck size={17}/></div></div></aside>{mobile&&<button className="mobile-scrim" aria-label="Cerrar menú" onClick={()=>setMobile(false)}/>}
    <div className="main-shell"><header className="topbar operational-topbar"><button className="icon-btn mobile-toggle" aria-label="Abrir menú" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumb">Atlas Cargo <ChevronRight size={14}/><strong>{nav.find(([id])=>id===current)?.[1]||'Mi perfil'}</strong></div>{switcher}<span className="demo-mini">Demo</span></header>
      <main className="main-content ff-main"><div className="page-heading"><div><p className="eyebrow">ATLAS CARGO</p><h1>{nav.find(([id])=>id===current)?.[1]||'Mi perfil'}</h1></div><div className="ff-head-actions">{current==='operations'&&can(profile,'operations','edit')&&<button className="btn primary" onClick={()=>setCreating(true)}><Plus size={17}/>Nuevo embarque</button>}{current==='documents'&&can(profile,'documents','edit')&&<button className="btn primary" onClick={()=>setUploading(true)} disabled={!operations.length}><Upload size={17}/>Cargar documento</button>}</div></div>
        {current==='operations'&&<><div className="client-directions"><div className="segmented">{[['ALL','Todos'],['IMPORT','Importación'],['EXPORT','Exportación']].map(([id,label])=><button key={id} className={direction===id?'active':''} aria-pressed={direction===id} onClick={()=>setDirection(id)}>{label}</button>)}</div></div><ShipmentCollection operations={operations} internal onOpen={open} direction={direction} onDirection={setDirection} showDocuments={can(profile,'documents')}/></>}
        {current==='documents'&&<DocumentBrowser operations={operations} onOpen={open} internal canManage={can(profile,'documents','edit')}/>}
        {current==='invoices'&&<InvoicePanel invoices={invoices} operations={operations} customers={customers} profile={profile} Modal={Modal} onDownload={onInvoiceDownload}/>}
        {!current&&<div className="panel permission-empty"><ShieldCheck size={32}/><h2>Sin módulos habilitados</h2><p>El administrador puede actualizar los permisos de este usuario.</p></div>}
        <footer className="client-footer"><span>Atlas Cargo</span><span>Demostración · Datos de ejemplo</span></footer>
      </main>
    </div>
    {selected&&<Detail op={selected} profile={profile} tab={tab} setTab={setTab} onClose={()=>setOpened(null)} update={(patch,message)=>onUpdate(selected.id,patch,message)} notify={notify}/>}
    {creating&&<OperationForm existing={operations} customers={customers} onClose={()=>setCreating(false)} onSave={operation=>{onCreate(operation);setCreating(false);setPage('operations');setDirection('ALL');}}/>}
    {uploading&&<Modal title="Cargar documentación" onClose={()=>setUploading(false)}><form className="modal-body" onSubmit={e=>{e.preventDefault();const id=new FormData(e.currentTarget).get('operation');setUploading(false);open(id,'documents');}}><label className="field"><span>Embarque</span><select name="operation" required>{operations.map(op=><option key={op.id} value={op.id}>{op.id} · {op.customer}</option>)}</select></label><button className="btn primary full" type="submit">Continuar a documentos</button></form></Modal>}
  </div>;
}
