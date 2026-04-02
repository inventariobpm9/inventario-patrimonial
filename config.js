// =============================================================================
//  config.js — SISTEMA DE BENS DE CONSUMO
//  GitHub Pages — 9º BPM P4
//
//  ⚠️  Após reimplantar o Apps Script, atualize apenas o API_URL abaixo.
//  ⚠️  Nunca commite tokens, senhas ou credenciais neste arquivo.
// =============================================================================

const BC_CONFIG = {
  API_URL:          'https://script.google.com/macros/s/AKfycbxEHJkw6XHiwaUsE2DjHzRG1gwHMIKQwraCdFr1j7eN2SSFkE9EWiXC1KBJVfsddvicVg/exec',
  SESSION_DURATION: 8 * 60 * 60 * 1000,  // 8 horas em ms
  TIMEOUT_MS:       15000,                // 15 s — aborta fetch travado
  VERSION:          '3.2'
};

// =============================================================================
//  CAMADA DE API
//  Todas as chamadas passam por _call(), que:
//    • usa fetch() POST com Content-Type: text/plain (evita preflight CORS)
//    • envia { fn, args } para o Apps Script rotear
//    • aplica timeout via AbortController
//    • lança erro com mensagem legível em caso de falha
// =============================================================================
const bcApi = {

  async _call(fn, ...args) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BC_CONFIG.TIMEOUT_MS);

    try {
      const resp = await fetch(BC_CONFIG.API_URL, {
        method:  'POST',
        body:    JSON.stringify({ fn, args }),
        headers: { 'Content-Type': 'text/plain' },
        signal:  ctrl.signal
      });

      if (!resp.ok) throw new Error(`Servidor retornou HTTP ${resp.status}`);

      const data = await resp.json();
      return data;

    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Tempo limite de conexão esgotado. Tente novamente.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  // ── AUTH ──────────────────────────────────────────────────────────────────
  login:           (mat, senha)         => bcApi._call('login',           mat, senha),
  logout:          (token)              => bcApi._call('logout',          token),
  verificarSessao: (token)              => bcApi._call('verificarSessao', token),
  renovarSessao:   (tk, mat, ng, pf)   => bcApi._call('renovarSessao',   tk, mat, ng, pf),

  // ── PRODUTOS ──────────────────────────────────────────────────────────────
  listarProdutos:   ()                  => bcApi._call('listarProdutos'),
  carregarDashboard:()                  => bcApi._call('carregarDashboard'),
  registrarEntrada: (dados)             => bcApi._call('registrarEntrada',  dados),
  registrarSaida:   (dados)             => bcApi._call('registrarSaida',    dados),
  cadastrarProduto: (dados)             => bcApi._call('cadastrarProduto',  dados),
  atualizarProduto: (cod, dados)        => bcApi._call('atualizarProduto',  cod, dados),
  excluirProduto:   (cod)               => bcApi._call('excluirProduto',    cod),
  listarSecoes:     ()                  => bcApi._call('listarSecoes'),

  // ── USUÁRIOS ──────────────────────────────────────────────────────────────
  listarUsuarios:   (token)             => bcApi._call('listarUsuarios',   token),
  cadastrarUsuario: (token, dados)      => bcApi._call('cadastrarUsuario', token, dados),
  alterarStatusUsr: (token, mat, st)    => bcApi._call('alterarStatusUsr', token, mat, st),
  redefinirSenha:   (token, mat, senha) => bcApi._call('redefinirSenha',   token, mat, senha),
  alterarSenha:     (token, at, nova)   => bcApi._call('alterarSenha',     token, at, nova),
};

// =============================================================================
//  GERENCIADOR DE SESSÃO
//
//  Segurança:
//    • sessionStorage  →  destruído ao fechar a aba (mais seguro que localStorage
//                         contra tokens esquecidos no navegador compartilhado)
//    • localStorage    →  mantido entre abas e reinicializações (mais conveniente,
//                         mas aumenta a janela de exposição em caso de XSS)
//
//  ESCOLHA ATUAL: sessionStorage (padrão mais seguro).
//  Para restaurar o comportamento anterior (localStorage), altere _store abaixo.
// =============================================================================
const bcSessao = {

  _KEY:   'bc_sessao',
  _store: sessionStorage,   // ← troque por localStorage se preferir

  salvar(token, usuario) {
    const dados = {
      token,
      usuario,
      expira: Date.now() + BC_CONFIG.SESSION_DURATION
    };
    try {
      this._store.setItem(this._KEY, JSON.stringify(dados));
    } catch (e) {
      console.warn('[bcSessao] Não foi possível salvar sessão:', e);
    }
  },

  carregar() {
    try {
      const raw = this._store.getItem(this._KEY);
      if (!raw) return null;
      const dados = JSON.parse(raw);
      if (Date.now() > dados.expira) { this.limpar(); return null; }
      return dados;
    } catch {
      return null;
    }
  },

  limpar() {
    try { this._store.removeItem(this._KEY); } catch (e) {}
  },

  renovarExpiracao() {
    // Chame periodicamente para "resetar" o timer enquanto o usuário está ativo
    const sess = this.carregar();
    if (!sess) return;
    sess.expira = Date.now() + BC_CONFIG.SESSION_DURATION;
    try { this._store.setItem(this._KEY, JSON.stringify(sess)); } catch (e) {}
  },

  get token()   { return this.carregar()?.token    || null; },
  get usuario() { return this.carregar()?.usuario  || null; },
  get perfil()  { return this.carregar()?.usuario?.perfil || null; }
};

// =============================================================================
//  RENOVAÇÃO AUTOMÁTICA DE SESSÃO
//  Renova o tempo de expiração local a cada 10 minutos enquanto a página estiver
//  aberta e o usuário tiver uma sessão válida.
// =============================================================================
(function _iniciarRenovacaoAutomatica() {
  const DEZ_MINUTOS = 10 * 60 * 1000;
  setInterval(() => {
    if (bcSessao.carregar()) bcSessao.renovarExpiracao();
  }, DEZ_MINUTOS);
})();
// Adicionar ao final do config.js
const invApi    = bcApi;
const invSessao = bcSessao;
