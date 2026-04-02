// =============================================================================
//  config.js — SISTEMA DE INVENTÁRIO PATRIMONIAL
//  GitHub Pages — 9º BPM P4
//
//  ⚠️  Após reimplantar o Apps Script, atualize apenas o API_URL abaixo.
//  ⚠️  Nunca commite tokens, senhas ou credenciais neste arquivo.
// =============================================================================

const INV_CONFIG = {
  API_URL:          'https://script.google.com/macros/s/AKfycbxjKdfvm756QEQBb9k1FHAbbQt5dlD7dOzueoRoKOpF2cKU-75jn-AVA3--EoHjrhLj/exec',
  SESSION_DURATION: 8 * 60 * 60 * 1000,  // 8 horas em ms
  TIMEOUT_MS:       20000,                // 20 s — GAS pode ser lento
  VERSION:          '1.0.0'
};

// =============================================================================
//  CAMADA DE API
//  Envia { acao, ...args } via POST com Content-Type: text/plain
//  (evita preflight CORS — requisito obrigatório para o Apps Script)
// =============================================================================
const invApi = {

  async _call(acao, payload) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), INV_CONFIG.TIMEOUT_MS);

    try {
      const resp = await fetch(INV_CONFIG.API_URL, {
        method:  'POST',
        body:    JSON.stringify({ acao, ...payload }),
        headers: { 'Content-Type': 'text/plain' },
        signal:  ctrl.signal
      });

      if (!resp.ok) throw new Error(`Servidor retornou HTTP ${resp.status}`);
      return await resp.json();

    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Tempo limite esgotado. Tente novamente.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  // ── AUTH ─────────────────────────────────────────────────────────────────
  login:          (matricula, senha)              => invApi._call('login',          { matricula, senha }),
  logout:         (token)                         => invApi._call('logout',         { token }),
  renovarSessao:  (token, matricula, nomeGuerra, perfil) => invApi._call('renovarSessao', { token, matricula, nomeGuerra, perfil }),

  // ── SEÇÕES / DADOS ────────────────────────────────────────────────────────
  carregarSecoes:     ()            => invApi._call('carregarSecoes',     {}),
  carregarTodosDados: ()            => invApi._call('carregarTodosDados', {}),
  gerarId:            (secaoId)     => invApi._call('gerarId',            { secaoId }),
  criarSecao:         (nome)        => invApi._call('criarSecao',         { nome }),

  // ── CRUD ITENS ────────────────────────────────────────────────────────────
  salvarItem:     (token, item)              => invApi._call('salvarNovoItem',      { token, item }),
  buscarItem:     (secaoId, id)              => invApi._call('buscarItem',          { secaoId, id }),
  atualizarItem:  (token, dados)             => invApi._call('atualizarItem',       { token, ...dados }),
  excluirItem:    (secaoId, id)              => invApi._call('excluirItem',         { secaoId, id }),

  // ── FOTOS ────────────────────────────────────────────────────────────────
  carregarFotos:  (fotosId)                  => invApi._call('carregarFotos',       { fotosId }),
  adicionarFotos: (token, secaoId, id, fotos)=> invApi._call('adicionarFotos',      { token, secaoId, itemId: id, fotos }),

  // ── TRANSFERÊNCIA ─────────────────────────────────────────────────────────
  buscarPorTombamento: (tombamento)          => invApi._call('buscarPorTombamento', { tombamento }),
  transferirItem:      (tombamento, destSecaoId) => invApi._call('transferirItem',  { tombamento, destSecaoId }),

  // ── RELATÓRIOS ────────────────────────────────────────────────────────────
  relatorioGeral:        ()         => invApi._call('gerarPDFGeral',       {}),
  relatorioConservacao:  ()         => invApi._call('gerarPDFConservacao', {}),
  relatorioCondicao:     ()         => invApi._call('gerarPDFCondicao',    {}),
  relatorioSecao:        (secaoId)  => invApi._call('gerarPDFSecao',       { secaoId }),

  // ── USUÁRIOS ─────────────────────────────────────────────────────────────
  listarUsuarios:     (token)                   => invApi._call('listarUsuarios',      { token }),
  cadastrarUsuario:   (token, dados)            => invApi._call('cadastrarUsuario',    { token, ...dados }),
  alterarStatusUsuario:(token, matricula, status)=> invApi._call('alterarStatusUsuario',{ token, matricula, status }),
  redefinirSenha:     (token, matricula, novaSenha) => invApi._call('redefinirSenha',  { token, matricula, novaSenha }),
  alterarSenha:       (token, senhaAtual, novaSenha)=> invApi._call('alterarSenha',    { token, senhaAtual, novaSenha }),
};

// =============================================================================
//  GERENCIADOR DE SESSÃO
//  sessionStorage → destruído ao fechar a aba (mais seguro em computador
//  compartilhado — padrão das viaturas e seções do batalhão)
// =============================================================================
const invSessao = {

  _KEY:   'inv_sessao',
  _store: sessionStorage,

  salvar(token, usuario) {
    const dados = {
      token,
      usuario,
      expira: Date.now() + INV_CONFIG.SESSION_DURATION
    };
    try { this._store.setItem(this._KEY, JSON.stringify(dados)); }
    catch (e) { console.warn('[invSessao] Não foi possível salvar sessão:', e); }
  },

  carregar() {
    try {
      const raw = this._store.getItem(this._KEY);
      if (!raw) return null;
      const dados = JSON.parse(raw);
      if (Date.now() > dados.expira) { this.limpar(); return null; }
      return dados;
    } catch { return null; }
  },

  limpar() {
    try { this._store.removeItem(this._KEY); } catch (e) {}
  },

  renovarExpiracao() {
    const sess = this.carregar();
    if (!sess) return;
    sess.expira = Date.now() + INV_CONFIG.SESSION_DURATION;
    try { this._store.setItem(this._KEY, JSON.stringify(sess)); } catch (e) {}
  },

  get token()   { return this.carregar()?.token           || null; },
  get usuario() { return this.carregar()?.usuario         || null; },
  get perfil()  { return this.carregar()?.usuario?.perfil || null; }
};

// =============================================================================
//  RENOVAÇÃO AUTOMÁTICA (a cada 10 min enquanto a página estiver aberta)
// =============================================================================
(function _autoRenovar() {
  setInterval(() => {
    if (invSessao.carregar()) invSessao.renovarExpiracao();
  }, 10 * 60 * 1000);
})();
