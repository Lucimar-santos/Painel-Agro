/* ===================== Configuração do Painel Incubatório =====================
   Altere apenas este arquivo para apontar para outra planilha do Google Sheets.
   A planilha precisa estar compartilhada como "Qualquer pessoa com o link – Leitor".
   ============================================================================= */
window.PAINEL_CONFIG = {
  // ID da planilha (parte entre /d/ e /edit no link do Google Sheets)
  SHEET_ID: '1W_CrxB1WewqTSJEflF-FTCYyM3A_O0vEkU4OxkgYJ0o',

  // Nome da aba (deixe vazio para usar a primeira aba da planilha)
  SHEET_NAME: '',

  // Colunas buscadas na planilha (letras). Buscar só o necessário deixa o painel leve.
  // E=Data Nascimento, F=Fazenda, G=Lote, H=Tipo Ovo, I=Idade Matriz, J=Linhg,
  // K=Dias Estoq., L=Total Incubados, M=Cont., N=Total Nascidos, O=Elim.,
  // P=Nasc. Mortos, Q=Total Vendáveis, W=% Std Eclosão, X=% Dif Eclosão, Y=IEV, Z=IEE
  SELECT: 'E,F,G,H,I,J,K,L,M,N,O,P,Q,W,X,Y,Z',

  // Intervalo (em minutos) para checar automaticamente se a planilha mudou
  AUTO_SYNC_MINUTOS: 10
};
