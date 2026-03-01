import { jsPDF } from 'jspdf';
import { FontePagadora, NaturezaRendimento } from './types';
import { formatCNPJ, formatCurrency } from './utils';

export function generateDARF(
  fonte: FontePagadora,
  natureza: NaturezaRendimento,
  periodoApuracao: string,
  dataVencimento: string,
  valorPrincipal: number,
  multa: number = 0,
  juros: number = 0
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const valorTotal = valorPrincipal + multa + juros;

  doc.setFont("helvetica");
  
  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("MINISTÉRIO DA FAZENDA", 105, 20, { align: "center" });
  doc.text("SECRETARIA DA RECEITA FEDERAL", 105, 26, { align: "center" });
  
  doc.setFontSize(12);
  doc.text("Documento de Arrecadação de Receitas Federais", 105, 34, { align: "center" });
  doc.setFontSize(16);
  doc.text("DARF", 105, 42, { align: "center" });

  // Grid
  doc.setLineWidth(0.5);
  doc.rect(20, 50, 170, 120);
  
  // Vertical line
  doc.line(105, 50, 105, 170);
  
  // Horizontal lines right side
  for (let i = 1; i < 8; i++) {
    doc.line(105, 50 + (i * 15), 190, 50 + (i * 15));
  }

  // Left side content
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("01 NOME / TELEFONE", 22, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(fonte.razaoSocial, 22, 62, { maxWidth: 80 });
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Observações:", 22, 100);
  doc.text(`Natureza: ${natureza.cod} - ${natureza.desc}`, 22, 105, { maxWidth: 80 });

  // Right side content
  const rightLabels = [
    "02 PERÍODO DE APURAÇÃO",
    "03 NÚMERO DO CPF OU CNPJ",
    "04 CÓDIGO DA RECEITA",
    "05 NÚMERO DE REFERÊNCIA",
    "06 DATA DE VENCIMENTO",
    "07 VALOR DO PRINCIPAL",
    "08 VALOR DA MULTA",
    "09 VALOR DOS JUROS E / OU ENCARGOS DL - 1.025/69",
    "10 VALOR TOTAL"
  ];

  const rightValues = [
    periodoApuracao,
    formatCNPJ(fonte.cnpj),
    natureza.codReceita || "",
    periodoApuracao.replace("/", ""),
    dataVencimento,
    formatCurrency(valorPrincipal),
    formatCurrency(multa),
    formatCurrency(juros),
    formatCurrency(valorTotal)
  ];

  for (let i = 0; i < 8; i++) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(rightLabels[i], 107, 54 + (i * 15));
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (i >= 5) {
      doc.text(rightValues[i], 188, 62 + (i * 15), { align: "right" });
    } else {
      doc.text(rightValues[i], 107, 62 + (i * 15));
    }
  }

  // Total
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(rightLabels[8], 107, 54 + (8 * 15));
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(rightValues[8], 188, 62 + (8 * 15), { align: "right" });

  return doc;
}
