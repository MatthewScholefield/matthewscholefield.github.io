import sanitizeHtml from 'sanitize-html'

export interface ReadmeContext {
  fullName: string
  defaultBranch: string
  path: string
}

export function sanitizeReadme(html: string, context: ReadmeContext): string {
  const prefix = `readme-${Buffer.from(context.fullName).toString('base64url')}-`
  const directory = context.path.split('/').slice(0, -1).map(encodeURIComponent).join('/')
  const repository = context.fullName.split('/').map(encodeURIComponent).join('/')
  const branch = encodeURIComponent(context.defaultBranch)
  const fileBase = `https://github.com/${repository}/blob/${branch}/${directory ? directory + '/' : ''}`
  const imageBase = `https://raw.githubusercontent.com/${repository}/${branch}/${directory ? directory + '/' : ''}`
  const normalizeId = (id: string) => prefix + id.replace(/^user-content-/, '')
  function resolve(value: string, image = false): string {
    if (!image && value.startsWith('#')) {
      try { return '#' + encodeURIComponent(normalizeId(decodeURIComponent(value.slice(1)))) } catch { return '#' + encodeURIComponent(normalizeId(value.slice(1))) }
    }
    try { return new URL(value, image ? imageBase : fileBase).href } catch { return '' }
  }

  const clean = sanitizeHtml(html, {
    allowedTags: ['article', 'section', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'br', 'hr', 'strong', 'b', 'em', 'i', 's', 'del', 'sub', 'sup', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'pre', 'code', 'kbd', 'samp', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'img', 'details', 'summary', 'input', 'figure', 'figcaption'],
    allowedAttributes: {
      '*': ['id', 'title'],
      a: ['href', 'target', 'rel', 'aria-label'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      ol: ['start'], li: ['value'],
      th: ['colspan', 'rowspan', 'scope'], td: ['colspan', 'rowspan'],
      details: ['open'], input: ['type', 'checked', 'disabled', 'aria-label'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'iframe', 'object', 'form', 'button', 'select'],
    transformTags: {
      a: (tagName, attribs) => attribs.class?.split(/\s+/).includes('anchor')
        ? { tagName, attribs, text: '§' }
        : { tagName, attribs },
      '*': (tagName, attributes) => {
        const attribs = { ...attributes }
        if (attribs.id) attribs.id = normalizeId(attribs.id)
        if (tagName === 'a') {
          if (attribs.name && !attribs.id) attribs.id = normalizeId(attribs.name)
          if (attribs.href) {
            attribs.href = resolve(attribs.href)
            if (!attribs.href.startsWith('#')) {
              attribs.target = '_blank'
              attribs.rel = 'noopener noreferrer'
            } else { delete attribs.target; delete attribs.rel }
          }
          // GitHub's heading permalink contains an SVG removed by the allowlist.
          if (attributes.class?.split(/\s+/).includes('anchor')) {
            attribs['aria-label'] = 'Link to this section'
          }
        }
        if (tagName === 'img') {
          if (attribs.src) attribs.src = resolve(attribs.src, true)
          attribs.alt = attribs.alt || attribs.title || 'README image'
          attribs.loading = 'lazy'
        }
        if (tagName === 'input' && attribs.type === 'checkbox') {
          attribs.disabled = ''
          attribs['aria-label'] = 'Task checkbox'
        }
        return { tagName, attribs }
      },
    },
    exclusiveFilter: frame => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  }).trim()
  const visibleContent = sanitizeHtml(clean, { allowedTags: ['img', 'input', 'hr'], allowedAttributes: {} }).trim()
  return visibleContent ? clean : ''
}
