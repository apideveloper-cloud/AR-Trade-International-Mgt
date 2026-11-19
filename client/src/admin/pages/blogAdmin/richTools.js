/** Rich-text toolbar buttons: [label, tooltip, run(cmd), extra class]. `cmd(name, value)` wraps document.execCommand. */
export const BLOG_TOOLS = [
  ['B', 'Bold', c => c('bold'), 'blg-bold'], ['I', 'Italic', c => c('italic'), 'blg-italic'],
  ['H2', 'Heading', c => c('formatBlock', 'h2')], ['H3', 'Sub-heading', c => c('formatBlock', 'h3')], ['¶', 'Paragraph', c => c('formatBlock', 'p')],
  ['• List', 'Bullet list', c => c('insertUnorderedList')], ['1. List', 'Numbered list', c => c('insertOrderedList')],
  ['❝', 'Quote', c => c('formatBlock', 'blockquote')], ['—', 'Divider', c => c('insertHorizontalRule')], ['Clear', 'Clear formatting', c => c('removeFormat')]
];

/** The static-page editor uses the same buttons minus quote and divider. */
export const PAGE_TOOLS = BLOG_TOOLS.filter(t => t[0] !== '❝' && t[0] !== '—');
