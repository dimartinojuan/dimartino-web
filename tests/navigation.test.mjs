import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import '../src/navigation.js';
const base='/dimartino-web/';
const house={type:{id:3,label:'Casa'},location:{name:'San Cayetano (Lujan)'},operations:[{operation_type:'Sale'},{operation_type:'Rent'}]};
test('Ficha enlaza venta, casas y localidad con filtros acumulados',()=>{const items=DMNavigation.trail(house,base);assert.deepEqual(items.map(x=>x.name),['Inicio','Propiedades','En venta','Casas','San Cayetano (Lujan)']);assert.equal(items[3].href,base+'casas-en-venta-lujan/');const params=new URL(items[4].href,'https://example.com').searchParams;assert.equal(params.get('op'),'1');assert.equal(params.get('tipos'),'3');assert.equal(params.get('barrios'),'San Cayetano (Lujan)');});
test('Ficha con dos operaciones respeta la operación elegida',()=>{const items=DMNavigation.trail(house,base,'2');assert.equal(items[2].name,'En alquiler');assert.ok(items[3].href.includes('op=2'));});
test('Enlace a ficha transporta la búsqueda completa sin perder filtros',()=>{const from=base+'propiedades/?op=1&tipos=3&hasta=100000&moneda=USD&barrios=Open+Door';const result=new URL(DMNavigation.resultURL(base+'propiedades/259447/',from,base,'1'),'https://example.com');assert.equal(result.searchParams.get('from'),from);assert.equal(result.searchParams.get('op'),'1');});
test('Retorno admite categorías y sus páginas, y rechaza destinos externos',()=>{assert.equal(DMNavigation.safeReturn(base+'casas-en-venta-lujan/pagina/2/',base),base+'casas-en-venta-lujan/pagina/2/');for(const value of ['https://example.com/','//example.com/','javascript:alert(1)',base+'propiedades/259447/','/otro/propiedades/'])assert.equal(DMNavigation.safeReturn(value,base),'');});
const source=await fs.readFile('src/overrides.js','utf8');
function restore(initial,query){const context=vm.createContext({S:structuredClone(initial),window:{addEventListener(){}},URLSearchParams});vm.runInContext(source,context);context.query=query;vm.runInContext('restoreSearchFilters(new URLSearchParams(query))',context);return JSON.parse(JSON.stringify(context.S));}
test('Categoría conserva sus filtros al hidratar sin parámetros',()=>{const state={op:'1',tipos:['3'],kw:'',barrios:[]};assert.deepEqual(restore(state,''),state);});
test('Parámetro parcial conserva tipo y localidad de la categoría',()=>{const initial={op:'1',tipos:['3'],barrios:['Open Door'],moneda:'USD'};assert.deepEqual(restore(initial,'hasta=150000'),{...initial,hasta:'150000'});});
test('Parámetro vacío quita un filtro explícitamente y conserva los demás',()=>{assert.deepEqual(restore({op:'1',tipos:['3'],barrios:['Open Door']},'tipos=&op=2'),{op:'2',tipos:[],barrios:['Open Door']});});
test('Filtros múltiples compartidos se restauran completos',()=>{assert.deepEqual(restore({},'tipos=3,13&barrios=Open+Door%7CJauregui&ops=1,2'),{tipos:['3','13'],barrios:['Open Door','Jauregui'],ops:['1','2']});});
