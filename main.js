/* =========================================================
   DLC — comportamento da landing page
   ========================================================= */

// Sinaliza ao <head> que o script carregou (senão a página volta ao modo sem animação).
window.__dlc = true;

/*
  CONFIGURAÇÃO
  whatsapp:     número com DDI e DDD, só dígitos. Os links e o envio do
                formulário usam este número.
  formEndpoint: opcional. URL que recebe o formulário via POST (JSON), por
                exemplo Formspree ou uma rota própria. Se preenchido, o
                formulário envia para cá em vez de abrir o WhatsApp.
  responseTime: opcional. Prazo de resposta exibido após o envio por
                endpoint (ex.: '1 dia útil').
*/
const CONFIG = {
  whatsapp: '5531973170620',
  formEndpoint: '',
  responseTime: '',
};

/*
  Movimento reduzido: quando o sistema pede menos animação, tiramos o que
  desloca a tela (parallax, deslizamentos, cabeçalho que some) e mantemos
  fades, cores e o progresso do Ciclo, que acompanha a rolagem da pessoa.
  ?motion=full no endereço força a experiência completa (útil para testar).
*/
const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forceFull = new URLSearchParams(window.location.search).get('motion') === 'full';
const reduceMotion = prefersReduce && !forceFull;
document.documentElement.classList.toggle('rm', reduceMotion);
document.documentElement.classList.toggle('motion-ok', prefersReduce && forceFull);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const onMedia = (mq, fn) => {
  if (mq.addEventListener) mq.addEventListener('change', fn);
  else if (mq.addListener) mq.addListener(fn); // Safari < 14
};

/* ---------- Divide textos em palavras ---------- */
// O texto completo fica num span .sr-only para leitores de tela e tradutores;
// as palavras animadas ficam escondidas da árvore de acessibilidade.
function splitWords(el, wrap, { hideWords = true } = {}) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  text.split(' ').forEach((word, i, arr) => {
    const node = wrap(word, i);
    if (hideWords) node.setAttribute('aria-hidden', 'true');
    el.appendChild(node);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  if (hideWords) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);
  }
  el.setAttribute('data-ready', '');
}

$$('[data-split]').forEach((el) => splitWords(el, (word, i) => {
  const outer = document.createElement('span');
  outer.className = 'w';
  const inner = document.createElement('span');
  inner.className = 'w-in';
  inner.style.setProperty('--wi', i);
  inner.textContent = word;
  outer.appendChild(inner);
  return outer;
}));

// Frases que "acendem" com a rolagem: as palavras só mudam de cor, então continuam
// legíveis por leitores de tela. Divide só os nós de texto, preservando o <span class="mark">.
function splitTextNodes(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const span = document.createElement('span');
      span.className = 'cw';
      span.textContent = part;
      frag.appendChild(span);
    });
    node.replaceWith(frag);
  });
}
$$('[data-words]').forEach(splitTextNodes);

/* ---------- Dobra: entra ao carregar ---------- */
// Força o cálculo do estado inicial e então liga a transição; não depende de
// requestAnimationFrame, que fica pausado em abas abertas em segundo plano.
const heroEls = $$('.hero [data-split], .hero [data-portrait]');
heroEls.forEach((el) => getComputedStyle(el).opacity);
void document.body.offsetWidth;
heroEls.forEach((el) => el.classList.add('is-in'));

/* ---------- Revelação ao rolar ---------- */
$$('[data-reveal-group]').forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty('--d', i));
});

const revealTargets = [
  ...$$('[data-reveal]'),
  ...$$('[data-reveal-group] > *'),
  ...$$('[data-split]').filter((el) => !el.closest('.hero')),
];

if (!('IntersectionObserver' in window)) {
  revealTargets.forEach((el) => el.classList.add('is-in'));
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealTargets.forEach((el) => revealObserver.observe(el));
}

/* ---------- Referências ---------- */
const header = $('[data-header]');
const progressBar = $('[data-scroll-progress]');
const toggle = $('[data-menu-toggle]');
const menu = $('[data-menu]');
const main = $('main');
const footer = $('.site-footer');
const bar = $('[data-mobile-bar]');
const hero = $('.hero');
const finalSection = $('#solicitar');
let lastY = window.scrollY;

