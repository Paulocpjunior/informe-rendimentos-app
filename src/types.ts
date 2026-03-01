export interface FontePagadora {
  cnpj: string;
  razaoSocial: string;
  responsavel: string;
  exercicio: string;
  anoCalendario: string;
}

export interface NaturezaRendimento {
  cod: string;
  desc: string;
  codReceita: string | null;
  grupo: string;
  isento?: boolean;
}

export interface Beneficiario {
  cpf: string;
  nome: string;
  rendimentos: number[]; // 12 months (0-11)
  irrf: number[]; // 12 months (0-11)
  totalRendimentos: number;
  totalIrrf: number;
  cpfValido: boolean;
}

export interface SheetData {
  sheetName: string;
  natureza: NaturezaRendimento;
  cnpjFonte: string;
  beneficiarios: Beneficiario[];
}
