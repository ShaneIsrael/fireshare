import React from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import KeyIcon from '@mui/icons-material/Key'
import LinkIcon from '@mui/icons-material/Link'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import { UserService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import UserAvatar from '../user/UserAvatar'
import { dialogPaperSx, dialogTitleSx, inputSx, helperTextSx } from '../../common/modalStyles'

const PASSWORD_MIN = 8

/**
 * Setup links come back relative when DOMAIN is not configured on the server.
 * An admin has to paste this to someone, so make it absolute using the origin
 * they are already browsing.
 */
const absoluteUrl = (url) => (url && url.startsWith('/') ? `${window.location.origin}${url}` : url)

const STATUS_STYLES = {
  active: { label: 'Active', color: '#1DB45A', bg: 'rgba(29,180,90,0.14)', border: 'rgba(29,180,90,0.36)' },
  invited: { label: 'Invited', color: '#FFDC48', bg: 'rgba(255,220,72,0.14)', border: 'rgba(255,220,72,0.36)' },
  disabled: { label: 'Disabled', color: '#FF6B6B', bg: 'rgba(255,107,107,0.14)', border: 'rgba(255,107,107,0.36)' },
}

const StatusPill = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        px: 0.9,
        py: 0.3,
        borderRadius: '4px',
        color: s.color,
        bgcolor: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </Box>
  )
}

/** Copyable one-time setup link, shown after creating a user or reissuing an invite. */
const InviteLinkBlock = ({ url, onCopied }) => (
  <Box
    sx={{
      p: 1.5,
      border: '1px solid #1E4976',
      borderLeft: '3px solid #FFDC48',
      borderRadius: '8px',
      bgcolor: 'rgba(19,47,76,0.5)',
    }}
  >
    <Typography sx={{ fontSize: 12.5, color: '#B2BAC2', mb: 1 }}>
      Send this link to the new user. It works once and expires in 7 days. Fireshare cannot show it
      again — reissue a new link if it gets lost.
    </Typography>
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        value={url}
        size="small"
        fullWidth
        InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
        sx={inputSx}
        onFocus={(e) => e.target.select()}
      />
      <CopyToClipboard text={url}>
        <Button size="small" variant="contained" startIcon={<ContentCopyIcon />} onClick={onCopied}>
          Copy
        </Button>
      </CopyToClipboard>
    </Stack>
  </Box>
)

