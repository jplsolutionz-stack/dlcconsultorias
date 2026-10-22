/* =========================================================
   DLC — consentimento de cookies (LGPD)

   Hoje o site não usa cookies. Este arquivo só age se um dos IDs abaixo
   for preenchido: aí aparece o aviso, com "Aceitar" e "Recusar" do mesmo
   tamanho, e as ferramentas só carregam depois do aceite.
   A escolha fica salva neste navegador e pode ser mudada pelo link
   "Preferências de cookies" no rodapé.
   ========================================================= */

const COOKIES = {
  ga4Id: '',        // Google Analytics 4, ex.: 'G-XXXXXXXXXX'
  metaPixelId: '',  // Meta Pixel (Instagram/Facebook), ex.: '1234567890'
};

(function () {
  const tools = [COOKIES.ga4Id && 'Google Analytics', COOKIES.metaPixelId && 'Meta Pixel'].filter(Boolean);
  if (!tools.length) return;

  const KEY = 'dlc-cookies';
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* navegação privada */ } };

  let loaded = false;
  function loadTools() {
    if (loaded) return;
    loaded = true;
    if (COOKIES.ga4Id) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${COOKIES.ga4Id}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', COOKIES.ga4Id, { anonymize_ip: true });
    }
    if (COOKIES.metaPixelId) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', COOKIES.metaPixelId);
      window.fbq('track', 'PageView');
    }
  }

  let banner = null;
  let returnFocus = null;

  function closeBanner() {
    if (!banner) return;
    banner.remove();
    banner = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }

  function choose(value) {
    const previous = read();
    save(value);
    closeBanner();
    if (value === 'accepted') loadTools();
    // Ferramentas já carregadas não "descarregam": recarrega para valer a recusa.
    else if (previous === 'accepted' && loaded) window.location.reload();
  }

  function openBanner(fromUser) {
    if (banner) return;
    returnFocus = fromUser ? document.activeElement : null;
    banner = document.createElement('div');
    banner.className = 'cookie-banner is-entering';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.setAttribute('aria-describedby', 'cookie-text');
    banner.innerHTML = `
      <h2 id="cookie-title">Cookies</h2>
      <p id="cookie-text">Usamos ${tools.join(' e ')} para entender como o site é usado${COOKIES.metaPixelId ? ' e medir anúncios' : ''}. Eles só são ativados se você aceitar. <a href="privacidade.html#cookies">Saiba mais</a></p>
      <div class="cookie-actions">
        <button class="btn btn-secondary" type="button" data-choice="rejected">Recusar</button>
        <button class="btn btn-primary" type="button" data-choice="accepted">Aceitar</button>
      </div>`;
    banner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-choice]');
      if (btn) choose(btn.dataset.choice);
    });
    banner.addEventListener('keydown', (e) => { if (e.key === 'Escape' && read()) closeBanner(); });
    document.body.appendChild(banner);
    if (fromUser) banner.querySelector('[data-choice]').focus();
  }

  document.querySelectorAll('[data-cookie-prefs]').forEach((btn) => {
    btn.hidden = false;
    btn.addEventListener('click', () => openBanner(true));
  });

  const consent = read();
  if (consent === 'accepted') loadTools();
  else if (consent !== 'rejected') openBanner(false);
})();
