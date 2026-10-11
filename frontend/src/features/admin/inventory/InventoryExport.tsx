'use client';
import {useState} from 'react';import {adminFailure} from '@/lib/admin/transport/result';import s from './Workstation.module.css';
export function InventoryExport(){const[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 async function download(){if(busy)return;setBusy(true);setError(null);try{const response=await fetch('/api/admin/inventory/export',{cache:'no-store'});
 if(!response.ok){setError(adminFailure(response.status).error);return;}
 if(!response.headers.get('content-type')?.startsWith('text/csv')){setError('La respuesta no es un archivo CSV de inventario.');return;}
 const text=await response.text();if(!text.startsWith('sku,product,')||!text.trim()){setError('El servicio devolvió un archivo inválido.');return;}
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv; charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='inventory-export.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{setError('No se pudo descargar el inventario. No se iniciaron reintentos automáticos.');}finally{setBusy(false);}}
 return <div className={s.form}><button className={s.button} type="button" disabled={busy} onClick={download}>{busy?'Preparando CSV…':'Descargar inventario CSV'}</button>{error?<p role="alert" className={s.error}>{error}</p>:null}</div>;
}
