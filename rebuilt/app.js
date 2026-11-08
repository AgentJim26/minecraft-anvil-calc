let ITEMS=[],ENCH=[],state={items:[],next:0,
  settings:{java_edition:false,allow_multiple_armor_enhancements:false}};
const $=id=>document.getElementById(id);
const ROMAN={1:"I",2:"II",3:"III",4:"IV",5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X"};
const rn=n=>ROMAN[n]||(""+n);
const dName=n=>(ITEMS.find(i=>i.name===n)||{}).display_name||n;
const eName=n=>(ENCH.find(e=>e.name===n)||{}).display_name||n;
function icon(name,sz){
  const spec=ITEMS.find(i=>i.name===name)||{};
  const f=spec.image||(name+".png");
  return `<img src="item_images/${f}" alt="${name}" width="${sz||28}" height="${sz||28}"
    style="image-rendering:pixelated;vertical-align:middle" onerror="this.style.display='none'">`;
}
async function load(){
  ITEMS=await (await fetch("data/items.json")).json();
  ENCH=await (await fetch("data/enchantments.json")).json();
  makeCombo("addItemWrap",addItemChoices(),v=>{addItemVal=v;});
  makeCombo("presetWrap",PRESETS.map(p=>({value:p[0],label:p[1]})),v=>{presetVal=v;});
  const q=new URLSearchParams(location.search).get("items");
  if(q){try{state.items=JSON.parse(q);state.next=state.items.length;}catch(e){}}
  render();
}
let addItemVal="",presetVal="";
// Searchable combobox: text input filters a dropdown list
function makeCombo(wrapId,choices,onPick){
  const wrap=$(wrapId);
  wrap.innerHTML=`<input class="combo-in" placeholder="Type to search…" autocomplete="off">
    <div class="combo-list"></div>`;
  const inp=wrap.querySelector("input"),list=wrap.querySelector(".combo-list");
  let val="";
  function draw(f){
    const hits=choices.filter(c=>c.label.toLowerCase().includes(f.toLowerCase())).slice(0,12);
    list.innerHTML=hits.length?hits.map(h=>
      `<div class="combo-hit" data-v="${h.value}">${h.icon||""} ${h.label}</div>`.replace("${h.icon||''}",h.icon||"")
    ).join(""):`<div class="combo-hit dim">No match</div>`;
    list.style.display="block";
    list.querySelectorAll(".combo-hit[data-v]").forEach(el=>el.onclick=()=>{
      val=el.dataset.v;inp.value=el.textContent.trim();
      list.style.display="none";onPick(val);
    });
  }
  inp.onfocus=()=>{refresh();draw(inp.value);};
  inp.oninput=()=>{val="";onPick("");draw(inp.value);};
  inp.onblur=()=>setTimeout(()=>list.style.display="none",150);
  function refresh(){
    const cur=state.items.find(i=>i.name!=="book");
    let ch=choices;
    if(wrapId==="addItemWrap")
      ch=ITEMS.filter(i=>!cur||i.name===cur.name||i.name==="book")
        .map(i=>({value:i.name,label:i.display_name,icon:icon(i.name,20)}));
    wrap._refresh=()=>{choices=ch;};
    choices=ch;
  }
  wrap._refresh=refresh;refresh();
}
function addItemChoices(){
  return ITEMS.map(i=>({value:i.name,label:i.display_name,icon:icon(i.name,20)}));
}
const PRESETS=[
 ["clear","Clear"],["helmet","Helmet"],["chestplate","Chestplate"],
 ["leggings","Leggings"],["boots","Boots"],
 ["sword_sharpness","Sword (Sharpness)"],["axe_sharpness","Axe (Sharpness)"],
 ["mace_breach","Mace (Breach)"],["spear","Spear"],
 ["bow","Bow"],["crossbow_multishot","Crossbow (Multishot)"],
 ["crossbow_piercing","Crossbow (Piercing)"],
 ["trident_channeling","Trident (Channeling)"],
 ["trident_riptide","Trident (Riptide)"],
 ["pickaxe_fortune","Pickaxe (Fortune)"],["pickaxe_silk_touch","Pickaxe (Silk Touch)"],
 ["shovel_fortune","Shovel (Fortune)"],["shovel_silk_touch","Shovel (Silk Touch)"],
 ["hoe_fortune","Hoe (Fortune)"],["hoe_silk_touch","Hoe (Silk Touch)"],
 ["brush","Brush"],["elytra","Elytra"]];
function effSpec(e){
  if(state.settings.java_edition&&e.java_overrides)return {...e,...e.java_overrides};
  return e;
}
async function setPreset(){
  const v=presetVal;if(!v)return;
  if(v==="clear"){state.items=[];state.next=0;render();return;}
  const data=await (await fetch(`data/${v}_preset.json`)).json();
  state.items=data.map((d,i)=>({name:d.name,penalty:d.penalty||0,index:i,enchantments:d.enchantments||[]}));
  state.next=state.items.length;render();
}
function addItem(){
  if(!addItemVal)return;
  state.items.push({name:addItemVal,enchantments:[],index:state.next++,penalty:0});
  addItemVal="";render();
}
function quickAdd(name){
  const cur=state.items.find(i=>i.name!=="book");
  if(cur&&name!==cur.name&&name!=="book")return;
  state.items.push({name,enchantments:[],index:state.next++,penalty:0});
  render();
}
function delItem(idx){state.items=state.items.filter(i=>i.index!==idx);render();}
function compatList(item){
  return ENCH.map(effSpec).filter(e=>
    !item.enchantments.some(x=>x.name===e.name)&&
    compatible(withSpecs(item,ENCH),e,state.settings)&&
    (state.settings.java_edition||!e.java_only));
}
function addEnch(idx,val){
  if(!val)return;
  const it=state.items.find(i=>i.index===idx);
  const spec=ENCH.find(e=>e.name===val);
  it.enchantments.push({name:val,level:spec.base_max_level??spec.max_level});
  render();
}
function delEnch(idx,name){
  const it=state.items.find(i=>i.index===idx);
  it.enchantments=it.enchantments.filter(e=>e.name!==name);render();
}
function chLvl(idx,name,v){
  const it=state.items.find(i=>i.index===idx);
  it.enchantments.find(e=>e.name===name).level=Math.max(1,+v||1);run();
}
function chPen(idx,v){state.items.find(i=>i.index===idx).penalty=Math.max(0,+v||0);run();}
function fmtItem(it){
  if(!it)return "?";
  const es=(it.enchantments||[]).map(e=>`${eName(e.name)} ${rn(e.level)}`).join(", ");
  return `${icon(it.name,22)} ${dName(it.name)}${es?" — "+es:""}`;
}
function render(){
  document.querySelectorAll("#addItemWrap,#presetWrap").forEach(w=>w._refresh&&w._refresh());
  const cur=state.items.find(i=>i.name!=="book");
  const grid=$("quickGrid");
  grid.innerHTML=ITEMS.filter(i=>!cur||i.name===cur.name||i.name==="book").map(i=>
    `<button class="qit" onclick="quickAdd('${i.name}')" title="${i.display_name}">
     ${icon(i.name,32)}<span>${i.display_name}</span></button>`).join("");
  const box=$("items");
  box.innerHTML=state.items.length?"":`<p class="status">Pick an item below, or search + Add above.</p>`;
  state.items.forEach(it=>{
    const div=document.createElement("div");div.className="item";
    const enchOpts=compatList(it).map(e=>`<option value="${e.name}">${e.display_name}</option>`).join("");
    div.innerHTML=
     `<div class="item-h">${icon(it.name,36)}
      <b>${dName(it.name)}</b><span class="pill">prior ${it.penalty||0}</span>
      <button class="ghost" onclick="delItem(${it.index})">✕</button></div>
      <div class="row" style="margin:8px 0">
        <label style="font-size:12px;color:var(--dim)">Prior work
        <input type="number" min="0" value="${it.penalty||0}"
          onchange="chPen(${it.index},this.value)" style="width:64px"></label>
      </div>
      <div class="combo-wrap-inline" id="ce${it.index}"></div>
      ${it.enchantments.map(e=>`<div class="ench"><span>${eName(e.name)}
        <small>${rn(e.level)}</small></span>
        <input type="number" min="1" value="${e.level}"
          onchange="chLvl(${it.index},'${e.name}',this.value)">
        <button class="ghost" onclick="delEnch(${it.index},'${e.name}')">✕</button>
        </div>`).join("")}`;
    box.appendChild(div);
    makeCombo("ce"+it.index,compatList(it).map(e=>({value:e.name,label:e.display_name})),
      v=>addEnch(it.index,v));
  });
  run();
}
let timer=null;
function run(){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(!state.items.length){
      $("kCost").textContent="—";$("kXp").textContent="—";$("kSteps").textContent="—";
      $("steps").innerHTML="";$("status").textContent="";return;
    }
    $("status").textContent="Calculating…";
    setTimeout(()=>{
      const r=combineItems(JSON.parse(JSON.stringify(state.items)),state.settings,ENCH);
      if(r.error){
        $("status").textContent=r.status;
        $("kCost").textContent="—";$("kXp").textContent="—";$("kSteps").textContent="—";
        $("steps").innerHTML="";return;
      }
      $("status").textContent="";
      $("kCost").textContent=r.cost;
      const xp=r.steps.reduce((a,s)=>a+levelToXP(s.stepCost),0);
      $("kXp").textContent=Math.round(xp).toLocaleString();
      $("kSteps").textContent=r.steps.length;
      $("steps").innerHTML=r.steps.map((s,i)=>
        `<tr><td class="step-n">${i+1}</td>
         <td>${fmtItem(s.targetItem)}</td>
         <td>+ ${fmtItem(s.sacrificeItem)}</td>
         <td><b>${s.stepCost}</b> <small>(${Math.round(levelToXP(s.stepCost)).toLocaleString()} xp)</small></td></tr>`
      ).join("");
      const u=new URL(location.href);
      u.searchParams.set("items",JSON.stringify(state.items));
      history.replaceState(null,"",u);
    },30);
  },120);
}
load();
