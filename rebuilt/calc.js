// Anvil calc core — ported from aviettran/minecraft-anvil-calc utils/item.ts
function levelToXP(l){
  if(l<17) return l*l+6*l;
  if(l<31) return 2.5*l*l-40.5*l+360;
  return 4.5*l*l-162.5*l+2220;
}
function enchSpec(ENCH,name){return ENCH.find(e=>e.name===name);}
function withSpecs(item,ENCH){
  return {...item,enchantments:item.enchantments.map(e=>
    ({...e,specification:enchSpec(ENCH,e.name)}))};
}
function preservedOk(sacEnch,filtered){
  const removed=sacEnch.filter(e=>!filtered.includes(e));
  return !removed.some(e=>e.preserve);
}
function compatible(target,spec,settings){
  const conflict=target.enchantments.some(s=>
    s.specification&&s.name!==spec.name&&
    s.specification.group&&spec.group&&
    s.specification.group===spec.group&&
    !(s.specification.group_exception&&spec.group_exception&&
      s.specification.group_exception===spec.group_exception)&&
    !(s.specification.group==="protection"&&
      settings.allow_multiple_armor_enhancements));
  if(conflict) return false;
  return spec.applies_to.includes(target.name)||target.name==="book";
}
function mult(item,spec,java){
  if(java) return item.name==="book"
    ?(spec.java_overrides?.book_multiplier??spec.book_multiplier)
    :(spec.java_overrides?.item_multiplier??spec.item_multiplier);
  return item.name==="book"?spec.book_multiplier:spec.item_multiplier;
}
function mergeEnch(sacItem,tEnch,sEnch,settings){
  return sEnch.reduce((acc,se)=>{
    const m=mult(sacItem,se.specification,settings.java_edition);
    const hit=acc.out.find(r=>r.name===se.name);
    if(hit){
      const diff=se.level-hit.level;
      if(diff===0&&hit.specification.max_level>hit.level){
        hit.level+=1;se={...se,level:se.level+1};
        if(!settings.java_edition)acc.cost+=1*m;
      }else if(diff>0){
        if(!settings.java_edition)acc.cost+=diff*m;
        hit.level=se.level;
      }
      if(settings.java_edition)acc.cost+=hit.level*m;
    }else{
      acc.out.push({...se});
      acc.cost+=se.level*m;
    }
    return acc;
  },{cost:0,out:[...tEnch]});
}
function anvil(t,s,settings){
  const tp=t.penalty||0,sp=s.penalty||0;
  const filt=s.enchantments.filter(e=>
    e.specification&&compatible(t,e.specification,settings));
  if(!preservedOk(s.enchantments,filt))
    return {error:true,status:"A preserved enchantment would be lost."};
  const mg=mergeEnch(s,t.enchantments,filt,settings);
  const res={...t,enchantments:mg.out};
  const cost=mg.cost+Math.pow(2,tp)-1+Math.pow(2,sp)-1+
    (settings.java_edition?(s.enchantments.length-filt.length):0);
  res.penalty=Math.max(tp,sp)+1;
  return {resultingItem:res,cost,exp:levelToXP(cost),
    steps:[{targetItem:t,sacrificeItem:s,resultingItem:res,stepCost:cost}]};
}
function combineItems(items,settings,ENCH){
  items=items.map(i=>withSpecs(i,ENCH));
  let all=[];
  items.forEach(t=>{
    const nonT=items.filter(x=>x!==t);
    let elig=nonT.filter(x=>x.name==="book"||t.name!=="book");
    if(!elig.length)return;
    if(t.name==="book"){
      elig=[elig.reduce((a,b)=>mergeEnch(b,t.enchantments,b.enchantments,settings).cost<
        mergeEnch(a,t.enchantments,a.enchantments,settings).cost?b:a,elig[0])];
    }
    elig.forEach(s=>{
      let r=anvil(t,s,settings);
      if(r.error)return;
      const rest=nonT.filter(x=>x!==s);
      if(rest.length){
        const rec=combineItems([r.resultingItem,...rest],settings,ENCH);
        if(rec.error)return;
        r={...r,resultingItem:rec.resultingItem,cost:r.cost+rec.cost,
          exp:r.exp+rec.exp,steps:[...r.steps,...rec.steps]};
      }
      all.push(r);
    });
  });
  if(all.length)return all.reduce((a,b)=>b.exp<a.exp?b:a,all[0]);
  return {error:true,status:"No items or items cannot be combined."};
}
