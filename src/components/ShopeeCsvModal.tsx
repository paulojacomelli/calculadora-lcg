import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import type { ShopeeInput } from '../utils/shopeeLogic';
import { calcularTaxasShopee, calcularPrecoIdealDetalhado } from '../utils/shopeeLogic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  baseInputs: ShopeeInput;
}

export const ShopeeCsvModal: React.FC<Props> = ({ isOpen, onClose, baseInputs }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [operationType, setOperationType] = useState<'margem' | 'ideal'>('margem');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setProcessedData([]);
    }
  };

  const extrairValor = (row: any, possíveisColunas: string[]) => {
    for (const col of possíveisColunas) {
      if (row[col] !== undefined && row[col] !== null && row[col].toString().trim() !== '') {
        const valStr = row[col].toString().replace('R$', '').replace(/\s/g, '').replace(',', '.');
        const valNum = parseFloat(valStr);
        if (!isNaN(valNum)) return valNum;
      }
    }
    return undefined;
  };

  const processFile = () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          const output = rows.map((row) => {
            const sku = row.sku || row.SKU || row.id || '';
            const custoProduto = extrairValor(row, ['custo_produto', 'custo', 'Custo', 'Custo Produto', 'CDP']);
            const precoVendaCampo = extrairValor(row, ['preco_venda', 'preco', 'Preço', 'Preco Venda', 'PA']);
            const margemDesejadaCampo = extrairValor(row, ['margem_desejada', 'margem', 'Margem', 'Margem Desejada']);

            let outRow: any = { SKU: sku, 'Custo Original': custoProduto };

            if (custoProduto === undefined) {
              outRow['Erro'] = 'Custo não encontrado ou inválido';
              return { ...row, ...outRow };
            }

            if (operationType === 'margem') {
              if (precoVendaCampo === undefined) {
                outRow['Erro'] = 'Preço de venda não encontrado';
                return { ...row, ...outRow };
              }
              const inputsComLinha: ShopeeInput = { ...baseInputs, custoProduto, precoVenda: precoVendaCampo };
              const resultado = calcularTaxasShopee(inputsComLinha, true); // true para arredondar

              outRow['Preço Anunciado'] = precoVendaCampo;
              outRow['Preço de Venda (PDV)'] = resultado.precoVenda;
              outRow['Lucro Líquido (R$)'] = resultado.lucroLiquido;
              outRow['Margem de Contribuição (%)'] = resultado.margemSobreVenda;
              outRow['Taxas Shopee (R$)'] = (resultado.comissaoValor + resultado.tarifaFixa).toFixed(2);
              outRow['Custos Extras (R$)'] = (resultado.impostoValor + resultado.despesaFixaValor + resultado.despesaAdicionalValor + resultado.custoAds).toFixed(2);
            } else {
              if (margemDesejadaCampo === undefined) {
                outRow['Erro'] = 'Margem desejada não encontrada';
                return { ...row, ...outRow };
              }
              const inputsComLinha: ShopeeInput = { ...baseInputs, custoProduto };
              const otimizacao = calcularPrecoIdealDetalhado(inputsComLinha, margemDesejadaCampo, 'venda');
              
              outRow['Margem Desejada (%)'] = margemDesejadaCampo;
              outRow['Preço Base Sugerido (R$)'] = otimizacao.precoOriginal;
              outRow['Preço Otimizado Sensor (R$)'] = otimizacao.precoOtimizado;
              outRow['Lucro Reais (R$)'] = otimizacao.lucroOtimizado.toFixed(2);
              outRow['Alavancagem Ativada'] = otimizacao.isAlavancagem ? 'Sim' : 'Não';
            }

            return { ...row, ...outRow }; // Mantém os campos originais + novos cálculos
          });

          setProcessedData(output);
          setIsProcessing(false);
        } catch (err: any) {
          setError('Erro ao processar as linhas: ' + err.message);
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setError('Erro ao ler CSV: ' + err.message);
        setIsProcessing(false);
      }
    });
  };

  const downloadResults = () => {
    if (processedData.length === 0) return;
    const csvContent = Papa.unparse(processedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shopee_lote_resultado_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="reset-modal-overlay">
      <div className="reset-modal" style={{ maxWidth: '600px', width: '90%' }}>
        <button className="reset-modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        <div className="reset-modal-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
          <FileSpreadsheet size={32} />
        </div>
        <h2 className="reset-modal-title">Processamento em Lote (CSV)</h2>
        <p className="reset-modal-desc" style={{ marginBottom: '1.5rem' }}>
          Utilize as <strong>configurações avançadas atuais</strong> de impostos, ADS e taxas para calcular o lucro ou o preço ideal de múltiplos produtos de uma vez!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
          
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: '#1e293b' }}>
              1. Qual cálculo deseja fazer na planilha?
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="op" 
                  checked={operationType === 'margem'} 
                  onChange={() => setOperationType('margem')} 
                /> 
                Descobrir Margens e Lucro
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="op" 
                  checked={operationType === 'ideal'} 
                  onChange={() => setOperationType('ideal')} 
                /> 
                Achar Preço Ideal (Alvo)
              </label>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b' }}>
              2. Padrão da Tabela (Colunas exigidas):
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#475569' }}>
              <li><strong>sku</strong> ou <strong>id</strong> (opcional, mas recomendado)</li>
              <li><strong>custo</strong> ou <strong>custo_produto</strong> (obrigatório)</li>
              {operationType === 'margem' ? (
                <li><strong>preco</strong> ou <strong>preco_venda</strong> (obrigatório)</li>
              ) : (
                <li><strong>margem</strong> ou <strong>margem_desejada</strong> (obrigatório, em %)</li>
              )}
            </ul>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: '#1e293b' }}>
              3. Envie sua planilha CSV
            </label>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

        </div>

        <div className="reset-modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={isProcessing}>
            Voltar
          </button>
          
          {processedData.length > 0 ? (
            <button className="btn-primary" onClick={downloadResults} style={{ background: '#10b981', borderColor: '#10b981' }}>
              <Download size={18} /> Baixar Resultados
            </button>
          ) : (
            <button className="btn-primary" onClick={processFile} disabled={!file || isProcessing}>
              {isProcessing ? 'Processando...' : <><Upload size={18} /> Processar Planilha</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
