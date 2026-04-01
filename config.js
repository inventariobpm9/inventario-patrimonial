// ============================================================
// config.js — Sistema de Inventário · 9º BPM
// Substitua GAS_URL pela URL do seu Web App publicado.
// ============================================================

const CONFIG_INV = {
  // URL do Google Apps Script Web App (doGet)
  // Publique em: Implantar > Novo Implantação > Web App
  //   - Executar como: Eu (sua conta Google)
  //   - Quem tem acesso: Qualquer pessoa
  GAS_URL: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID_AQUI/exec',

  // Chaves usadas em sessionStorage
  STORAGE: {
    TOKEN:       'inv_token',
    MATRICULA:   'inv_matricula',
    NOME:        'inv_nomeGuerra',
    PERFIL:      'inv_perfil',
  },

  // Versão do frontend
  VERSAO: '2.1.0',
};
