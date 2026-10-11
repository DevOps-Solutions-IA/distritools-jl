'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { parseMutation, validateAdjustment, type AdjustmentOption } from './contracts';
import { adminFailure } from '@/lib/admin/transport/result';
import s from './Workstation.module.css';
export function StockAdjustForm({rows}:{rows:AdjustmentOption[]}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [uncertain,setUncertain]=useState(false);const [feedback,setFeedback]=useState<{ok:boolean;text:string}|null>(null);const [reference,setReference]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy||uncertain)return;const form=new FormData(event.currentTarget);const item=rows.find(r=>r.id===form.get('item'));if(!item)return;
 const payload={variantId:item.variantId,warehouseId:item.warehouseId,quantityDelta:Number(form.get('delta')),reason:String(form.get('reason')??''),referenceId:reference||crypto.randomUUID()};
 const error=validateAdjustment(payload);if(error){setFeedback({ok:false,text:error});return;}setReference(payload.referenceId);setBusy(true);setFeedback(null);
 try{const response=await fetch('/api/admin/inventory/adjust',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let data:unknown;try{data=await response.json();}catch{data=null;}
 if(!response.ok){const failure=adminFailure(response.status,data);if(response.status>=500)setUncertain(true);setFeedback({ok:false,text:response.status>=500?'Resultado incierto. Consulte el kardex con esta referencia antes de realizar otro ajuste.':failure.error});}
 else if(!parseMutation('adjust',data,item.variantId)){setUncertain(true);setFeedback({ok:false,text:'Respuesta inválida. Verifique el kardex antes de otro ajuste.'});}
 else{setFeedback({ok:true,text:'Ajuste confirmado. El saldo y el movimiento están registrados.'});setReference('');router.refresh();}
 }catch{setUncertain(true);setFeedback({ok:false,text:'Conexión interrumpida. Verifique el kardex con la referencia; no se reenviará el ajuste.'});}finally{setBusy(false);}}
 return <form onSubmit={submit} className={s.form} aria-label="Ajustar stock">
 <label className={s.field}>Variante y bodega<select name="item" required disabled={busy||uncertain}>{rows.map(r=><option key={r.id} value={r.id}>{r.sku} · {r.warehouseCode} · disponible {r.availableStock}</option>)}</select></label>
 <label className={s.field}>Variación de unidades<input name="delta" type="number" step="1" required disabled={busy||uncertain}/></label>
 <label className={s.field}>Motivo del ajuste<input name="reason" required maxLength={500} disabled={busy||uncertain}/></label>
 <p className={s.muted}>El ajuste suma o resta stock físico. Las reservas y compromisos permanecen protegidos.</p>
 {reference?<p className={s.muted}>Referencia: <code>{reference}</code></p>:null}
 {feedback?<p role={feedback.ok?'status':'alert'} className={feedback.ok?s.success:s.error}>{feedback.text}</p>:null}
 <button className={s.button} disabled={busy||uncertain||!rows.length}>{busy?'Registrando…':'Registrar ajuste'}</button>
 {uncertain?<a className={s.link} href={'/admin/inventario/historial?referenceType=adjustment&referenceId='+encodeURIComponent(reference)}>Consultar resultado en kardex</a>:null}
 </form>;
}
