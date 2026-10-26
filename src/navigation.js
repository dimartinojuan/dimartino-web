(function(root){
  const operationNames={'1':'En venta','2':'En alquiler','3':'Alquiler temporal'};
  const typeNames={'1':'Terrenos y lotes','2':'Departamentos','3':'Casas','4':'Quintas','5':'Oficinas','7':'Locales','9':'Campos','10':'Cocheras','13':'PH','14':'Depósitos','24':'Galpones','31':'Monoambientes'};
  function safeReturn(value,base){
    if(!value||value.length>6000)return '';
    try{const u=new URL(value,'https://navigation.invalid');if(u.origin!=='https://navigation.invalid')return '';const path=u.pathname.slice(base.length);if(!u.pathname.startsWith(base)||!/^(propiedades|casas-en-venta-lujan|alquileres-lujan|terrenos-en-venta-lujan|propiedades-jauregui|propiedades-open-door)\/(?:pagina\/\d+\/)?$/.test(path))return '';return u.pathname+u.search;}catch{return '';}
  }
  function resultURL(path,from,base,op=''){
    const back=safeReturn(from,base);if(!back)return path;
    const query=new URLSearchParams({from:back});if(op)query.set('op',op);return path+'?'+query;
  }
  function trail(property,base,operation=''){
    const available=property.operations||[],ids={Sale:'1',Rent:'2','Temporary Rental':'3'};
    const op=available.some(o=>ids[o.operation_type]===operation)?operation:ids[available[0]?.operation_type]||'';
    const params=new URLSearchParams();if(op)params.set('op',op);
    const search=()=>base+'propiedades/'+(params.size?'?'+params:'');
    const items=[{name:'Inicio',href:base},{name:'Propiedades',href:base+'propiedades/'}];
    if(op)items.push({name:operationNames[op],href:search()});
    params.set('tipos',String(property.type.id));
    const category=op==='1'&&property.type.id===3?base+'casas-en-venta-lujan/':op==='1'&&property.type.id===1?base+'terrenos-en-venta-lujan/':search();
    items.push({name:typeNames[property.type.id]||property.type.label,href:category});
    if(property.location?.name){params.set('barrios',property.location.name);items.push({name:property.location.name,href:search()});}
    return items;
  }
  root.DMNavigation={safeReturn,resultURL,trail};
})(globalThis);
