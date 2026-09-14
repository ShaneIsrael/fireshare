import React, { useEffect, useMemo, useState } from 'react'
import Select from 'react-select'
import { folderSelectTheme as selectFolderTheme } from '../../common/reactSelectThemes'
import { uploaderOptionLabel } from '../../common/utils'
import Api from '../../services/Api'

const UNATTRIBUTED = { value: null, label: 'No uploader (unattributed)' }

/**
 * Loads the accounts media can be attributed to.
 *
 * `forbidden` is the useful part outside the File Manager: /api/admin/uploaders
 * is admin-only, so a non-admin gets a 403 and the caller can drop the whole
 * field rather than offering a control whose save would be rejected. Attribution
 * stays an administrator's job — a contributor handing their video to someone
 * else (or claiming someone else's) is a permission change, not a detail edit.
 */
export const useUploaderCandidates = (enabled = true) => {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    // The edit modals mount with every card in a feed, so the request has to
    // wait until one is actually opened — otherwise a dashboard of 50 videos
    // fires 50 admin calls, and every anonymous visitor fires one too.
    if (!enabled) return undefined
    let cancelled = false
    setStatus('loading')
    Api()
      .get('/api/admin/uploaders')
      .then((res) => {
        if (cancelled) return
        setUsers(res.data.users || [])
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus(err.response?.status === 403 ? 'forbidden' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  // Nothing is offered until the list actually arrives: treating "not yet
  // loaded" as permitted would flash a field that a non-admin may not have.
  return { users, loading: status === 'loading', forbidden: status !== 'ready' }
}

/**
 * The select itself, over an already-loaded candidate list.
 *
 * `value` is a username, or null for unattributed — the same shape
 * /api/admin/files/bulk-set-uploader expects, where an explicit null ("clear
 * this") is meaningfully different from the key being absent.
 */
export const UploaderSelect = ({ users, value, onChange, disabled = false, menuPortalTarget = document.body }) => {
  const options = useMemo(() => {
    const opts = [UNATTRIBUTED, ...users.map((u) => ({ value: u.username, label: uploaderOptionLabel(u) }))]
    // The candidate list holds only enabled accounts, but media can still be
    // owned by a disabled one. Keep that username as its own option so the field
    // reports the real owner instead of silently reading as unattributed.
    if (value && !opts.some((o) => o.value === value)) {
      opts.push({ value, label: `@${value} (disabled)` })
    }
    return opts
  }, [users, value])

  return (
    <Select
      options={options}
      value={options.find((o) => o.value === value) || UNATTRIBUTED}
      onChange={(opt) => onChange(opt ? opt.value : null)}
      isDisabled={disabled}
      styles={selectFolderTheme}
      menuPortalTarget={menuPortalTarget}
      placeholder="Choose an account..."
    />
  )
}

/**
 * Self-loading picker, for callers that are already behind an admin gate and so
 * have no use for the `forbidden` case (the File Manager bulk dialogs).
 */
const UploaderPicker = ({ value, onChange, disabled = false, menuPortalTarget = document.body }) => {
  const { users } = useUploaderCandidates()
  return (
    <UploaderSelect
      users={users}
      value={value}
      onChange={onChange}
      disabled={disabled}
      menuPortalTarget={menuPortalTarget}
    />
  )
}

export default UploaderPicker
