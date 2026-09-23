// The content pages an administrator can reorder or hide under Settings → Sidebar.
// The account group (My Profile, File Manager, Settings) is deliberately not part
// of this list: whether those appear depends on who is signed in, not on taste.
//
// The order here is the default order. Each entry names the legacy show_* flag
// that used to hide it: installs configured before the ordered list existed
// still carry only those flags, and anything else that reads them keeps working
// because saving writes both.
export const SIDEBAR_PAGES = [
  { key: 'home', href: '/home', title: 'Home', legacyFlag: 'show_home' },
  { key: 'videos', href: '/videos', title: 'Videos', legacyFlag: 'show_videos' },
  { key: 'images', href: '/images', title: 'Images', legacyFlag: 'show_images' },
  { key: 'games', href: '/games', title: 'Games', legacyFlag: 'show_games' },
  { key: 'tags', href: '/tags', title: 'Tags', legacyFlag: 'show_tags' },
  { key: 'folders', href: '/folders', title: 'Folders', legacyFlag: 'show_folders' },
]

const KNOWN = new Map(SIDEBAR_PAGES.map((p) => [p.key, p]))

// Normalise ui_config into one ordered list with exactly one entry per known
// page: [{ key, enabled }]. With no saved sidebar_pages the order is the
// default and each page is enabled unless its legacy flag says otherwise, so an
// upgrade changes nothing visible. Unknown keys in a saved list are dropped. A
// page missing from a saved list was added in a later release: it is slotted in
// at its default position, enabled, rather than silently vanishing.
export function resolveSidebarPages(uiConfig) {
  const config = uiConfig || {}
  const saved = Array.isArray(config.sidebar_pages) ? config.sidebar_pages : null
  const result = []
  const seen = new Set()

  if (saved) {
    for (const entry of saved) {
      const key = typeof entry === 'string' ? entry : entry?.key
      if (!KNOWN.has(key) || seen.has(key)) continue
      seen.add(key)
      result.push({ key, enabled: typeof entry === 'object' ? entry.enabled !== false : true })
    }
  }

  SIDEBAR_PAGES.forEach((page, defaultIndex) => {
    if (seen.has(page.key)) return
    if (!saved) {
      result.push({ key: page.key, enabled: config[page.legacyFlag] !== false })
      return
    }
    const enabledCount = result.filter((p) => p.enabled).length
    result.splice(Math.min(defaultIndex, enabledCount), 0, { key: page.key, enabled: true })
  })

  return result
}

// The ui_config fields that persist an arrangement. The legacy flags are written
// alongside the list so the two can never disagree.
export function sidebarPagesPatch(pages) {
  const patch = { sidebar_pages: pages.map(({ key, enabled }) => ({ key, enabled: enabled !== false })) }
  for (const page of SIDEBAR_PAGES) {
    const entry = pages.find((p) => p.key === page.key)
    patch[page.legacyFlag] = entry ? entry.enabled !== false : true
  }
  return patch
}

// Where "/" should take a visitor: the first page still shown in the sidebar.
// Undefined until the config has been loaded at least once, and the Videos page
// when every page has been hidden -- never "/" itself, which would loop back
// here.
export function landingHref(uiConfig) {
  if (!uiConfig) return undefined
  const first = resolveSidebarPages(uiConfig).find((p) => p.enabled)
  return first ? KNOWN.get(first.key).href : '/videos'
}
