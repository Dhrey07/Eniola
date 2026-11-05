import { content, nav, site, stationOrder, type StationId } from '../content';
import { splitWords, escape, plain } from './split';

export interface StationDom {
  id: StationId;
  section: HTMLElement;
  heading: HTMLElement;
  /** headline word inners */
  words: HTMLElement[];
  /** body / secondary word inners */
  body: HTMLElement[];
  /** elements that simply fade/slide up (CTAs, lists, notes) */
  fades: HTMLElement[];
  /** per-station extras */
  parts: Record<string, HTMLElement | HTMLElement[]>;
}

const h = (tag: string, cls: string, html: string, attrs: Record<string, string> = {}) => {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join('');
  return `<${tag} class="${cls}"${a}>${html}</${tag}>`;
};

const kicker = (s: string) => h('p', 'kicker', escape(s));
const para = (s: string, cls = 'body') => h('p', cls, splitWords(s, 'wb'));

const paras = (list: string[], cls = 'body') => list.map((p) => para(p, cls)).join('');

function markup(id: StationId): string {
  const c = content;
  switch (id) {
    case 'hero':
      return h(
        'div',
        'st-inner pos-hero',
        kicker(c.hero.kicker) +
          h('h1', 'display', splitWords(c.hero.headline), { id: 'h-hero', 'aria-label': plain(c.hero.headline) }) +
          h('div', 'body-stack', paras(c.hero.paragraphs, 'body body--lead')) +
          h(
            'div',
            'ctas fade',
            `<a class="btn btn--solid magnetic" href="#${c.hero.ctaPrimary.target}" data-fly="${c.hero.ctaPrimary.target}" data-cursor="Say hi">${escape(c.hero.ctaPrimary.label)}</a>` +
              `<a class="btn btn--ghost magnetic" href="#${c.hero.ctaSecondary.target}" data-fly="${c.hero.ctaSecondary.target}" data-cursor="Read">${escape(c.hero.ctaSecondary.label)}</a>`
          )
      ) + h('div', 'scroll-cue mono', '<span>Scroll</span><i></i>', { 'aria-hidden': 'true' });
    case 'people':
      return h(
        'div',
        'st-inner pos-tl wide',
        kicker(c.people.kicker) +
          h('h2', 'display display--m', splitWords(c.people.headline), { id: 'h-people', 'aria-label': plain(c.people.headline) }) +
          h('blockquote', 'pull', splitWords(c.people.quote, 'wq'), { 'aria-hidden': 'true' }) +
          h('div', 'body-stack', paras(c.people.paragraphs))
      );
    case 'faith':
      return h(
        'div',
        'st-inner pos-tl wide',
        kicker(c.faith.kicker) +
          h('h2', 'display display--m', splitWords(c.faith.headline), { id: 'h-faith', 'aria-label': plain(c.faith.headline) }) +
          h('div', 'faith-lines', c.faith.lines.map((l) => h('p', 'body faith-line', splitWords(l, 'wb'))).join(''))
      );
    case 'work':
      return (
        h(
          'h2',
          'work-head',
          h('span', 'work-left display', splitWords(c.work.headlineLeft)) +
            h('span', 'work-right display', splitWords(c.work.headlineRight)),
          { id: 'h-work', 'aria-label': plain(`${c.work.headlineLeft} ${c.work.headlineRight}`) }
        ) + h('div', 'st-inner pos-br wide', kicker(c.work.kicker) + h('div', 'body-stack', paras(c.work.paragraphs)))
      );
    case 'help':
      return (
        h(
          'div',
          'st-inner pos-top',
          kicker(c.help.kicker) +
            h('h2', 'display display--s', splitWords(c.help.headline), { id: 'h-help', 'aria-label': plain(c.help.headline) })
        ) +
        h(
          'div',
          'help-cards',
          c.help.cards
            .map((card, i) =>
              h(
                'article',
                'help-card',
                h(
                  'div',
                  'help-card__in',
                  h('span', 'help-card__n mono', `0${i + 1}`) +
                    h('h3', 'help-card__title', escape(card.title)) +
                    h('p', 'help-card__body', escape(card.body)) +
                    `<a class="help-card__cta" href="mailto:${escape(site.email)}?subject=${encodeURIComponent(card.subject)}" data-cursor="Ask">${escape(card.cta)} <span aria-hidden="true">→</span></a>`
                ),
                { 'aria-label': card.title }
              )
            )
            .join('')
        ) +
        h('div', 'st-inner pos-help-outro', para(c.help.outro, 'body help-outro'))
      );
    case 'fun':
      return h(
        'div',
        'st-inner pos-tr wide',
        kicker(c.fun.kicker) +
          h('h2', 'display display--m', splitWords(c.fun.headline), { id: 'h-fun', 'aria-label': plain(c.fun.headline) }) +
          h('ul', 'fun-list fade', c.fun.items.map((i) => `<li>${escape(i)}</li>`).join('')) +
          h('p', 'fun-honest fade', `${escape(c.fun.honest)} <span class="wink" aria-hidden="true">📱</span>`)
      );
    case 'style':
      return h(
        'div',
        'st-inner pos-style',
        kicker(c.style.kicker) +
          h('h2', 'display display--m', splitWords(c.style.headline), { id: 'h-style', 'aria-label': plain(c.style.headline) }) +
          para(c.style.body, 'body body--minimal')
      );
    case 'interesting':
      return h(
        'div',
        'st-inner pos-int',
        kicker(c.interesting.kicker) +
          h('h2', 'display display--s', splitWords(c.interesting.headline), {
            id: 'h-interesting',
            'aria-label': plain(c.interesting.headline),
          }) +
          para(c.interesting.body) +
          h('p', 'gold-tag display', splitWords(c.interesting.tag, 'wg'), { 'aria-hidden': 'true' })
      );
    case 'sayhi':
      return h(
        'div',
        'st-inner pos-sayhi',
        kicker(c.sayhi.kicker) +
          h('h2', 'display display--l', splitWords(c.sayhi.headline), { id: 'h-sayhi', 'aria-label': plain(c.sayhi.headline) }) +
          para(c.sayhi.body, 'body body--sayhi') +
          h(
            'div',
            'contact fade',
            `<a class="btn btn--solid magnetic" href="${escape(c.sayhi.email.href)}" data-copy="${escape(site.email)}" data-cursor="Copy">${escape(c.sayhi.email.label)}</a>` +
              c.sayhi.links
                .map((l) => `<a class="btn btn--outline magnetic" href="${escape(l.href)}" target="_blank" rel="noopener" data-cursor="Open">${escape(l.label)}</a>`)
                .join('')
          ) +
          h('p', 'note fade', escape(c.sayhi.note))
      );
    case 'footer':
      return h(
        'div',
        'st-inner pos-footer',
        h('h2', 'display display--l', splitWords(c.footer.headline), { id: 'h-footer', 'aria-label': plain(c.footer.headline) }) +
          h(
            'div',
            'footer-row fade',
            h('p', 'footer-copy', escape(c.footer.copyright)) +
              `<button class="btn btn--ghost magnetic" type="button" data-fly="hero" data-cursor="Rewind">↑ ${escape(c.footer.backToStart)}</button>`
          )
      );
  }
}

