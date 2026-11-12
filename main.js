/* =========================================================
   DLC — comportamento das páginas (início, sobre, clientes)
   Cada bloco confere se os elementos existem e roda isolado:
   uma falha em um deles não esconde o resto da página.
   ========================================================= */

(() => {
'use strict';

const WHATSAPP = '5531973170620';

/*
  Menos movimento: quando o sistema pede, saem os deslocamentos, os giros e
  o parallax; ficam os fades e as cores. ?motion=full no endereço força a
  experiência completa (útil para testar).
*/
const root = document.documentElement;
const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forceFull = new URLSearchParams(window.location.search).get('motion') === 'full';
const reduceMotion = prefersReduce && !forceFull;
root.classList.toggle('rm', reduceMotion);
root.classList.toggle('motion-ok', prefersReduce && forceFull);
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const run = (name, fn) => { try { fn(); } catch (err) { console.error(`[dlc] ${name}`, err); } };

/* ---------- Texto em palavras: títulos que sobem e frases que acendem ---------- */
function splitWords(el, masked) {
  let count = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/([ \n\t]+)/).forEach((part) => {
          if (!part) return;
          if (/^[ \n\t]+$/.test(part)) { frag.append(' '); return; }
          const word = document.createElement('span');
          word.textContent = part;
          word.style.setProperty('--w', count);
          count += 1;
          if (masked) {
            word.className = 'wi';
            const mask = document.createElement('span');
            mask.className = 'w';
            mask.append(word);
            frag.append(mask);
          } else {
            word.className = 'hw';
            frag.append(word);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };
  walk(el);
  el.style.setProperty('--n', count);
}
run('palavras', () => {
  $$('[data-split]').forEach((el) => { splitWords(el, true); el.classList.add('is-split'); });
  $$('[data-words]').forEach((el) => splitWords(el, false));
});

/* ---------- Menu no celular ---------- */
const topBar = $('[data-top]');
const menuToggle = $('[data-menu-toggle]');
const menu = $('[data-menu]');
const menuOpen = () => Boolean(menu && !menu.hidden);
run('menu', () => {
  if (!menuToggle || !menu) return;
  const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.textContent = open ? 'Fechar' : 'Menu';
    menu.hidden = !open;
  };
  menuToggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuToggle.focus(); }
  });
});

/* ---------- Dobra: o título sobe, o globo abre, os pontos entram em órbita ---------- */
const hero = $('[data-hero]');
run('dobra', () => {
  if (!hero) return;
  void hero.offsetWidth;   // fixa o estado inicial antes da transição
  window.setTimeout(() => {
    hero.classList.add('is-in');
    $$('[data-split], [data-in]', hero).forEach((el) => el.classList.add('is-in'));
  }, 40);
});

/* ---------- Entradas: cada parte aparece uma vez, ao entrar na tela ---------- */
run('entradas', () => {
  $$('[data-in-group]').forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty('--d', i));
  });
  const entering = [...$$('[data-in]'), ...$$('[data-split]'), ...$$('[data-in-group] > *')];
  if (!('IntersectionObserver' in window)) { entering.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
  entering.forEach((el) => io.observe(el));

  // Rede de segurança: se o observador falhar, um relógio revela o que ficou na tela
  // por duas checagens seguidas. Em condições normais o observador chega antes
  // e a entrada animada acontece como desenhada.
  let pending = entering.slice();
  const seen = new WeakSet();
  const sweep = window.setInterval(() => {
    const vh = window.innerHeight;
    pending = pending.filter((el) => {
      if (el.classList.contains('is-in')) return false;
      const r = el.getBoundingClientRect();
      const inView = r.top < vh * 0.96 && r.bottom > 0;
      if (!inView) { seen.delete(el); return true; }
      if (!seen.has(el)) { seen.add(el); return true; }
      el.classList.add('is-in');
      io.unobserve(el);
      return false;
    });
    if (!pending.length) window.clearInterval(sweep);
  }, 700);
});

