import {describe,it,expect} from 'vitest';import {safeInventoryCsv} from '@/features/admin/inventory/csv';
describe('Inventory CSV download boundary',()=>{
 it('protects formula-leading names without changing numeric stock',()=>expect(safeInventoryCsv('sku,product,quantity\nQA,=HYPERLINK("x"),-2')).toContain("'=HYPERLINK"));
 it('preserves quoted commas and embedded newlines',()=>expect(safeInventoryCsv('sku,product\nQA,"Tool, industrial\nline"')).toBe('sku,product\nQA,"Tool, industrial\nline"'));
 it('preserves escaped quotes in a quoted name',()=>expect(safeInventoryCsv('sku,product\nQA,"Tool ""JL"""')).toBe('sku,product\nQA,"Tool ""JL"""'));
 it('rejects malformed quotes rather than download corrupted CSV',()=>expect(()=>safeInventoryCsv('sku,product\nQA,"broken')).toThrow());
 it('protects whitespace, tab, plus, minus and at sign formula entries',()=>{for(const v of [' +SUM(1)','@A1','-cmd','\t=SUM(1)'])expect(safeInventoryCsv('sku,product\nQA,'+v)).toContain("'");});
});
