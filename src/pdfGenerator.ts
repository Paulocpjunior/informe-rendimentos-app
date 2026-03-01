import { jsPDF } from 'jspdf';
import { Beneficiario, FontePagadora, NaturezaRendimento, SheetData } from "./types";
import { formatCNPJ, formatCPF, formatCurrency, formatDocument } from "./utils";

function renderPage(doc: any, fonte: FontePagadora, beneficiario: Beneficiario, natureza: NaturezaRendimento) {
  const blueDark = [26, 39, 68];
  const blueLight = [43, 76, 126];
  const bgLight = [220, 230, 240];
  const bgGray = [245, 245, 245];

  doc.setFont("helvetica");
  
  // Header
  doc.setFillColor(blueDark[0], blueDark[1], blueDark[2]);
  doc.rect(10, 10, 190, 20, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("COMPROVANTE DE RENDIMENTOS PAGOS E DE", 105, 18, { align: "center" });
  doc.text("IMPOSTO SOBRE A RENDA RETIDO NA FONTE", 105, 23, { align: "center" });
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`IN RFB nº 2.060/2021 · Natureza: ${natureza.cod} - ${natureza.desc}`, 105, 28, { align: "center" });

  doc.setTextColor(0, 0, 0);

  // Ano Calendario / Exercicio boxes
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(10, 32, 90, 10, "F");
  doc.rect(110, 32, 90, 10, "F");
  
  doc.setFontSize(7);
  doc.text("Ano-Calendário:", 12, 36);
  doc.text("Exercício:", 112, 36);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(fonte.anoCalendario, 12, 40);
  doc.text(fonte.exercicio, 112, 40);

  const drawSection = (y: number, title: string, height: number) => {
    doc.setFillColor(blueLight[0], blueLight[1], blueLight[2]);
    doc.rect(10, y, 190, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(title, 12, y + 4);
    
    doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
    doc.rect(10, y + 6, 190, height, "F");
    doc.setTextColor(0, 0, 0);
  };

  let currentY = 45;
  drawSection(currentY, "1. FONTE PAGADORA", 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("CNPJ:", 12, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(formatCNPJ(fonte.cnpj), 22, currentY + 10);
  
  doc.setFont("helvetica", "normal");
  doc.text("Nome Empresarial:", 60, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(fonte.razaoSocial, 85, currentY + 10);

  currentY += 20;
  drawSection(currentY, "2. PESSOA FÍSICA/JURÍDICA BENEFICIÁRIA DOS RENDIMENTOS", 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("CPF/CNPJ:", 12, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(formatDocument(beneficiario.cpf), 28, currentY + 10);
  
  doc.setFont("helvetica", "normal");
  doc.text("Nome Completo/Razão Social:", 60, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(beneficiario.nome, 95, currentY + 10);
  
  doc.setFont("helvetica", "normal");
  doc.text("Natureza do Rendimento:", 140, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`${natureza.cod} - ${natureza.desc}`, 170, currentY + 10);

  currentY += 20;
  drawSection(currentY, "3. RENDIMENTOS TRIBUTÁVEIS, DEDUÇÕES E IMPOSTO SOBRE A RENDA RETIDO NA FONTE", 30);
  
  const drawLine = (y: number, label: string, value: string) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label, 12, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, 195, y, { align: "right" });
    doc.setDrawColor(200, 200, 200);
    doc.line(10, y + 1, 200, y + 1);
  };

  const isLucros = natureza.cod === "12001";

  drawLine(currentY + 10, "1. Total dos rendimentos (inclusive férias)", isLucros ? "R$ 0,00" : formatCurrency(beneficiario.totalRendimentos));
  drawLine(currentY + 15, "2. Contribuição previdenciária oficial", "R$ 0,00");
  drawLine(currentY + 20, "3. Contribuição a entidades de previdência complementar", "R$ 0,00");
  drawLine(currentY + 25, "4. Pensão alimentícia", "R$ 0,00");
  drawLine(currentY + 30, "5. Imposto sobre a renda retido na fonte", isLucros ? "R$ 0,00" : formatCurrency(beneficiario.totalIrrf));

  currentY += 40;
  drawSection(currentY, "4. RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS", 40);
  drawLine(currentY + 10, "1. Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais)", "R$ 0,00");
  drawLine(currentY + 15, "2. Diárias e ajudas de custo", "R$ 0,00");
  drawLine(currentY + 20, "3. Pensão e proventos de aposentadoria ou reforma por moléstia grave", "R$ 0,00");
  drawLine(currentY + 25, "4. Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado)", isLucros ? formatCurrency(beneficiario.totalRendimentos) : "R$ 0,00");
  drawLine(currentY + 30, "5. Valores pagos ao titular ou sócio da microempresa ou empresa de pequeno porte, exceto pro labore, aluguéis ou serviços", "R$ 0,00");
  drawLine(currentY + 35, "6. Indenizações por rescisão de contrato de trabalho, inclusive a título de PDV, e por acidentes de trabalho", "R$ 0,00");
  drawLine(currentY + 40, "7. Outros", "R$ 0,00");

  currentY += 50;
  drawSection(currentY, "5. RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA (RENDIMENTO LÍQUIDO)", 15);
  drawLine(currentY + 10, "1. Décimo terceiro salário", "R$ 0,00");
  drawLine(currentY + 15, "2. Outros", "R$ 0,00");

  currentY += 25;
  drawSection(currentY, "7. INFORMAÇÕES COMPLEMENTARES", 50);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("MÊS", 15, currentY + 10);
  doc.text("RENDIMENTO", 45, currentY + 10);
  doc.text("IRRF", 85, currentY + 10);
  
  doc.text("MÊS", 115, currentY + 10);
  doc.text("RENDIMENTO", 145, currentY + 10);
  doc.text("IRRF", 185, currentY + 10);

  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 6; i++) {
    const y = currentY + 15 + (i * 5);
    doc.text(meses[i], 15, y);
    doc.text(formatCurrency(beneficiario.rendimentos[i]), 65, y, { align: "right" });
    doc.text(formatCurrency(beneficiario.irrf[i]), 95, y, { align: "right" });
    
    doc.text(meses[i + 6], 115, y);
    doc.text(formatCurrency(beneficiario.rendimentos[i + 6]), 165, y, { align: "right" });
    doc.text(formatCurrency(beneficiario.irrf[i + 6]), 195, y, { align: "right" });
  }

  currentY += 60;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("RESPONSÁVEL PELAS INFORMAÇÕES:", 10, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(fonte.responsavel || fonte.razaoSocial, 65, currentY);
  
  doc.setFont("helvetica", "normal");
  doc.text("DATA:", 150, currentY);
  const today = new Date();
  doc.text(`${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`, 160, currentY);

  // Footer
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text("Documento gerado conforme IN RFB nº 2.060/2021", 105, 285, { align: "center" });
}

export function generatePDF(fonte: FontePagadora, beneficiario: Beneficiario, natureza: NaturezaRendimento): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  renderPage(doc, fonte, beneficiario, natureza);
  return doc;
}

export function generateConsolidatedPDF(fonte: FontePagadora, sheetsData: SheetData[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  let isFirstPage = true;
  for (const sheet of sheetsData) {
    // Override fonte CNPJ if sheet has a specific one
    const currentFonte = { ...fonte, cnpj: sheet.cnpjFonte || fonte.cnpj };
    
    for (const beneficiario of sheet.beneficiarios) {
      if (!isFirstPage) doc.addPage();
      renderPage(doc, currentFonte, beneficiario, sheet.natureza);
      isFirstPage = false;
    }
  }
  
  return doc;
}