/* ---------- Menu no celular ---------- */
const menuOpen = () => toggle.getAttribute('aria-expanded') === 'true';

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  $('.menu-toggle-label', toggle).textContent = open ? 'Fechar' : 'Menu';
  menu.hidden = !open;
  menu.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  // Com o menu aberto, o resto da página fica fora do alcance do Tab e do leitor de tela.
  main.inert = open;
  footer.inert = open;
  if (window.__lenis) { if (open) window.__lenis.stop(); else window.__lenis.start(); }
  if (open) {
    bar.inert = true;
    header.classList.remove('is-hidden');
    $('a', menu).focus({ preventScroll: true });
  } else {
    requestFrame();
  }
}
toggle.addEventListener('click', () => setMenu(!menuOpen()));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen()) { setMenu(false); toggle.focus(); }
});
onMedia(window.matchMedia('(min-width: 1024px)'), (e) => { if (e.matches && menuOpen()) setMenu(false); });

/* ---------- WhatsApp ---------- */
const waMessage = 'Olá, quero um diagnóstico ISO gratuito.';
const waUrl = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
$$('[data-whatsapp]').forEach((link) => {
  if (!CONFIG.whatsapp) return;
  link.href = waUrl(waMessage);
  link.target = '_blank';
  link.rel = 'noopener';
  link.hidden = false;
});

/* ---------- Ciclo DLC ---------- */
const cycle = $('[data-cycle]');
const stepItems = $$('[data-step-item]');
const stepsList = $('.steps');
const cycleProgress = $('[data-cycle-progress]');
const cycleNodes = $$('.cycle-node');
const cycleCenter = $('.cycle-center');
const cycleNum = $('[data-cycle-num]');
const cycleLabel = $('[data-cycle-label]');
let currentStep = -1;
let swapTimer = 0;

function paintCenter(index) {
  cycleNum.textContent = String(index + 1).padStart(2, '0');
  cycleLabel.textContent = $('h3', stepItems[index]).textContent;
}

function setStep(index) {
  if (index === currentStep) return;
  const first = currentStep < 0;
  currentStep = index;
  stepItems.forEach((item, i) => {
    item.classList.toggle('is-active', i === index);
    item.classList.toggle('is-done', i < index);
  });
  cycleNodes.forEach((node, i) => {
    node.classList.toggle('is-on', i <= index);
    node.classList.toggle('is-current', i === index);
  });
  window.clearTimeout(swapTimer);
  if (first || reduceMotion) {
    cycleCenter.classList.remove('is-swapping');
    paintCenter(index);
    return;
  }
  // Uma única troca, mesmo se a pessoa passar por várias etapas de uma vez.
  cycleCenter.classList.add('is-swapping');
  swapTimer = window.setTimeout(() => {
    paintCenter(currentStep);
    cycleCenter.classList.remove('is-swapping');
  }, 220);
}

/* ---------- Elementos ligados à rolagem ---------- */
// Com GSAP + ScrollTrigger carregados, eles cuidam do que é ligado à rolagem;
// sem eles (arquivo bloqueado ou com erro), o cálculo manual abaixo assume.
const useGsap = !!(window.gsap && window.ScrollTrigger);
const parallaxEls = reduceMotion ? [] : $$('[data-parallax]');
const navLinks = $$('.nav a');
const navSections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
const wordBlocks = $$('[data-words]').map((el) => ({ el, words: $$('.cw', el), mark: $('.mark', el) }));
const stripItems = $$('[data-strip] li');
const inlineCtas = $$('main a.btn[href="#solicitar"]');

function lightWords(block, p) {
  const count = Math.round(p * block.words.length);
  block.words.forEach((w, i) => w.classList.toggle('is-on', i < count));
  if (block.mark) block.mark.classList.toggle('is-on', count >= block.words.length);
}

function cycleFromProgress(p, anchor) {
  if (cycleProgress) cycleProgress.style.setProperty('--offset', (1 - p).toFixed(4));
  stepsList.style.setProperty('--p', p.toFixed(4));
  let active = 0;
  stepItems.forEach((item, i) => { if (item.getBoundingClientRect().top <= anchor) active = i; });
  setStep(active);
}

// Foco de teclado no cabeçalho (cliques de mouse não contam).
const kbFocusInHeader = () => {
  try { return !!header.querySelector(':focus-visible'); } catch { return header.contains(document.activeElement); }
};
header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

