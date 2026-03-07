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

// ═══ CÁLCULO IRRF (TABELA 2024/2025) ═══
export function calcularIRRF(valorBruto) {
  const descontoSimplificado = 564.80;
  const baseSimplificada = Math.max(0, valorBruto - descontoSimplificado);

  const calcularPorTabela = (base) => {
    if (base <= 2259.20) return 0;
    if (base <= 2826.65) return (base * 0.075) - 169.44;
    if (base <= 3751.05) return (base * 0.15) - 381.44;
    if (base <= 4664.68) return (base * 0.225) - 662.77;
    return (base * 0.275) - 896.00;
  };

  const irTabelaOriginal = calcularPorTabela(valorBruto);
  const irComDesconto = calcularPorTabela(baseSimplificada);

  // Retorna o menor imposto (mais benéfico ao contribuinte)
  return Math.max(0, Math.min(irTabelaOriginal, irComDesconto));
}

// ═══ MESES & RENDIMENTOS ═══
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const TIPOS_RENDIMENTO = {
  '3208': { codigo: '3208', titulo: 'Aluguéis e Royalties', natureza: '13002 - Aluguéis PF', descInfo: '13002 (Aluguel PF) • 3208' },
  '3288': { codigo: '3288', titulo: 'Aluguéis (Código Alternativo)', natureza: '13002 - Aluguéis PF', descInfo: '13002 (Aluguel PF) • 3288' },
  '0588': { codigo: '0588', titulo: 'Rendimento Trabalho s/ Vínculo', natureza: '10004 - Trabalho s/ Vínculo', descInfo: '10004 (Autônomo) • 0588' },
  '0561': { codigo: '0561', titulo: 'Trabalho Assalariado', natureza: '10001 - Trabalho Assalariado', descInfo: '10001 (CLT) • 0561' },
  '1708': { codigo: '1708', titulo: 'Serviços Profissionais (R-4010)', natureza: '13005 - Serviços Profissionais', descInfo: '13005 (Serviços) • 1708' },
  '8045': { codigo: '8045', titulo: 'Comissões e Corretagens (R-4010)', natureza: '13008 - Comissões PF', descInfo: '13008 (Comissões) • 8045' },
  '12001': { codigo: '---', titulo: 'Lucros e Dividendos (Isento)', natureza: '12001 - Lucros e Dividendos', descInfo: '12001 (Isento) • S/ Retenção' },
  '10002': { codigo: '0561', titulo: 'Aposentadoria / Pensão', natureza: '10002 - Aposentadoria', descInfo: '10002 (Aposent.) • 0561' },
  '13001': { codigo: '0924', titulo: 'Prêmios e Sorteios', natureza: '13001 - Prêmios', descInfo: '13001 (Prêmios) • 0924' },
  '10003': { codigo: '0561', titulo: 'Prebenda / Ministro Religioso', natureza: '10003 - Ministro de Confissão Religiosa', descInfo: '10003 (Prebenda) • 0561' },
  '12002': { codigo: '---', titulo: 'Ajuda de Custo / Diárias', natureza: '12002 - Diárias e Ajuda de Custo', descInfo: '12002 (Isento) • S/ Retenção' }
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

    // Mapeamento dinâmico de colunas (padrão inicial do layout antigo)
    let idxNome = 2;
    let idxIdentificador = 3;
    let idxApuracao = 4;
    let idxBruto = 5;
    let idxIrrf = 6;
    let idxIrAcumulado = -1;
    let idxTotalIr = -1;
    let idxCnpjFonte = 1;
    let idxNascimento = 11; // Adicionado para Data de Nascimento

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      // Detectar Layout e Mapear Colunas Dinamicamente
      const rowStr = JSON.stringify(row).toUpperCase();
      if (rowStr.indexOf('LOCALIDADE') >= 0 && (rowStr.indexOf('CNPJ') >= 0 || rowStr.indexOf('CPF') >= 0)) {
        // Mapeia cada coluna pelo nome
        row.forEach((cell, colIdx) => {
          const c = String(cell).toUpperCase();
          if (c.indexOf('NOME') >= 0) idxNome = colIdx;
          else if (c.indexOf('CPF') >= 0 || c.indexOf('IDENTIFICADOR') >= 0 || (c.indexOf('CNPJ') >= 0 && c.indexOf('PROPRIET') >= 0)) idxIdentificador = colIdx;
          else if (c.indexOf('APURAÇ') >= 0 || c.indexOf('APURAC') >= 0) idxApuracao = colIdx;
          else if (c.indexOf('BRUTO') >= 0) idxBruto = colIdx;
          else if (c.indexOf('TOTAL DE IR') >= 0) idxTotalIr = colIdx;
          else if (c.indexOf('IR ACUMULADO') >= 0) idxIrAcumulado = colIdx;
          else if (c.indexOf('IRRF') >= 0) idxIrrf = colIdx;
          else if (c.indexOf('CNPJ') >= 0 && c.indexOf('PROPRIET') === -1) idxCnpjFonte = colIdx;
          else if (c.indexOf('NASCIMENTO') >= 0) idxNascimento = colIdx;
        });
        continue;
      }

      // Pular linhas de Total (busca "TOTAL:" em qualquer coluna da linha)
      if (row.some(cell => String(cell).toUpperCase().indexOf('TOTAL:') >= 0)) continue;

      const nome = row[idxNome];
      if (!nome || String(nome).trim() === '') continue;
      const ns = String(nome);

      if (!cnpjFonteSheet && row[idxCnpjFonte]) {
        const c = String(row[idxCnpjFonte]).replace(/\D/g, '');
        if (c.length >= 14) cnpjFonteSheet = c.slice(0, 14);
      }

      let cnpjFonteLinha = null;
      if (row[idxCnpjFonte]) {
        const c = String(row[idxCnpjFonte]).replace(/\D/g, '');
        if (c.length === 14) {
          cnpjFonteLinha = c;
          cnpjFonteSheet = c;
        }
      }

      const cnpjEfetivo = cnpjFonteLinha || cnpjFonteSheet;
      if (cnpjEfetivo) {
        cnpjsEncontrados.add(cnpjEfetivo);
        if (!primeiroCnpj) primeiroCnpj = cnpjEfetivo;
      }

      let mesIdx = null;
      const ap = row[idxApuracao];
      if (ap instanceof Date) mesIdx = ap.getMonth();
      else if (typeof ap === 'number') mesIdx = new Date((ap - 25569) * 86400000).getMonth();
      else if (ap) {
        const s = String(ap);
        let m = s.match(/(\d{4})-(\d{2})/);
        if (m) mesIdx = parseInt(m[2], 10) - 1;
        if (mesIdx === null) { m = s.match(/(\d{2})\/(\d{4})/); if (m) mesIdx = parseInt(m[1], 10) - 1; }
        // Caso novo formato jan/25, fev/25 etc (suporta PT e EN)
        if (mesIdx === null) {
          const mesesPt = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
          const mesesEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          const abrev = s.slice(0, 3).toUpperCase();
          const fPt = mesesPt.indexOf(abrev);
          const fEn = mesesEn.indexOf(abrev);
          if (fPt >= 0) mesIdx = fPt;
          else if (fEn >= 0) mesIdx = fEn;
        }
      }
      if (mesIdx === null || mesIdx < 0 || mesIdx > 11) continue;

      const identificadorRaw = String(row[idxIdentificador]).replace(/\D/g, '');
      const key = `${ns.trim().toUpperCase()}|${identificadorRaw}`;

      let nascimentoFmt = '';
      if (row[idxNascimento]) {
        const valNas = row[idxNascimento];
        if (valNas instanceof Date) {
          const d = String(valNas.getDate()).padStart(2, '0');
          const m = String(valNas.getMonth() + 1).padStart(2, '0');
          const y = valNas.getFullYear();
          nascimentoFmt = `${d}${m}${y}`;
        } else if (typeof valNas === 'number') {
          const dNas = new Date((valNas - 25569) * 86400000);
          const d = String(dNas.getDate()).padStart(2, '0');
          const m = String(dNas.getMonth() + 1).padStart(2, '0');
          const y = dNas.getFullYear();
          nascimentoFmt = `${d}${m}${y}`;
        } else {
          nascimentoFmt = String(valNas).replace(/\D/g, '');
        }
      }

      if (!benefMap[key]) {
        benefMap[key] = {
          nome: ns.trim().toUpperCase(),
          cpf: identificadorRaw,
          nascimento: nascimentoFmt,
          rend: Array(12).fill(0),
          irrf: Array(12).fill(0),
          cnpjFonte: cnpjEfetivo || '',
          sheetName: wb.SheetNames[sIdx]
        };
      }
      // Garante que se o nascimento não veio na primeira linha, ele pegue nas próximas
      if (!benefMap[key].nascimento && nascimentoFmt) {
        benefMap[key].nascimento = nascimentoFmt;
      }

      benefMap[key].rend[mesIdx] += Number(row[idxBruto]) || 0;

      // Lógica Robusta para IRRF
      const irrfSimples = Number(row[idxIrrf]) || 0;
      const irAcum = idxIrAcumulado !== -1 ? (Number(row[idxIrAcumulado]) || 0) : 0;
      const totalIr = idxTotalIr !== -1 ? (Number(row[idxTotalIr]) || 0) : 0;

      // Pega o maior valor entre o Total de IR explícito ou a soma de IRRF + Acumulado
      benefMap[key].irrf[mesIdx] += Math.max(irrfSimples + irAcum, totalIr);
    }
  }

  const beneficiarios = Object.values(benefMap).map(b => {
    const irrfCalculadoMeses = b.rend.map(r => calcularIRRF(r));
    return {
      ...b,
      cpfValido: b.cpf.length === 11 ? validarCPF(b.cpf) : (b.cpf.length === 14 ? validarCNPJ(b.cpf).valid : false),
      totalRend: b.rend.reduce((a, c) => a + c, 0),
      totalIRRF: b.irrf.reduce((a, c) => a + c, 0),
      totalIrrfCalculado: irrfCalculadoMeses.reduce((a, c) => a + c, 0),
      irrfCalculadoMeses
    };
  });

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
    const labelId = b.cpf.length === 14 ? 'CNPJ' : 'CPF';
    doc.text(labelId, ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.text(b.cpf.length === 14 ? fmtCNPJ(b.cpf) : fmtCPF(b.cpf), ml + 2.5, y + 8);
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
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    () => !!window.QRCode
  );

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

  for (let idx = 0; idx < cnpjs.length; idx++) {
    const group = cnpjs[idx];
    if (idx > 0) doc.addPage();
    const totalPrincipal = group.totalIRRF;

    // Layout Moderno DARF
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 15, 180, 260, 'F');

    doc.setDrawColor(43, 76, 126);
    doc.setLineWidth(0.5);
    doc.rect(15, 15, 180, 260, 'S');

    // Header logo placeholder
    doc.setFillColor(43, 76, 126);
    doc.rect(15, 15, 180, 25, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DARF - DOCUMENTO DE ARRECADAÇÃO', 105, 31, { align: 'center' });

    doc.setFontSize(8);
    doc.text('RECEITA FEDERAL DO BRASIL', 105, 36, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(10);

    // Grid de Campos
    const drawField = (x, y, w, h, label, value, isBold = false) => {
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.rect(x, y, w, h);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(label, x + 2, y + 4);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.text(String(value), x + w - 2, y + 9, { align: 'right' });
    };

    const startY = 50;
    const colW = 90;

    // Coluna 1
    const nomeSplit = doc.splitTextToSize(group.nome, 85);
    doc.rect(15, startY, colW, 22);
    doc.setFontSize(7);
    doc.text('01 NOME / TELEFONE', 17, startY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(nomeSplit, 17, startY + 10);

    // Coluna 2 (Campos DARF)
    drawField(15 + colW, startY, colW, 11, '02 PERÍODO DE APURAÇÃO', `31/12/${fp.anoCalendario}`);
    drawField(15 + colW, startY + 11, colW, 11, '03 NÚMERO DO CPF OU CNPJ', fmtCNPJ(group.cnpj), true);
    drawField(15 + colW, startY + 22, colW, 11, '04 CÓDIGO DA RECEITA', config.codigo, true);
    drawField(15 + colW, startY + 33, colW, 11, '05 NÚMERO DE REFERÊNCIA', '');
    drawField(15 + colW, startY + 44, colW, 11, '06 DATA DE VENCIMENTO', dataVencimento || `20/01/${parseInt(fp.anoCalendario) + 1}`, true);
    drawField(15 + colW, startY + 55, colW, 11, '07 VALOR DO PRINCIPAL', fmtMoeda(totalPrincipal), true);
    drawField(15 + colW, startY + 66, colW, 11, '08 VALOR DA MULTA', '0,00');
    drawField(15 + colW, startY + 77, colW, 11, '09 VALOR DOS JUROS', '0,00');

    doc.setFillColor(43, 76, 126);
    doc.rect(15 + colW, startY + 88, colW, 11, 'F');
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text('10 VALOR TOTAL', 15 + colW + 2, startY + 92);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtMoeda(totalPrincipal), 15 + colW + colW - 2, startY + 97, { align: 'right' });

    // Área Informações
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const info = "Este documento é um auxílio para preenchimento. O pagamento via PIX ou Código de Barras requer a validação oficial no portal e-CAC ou SicalcWeb.";
    doc.text(doc.splitTextToSize(info, 85), 17, startY + 30);

    // ========== PIX QR CODE & BARCODE ==========
    const areaY = 200;
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PAGAMENTO VIA PIX OU CÓDIGO DE BARRAS', 105, areaY - 10, { align: 'center' });

    // QR Code Container
    doc.setDrawColor(230);
    doc.rect(pw / 2 - 25, areaY, 50, 50);

    try {
      // Mock PIX Payload for visual representation
      const payload = `PIX|DARF|${group.cnpj}|${totalPrincipal.toFixed(2)}|${config.codigo}`;
      const canvas = document.createElement("canvas");
      // Use QRCode library loaded via CDN
      const qr = new window.QRCode(canvas, {
        text: payload,
        width: 128,
        height: 128,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });

      // Wait a tiny bit for render if needed or use internal canvas
      const qrImg = canvas.toDataURL("image/png");
      doc.addImage(qrImg, 'PNG', pw / 2 - 20, areaY + 5, 40, 40);
      doc.setFontSize(7);
      doc.text('PAGUE COM PIX', pw / 2, areaY + 48, { align: 'center' });
    } catch (e) {
      doc.text('(QR CODE)', pw / 2, areaY + 25, { align: 'center' });
    }

    // Código de Barras
    const vlCents = Math.round(totalPrincipal * 100).toString().padStart(11, '0');
    const org = "0000";
    const cnpjClean = group.cnpj.replace(/\D/g, '').padEnd(14, '0');
    const codRec = config.codigo;
    const periodo = `12${fp.anoCalendario}`;
    let refLivre = (cnpjClean + codRec + periodo).padEnd(25, '0').slice(0, 25);
    let barrasSemDV = "856" + vlCents + org + refLivre;
    const dvGeral = mod10Arrecadacao(barrasSemDV);
    const barrasFinal = "856" + dvGeral + vlCents + org + refLivre;

    let linhaDigitavel = "";
    for (let b = 0; b < 4; b++) {
      const bloco = barrasFinal.substr(b * 11, 11);
      const dvBloco = mod10Arrecadacao(bloco);
      linhaDigitavel += bloco + "-" + dvBloco + (b < 3 ? " " : "");
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(linhaDigitavel, 105, 265, { align: 'center' });

    try {
      const bCanvas = document.createElement("canvas");
      window.JsBarcode(bCanvas, barrasFinal, { format: "ITF", displayValue: false, margin: 0, height: 40, width: 2 });
      doc.addImage(bCanvas.toDataURL("image/png"), 'PNG', 20, 268, 170, 12);
    } catch (err) { }
  }

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

// ═══ EXPORTAR IOB SAGE — DIGITAÇÃO DIÁRIA (Layout 66 bytes) ═══
//
//  Pos 001-006 (6)  : Código do Funcionário (CPF/Matrícula, 6 dígitos)
//  Pos 007-010 (4)  : Código do Evento (code do rendimento)
//  Pos 011-024 (14) : Referência (últimas 6 = casas decimais → valor × 1.000.000 lpad0)
//  Pos 025-026 (2)  : Espaços em branco
//  Pos 027-040 (14) : Valor (últimas 2 = casas decimais → valor × 100 lpad0)
//  Pos 041-048 (8)  : Data (DDMMAAAA)
//  Pos 049-062 (14) : Valor Unitário (últimas 4 = casas decimais → valor × 10000 lpad0)
//  Pos 063-066 (4)  : Código Evento Salário (zeros)
//
export function exportToCSV(fp, beneficiarios, tipoRendimento) {
  const config = TIPOS_RENDIMENTO[tipoRendimento] || { codigo: '0000', natureza: 'N/A' };
  const codEvento = config.codigo.replace(/\D/g, '').padStart(4, '0').slice(0, 4);
  const anoCalendario = fp.anoCalendario || new Date().getFullYear().toString();

  /**
   * Formata valor numérico como inteiro sem vírgula, preenchido com zeros à esquerda.
   * @param {number} valor  - valor em reais
   * @param {number} tam    - tamanho total do campo
   * @param {number} decimais - quantidade de casas decimais embutidas
   */
  const fmtFixed = (valor, tam, decimais) => {
    const multiplicador = Math.pow(10, decimais);
    const inteiro = Math.round(valor * multiplicador);
    return inteiro.toString().padStart(tam, '0').slice(0, tam);
  };

  const fmtFuncionario = (cpf) => cpf.replace(/\D/g, '').slice(-6).padStart(6, '0');

  const lines = [];

  beneficiarios.forEach(b => {
    b.rend.forEach((val, i) => {
      if (val <= 0) return;

      // Data do lançamento: último dia do mês i, ano de referência
      const mesNum = i + 1;
      const ultimoDia = new Date(parseInt(anoCalendario), mesNum, 0).getDate();
      const dataFmt = String(ultimoDia).padStart(2, '0')
        + String(mesNum).padStart(2, '0')
        + anoCalendario;

      // Campos do registro fixo (66 bytes)
      const codFunc = fmtFuncionario(b.cpf);                    // 001-006 (6)
      const codEv = codEvento;                                 // 007-010 (4)
      const referencia = fmtFixed(val, 14, 6);                    // 011-024 (14)
      const espacos = '  ';                                     // 025-026 (2)
      const valor = fmtFixed(val, 14, 2);                     // 027-040 (14)
      const data = dataFmt;                                   // 041-048 (8)
      const valUnit = fmtFixed(val, 14, 4);                     // 049-062 (14)
      const codEvSal = '0000';                                    // 063-066 (4)

      const linha = codFunc + codEv + referencia + espacos + valor + data + valUnit + codEvSal;
      lines.push(linha);
    });
  });

  const conteudo = lines.join('\r\n');
  const blob = new Blob([conteudo], { type: 'text/plain;charset=windows-1252;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IOB_SAGE_${tipoRendimento}_${anoCalendario}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
