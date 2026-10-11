'use client';
import {useState} from 'react';import {record} from '../inventory/contracts';import {adminFailure} from '@/lib/admin/transport/result';import s from '../inventory/Workstation.module.css';
interface SaleState {sellable:boolean;status:string;blockers:string[];warnings:string[];price:string;availableStock:number;}
function parseState(value:unknown,productId:string,variantId:string):SaleState|null{
 if(!record(value)||value.productId!==productId||typeof value.sellable!=='boolean'||typeof value.status!=='string'||!Array.isArray(value.blockers)||!value.blockers.every(x=>typeof x==='string')||!Array.isArray(value.warnings)||!value.warnings.every(x=>typeof x==='string')||!Array.isArray(value.variants))return null;
 const variant=value.variants.find(v=>record(v)&&v.id===variantId);
 if(!record(variant)||typeof variant.price!=='string'||!variant.price.trim()||!Number.isFinite(Number(variant.price))||typeof variant.availableStock!=='number'||!Number.isFinite(variant.availableStock))return null;
 return {sellable:value.sellable,status:value.status,blockers:value.blockers,warnings:value.warnings,price:variant.price,availableStock:variant.availableStock};
}
export function SaleStateValidation({productId,variantId}:{productId:string;variantId:string}){
 const[busy,setBusy]=useState(false);const[state,setState]=useState<SaleState|null>(null);const[error,setError]=useState<string|null>(null);const[uncertain,setUncertain]=useState(false);
 async function validate(){if(busy||uncertain)return;setBusy(true);setError(null);setState(null);
 try{const response=await fetch('/api/admin/products/'+encodeURIComponent(productId)+'/validate-sellability',{method:'POST'});let value:unknown;try{value=await response.json();}catch{value=null;}
 if(!response.ok){setError(adminFailure(response.status,value).error);if(response.status>=500)setUncertain(true);}
 else{const parsed=parseState(value,productId,variantId);if(parsed)setState(parsed);else{setError('El servicio devolvió una respuesta inválida; no se confirma el estado de venta.');setUncertain(true);}}
 }catch{setError('Conexión interrumpida. No se confirma el estado ni se repite automáticamente la validación auditada.');setUncertain(true);}finally{setBusy(false);}}
 return <div className={s.form}><button type="button" className={s.button} disabled={busy||uncertain} onClick={validate}>{busy?'Validando…':'Validar estado de venta'}</button>
 {error?<p role="alert" className={s.error}>{error}</p>:null}
 {state?<section role="status" className={state.sellable?s.success:s.notice}><strong>{state.sellable?'Vendible':'Venta bloqueada'} · {state.status}</strong><p>Precio persistido de la variante: {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP'}).format(Number(state.price))}</p><p>Stock disponible según el contrato actual: {state.availableStock}</p>{state.blockers.length?<><h3>Bloqueos</h3><ul>{state.blockers.map(x=><li key={x}>{x}</li>)}</ul></>:null}{state.warnings.length?<><h3>Advertencias</h3><ul>{state.warnings.map(x=><li key={x}>{x}</li>)}</ul></>:null}<p>La lectura evalúa el producto persistido; no modifica pedidos ni reserva inventario. La política de elegibilidad de bodegas inactivas continúa pendiente.</p></section>:null}
 {uncertain?<a className={s.link} href={'/admin/precios/'+encodeURIComponent(variantId)}>Recargar contexto de precio</a>:null}
 </div>;
}
