import fs from 'fs';

const filePath = 'c:/Users/design/Desktop/dev/calculadora-lcg/src/pages/MeliPage.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const target = `                                <div className="detail-row">
                                    <span style={{ fontWeight: 700 }}>Preço de Venda {s('PDV')}:</span>
                                    <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results.precoVenda)}</span>
                                </div>`;

const replacement = `                                {results.cupomValor > 0 && (
                                    <div className="detail-row" style={{ color: '#059669', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600 }}>(-) Cupom de Desconto {s('CD')}:</span>
                                        <span className="val" style={{ fontWeight: 600 }}>- R$ {moeda(results.cupomValor)}</span>
                                    </div>
                                )}

                                <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '2px dashed #cbd5e1', marginBottom: '1rem' }}>
                                    <span style={{ fontWeight: 800, color: '#1e3a8a' }}>Preço de Venda Líquido {s('PDV')}:</span>
                                    <span className="val" style={{ fontWeight: 800, color: '#1e3a8a' }}>R$ {moeda(results.precoVenda)}</span>
                                </div>`;

if (content.includes('Preço de Venda {s(\'PDV\')}:')) {
    // Tenta uma substituição mais genérica se a exata falhar
    const regex = /<div className="detail-row">\s*<span style=\{\{ fontWeight: 700 \}\}>Preço de Venda {s\('PDV'\)}:<\/span>\s*<span className="val" style=\{\{ fontWeight: 700 \}\}>R\$ {moeda\(results\.precoVenda\)}<\/span>\s*<\/div>/;
    
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        fs.writeFileSync(filePath, content);
        console.log('Sucesso na substituição via Regex');
    } else {
        // Fallback: procura por uma âncora fixa
        const anchor = "Preço de Venda {s('PDV')}:";
        const lines = content.split('\n');
        const index = lines.findIndex(line => line.includes(anchor));
        if (index !== -1) {
            // Remove a div envolvente (deve estar na linha anterior e posterior)
            lines.splice(index - 1, 3, replacement);
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log('Sucesso na substituição via Fallback de Linha');
        } else {
            console.error('Alvo não encontrado nem com fallback');
            process.exit(1);
        }
    }
} else {
    console.error('String de âncora não encontrada no arquivo');
    process.exit(1);
}
