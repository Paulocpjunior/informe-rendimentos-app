import { jsPDF } from 'jspdf';
import { Beneficiario, FontePagadora } from "./types";
import { formatCNPJ, formatCPF, formatCurrency, formatDocument } from "./utils";

function renderPage(doc: any, fonte: FontePagadora, beneficiario: Beneficiario) {
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
  doc.text("IN RFB nº 2.060/2021", 105, 28, { align: "center" });

  doc.setTextColor(0, 0, 0);

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

  let currentY = 35;
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
  doc.text("13002 - Aluguéis PF", 170, currentY + 10);

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

  drawLine(currentY + 10, "1. Total dos rendimentos (inclusive férias)", formatCurrency(beneficiario.totalRendimentos));
  drawLine(currentY + 15, "2. Contribuição previdenciária oficial", "R$ 0,00");
  drawLine(currentY + 20, "3. Contribuição a entidades de previdência complementar", "R$ 0,00");
  drawLine(currentY + 25, "4. Pensão alimentícia", "R$ 0,00");
  drawLine(currentY + 30, "5. Imposto sobre a renda retido na fonte", formatCurrency(beneficiario.totalIrrf));

  currentY += 40;
  drawSection(currentY, "4. RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS", 40);
  drawLine(currentY + 10, "1. Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais)", "R$ 0,00");
  drawLine(currentY + 15, "2. Diárias e ajudas de custo", "R$ 0,00");
  drawLine(currentY + 20, "3. Pensão e proventos de aposentadoria ou reforma por moléstia grave", "R$ 0,00");
  drawLine(currentY + 25, "4. Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado)", "R$ 0,00");
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
}

export function generatePDF(fonte: FontePagadora, beneficiario: Beneficiario): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  renderPage(doc, fonte, beneficiario);
  return doc;
}

export function generateConsolidatedPDF(fonte: FontePagadora, beneficiarios: Beneficiario[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  for (let i = 0; i < beneficiarios.length; i++) {
    if (i > 0) doc.addPage();
    renderPage(doc, fonte, beneficiarios[i]);
  }
  
  return doc;
}
