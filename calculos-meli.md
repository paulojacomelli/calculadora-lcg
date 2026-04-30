# Prompt para Vibe Coding — Calculadora de Margem e Preço Ideal — Mercado Livre

## Visão Geral do App

Construa uma **Calculadora de Margem e Preço Ideal para Mercado Livre** com duas abas principais:

1. **Calcular Margem** — o usuário informa o preço anunciado e descobre a margem real
2. **Preço Ideal** — o usuário informa a margem desejada e o app calcula o preço ideal

O app exibe um painel lateral esquerdo com os **Parâmetros de Cálculo [PDL]** e um painel direito com os **resultados em tempo real**.

---

## Estrutura Visual

### Header
- Logo da empresa (LCG) + Logo Mercado Livre
- Título: **"Calculadora de Margem Mercado Livre"**
- Subtítulo: *"Descubra sua margem de contribuição após comissão, custo de envio e publicidade. Resultado em segundos!"*
- Navegação: Shopee | **Mercado Livre** (ativo) | Catálogo | Marketing

### Abas de Modo
- `[ Calcular Margem ]` — calcula a margem a partir de um preço informado
- `[ Preço Ideal ]` — calcula o preço ideal a partir de uma margem desejada

---

## Painel Esquerdo — Parâmetros de Cálculo [PDL]

### Seção: Valores Base

#### Buscar no Catálogo
- Campo de busca para selecionar produto do catálogo interno
- Exibe: código do produto + nome (ex: `SP 14174 — Vaporizador Passadeira De...`)

#### Custo do Produto (R$) `[CDP]`
- Campo numérico com valor em reais
- Multiplicador de quantidade (ex: `128,38 × 1`)

---

### Seção: Anúncio

#### Tipo de Anúncio
- Botões de seleção: `Clássico` | `Premium` | `Ambos`
- Quando **Ambos** selecionado: exibe comparativo lado a lado no resultado

#### Comissão Clássico (%) `[CML]`
- Campo numérico editável (padrão: 12,00%)
- Nota: *"Comissão 12% + taxa fixa abaixo de R$79"*

#### Comissão Premium (%) `[CML]`
- Campo numérico editável (padrão: 17,00%)
- Visível apenas quando Premium ou Ambos selecionado

#### Preço Anunciado (R$) `[PAC]` *(apenas na aba Calcular Margem)*
- Campo numérico com o preço que será anunciado na vitrine
- Nota automática: *"Comissão 12% + taxa fixa abaixo de R$79"*

#### Lucro Desejado (%) `[MSCD]` *(apenas na aba Preço Ideal)*
- Tabs: `Sobre o Custo` | `Sobre a Venda` | `Ou (R$)`
- Campo numérico (ex: 5,00%)
- Descrição: *"Meta de lucro líquido para esta venda"*

#### Peso do Produto (Kg) `[PES]`
- Campo numérico (ex: 7,00)
- Indicador automático de faixa: *"Faixa detectada: Até 9kg"*

---

### Seção: Descontos

#### Crédito de Rebate `[CR]`
- Campo numérico + dropdown (% ou R$)
- Padrão: 3,00%

#### Cupom de Desconto `[CD]`
- Campo numérico + dropdown (% ou R$)
- Padrão: 5,00%

#### Desconto no Cadastro `[DC]`
- Campo numérico + dropdown (% ou R$)
- Padrão: 10,00%

---

### Seção: Configurações Avançadas (expansível com ▲/▼)

#### Reputação do Vendedor
- Barra visual colorida (vermelho → amarelo → verde)
- Indicador: *"Reputação Verde"*
- Influencia o cálculo do frete grátis obrigatório

#### Sensor de Otimização
- Toggle on/off
- Descrição: *"Sugere preços estratégicos e alavancagem de giro"*

#### Fator de Alavancagem (Giro)
- Campo numérico (ex: 5,00)
- Descrição: *"Ex: 5x significa que para cada R$1 perdido, o cliente ganha R$5 de desconto."*

#### Impostos e Custos Fixos

**Imposto `[IMP]`**
- Campo numérico + dropdown (% ou R$)
- Padrão: 6,50%
- Descrição: *"Alíquota efetiva de impostos (Simples/DAS)"*

**Despesa Fixa `[DF]`**
- Campo numérico + dropdown (% ou R$)
- Padrão: 8,00%
- Descrição: *"Custos fixos mensais rateados"*

**Outras Despesas `[OD]`**
- Campo numérico + dropdown (% ou R$)
- Padrão: 1,00%
- Descrição: *"Outros custos variáveis não previstos"*

#### Marketing e Descontos