export function buildOverlay(root: HTMLElement) {
  root.innerHTML = stationOrder
    .map((id, i) =>
      h('section', `station st-${id}`, markup(id), {
        id,
        'aria-labelledby': `h-${id}`,
        'data-index': String(i),
      })
    )
    .join('');

  const stations = {} as Record<StationId, StationDom>;
  for (const id of stationOrder) {
    const section = root.querySelector<HTMLElement>(`#${id}`)!;
    // aria-label holds the clean headline; hide the split spans from AT
    section.querySelectorAll('[aria-label] .w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
    const all = (sel: string) => Array.from(section.querySelectorAll<HTMLElement>(sel));
    stations[id] = {
      id,
      section,
      heading: section.querySelector<HTMLElement>(`#h-${id}`)!,
      words: all('.display .wi').filter((w) => !w.closest('.wg')),
      body: all('.wb .wi, .wq .wi'),
      fades: all('.fade'),
      parts: {
        workLeft: section.querySelector<HTMLElement>('.work-left')!,
        workRight: section.querySelector<HTMLElement>('.work-right')!,
        faithLines: all('.faith-line'),
        gold: all('.wg .wi'),
        cue: section.querySelector<HTMLElement>('.scroll-cue')!,
      },
    };
  }
  const helpCards = Array.from(root.querySelectorAll<HTMLElement>('.help-card'));
  return { stations, helpCards };
}

export function buildNav(el: HTMLElement) {
  el.innerHTML =
    `<a class="nav__logo magnetic" href="#hero" data-fly="hero" data-cursor="Home">${escape(site.logo)}</a>` +
    `<nav aria-label="Sections"><ul class="nav__links">${nav
      .map((n) => `<li><a href="#${n.target}" data-fly="${n.target}" data-nav="${n.target}">${escape(n.label)}</a></li>`)
      .join('')}</ul></nav>`;
}

export function buildProgress(el: HTMLElement) {
  el.innerHTML = `<div class="progress__track"><div class="progress__fill"></div></div><div class="progress__count mono"><span class="progress__cur">01</span><span class="progress__sep">/</span><span>${String(stationOrder.length).padStart(2, '0')}</span></div>`;
  const fill = el.querySelector<HTMLElement>('.progress__fill')!;
  const cur = el.querySelector<HTMLElement>('.progress__cur')!;
  let last = -1;
  return (p: number, index: number) => {
    fill.style.transform = `scaleY(${p.toFixed(4)})`;
    if (index !== last) {
      last = index;
      cur.textContent = String(index + 1).padStart(2, '0');
    }
  };
}
