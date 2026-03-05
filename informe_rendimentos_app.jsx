import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

const TIPOS_RENDIMENTO = {
  '3208': {
    codigo: '3208',
    titulo: 'Aluguéis e Royalties',
    natureza: '13002 - Aluguéis e royalties pagos a pessoa física',
    descInfo: 'Natureza 13002 · Aluguel PF · IN RFB 2.060/2021',
  },
  '0588': {
    codigo: '0588',
    titulo: 'Trabalho sem Vínculo Empregatício',
    natureza: '10004 - Rendimento do trabalho sem vínculo empregatício',
    descInfo: 'Natureza 10004 · Trabalho s/ Vínculo · IN RFB 2.060/2021',
  }
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fm = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fc = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : c; };
const fnn = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 14 ? d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12) : c; };

function vCNPJ(x) { const d = String(x).replace(/\D/g, ""); if (d.length !== 14) return { v: false, e: "CNPJ deve ter 14 dígitos" }; if (/^(\d)\1{13}$/.test(d)) return { v: false, e: "CNPJ inválido" }; const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < 12; i++)s += parseInt(d[i]) * w1[i]; let r = s % 11; const d1 = r < 2 ? 0 : 11 - r; if (parseInt(d[12]) !== d1) return { v: false, e: "CNPJ inválido" }; const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; s = 0; for (let i = 0; i < 13; i++)s += parseInt(d[i]) * w2[i]; r = s % 11; const d2 = r < 2 ? 0 : 11 - r; if (parseInt(d[13]) !== d2) return { v: false, e: "CNPJ inválido" }; return { v: true, d: d, t: d.slice(8, 12) === "0001" ? "Matriz" : "Filial" }; }
function vCPF(x) { const d = String(x).replace(/\D/g, ""); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false; let s = 0; for (let i = 0; i < 9; i++)s += parseInt(d[i]) * (10 - i); let r = (s * 10) % 11; if (r === 10) r = 0; if (parseInt(d[9]) !== r) return false; s = 0; for (let i = 0; i < 10; i++)s += parseInt(d[i]) * (11 - i); r = (s * 10) % 11; if (r === 10) r = 0; return parseInt(d[10]) === r; }

const DB = { "00621930000162": { rs: "FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA", nf: "SARA NOSSA TERRA" } };

function loadS(url, ck) { if (ck()) return Promise.resolve(); return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = url; s.onload = function () { res(); }; s.onerror = function () { rej(new Error("CDN fail")); }; document.head.appendChild(s); }); }

function parseXLS(file) {
  return loadS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", function () { return !!window.XLSX; }).then(function () { return file.arrayBuffer(); }).then(function (buf) {
    var X = window.XLSX, wb = X.read(buf, { type: "array", cellDates: true }), ws = wb.Sheets[wb.SheetNames[0]];
    var rows = X.utils.sheet_to_json(ws, { header: 1, defval: "" }); var cF = ""; var bm = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]; if (!row || row.length < 5) continue;
      var nome = row[2]; // Ajustado para Coluna C (Índice 2)
      if (!nome || String(nome).trim() === "") continue;
      var ns = String(nome); if (ns.indexOf("Nome") >= 0 && ns.indexOf("CPF") >= 0) continue;
      if (!cF && row[1]) { var c = String(row[1]).replace(/\D/g, ""); if (c.length >= 14) cF = c.slice(0, 14); }
      var mi = null; var ap = row[4]; // Ajustado para Coluna E (Índice 4)
      if (ap instanceof Date) mi = ap.getMonth(); else if (typeof ap === "number") mi = new Date((ap - 25569) * 86400000).getMonth(); else if (ap) { var sv = String(ap), m = sv.match(/(\d{4})-(\d{2})/); if (m) mi = parseInt(m[2], 10) - 1; if (mi === null) { m = sv.match(/(\d{2})\/(\d{4})/); if (m) mi = parseInt(m[1], 10) - 1; } }
      if (mi === null || mi < 0 || mi > 11) continue;
      var k = ns.trim().toUpperCase();
      if (!bm[k]) bm[k] = { nome: k, cpf: String(row[3]).replace(/\D/g, "").slice(0, 11), rend: Array(12).fill(0), irrf: Array(12).fill(0) }; // Ajustado CPF para Coluna D (Índice 3)
      bm[k].rend[mi] += Number(row[5]) || 0; // Ajustado Bruto para Coluna F (Índice 5)
      bm[k].irrf[mi] += Number(row[6]) || 0; // Ajustado IRRF para Coluna G (Índice 6)
    }
    var arr = []; Object.keys(bm).forEach(function (k) { var b = bm[k]; b.cpfOk = vCPF(b.cpf); b.tR = 0; b.tI = 0; for (var x = 0; x < 12; x++) { b.tR += b.rend[x]; b.tI += b.irrf[x]; } arr.push(b); }); return { cF: cF, bens: arr };
  });
}

