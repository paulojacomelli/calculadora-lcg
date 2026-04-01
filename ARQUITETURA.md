# Arquitetura do Projeto - Calculadora LCG

Este documento descreve a estrutura técnica, decisões de design e fluxos da Calculadora LCG.

## 1. Visão Geral
A Calculadora LCG é uma Progressive Web App (PWA) desenvolvida com **React**, **Vite** e **Firebase**, focada em fornecer cálculos precisos de margem e preço ideal para vendedores do Mercado Livre e Shopee.

## 2. Stack Tecnológica
- **Framework:** React 18+ (TypeScript)
- **Estilização:** Vanilla CSS (Moderno, com variáveis e Grid/Flexbox)
- **Ícones:** Lucide React
- **Gráficos:** Recharts
- **Backend:** Firebase (Firestore, Auth, Hosting)
- **Cálculos:** Decimal.js (para precisão aritmética)

## 3. Estrutura de Pastas
- `src/pages/`: Componentes de página principais (ShopeePage, MeliPage, etc.)
- `src/utils/`: Lógica de negócio pura (shopeeLogic, meliLogic)
- `src/services/`: Integrações com APIs externas e Firebase
- `src/components/`: Componentes de interface reutilizáveis
- `src/assets/`: Arquivos estáticos e globais de CSS

## 4. Decisões Técnicas Principais

### Separação de Lógica e UI
Toda a lógica de cálculo é mantida em arquivos `utils` separados, permitindo testes unitários e garantindo que a UI apenas reflita o estado dos dados.

### Sistema de Segurança (Menu Avançado)
Implementamos uma camada de proteção por senha para configurações críticas (taxas fixas, IR, ICMS) via Firestore:
- **Coleção:** `config`
- **Documento:** `access`
- **Fluxo:** Validação assíncrona contra o banco de dados antes de desbloquear a seção.

### Persistência de Dados
Utilizamos o `localStorage` para manter os inputs do usuário entre sessões, garantindo que o progresso não seja perdido ao recarregar a página.

### Design Premium
- **Fichas de Resultados:** Exibição em 3 colunas para paridade visual entre plataformas.
- **Micro-animações:** Uso de transições suaves e estados de carregamento para melhor UX.
- **Inputs Compostos:** Sistema padronizado de seleção R$ / % para despesas fixas e variáveis.

## 5. Versionamento e Deploy
O versionamento segue o padrão Semantic Versioning com sufixo `-beta` para ambiente de desenvolvimento. O deploy é automatizado via Firebase Hosting.

## 6. Registro de Correções
- 31/03/2026: Normalizamos o tipo de Ads no Mercado Livre para evitar ROAS oculto no carregamento do localStorage e protegemos a busca de preço ideal contra margem inválida (NaN/infinito).
