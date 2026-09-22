import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ConfigService } from '../../services'
import { getSetting, setSetting } from '../../common/utils'
import { landingHref } from '../../common/sidebarPages'

// "/" opens whichever content page the administrator put at the top of the
// sidebar (Settings → Sidebar). The Videos page lives at "/" itself, so when it
// is on top the children render here directly and every existing link keeps
// working; any other page is a redirect that carries the query string along.
//
// The decision is made from the cached ui_config so a returning visitor is not
// held up by a request. Only a browser that has never loaded the app waits for
// the config, since guessing there would send it to the wrong page.
export default function LandingRoute({ children }) {
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
        if (!cancelled) setTarget('/')
      })
    return () => {
      cancelled = true
    }
  }, [target])

  if (target === undefined) return null
  if (target === '/') return children
  return <Navigate to={`${target}${location.search}`} replace />
}
