import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";

// ═══ VALIDAÇÃO CNPJ ═══
export function validarCNPJ(cnpj) {
  const d = String(cnpj).replace(/\D/g, '');
  if (d.length !== 14) return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
  if (/^(\d)\1{13}$/.test(d)) return { valid: false, error: 'CNPJ inválido' };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[12]) !== d1) return { valid: false, error: 'CNPJ inválido (dígito verificador)' };
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[13]) !== d2) return { valid: false, error: 'CNPJ inválido (dígito verificador)' };
  return { valid: true, digits: d, tipo: d.slice(8, 12) === '0001' ? 'Matriz' : 'Filial' };
}

// ═══ VALIDAÇÃO CPF ═══
export function validarCPF(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (parseInt(d[9]) !== r) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return parseInt(d[10]) === r;
}

// ═══ FORMATADORES ═══
export const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtCPF = (c) => { const d = String(c).replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c; };
export const fmtCNPJ = (c) => { const d = String(c).replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c; };

// ═══ MESES & RENDIMENTOS ═══
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const TIPOS_RENDIMENTO = {
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

// ═══ BANCO INTERNO CNPJ ═══
export const CNPJ_DB = {
  '00621930000162': {
    razao_social: 'FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA',
    nome_fantasia: 'SARA NOSSA TERRA',
    situacao: 'ATIVA',
    municipio: 'BRASILIA',
    uf: 'DF'
  }
};

export async function fetchCNPJ(cnpjStr) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjStr}`);
    if (!res.ok) return null;
    const json = await res.json();
    return {
      razao_social: json.razao_social,
      nome_fantasia: json.nome_fantasia || '',
      situacao: json.descricao_situacao_cadastral,
      municipio: json.municipio,
      uf: json.uf,
      tipo: json.identificador_matriz_filial === 1 ? 'Matriz' : 'Filial'
    };
  } catch (e) { return null; }
}

// ═══ CARREGAR SCRIPT CDN ═══
export function loadScript(url, check) {
  if (check()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar: ' + url));
    document.head.appendChild(s);
  });
}

// ═══ PARSE EXCEL ═══
export async function parseExcel(file) {
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    () => !!window.XLSX
  );
  const XLSX = window.XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  const benefMap = {};
  const cnpjsEncontrados = new Set();
  let primeiroCnpj = '';

  for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
    const ws = wb.Sheets[wb.SheetNames[sIdx]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let cnpjFonteSheet = '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 8) continue;
      const nome = row[2]; // Coluna C (Índice 2) - Nome
      if (!nome || String(nome).trim() === '') continue;
      const ns = String(nome);
      if (ns.indexOf('Nome') >= 0 && ns.indexOf('Propriet') >= 0) continue;
      // Removendo linha 'const br = Number(row[6])' que não é mais necessária aqui

      if (!cnpjFonteSheet && row[1]) {
        const c = String(row[1]).replace(/\D/g, '');
        if (c.length >= 14) cnpjFonteSheet = c.slice(0, 14);
      }

      if (cnpjFonteSheet) {
        cnpjsEncontrados.add(cnpjFonteSheet);
        if (!primeiroCnpj) primeiroCnpj = cnpjFonteSheet;
      }

      // Mês da apuração
      let mesIdx = null;
      const ap = row[4]; // Coluna E (Índice 4) - Data/Apuração
      if (ap instanceof Date) mesIdx = ap.getMonth();
      else if (typeof ap === 'number') mesIdx = new Date((ap - 25569) * 86400000).getMonth();
      else if (ap) {
        const s = String(ap);
        let m = s.match(/(\d{4})-(\d{2})/);
        if (m) mesIdx = parseInt(m[2], 10) - 1;
        if (mesIdx === null) { m = s.match(/(\d{2})\/(\d{4})/); if (m) mesIdx = parseInt(m[1], 10) - 1; }
      }
      if (mesIdx === null || mesIdx < 0 || mesIdx > 11) continue;

      // Agrupar por nome, CPF e CNPJ da Fonte
      const key = `${ns.trim().toUpperCase()}|${cnpjFonteSheet}`;
      if (!benefMap[key]) {
        benefMap[key] = {
          nome: ns.trim().toUpperCase(),
          cpf: String(row[3]).replace(/\D/g, '').slice(0, 11), // Coluna D (Índice 3) - CPF
          rend: Array(12).fill(0),
          irrf: Array(12).fill(0),
          cnpjFonte: cnpjFonteSheet,
          sheetName: wb.SheetNames[sIdx]
        };
      }
      benefMap[key].rend[mesIdx] += Number(row[5]) || 0; // Coluna F (Índice 5) - Bruto
      benefMap[key].irrf[mesIdx] += Number(row[6]) || 0; // Coluna G (Índice 6) - IRRF
    }
  }

  const beneficiarios = Object.values(benefMap).map(b => ({
    ...b,
    cpfValido: validarCPF(b.cpf),
    totalRend: b.rend.reduce((a, c) => a + c, 0),
    totalIRRF: b.irrf.reduce((a, c) => a + c, 0)
  }));

  return { cnpjFonte: primeiroCnpj, cnpjsUnicos: Array.from(cnpjsEncontrados), beneficiarios };
}

// ═══ GERAR PDF ═══
export async function gerarPDF(fp, beneficiarios, idx, tipoRendimento = '3208') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 210, ml = 15, cw = 180;
  const list = idx != null ? [beneficiarios[idx]] : beneficiarios;
  const config = TIPOS_RENDIMENTO[tipoRendimento] || TIPOS_RENDIMENTO['3208'];

  list.forEach((b, i) => {
    if (i > 0) doc.addPage();
    let y = 10;

    // Header
    doc.setFillColor(26, 39, 68); doc.rect(ml, y, cw, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE DE RENDIMENTOS PAGOS E DE', pw / 2, y + 6.5, { align: 'center' });
    doc.text('IMPOSTO SOBRE A RENDA RETIDO NA FONTE', pw / 2, y + 11.5, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(config.descInfo, pw / 2, y + 17, { align: 'center' });
    y += 22;

    // Exercício
    const hw = cw / 2 - 0.5;
    doc.setFillColor(220, 230, 240);
    doc.rect(ml, y, hw, 10, 'F'); doc.rect(ml + hw + 1, y, hw, 10, 'F');
    doc.setTextColor(43, 76, 126); doc.setFontSize(6.5);
    doc.text('EXERCÍCIO', ml + 3, y + 4); doc.text('ANO-CALENDÁRIO', ml + hw + 4, y + 4);
    doc.setTextColor(0); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(fp.exercicio, ml + 28, y + 8); doc.text(fp.anoCalendario, ml + hw + 38, y + 8);
    y += 12.5;

    // Seção 1 - Fonte Pagadora
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('1   FONTE PAGADORA PESSOA JURÍDICA OU PESSOA FÍSICA', ml + 3, y + 5.2); y += 7;
    doc.setDrawColor(176); doc.setLineWidth(0.2);
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('CNPJ / CPF', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(fmtCNPJ(b.cnpjFonte || fp.cnpj), ml + 2.5, y + 8); y += 10;
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('RAZÃO SOCIAL / NOME', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(b.nomeFonte || fp.nome, ml + 2.5, y + 8); y += 12.5;

    // Seção 2 - Beneficiário
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5);
    doc.text('2   PESSOA FÍSICA BENEFICIÁRIA DOS RENDIMENTOS', ml + 3, y + 5.2); y += 7;
    const cW = 72;
    doc.rect(ml, y, cW, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('CPF', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.text(fmtCPF(b.cpf), ml + 2.5, y + 8);
    doc.rect(ml + cW, y, cw - cW, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('NATUREZA DO RENDIMENTO', ml + cW + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(config.natureza, ml + cW + 2.5, y + 8); y += 10;
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('NOME COMPLETO', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.text(b.nome, ml + 2.5, y + 8); y += 12.5;

    // Seção 3 - Rendimentos
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5);
    doc.text('3   RENDIMENTOS TRIBUTÁVEIS, DEDUÇÕES E IMPOSTO SOBRE A RENDA RETIDO NA FONTE', ml + 3, y + 5.2); y += 7;
    const nW = 8, vW = 30, dW = cw - nW - vW;
    const q3 = [['1', 'Total dos rendimentos (inclusive férias)', b.totalRend], ['2', 'Contribuição previdenciária oficial', 0], ['3', 'Previdência complementar, FAPI', 0], ['4', 'Pensão alimentícia', 0], ['5', 'Imposto sobre a renda retido na fonte', b.totalIRRF]];
    q3.forEach(([n, desc, val]) => {
      doc.setFillColor(245); doc.rect(ml, y, nW, 8.5, 'FD');
      doc.setTextColor(0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text(n, ml + nW / 2, y + 5.8, { align: 'center' });
      doc.rect(ml + nW, y, dW, 8.5, 'S'); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(desc, ml + nW + 2, y + 5.8);
      doc.rect(ml + nW + dW, y, vW, 8.5, 'S');
      doc.setFontSize(8); doc.setFont('helvetica', (n === '1' || n === '5') ? 'bold' : 'normal');
      doc.text(fmtMoeda(val), ml + cw - 2.5, y + 5.8, { align: 'right' }); y += 8.5;
    }); y += 2.5;

    // Seção 4
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('4   RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS', ml + 3, y + 5.2); y += 7;
    for (let n = 1; n <= 7; n++) {
      doc.setFillColor(245); doc.rect(ml, y, nW, 6, 'FD');
      doc.setTextColor(0); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(String(n), ml + 4, y + 4);
      doc.rect(ml + nW, y, dW, 6, 'S'); doc.rect(ml + nW + dW, y, vW, 6, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('0,00', ml + cw - 2.5, y + 4, { align: 'right' }); y += 6;
    } y += 2.5;

    // Seção 5
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('5   RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA', ml + 3, y + 5.2); y += 7;
    for (let n = 1; n <= 2; n++) {
      doc.setFillColor(245); doc.rect(ml, y, nW, 6, 'FD');
      doc.setTextColor(0); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(String(n), ml + 4, y + 4);
      doc.rect(ml + nW, y, dW, 6, 'S'); doc.rect(ml + nW + dW, y, vW, 6, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('0,00', ml + cw - 2.5, y + 4, { align: 'right' }); y += 6;
    } y += 2.5;

    // Seção 7 - Informações Complementares
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('7   INFORMAÇÕES COMPLEMENTARES', ml + 3, y + 5.2); y += 7;
    const iH = 50; doc.rect(ml, y, cw, iH, 'S');
    doc.setTextColor(0); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO MENSAL DOS RENDIMENTOS E RETENÇÕES', ml + 3, y + 4);
    let yt = y + 8;
    const c1 = ml + 3, c2 = ml + 50, c3 = ml + 73, c4 = ml + cw / 2 + 3, c5 = ml + cw / 2 + 50, c6 = ml + cw / 2 + 73;
    doc.setFontSize(6.5); doc.setTextColor(43, 76, 126); doc.setFont('helvetica', 'bold');
    doc.text('Competência', c1, yt); doc.text('Rendimento', c2, yt, { align: 'right' }); doc.text('IRRF', c3, yt, { align: 'right' });
    doc.text('Competência', c4, yt); doc.text('Rendimento', c5, yt, { align: 'right' }); doc.text('IRRF', c6, yt, { align: 'right' });
    yt += 1.5; doc.setDrawColor(43, 76, 126); doc.setLineWidth(0.3);
    doc.line(c1, yt, c3 + 1, yt); doc.line(c4, yt, c6 + 1, yt);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
    for (let j = 0; j < 6; j++) {
      const yl = yt + 3.5 + j * 3.5;
      doc.text(MESES[j], c1, yl); doc.text(fmtMoeda(b.rend[j]), c2, yl, { align: 'right' }); doc.text(fmtMoeda(b.irrf[j]), c3, yl, { align: 'right' });
      doc.text(MESES[j + 6], c4, yl); doc.text(fmtMoeda(b.rend[j + 6]), c5, yl, { align: 'right' }); doc.text(fmtMoeda(b.irrf[j + 6]), c6, yl, { align: 'right' });
    }
    const yT = yt + 27;
    doc.setDrawColor(43, 76, 126); doc.setLineWidth(0.3);
    doc.line(c1, yT - 4, c6 + 1, yT - 4);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(43, 76, 126);
    doc.text('TOTAL ANUAL', c4, yT); doc.setTextColor(0);
    doc.text(fmtMoeda(b.totalRend), c5, yT, { align: 'right' });
    doc.text(fmtMoeda(b.totalIRRF), c6, yT, { align: 'right' });
    y += iH + 2.5;

    // Responsável
    doc.setFillColor(245); doc.rect(ml, y, cw, 10, 'FD');
    doc.setTextColor(43, 76, 126); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('RESPONSÁVEL PELAS INFORMAÇÕES', ml + 3, y + 4);
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    doc.text('Data: ' + new Date().toLocaleDateString('pt-BR') + (fp.responsavel ? ' · ' + fp.responsavel : ''), ml + 3, y + 8);
    y += 13;
    doc.setTextColor(170); doc.setFontSize(5.5);
    doc.text('Documento gerado conforme IN RFB nº 2.060/2021 — Dispensada assinatura', pw / 2, y, { align: 'center' });
  });

  return doc;
}

export function mod10Arrecadacao(valor) {
  let soma = 0;
  let peso = 2;
  for (let i = valor.length - 1; i >= 0; i--) {
    let r = parseInt(valor[i], 10) * peso;
    if (r > 9) r = Math.floor(r / 10) + (r % 10);
    soma += r;
    peso = peso === 2 ? 1 : 2;
  }
  let resto = soma % 10;
  let mod = 10 - resto;
  return mod === 10 ? 0 : mod;
}

// ═══ GERAR DARF PDF ═══
export async function gerarDARF(fp, beneficiarios, dataVencimento, tipoRendimento = '3208') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 210;
  const config = TIPOS_RENDIMENTO[tipoRendimento] || TIPOS_RENDIMENTO['3208'];

  // Agrupar beneficiarios por CNPJ fonte
  const groups = {};
  beneficiarios.forEach(b => {
    const key = b.cnpjFonte || fp.cnpj;
    if (!groups[key]) groups[key] = { cnpj: key, nome: b.nomeFonte || fp.nome, totalIRRF: 0 };
    groups[key].totalIRRF += b.totalIRRF;
  });

  const cnpjs = Object.values(groups);

  cnpjs.forEach((group, idx) => {
    if (idx > 0) doc.addPage();
    const totalPrincipal = group.totalIRRF;

    // Layout Básico DARF Preto e Branco
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MINISTÉRIO DA FAZENDA', pw / 2, 20, { align: 'center' });
    doc.text('SECRETARIA DA RECEITA FEDERAL', pw / 2, 26, { align: 'center' });
    doc.text('Documento de Arrecadação de Receitas Federais', pw / 2, 32, { align: 'center' });
    doc.text('DARF', pw / 2, 38, { align: 'center' });

    doc.setFontSize(10);
    doc.setLineWidth(0.3);
    doc.rect(20, 50, 170, 100);

    doc.line(90, 50, 90, 150);

    doc.setFont('helvetica', 'normal');
    doc.text('01 NOME / TELEFONE', 22, 55);
    doc.setFont('helvetica', 'bold');
    const nomeSplit = doc.splitTextToSize(group.nome, 65);
    doc.text(nomeSplit, 22, 62);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const infoExtra = 'Este documento de apoio foi gerado pelo software Auxiliar\nde Informes. O código de barras obrigatoriamente deve\nser gerado nativamente no portal do SicalcWeb Federal\nou via e-CAC para processamento de juros e multas atuais.';
    const infoLines = doc.splitTextToSize(infoExtra, 65);
    doc.text(infoLines, 22, 120);

    const rightX = 90;
    const rw = 100;

    const fields = [
      { label: '02 PERÍODO DE APURAÇÃO', value: `31/12/${fp.anoCalendario}` },
      { label: '03 NÚMERO DO CPF OU CNPJ', value: fmtCNPJ(group.cnpj) },
      { label: '04 CÓDIGO DA RECEITA', value: config.codigo },
      { label: '05 NÚMERO DE REFERÊNCIA', value: '' },
      { label: '06 DATA DE VENCIMENTO', value: dataVencimento || `20/01/${parseInt(fp.anoCalendario) + 1}` },
      { label: '07 VALOR DO PRINCIPAL', value: fmtMoeda(totalPrincipal) },
      { label: '08 VALOR DA MULTA', value: '0,00' },
      { label: '09 VALOR DOS JUROS E / OU ENCARGOS', value: '0,00' },
      { label: '10 VALOR TOTAL', value: fmtMoeda(totalPrincipal) }
    ];

    let currentY = 50;
    fields.forEach((f, i) => {
      doc.rect(rightX, currentY, rw, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(f.label, rightX + 2, currentY + 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(f.value, rightX + rw - 2, currentY + 9, { align: 'right' });
      currentY += 11;
    });

    // ========== GERAR CÓDIGO DE BARRAS FEBRABAN ARRECADAÇÃO ==========
    // 1-3: "856" (Arrecadação / Gov / Mod10)
    // 4: DV Geral (calculado depois)
    // 5-15: Valor
    const vlCents = Math.round(totalPrincipal * 100).toString().padStart(11, '0');
    const org = "0000"; // Orgão/Governo Genérico
    const cnpjClean = group.cnpj.replace(/\D/g, '').padEnd(14, '0');
    const codRec = config.codigo;
    const periodo = `12${fp.anoCalendario}`; // MMAAAA
    let refLivre = (cnpjClean + codRec + periodo).padEnd(25, '0').slice(0, 25);

    let barrasSemDV = "856" + vlCents + org + refLivre;
    const dvGeral = mod10Arrecadacao(barrasSemDV);
    const barrasFinal = "856" + dvGeral + vlCents + org + refLivre;

    // Format Linha Digitavel (4 Blocos de 11 + DV bloco)
    let linhaDigitavel = "";
    for (let b = 0; b < 4; b++) {
      const bloco = barrasFinal.substr(b * 11, 11);
      const dvBloco = mod10Arrecadacao(bloco);
      linhaDigitavel += bloco + "-" + dvBloco + (b < 3 ? " " : "");
    }

    // Desenhar a linha e barras no final
    doc.setFontSize(11);
    doc.text(linhaDigitavel, rightX + rw / 2, currentY + 16, { align: 'center' });

    // Render Barcode
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, barrasFinal, { format: "ITF", displayValue: false, margin: 0, height: 50, width: 2 });
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, 'PNG', rightX + 5, currentY + 20, rw - 10, 16);
    } catch (err) {
      doc.setFontSize(9);
      doc.text("(Erro ao gerar barras)", rightX + rw / 2, currentY + 25, { align: 'center' });
    }
  });

  return doc;
}

// ═══ DOWNLOAD PDF ═══
export function downloadPDF(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ═══ BAIXAR MODELO EXCEL ═══
export async function baixarModeloExcel(tipoRendimento = '3208') {
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    () => !!window.XLSX
  );
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const config = TIPOS_RENDIMENTO[tipoRendimento] || TIPOS_RENDIMENTO['3208'];

  const headers = [
    ["Localidade", "CNPJ", "Nome", "CPF", "Apuração", "Bruto", "IRRF", "Liquido"]
  ];

  const data = [
    ["Sede", "17.706.901/0001-04", "Exemplo da Silva", "000.000.000-00", "2025-01-31", 5000.00, 1500.00, 3500.00]
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);

  // Style headers slightly
  ws['!cols'] = [
    { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "ModeloImportacao");
  XLSX.writeFile(wb, `Modelo_Importacao_${config.codigo}.xlsx`);
}
