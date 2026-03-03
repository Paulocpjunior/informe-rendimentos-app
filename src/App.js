import { useState, useRef } from "react";

const NAT = "13002 - Aluguéis e royalties pagos a pessoa física";
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fm = (v) => (Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fc = (c) => {const d=String(c).replace(/\D/g,"");return d.length===11?d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9):c;};
const fnn = (c) => {const d=String(c).replace(/\D/g,"");return d.length===14?d.slice(0,2)+"."+d.slice(2,5)+"."+d.slice(5,8)+"/"+d.slice(8,12)+"-"+d.slice(12):c;};

function vCNPJ(x){const d=String(x).replace(/\D/g,"");if(d.length!==14)return{v:false,e:"CNPJ deve ter 14 dígitos"};if(/^(\d)\1{13}$/.test(d))return{v:false,e:"CNPJ inválido"};const w1=[5,4,3,2,9,8,7,6,5,4,3,2];let s=0;for(let i=0;i<12;i++)s+=parseInt(d[i])*w1[i];let r=s%11;const d1=r<2?0:11-r;if(parseInt(d[12])!==d1)return{v:false,e:"CNPJ inválido"};const w2=[6,5,4,3,2,9,8,7,6,5,4,3,2];s=0;for(let i=0;i<13;i++)s+=parseInt(d[i])*w2[i];r=s%11;const d2=r<2?0:11-r;if(parseInt(d[13])!==d2)return{v:false,e:"CNPJ inválido"};return{v:true,d:d,t:d.slice(8,12)==="0001"?"Matriz":"Filial"};}
function vCPF(x){const d=String(x).replace(/\D/g,"");if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;let s=0;for(let i=0;i<9;i++)s+=parseInt(d[i])*(10-i);let r=(s*10)%11;if(r===10)r=0;if(parseInt(d[9])!==r)return false;s=0;for(let i=0;i<10;i++)s+=parseInt(d[i])*(11-i);r=(s*10)%11;if(r===10)r=0;return parseInt(d[10])===r;}

const DB={"00621930000162":{rs:"FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA",nf:"SARA NOSSA TERRA",sit:"ATIVA",mun:"BRASILIA",uf:"DF"}};

function loadS(url,ck){if(ck())return Promise.resolve();return new Promise(function(res,rej){var s=document.createElement("script");s.src=url;s.onload=function(){res();};s.onerror=function(){rej(new Error("CDN fail"));};document.head.appendChild(s);});}

function parseXLS(file){
  return loadS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",function(){return !!window.XLSX;}).then(function(){return file.arrayBuffer();}).then(function(buf){
    var X=window.XLSX,wb=X.read(buf,{type:"array",cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]];
    var rows=X.utils.sheet_to_json(ws,{header:1,defval:""});var cF="";var bm={};
    for(var i=0;i<rows.length;i++){var row=rows[i];if(!row||row.length<8)continue;var nome=row[3];if(!nome||String(nome).trim()==="")continue;var ns=String(nome);if(ns.indexOf("Nome")>=0&&ns.indexOf("Propriet")>=0)continue;var br=Number(row[6]);if(isNaN(br))continue;if(!cF&&row[1]){var c=String(row[1]).replace(/\D/g,"");if(c.length>=14)cF=c.slice(0,14);}var mi=null;var ap=row[5];if(ap instanceof Date)mi=ap.getMonth();else if(typeof ap==="number")mi=new Date((ap-25569)*86400000).getMonth();else if(ap){var sv=String(ap),m=sv.match(/(\d{4})-(\d{2})/);if(m)mi=parseInt(m[2],10)-1;if(mi===null){m=sv.match(/(\d{2})\/(\d{4})/);if(m)mi=parseInt(m[1],10)-1;}}if(mi===null||mi<0||mi>11)continue;var k=ns.trim().toUpperCase();if(!bm[k])bm[k]={nome:k,cpf:String(row[4]).replace(/\D/g,"").slice(0,11),rend:Array(12).fill(0),irrf:Array(12).fill(0)};bm[k].rend[mi]+=br;bm[k].irrf[mi]+=Number(row[7])||0;}
    var arr=[];Object.keys(bm).forEach(function(k){var b=bm[k];b.cpfOk=vCPF(b.cpf);b.tR=0;b.tI=0;for(var x=0;x<12;x++){b.tR+=b.rend[x];b.tI+=b.irrf[x];}arr.push(b);});return{cF:cF,bens:arr};});
}

