/* ===================== Configuração do Painel Zootécnico =====================
   Altere apenas este arquivo para apontar para outra planilha do Google Sheets.
   A planilha precisa estar compartilhada como "Qualquer pessoa com o link – Leitor".
   Não é necessário Google Apps Script: o painel lê a planilha diretamente.
   ============================================================================= */
window.PAINEL_CONFIG = {
  // ID da planilha (parte entre /d/ e /edit no link do Google Sheets)
  SHEET_ID: "1GN9umxFxZHJkReOvDzSZPTop4ef7fJl3BACn_P8e1cA",

  // Nome da aba com os lotes (Agrosys)
  SHEET_NAME: "Dados",

  // Colunas buscadas na planilha (letras). Buscar só o necessário deixa o painel leve.
  // C=Granja D=Proprietário F=Tipo Galpão G=Tecnico H=Região J=Data Abate K=Galpão
  // M=Situação O=Aves Alojadas P=Aves Recebidas Q=Idade C R=Idade S=Mort T=Viab. Real
  // U=Peso Total V=GMD. W=Peso Médio X=CA. Y=CAC. Z=IEP AA=Ração entregue
  // AB=Preço Frango AC=Dens. KG AE=Desc. C.A AF=Desc. Apanha AG=Cond. SIF
  // AK=Resultado Liquido Lote AO=Linhagem AR=Dens. Aloj. AX=Pagamento Transporte
  // BA=Resultado Bruto
  SELECT: "C,D,F,G,H,J,K,M,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC,AE,AF,AG,AK,AO,AR,AX,BA",

  // Intervalo (em minutos) para checar automaticamente se a planilha mudou
  AUTO_SYNC_MINUTOS: 10,

  // Caminho do painel de incubatório (aba "Incubatório")
};