/* ---------- Ligado à rolagem ----------
   Cada elemento marcado recebe --p (0 a 1) conforme a posição na tela; o CSS
   usa esse valor para girar, deslocar e acender. O valor persegue o alvo aos
   poucos, então o movimento continua macio mesmo com a roda do mouse. */
run('rolagem', () => {
  const tracked = [];
  $$('[data-p]').forEach((el) => {
    const mode = el.dataset.p;
    let compute;
    if (mode === 'exit') compute = (r) => -r.top / Math.max(1, r.height);
    else if (mode === 'enter') compute = (r, vh) => (vh * 0.92 - r.top) / (vh * 0.5);
    else compute = (r, vh) => (vh - r.top) / (vh + r.height);
    tracked.push({ el, compute, cur: null, last: null, target: 0 });
  });

  // Topo: some ao descer, volta ao subir; marca a seção atual (só links de âncora)
  const navLinks = $$('.top-nav a').filter((a) => (a.getAttribute('href') || '').startsWith('#'));
  const navSections = navLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const closing = $('#contato');
  let lastY = window.scrollY;
  const updateChrome = (vh) => {
    if (!topBar) return;
    const y = window.scrollY;
    topBar.classList.toggle('is-scrolled', y > 16);
    const keep = menuOpen() || topBar.contains(document.activeElement) || y < 240;
    if (keep || y < lastY - 4) topBar.classList.remove('is-hidden');
    else if (y > lastY + 4) topBar.classList.add('is-hidden');
    lastY = y;
    if (!navSections.length) return;
    const mid = vh * 0.5;
    let current = null;
    navSections.forEach((s) => { if (s.getBoundingClientRect().top <= mid) current = s; });
    if (closing && closing.getBoundingClientRect().top <= mid) current = null;
    navLinks.forEach((a) => {
      if (current && a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  if (topBar) topBar.addEventListener('focusin', () => topBar.classList.remove('is-hidden'));

  const update = (immediate) => {
    const vh = window.innerHeight;
    // 1) medir tudo
    tracked.forEach((t) => { t.target = clamp(t.compute(t.el.getBoundingClientRect(), vh), 0, 1); });
    updateChrome(vh);
    // 2) só então escrever
    let moving = false;
    tracked.forEach((t) => {
      if (t.cur === null || immediate || reduceMotion) t.cur = t.target;
      else {
        const d = t.target - t.cur;
        if (Math.abs(d) < 0.0006) t.cur = t.target;
        else { t.cur += d * 0.16; moving = true; }
      }
      if (t.cur !== t.last) { t.el.style.setProperty('--p', t.cur.toFixed(4)); t.last = t.cur; }
    });
    return moving;
  };
  let running = false;
  const loop = () => { running = update(false); if (running) requestAnimationFrame(loop); };
  const kick = () => { if (running) return; running = true; requestAnimationFrame(loop); };
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  update(true);
});

/* ---------- Método: a roda gira sozinha e o passo ativo acompanha ---------- */
run('ciclo', () => {
  const cycle = $('[data-cycle]');
  if (!cycle) return;
  const steps = $$('.cycle-steps li', cycle);
  const dots = $$('.wheel-dot', cycle);
  if (!steps.length) return;
  if (reduceMotion) { dots.forEach((dot) => dot.classList.add('is-on')); return; }

  const LOOP = 16000;   // uma volta completa
  let p = 0;            // posição na volta, 0 a 1
  let current = -1;     // passo ativo
  let turns = 0;        // contador que só cresce, para o arco andar sempre para a frente
  let held = -1;        // passo sob o mouse
  let visible = false;
  let last = 0;
  let raf = 0;

  const setStep = (s) => {
    if (s === current) return;
    turns += current < 0 ? s : (s - current + steps.length) % steps.length;
    current = s;
    cycle.style.setProperty('--s', turns);
    steps.forEach((li, i) => li.classList.toggle('is-active', i === s));
    dots.forEach((dot, i) => dot.classList.toggle('is-on', i === s));
  };
  const frame = (now) => {
    raf = 0;
    if (!visible) return;
    if (last && held < 0) p = (p + (now - last) / LOOP) % 1;
    last = now;
    cycle.style.setProperty('--p', p.toFixed(4));
    setStep(Math.min(steps.length - 1, Math.floor(p * steps.length)));
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

  cycle.classList.add('is-live');
  setStep(0);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }, { threshold: 0.2 }).observe(cycle);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) start(); });

  // passar o mouse em um passo leva a roda até ele
  steps.forEach((li, i) => {
    li.addEventListener('pointerenter', () => { held = i; p = (i + 0.5) / steps.length; });
    li.addEventListener('pointerleave', () => { held = -1; });
  });
});

