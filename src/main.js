const canvas=document.querySelector('#game');
const ctx=canvas.getContext('2d');
const W=1000,H=570,ROAD=350,GRID=25,STEP=1/60;
const LEVELS=[{title:'Creek',start:250,end:750,budget:650,load:1},{title:'Gorge',start:175,end:825,budget:850,load:1.25},{title:'Wide River',start:100,end:900,budget:1100,load:1.45}];
let levelIndex=0,START=LEVELS[0].start,END=LEVELS[0].end;
const materials={
 wood:{label:'Wood',cost:20,color:'#947653',strength:.13,width:5,stiffness:.88},
 steel:{label:'Steel',cost:55,color:'#aebaba',strength:.30,width:6,stiffness:.96},
 cable:{label:'Cable',cost:35,color:'#77694f',strength:.19,width:2,stiffness:.72,tensionOnly:true},
 aluminum:{label:'Aluminum',cost:45,color:'#829ca1',strength:.23,width:5,stiffness:.9},
 concrete:{label:'Concrete',cost:38,color:'#99988d',strength:.17,width:8,stiffness:.82}
};
let joints=[],beams=[],selected=-1,material='wood',thickness=1,budget=LEVELS[0].budget,unlimited=false,eraseMode=false,mode='build',message='Select an anchor, then add a joint or connect it to the other side.',car={x:START,y:ROAD},route=[],routeDistance=0,failure=null,last=performance.now(),accumulator=0;
const fmt=n=>'$'+Math.round(n).toLocaleString('en-US');
function node(x,y,fixed=false){return{x,y,px:x,py:y,fixed}}
function reset(){joints=[node(START,ROAD,true),node(END,ROAD,true)];beams=[];selected=-1;budget=LEVELS[levelIndex].budget;eraseMode=false;mode='build';route=[];routeDistance=0;failure=null;car={x:START,y:ROAD};message=`${LEVELS[levelIndex].title}: select an anchor, then add a joint or connect it to the other side.`;sync();draw()}
function loadLevel(index){levelIndex=Math.max(0,Math.min(LEVELS.length-1,index));START=LEVELS[levelIndex].start;END=LEVELS[levelIndex].end;reset()}
function costFor(length,mat=material,gauge=thickness){return Math.ceil(length/50)*materials[mat].cost*gauge}
function capacityFor(beam){return materials[beam.material].strength*Math.pow(beam.thickness,1.5)}
function sync(){
 document.querySelector('#budget-label').textContent=unlimited?'BUDGET MODE':'PROJECT BUDGET';
 document.querySelector('#budget').textContent=unlimited?'UNLIMITED':fmt(budget);
 document.querySelector('#message').textContent=message;
 document.querySelector('#level-caption').textContent=`LEVEL ${levelIndex+1} OF ${LEVELS.length}`;
 document.querySelector('#level-select').value=String(levelIndex);
 document.querySelector('#next-level').hidden=mode!=='won'||levelIndex===LEVELS.length-1;
 document.querySelector('#mode').textContent=mode==='build'?'BUILD MODE':mode==='test'?'LOAD TEST':mode==='failed'?'FAILURE':'CROSSING COMPLETE';
 document.querySelector('#test').textContent=mode==='build'?'Test bridge':'Retry';
 document.querySelector('#budget-mode').setAttribute('aria-pressed',String(unlimited));
 document.querySelector('#budget-mode').innerHTML=`Unlimited budget <span>${unlimited?'ON':'OFF'}</span>`;
 document.querySelector('#eraser').setAttribute('aria-pressed',String(eraseMode));
 document.querySelector('#eraser').classList.toggle('active',eraseMode);
 document.querySelectorAll('.material').forEach(b=>b.classList.toggle('active',b.dataset.material===material));
 const totals=Object.fromEntries(Object.keys(materials).map(k=>[k,0]));let total=0;
 for(const b of beams){totals[b.material]+=b.cost;total+=b.cost}
 document.querySelector('#spent').textContent=fmt(total);
 document.querySelector('#breakdown').innerHTML=Object.entries(totals).filter(([,v])=>v>0).map(([k,v])=>`<span>${materials[k].label} ${fmt(v)}</span>`).join('')||'<span>No materials placed</span>';
 const card=document.querySelector('#failure-card');card.hidden=!failure;
 if(failure){document.querySelector('#failure-title').textContent=`Member ${failure.member} failed · ${materials[failure.material].label} · ${failure.thicknessLabel}`;const loadAt=failure.loadX===undefined?'':` Vehicle load at x ${Math.round(failure.loadX)}, y ${Math.round(failure.loadY)}.`;document.querySelector('#failure-detail').textContent=`${failure.reason} near member midpoint x ${Math.round(failure.x)}, y ${Math.round(failure.y)}.${loadAt} Load ${failure.demand.toFixed(2)} exceeded capacity ${failure.capacity.toFixed(2)}.`;document.querySelector('#wear-bar').style.width=`${Math.round(failure.wear*100)}%`;document.querySelector('#wear-label').textContent=`Visible damage at failure · ${Math.round(failure.wear*100)}%`}
}
document.querySelector('#materials').innerHTML=Object.entries(materials).map(([key,m])=>`<button class="material${key===material?' active':''}" data-material="${key}" aria-label="${m.label}, ${fmt(m.cost)} per 50 units"><span class="swatch ${key}"></span><span>${m.label}</span><small>${fmt(m.cost)} / 50</small></button>`).join('');
document.querySelectorAll('.material').forEach(b=>b.addEventListener('click',()=>{if(mode==='build'){material=b.dataset.material;eraseMode=false;sync();draw()}}));
document.querySelector('#thickness').addEventListener('change',e=>{thickness=Number(e.target.value);sync()});
document.querySelector('#budget-mode').addEventListener('click',()=>{if(mode!=='build')return;unlimited=!unlimited;message=unlimited?'Unlimited construction enabled. Material costs are still tracked.':'Budget limit enabled.';sync()});
document.querySelector('#eraser').addEventListener('click',()=>{if(mode!=='build')return;eraseMode=!eraseMode;selected=-1;message=eraseMode?'Erase mode: click a beam or a non-anchor joint to remove it.':'Build mode: select joints to place members.';sync();draw()});
document.querySelector('#reset').addEventListener('click',reset);
document.querySelector('#undo').addEventListener('click',()=>{if(mode!=='build'||!beams.length)return;const b=beams.pop();if(!unlimited)budget+=b.cost;selected=-1;message=`Removed ${materials[b.material].label} beam. ${unlimited?'':fmt(b.cost)+' returned to budget.'}`;sync();draw()});
document.querySelector('#test').addEventListener('click',startTest);
document.querySelector('#level-select').addEventListener('change',e=>loadLevel(Number(e.target.value)));
document.querySelector('#next-level').addEventListener('click',()=>loadLevel(levelIndex+1));
function startTest(){if(mode!=='build'){reset();return}const found=findRoute(true);if(!found){message=findRoute(false)?'No continuous concrete deck. The truck can drive only on concrete; use other materials for supports.':'No connected route yet. Join the two yellow anchors first.';sync();return}route=found;routeDistance=0;car={x:START,y:ROAD};failure=null;beams.forEach(b=>{b.broken=false;b.stress=0;b.wear=0});for(const j of joints){j.px=j.x;j.py=j.y}mode='test';message=`${LEVELS[levelIndex].title} load test in progress. The truck will follow the concrete deck.`;sync()}
function findRoute(concreteOnly=true){const prev=Array(joints.length).fill(-1),q=[0];prev[0]=0;for(let h=0;h<q.length;h++){const n=q[h];if(n===1)break;for(const b of beams){if(b.broken||(concreteOnly&&b.material!=='concrete'))continue;const next=b.a===n?b.b:b.b===n?b.a:-1;if(next>=0&&prev[next]===-1){prev[next]=n;q.push(next)}}}if(prev[1]===-1)return null;const path=[];for(let n=1;n!==0;n=prev[n])path.push(n);path.push(0);return path.reverse()}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function nearest(p){let id=-1,d0=21;joints.forEach((j,i)=>{const d=Math.hypot(j.x-p.x,j.y-p.y);if(d<d0){d0=d;id=i}});return id}
canvas.addEventListener('pointerdown',e=>{if(mode!=='build')return;const p=pointer(e);const n=nearest(p);if(e.button===2||eraseMode){if(n>=0){if(joints[n].fixed){message='Anchor points are fixed and cannot be erased.'}else{const removed=beams.filter(b=>b.a===n||b.b===n);for(const b of removed){if(!unlimited)budget+=b.cost;beams.splice(beams.indexOf(b),1)}joints.splice(n,1);for(const b of beams){if(b.a>n)b.a--;if(b.b>n)b.b--}selected=-1;message=`Joint erased with ${removed.length} attached member${removed.length===1?'':'s'} removed.`}}else{const index=nearestBeam(p);if(index>=0){const [removed]=beams.splice(index,1);if(!unlimited)budget+=removed.cost;selected=-1;message=`${materials[removed.material].label} member erased. ${unlimited?'':fmt(removed.cost)+' returned to budget.'}`}else message='Click a beam or joint to erase it.'}sync();draw();return}if(n>=0){if(selected<0)selected=n;else if(selected===n)selected=-1;else{const duplicate=beams.some(v=>(v.a===selected&&v.b===n)||(v.a===n&&v.b===selected));if(duplicate){message="A member already connects those joints.";selected=-1}else{const a=joints[selected],b=joints[n],length=Math.hypot(a.x-b.x,a.y-b.y),cost=costFor(length),beamThickness=thickness;if(!unlimited&&cost>budget)message='Not enough budget for that beam.';else{const parallelIndex=beams.filter(v=>v.a===selected&&v.b===n||v.a===n&&v.b===selected).length;beams.push({a:selected,b:n,material,cost,thickness:beamThickness,rest:length,parallelIndex,broken:false,stress:0,wear:0});if(!unlimited)budget-=cost;message=`${materials[material].label} member added${parallelIndex?' alongside '+parallelIndex+' existing member'+(parallelIndex===1?'':'s'):''} · ${fmt(cost)}.`}selected=-1}}}else if(p.x>START+15&&p.x<END-15&&p.y>115&&p.y<500){joints.push(node(Math.round(p.x/GRID)*GRID,Math.round(p.y/GRID)*GRID));selected=joints.length-1;message=`Joint placed on ${GRID}-unit grid. Select another joint to connect it.`}sync();draw()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function nearestBeam(p){let best=-1,dist=16;beams.forEach((b,i)=>{const g=beamGeometry(b),dx=g.x2-g.x1,dy=g.y2-g.y1,t=Math.max(0,Math.min(1,((p.x-g.x1)*dx+(p.y-g.y1)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-g.x1-t*dx,p.y-g.y1-t*dy);if(d<dist){dist=d;best=i}});return best}
function beamGeometry(beam){const a=joints[beam.a],b=joints[beam.b],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,peers=beams.filter(v=>v.a===beam.a&&v.b===beam.b||v.a===beam.b&&v.b===beam.a),sameMaterial=peers.filter(v=>v.material===beam.material),index=sameMaterial.indexOf(beam),concreteCount=peers.filter(v=>v.material==='concrete').length;let offset=0;if(beam.material==='concrete'){offset=index*14}else{const supports=peers.filter(v=>v.material!=='concrete'),supportIndex=supports.indexOf(beam);offset=(concreteCount?16:0)+supportIndex*14}let nx=-dy/len,ny=dx/len;if(dx<0||(dx===0&&dy<0)){nx=-nx;ny=-ny}return{x1:a.x+nx*offset,y1:a.y+ny*offset,x2:b.x+nx*offset,y2:b.y+ny*offset}}
window.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=-1;draw()}});
function failBeam(beam,reason,demand,position){beam.broken=true;beam.wear=1;const g=beamGeometry(beam);failure={member:beams.indexOf(beam)+1,material:beam.material,thicknessLabel:beam.thickness===1?'standard':`${beam.thickness}× thickness`,reason,x:(g.x1+g.x2)/2,y:(g.y1+g.y2)/2,loadX:position?.x,loadY:position?.y,demand,capacity:capacityFor(beam),wear:1};mode='failed';message=`${materials[beam.material].label} member ${failure.member} failed under the moving load.`;sync()}
function tick(){if(mode!=='test')return;
 for(const j of joints){if(j.fixed)continue;const vx=(j.x-j.px)*.995,vy=(j.y-j.py)*.995;j.px=j.x;j.py=j.y;j.x+=vx;j.y+=vy+145*STEP*STEP}
 const load=getCarPosition(routeDistance);
 if(load){const [a,b,t]=load;car.x=load[3];car.y=load[4];for(const [id,w] of [[a,1-t],[b,t]])if(!joints[id].fixed)joints[id].py+=.85*w;
  const deck=beams.find(v=>!v.broken&&v.material==='concrete'&&(v.a===a&&v.b===b||v.a===b&&v.b===a));
  if(deck){const len=Math.hypot(joints[a].x-joints[b].x,joints[a].y-joints[b].y),loadFactor=Math.sin(Math.PI*t)**2,demand=(len/100)**2*.04*loadFactor*LEVELS[levelIndex].load,capacity=capacityFor(deck);deck.stress=Math.max(deck.stress,demand);deck.wear=Math.max(deck.wear,Math.min(.98,deck.stress/capacity));if(demand>capacity){failBeam(deck,'Excessive span load',demand,car);return}}
 }
 for(let pass=0;pass<10;pass++){for(const beam of beams){if(beam.broken)continue;const a=joints[beam.a],b=joints[beam.b],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,rest=beam.rest,mat=materials[beam.material],strain=(len-rest)/rest;if(mat.tensionOnly&&strain<0)continue;const demand=mat.tensionOnly?Math.max(0,strain):Math.abs(strain),capacity=capacityFor(beam);beam.stress=Math.max(beam.stress,demand);beam.wear=Math.max(beam.wear,Math.min(.98,demand/capacity));if(demand>capacity){failBeam(beam,strain>=0?'Tension limit exceeded':'Compression limit exceeded',demand);return}const correction=(len-rest)/len*mat.stiffness||.82;let wa=a.fixed?0:1,wb=b.fixed?0:1,sum=wa+wb;if(sum){a.x+=dx*correction*wa/sum;a.y+=dy*correction*wa/sum;b.x-=dx*correction*wb/sum;b.y-=dy*correction*wb/sum}}
 }
 routeDistance+=125*STEP;if(routeDistance>=routeLength()){mode='won';message='Crossing complete. The vehicle reached the opposite bank.';sync()}
 for(const j of joints)if(!j.fixed&&j.y>H+80){j.y=H+80;j.py=j.y}
}
function routeLength(){let n=0;for(let i=1;i<route.length;i++){const a=joints[route[i-1]],b=joints[route[i]];n+=Math.hypot(b.x-a.x,b.y-a.y)}return n}
function getCarPosition(distance){let left=distance;for(let i=1;i<route.length;i++){const a=joints[route[i-1]],b=joints[route[i]],len=Math.hypot(b.x-a.x,b.y-a.y);if(left<=len||i===route.length-1){const t=Math.max(0,Math.min(1,left/(len||1)));return[route[i-1],route[i],t,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t]}left-=len}return null}
function frame(now){accumulator+=Math.min((now-last)/1000,.1);last=now;while(accumulator>=STEP){tick();accumulator-=STEP}draw();requestAnimationFrame(frame)}
function draw(){
 ctx.clearRect(0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#c3ccc8');sky.addColorStop(.67,'#aebbb5');sky.addColorStop(1,'#899c98');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#a0ada4';ctx.beginPath();ctx.moveTo(0,310);ctx.quadraticCurveTo(START*.45,270,START,310);ctx.lineTo(START,385);ctx.lineTo(0,385);ctx.fill();ctx.fillStyle='#899b91';ctx.beginPath();ctx.moveTo(END,310);ctx.quadraticCurveTo(END+(W-END)*.5,272,W,307);ctx.lineTo(W,390);ctx.lineTo(END,390);ctx.fill();
 ctx.fillStyle='#637f80';ctx.fillRect(0,385,W,185);ctx.strokeStyle='#82999a';ctx.lineWidth=1;for(let x=18;x<1000;x+=92){ctx.beginPath();ctx.moveTo(x,414);ctx.lineTo(x+38,414);ctx.moveTo(x+32,466);ctx.lineTo(x+80,466);ctx.stroke()}
 ctx.fillStyle='#7e8e79';ctx.fillRect(0,300,START,110);ctx.fillRect(END,300,W-END,110);ctx.fillStyle='#b1aa91';ctx.fillRect(0,ROAD-13,START,28);ctx.fillRect(END,ROAD-13,W-END,28);ctx.fillStyle='#d3cba9';ctx.fillRect(0,ROAD-15,START,3);ctx.fillRect(END,ROAD-15,W-END,3);
 ctx.strokeStyle='#666e70';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,ROAD);ctx.lineTo(START,ROAD);ctx.moveTo(END,ROAD);ctx.lineTo(W,ROAD);ctx.stroke();ctx.strokeStyle='#c8c1a7';ctx.lineWidth=1.5;ctx.setLineDash([15,13]);ctx.beginPath();ctx.moveTo(0,ROAD);ctx.lineTo(START,ROAD);ctx.moveTo(END,ROAD);ctx.lineTo(W,ROAD);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#293333e8';ctx.fillRect(0,0,W,76);ctx.fillStyle='#e2e5df';ctx.font='600 14px "Segoe UI",sans-serif';ctx.fillText(mode==='test'?'LOAD TEST · Vehicle load moving across the structure':mode==='failed'?'FAILURE ANALYSIS · Damaged member marked in red':'CONSTRUCTION · Select joints to place structural members',22,29);ctx.fillStyle='#b8c0ba';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Fixed bearings · 25 unit grid',22,51);ctx.fillStyle='#d1b77c';ctx.beginPath();ctx.arc(START,48,4,0,Math.PI*2);ctx.arc(END,48,4,0,Math.PI*2);ctx.fill();
 if(mode==='build'){ctx.save();ctx.beginPath();ctx.rect(100,90,800,410);ctx.clip();for(let x=100;x<=900;x+=GRID){const major=x%100===0;ctx.strokeStyle=major?'#46575430':'#52635d18';ctx.lineWidth=major?1:.7;ctx.beginPath();ctx.moveTo(x,90);ctx.lineTo(x,500);ctx.stroke()}for(let y=100;y<=500;y+=GRID){const major=y%100===0;ctx.strokeStyle=major?'#46575430':'#52635d18';ctx.lineWidth=major?1:.7;ctx.beginPath();ctx.moveTo(100,y);ctx.lineTo(900,y);ctx.stroke()}ctx.restore()}
 for(let i=0;i<beams.length;i++){const b=beams[i],g=beamGeometry(b),mat=materials[b.material],middle={x:(g.x1+g.x2)/2,y:(g.y1+g.y2)/2};ctx.lineCap='butt';ctx.lineWidth=mat.width*b.thickness;ctx.strokeStyle=b.broken?'#b6473e':b.wear>.65?'#bb8c54':mat.color;ctx.setLineDash(b.material==='cable'?[8,6]:[]);ctx.beginPath();if(b.broken){const dx=g.x2-g.x1,dy=g.y2-g.y1,len=Math.hypot(dx,dy)||1,gap=9,ux=dx/len,uy=dy/len;ctx.moveTo(g.x1,g.y1);ctx.lineTo(middle.x-ux*gap,middle.y-uy*gap);ctx.moveTo(middle.x+ux*gap,middle.y+uy*gap);ctx.lineTo(g.x2,g.y2)}else{ctx.moveTo(g.x1,g.y1);ctx.lineTo(g.x2,g.y2)}ctx.stroke();ctx.setLineDash([]);
  if(b.wear>.2&&!b.broken){ctx.strokeStyle=b.wear>.7?'#ca6e54':'#c49c62';ctx.lineWidth=Math.max(1,mat.width*b.thickness*.3);ctx.beginPath();ctx.moveTo(middle.x-6,middle.y-3);ctx.lineTo(middle.x+6,middle.y+3);ctx.stroke()}
  if(b.broken){ctx.strokeStyle='#542e2c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(middle.x-6,middle.y-8);ctx.lineTo(middle.x+5,middle.y-2);ctx.lineTo(middle.x-3,middle.y+2);ctx.lineTo(middle.x+6,middle.y+8);ctx.stroke()}
 }
 for(let i=0;i<joints.length;i++){const j=joints[i];ctx.beginPath();ctx.arc(j.x,j.y,i<2?9:6,0,Math.PI*2);ctx.fillStyle=i<2?'#d4bd84':'#e1e3dc';ctx.fill();ctx.strokeStyle=i===selected?'#a25a48':'#465250';ctx.lineWidth=i===selected?3:1.5;ctx.stroke()}
 if(mode==='test'||mode==='won'||mode==='failed')drawTruck(car.x,car.y);
 if(failure){const x=failure.x,y=failure.y;ctx.strokeStyle='#b94840';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.moveTo(x-22,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+22,y);ctx.stroke();ctx.fillStyle='#b94840';ctx.font='600 12px Consolas,monospace';ctx.fillText(`FAILED · M${failure.member}`,Math.min(820,x+20),Math.max(96,y-20))}
 ctx.fillStyle='#35403d';ctx.font='600 11px "Segoe UI",sans-serif';ctx.fillText('WEST BANK',25,284);ctx.fillText('EAST BANK',Math.min(END+10,910),284);ctx.font='10px Consolas,monospace';ctx.fillStyle='#e1e3db';ctx.fillText(`RIVER CROSSING · ${LEVELS[levelIndex].title.toUpperCase()}`,Math.max(22,START+(END-START)/2-100),544);
 if(mode==='won'){ctx.fillStyle='#222c2be8';ctx.fillRect(350,210,300,82);ctx.fillStyle='#d8e2d6';ctx.textAlign='center';ctx.font='600 19px "Segoe UI",sans-serif';ctx.fillText('CROSSING COMPLETE',500,246);ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Vehicle reached the opposite bank',500,271);ctx.textAlign='left'}
}
function drawTruck(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#7c6254';ctx.fillRect(-22,-30,43,21);ctx.fillStyle='#8c7665';ctx.beginPath();ctx.moveTo(-10,-30);ctx.lineTo(-3,-40);ctx.lineTo(12,-40);ctx.lineTo(20,-30);ctx.fill();ctx.fillStyle='#bfcac5';ctx.fillRect(-2,-37,10,6);ctx.fillStyle='#343a39';for(const wx of [-12,12]){ctx.beginPath();ctx.arc(wx,-7,5,0,Math.PI*2);ctx.fill()}ctx.restore()}
reset();requestAnimationFrame(frame);
