/**
 * Tiny text splitter. "*text*" marks emphasis (rendered as <em>).
 * Every word becomes a masked pair: <span class="w"><span class="wi">word</span></span>
 * so it can slide up from behind its own line mask (y: 110% → 0).
 * Spacing is preserved exactly ("I’m *Eniola*." keeps the full stop attached).
 */
export function splitWords(src: string, cls = ''): string {
  const out: string[] = [];
  let em = false;
  // tokens: '*' toggles, whitespace runs, or word runs
  for (const tok of src.match(/\*|\s+|[^\s*]+/g) ?? []) {
    if (tok === '*') {
      em = !em;
      continue;
    }
    if (/^\s+$/.test(tok)) {
      out.push(' ');
      continue;
    }
    const tag = em ? 'em' : 'span';
    out.push(`<span class="w ${cls}"><${tag} class="wi">${escape(tok)}</${tag}></span>`);
  }
  return out.join('');
}

/** plain text with emphasis markers stripped (aria-labels, titles) */
export const plain = (s: string) => s.replace(/\*/g, '');

export function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
