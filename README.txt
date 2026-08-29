LANÇA — PWA V6.4.3 SEGURA

PACOTE PRONTO PARA GITHUB PAGES

IDENTIDADE
Nome: LANÇA
Assinatura: LANÇA — preparação para novembro
Nome curto de instalação: Lança

FUNCIONALIDADES PRINCIPAIS
- Treinos para esteira e Society
- Sessões de 20–25 min, com teto de 30 min
- Progressão por fases
- Check-in de joelho, lombar, fadiga e recuperação/sono
- Esteira com prescrição por faixa de velocidade em km/h
- Society com distância, repetições, recuperação e zona de desaceleração
- Sem uso de RPE
- Histórico local
- Cronômetro com som e vibração
- Uso offline após primeiro carregamento

SEGURANÇA
- Sem câmera, microfone, GPS, contatos ou arquivos
- Sem analytics, anúncios, SDKs ou bibliotecas externas
- Sem Google Fonts, CDN ou chamadas externas desnecessárias
- Dados de treino armazenados no localStorage do dispositivo
- CSP e Service Worker restritos à mesma origem

ARQUIVOS ESSENCIAIS
- index.html
- app.js
- manifest.webmanifest
- service-worker.js
- icons/

DOCUMENTAÇÃO
- AUDITORIA_SEGURANCA.txt
- QA_V6_3.txt
- README.txt

PUBLICAÇÃO
Suba os arquivos para a raiz do repositório GitHub Pages.


ATUALIZAÇÃO V6.4 — CALIBRAÇÃO AUTOMÁTICA DA ESTEIRA
- Campo manual de VMC removido.
- LANÇA conduz uma calibração guiada e define a referência de velocidade.
- Calibração: 4 min de aquecimento a 4,5 km/h; estágios de 15 s iniciando em 7,0 km/h e aumentando 1,0 km/h; 45 s de recuperação a 4,5 km/h.
- A maior velocidade concluída integralmente vira a referência.
- Calibração bloqueada após musculação ou com check-in fora do verde.
- O usuário não escolhe a intensidade do treino; o LANÇA calcula os km/h automaticamente.
- Society continua objetivo por metros, repetições, recuperação e desaceleração.


ATUALIZAÇÃO V6.4.1 — CORREÇÃO DE IDENTIFICAÇÃO
- Mantém a lógica funcional da V6.4 sem alterações de treino.


ATUALIZAÇÃO V6.4.2 — CORREÇÃO DE CACHE/ATUALIZAÇÃO
- Corrige retenção de index.html antigo pelo Service Worker.
- Navegação passa a usar network-first quando houver internet.
- Nova versão assume controle imediatamente com skipWaiting + clients.claim.
- Botão Verificar atualização força ativação e recarrega o LANÇA.
- Uso offline continua preservado.


ATUALIZAÇÃO V6.4.3 — QA DE ATUALIZAÇÃO
- app.js recebe versionamento explícito na URL.
- registro do Service Worker usa updateViaCache: none.
- navegação, app.js e manifest usam network-first com cache no-store quando online.
- cache permanece como fallback quando offline.
- skipWaiting + clients.claim mantidos para assumir a nova versão imediatamente.