function makePDF(fp, bens, idx, tipo) {
  const config = TIPOS_RENDIMENTO[tipo] || TIPOS_RENDIMENTO['3208'];
  return new Promise(function (resolve, reject) {
    try {
      var doc = new jsPDF({ unit: "mm", format: "a4" }); var pw = 210, ml = 15, cw = 180; var list = idx != null ? [bens[idx]] : bens;
      for (var i = 0; i < list.length; i++) {
        var b = list[i]; if (i > 0) doc.addPage(); var y = 10;
        doc.setFillColor(26, 39, 68); doc.rect(ml, y, cw, 20, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("COMPROVANTE DE RENDIMENTOS PAGOS E DE", pw / 2, y + 6.5, { align: "center" }); doc.text("IMPOSTO SOBRE A RENDA RETIDO NA FONTE", pw / 2, y + 11.5, { align: "center" }); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text(config.descInfo, pw / 2, y + 17, { align: "center" }); y += 22;
        var hw = cw / 2 - 0.5; doc.setFillColor(220, 230, 240); doc.rect(ml, y, hw, 10, "F"); doc.rect(ml + hw + 1, y, hw, 10, "F"); doc.setTextColor(43, 76, 126); doc.setFontSize(6.5); doc.text("EXERCÍCIO", ml + 3, y + 4); doc.text("ANO-CALENDÁRIO", ml + hw + 4, y + 4); doc.setTextColor(0); doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text(fp.ex, ml + 28, y + 8); doc.text(fp.ac, ml + hw + 38, y + 8); y += 12.5;
        doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, "F"); doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("1   FONTE PAGADORA", ml + 3, y + 5.2); y += 7;
        doc.setDrawColor(176); doc.setLineWidth(0.2); doc.rect(ml, y, cw, 10, "S"); doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("CNPJ", ml + 2.5, y + 3.5); doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(fnn(fp.cnpj), ml + 2.5, y + 8); y += 10;
        doc.rect(ml, y, cw, 10, "S"); doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("RAZÃO SOCIAL", ml + 2.5, y + 3.5); doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(fp.nome, ml + 2.5, y + 8); y += 12.5;
        doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, "F"); doc.setTextColor(255); doc.setFontSize(8.5); doc.text("2   BENEFICIÁRIO", ml + 3, y + 5.2); y += 7;
        var cW = 72; doc.rect(ml, y, cW, 10, "S"); doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("CPF", ml + 2.5, y + 3.5); doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(fc(b.cpf), ml + 2.5, y + 8); doc.rect(ml + cW, y, cw - cW, 10, "S"); doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("NATUREZA", ml + cW + 2.5, y + 3.5); doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text(config.natureza, ml + cW + 2.5, y + 8); y += 10;
        doc.rect(ml, y, cw, 10, "S"); doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("NOME", ml + 2.5, y + 3.5); doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(b.nome, ml + 2.5, y + 8); y += 12.5;
        doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, "F"); doc.setTextColor(255); doc.setFontSize(8.5); doc.text("3   RENDIMENTOS TRIBUTÁVEIS E IRRF", ml + 3, y + 5.2); y += 7;
        var nW = 8, vW = 30, dW = cw - nW - vW; var q3 = [["1", "Total dos rendimentos", b.tR], ["2", "Contrib. previdenciária", 0], ["3", "Previdência complementar", 0], ["4", "Pensão alimentícia", 0], ["5", "IRRF", b.tI]];
        for (var qi = 0; qi < q3.length; qi++) { var q = q3[qi]; doc.setFillColor(245, 245, 245); doc.rect(ml, y, nW, 8.5, "F"); doc.rect(ml, y, nW, 8.5, "S"); doc.setTextColor(0); doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.text(q[0], ml + nW / 2, y + 5.8, { align: "center" }); doc.rect(ml + nW, y, dW, 8.5, "S"); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text(q[1], ml + nW + 2, y + 5.8); doc.rect(ml + nW + dW, y, vW, 8.5, "S"); doc.setFontSize(8); doc.setFont("helvetica", (q[0] === "1" || q[0] === "5") ? "bold" : "normal"); doc.text(fm(q[2]), ml + cw - 2.5, y + 5.8, { align: "right" }); y += 8.5; } y += 2.5;
        doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, "F"); doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("7   INFORMAÇÕES COMPLEMENTARES", ml + 3, y + 5.2); y += 7;
        var iH = 50; doc.rect(ml, y, cw, iH, "S"); doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("DETALHAMENTO MENSAL", ml + 3, y + 4);
        var yt = y + 8, c1 = ml + 3, c2 = ml + 50, c3 = ml + 73, c4 = ml + cw / 2 + 3, c5 = ml + cw / 2 + 50, c6 = ml + cw / 2 + 73;
        doc.setFontSize(6.5); doc.setTextColor(43, 76, 126); doc.text("Mês", c1, yt); doc.text("Rend.", c2, yt, { align: "right" }); doc.text("IRRF", c3, yt, { align: "right" }); doc.text("Mês", c4, yt); doc.text("Rend.", c5, yt, { align: "right" }); doc.text("IRRF", c6, yt, { align: "right" });
        yt += 1.5; doc.setDrawColor(43, 76, 126); doc.setLineWidth(0.3); doc.line(c1, yt, c3 + 1, yt); doc.line(c4, yt, c6 + 1, yt); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
        for (var j = 0; j < 6; j++) { var yl = yt + 3.5 + j * 3.5; doc.text(MESES[j], c1, yl); doc.text(fm(b.rend[j]), c2, yl, { align: "right" }); doc.text(fm(b.irrf[j]), c3, yl, { align: "right" }); doc.text(MESES[j + 6], c4, yl); doc.text(fm(b.rend[j + 6]), c5, yl, { align: "right" }); doc.text(fm(b.irrf[j + 6]), c6, yl, { align: "right" }); }
        var yT = yt + 25; doc.setDrawColor(43, 76, 126); doc.line(c1, yT - 1, c3 + 1, yT - 1); doc.setFont("helvetica", "bold"); doc.setTextColor(43, 76, 126); doc.text("TOTAL", c1, yT); doc.setTextColor(0); doc.text(fm(b.tR), c2, yT, { align: "right" }); doc.text(fm(b.tI), c3, yT, { align: "right" });
        y += iH + 2; doc.setFillColor(245); doc.rect(ml, y, cw, 10, "F"); doc.setTextColor(43, 76, 126); doc.setFontSize(7); doc.text("RESPONSÁVEL", ml + 3, y + 4); doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.text("Data: " + new Date().toLocaleDateString("pt-BR") + (fp.resp ? " · " + fp.resp : ""), ml + 3, y + 8);
      }
      resolve(doc);
    } catch (err) { reject(err); }
  });
}

