/* =========================================================
   DLC — consentimento de cookies (LGPD)

   Sem um ID abaixo, o site não usa cookies e este arquivo não faz nada.
   Com um ID preenchido:
   - aparece o aviso, com "Rejeitar", "Configurar" e "Aceitar" do mesmo
     tamanho (Guia de Cookies da ANPD, 2022);
   - cada ferramenta é uma categoria separada, desmarcada por padrão;
   - nada é carregado antes do aceite da categoria;
   - a escolha fica neste navegador e pode ser mudada em
     "Preferências de cookies", no rodapé; ao retirar o aceite, os cookies
     da ferramenta são apagados.
   Em localhost nada é enviado a terceiros: o arquivo só registra no console.
   ========================================================= */

const COOKIES = {
  ga4Id: '',        // Google Analytics 4, ex.: 'G-XXXXXXXXXX'
  metaPixelId: '',  // Meta Pixel (conjunto de dados), ex.: '123456789012345'
  versao: '2026-11-18', // mude a data quando a política de cookies mudar: o aviso volta a aparecer
};

(function () {
  'use strict';

  const CATEGORIAS = [
    {
      chave: 'medicao',
      id: COOKIES.ga4Id,
      titulo: 'Medição de visitas',
      ferramenta: 'Google Analytics',
      empresa: 'Google',
      comArtigo: 'o Google Analytics',
      empresaComArtigo: 'o Google',
      para: 'medir visitas',
      texto: 'Conta visitas e cliques de forma estatística, para sabermos quais partes do site são úteis.',
      cookies: '_ga e _ga_*, até 2 anos',
    },
    {
      chave: 'publicidade',
      id: COOKIES.metaPixelId,
      titulo: 'Anúncios da Meta',
      ferramenta: 'Meta Pixel',
      empresa: 'Meta',
      comArtigo: 'o Meta Pixel',
      empresaComArtigo: 'a Meta',
      para: 'medir os anúncios da DLC no Instagram e no Facebook',
      texto: 'Mede se os anúncios da DLC no Instagram e no Facebook trazem visitas e contatos, e permite mostrar anúncios da DLC a quem já visitou o site.',
      cookies: '_fbp e _fbc, até 90 dias',
    },
  ].filter((c) => c.id);
  if (!CATEGORIAS.length) return;

  const SECO = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const log = (...a) => console.info('[dlc-cookies]', ...a); // eslint-disable-line no-console
  const CHAVE = 'dlc-consentimento';

  const ler = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      return v && v.versao === COOKIES.versao ? v : null;
    } catch { return null; }
  };
  const salvar = (escolha) => {
    try { localStorage.setItem(CHAVE, JSON.stringify(escolha)); } catch { /* navegação privada */ }
  };
  const nova = (valores) => {
    const e = { versao: COOKIES.versao, data: new Date().toISOString() };
    CATEGORIAS.forEach((c) => { e[c.chave] = Boolean(valores[c.chave]); });
    return e;
  };

  /* ---------- ferramentas ---------- */
  const ativo = {};

  function carregarGA() {
    if (ativo.medicao) return;
    ativo.medicao = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', COOKIES.ga4Id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    if (SECO) { log('carregaria o Google Analytics', COOKIES.ga4Id); return; }
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(COOKIES.ga4Id)}`;
    document.head.appendChild(s);
  }

  function carregarPixel() {
    if (ativo.publicidade) return;
    ativo.publicidade = true;
    if (SECO) {
      window.fbq = (...a) => log('fbq', ...a);
      log('carregaria o Meta Pixel', COOKIES.metaPixelId);
    } else {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
    }
    // Sem detecção automática de cliques e campos: só os eventos definidos aqui.
    window.fbq('set', 'autoConfig', false, COOKIES.metaPixelId);
    window.fbq('init', COOKIES.metaPixelId);
    window.fbq('track', 'PageView');
  }

  function aplicar(escolha) {
    if (escolha.medicao && COOKIES.ga4Id) carregarGA();
    if (escolha.publicidade && COOKIES.metaPixelId) carregarPixel();
  }

  // Apaga os cookies das ferramentas no domínio atual e nos domínios-pai.
  function apagarCookies() {
    const nomes = document.cookie.split(';').map((c) => c.split('=')[0].trim())
      .filter((n) => /^_ga($|_)/.test(n) || n === '_gid' || n === '_fbp' || n === '_fbc');
    const partes = window.location.hostname.split('.');
    const dominios = [''];
    for (let i = 0; i < partes.length - 1; i += 1) dominios.push(partes.slice(i).join('.'));
    nomes.forEach((n) => dominios.forEach((d) => {
      document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }));
  }

  function decidir(escolha) {
    const antiga = ler();
    salvar(escolha);
    fechar();
    const retirou = antiga && CATEGORIAS.some((c) => antiga[c.chave] && !escolha[c.chave]);
    if (retirou) { apagarCookies(); window.location.reload(); return; }
    aplicar(escolha);
  }

  /* ---------- eventos: contato pelo WhatsApp ---------- */
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!link) return;
    const nome = (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const pedido = link.hasAttribute('data-send');
    if (ativo.publicidade && window.fbq) window.fbq('track', pedido ? 'Lead' : 'Contact', { content_name: nome });
    if (ativo.medicao && window.gtag) window.gtag('event', 'generate_lead', { method: 'WhatsApp', link_text: nome });
  }, true);

  /* ---------- aviso ---------- */
  let aviso = null;
  let voltarFoco = null;
  const lista = (itens) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : itens[0]);

  function fechar() {
    if (!aviso) return;
    aviso.remove();
    aviso = null;
    if (voltarFoco && document.contains(voltarFoco)) voltarFoco.focus();
  }

  function abrir(detalhe, peloUsuario) {
    fechar();
    voltarFoco = peloUsuario ? document.activeElement : null;
    const atual = ler() || {};
    const ferramentas = lista(CATEGORIAS.map((c) => c.comArtigo));
    const empresas = lista(CATEGORIAS.map((c) => c.empresaComArtigo));
    const finalidades = lista(CATEGORIAS.map((c) => c.para));
    const varias = CATEGORIAS.length > 1;

    aviso = document.createElement('div');
    aviso.className = 'cookie-banner';
    aviso.setAttribute('role', 'dialog');
    aviso.setAttribute('aria-modal', 'false');
    aviso.setAttribute('aria-labelledby', 'cookie-title');

    if (!detalhe) {
      aviso.innerHTML = `
        <h2 id="cookie-title">Cookies</h2>
        <p>Com a sua permissão, usamos ${ferramentas} para ${finalidades}. ${varias ? 'Eles guardam' : 'Ele guarda'} cookies no seu navegador e ${varias ? 'enviam' : 'envia'} dados de navegação para ${empresas}, inclusive fora do Brasil. Nada é ativado sem o seu aceite. <a href="privacidade.html#cookies">Saiba mais</a></p>
        <div class="cookie-actions">
          <button class="btn btn-secondary" type="button" data-act="rejeitar">Rejeitar</button>
          <button class="btn btn-secondary" type="button" data-act="configurar">Configurar</button>
          <button class="btn btn-secondary" type="button" data-act="aceitar">Aceitar</button>
        </div>`;
    } else {
      aviso.innerHTML = `
        <h2 id="cookie-title">Preferências de cookies</h2>
        <p>Escolha o que pode ser ativado. Você pode mudar quando quiser em “Preferências de cookies”, no rodapé.</p>
        <div class="cookie-cats">
          ${CATEGORIAS.map((c) => `
          <label class="cookie-cat">
            <input type="checkbox" name="${c.chave}"${atual[c.chave] ? ' checked' : ''}>
            <span><strong>${c.titulo}</strong> · ${c.ferramenta} (${c.empresa})<br>${c.texto} Cookies: ${c.cookies}. Dados enviados para fora do Brasil.</span>
          </label>`).join('')}
          <p class="cookie-cat cookie-cat--fixa"><span><strong>Necessário</strong><br>Guarda a sua escolha neste navegador. Não é enviado a ninguém.</span></p>
        </div>
        <div class="cookie-actions">
          <button class="btn btn-secondary" type="button" data-act="rejeitar">Rejeitar tudo</button>
          <button class="btn btn-secondary" type="button" data-act="salvar">Salvar escolhas</button>
          <button class="btn btn-secondary" type="button" data-act="aceitar">Aceitar tudo</button>
        </div>
        <p class="cookie-link"><a href="privacidade.html#cookies">Política de privacidade</a></p>`;
    }

    aviso.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'configurar') { abrir(true, true); return; }
      const todos = (v) => Object.fromEntries(CATEGORIAS.map((c) => [c.chave, v]));
      if (act === 'aceitar') decidir(nova(todos(true)));
      if (act === 'rejeitar') decidir(nova(todos(false)));
      if (act === 'salvar') {
        const marcados = Object.fromEntries(CATEGORIAS.map((c) => [c.chave, aviso.querySelector(`input[name="${c.chave}"]`).checked]));
        decidir(nova(marcados));
      }
    });
    aviso.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ler()) fechar(); });
    document.body.appendChild(aviso);
    if (peloUsuario) (aviso.querySelector('input, [data-act]')).focus();
  }

  document.querySelectorAll('[data-cookie-prefs]').forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', () => abrir(true, true));
  });

  const escolha = ler();
  if (escolha) aplicar(escolha);
  else abrir(false, false);
})();
