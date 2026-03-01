import React, { useState, useEffect, useCallback } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { UploadCloud, FileText, CheckCircle, XCircle, LogOut, Download, ChevronRight, ChevronLeft, FileSpreadsheet, Building2, Users, RefreshCw, Loader2, FileCheck, Receipt } from 'lucide-react';
import { CNPJ_DB, NATUREZAS, validateCNPJ, validateCPF, formatCNPJ, formatCPF, formatCurrency, applyCnpjMask, validateDocument, formatDocument } from './utils';
import { FontePagadora, Beneficiario, NaturezaRendimento } from './types';
import { generatePDF, generateConsolidatedPDF } from './pdfGenerator';
import { generateDARF } from './darfGenerator';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');

  const [step, setStep] = useState(1);
  
  // Step 1 State
  const [cnpjInput, setCnpjInput] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [exercicio, setExercicio] = useState('2026');
  const [anoCalendario, setAnoCalendario] = useState('2025');
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [cnpjErrorMsg, setCnpjErrorMsg] = useState('');

  // Step 2 State
  const [naturezaCod, setNaturezaCod] = useState('');

  // Step 3 State
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');

  // Step 4 State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingCpf, setGeneratingCpf] = useState<string | null>(null);

  // Step 5 State
  const [darfPeriodo, setDarfPeriodo] = useState('');
  const [darfVencimento, setDarfVencimento] = useState('');
  const [darfMulta, setDarfMulta] = useState(0);
  const [darfJuros, setDarfJuros] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleNovaAnalise = () => {
    setStep(1);
    setBeneficiarios([]);
    setCnpjInput('');
    setRazaoSocial('');
    setResponsavel('');
    setCnpjStatus('idle');
    setNaturezaCod('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    handleNovaAnalise();
  };

  const handleCnpjChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyCnpjMask(e.target.value);
    setCnpjInput(masked);
    
    const cleanCnpj = masked.replace(/[^\d]+/g, '');
    if (cleanCnpj.length === 14) {
      if (!validateCNPJ(cleanCnpj)) {
        setCnpjStatus('invalid');
        setCnpjErrorMsg('Dígito verificador incorreto');
        setRazaoSocial('');
        return;
      }
      
      setCnpjStatus('loading');
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (res.ok) {
          const data = await res.json();
          setRazaoSocial(data.razao_social);
          setCnpjStatus('valid');
          setCnpjErrorMsg('');
        } else {
          throw new Error('API falhou');
        }
      } catch (err) {
        // Fallback
        const dbRecord = CNPJ_DB[cleanCnpj];
        if (dbRecord) {
          setRazaoSocial(dbRecord.razao_social);
          setCnpjStatus('valid');
          setCnpjErrorMsg('');
        } else {
          setCnpjStatus('invalid');
          setCnpjErrorMsg('CNPJ não encontrado');
          setRazaoSocial('');
        }
      }
    } else {
      setCnpjStatus('idle');
      setCnpjErrorMsg('');
      setRazaoSocial('');
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cnpjStatus === 'valid' && razaoSocial && responsavel) {
      setStep(2);
    }
  };

  const getFontePagadora = (): FontePagadora => ({
    cnpj: cnpjInput.replace(/[^\d]+/g, ''),
    razaoSocial,
    responsavel,
    exercicio,
    anoCalendario
  });

  const getNatureza = (): NaturezaRendimento => {
    return NATUREZAS.find(n => n.cod === naturezaCod) || NATUREZAS[0];
  };

  const processExcel = (data: any[]) => {
    const benesMap = new Map<string, Beneficiario>();

    data.forEach(row => {
      if (!row || !row[3] || String(row[3]).includes('Nome') || String(row[3]).includes('Proprietário')) return;

      const nome = String(row[3]).trim().toUpperCase();
      const cpfRaw = String(row[4] || '').replace(/[^\d]+/g, '');
      const apuracao = row[5];
      const bruto = parseFloat(String(row[6]).replace(',', '.')) || 0;
      const irrf = parseFloat(String(row[7]).replace(',', '.')) || 0;

      if (!nome || !cpfRaw) return;

      let month = 0;
      if (typeof apuracao === 'number') {
        const date = new Date(Math.round((apuracao - 25569) * 86400 * 1000));
        month = date.getUTCMonth();
      } else if (typeof apuracao === 'string') {
        const parts = apuracao.split('/');
        if (parts.length >= 2) {
          month = parseInt(parts[1], 10) - 1;
        }
      }
      
      if (month < 0 || month > 11 || isNaN(month)) month = 0;

      if (!benesMap.has(nome)) {
        benesMap.set(nome, {
          cpf: cpfRaw,
          nome: nome,
          rendimentos: new Array(12).fill(0),
          irrf: new Array(12).fill(0),
          totalRendimentos: 0,
          totalIrrf: 0
        });
      }

      const b = benesMap.get(nome)!;
      b.rendimentos[month] += bruto;
      b.irrf[month] += irrf;
      b.totalRendimentos += bruto;
      b.totalIrrf += irrf;
    });

    setBeneficiarios(Array.from(benesMap.values()));
    setStep(4);
  };

  const handleFile = async (file: File) => {
    setFileError('');
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setFileError('Por favor, envie um arquivo Excel (.xlsx ou .xls).');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          processExcel(data);
        } catch (err) {
          setFileError('Erro ao processar o arquivo Excel.');
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setFileError('Erro ao carregar biblioteca Excel.');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleGenerateIndividual = async (beneficiario: Beneficiario) => {
    if (!user) return;
    setGeneratingCpf(beneficiario.cpf);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const doc = generatePDF(getFontePagadora(), beneficiario, getNatureza());
      doc.save(`Informe_${beneficiario.cpf}_${beneficiario.nome}.pdf`);
    } catch (err: any) {
      console.error('Erro detalhado:', err);
      alert('Erro: ' + err.message);
    } finally {
      setGeneratingCpf(null);
    }
  };

  const handleGenerateConsolidated = async () => {
    if (!user || beneficiarios.length === 0) return;
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const doc = generateConsolidatedPDF(getFontePagadora(), beneficiarios, getNatureza());
      doc.save(`Informes_Consolidados_${getFontePagadora().cnpj}.pdf`);
    } catch (err: any) {
      console.error('Erro detalhado:', err);
      alert('Erro: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDarf = () => {
    const doc = generateDARF(
      getFontePagadora(),
      getNatureza(),
      darfPeriodo,
      darfVencimento,
      totalIrrf,
      darfMulta,
      darfJuros
    );
    doc.save(`DARF_${getFontePagadora().cnpj}_${darfPeriodo.replace('/', '')}.pdf`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2a7fff] to-[#1a5cbf] flex items-center justify-center text-xl font-bold shadow-lg">
                SP
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">Contábil</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Login' : 'Cadastro'}
          </h2>
          {authError && <div className="bg-[#ff6b6b]/20 border border-[#ff6b6b]/50 text-[#ff6b6b] p-3 rounded-lg mb-4 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="label-text">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label-text">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 mt-2 font-medium">
              {isLogin ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-[#7a8fa6] hover:text-white text-sm transition-colors">
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-[#7a8fa6] text-sm">
            © 2026 Direitos Reservados. Desenvolvido BY SP Assessoria Contábil.
          </p>
        </div>
      </div>
    );
  }

  const totalRendimentos = beneficiarios.reduce((acc, b) => acc + b.totalRendimentos, 0);
  const totalIrrf = beneficiarios.reduce((acc, b) => acc + b.totalIrrf, 0);
  const naturezaSelecionada = getNatureza();

  return (
    <div className="min-h-screen p-6 flex flex-col relative">
      {/* Full-screen Loading Overlay */}
      {(isGenerating || generatingCpf) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-8 flex flex-col items-center max-w-sm text-center">
            <Loader2 size={48} className="animate-spin text-[#2a7fff] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Gerando PDF...</h3>
            <p className="text-[#7a8fa6] text-sm">Por favor, aguarde enquanto o documento é processado. Isso pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      <header className="max-w-5xl mx-auto w-full flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2a7fff] to-[#1a5cbf] flex items-center justify-center text-xl font-bold shadow-lg">
              SP
            </div>
            <span className="text-xl font-bold text-white tracking-tight hidden sm:block">Contábil</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10 hidden sm:block"></div>
          <div>
            <h1 className="text-xl font-bold text-white">Gerador de Informe de Rendimentos</h1>
            <p className="text-[#7a8fa6] text-sm">EFD-REINF · R-4010 · IN RFB 2.060/2021</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#7a8fa6]">{user.email}</span>
          <button onClick={handleLogout} className="flex items-center gap-2 glass-card px-3 py-1.5 hover:bg-white/10 transition-colors text-sm">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full">
        {/* Steps */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[
            { num: 1, label: 'Fonte Pagadora', icon: Building2 },
            { num: 2, label: 'Tipo de Rendimento', icon: FileCheck },
            { num: 3, label: 'Importar Excel', icon: FileSpreadsheet },
            { num: 4, label: 'Gerar PDFs', icon: Users },
            { num: 5, label: 'Gerar DARF', icon: Receipt }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${step >= s.num ? 'border-[#2a7fff] bg-[#2a7fff]/10 text-white' : 'border-white/10 text-[#7a8fa6]'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.num ? 'bg-[#2a7fff] text-white' : 'bg-white/10'}`}>
                  {s.num}
                </div>
                <span className="text-sm font-medium hidden md:block">{s.label}</span>
              </div>
              {s.num < 5 && <div className="w-4 md:w-8 h-[1px] bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="glass-card p-8 max-w-2xl mx-auto">
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="label-text">CNPJ da Fonte Pagadora</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={cnpjInput}
                      onChange={handleCnpjChange}
                      placeholder="00.000.000/0000-00"
                      className="input-field font-mono text-lg py-3"
                      maxLength={18}
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cnpjStatus === 'loading' && <div className="animate-spin w-5 h-5 border-2 border-[#2a7fff] border-t-transparent rounded-full" />}
                      {cnpjStatus === 'valid' && <span className="flex items-center gap-1 text-[#2ac864] text-sm font-medium bg-[#2ac864]/10 px-2 py-1 rounded"><CheckCircle size={14} /> Válido</span>}
                      {cnpjStatus === 'invalid' && <span className="flex items-center gap-1 text-[#ff6b6b] text-sm font-medium bg-[#ff6b6b]/10 px-2 py-1 rounded"><XCircle size={14} /> {cnpjErrorMsg}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <label className="label-text">Razão Social</label>
                  <input 
                    type="text" 
                    value={razaoSocial}
                    readOnly
                    className="input-field bg-black/40 text-gray-300"
                    placeholder="Preenchimento automático"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="label-text">Responsável pelas Informações</label>
                  <input 
                    type="text" 
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="input-field"
                    placeholder="Nome do responsável"
                    required
                  />
                </div>

                <div>
                  <label className="label-text">Ano-Calendário</label>
                  <input 
                    type="text" 
                    value={anoCalendario}
                    onChange={(e) => setAnoCalendario(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-text">Exercício</label>
                  <input 
                    type="text" 
                    value={exercicio}
                    onChange={(e) => setExercicio(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit"
                  disabled={cnpjStatus !== 'valid' || !responsavel}
                  className="btn-primary px-8 py-3 flex items-center gap-2 font-medium"
                >
                  Continuar <ChevronRight size={18} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="glass-card p-8 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Tipo de Rendimento</h2>
              <button onClick={() => setStep(1)} className="text-sm text-[#7a8fa6] hover:text-white flex items-center gap-1">
                <ChevronLeft size={16} /> Voltar
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="label-text">Selecione a Natureza do Rendimento</label>
                <select 
                  value={naturezaCod}
                  onChange={(e) => setNaturezaCod(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="" disabled>Selecione uma opção...</option>
                  {Array.from(new Set(NATUREZAS.map(n => n.grupo))).map(grupo => (
                    <optgroup key={grupo} label={grupo}>
                      {NATUREZAS.filter(n => n.grupo === grupo).map(n => (
                        <option key={n.cod} value={n.cod}>
                          {n.cod} - {n.desc}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {naturezaCod && (
                <div className="glass-card p-4 bg-black/20">
                  <h3 className="text-sm font-medium text-[#7a8fa6] mb-2">Detalhes da Natureza Selecionada</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Código:</span>
                      <span className="text-sm font-mono text-white">{naturezaSelecionada.cod}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Descrição:</span>
                      <span className="text-sm text-white text-right max-w-[70%]">{naturezaSelecionada.desc}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Código Receita (DARF):</span>
                      <span className="text-sm font-mono text-white">{naturezaSelecionada.codReceita || 'N/A'}</span>
                    </div>
                    {naturezaSelecionada.isento && (
                      <div className="mt-2 text-[#2ac864] text-sm font-medium flex items-center gap-1">
                        <CheckCircle size={14} /> Rendimento Isento (Não gera DARF)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={() => setStep(3)}
                  disabled={!naturezaCod}
                  className="btn-primary px-8 py-3 flex items-center gap-2 font-medium"
                >
                  Continuar <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="glass-card p-8 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Importar Planilha</h2>
              <button onClick={() => setStep(2)} className="text-sm text-[#7a8fa6] hover:text-white flex items-center gap-1">
                <ChevronLeft size={16} /> Voltar
              </button>
            </div>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragging ? 'border-[#2a7fff] bg-[#2a7fff]/10' : 'border-[#2a7fff]/30 hover:border-[#2a7fff]/60 bg-black/20'}`}
            >
              <FileSpreadsheet size={48} className={`mx-auto mb-4 ${isDragging ? 'text-[#2a7fff]' : 'text-[#7a8fa6]'}`} />
              <p className="text-lg font-medium text-white mb-2">Arraste o arquivo Excel aqui</p>
              <p className="text-sm text-[#7a8fa6] mb-6">ou clique para selecionar (.xlsx, .xls)</p>
              
              <label className="cursor-pointer glass-card hover:bg-white/10 px-6 py-2.5 rounded-lg transition-colors inline-block text-sm font-medium text-white">
                Selecionar Arquivo
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
              </label>
            </div>
            {fileError && <p className="text-[#ff6b6b] text-sm mt-4 text-center flex items-center justify-center gap-1"><XCircle size={14} /> {fileError}</p>}
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="text-sm text-[#7a8fa6] hover:text-white flex items-center gap-1">
                  <ChevronLeft size={16} /> Voltar
                </button>
                <button onClick={handleNovaAnalise} className="text-sm text-[#2a7fff] hover:text-blue-400 flex items-center gap-1 ml-4">
                  <RefreshCw size={14} /> Nova Análise
                </button>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleGenerateConsolidated}
                  disabled={isGenerating || generatingCpf !== null}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2 font-medium"
                >
                  {isGenerating ? (
                    <><Loader2 size={18} className="animate-spin" /> Gerando...</>
                  ) : (
                    <><FileText size={18} /> Gerar PDF Consolidado ({beneficiarios.length} informes)</>
                  )}
                </button>
                <button 
                  onClick={() => setStep(5)}
                  className="glass-card px-6 py-2.5 flex items-center gap-2 font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Avançar para DARF <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="glass-card p-5">
                <span className="label-text">Fonte Pagadora</span>
                <p className="text-white font-medium truncate">{razaoSocial}</p>
                <p className="text-sm text-[#7a8fa6] font-mono mt-1">{cnpjInput}</p>
              </div>
              <div className="glass-card p-5">
                <span className="label-text">Total Rendimentos</span>
                <p className="text-[17px] font-bold text-[#2a7fff]">{formatCurrency(totalRendimentos)}</p>
              </div>
              <div className="glass-card p-5">
                <span className="label-text">Total IRRF</span>
                <p className="text-[17px] font-bold text-[#ff8c42]">{formatCurrency(totalIrrf)}</p>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-black/20">
                    <th className="py-3 pl-5 text-xs font-medium text-[#7a8fa6] uppercase tracking-wider">Beneficiário</th>
                    <th className="py-3 text-xs font-medium text-[#7a8fa6] uppercase tracking-wider">CPF/CNPJ</th>
                    <th className="py-3 text-xs font-medium text-[#7a8fa6] uppercase tracking-wider text-right">Rendimentos</th>
                    <th className="py-3 text-xs font-medium text-[#7a8fa6] uppercase tracking-wider text-right">IRRF</th>
                    <th className="py-3 pr-5 text-xs font-medium text-[#7a8fa6] uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {beneficiarios.map((b, idx) => {
                    const cpfValido = validateDocument(b.cpf);
                    return (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-5 font-medium text-white">{b.nome}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#7a8fa6]">{formatDocument(b.cpf)}</span>
                            {cpfValido ? (
                              <span className="text-[#2ac864] bg-[#2ac864]/10 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle size={10} /> VÁLIDO</span>
                            ) : (
                              <span className="text-[#ff6b6b] bg-[#ff6b6b]/10 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><XCircle size={10} /> INVÁLIDO</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right text-white">{formatCurrency(b.totalRendimentos)}</td>
                        <td className="py-3 text-right text-[#ff8c42] font-medium">{formatCurrency(b.totalIrrf)}</td>
                        <td className="py-3 pr-5 text-right">
                          <button 
                            onClick={() => handleGenerateIndividual(b)}
                            disabled={isGenerating || generatingCpf !== null}
                            className="inline-flex items-center gap-1.5 glass-card hover:bg-white/10 px-3 py-1.5 rounded text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingCpf === b.cpf ? (
                              <><Loader2 size={14} className="animate-spin" /> Gerando</>
                            ) : (
                              <><FileText size={14} /> Gerar PDF</>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-white/10 bg-black/20 font-bold">
                    <td className="py-3 pl-5 text-white" colSpan={2}>TOTAL</td>
                    <td className="py-3 text-right text-[#2a7fff]">{formatCurrency(totalRendimentos)}</td>
                    <td className="py-3 text-right text-[#ff8c42]">{formatCurrency(totalIrrf)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="glass-card p-8 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Gerar DARF</h2>
              <button onClick={() => setStep(4)} className="text-sm text-[#7a8fa6] hover:text-white flex items-center gap-1">
                <ChevronLeft size={16} /> Voltar
              </button>
            </div>

            {naturezaSelecionada.isento ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="mx-auto text-[#2ac864] mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Natureza Isenta</h3>
                <p className="text-[#7a8fa6]">A natureza selecionada ({naturezaSelecionada.cod}) é isenta de IRRF. Não é necessário gerar DARF.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="label-text">Período de Apuração (Mês/Ano)</label>
                    <input 
                      type="text" 
                      value={darfPeriodo}
                      onChange={(e) => setDarfPeriodo(e.target.value)}
                      placeholder="MM/AAAA"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Data de Vencimento</label>
                    <input 
                      type="text" 
                      value={darfVencimento}
                      onChange={(e) => setDarfVencimento(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Valor Principal (IRRF)</label>
                    <input 
                      type="text" 
                      value={formatCurrency(totalIrrf)}
                      readOnly
                      className="input-field bg-black/40 text-[#ff8c42] font-bold"
                    />
                  </div>
                  <div>
                    <label className="label-text">Código da Receita</label>
                    <input 
                      type="text" 
                      value={naturezaSelecionada.codReceita || ''}
                      readOnly
                      className="input-field bg-black/40 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="label-text">Multa (R$)</label>
                    <input 
                      type="number" 
                      value={darfMulta}
                      onChange={(e) => setDarfMulta(parseFloat(e.target.value) || 0)}
                      className="input-field"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="label-text">Juros (R$)</label>
                    <input 
                      type="number" 
                      value={darfJuros}
                      onChange={(e) => setDarfJuros(parseFloat(e.target.value) || 0)}
                      className="input-field"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                  <div>
                    <span className="text-sm text-[#7a8fa6]">Valor Total do DARF</span>
                    <p className="text-2xl font-bold text-white">{formatCurrency(totalIrrf + darfMulta + darfJuros)}</p>
                  </div>
                  <button 
                    onClick={handleGenerateDarf}
                    disabled={!darfPeriodo || !darfVencimento}
                    className="btn-primary px-8 py-3 flex items-center gap-2 font-medium"
                  >
                    <Receipt size={18} /> Gerar Guia DARF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto w-full mt-auto pt-12 pb-4 text-center">
        <p className="text-[#7a8fa6] text-sm">
          © 2026 Direitos Reservados. Desenvolvido BY SP Assessoria Contábil.
        </p>
      </footer>
    </div>
  );
}