function baixarM(tipo) {
  loadS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => !!window.XLSX).then(() => {
    var X = window.XLSX, wb = X.utils.book_new();
    const headers = [["Localidade", "CNPJ", "Nome", "CPF", "Apuração", "Bruto", "IRRF", "Liquido"]];
    const data = [["Sede", "17.706.901/0001-04", "Exemplo da Silva", "000.000.000-00", "2025-01-31", 5000.00, 1500.00, 3500.00]];
    const ws = X.utils.aoa_to_sheet([...headers, ...data]);
    X.utils.book_append_sheet(wb, ws, "Modelo");
    X.writeFile(wb, "Modelo_Importacao_" + tipo + ".xlsx");
  });
}

export default function App() {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('3208');
  const [cnpj, setCnpj] = useState(""); const [cData, setCData] = useState(null); const [cVal, setCVal] = useState(null); const [cErr, setCErr] = useState("");
  const [fp, setFp] = useState({ cnpj: "", nome: "", ex: "2026", ac: "2025", resp: "" });
  const [bens, setBens] = useState([]); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState([]); const [drag, setDrag] = useState(false);
  const fR = useRef(null);

  function mask(e) { var v = e.target.value.replace(/\D/g, "").slice(0, 14); if (v.length > 12) v = v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8) + "/" + v.slice(8, 12) + "-" + v.slice(12); else if (v.length > 8) v = v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8) + "/" + v.slice(8); else if (v.length > 5) v = v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5); else if (v.length > 2) v = v.slice(0, 2) + "." + v.slice(2); setCnpj(v); setCErr(""); setCData(null); setCVal(null); var dig = v.replace(/\D/g, ""); if (dig.length === 14) { var r = vCNPJ(dig); setCVal(r); if (r.v) { var db = DB[dig]; setCData(db || null); setFp(function (p) { return Object.assign({}, p, { cnpj: dig, nome: db ? db.rs : p.nome }); }); } else setCErr(r.e); } }

  function processFile(f) { if (!f) return; setFile(f); setBusy(true); parseXLS(f).then(function (r) { setBens(r.bens); if (r.cF && !fp.cnpj) { setFp(function (p) { return Object.assign({}, p, { cnpj: r.cF }); }); setCnpj(fnn(r.cF)); var v = vCNPJ(r.cF); setCVal(v); if (v.v) { var db = DB[r.cF]; setCData(db || null); if (db) setFp(function (p) { return Object.assign({}, p, { cnpj: r.cF, nome: db.rs }); }); } } }).catch(function (err) { alert("Erro: " + err.message); }).finally(function () { setBusy(false); }); }

  function gen(idx) {
    setBusy(true);
    makePDF(fp, bens, idx, tipo).then(function (doc) {
      var nm = idx != null ? "INFORME_" + fc(bens[idx].cpf).replace(/\D/g, "") + "_" + fp.ac + ".pdf" : "CONSOLIDADO_" + fp.ac + ".pdf";
      var blob = doc.output("blob"); var url = URL.createObjectURL(blob);
      setLinks(function (prev) { return prev.concat([{ url: url, name: nm }]); });
    }).catch(function (err) { alert("Erro PDF: " + err.message); }).finally(function () { setBusy(false); });
  }

  var S = {
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 28 },
    inp: { width: "100%", padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box" },
    bp: { padding: "10px 22px", fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#2a7fff,#1a5cbf)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-block", textDecoration: "none" },
    bs: { padding: "10px 18px", fontSize: 13, background: "rgba(255,255,255,0.05)", color: "#aab", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer" },
    lb: { display: "block", fontSize: 11.5, color: "#7a8fa6", marginBottom: 4 }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg,#0d1b2a,#1b2a4a,#1a3a5c)", fontFamily: "'Segoe UI',system-ui", color: "#e0e6ed" }}>
      <header style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 14, background: "rgba(0,0,0,0.2)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#2a7fff,#1a5cbf)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>IR</div>
        <div><h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Gerador de Informe de Rendimentos</h1><p style={{ margin: 0, fontSize: 11.5, color: "#7a8fa6" }}>{TIPOS_RENDIMENTO[tipo]?.descInfo}</p></div>
      </header>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[{ n: 1, l: "Fonte" }, { n: 2, l: "Tipo" }, { n: 3, l: "Importar" }, { n: 4, l: "Gerar" }].map(function (it) {
            return (
              <button key={it.n} onClick={function () { if (it.n <= step) setStep(it.n); }} style={{ flex: 1, padding: "11px 14px", background: step === it.n ? "rgba(42,127,255,0.15)" : "rgba(255,255,255,0.03)", border: step === it.n ? "1px solid rgba(42,127,255,0.4)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: step >= it.n ? "linear-gradient(135deg,#2a7fff,#1a5cbf)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: step >= it.n ? "#fff" : "#556" }}>{it.n}</span>
                <span style={{ fontSize: 12.5, fontWeight: step === it.n ? 600 : 400, color: step === it.n ? "#fff" : "#7a8fa6" }}>{it.l}</span>
              </button>);
          })}
        </div>

        {step === 1 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Dados da Fonte Pagadora</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ gridColumn: 'span 2' }}><label style={S.lb}>CNPJ</label><input placeholder="00.000.000/0000-00" value={cnpj} onChange={mask} style={S.inp} /></div>
            <div><label style={S.lb}>Razão Social</label><input style={S.inp} value={fp.nome} onChange={function (e) { setFp(Object.assign({}, fp, { nome: e.target.value })); }} /></div>
            <div><label style={S.lb}>Responsável</label><input style={S.inp} value={fp.resp} onChange={function (e) { setFp(Object.assign({}, fp, { resp: e.target.value })); }} /></div>
            <div><label style={S.lb}>Exercício</label><input style={S.inp} value={fp.ex} onChange={function (e) { setFp(Object.assign({}, fp, { ex: e.target.value })); }} /></div>
            <div><label style={S.lb}>Ano-Calendário</label><input style={S.inp} value={fp.ac} onChange={function (e) { setFp(Object.assign({}, fp, { ac: e.target.value })); }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={function () { setStep(2); }} style={S.bp} disabled={!fp.nome}>Próximo →</button></div>
        </div>}

        {step === 2 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Tipo de Rendimento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {Object.keys(TIPOS_RENDIMENTO).map(k => (
              <div key={k} onClick={() => setTipo(k)} style={{ padding: 20, borderRadius: 12, border: `1px solid ${tipo === k ? '#2a7fff' : 'rgba(255,255,255,0.1)'}`, background: tipo === k ? 'rgba(42,127,255,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{k === '3208' ? '🏠' : '⛪'}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{TIPOS_RENDIMENTO[k].titulo}</div>
                <div style={{ fontSize: 11, color: '#7a8fa6', marginTop: 4 }}>Código {k}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><button onClick={() => setStep(1)} style={S.bs}>← Voltar</button><button onClick={() => setStep(3)} style={S.bp}>Próximo →</button></div>
        </div>}

        {step === 3 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Importar Excel</h2>
          <div onClick={function () { fR.current && fR.current.click(); }} onDrop={function (e) { e.preventDefault(); processFile(e.dataTransfer.files[0]); }} onDragOver={(e) => e.preventDefault()}
            style={{ border: "2px dashed rgba(42,127,255,0.3)", borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: "rgba(42,127,255,0.03)", marginBottom: 18 }}>
            <input ref={fR} type="file" accept=".xlsx,.xls" onChange={function (e) { processFile(e.target.files[0]); }} style={{ display: "none" }} />
            {busy ? "Processando..." : file ? file.name : "Clique ou arraste o Excel aqui"}
          </div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}><button onClick={() => baixarM(tipo)} style={{ ...S.bs, color: '#2ac864', borderColor: 'rgba(42,200,100,0.3)' }}>⭳ Baixar Planilha Modelo</button></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><button onClick={function () { setStep(2); }} style={S.bs}>← Voltar</button><button onClick={function () { setStep(4); }} style={S.bp} disabled={bens.length === 0}>Próximo →</button></div>
        </div>}

        {step === 4 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Gerar PDFs</h2>
          <button onClick={() => gen(null)} style={{ ...S.bp, width: '100%', marginBottom: 16 }}>📄 Gerar Todos os PDFs</button>
          {links.length > 0 && <div>
            {links.map((lk, i) => <div key={i}><a href={lk.url} download={lk.name} style={{ color: '#2a7fff' }}>⬇ {lk.name}</a></div>)}
          </div>}
          <button onClick={() => setStep(3)} style={S.bs}>← Voltar</button>
        </div>}
      </div>
    </div>
  );
}
