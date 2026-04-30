import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CONFIG_PATH = "C:/Users/design/.gemini/antigravity/mcp_config.json";
const SUPABASE_PROJECT_REF = "gwuivromnlvozonihgmm";
const FUNCTION_URL = `https://${SUPABASE_PROJECT_REF}.functions.supabase.co/meli-auth/token`;

async function syncMcp() {
  console.log("[\u23f3] Iniciando sincronização do Mercado Livre MCP...");

  try {
    // 1. Busca o token no Supabase
    // Nota: Em produção, você usaria o SUPABASE_ANON_KEY no header apikey
    const response = await fetch(FUNCTION_URL, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar token: ${response.statusText}`);
    }

    const { access_token } = await response.json();
    if (!access_token || access_token === 'pending_bootstrap') {
      console.error("[\u274c] Token ainda não inicializado no Supabase. Execute o bootstrap/exchange primeiro.");
      return;
    }

    // 2. Lê a configuração atual
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    // 3. Atualiza o token no objeto
    if (config.mcpServers && config.mcpServers["mercadolibre-mcp-server"]) {
      const args = config.mcpServers["mercadolibre-mcp-server"].args;
      const headerIndex = args.indexOf("--header");
      if (headerIndex !== -1 && args[headerIndex + 1]) {
        args[headerIndex + 1] = `Authorization: Bearer ${access_token}`;
      }
    }

    // 4. Escrita Atômica (Windows Friendly)
    const tempPath = `${CONFIG_PATH}.tmp`;
    const newContent = JSON.stringify(config, null, 2);

    let retries = 5;
    while (retries > 0) {
      try {
        fs.writeFileSync(tempPath, newContent, 'utf-8');
        fs.renameSync(tempPath, CONFIG_PATH);
        console.log("[\u2705] Configuração mcp_config.json atualizada com sucesso!");
        break;
      } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          console.warn(`[\u26a0\ufe0f] Arquivo bloqueado. Tentativas restantes: ${retries - 1}...`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }
    }

    if (retries === 0) {
      console.error("[\u274c] Erro fatal: Não foi possível escrever no arquivo mcp_config.json após várias tentativas.");
    }

    console.log("\n[\ud83d\udd04] IMPORTANTE: Reinicie o servidor MCP no Antigravity para aplicar as mudanças.");

  } catch (err) {
    console.error("[\u274c] Erro na sincronização:", err.message);
  }
}

// Executa
syncMcp();
