# 📊 Calculadora Shopee 2026 | LCG Eletro

Uma ferramenta avançada de cálculo de margem de contribuição, lucro líquido e otimização de preços para vendedores da Shopee Brasil, atualizada com as novas regras de comissão vigentes a partir de **Março de 2026**.

---

## 🚀 Funcionalidades Principais

- **Cálculo de Margem Real:** Considera comissão variável (14% a 20%), tarifas fixas por faixa de preço, impostos, custos extras, crédito de rebate e cupons.
- **Sensor de Otimização Automática:** Identifica centavo por centavo o ponto de preço que maximiza o lucro, aproveitando os "degraus" de taxa da Shopee.
- **Estratégia de Giro (Leverage):** Sugere reduções de preço estratégicas para aumentar volume de vendas com o menor impacto possível no lucro.
- **Processamento em Lote (CSV):** Calcule centenas de SKUs de uma só vez via upload de planilha, utilizando suas configurações globais de impostos e ads.
- **Visualização Analítica:** Gráficos interativos de composição de preço, curva de otimização e tabelas de taxas.
- **Multiplataforma:** Suporte nativo para Web (Firebase), Mobile (APK), Desktop (EXE) e PWA.

---

## 🛠️ Tecnologias Utilizadas

- **Core:** React 19 + TypeScript + Vite 7
- **Gráficos:** Recharts
- **Iconografia:** Lucide-React
- **Database/Auth:** Firebase (Firestore & Auth)
- **Multiplataforma:** Capacitor (Android) & Electron (Desktop)
- **Parsing:** PapaParse (CSV)

---

## 💻 Comandos e Desenvolvimento

### Ambiente de Desenvolvimento
```bash
npm install
npm run dev
```

### Processamento via Desktop (EXE)
Este projeto utiliza **Electron** para gerar executáveis Windows.
```bash
# Rodar em modo janela de desenvolvimento
npm run electron:dev

# Gerar instalador .EXE (na pasta /release)
npm run build:exe
```

### Versão Mobile (APK)
Utilizamos **Capacitor** para converter a aplicação web em Android Nativo.
```bash
# Gerar build e sincronizar com projeto Android
npm run build:apk
```
*Após rodar o comando, abra a pasta `/android` no **Android Studio** para gerar o APK assinado.*

### Deploy Web (Firebase)
```bash
npm run build
firebase deploy --only hosting
```

---

## 📁 Estrutura do CSV para Lote

Para usar o processamento em lote, envie um arquivo `.csv` com os seguintes cabeçalhos (exemplos):

| id | custo_produto | preco_venda | margem_desejada |
| --- | --- | --- | --- |
| SKU-001 | 50.00 | 84.20 | 15 |

- **Cálculo de Margem:** Exige `custo` e `preco`.
- **Preço Ideal:** Exige `custo` e `margem`.

---

## 📝 Versão e Manutenção
- **Versão Atual:** 1.1.198-beta
- **Desenvolvido por:** Antigravity (LCG Eletro Collaboration)
- **Licença:** Privada / LCG Eletro

---
*Nota: Todos os cálculos são baseados nas políticas oficiais da Shopee de 2026. Recomenda-se sempre conferir os valores finais no painel do vendedor.*