/* ---------- Atalhos das normas: levam à seção e destacam o cartão certo ---------- */
run('atalhos', () => {
  $$('[data-card]').forEach((link) => {
    link.addEventListener('click', () => {
      const card = document.getElementById(link.dataset.card);
      if (!card) return;
      window.setTimeout(() => {
        card.classList.toggle('is-ping', false);
        void card.offsetWidth;
        card.classList.toggle('is-ping', true);
      }, reduceMotion ? 0 : 500);
    });
  });
});

/* ---------- Ponteiro: botões que puxam de leve e o globo que acompanha o mouse ---------- */
run('ponteiro', () => {
  if (!finePointer || reduceMotion) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.translate = `${(x * 14).toFixed(1)}px ${(y * 10).toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });

  const orbit = $('[data-orbit]');
  if (!hero || !orbit) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    orbit.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    orbit.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    orbit.style.setProperty('--mx', 0);
    orbit.style.setProperty('--my', 0);
  });
});

/* ---------- Perguntas: uma aberta por vez, para a seção caber na tela ---------- */
run('perguntas', () => {
  const items = $$('[data-faq]');
  const setOpen = (item, open) => {
    item.classList.toggle('is-open', open);
    const button = $('.faq-q', item);
    if (button) button.setAttribute('aria-expanded', String(open));
  };
  items.forEach((item) => {
    const button = $('.faq-q', item);
    if (!button) return;
    button.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach((other) => { if (other !== item) setOpen(other, false); });
      setOpen(item, open);
    });
  });
});

/* ---------- Mensagem montada: a pessoa escolhe e vê o texto que vai enviar ---------- */
run('mensagem', () => {
  const composer = $('[data-composer]');
  if (!composer) return;
  const preview = $('[data-msg]', composer);
  const bubble = $('[data-bubble]', composer);
  const send = $('[data-send]', composer);
  if (!preview || !bubble || !send) return;
  const value = (name) => { const el = $(`input[name="${name}"]:checked`, composer); return el ? el.value : ''; };
  let typing = 0;
  const compose = (animate) => {
    const norma = value('norma');
    const prazo = value('prazo');
    const text = `Olá! Quero um diagnóstico gratuito${norma ? ` ${norma}` : ''}.${prazo ? ` ${prazo}` : ''}`;
    send.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;   // o link nunca fica atrás do texto
    window.clearTimeout(typing);
    if (!animate || reduceMotion) { preview.textContent = text; bubble.classList.remove('is-typing'); return; }
    bubble.classList.add('is-typing');
    typing = window.setTimeout(() => {
      preview.textContent = text;
      bubble.classList.remove('is-typing');
      if (bubble.animate) bubble.animate([{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 460, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }, 460);
  };
  composer.addEventListener('change', () => compose(true));
  compose(false);
});

/* ---------- Números que contam (página Sobre) ---------- */
run('numeros', () => {
  const counters = $$('[data-count]');
  if (!counters.length || reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el = entry.target;
      const end = Number(el.dataset.count);
      if (!Number.isFinite(end)) return;
      const t0 = performance.now();
      const tick = (now) => {
        const t = clamp((now - t0) / 1400, 0, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => io.observe(el));
});

/* ---------- Ano no rodapé ---------- */
run('ano', () => { $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); }); });

// Só agora avisa o <head> de que tudo carregou (senão a página volta ao modo sem animação).
window.__dlc = true;

})();
