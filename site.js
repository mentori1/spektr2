/* ════════════════════════════════════════════════════════════════
   site.js — общие интерактивные компоненты для всех страниц
     • Mobile menu (выезжающая панель)
     • Sticky-bar — кнопка «Расчёт» открывает форму или ведёт на /contacts
     • Корзина-заявка (LocalStorage)
     • Кастомный курсор в hero
     • Метрика-плейсхолдер (см. блок METRIKA в самом низу)
   ════════════════════════════════════════════════════════════════ */

(() => {
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  /* ─── MOBILE MENU ─── */
  function initMobileMenu(){
    const burger = $('.burger');
    const menu   = $('.mobile-menu');
    if (!burger || !menu) return;

    const close = () => menu.classList.remove('open');
    const open  = () => menu.classList.add('open');

    burger.addEventListener('click', open);
    $('.mobile-menu-close', menu)?.addEventListener('click', close);
    // клик по ссылке — закрыть меню
    $$('.mobile-menu-list a', menu).forEach(a => a.addEventListener('click', close));
    // Esc — закрыть
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ─── CART (LocalStorage) ─── */
  const CART_KEY = 'sm_cart_v1';

  const cart = {
    items: [],
    load(){
      try { this.items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
      catch { this.items = []; }
    },
    save(){
      try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch {}
    },
    add(item){
      // не дублируем — определяем по name
      if (this.items.find(i => i.name === item.name)) return false;
      this.items.push(item);
      this.save();
      this.render();
      return true;
    },
    remove(name){
      this.items = this.items.filter(i => i.name !== name);
      this.save();
      this.render();
    },
    count(){ return this.items.length; },
    sum(){
      return this.items.reduce((s, i) => s + (Number(i.price) || 0), 0);
    },
    render(){
      // badge на FAB и на sticky-bar
      const c = this.count();
      $$('.cart-fab .badge, .cart-counter').forEach(b => {
        b.textContent = c;
        b.style.display = c > 0 ? 'grid' : 'none';
      });
      const fab = $('.cart-fab');
      if (fab) fab.classList.toggle('visible', c > 0);

      // содержимое модала
      const body = $('.cart-body');
      if (!body) return;
      if (c === 0) {
        body.innerHTML = `
          <div class="cart-empty">
            <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg></div>
            Заявка пуста.<br/>Добавляйте позиции из каталога — отправим менеджеру одной кнопкой.
          </div>`;
        $('.cart-summary b').textContent = '0 ₽';
        return;
      }
      body.innerHTML = this.items.map(it => `
        <div class="cart-item">
          <div>
            <div class="cart-item-name">${escapeHtml(it.name)}</div>
            <div class="cart-item-meta">${escapeHtml(it.meta || '')}</div>
            <div class="cart-item-price">${formatPrice(it.price)} ₽ / ${escapeHtml(it.unit || 'шт')}</div>
          </div>
          <button class="cart-item-remove" data-remove="${escapeAttr(it.name)}" aria-label="Удалить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>`).join('');
      $('.cart-summary b').textContent = formatPrice(this.sum()) + ' ₽';
      $$('button[data-remove]', body).forEach(b =>
        b.addEventListener('click', () => this.remove(b.dataset.remove))
      );
    },
    sendToManager(){
      if (this.count() === 0) { toast('Заявка пуста — добавьте позиции из каталога'); return; }
      const text = encodeURIComponent(
        'Здравствуйте! Хочу рассчитать заказ:\n\n' +
        this.items.map((i, idx) => `${idx+1}. ${i.name} — ${formatPrice(i.price)} ₽ / ${i.unit || 'шт'}\n   ${i.meta || ''}`).join('\n\n') +
        `\n\nИтого ориентировочно: ${formatPrice(this.sum())} ₽`
      );
      window.open(`https://wa.me/79236819709?text=${text}`, '_blank');
    },
  };

  function initCart(){
    cart.load();
    cart.render();

    $('.cart-fab')?.addEventListener('click', openCart);
    $('.cart-open')?.addEventListener('click', openCart);
    $('.cart-overlay')?.addEventListener('click', closeCart);
    $('.cart-close')?.addEventListener('click', closeCart);
    $('.cart-send')?.addEventListener('click', () => cart.sendToManager());
    $('.cart-clear')?.addEventListener('click', () => { cart.items = []; cart.save(); cart.render(); toast('Заявка очищена'); });

    // глобальная функция чтобы catalog мог добавлять
    window.SMCart = {
      add: (item) => {
        const ok = cart.add(item);
        toast(ok ? '✓ Добавлено в заявку' : '· Уже в заявке');
        return ok;
      },
      open: openCart,
      get: () => cart.items,
    };
  }
  function openCart(){
    $('.cart-overlay')?.classList.add('open');
    $('.cart-panel')?.classList.add('open');
  }
  function closeCart(){
    $('.cart-overlay')?.classList.remove('open');
    $('.cart-panel')?.classList.remove('open');
  }

  /* ─── TOAST ─── */
  let toastTimer = 0;
  function toast(text){
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg><span class="toast-text"></span>`;
      document.body.appendChild(t);
    }
    $('.toast-text', t).textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  window.SMToast = toast;

  /* ─── HERO CURSOR ─── */
  function initHeroCursor(){
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const hero = $('.hero');
    if (!hero) return;
    const cur = document.createElement('div');
    cur.className = 'hero-cursor';
    document.body.appendChild(cur);

    hero.addEventListener('mouseenter', () => cur.classList.add('visible'));
    hero.addEventListener('mouseleave', () => cur.classList.remove('visible'));
    hero.addEventListener('mousemove', (e) => {
      cur.style.left = e.clientX + 'px';
      cur.style.top  = e.clientY + 'px';
    });

    // hover-state на ссылках/кнопках внутри hero
    $$('a, button, .hero-product, .hero-viz', hero).forEach(el => {
      el.addEventListener('mouseenter', () => cur.classList.add('hover'));
      el.addEventListener('mouseleave', () => cur.classList.remove('hover'));
    });
  }

  /* ─── helpers ─── */
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s); }
  function formatPrice(n){
    const x = Number(n) || 0;
    return Number.isInteger(x) ? x.toLocaleString('ru-RU') : x.toFixed(2);
  }

  /* ─── INIT ─── */
  function init(){
    initMobileMenu();
    initCart();
    initHeroCursor();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ════════════════════════════════════════════════════════════════
   ЯНДЕКС.МЕТРИКА
   Чтобы подключить — замени COUNTER_ID_PLACEHOLDER на номер
   счётчика из https://metrika.yandex.ru (после регистрации сайта).
   Цели для отслеживания:
     • click_phone        — клик по номеру телефона
     • click_whatsapp     — клик в WhatsApp
     • click_calc         — клик в калькулятор
     • cart_add           — добавление в заявку
     • cart_send          — отправка заявки в WhatsApp
     • download_price     — клик «Скачать прайс»
     • form_submit        — отправка формы расчёта
   ════════════════════════════════════════════════════════════════ */
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

/* ВНИМАНИЕ: при подключении замени значение ниже на свой ID счётчика */
window.SM_METRIKA_ID = 'COUNTER_ID_PLACEHOLDER';
if (window.SM_METRIKA_ID && window.SM_METRIKA_ID !== 'COUNTER_ID_PLACEHOLDER') {
  ym(window.SM_METRIKA_ID, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true });
}

/* Хелпер для отправки целей в Метрику */
window.SMGoal = function(name, params){
  if (window.SM_METRIKA_ID && window.SM_METRIKA_ID !== 'COUNTER_ID_PLACEHOLDER') {
    try { ym(window.SM_METRIKA_ID, 'reachGoal', name, params); } catch {}
  }
};

/* Автоматические цели — подвешиваются после загрузки DOM */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="tel:"]').forEach(a =>
    a.addEventListener('click', () => SMGoal('click_phone')));
  document.querySelectorAll('a[href*="wa.me"]').forEach(a =>
    a.addEventListener('click', () => SMGoal('click_whatsapp')));
  document.querySelectorAll('a[href*="calculator"]').forEach(a =>
    a.addEventListener('click', () => SMGoal('click_calc')));
  document.querySelectorAll('a[href*=".pdf"], a[download]').forEach(a =>
    a.addEventListener('click', () => SMGoal('download_price')));
});