**Ads (Marketing) `[ADS]`**
- Campo numérico + dropdown (% ou R$)
- Padrão: 1,00%
- Descrição: *"Investimento direto em Mercado Ads"*

---

### Botões de Ação

- `🧮 CALCULAR MARGEM` (vermelho/laranja) — botão principal
- `↺ Reiniciar Calculadora` (branco/outline)
- `📊 Processar Lote` (amarelo) — processa múltiplos produtos

---

## Painel Direito — Resultados

### Banner de Status
- ✅ Verde: *"Parabéns! Sua margem está saudável!"*
- ⚠️ Amarelo: *"Atenção: Margem abaixo do ideal (15%)"*

---

### Cards de Preço (3 cards lado a lado)

#### Aba: Calcular Margem
| Card | Sigla | Descrição |
|------|-------|-----------|
| **Preço de Venda** | `[PDV]` | Valor sem cupom |
| **Preço Anunciado** | `[PA]` | Valor exibido na vitrine |
| **Preço de Cadastro** | `[PDC]` | Valor original |

#### Aba: Preço Ideal
| Card | Sigla | Descrição |
|------|-------|-----------|
| **Preço de Venda Ideal** | `[PDVI]` | Melhor preço identificado |
| **Preço Ideal Anunciado** | `[PIA]` | Valor exibido na vitrine |
| **Preço de Cadastro** | `[PDC]` | Valor original |

---

### Comparativo Clássico vs Premium (modo "Ambos")

Dois cards lado a lado:

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  🏷 CLÁSSICO          [✓]   │   │  👑 PREMIUM                 │
│  Preço Anunciado [PA]       │   │  Preço Anunciado [PA]       │
│  De: R$ 316,20 [PDC]        │   │  De: R$ 340,46 [PDC]        │
│  Por: R$ 284,58             │   │  Por: R$ 306,41             │
│  Lucro: R$ 6,43  Margem 2,4%│   │  Lucro: R$ 6,42  Margem 2,2%│
│  ▷ Clique para comparar     │   │  ▷ Clique para comparar     │
└─────────────────────────────┘   └─────────────────────────────┘
```

---

### DRE — Demonstração do Resultado do Exercício

#### Cabeçalho do DRE
```
Lucro líquido venda:  (XX,X%)
Lucro líquido custo:  (XX,X%)          LUCRO LÍQUIDO FINAL: R$ XX,XX
```

#### Tabela DRE — Política do Mercado Livre `[PDS]`

| Item | Sigla | % | Valor |
|------|-------|---|-------|
| Preço de cadastro | `[PC]` | — | R$ 441,69 |
| Desconto no Cadastro | `[DC]` | (10,0%) | − R$ 44,17 |
| Preço Anunciado | `[PA]` | — | R$ 397,52 |
| Desconto aplicado | `[CD]` | (5,0%) | − R$ 19,88 |
| **Preço de Venda** | `[PDV]` | — | **R$ 377,64** |

**Política do Mercado Livre `[PDS]`:**

| Item | Sigla | % | Valor |
|------|-------|---|-------|
| Comissão Mercado Livre | `[CML]` | 12% | − R$ 47,70 |
| Frete Grátis Mercado Livre | `[FG]` | (16,3%) | − R$ 64,90 |

**Política da LCG `[PDL]`:**

| Item | Sigla | % | Valor |
|------|-------|---|-------|
| Custo do Produto | `[CDP]` | (32,3%) | − R$ 128,38 |
| Imposto | `[IMP]` | (6,2%) | − R$ 24,55 |
| Ads Mercado Livre | `[ADS]` | (1,0%) | − R$ 3,78 |
| Despesa fixa | `[DF]` | (7,6%) | − R$ 30,21 |
| Outras Despesas | `[OD]` | (1,0%) | − R$ 3,78 |
| Crédito de Rebate | `[CR]` | (2,9%) | + R$ 11,33 |

---

## Fórmulas e Lógica de Cálculo

### Hierarquia de Preços

```
Preço de Cadastro [PC]
  → aplica Desconto no Cadastro [DC]
  = Preço Anunciado [PA]  (exibido na vitrine)
    → aplica Cupom de Desconto [CD]
    = Preço de Venda [PDV]  (valor que o comprador paga)