function makePDF(fp,bens,idx){
  return loadS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",function(){return !!window.jspdf;}).then(function(){
    var jsPDF=window.jspdf.jsPDF;var doc=new jsPDF({unit:"mm",format:"a4"});var pw=210,ml=15,cw=180;var list=idx!=null?[bens[idx]]:bens;
    for(var i=0;i<list.length;i++){var b=list[i];if(i>0)doc.addPage();var y=10;
      doc.setFillColor(26,39,68);doc.rect(ml,y,cw,20,"F");doc.setTextColor(255,255,255);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("COMPROVANTE DE RENDIMENTOS PAGOS E DE",pw/2,y+6.5,{align:"center"});doc.text("IMPOSTO SOBRE A RENDA RETIDO NA FONTE",pw/2,y+11.5,{align:"center"});doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text("IN RFB nº 2.060/2021 · Natureza: "+NAT,pw/2,y+17,{align:"center"});y+=22;
      var hw=cw/2-0.5;doc.setFillColor(220,230,240);doc.rect(ml,y,hw,10,"F");doc.rect(ml+hw+1,y,hw,10,"F");doc.setTextColor(43,76,126);doc.setFontSize(6.5);doc.text("EXERCÍCIO",ml+3,y+4);doc.text("ANO-CALENDÁRIO",ml+hw+4,y+4);doc.setTextColor(0);doc.setFontSize(13);doc.setFont("helvetica","bold");doc.text(fp.ex,ml+28,y+8);doc.text(fp.ac,ml+hw+38,y+8);y+=12.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.text("1   FONTE PAGADORA",ml+3,y+5.2);y+=7;
      doc.setDrawColor(176);doc.setLineWidth(0.2);doc.rect(ml,y,cw,10,"S");doc.setTextColor(100);doc.setFontSize(6.5);doc.setFont("helvetica","normal");doc.text("CNPJ",ml+2.5,y+3.5);doc.setTextColor(0);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text(fnn(fp.cnpj),ml+2.5,y+8);y+=10;
      doc.rect(ml,y,cw,10,"S");doc.setTextColor(100);doc.setFontSize(6.5);doc.setFont("helvetica","normal");doc.text("RAZÃO SOCIAL",ml+2.5,y+3.5);doc.setTextColor(0);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text(fp.nome,ml+2.5,y+8);y+=12.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.text("2   BENEFICIÁRIO",ml+3,y+5.2);y+=7;
      var cW=72;doc.rect(ml,y,cW,10,"S");doc.setTextColor(100);doc.setFontSize(6.5);doc.setFont("helvetica","normal");doc.text("CPF",ml+2.5,y+3.5);doc.setTextColor(0);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text(fc(b.cpf),ml+2.5,y+8);doc.rect(ml+cW,y,cw-cW,10,"S");doc.setTextColor(100);doc.setFontSize(6.5);doc.setFont("helvetica","normal");doc.text("NATUREZA",ml+cW+2.5,y+3.5);doc.setTextColor(0);doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text(NAT,ml+cW+2.5,y+8);y+=10;
      doc.rect(ml,y,cw,10,"S");doc.setTextColor(100);doc.setFontSize(6.5);doc.setFont("helvetica","normal");doc.text("NOME",ml+2.5,y+3.5);doc.setTextColor(0);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text(b.nome,ml+2.5,y+8);y+=12.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.text("3   RENDIMENTOS TRIBUTÁVEIS E IRRF",ml+3,y+5.2);y+=7;
      var nW=8,vW=30,dW=cw-nW-vW;var q3=[["1","Total dos rendimentos",b.tR],["2","Contrib. previdenciária",0],["3","Previdência complementar",0],["4","Pensão alimentícia",0],["5","IRRF",b.tI]];
      for(var qi=0;qi<q3.length;qi++){var q=q3[qi];doc.setFillColor(245,245,245);doc.rect(ml,y,nW,8.5,"F");doc.rect(ml,y,nW,8.5,"S");doc.setTextColor(0);doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.text(q[0],ml+nW/2,y+5.8,{align:"center"});doc.rect(ml+nW,y,dW,8.5,"S");doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text(q[1],ml+nW+2,y+5.8);doc.rect(ml+nW+dW,y,vW,8.5,"S");doc.setFontSize(8);doc.setFont("helvetica",(q[0]==="1"||q[0]==="5")?"bold":"normal");doc.text(fm(q[2]),ml+cw-2.5,y+5.8,{align:"right"});y+=8.5;}y+=2.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.text("4   ISENTOS E NÃO TRIBUTÁVEIS",ml+3,y+5.2);y+=7;
      for(var n4=1;n4<=7;n4++){doc.setFillColor(245);doc.rect(ml,y,nW,6,"F");doc.rect(ml,y,nW,6,"S");doc.setTextColor(0);doc.setFontSize(6);doc.setFont("helvetica","bold");doc.text(String(n4),ml+4,y+4);doc.rect(ml+nW,y,dW,6,"S");doc.rect(ml+nW+dW,y,vW,6,"S");doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.text("0,00",ml+cw-2.5,y+4,{align:"right"});y+=6;}y+=2.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.text("5   TRIBUTAÇÃO EXCLUSIVA",ml+3,y+5.2);y+=7;
      for(var n5=1;n5<=2;n5++){doc.setFillColor(245);doc.rect(ml,y,nW,6,"F");doc.rect(ml,y,nW,6,"S");doc.setTextColor(0);doc.setFontSize(6);doc.setFont("helvetica","bold");doc.text(String(n5),ml+4,y+4);doc.rect(ml+nW,y,dW,6,"S");doc.rect(ml+nW+dW,y,vW,6,"S");doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.text("0,00",ml+cw-2.5,y+4,{align:"right"});y+=6;}y+=2.5;
      doc.setFillColor(43,76,126);doc.rect(ml,y,cw,7,"F");doc.setTextColor(255);doc.setFontSize(8.5);doc.setFont("helvetica","bold");doc.text("7   INFORMAÇÕES COMPLEMENTARES",ml+3,y+5.2);y+=7;
      var iH=50;doc.rect(ml,y,cw,iH,"S");doc.setTextColor(0);doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("DETALHAMENTO MENSAL",ml+3,y+4);
      var yt=y+8,c1=ml+3,c2=ml+50,c3=ml+73,c4=ml+cw/2+3,c5=ml+cw/2+50,c6=ml+cw/2+73;
      doc.setFontSize(6.5);doc.setTextColor(43,76,126);doc.text("Mês",c1,yt);doc.text("Rend.",c2,yt,{align:"right"});doc.text("IRRF",c3,yt,{align:"right"});doc.text("Mês",c4,yt);doc.text("Rend.",c5,yt,{align:"right"});doc.text("IRRF",c6,yt,{align:"right"});
      yt+=1.5;doc.setDrawColor(43,76,126);doc.setLineWidth(0.3);doc.line(c1,yt,c3+1,yt);doc.line(c4,yt,c6+1,yt);doc.setFont("helvetica","normal");doc.setTextColor(0);
      for(var j=0;j<6;j++){var yl=yt+3.5+j*3.5;doc.text(MESES[j],c1,yl);doc.text(fm(b.rend[j]),c2,yl,{align:"right"});doc.text(fm(b.irrf[j]),c3,yl,{align:"right"});doc.text(MESES[j+6],c4,yl);doc.text(fm(b.rend[j+6]),c5,yl,{align:"right"});doc.text(fm(b.irrf[j+6]),c6,yl,{align:"right"});}
      var yT=yt+25;doc.setDrawColor(43,76,126);doc.line(c1,yT-1,c3+1,yT-1);doc.setFont("helvetica","bold");doc.setTextColor(43,76,126);doc.text("TOTAL",c1,yT);doc.setTextColor(0);doc.text(fm(b.tR),c2,yT,{align:"right"});doc.text(fm(b.tI),c3,yT,{align:"right"});
      y+=iH+2;doc.setFillColor(245);doc.rect(ml,y,cw,10,"F");doc.setTextColor(43,76,126);doc.setFontSize(7);doc.text("RESPONSÁVEL",ml+3,y+4);doc.setTextColor(0);doc.setFont("helvetica","normal");doc.text("Data: "+new Date().toLocaleDateString("pt-BR")+(fp.resp?" · "+fp.resp:""),ml+3,y+8);
    }return doc;});
}