function onScrollFrame() {
  const y = window.scrollY;
  const vh = window.innerHeight;

  // Cabeçalho
  const goingDown = y > lastY + 4;
  const goingUp = y < lastY - 4;
  if (!reduceMotion && !menuOpen()) {
    if (kbFocusInHeader()) header.classList.remove('is-hidden');
    else if (goingDown && y > 280) header.classList.add('is-hidden');
    else if (goingUp || y < 280) header.classList.remove('is-hidden');
  }
  lastY = y;

  // Sem GSAP: barra de leitura, parallax, Ciclo, faixa e palavras calculados aqui
  if (!useGsap) {
    const max = document.documentElement.scrollHeight - vh;
    if (progressBar) progressBar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
    parallaxEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const factor = parseFloat(el.dataset.parallax) || 0;
      el.style.setProperty('--py', `${((r.top + r.height / 2 - vh / 2) * factor).toFixed(1)}px`);
    });
    if (cycle && stepItems.length) {
      const first = stepItems[0].getBoundingClientRect();
      const last = stepItems[stepItems.length - 1].getBoundingClientRect();
      const anchor = vh * 0.55;
      cycleFromProgress(clamp((anchor - first.top) / (last.bottom - first.top), 0, 1), anchor);
    }
    wordBlocks.forEach((b) => {
      const r = b.el.getBoundingClientRect();
      lightWords(b, clamp((vh * 0.85 - r.top) / (vh * 0.5), 0, 1));
    });
  }

  // Navegação ativa
  const mid = vh * 0.5;
  let current = null;
  navSections.forEach((s) => { if (s.getBoundingClientRect().top <= mid) current = s; });
  if (finalSection.getBoundingClientRect().top <= mid) current = null;
  navLinks.forEach((a) => {
    if (current && a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });

  // Barra fixa no celular: some na dobra, no formulário e quando já há um botão igual na tela
  if (bar && !menuOpen()) {
    const pastHero = hero.getBoundingClientRect().bottom < 0;
    const atForm = finalSection.getBoundingClientRect().top < vh * 0.9;
    const inlineCta = inlineCtas.some((b) => { const r = b.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
    const visible = pastHero && !atForm && !inlineCta;
    bar.classList.toggle('is-visible', visible);
    bar.inert = !visible;
  }
}

let framePending = false;
function requestFrame() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(() => { framePending = false; onScrollFrame(); });
}
window.addEventListener('scroll', requestFrame, { passive: true });
window.addEventListener('resize', requestFrame);
onScrollFrame();

/* =========================================================
   Movimento com GSAP + ScrollTrigger + Lenis (especificação no Figma)
   ========================================================= */
if (useGsap) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const ease = 'expo.out';

  // Rolagem fluida — só quando o sistema não pede menos movimento
  if (!reduceMotion && window.Lenis) {
    const lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      anchors: { offset: -88 },
      smoothWheel: true,
    });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Vinculado: barra de leitura
  if (progressBar) {
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => progressBar.style.setProperty('--progress', self.progress.toFixed(4)),
    });
  }

  // Vinculado: faixa do Ciclo na dobra — as linhas enchem até o método chegar
  if (stripItems.length) {
    ScrollTrigger.create({
      trigger: '[data-strip]',
      start: 'top 85%',
      endTrigger: '#metodo',
      end: 'top 40%',
      onUpdate: (self) => {
        const p = self.progress * stripItems.length;
        stripItems.forEach((li, i) => {
          const fill = clamp(p - i, 0, 1);
          li.style.setProperty('--fill', fill.toFixed(3));
          li.classList.toggle('is-reached', fill > 0.02);
        });
      },
    });
  }

  // Vinculado: frases que acendem palavra por palavra
  wordBlocks.forEach((b) => {
    ScrollTrigger.create({
      trigger: b.el,
      start: 'top 85%',
      end: 'bottom 45%',
      onUpdate: (self) => lightWords(b, self.progress),
    });
  });

  // Vinculado: Ciclo DLC — círculo, nós e etapa ativa seguem a rolagem
  if (cycle && stepItems.length) {
    ScrollTrigger.create({
      trigger: stepItems[0],
      start: 'top 55%',
      endTrigger: stepItems[stepItems.length - 1],
      end: 'bottom 55%',
      onUpdate: (self) => cycleFromProgress(self.progress, window.innerHeight * 0.55),
      onRefresh: (self) => cycleFromProgress(self.progress, window.innerHeight * 0.55),
    });
  }

  if (!reduceMotion) {
    // Parallax: arco da dobra desce devagar; foto assenta; símbolo do final sobe devagar
    const arcHero = $('.portrait-arc');
    if (arcHero) {
      gsap.to(arcHero, {
        '--py': '90px',
        ease: 'none',
        scrollTrigger: { trigger: '.portrait', start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    gsap.fromTo('.portrait-frame', { yPercent: 0 }, {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    const mark = $('.final-mark');
    if (mark) {
      gsap.fromTo(mark, { '--py': '120px' }, {
        '--py': '-60px',
        ease: 'none',
        scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }

    // Vinculado: o "custo de esperar" desliza devagar na horizontal
    const drift = $('[data-drift]');
    if (drift) {
      gsap.fromTo(drift, { xPercent: 6 }, {
        xPercent: -2,
        ease: 'none',
        scrollTrigger: { trigger: '.cost', start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }

    // Gatilho: seções escuras e verdes entram com leve escala, sem atrasar o conteúdo
    gsap.utils.toArray('.urgency, .final .form-panel').forEach((el) => {
      gsap.from(el, {
        scale: 0.97,
        opacity: 0.6,
        duration: 1.1,
        ease,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  }

  // Fontes e imagens mudam alturas: recalcula posições quando terminam de carregar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------- FAQ com abertura suave ---------- */
$$('.faq details').forEach((details) => {
  const summary = $('summary', details);
  const body = $('.faq-body', details);
  let anim = null;
  let closing = false;

  summary.addEventListener('click', (e) => {
    if (reduceMotion || !body.animate) return;
    e.preventDefault();

    // Parte da altura atual, para inverter no meio da animação sem saltos.
    const fromH = details.open ? body.getBoundingClientRect().height : 0;
    const fromO = details.open ? Number(getComputedStyle(body).opacity) : 0;
    const opening = !details.open || closing;
    if (anim) anim.cancel();

    if (opening) {
      closing = false;
      details.open = true;
      anim = body.animate(
        [{ height: `${fromH}px`, opacity: fromO }, { height: `${body.scrollHeight}px`, opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
      anim.onfinish = () => { anim = null; if (window.ScrollTrigger) window.ScrollTrigger.refresh(); };
    } else {
      closing = true;
      anim = body.animate(
        [{ height: `${fromH}px`, opacity: fromO }, { height: '0px', opacity: 0 }],
        { duration: 280, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
      );
      anim.onfinish = () => { details.open = false; closing = false; anim = null; if (window.ScrollTrigger) window.ScrollTrigger.refresh(); };
    }
  });
});

/* ---------- Formulário em 2 passos ---------- */
const form = $('[data-form]');
const step1 = $('[data-step="1"]', form);
const step2 = $('[data-step="2"]', form);
const radios = $$('input[name="norma"]', form);
const normError = $('#norma-error');
const chosenNorm = $('[data-chosen-norm]', form);
const status = $('[data-status]', form);
const submitBtn = $('[data-submit]', form);
const formMicro = $('[data-form-micro]', form);
const success = $('[data-success]');
const formProgress = $('[data-progress]');

// O texto do botão diz o que acontece de fato ao enviar.
if (!CONFIG.formEndpoint && CONFIG.whatsapp) {
  submitBtn.textContent = 'Enviar pedido pelo WhatsApp';
  formMicro.textContent = 'Sem custo e sem compromisso. O WhatsApp abre com sua mensagem pronta; o pedido chega quando você toca em enviar.';
}

function showStep(next, prev, progress) {
  prev.hidden = true;
  next.hidden = false;
  formProgress.style.setProperty('--step-p', progress);
  if (!reduceMotion) {
    next.classList.remove('is-entering');
    void next.offsetWidth;
    next.classList.add('is-entering');
  }
}

function clearNormError() {
  normError.hidden = true;
  radios.forEach((r) => { r.removeAttribute('aria-invalid'); r.removeAttribute('aria-describedby'); });
}

function goToStep2() {
  const picked = $('input[name="norma"]:checked', form);
  if (!picked) {
    radios.forEach((r) => { r.setAttribute('aria-invalid', 'true'); r.setAttribute('aria-describedby', 'norma-error'); });
    normError.hidden = false;
    radios[0].focus();
    return;
  }
  clearNormError();
  chosenNorm.textContent = picked.value;
  showStep(step2, step1, 0.85);
  $('#f-nome').focus({ preventScroll: true });
}

$('[data-next]', form).addEventListener('click', goToStep2);
radios.forEach((r) => r.addEventListener('change', clearNormError));

$('[data-back]', form).addEventListener('click', () => {
  showStep(step1, step2, 0.5);
  ($('input[name="norma"]:checked', form) || radios[0]).focus();
});

// Links "Diagnóstico para ISO ..." na seção de normas já marcam a norma no formulário.
$$('[data-norm]').forEach((a) => a.addEventListener('click', () => {
  const r = radios.find((x) => x.value === a.dataset.norm);
  if (!r) return;
  r.checked = true;
  clearNormError();
  if (!step2.hidden) chosenNorm.textContent = r.value;
}));

/* Telefone: aceita +55, 0 de tronco e colagem; mantém o cursor no lugar */
function phoneDigits(value) {
  let d = value.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}
function formatPhone(d) {
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const phone = form.elements.whatsapp;
phone.addEventListener('beforeinput', (e) => {
  // Backspace logo depois de um separador apaga o dígito anterior, não o separador.
  if (e.inputType !== 'deleteContentBackward' || phone.selectionStart !== phone.selectionEnd) return;
  let pos = phone.selectionStart;
  const v = phone.value;
  if (pos > 0 && /\D/.test(v[pos - 1])) {
    while (pos > 0 && /\D/.test(v[pos - 1])) pos -= 1;
    phone.setSelectionRange(pos, pos);
  }
});
phone.addEventListener('input', () => {
  const caret = phone.selectionStart ?? phone.value.length;
  const digitsBefore = phone.value.slice(0, caret).replace(/\D/g, '').length;
  const digits = phoneDigits(phone.value);
  const out = formatPhone(digits);
  phone.value = out;
  // Recoloca o cursor depois do mesmo número de dígitos.
  let pos = 0;
  let seen = 0;
  const target = Math.min(digitsBefore, digits.length);
  while (pos < out.length && seen < target) { if (/\d/.test(out[pos])) seen += 1; pos += 1; }
  if (document.activeElement === phone) phone.setSelectionRange(pos, pos);
});

const validators = {
  nome: (v) => v.trim().length >= 2,
  empresa: (v) => v.trim().length >= 2,
  whatsapp: (v) => phoneDigits(v).length >= 10,
  consentimento: (_, el) => el.checked,
};

function validateField(el) {
  const check = validators[el.name];
  if (!check) return true;
  const ok = check(el.value, el);
  const error = document.getElementById(`${el.id}-error`);
  el.setAttribute('aria-invalid', String(!ok));
  if (error) error.hidden = ok;
  // A mensagem de erro só descreve o campo enquanto existe erro.
  if (ok) el.removeAttribute('aria-describedby');
  else if (error) el.setAttribute('aria-describedby', error.id);
  return ok;
}

Object.keys(validators).forEach((name) => {
  const el = form.elements[name];
  el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validateField(el); });
  el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validateField(el); });
  el.addEventListener('change', () => { if (el.type === 'checkbox') validateField(el); });
});

function showSuccess(title, text) {
  formProgress.style.setProperty('--step-p', 1);
  form.hidden = true;
  $('[data-success-title]', success).textContent = title;
  $('[data-success-text]', success).textContent = text;
  success.hidden = false;
  success.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Enter no passo 1 avança, em vez de validar campos ainda escondidos.
  if (step2.hidden) { goToStep2(); return; }
  status.textContent = '';

  const invalid = Object.keys(validators).map((n) => form.elements[n]).filter((el) => !validateField(el));
  if (invalid.length) { invalid[0].focus(); return; }

  const data = Object.fromEntries(new FormData(form));
  data.whatsapp = formatPhone(phoneDigits(data.whatsapp || ''));

  if (CONFIG.formEndpoint) {
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, consentimento: true, origem: window.location.href }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const when = CONFIG.responseTime ? ` em até ${CONFIG.responseTime}` : '';
      showSuccess('Recebemos seu pedido.', `A DLC vai falar com você${when} pelo WhatsApp informado para marcar o diagnóstico.`);
    } catch {
      status.textContent = 'Não foi possível enviar agora. Tente de novo em instantes ou chame no WhatsApp (31) 97317-0620.';
    } finally {
      submitBtn.removeAttribute('aria-busy');
      submitBtn.disabled = false;
    }
    return;
  }

  if (CONFIG.whatsapp) {
    const text = [
      'Olá, quero um diagnóstico ISO gratuito.',
      `Norma: ${data.norma}`,
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      data.funcionarios && `Funcionários: ${data.funcionarios}`,
      data.prazo && `Prazo: ${data.prazo}`,
    ].filter(Boolean).join('\n');
    // Sem a flag "noopener" (com ela window.open sempre devolve null); o opener é cortado à mão.
    const win = window.open(waUrl(text), '_blank');
    if (win) win.opener = null;
    else window.location.href = waUrl(text);
    showSuccess('Falta só enviar.', 'Abrimos o WhatsApp da DLC com a sua mensagem pronta. O pedido chega quando você tocar em enviar.');
    return;
  }

  status.textContent = 'O envio deste formulário ainda não foi configurado.';
});

/* ---------- Ano no rodapé ---------- */
const year = $('[data-year]');
if (year) year.textContent = new Date().getFullYear();