```

### Cálculo do Frete Grátis Obrigatório `[FG]`

O Mercado Livre obriga frete grátis a partir de determinado valor. O custo é descontado do vendedor.

**Faixas de frete por peso (referência):**

| Peso | Faixa | Custo Estimado |
|------|-------|----------------|
| Até 0,3 kg | Pequeno | R$ 12,00 – R$ 18,00 |
| Até 0,7 kg | Pequeno | R$ 14,00 – R$ 20,00 |
| Até 1 kg | Pequeno | R$ 16,00 – R$ 22,00 |
| Até 3 kg | Médio | R$ 20,00 – R$ 30,00 |
| Até 5 kg | Médio | R$ 25,00 – R$ 40,00 |
| Até 9 kg | Grande | R$ 40,00 – R$ 70,00 |
| Até 15 kg | Grande | R$ 60,00 – R$ 90,00 |
| Até 30 kg | Extra Grande | R$ 80,00 – R$ 130,00 |

> O app detecta automaticamente a faixa com base no peso informado em `[PES]`.

### Cálculo da Comissão `[CML]`

```
Comissão = PDV × (CML / 100)
```

- Clássico: 10% a 14% (padrão 12%)
- Premium: 15% a 19% (padrão 17%)
- Nota: abaixo de R$ 79 pode haver taxa fixa adicional

### Cálculo do Lucro Líquido

```
Lucro Líquido = PDV
  − Comissão [CML]
  − Frete Grátis [FG]
  − Custo do Produto [CDP]
  − Imposto [IMP]
  − Ads [ADS]
  − Despesa Fixa [DF]
  − Outras Despesas [OD]
  + Crédito de Rebate [CR]
