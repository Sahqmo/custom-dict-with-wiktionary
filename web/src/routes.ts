// 화면 주소(해시 라우팅) 만들기. 여러 화면이 공유하므로 App.tsx 밖에 둔다.
export const hrefEntry = (lang: string, word: string) => `#/entry/${lang}/${encodeURIComponent(word)}`
export const hrefSearch = (q: string, lang: string) => `#/search/${new URLSearchParams({ q, ...(lang && { lang }) })}`
export const hrefReverse = (q: string) => `#/reverse/${new URLSearchParams({ q })}`
export const HREF_LIBRARY = '#/library'
export const hrefSwadesh = (lang?: string) => (lang ? `#/swadesh/${lang}` : '#/swadesh')
