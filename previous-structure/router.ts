export interface Route {
  /** path segments, e.g. ['elections', 'abc'] for '#/elections/abc' */
  parts: string[]
  query: URLSearchParams
  /** normalised path without the leading '#' and query string, e.g. '/elections/abc' */
  path: string
}

export function parseRoute(): Route {
  const hash = location.hash.replace(/^#/, '') || '/'
  const [path = '/', qs = ''] = hash.split('?')
  return {
    parts: path.split('/').filter(Boolean),
    query: new URLSearchParams(qs),
    path,
  }
}

export function nav(path: string): void {
  location.hash = '#' + path
}

export function startRouter(render: () => void): void {
  window.addEventListener('hashchange', render)
  render()
}
