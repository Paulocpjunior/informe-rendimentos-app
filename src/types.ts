export interface FontePagadora {
  cnpj: string;
  razaoSocial: string;
  responsavel: string;
  exercicio: string;
  anoCalendario: string;
}

export interface Beneficiario {
  cpf: string;
  nome: string;
  rendimentos: number[]; // 12 months (0-11)
  irrf: number[]; // 12 months (0-11)
  totalRendimentos: number;
  totalIrrf: number;
}
