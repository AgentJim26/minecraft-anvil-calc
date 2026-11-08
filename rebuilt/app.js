let ITEMS=[],ENCH=[],state={items:[],next:0,
  settings:{java_edition:false,allow_multiple_armor_enhancements:false}};
const $=id=>document.getElementById(id);
const ROMAN={1:"I",2:"II",3:"III",4:"IV",5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X"};
const rn=n=>ROMAN[n]||(""+n);
const dName=n=>(ITEMS.find(i=>i.name===n)||{}).display_name||n;
const eName=n=>(ENCH.find(e=>e.name===n)||{}).display_name||n;

async function load(){
  ITEMS=await (await fetch("data/items.json")).json();
  ENCH=await (await fetch("data/enchantments.json")).json();
  const pr=await (await fetch("data/sword_sharpness_preset.json")).json().catch(()=>[]);
  buildItemSelect();buildPresetSelect();render();
}
function effSpec(e){
  if(state.settings.java_edition&&e.java_overrides)
    return {...e,...e.java_overrides};
  return e;
}
function buildItemSelect(){
  const cur=state.items.find(i=>i.name!=="book");
  const list=ITEMS.filter(i=>!cur||i.name===cur.name||i.name==="book");
  $("addItem").innerHTML=list.map(i=>
    `<option value="${i.name}">${i.display_name}</option>`).join("");
}
const PRESETS=[
 ["clear","Clear"],["helmet","Helmet"],["chestplate","Chestplate"],
 ["leggings","Leggings"],["boots","Boots"],
 ["sword_sharpness","Sword (Sharpness)"],
 ["axe_sharpness","Axe (Sharpness)"],
 ["mace_breach","Mace (Breach)"],["spear","Spear"],
 ["bow","Bow"],["crossbow_multishot","Crossbow (Multishot)"],
 ["crossbow_piercing","Crossbow (Piercing)"],
 ["trident_channeling","Trident (Channeling)"],
 ["trident_riptide","Trident (Riptide)"],
 ["pickaxe_fortune","Pickaxe (Fortune)"],
 ["pickaxe_silk_touch","Pickaxe (Silk Touch)"],
 ["shovel_fortune","Shovel (Fortune)"],
 ["shovel_silk_touch","Shovel (Silk Touch)"],
 ["hoe_fortune","Hoe (Fortune)"],
 ["hoe_silk_touch","Hoe (Silk Touch)"],
 ["brush","Brush"],["elytra","Elytra"]];
function buildPresetSelect(){
  $("preset").innerHTML=PRESETS.map(p=>
    `<option value="${p[0]}">${p[1]}</option>`).join("");
}
async function setPreset(){
  const v=$("preset").value;
  if(v==="clear"){state.items=[];state.next=0;render();return;}
  const data=await (await fetch(`data/${v}_preset.json`)).json();
  state.items=data.map((d,i)=>({name:d.name,penalty:d.penalty||0,
    index:i,enchantments:d.enchantments||[]}));
  state.next=state.items.length;
  render();
}
function addItem(){
  const v=$("addItem").value;
  if(!v)return;
  state.items.push({name:v,enchantments:[],index:state.next++,penalty:0});
  render();
}
function delItem(idx){state.items=state.items.filter(i=>i.index!==idx);render();}
function compatOpts(item){
  return ENCH.map(effSpec).filter(e=>
    !item.enchantments.some(x=>x.name===e.name)&&
    compatible(withSpecs(item,ENCH),e,state.settings)&&
    (state.settings.java_edition||!e.java_only))
    .map(e=>`<option value="${e.name}">${e.display_name}</option>`).join("");
}
function addEnch(idx,sel){
  if(!sel.value)return;
  const it=state.items.find(i=>i.index===idx);
  const spec=ENCH.find(e=>e.name===sel.value);
  it.enchantments.push({name:sel.value,
    level:spec.base_max_level??spec.max_level});
  render();
}
function delEnch(idx,name){
  const it=state.items.find(i=>i.index===idx);
  it.enchantments=it.enchantments.filter(e=>e.name!==name);
  render();
}
function chLvl(idx,name,v){
  const it=state.items.find(i=>i.index===idx);
  it.enchantments.find(e=>e.name===name).level=+v||1;
  run();
}
function chPen(idx,v){
  state.items.find(i=>i.index===idx).penalty=+v||0;
  run();
}
function fmtItem(it){
  if(!it)return "?";
  const es=(it.enchantments||[]).map(e=>`${eName(e.name)} ${rn(e.level)}`).join(", ");
  return `${dName(it.name)}${es?" — "+es:""}`;
}
function render(){
  buildItemSelect();
  const box=$("items");
  box.innerHTML=state.items.length?"":`<p class="status">Add an item or pick a preset above.</p>`;
  state.items.forEach(it=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML=
     `<div class="item-h"><span style="font-size:22px">${it.name==="book"?"📕":"⛏️"}</span>
      <b>${dName(it.name)}</b><span class="pill">penalty ${it.penalty||0}</span>
      <button class="ghost" onclick="delItem(${it.index})">✕</button></div>
      <div class="row" style="margin:8px 0">
        <label style="font-size:12px;color:var(--dim)">Prior work
        <input type="number" min="0" value="${it.penalty||0}"
          onchange="chPen(${it.index},this.value)" style="width:64px"></label>
        <select onchange="addEnch(${it.index},this)">
          <option value="">+ enchant…</option>${compatOpts(it)}</select>
      </div>
      ${it.enchantments.map(e=>`<div class="ench"><span>${eName(e.name)}
        <small>L${e.level}</small></span>
        <input type="number" min="1" value="${e.level}"
          onchange="chLvl(${it.index},'${e.name}',this.value)">
        <button class="ghost" onclick="delEnch(${it.index},'${e.name}')">✕</button>
        </div>`).join("")}`;
    box.appendChild(div);
  });
  run();
}
let timer=null;
function run(){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(!state.items.length){
      $("kCost").textContent="—";$("kXp").textContent="—";
      $("steps").innerHTML="";$("status").textContent="";return;
    }
    $("status").textContent="Calculating…";
    setTimeout(()=>{
      const r=combineItems(JSON.parse(JSON.stringify(state.items)),
        state.settings,ENCH);
      if(r.error){
        $("status").textContent=r.status;
        $("kCost").textContent="—";$("kXp").textContent="—";
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
         <td><b>${s.stepCost}</b> lvls <small>(${Math.round(levelToXP(s.stepCost)).toLocaleString()} xp)</small></td></tr>`
      ).join("");
      const u=new URL(location.href);
      u.searchParams.set("items",JSON.stringify(state.items));
      history.replaceState(null,"",u);
    },30);
  },120);
}
load();
