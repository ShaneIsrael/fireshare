import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ConfigService } from '../../services'
import { getSetting, setSetting } from '../../common/utils'
import { landingHref } from '../../common/sidebarPages'

// "/" is a redirect, not a page: it opens whichever content page the
// administrator put at the top of the sidebar (Settings → Sidebar), carrying
// the query string along. Every content page, Videos included, has a path of
// its own, so a link to one is never routed through this decision.
//
// The decision is made from the cached ui_config so a returning visitor is not
// held up by a request. Only a browser that has never loaded the app waits for
// the config, since guessing there would send it to the wrong page.
export default function LandingRoute() {
  const location = useLocation()
  const [target, setTarget] = React.useState(() => landingHref(getSetting('ui_config')))

  React.useEffect(() => {
    if (target !== undefined) return
    let cancelled = false
    ConfigService.getConfig()
      .then((res) => {
        if (cancelled) return
        setSetting('ui_config', res.data)
        setTarget(landingHref(res.data))
      })
      .catch(() => {
        if (!cancelled) setTarget('/videos')
      })
    return () => {
      cancelled = true
    }
  }, [target])

  if (target === undefined) return null
  return <Navigate to={`${target}${location.search}`} replace />
}
