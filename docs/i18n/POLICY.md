# Localization Policy

## Product scope

The public openXYOS showcase and project documentation may publish additional
language editions. The signed-in product currently supports only:

- `zh-CN` (Simplified Chinese)
- `en` (English)

A language must not be shown as a selectable workspace language until its
navigation, forms, validation, empty states, permission feedback, notifications,
and core task flows have been reviewed.

## Source of truth

- UI text is selected in React through the locale provider; do not mutate DOM
  text after rendering.
- Use a stable message key or a paired `t(zh, en)` call. Do not branch
  business logic on translated text.
- API clients send `Accept-Language`; backend decisions use stable error
  codes and may return a localized message.
- User-created content is not automatically translated when the UI changes
  language. Translation is an explicit user action or a separate localized
  field.

## Language precedence

1. Explicit `?lang=zh-CN` or `?lang=en` link
2. Saved browser preference (`openxyos.locale`)
3. Browser language
4. `zh-CN` fallback

The selected locale is written to the URL, allowing a demo link to be shared
and tested.

## Public site and GitHub

- Keep the Chinese README and [English README](../../README.en.md) aligned.
- The overview/install guide is published in Simplified Chinese, Traditional
  Chinese, English, Japanese, and Korean. See [the language index](README.md).
- Public language pages must use their own URL and reciprocal `hreflang`
  links when they are served as crawlable pages.
- Claims about capabilities, licensing, trademark ownership, security and
  production readiness require human review in every published language.

## Pull request checklist

- [ ] New visible system text has Chinese and English equivalents.
- [ ] English was checked at narrow viewport widths; no important text is
      clipped.
- [ ] Dates, numbers, and percentages use `Intl`, not fixed Chinese formats.
- [ ] Error handling uses an error code or localized backend message, never a
      comparison against Chinese prose.
- [ ] User content, secrets, and proprietary material were not added to a
      translation resource or public documentation.

## Release gate

Before enabling a new locale in the product, run the typecheck and build, then
verify sign-in, navigation, workspace, module loading, one create/edit flow,
one permission failure, one API failure, and language persistence after a full
refresh in both Chinese and English.
