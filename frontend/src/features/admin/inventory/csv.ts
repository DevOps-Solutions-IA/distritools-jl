/** Spreadsheet formula protection on downloaded inventory text; preserves numeric balances. */
export function safeInventoryCsv(text:string):string {
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;let closed=false;
 for(let i=0;i<text.length;i++){
 const c=text[i];
 if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'&&!cell&&!closed){quoted=true;continue;}
 if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}continue;}
 if(closed)throw new Error('Invalid CSV after closing quote');cell+=c;
 }
 if(quoted)throw new Error('Unclosed CSV field');if(cell||row.length){row.push(cell);rows.push(row);}
 if(!rows.length||rows[0][0]!=='sku')throw new Error('Invalid inventory CSV header');
 return rows.map((cells,index)=>cells.map(value=>{
 const numeric=/^-?\d+(\.\d+)?$/.test(value);
 const safe=index>0&&!numeric&&/^[\s]*[=+\-@\t\r]/.test(value)?"'"+value:value;
 return /[",\n\r]/.test(safe)?'"'+safe.replaceAll('"','""')+'"':safe;
 }).join(',')).join('\n');
}