const UserManagement = () => {
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState([])
  const [permissionList, setPermissionList] = React.useState([])
  const [presets, setPresets] = React.useState([])
  const [alert, setAlert] = React.useState({ open: false })

  const [menuAnchor, setMenuAnchor] = React.useState(null)
  const [menuUser, setMenuUser] = React.useState(null)

  const [addOpen, setAddOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState(null)
  const [passwordUser, setPasswordUser] = React.useState(null)
  const [deleteUser, setDeleteUser] = React.useState(null)
  const [inviteUrl, setInviteUrl] = React.useState(null)
  const [busy, setBusy] = React.useState(false)

  // Add-user form
  const [form, setForm] = React.useState({
    username: '',
    displayName: '',
    admin: false,
    permissions: [],
    mode: 'invite',
    password: '',
    requireChange: true,
  })
  const [newPassword, setNewPassword] = React.useState('')
  const [requireChange, setRequireChange] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await UserService.listUsers()
      setUsers(data.users || [])
      setPermissionList(data.permissions || [])
      setPresets(data.presets || [])
    } catch (err) {
      setAlert({ open: true, type: 'error', message: 'Could not load the user list.' })
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const fail = (err, fallback) =>
    setAlert({ open: true, type: 'error', message: err.response?.data?.error || fallback })

  const enabledAdmins = users.filter((u) => u.admin && !u.disabled).length

  /** Why an action is unavailable, or null when it is allowed. */
  const blockedReason = (user, action) => {
    if (user.is_self && ['disable', 'delete', 'demote'].includes(action)) {
      return 'You cannot do this to your own account.'
    }
    if (user.env_managed && ['delete', 'demote'].includes(action)) {
      return 'This account is managed by ADMIN_USERNAME / ADMIN_PASSWORD and would be restored on the next restart.'
    }
    if (user.admin && enabledAdmins <= 1 && ['disable', 'delete', 'demote'].includes(action)) {
      return 'This is the only administrator. Promote someone else first.'
    }
    if (user.ldap && ['password', 'invite'].includes(action)) {
      return 'Passwords for directory accounts are managed by LDAP.'
    }
    return null
  }

  const openAdd = () => {
    const contributor = presets.find((p) => p.key === 'contributor')
    setForm({
      username: '',
      displayName: '',
      admin: false,
      permissions: contributor ? [...contributor.permissions] : [],
      mode: 'invite',
      password: '',
      requireChange: true,
    })
    setInviteUrl(null)
    setAddOpen(true)
  }

  const activePreset = React.useMemo(() => {
    const set = [...form.permissions].sort().join(',')
    return presets.find((p) => [...p.permissions].sort().join(',') === set)?.key || null
  }, [form.permissions, presets])

  const togglePermission = (key) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }))

  const createUser = async () => {
    setBusy(true)
    try {
      const payload = {
        username: form.username.trim(),
        display_name: form.displayName.trim() || null,
        admin: form.admin,
        permissions: form.admin ? [] : form.permissions,
      }
      if (form.mode === 'invite') payload.invite = true
      else {
        payload.password = form.password
        payload.require_password_change = form.requireChange
      }
      const { data } = await UserService.createUser(payload)
      await load()
      if (data.invite_url) {
        setInviteUrl(absoluteUrl(data.invite_url))
        setAlert({ open: true, type: 'success', message: `${payload.username} created. Copy their setup link.` })
      } else {
        setAddOpen(false)
        setAlert({ open: true, type: 'success', message: `${payload.username} created.` })
      }
    } catch (err) {
      fail(err, 'Could not create that user.')
    }
    setBusy(false)
  }

  const saveEdit = async () => {
    setBusy(true)
    try {
      await UserService.updateUser(editUser.id, {
        admin: editUser.admin,
        permissions: editUser.admin ? [] : editUser.permissions,
        display_name: editUser.display_name,
      })
      setEditUser(null)
      await load()
      setAlert({ open: true, type: 'success', message: 'Access updated.' })
    } catch (err) {
      fail(err, 'Could not update that user.')
    }
    setBusy(false)
  }

  const setDisabled = async (user, disabled) => {
    try {
      await UserService.updateUser(user.id, { disabled })
      await load()
      setAlert({
        open: true,
        type: disabled ? 'warning' : 'success',
        message: disabled
          ? `${user.username} is disabled and has been signed out.`
          : `${user.username} can sign in again.`,
      })
    } catch (err) {
      fail(err, 'Could not change that account.')
    }
  }

  const submitPassword = async () => {
    setBusy(true)
    try {
      await UserService.setUserPassword(passwordUser.id, newPassword, requireChange)
      setPasswordUser(null)
      setNewPassword('')
      await load()
      setAlert({ open: true, type: 'success', message: 'Password set.' })
    } catch (err) {
      fail(err, 'Could not set that password.')
    }
    setBusy(false)
  }

  const reissueInvite = async (user) => {
    try {
      const { data } = await UserService.createInvite(user.id)
      await load()
      setInviteUrl(absoluteUrl(data.invite_url))
      setAddOpen(true) // reuse the dialog purely to surface the link
      setForm((f) => ({ ...f, username: user.username }))
    } catch (err) {
      fail(err, 'Could not create a setup link.')
    }
  }

  const clearMfa = async (user) => {
    try {
      await UserService.disableUserMfa(user.id)
      await load()
      setAlert({ open: true, type: 'success', message: `Two-factor cleared for ${user.username}.` })
    } catch (err) {
      fail(err, 'Could not clear two-factor.')
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      const { data } = await UserService.deleteUser(deleteUser.id)
      const n = data.unattributed_media || 0
      setDeleteUser(null)
      await load()
      setAlert({
        open: true,
        type: 'success',
        message: n
          ? `Account deleted. ${n} item${n === 1 ? '' : 's'} kept in the library without an uploader.`
          : 'Account deleted.',
      })
    } catch (err) {
      fail(err, 'Could not delete that account.')
    }
    setBusy(false)
  }

  const closeMenu = () => {
    setMenuAnchor(null)
    setMenuUser(null)
  }

  const MenuAction = ({ action, icon, label, onClick, danger }) => {
    const reason = menuUser ? blockedReason(menuUser, action) : null
    const item = (
      <MenuItem
        disabled={Boolean(reason)}
        onClick={() => {
          closeMenu()
          onClick()
        }}
        sx={danger ? { color: '#FF6B6B' } : undefined}
      >
        <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{icon}</ListItemIcon>
        {label}
      </MenuItem>
    )
    // A disabled MenuItem swallows pointer events, so the tooltip needs a wrapper.
    return reason ? (
      <Tooltip title={reason} placement="left">
        <Box>{item}</Box>
      </Tooltip>
    ) : (
      item
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ pt: 1 }}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Users</Typography>
          <Typography sx={{ fontSize: 12.5, color: '#B2BAC2' }}>
            {users.length} account{users.length === 1 ? '' : 's'} · {enabledAdmins} administrator
            {enabledAdmins === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={openAdd}
          sx={{ ml: 'auto' }}
        >
          Add User
        </Button>
      </Stack>

      <Box sx={{ overflowX: 'auto', border: '1px solid #1E4976', borderRadius: '10px' }}>
        <Table size="small" sx={{ minWidth: 680 }}>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Access</TableCell>
              <TableCell align="center">2FA</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <UserAvatar user={u} size={28} radius="50%" />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#fff' }}>
                        {u.name}
                        {u.is_self && (
                          <Box component="span" sx={{ color: '#66B2FF', fontWeight: 500 }}>
                            {' '}
                            (you)
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: 11.5, color: '#B2BAC2' }}>
                        @{u.username}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12.5 }}>{u.ldap ? 'LDAP' : 'Local'}</Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {u.admin && <ShieldOutlinedIcon sx={{ fontSize: 15, color: '#FFDC48' }} />}
                    <Typography sx={{ fontSize: 12.5, color: u.admin ? '#FFDC48' : '#B2BAC2' }}>
                      {u.permissions_label}
                    </Typography>
                  </Stack>
                  {u.env_managed && (
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      managed by environment
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Typography sx={{ fontSize: 12, color: u.mfa_enabled ? '#1DB45A' : 'rgba(255,255,255,0.35)' }}>
                    {u.ldap ? '—' : u.mfa_enabled ? 'On' : 'Off'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusPill status={u.status} />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      setMenuAnchor(e.currentTarget)
                      setMenuUser(u)
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuAction
          action="edit"
          icon={<TuneIcon fontSize="small" />}
          label="Change access"
          onClick={() => setEditUser({ ...menuUser })}
        />
        <MenuAction
          action="password"
          icon={<KeyIcon fontSize="small" />}
          label="Set password"
          onClick={() => {
            setPasswordUser(menuUser)
            setNewPassword('')
            setRequireChange(true)
          }}
        />
        <MenuAction
          action="invite"
          icon={<LinkIcon fontSize="small" />}
          label="Create setup link"
          onClick={() => reissueInvite(menuUser)}
        />
        {menuUser?.mfa_enabled && (
          <MenuAction
            action="mfa"
            icon={<ShieldOutlinedIcon fontSize="small" />}
            label="Clear two-factor"
            onClick={() => clearMfa(menuUser)}
          />
        )}
        <Divider />
        {menuUser?.disabled ? (
          <MenuAction
            action="enable"
            icon={<CheckCircleIcon fontSize="small" />}
            label="Enable account"
            onClick={() => setDisabled(menuUser, false)}
          />
        ) : (
          <MenuAction
            action="disable"
            icon={<BlockIcon fontSize="small" />}
            label="Disable account"
            onClick={() => setDisabled(menuUser, true)}
          />
        )}
        <MenuAction
          action="delete"
          icon={<DeleteOutlineIcon fontSize="small" />}
          label="Delete account"
          danger
          onClick={() => setDeleteUser(menuUser)}
        />
      </Menu>

      {/* ---------- Add user ---------- */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>{inviteUrl ? 'Setup link' : 'Add user'}</DialogTitle>
        <DialogContent>
          {inviteUrl ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <InviteLinkBlock
                url={inviteUrl}
                onCopied={() => setAlert({ open: true, type: 'info', message: 'Setup link copied' })}
              />
            </Stack>
          ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoFocus
                fullWidth
                sx={inputSx}
                helperText="Letters, numbers, dots, dashes, and underscores. This appears in their profile URL."
                FormHelperTextProps={{ sx: helperTextSx }}
              />
              <TextField
                label="Display name (optional)"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                fullWidth
                sx={inputSx}
              />

              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#B2BAC2', mb: 1 }}>
                  ACCESS
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={form.admin ? 'admin' : activePreset || 'custom'}
                  onChange={(_, v) => {
                    if (!v) return
                    if (v === 'admin') return setForm((f) => ({ ...f, admin: true }))
                    const preset = presets.find((p) => p.key === v)
                    setForm((f) => ({
                      ...f,
                      admin: false,
                      permissions: preset ? [...preset.permissions] : f.permissions,
                    }))
                  }}
                  sx={{ flexWrap: 'wrap', mb: 1.5 }}
                >
                  {presets.map((p) => (
                    <ToggleButton key={p.key} value={p.key}>
                      {p.label}
                    </ToggleButton>
                  ))}
                  <ToggleButton value="admin">Administrator</ToggleButton>
                  {!form.admin && !activePreset && <ToggleButton value="custom">Custom</ToggleButton>}
                </ToggleButtonGroup>

                {form.admin ? (
                  <Alert severity="warning" sx={{ fontSize: 12.5 }}>
                    Administrators can do everything, including changing server settings and managing
                    other users.
                  </Alert>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      border: '1px solid #1E4976',
                      borderRadius: '8px',
                      p: 1,
                    }}
                  >
                    {permissionList.map((p) => (
                      <FormControlLabel
                        key={p.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                          />
                        }
                        label={<Typography sx={{ fontSize: 12.5 }}>{p.label}</Typography>}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#B2BAC2', mb: 1 }}>
                  PASSWORD
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={form.mode}
                  onChange={(_, v) => v && setForm((f) => ({ ...f, mode: v }))}
                  sx={{ mb: 1.5 }}
                >
                  <ToggleButton value="invite">Send a setup link</ToggleButton>
                  <ToggleButton value="password">Set one now</ToggleButton>
                </ToggleButtonGroup>

                {form.mode === 'invite' ? (
                  <Typography sx={{ fontSize: 12.5, color: '#B2BAC2' }}>
                    Fireshare generates a one-time link for you to pass on. You never see their
                    password.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <TextField
                      type="password"
                      label="Initial password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      fullWidth
                      sx={inputSx}
                      helperText={`At least ${PASSWORD_MIN} characters.`}
                      FormHelperTextProps={{ sx: helperTextSx }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.requireChange}
                          onChange={(e) => setForm((f) => ({ ...f, requireChange: e.target.checked }))}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: 12.5 }}>
                          Make them choose a new password at first sign-in
                        </Typography>
                      }
                    />
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {inviteUrl ? (
            <Button
              onClick={() => {
                setAddOpen(false)
                setInviteUrl(null)
              }}
              variant="contained"
            >
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setAddOpen(false)} sx={{ color: '#B2BAC2' }}>
                Cancel
              </Button>
              <Button
                onClick={createUser}
                variant="contained"
                disabled={
                  busy ||
                  !form.username.trim() ||
                  (form.mode === 'password' && form.password.length < PASSWORD_MIN)
                }
              >
                {busy ? 'Creating…' : 'Create user'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ---------- Change access ---------- */}
      <Dialog
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Access for @{editUser?.username}</DialogTitle>
        <DialogContent>
          {editUser && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editUser.admin}
                    disabled={Boolean(blockedReason(editUser, editUser.admin ? 'demote' : 'promote'))}
                    onChange={(e) => setEditUser((u) => ({ ...u, admin: e.target.checked }))}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5 }}>Administrator</Typography>}
              />
              {blockedReason(editUser, 'demote') && editUser.admin && (
                <Alert severity="info" sx={{ fontSize: 12.5 }}>
                  {blockedReason(editUser, 'demote')}
                </Alert>
              )}

              {!editUser.admin && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    border: '1px solid #1E4976',
                    borderRadius: '8px',
                    p: 1,
                  }}
                >
                  {permissionList.map((p) => (
                    <FormControlLabel
                      key={p.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={editUser.permissions.includes(p.key)}
                          onChange={() =>
                            setEditUser((u) => ({
                              ...u,
                              permissions: u.permissions.includes(p.key)
                                ? u.permissions.filter((x) => x !== p.key)
                                : [...u.permissions, p.key],
                            }))
                          }
                        />
                      }
                      label={<Typography sx={{ fontSize: 12.5 }}>{p.label}</Typography>}
                    />
                  ))}
                </Box>
              )}

              {editUser.ldap && (
                <Alert severity="info" sx={{ fontSize: 12.5 }}>
                  Administrator status for directory accounts is re-derived from LDAP group
                  membership on every sign-in, so a change here may not stick.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)} sx={{ color: '#B2BAC2' }}>
            Cancel
          </Button>
          <Button onClick={saveEdit} variant="contained" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Set password ---------- */}
      <Dialog
        open={Boolean(passwordUser)}
        onClose={() => setPasswordUser(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Set password for @{passwordUser?.username}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="password"
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              fullWidth
              sx={inputSx}
              helperText={`At least ${PASSWORD_MIN} characters.`}
              FormHelperTextProps={{ sx: helperTextSx }}
            />
            <FormControlLabel
              control={
                <Switch checked={requireChange} onChange={(e) => setRequireChange(e.target.checked)} />
              }
              label={
                <Typography sx={{ fontSize: 12.5 }}>
                  Make them choose a new one at next sign-in
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordUser(null)} sx={{ color: '#B2BAC2' }}>
            Cancel
          </Button>
          <Button
            onClick={submitPassword}
            variant="contained"
            disabled={busy || newPassword.length < PASSWORD_MIN}
          >
            {busy ? 'Saving…' : 'Set password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Delete ---------- */}
      <Dialog
        open={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Delete @{deleteUser?.username}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, color: '#B2BAC2' }}>
            Their account is removed and any active session ends immediately.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2, fontSize: 12.5 }}>
            Their uploads stay in the library. The videos and images they added simply stop showing
            an uploader.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUser(null)} sx={{ color: '#B2BAC2' }}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={busy}>
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserManagement
