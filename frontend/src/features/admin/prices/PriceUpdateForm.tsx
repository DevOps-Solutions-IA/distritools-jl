'use client';
import {useState,type FormEvent} from 'react';import {useRouter} from 'next/navigation';
import {validatePrice,parseMutation} from '../inventory/contracts';import {adminFailure} from '@/lib/admin/transport/result';import s from '../inventory/Workstation.module.css';
export function PriceUpdateForm({variantId,currentPrice}:{variantId:string;currentPrice:string}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[uncertain,setUncertain]=useState(false);const[feedback,setFeedback]=useState<{ok:boolean;text:string}|null>(null);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy||uncertain)return;const form=new FormData(e.currentTarget);const price=String(form.get('price')??''),reason=String(form.get('reason')??'');const invalid=validatePrice(price,reason);if(invalid){setFeedback({ok:false,text:invalid});return;}
 setBusy(true);setFeedback(null);try{const response=await fetch('/api/admin/prices/'+encodeURIComponent(variantId),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({price,reason})});let data:unknown;try{data=await response.json();}catch{data=null;}
 if(!response.ok){if(response.status>=500)setUncertain(true);setFeedback({ok:false,text:response.status>=500?'Resultado incierto. Recargue y consulte el historial antes de otro cambio.':adminFailure(response.status,data).error});}
 else if(!parseMutation('price',data,variantId)){setUncertain(true);setFeedback({ok:false,text:'Respuesta inválida. Verifique el precio persistido y su historial.'});}
 else{setFeedback({ok:true,text:'Precio confirmado y auditado.'});router.refresh();}
 }catch{setUncertain(true);setFeedback({ok:false,text:'Conexión interrumpida. Verifique el precio e historial antes de repetir el cambio.'});}finally{setBusy(false);}}
 return <form className={s.form} onSubmit={submit} aria-label="Cambiar precio">
 <label className={s.field}>Nuevo precio (COP)<input name="price" type="number" step="0.01" min="0.01" defaultValue={currentPrice} required disabled={busy||uncertain}/></label>
 <label className={s.field}>Motivo del cambio<input name="reason" required maxLength={500} disabled={busy||uncertain}/></label>
 {feedback?<p role={feedback.ok?'status':'alert'} className={feedback.ok?s.success:s.error}>{feedback.text}</p>:null}
 <button className={s.button} disabled={busy||uncertain}>{busy?'Guardando…':'Guardar precio'}</button>
 {uncertain?<a className={s.link} href={'/admin/precios/'+encodeURIComponent(variantId)}>Consultar precio e historial</a>:null}
 </form>;
}
