# Arquitetura do Projeto - Calculadora LCG

Este documento descreve a estrutura e os padrões técnicos utilizados no desenvolvimento da Calculadora LCG.

## Tecnologias
- **Frontend**: React 19 + Vite
- **Estilização**: Vanilla CSS (CSS Modules/Global)
- **Banco de Dados**: Firebase Firestore (banco `default`)
- **Autenticação**: Firebase Auth
- **Icons**: Lucide React
- **Gráficos**: Recharts

## Estrutura de Pastas
- `src/pages/`: Contém as páginas principais (`ShopeePage.tsx`, `MeliPage.tsx`).
- `src/services/`: Serviços de integração (Ex: `catalogService.ts`).
- `src/firebase.ts`: Configuração e instâncias do Firebase.

## Padronização de Componentes (Shopee vs Mercado Livre)
Para garantir paridade entre os marketplaces, seguimos estes padrões:

### 1. Máscara Financeira (Inputs)
Todos os campos monetários utilizam uma máscara que formata o valor em tempo real para o padrão brasileiro (`0,00`).
- A lógica de processamento converte a string formatada para um número `float` apenas no momento do cálculo, preservando a experiência de digitação do usuário.

### 2. Algoritmo de Busca no Catálogo
A busca por produtos no catálogo utiliza um sistema de pesos (scoring):
- **SKU Exato**: +200 pontos
- **SKU Começa com**: +150 pontos
- **SKU Contém**: +100 pontos
- **Descrição Exata**: +80 pontos
- **Termo Inteiro na Descrição**: +30 pontos
- **Penalidade por Tamanho**: Matches mais curtos (mais precisos) ganham prioridade.

## Fluxo de Dados
1. O usuário digita os dados ou seleciona um produto do catálogo.
2. Os dados são salvos no Firestore de forma assíncrona (debounce de 5s) para persistência.
3. Os cálculos são realizados localmente e os resultados exibidos em tempo real via `Recharts`.
4. Logs de cálculo são enviados para o Firestore para fins de analytics básico.

---
*Versão Atual: 1.6.0-beta*
