// 화면(UI) 언어 목록. 의존성이 없는 파일이라 settings.ts와 i18n.ts가 서로 순환 import 하지 않고 함께 쓴다.
export type Locale = 'ko' | 'en' | 'ja' | 'zh' | 'de' | 'fr' | 'es' | 'eo'

/** name은 그 언어 자신의 이름(어느 UI 언어에서도 같게 보인다 — 못 읽는 언어에서도 자기 언어를 찾을 수 있게). */
export const LOCALES: { code: Locale; name: string }[] = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'eo', name: 'Esperanto' },
]

export const DEFAULT_LOCALE: Locale = 'ko'

export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.code === v)