export default function App(){
  const[step,setStep]=useState(1);
  const[cnpj,setCnpj]=useState("");const[cData,setCData]=useState(null);const[cVal,setCVal]=useState(null);const[cErr,setCErr]=useState("");
  const[fp,setFp]=useState({cnpj:"",nome:"",ex:"2026",ac:"2025",resp:""});
  const[bens,setBens]=useState([]);const[file,setFile]=useState(null);const[busy,setBusy]=useState(false);
  const[links,setLinks]=useState([]);const[drag,setDrag]=useState(false);
  const fR=useRef(null);

  function mask(e){var v=e.target.value.replace(/\D/g,"").slice(0,14);if(v.length>12)v=v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5,8)+"/"+v.slice(8,12)+"-"+v.slice(12);else if(v.length>8)v=v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5,8)+"/"+v.slice(8);else if(v.length>5)v=v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5);else if(v.length>2)v=v.slice(0,2)+"."+v.slice(2);setCnpj(v);setCErr("");setCData(null);setCVal(null);var dig=v.replace(/\D/g,"");if(dig.length===14){var r=vCNPJ(dig);setCVal(r);if(r.v){var db=DB[dig];setCData(db||null);setFp(function(p){return Object.assign({},p,{cnpj:dig,nome:db?db.rs:p.nome});});}else setCErr(r.e);}}

  function processFile(f){if(!f)return;setFile(f);setBusy(true);parseXLS(f).then(function(r){setBens(r.bens);if(r.cF&&!fp.cnpj){setFp(function(p){return Object.assign({},p,{cnpj:r.cF});});setCnpj(fnn(r.cF));var v=vCNPJ(r.cF);setCVal(v);if(v.v){var db=DB[r.cF];setCData(db||null);if(db)setFp(function(p){return Object.assign({},p,{cnpj:r.cF,nome:db.rs});});}}}).catch(function(err){alert("Erro: "+err.message);}).finally(function(){setBusy(false);});}

  function gen(idx){
    setBusy(true);
    makePDF(fp,bens,idx).then(function(doc){
      var nm=idx!=null?"INFORME_"+fc(bens[idx].cpf).replace(/\D/g,"")+"_"+fp.ac+".pdf":"CONSOLIDADO_"+fp.ac+".pdf";
      var blob=doc.output("blob");
      var url=URL.createObjectURL(blob);
      setLinks(function(prev){return prev.concat([{url:url,name:nm}]);});
    }).catch(function(err){alert("Erro PDF: "+err.message);}).finally(function(){setBusy(false);});
  }

  function genAll(){
    setBusy(true);
    makePDF(fp,bens,null).then(function(doc){
      var nm="CONSOLIDADO_"+fp.ac+".pdf";
      var blob=doc.output("blob");
      var url=URL.createObjectURL(blob);
      setLinks(function(prev){return prev.concat([{url:url,name:nm}]);});
    }).catch(function(err){alert("Erro PDF: "+err.message);}).finally(function(){setBusy(false);});
  }

  var S={
    card:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:28},
    inp:{width:"100%",padding:"10px 14px",fontSize:13,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#fff",outline:"none",boxSizing:"border-box"},
    bp:{padding:"10px 22px",fontSize:13,fontWeight:600,background:"linear-gradient(135deg,#2a7fff,#1a5cbf)",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",display:"inline-block",textDecoration:"none"},
    bs:{padding:"10px 18px",fontSize:13,background:"rgba(255,255,255,0.05)",color:"#aab",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer"},
    lb:{display:"block",fontSize:11.5,color:"#7a8fa6",marginBottom:4}
  };

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d1b2a,#1b2a4a,#1a3a5c)",fontFamily:"'Segoe UI',system-ui",color:"#e0e6ed"}}>
      <header style={{padding:"20px 28px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:14,background:"rgba(0,0,0,0.2)"}}>
        <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#2a7fff,#1a5cbf)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>IR</div>
        <div><h1 style={{margin:0,fontSize:17,fontWeight:700}}>Gerador de Informe de Rendimentos</h1><p style={{margin:0,fontSize:11.5,color:"#7a8fa6"}}>Natureza 13002 · Aluguel PF · IN RFB 2.060/2021</p></div>
      </header>
      <div style={{maxWidth:920,margin:"0 auto",padding:"24px 20px"}}>
        <div style={{display:"flex",gap:6,marginBottom:24}}>
          {[{n:1,l:"Fonte Pagadora"},{n:2,l:"Importar Dados"},{n:3,l:"Gerar PDFs"}].map(function(it){return(
            <button key={it.n} onClick={function(){if(it.n<=2||bens.length>0)setStep(it.n);}} style={{flex:1,padding:"11px 14px",background:step===it.n?"rgba(42,127,255,0.15)":"rgba(255,255,255,0.03)",border:step===it.n?"1px solid rgba(42,127,255,0.4)":"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:9}}>
              <span style={{width:26,height:26,borderRadius:"50%",background:step>=it.n?"linear-gradient(135deg,#2a7fff,#1a5cbf)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:step>=it.n?"#fff":"#556"}}>{it.n}</span>
              <span style={{fontSize:12.5,fontWeight:step===it.n?600:400,color:step===it.n?"#fff":"#7a8fa6"}}>{it.l}</span>
            </button>);})}
        </div>

        {step===1&&<div style={S.card}>
          <h2 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Dados da Fonte Pagadora</h2>
          <p style={{color:"#7a8fa6",fontSize:12.5,margin:"0 0 18px"}}>CNPJ com validação automática</p>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <input placeholder="00.000.000/0000-00" value={cnpj} onChange={mask} style={Object.assign({},S.inp,{flex:1,fontSize:15,borderColor:cVal?(cVal.v?"rgba(42,200,100,0.5)":"rgba(255,60,60,0.5)"):"rgba(255,255,255,0.1)"})} />
            <div style={{display:"flex",alignItems:"center",minWidth:80}}>
              {cVal&&cVal.v&&<span style={{padding:"4px 10px",borderRadius:6,background:"rgba(42,200,100,0.12)",color:"#2ac864",fontSize:11,fontWeight:600}}>✓ Válido</span>}
              {cVal&&!cVal.v&&<span style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,60,60,0.1)",color:"#ff6b6b",fontSize:11,fontWeight:600}}>✗ Inválido</span>}
            </div>
          </div>
          {cErr&&<div style={{padding:"10px 14px",background:"rgba(255,60,60,0.1)",borderRadius:8,marginBottom:14,fontSize:12,color:"#ff6b6b"}}>{cErr}</div>}
          {cData&&<div style={{padding:16,borderRadius:10,marginBottom:18,background:"rgba(42,200,100,0.06)",border:"1px solid rgba(42,200,100,0.2)"}}>
            <div style={{color:"#2ac864",fontWeight:600,fontSize:12.5,marginBottom:6}}>✓ Cadastro interno — {cVal&&cVal.t}</div>
            <div style={{fontSize:12.5}}><span style={{color:"#7a8fa6"}}>Razão:</span> <strong style={{color:"#fff"}}>{cData.rs}</strong> · <span style={{color:"#7a8fa6"}}>Situação:</span> <strong style={{color:"#2ac864"}}>{cData.sit}</strong></div>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div><label style={S.lb}>Razão Social</label><input style={S.inp} value={fp.nome} onChange={function(e){setFp(Object.assign({},fp,{nome:e.target.value}));}} /></div>
            <div><label style={S.lb}>Responsável</label><input style={S.inp} value={fp.resp} onChange={function(e){setFp(Object.assign({},fp,{resp:e.target.value}));}} /></div>
            <div><label style={S.lb}>Exercício</label><input style={S.inp} value={fp.ex} onChange={function(e){setFp(Object.assign({},fp,{ex:e.target.value}));}} /></div>
            <div><label style={S.lb}>Ano-Calendário</label><input style={S.inp} value={fp.ac} onChange={function(e){setFp(Object.assign({},fp,{ac:e.target.value}));}} /></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={function(){setStep(2);}} style={S.bp} disabled={!fp.nome}>Próximo →</button></div>
        </div>}

        {step===2&&<div style={S.card}>
          <h2 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Importar Dados do Excel</h2>
          <p style={{color:"#7a8fa6",fontSize:12.5,margin:"0 0 18px"}}>Colunas: Localidade, CNPJ, CDG, Nome, CPF, Apuração, Bruto, IRRF, Líquido</p>
          <div onClick={function(){fR.current&&fR.current.click();}} onDragEnter={function(e){e.preventDefault();setDrag(true);}} onDragOver={function(e){e.preventDefault();setDrag(true);}} onDragLeave={function(e){e.preventDefault();setDrag(false);}} onDrop={function(e){e.preventDefault();setDrag(false);processFile(e.dataTransfer.files[0]);}}
            style={{border:drag?"2px dashed #2a7fff":"2px dashed rgba(42,127,255,0.3)",borderRadius:12,padding:"40px 20px",textAlign:"center",cursor:"pointer",background:drag?"rgba(42,127,255,0.1)":file?"rgba(42,200,100,0.04)":"rgba(42,127,255,0.03)",marginBottom:18,transition:"all 0.2s"}}>
            <input ref={fR} type="file" accept=".xlsx,.xls" onChange={function(e){processFile(e.target.files[0]);}} style={{display:"none"}} />
            {busy?<div style={{color:"#2a7fff"}}><div style={{fontSize:28}}>⏳</div><div style={{fontSize:13,fontWeight:600}}>Processando...</div></div>
            :file?<div><div style={{fontSize:28}}>📊</div><div style={{fontSize:14,fontWeight:600,color:"#2ac864"}}>{file.name}</div><div style={{fontSize:12,color:"#7a8fa6",marginTop:4}}>{bens.length} beneficiário(s)</div></div>
            :<div><div style={{fontSize:36,opacity:0.6}}>📁</div><div style={{fontSize:14,color:"#ccd",fontWeight:500,marginTop:8}}>Arraste o arquivo Excel aqui</div><div style={{fontSize:12,color:"#667",marginTop:6}}>ou clique para selecionar · .xlsx, .xls</div></div>}
          </div>
          {bens.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:18}}>
            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.1)"}}><th style={{padding:"7px 10px",textAlign:"left",color:"#7a8fa6",fontSize:11}}>Nome</th><th style={{padding:"7px 10px",textAlign:"left",color:"#7a8fa6",fontSize:11}}>CPF</th><th style={{padding:4,color:"#7a8fa6",fontSize:11}}></th><th style={{padding:"7px 10px",textAlign:"right",color:"#7a8fa6",fontSize:11}}>Rendimentos</th><th style={{padding:"7px 10px",textAlign:"right",color:"#7a8fa6",fontSize:11}}>IRRF</th></tr></thead>
            <tbody>{bens.map(function(b,i){return <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}><td style={{padding:"9px 10px",color:"#dde"}}>{b.nome}</td><td style={{padding:"9px 10px",fontFamily:"monospace",fontSize:11,color:"#dde"}}>{fc(b.cpf)}</td><td>{b.cpfOk?<span style={{color:"#2ac864"}}>✓</span>:<span style={{color:"#ff6b6b"}}>✗</span>}</td><td style={{padding:"9px 10px",textAlign:"right",fontWeight:600,color:"#dde"}}>R$ {fm(b.tR)}</td><td style={{padding:"9px 10px",textAlign:"right",color:"#ff8c42"}}>R$ {fm(b.tI)}</td></tr>;})}</tbody>
            <tfoot><tr style={{borderTop:"2px solid rgba(42,127,255,0.3)"}}><td colSpan={3} style={{padding:"9px 10px",fontWeight:700,color:"#fff"}}>TOTAL</td><td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:"#fff"}}>R$ {fm(bens.reduce(function(a,x){return a+x.tR;},0))}</td><td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:"#ff8c42"}}>R$ {fm(bens.reduce(function(a,x){return a+x.tI;},0))}</td></tr></tfoot>
          </table>}
          <div style={{display:"flex",justifyContent:"space-between"}}><button onClick={function(){setStep(1);}} style={S.bs}>← Voltar</button><button onClick={function(){setStep(3);}} style={S.bp} disabled={bens.length===0}>Próximo →</button></div>
        </div>}

        {step===3&&<div style={S.card}>
          <h2 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>Gerar Informes de Rendimentos</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
            <div style={{padding:13,borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:11,color:"#7a8fa6"}}>Fonte</div><div style={{fontSize:12,fontWeight:600,color:"#fff"}}>{fp.nome}</div></div>
            <div style={{padding:13,borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:11,color:"#7a8fa6"}}>Rendimentos</div><div style={{fontSize:17,fontWeight:700,color:"#2a7fff"}}>R$ {fm(bens.reduce(function(a,x){return a+x.tR;},0))}</div></div>
            <div style={{padding:13,borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:11,color:"#7a8fa6"}}>IRRF</div><div style={{fontSize:17,fontWeight:700,color:"#ff8c42"}}>R$ {fm(bens.reduce(function(a,x){return a+x.tI;},0))}</div></div>
          </div>
          <button onClick={genAll} disabled={busy} style={Object.assign({},S.bp,{width:"100%",padding:13,fontSize:13.5,marginBottom:10,textAlign:"center"})}>
            {busy?"⏳ Gerando...":"📄 Gerar PDF Consolidado ("+bens.length+" informes)"}
          </button>
          <h3 style={{fontSize:13.5,fontWeight:600,color:"#fff",margin:"16px 0 10px"}}>Gerar individual</h3>
          {bens.map(function(b,i){return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:7}}>
            <div><div style={{fontSize:12.5,fontWeight:600,color:"#fff"}}>{b.nome}</div><div style={{fontSize:11,color:"#7a8fa6"}}>CPF: {fc(b.cpf)} · R$ {fm(b.tR)}</div></div>
            <button onClick={function(){gen(i);}} disabled={busy} style={Object.assign({},S.bs,{padding:"6px 14px",fontSize:11.5})}>📄 Gerar PDF</button>
          </div>;})}

          {links.length>0&&<div style={{marginTop:20,padding:16,borderRadius:10,background:"rgba(42,200,100,0.06)",border:"1px solid rgba(42,200,100,0.2)"}}>
            <h3 style={{fontSize:13.5,fontWeight:600,color:"#2ac864",margin:"0 0 10px"}}>✓ PDFs Gerados — Clique para baixar:</h3>
            {links.map(function(lk,i){return <div key={i} style={{marginBottom:6}}><a href={lk.url} download={lk.name} style={{color:"#2a7fff",fontWeight:600,fontSize:13,textDecoration:"underline",cursor:"pointer"}} target="_blank" rel="noopener noreferrer">⬇ {lk.name}</a></div>;})}
          </div>}

          <div style={{display:"flex",justifyContent:"flex-start",marginTop:18}}><button onClick={function(){setStep(2);}} style={S.bs}>← Voltar</button></div>
        </div>}
      </div>
    </div>
  );
}