```

### Margem sobre a Venda

```
Margem Venda (%) = (Lucro Líquido / PDV) × 100
```

### Margem sobre o Custo

```
Margem Custo (%) = (Lucro Líquido / CDP) × 100
```

### Cálculo do Preço Ideal (aba Preço Ideal)

Dado o lucro desejado `[MSCD]`, o app resolve a equação inversa:

**Se lucro desejado é sobre o custo:**
```
PDV = CDP / (1 − CML% − FG% − IMP% − ADS% − DF% − OD% − Margem%)
```

**Se lucro desejado é sobre a venda:**
```
PDV = (CDP + FG_fixo) / (1 − CML% − IMP% − ADS% − DF% − OD% − Margem%)
```

**Depois de calcular PDV:**
```
PA  = PDV / (1 − CD%)          → Preço Anunciado
PDC = PA  / (1 − DC%)          → Preço de Cadastro
```

### Crédito de Rebate `[CR]`

```
CR = PDV × (CR% / 100)
```
O rebate é um crédito que o vendedor recebe de volta, portanto **soma** no resultado.

---

## Regras de Negócio

1. **Frete Grátis obrigatório** quando `PDV ≥ R$ 79` (Clássico) ou `PDV ≥ R$ 79` (Premium). O custo é cobrado do vendedor.
2. **Taxa fixa** adicional na comissão para produtos abaixo de R$ 79.
3. **Reputação Verde** é necessária para manter o frete grátis ativo.
4. **Sensor de Otimização**: quando ativo, sugere ajustes de preço para melhorar giro sem comprometer margem mínima.
5. **Fator de Alavancagem (Giro)**: define a relação desconto/benefício para o comprador. Ex: fator 5 = para cada R$1 de desconto dado, o comprador percebe R$5 de valor.
6. **Modo "Ambos"**: calcula simultaneamente Clássico e Premium e exibe comparativo.
7. **Processar Lote**: permite calcular múltiplos produtos de uma vez (importação via planilha ou catálogo).

---

## Siglas de Referência Rápida

| Sigla | Nome Completo |
|-------|---------------|
| `[PDL]` | Parâmetros de Cálculo / Política da LCG |
| `[CDP]` | Custo do Produto |
| `[CML]` | Comissão Mercado Livre |
| `[PAC]` | Preço Anunciado (input) |
| `[PES]` | Peso do Produto |
| `[CR]` | Crédito de Rebate |
| `[CD]` | Cupom de Desconto |
| `[DC]` | Desconto no Cadastro |
| `[IMP]` | Imposto |
| `[DF]` | Despesa Fixa |
| `[OD]` | Outras Despesas |
| `[ADS]` | Ads / Marketing |
| `[MSCD]` | Margem / Lucro Desejado |
| `[PDV]` | Preço de Venda (sem cupom) |
| `[PA]` | Preço Anunciado (vitrine) |
| `[PDC]` | Preço de Cadastro (original) |
| `[PDVI]` | Preço de Venda Ideal |
| `[PIA]` | Preço Ideal Anunciado |
| `[PC]` | Preço de Cadastro (DRE) |
| `[FG]` | Frete Grátis Mercado Livre |
| `[PDS]` | Política do Mercado Livre |

---

---

## TABELAS DE REFERÊNCIA OFICIAIS (Fonte: Mercado Livre Brasil)

> Estas tabelas devem ser usadas como fonte de verdade para todos os cálculos da calculadora.

---

### TABELA 1 — Tipos de Anúncio: Comparativo Geral

| Característica | Grátis | Clássico | Premium |
|----------------|--------|----------|---------|
| Tarifa de venda | 0% | 10% a 14% (por categoria) | 15% a 19% (por categoria) |
| Exposição nos resultados de busca | Baixa | Alta | Máxima |
| Duração do anúncio | 60 dias | Ilimitada | Ilimitada |
| Parcelamento sem juros | ✗ | ✗ | ✅ Sim (até 10x+) |
| Custo para anunciar | Grátis | Grátis | Grátis |

**Regras do anúncio Grátis:**
- Produtos usados: até 20 vendas no último ano
- Produtos novos: até 5 vendas no último ano
- Máximo de 10 anúncios simultâneos com estoque de 1 unidade
- MercadoLíder e usuário Profissional do Mercado Pago só podem usar Clássico ou Premium

---

### TABELA 2 — Tarifas de Venda por Tipo de Anúncio

| Tipo de Anúncio | Tarifa Mínima | Tarifa Máxima | Observação |
|-----------------|---------------|---------------|------------|
| Grátis | 0% | 0% | Baixa exposição, 60 dias |
| Clássico | 10% | 14% | Varia por categoria |
| Premium | 15% | 19% | Varia por categoria + parcelamento sem juros |

**Composição da tarifa:**
- **Clássico** = tarifa de intermediação ML + custo de cobrança Mercado Pago
- **Premium** = tarifa de intermediação ML + custo de cobrança Mercado Pago + taxa por oferecer parcelamento sem juros

**Regras especiais de tarifa:**
- Produtos de categorias selecionadas com preço entre **R$ 150 e R$ 700** pagam tarifa reduzida
- Produtos da seção **Supermercado** têm tarifas específicas (preço mínimo R$ 8)
- Kits virtuais pagam a mesma tarifa que produtos separados
- Abaixo de R$ 79: pode haver **taxa fixa adicional** além da comissão percentual

---

### TABELA 3 — Parcelamento Sem Juros (Anúncios Premium)

> Fonte direta do Mercado Livre. Usar esta tabela para determinar o número máximo de parcelas sem juros oferecidas ao comprador.

| Preço do produto ou valor da venda | Máx. parcelas s/ juros — Cartão Mercado Pago | Máx. parcelas s/ juros — Outros meios |
|------------------------------------|----------------------------------------------|----------------------------------------|
| R$ 0 a R$ 29,99 | 1x | 1x |
| R$ 30 a R$ 59,99 | 4x | 2x |
| R$ 60 a R$ 99,99 | 5x | 3x |
| R$ 100 a R$ 149,99 | 6x | 4x |
| R$ 150 a R$ 179,99 | 7x | 5x |
| R$ 180 a R$ 299,99 | 8x | 6x |
| R$ 300 a R$ 349,99 | 8x | 6x |
| R$ 350 a R$ 399,99 | 9x | 7x |
| R$ 400 a R$ 449,99 | 10x | 8x |
| R$ 450 a R$ 499,99 | 11x | 9x |
| R$ 500 a R$ 549,99 | 12x | 10x |
| R$ 550 a R$ 599,99 | 12x | 10x |
| R$ 600 a R$ 899,99 | 12x | 10x |
| Acima de R$ 900 | 12x | 10x |

**Observações importantes:**
- Assinantes **Meli+**: até **3 parcelas extras sem juros** em produtos abaixo de R$ 900 e compras até R$ 1.300
- Produtos acima de R$ 600 em **Tecnologia e Eletrodomésticos**: até **18x sem juros** com Cartão Mercado Pago
- Para vendas com parcelamento inferior a 12x: o ML oferece ao comprador a opção de parcelar em até 12x com acréscimo (parcela mínima de R$ 5,00)
- A oferta de parcelas sem juros pode variar para itens vendidos diretamente pelo Mercado Livre

---

### TABELA 4 — Frete Grátis: Regras de Ativação

| Tipo de Loja | Frete grátis obrigatório a partir de |
|--------------|--------------------------------------|
| Loja normal (Clássico/Premium) | R$ 79,00 |
| Full Super (Supermercado) | R$ 199,00 |

**Quem paga o frete grátis:** O custo é descontado do vendedor, não do comprador.

**Condição:** Reputação do vendedor deve ser **Verde** para manter o benefício ativo.

---

### TABELA 5 — Faixas de Peso e Custo de Frete (Mercado Envios)

> Usar para estimar o custo de frete `[FG]` com base no peso do produto `[PES]`.

| Faixa de Peso | Classificação | Custo estimado (referência) |
|---------------|---------------|-----------------------------|
| Até 0,3 kg | Pequeno | R$ 12,00 – R$ 18,00 |
| Até 0,7 kg | Pequeno | R$ 14,00 – R$ 20,00 |
| Até 1 kg | Pequeno | R$ 16,00 – R$ 22,00 |
| Até 3 kg | Médio | R$ 20,00 – R$ 30,00 |
| Até 5 kg | Médio | R$ 25,00 – R$ 40,00 |
| Até 9 kg | Grande | R$ 40,00 – R$ 70,00 |
| Até 15 kg | Grande | R$ 60,00 – R$ 90,00 |
| Até 30 kg | Extra Grande | R$ 80,00 – R$ 130,00 |

**Regras de cálculo do frete:**
- O custo é calculado com base no **peso, dimensões e preço do produto**
- Vendas por quantidade/atacado: custo baseado no **espaço total ocupado** (não por item individual)
- Atacado com 15+ unidades: economia de até **80% no frete**
- Kits virtuais: frete calculado pelo espaço total do pacote
- Economia no frete só se aplica quando todos os produtos saem do **mesmo centro de distribuição**
- Produtos da seção Supermercado: **não têm economia** por quantidade

---

### TABELA 6 — Full Super (Supermercado): Regras Específicas

| Requisito | Valor |
|-----------|-------|
| Preço mínimo do produto | R$ 8,00 |
| Reputação exigida | Verde |
| Frete grátis a partir de | R$ 199,00 |
| Armazenamento diário | Itens Grandes e Extragrandes pagam; Pequenos e Médios não pagam |

**Custos por venda no Full Super:**
- Tarifa de venda (varia por categoria)
- Custo de envio (calculado por peso, medidas e preço — tanto abaixo quanto acima de R$ 199)

---

### TABELA 7 — Venda por Quantidade: Economia no Frete

| Modalidade | Economia no Frete | Condição |
|------------|-------------------|----------|
| Descontos por quantidade (2+ unidades) | Proporcional ao volume | Mesmo CD |
| Preços de atacado (15+ unidades) | Até 80% | Mesmo CD |
| Kits virtuais (2+ produtos diferentes) | Proporcional ao espaço total | Mesmo CD |
| Produtos Supermercado | Sem economia | — |

**Preços de atacado:**
- Disponível apenas para compradores com **CNPJ** (Empresas validadas pelo ML)
- Preço de atacado deve ser **inferior** ao preço normal
- Quanto maior a quantidade, menor o preço por unidade
- Opção de adicionar preços sem impostos (ML calcula os impostos por estado/regime tributário do comprador)

---

### TABELA 8 — Custos NÃO incluídos no cálculo por venda

> O Mercado Livre não considera estes custos no cálculo do valor recebido por venda individual. Devem ser tratados como custos fixos separados.

| Custo | Onde consultar |
|-------|----------------|
| Custos com publicidade (Mercado Ads) | Faturamento mensal |
| Custos por operar com o Full | Faturamento mensal |
| Tarifa de manutenção de "Minha página" | Faturamento mensal |

**Importante:** O Mercado Livre **não retém impostos** sobre as vendas. O vendedor é responsável pelo pagamento conforme sua situação fiscal (Simples Nacional, DAS, etc.).

---

## Stack Sugerida

- **Frontend:** React + TypeScript + Tailwind CSS
- **Estado:** useState / useReducer (sem backend necessário)
- **Cálculos:** funções puras em TypeScript
- **Formatação:** Intl.NumberFormat para moeda BRL
- **Ícones:** Lucide React ou Heroicons

---

## Exemplo de Dados para Teste

```json
{
  "CDP": 128.38,
  "quantidade": 1,
  "tipoAnuncio": "Classico",
  "CML": 12.0,
  "PAC": 397.52,
  "PES": 7.0,
  "CR": 3.0,
  "CD": 5.0,
  "DC": 10.0,
  "IMP": 6.5,
  "DF": 8.0,
  "OD": 1.0,
  "ADS": 1.0,
  "reputacao": "verde",
  "sensorOtimizacao": true,
  "fatorAlavancagem": 5.0
}
```

**Resultado esperado:**
- PDC: R$ 441,69
- PA: R$ 397,52
- PDV: R$ 377,64
- Comissão: − R$ 47,70
- Frete Grátis: − R$ 64,90
- Lucro Líquido Final: R$ 85,67
- Margem sobre venda: 22,7%
- Margem sobre custo: 66,7%
