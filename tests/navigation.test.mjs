import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile('src/overrides.js','utf8');
function restore(initial,query){const context=vm.createContext({S:structuredClone(initial),window:{addEventListener(){}},URLSearchParams});vm.runInContext(source,context);context.query=query;vm.runInContext('restoreSearchFilters(new URLSearchParams(query))',context);return JSON.parse(JSON.stringify(context.S));}
test('Categoría conserva sus filtros al hidratar sin parámetros',()=>{const state={op:'1',tipos:['3'],kw:'',barrios:[]};assert.deepEqual(restore(state,''),state);});
test('Parámetro parcial conserva tipo y localidad de la categoría',()=>{const initial={op:'1',tipos:['3'],barrios:['Open Door'],moneda:'USD'};assert.deepEqual(restore(initial,'hasta=150000'),{...initial,hasta:'150000'});});
test('Parámetro vacío quita un filtro explícitamente y conserva los demás',()=>{assert.deepEqual(restore({op:'1',tipos:['3'],barrios:['Open Door']},'tipos=&op=2'),{op:'2',tipos:[],barrios:['Open Door']});});
test('Filtros múltiples compartidos se restauran completos',()=>{assert.deepEqual(restore({},'tipos=3,13&barrios=Open+Door%7CJauregui&ops=1,2'),{tipos:['3','13'],barrios:['Open Door','Jauregui'],ops:['1','2']});});
