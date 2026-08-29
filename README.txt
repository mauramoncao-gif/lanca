LANÇA — PWA V6.1 SEGURA

PACOTE PRONTO PARA GITHUB PAGES
Arquivos da raiz:
- index.html
- app.js
- manifest.webmanifest
- service-worker.js
- AUDITORIA_SEGURANCA.txt
- README.txt
- icons/

IDENTIDADE
Nome: LANÇA
Assinatura: LANÇA — preparação para novembro
Nome curto de instalação: Lança
Tema: #0B0D0F
Ação principal: #E8402A → #FF7A1A
Recuperação/estado ativo: #4FA8D9

SEGURANÇA
- Sem câmera, microfone, GPS, contatos ou arquivos.
- Sem analytics, anúncios, SDKs ou bibliotecas externas.
- Sem requisições a Google Fonts ou outros serviços.
- Dados de treino ficam no localStorage do dispositivo.
- CSP e Service Worker mantêm conexões restritas à mesma origem.

TIPOGRAFIA
O guia cita Saira Condensed / IBM Plex Sans / IBM Plex Mono.
Para preservar a regra de segurança sem dependência externa, esta versão utiliza
stacks de fontes locais do sistema com equivalentes condensado, sans e mono.
Nenhum arquivo de fonte externo é solicitado.

PUBLICAÇÃO
Suba todo o conteúdo desta pasta para a raiz do repositório GitHub Pages.


CORREÇÃO V6.1
- Restaurada phaseForWeek(), responsável por mapear semana -> fase planejada.
- Adicionado parsing defensivo do armazenamento local.
- Cache do Service Worker atualizado para lanca-pwa-v6-1-secure.
- Preservadas identidade, segurança, histórico, progressão, Esteira/Society e limite de duração.


ATUALIZAÇÃO V6.2 — ESTEIRA POR VELOCIDADE
- Tiros na esteira prescritos por faixa mínima–máxima em km/h.
- Faixa individualizada pela Velocidade Máxima Controlada (VMC).
- RPE mantido apenas como controle secundário.
- F1: 70–80% da VMC
- F2: 80–88% da VMC
- F3: 85–92% da VMC
- F4: 90–95% da VMC
- F5: 85–95% da VMC
- Cronômetro mostra a faixa-alvo durante cada tiro.
- Sem VMC configurada, o app direciona para Ajustes antes de iniciar.


ATUALIZAÇÃO V6.3 — SEM RPE
- RPE removido da prescrição, histórico e critérios de progressão.
- Esteira: faixa objetiva em km/h calculada pela VMC.
- Society: metros + repetições + recuperação + zona de desaceleração.
- Progressão considera sessões concluídas e resposta de joelho/lombar.
