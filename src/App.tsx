import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { UploadCloud, FileText, CheckCircle, XCircle, LogOut, Download, ChevronRight, ChevronLeft } from 'lucide-react';
import { CNPJ_DB, validateCNPJ, validateCPF, formatCNPJ, formatCPF, formatCurrency } from './utils';
import { FontePagadora, Beneficiario } from './types';
import { generatePDF } from './pdfGenerator';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');

  const [step, setStep] = useState(1);
  const [fontePagadora, setFontePagadora] = useState<FontePagadora | null>(null);
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjError, setCnpjError] = useState('');

  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleLogout = async () => {
    await signOut(auth);
    setStep(1);
    setFontePagadora(null);
    setBeneficiarios([]);
  };

  const handleCnpjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCnpjError('');
    const cleanCnpj = cnpjInput.replace(/[^\d]+/g, '');
    
    if (!validateCNPJ(cleanCnpj)) {
      setCnpjError('CNPJ inválido (Dígito Verificador incorreto).');
      return;
    }

    const dbRecord = CNPJ_DB[cleanCnpj];
    if (dbRecord) {
      setFontePagadora({
        cnpj: cleanCnpj,
        razaoSocial: dbRecord.razao_social
      });
      setStep(2);
    } else {
      setCnpjError('CNPJ não encontrado no banco de dados interno.');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processExcel = (data: any[]) => {
    // Expected Columns: Localidade, CNPJ fonte, Código, Nome Proprietário, CPF Proprietário, Apuração (data), Bruto, IRRF, Líquido
    const benesMap = new Map<string, Beneficiario>();

    data.forEach(row => {
      // Skip header rows or empty rows
      if (!row || !row[3] || String(row[3]).includes('Nome') || String(row[3]).includes('Proprietário')) return;

      const nome = String(row[3]).trim().toUpperCase();
      const cpfRaw = String(row[4] || '').replace(/[^\d]+/g, '');
      const apuracao = row[5]; // Date or string
      const bruto = parseFloat(String(row[6]).replace(',', '.')) || 0;
      const irrf = parseFloat(String(row[7]).replace(',', '.')) || 0;

      if (!nome || !cpfRaw) return;

      let month = 0;
      if (typeof apuracao === 'number') {
        // Excel date
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
          cpf: cpfRaw, // Use first CPF found for this name
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
    setStep(3);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setFileError('');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0];

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setFileError('Por favor, envie um arquivo Excel (.xlsx ou .xls).');
      return;
    }

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
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

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
  };

  const handleGeneratePDF = async (beneficiario: Beneficiario) => {
    if (!fontePagadora || !user) return;
    
    try {
      const blob = generatePDF(fontePagadora, beneficiario);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_Rendimentos_${beneficiario.cpf}_${beneficiario.nome}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log to Firestore
      await addDoc(collection(db, 'pdf_logs'), {
        userId: user.uid,
        userEmail: user.email,
        fontePagadoraCnpj: fontePagadora.cnpj,
        beneficiarioCpf: beneficiario.cpf,
        beneficiarioNome: beneficiario.nome,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Erro ao gerar PDF.");
    }
  };

  const handleGenerateAll = async () => {
    if (!fontePagadora || !user) return;
    setIsGenerating(true);
    
    for (const b of beneficiarios) {
      await handleGeneratePDF(b);
      // Small delay to prevent browser from blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsGenerating(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1b2a] via-[#1b2a4a] to-[#1a3a5c] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Login' : 'Cadastro'}
          </h2>
          {authError && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-[#2a7fff] to-[#1a5cbf] hover:from-[#3a8fff] hover:to-[#2a6ccf] text-white font-medium py-2 rounded-lg transition-all shadow-lg"
            >
              {isLogin ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-300 hover:text-blue-200 text-sm transition-colors"
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1b2a] via-[#1b2a4a] to-[#1a3a5c] text-white p-6">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200">
            Gerador de Informes
          </h1>
          <p className="text-blue-200/60 text-sm">Natureza 13002 - Aluguéis PF</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{user.email}</span>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors text-sm"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${step >= s ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-white/20 text-white/40'}`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-24 h-1 mx-2 rounded ${step > s ? 'bg-blue-500' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Fonte Pagadora */}
        {step === 1 && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl max-w-xl mx-auto">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FileText className="text-blue-400" /> Dados da Fonte Pagadora
            </h2>
            <form onSubmit={handleCnpjSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">CNPJ da Fonte Pagadora</label>
                <input 
                  type="text" 
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                {cnpjError && <p className="text-red-400 text-sm mt-2 flex items-center gap-1"><XCircle size={14} /> {cnpjError}</p>}
              </div>
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2a7fff] to-[#1a5cbf] hover:from-[#3a8fff] hover:to-[#2a6ccf] text-white font-medium py-3 rounded-lg transition-all shadow-lg mt-4"
              >
                Validar e Continuar <ChevronRight size={18} />
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Importar Excel */}
        {step === 2 && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UploadCloud className="text-blue-400" /> Importar Planilha
              </h2>
              <button onClick={() => setStep(1)} className="text-sm text-blue-300 hover:text-blue-200 flex items-center gap-1">
                <ChevronLeft size={16} /> Voltar
              </button>
            </div>
            
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-200">
                <span className="font-bold text-white">Fonte Pagadora:</span> {fontePagadora?.razaoSocial} ({formatCNPJ(fontePagadora?.cnpj || '')})
              </p>
            </div>

            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 hover:border-white/40 bg-black/10'}`}
            >
              <UploadCloud size={48} className={`mx-auto mb-4 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`} />
              <p className="text-lg mb-2">Arraste e solte sua planilha Excel aqui</p>
              <p className="text-sm text-gray-400 mb-6">ou clique para selecionar o arquivo (.xlsx, .xls)</p>
              
              <label className="cursor-pointer bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-2 rounded-lg transition-colors inline-block">
                Selecionar Arquivo
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileInput} />
              </label>
            </div>
            {fileError && <p className="text-red-400 text-sm mt-4 text-center flex items-center justify-center gap-1"><XCircle size={14} /> {fileError}</p>}
          </div>
        )}

        {/* Step 3: Gerar PDFs */}
        {step === 3 && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="text-green-400" /> Beneficiários Processados
                </h2>
                <p className="text-sm text-gray-400 mt-1">{beneficiarios.length} registros encontrados</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-sm flex items-center gap-2">
                  <ChevronLeft size={16} /> Voltar
                </button>
                <button 
                  onClick={handleGenerateAll}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-gradient-to-r from-[#2a7fff] to-[#1a5cbf] hover:from-[#3a8fff] hover:to-[#2a6ccf] disabled:opacity-50 text-white rounded-lg transition-all shadow-lg text-sm flex items-center gap-2"
                >
                  <Download size={16} /> {isGenerating ? 'Gerando...' : 'Baixar Todos'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-sm text-gray-400">
                    <th className="pb-3 pl-4 font-medium">Beneficiário</th>
                    <th className="pb-3 font-medium">CPF</th>
                    <th className="pb-3 font-medium text-right">Rendimentos</th>
                    <th className="pb-3 font-medium text-right">IRRF</th>
                    <th className="pb-3 font-medium text-center">Status CPF</th>
                    <th className="pb-3 pr-4 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {beneficiarios.map((b, idx) => {
                    const cpfValido = validateCPF(b.cpf);
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 pl-4 font-medium">{b.nome}</td>
                        <td className="py-4 font-mono text-gray-300">{formatCPF(b.cpf)}</td>
                        <td className="py-4 text-right">{formatCurrency(b.totalRendimentos)}</td>
                        <td className="py-4 text-right text-[#ff8c42] font-medium">{formatCurrency(b.totalIrrf)}</td>
                        <td className="py-4 text-center">
                          {cpfValido ? (
                            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs border border-green-500/30">
                              <CheckCircle size={12} /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs border border-red-500/30">
                              <XCircle size={12} /> Inválido
                            </span>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-right">
                          <button 
                            onClick={() => handleGeneratePDF(b)}
                            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded transition-colors text-xs"
                          >
                            <Download size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

