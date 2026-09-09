import React from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ShareIcon from '@mui/icons-material/Share'
import EditIcon from '@mui/icons-material/Edit'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import { UserService } from '../services'
import VideoCards from '../components/cards/VideoCards'
import ImageCards from '../components/cards/ImageCards'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import EditImageModal from '../components/modal/EditImageModal'
import UserAvatar, { gradientFor } from '../components/user/UserAvatar'
import { dialogPaperSx, dialogTitleSx, inputSx, helperTextSx } from '../common/modalStyles'

const BIO_MAX = 280
const DISPLAY_NAME_MAX = 64

const StatBlock = ({ value, label, tone }) => (
  <Box>
    <Typography
      sx={{
        fontFamily: 'monospace',
        fontSize: 21,
        fontWeight: 700,
        lineHeight: 1.2,
        fontVariantNumeric: 'tabular-nums',
        color: tone || '#fff',
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
      }}
    >
      {label}
    </Typography>
  </Box>
)

const Profile = ({ authenticated }) => {
  const { username } = useParams()

  const [profile, setProfile] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [tab, setTab] = React.useState(0)
  const [videos, setVideos] = React.useState(null)
  const [images, setImages] = React.useState(null)
  const [alert, setAlert] = React.useState({ open: false })
  // ImageCards has no modal of its own (unlike VideoCards), so the viewer is
  // owned here, the same way ImageFeed owns it.
  const [modalImage, setModalImage] = React.useState(null)

  const [editOpen, setEditOpen] = React.useState(false)
  const [displayNameDraft, setDisplayNameDraft] = React.useState('')
  const [bioDraft, setBioDraft] = React.useState('')
  const [publicDraft, setPublicDraft] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const { data } = await UserService.getProfile(username)
      setProfile(data)
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true)
      else setAlert({ open: true, type: 'error', message: 'Could not load this profile.' })
    }
    setLoading(false)
  }, [username])

  React.useEffect(() => {
    load()
  }, [load])

  // Media is fetched per tab, on first visit only.
  React.useEffect(() => {
    if (!profile) return
    if (tab === 0 && videos === null) {
      UserService.getProfileVideos(username)
        .then((res) => setVideos(res.data.videos || []))
        .catch(() => setVideos([]))
    }
    if (tab === 1 && images === null) {
      UserService.getProfileImages(username)
        .then((res) => setImages(res.data.images || []))
        .catch(() => setImages([]))
    }
  }, [tab, profile, username, videos, images])

  const handleImageOpen = React.useCallback((image) => {
    setModalImage(image)
  }, [])

  const handleImageNext = React.useCallback(() => {
    setModalImage((cur) => {
      if (!cur || !images) return cur
      const i = images.findIndex((img) => img.image_id === cur.image_id)
      return i >= 0 && i < images.length - 1 ? images[i + 1] : cur
    })
  }, [images])

  const handleImagePrev = React.useCallback(() => {
    setModalImage((cur) => {
      if (!cur || !images) return cur
      const i = images.findIndex((img) => img.image_id === cur.image_id)
      return i > 0 ? images[i - 1] : cur
    })
  }, [images])

  const handleImageModalClose = (update) => {
    if (update && modalImage) {
      setImages((prev) =>
        (prev || []).map((img) =>
          img.image_id !== modalImage.image_id
            ? img
            : {
                ...img,
                info: {
                  ...img.info,
                  ...(update.title !== undefined && { title: update.title }),
                  ...(update.private !== undefined && { private: update.private }),
                },
                ...(update.game !== undefined && { game: update.game }),
                ...(update.created_at !== undefined && { created_at: update.created_at }),
              },
        ),
      )
    }
    setModalImage(null)
  }

  const openEdit = () => {
    setDisplayNameDraft(profile.display_name || '')
    setBioDraft(profile.bio || '')
    setPublicDraft(profile.profile_public !== false)
    setEditOpen(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await UserService.updateProfile({
        display_name: displayNameDraft,
        bio: bioDraft,
        profile_public: publicDraft,
      })
      setEditOpen(false)
      setAlert({ open: true, type: 'success', message: 'Profile updated.' })
      await load()
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data?.error || 'Could not save your profile.',
      })
    }
    setSaving(false)
  }

  const handleAvatarPicked = async (event) => {
    const file = event.target.files?.[0]
    // Reset immediately so picking the same file twice still fires a change event.
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      await UserService.uploadAvatar(file)
      setAlert({ open: true, type: 'success', message: 'Profile picture updated.' })
      await load()
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data?.error || 'Could not upload that image.',
      })
    }
    setUploading(false)
  }

  const removeAvatar = async () => {
    setUploading(true)
    try {
      await UserService.deleteAvatar()
      setAlert({ open: true, type: 'info', message: 'Profile picture removed.' })
      await load()
    } catch (err) {
      setAlert({ open: true, type: 'error', message: 'Could not remove your picture.' })
    }
    setUploading(false)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (notFound || !profile) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          py: 10,
          px: 3,
          // The route renders with mainPadding={0} so the profile banner can bleed
          // to the edges, which leaves this card to supply its own inset on all
          // four sides rather than just the horizontal ones.
          m: 3,
          border: '1px solid #FFFFFF14',
          borderRadius: '16px',
          background: '#00000040',
        }}
      >
        <PersonOffIcon sx={{ fontSize: 56, color: '#FFFFFF33' }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 20, color: 'white', mb: 0.5 }}>
            Profile not available
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#FFFFFF66' }}>
            This user does not exist, or their profile is not shared.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/" variant="outlined" sx={{ mt: 1 }}>
          Back to videos
        </Button>
      </Box>
    )
  }

  const { stats } = profile
  const isSelf = profile.is_self
  const [gFrom, gTo] = gradientFor(profile.username)
  const shareUrl = `${window.location.origin}/u/${profile.username}`
  const hasNoAvatar = !profile.has_avatar

  return (
    <Box sx={{ pb: 5 }}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <EditImageModal
        open={Boolean(modalImage)}
        onClose={handleImageModalClose}
        image={modalImage}
        alertHandler={setAlert}
        authenticated={authenticated}
        onNext={handleImageNext}
        onPrev={handleImagePrev}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleAvatarPicked}
        style={{ display: 'none' }}
      />

      {/* Banner. Tinted from the same per-user gradient as the fallback avatar so
          a profile with no uploaded art still looks deliberate. */}
      <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.7,
            background: `
              radial-gradient(120% 150% at 12% 0%, ${gFrom}CC 0%, transparent 55%),
              radial-gradient(90% 130% at 82% 20%, ${gTo}99 0%, transparent 60%),
              linear-gradient(105deg, #0A1929 0%, #14385C 45%, #1E4976 70%, #0A1929 100%)
            `,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,30,60,0.15) 0%, rgba(0,30,60,0.6) 55%, #001E3C 100%)',
          }}
        />
        {/* The theme gives every size="small" Button a -8px left margin, which
            would cancel this row's gap exactly. Reset it so the gap applies. */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 20,
            display: 'flex',
            gap: 1,
            '& .MuiButton-root': { ml: 0 },
          }}
        >
          <CopyToClipboard text={shareUrl}>
            <Button
              size="small"
              startIcon={<ShareIcon />}
              onClick={() => setAlert({ open: true, type: 'info', message: 'Profile link copied' })}
              sx={{
                bgcolor: 'rgba(10,25,41,0.78)',
                border: '1px solid #1E4976',
                color: '#fff',
                backdropFilter: 'blur(6px)',
                '&:hover': { bgcolor: '#132F4C' },
              }}
            >
              Share profile
            </Button>
          </CopyToClipboard>
          {profile.can_edit && (
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={openEdit}
              sx={{
                background: 'linear-gradient(90deg, #BC00E6, #FF3729)',
                color: '#fff',
                '&:hover': { background: 'linear-gradient(90deg, #CC10F6, #FF4739)' },
              }}
            >
              Edit profile
            </Button>
          )}
        </Box>
      </Box>

      {/* Identity */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 2.5 },
          px: 3,
          mt: '-52px',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <UserAvatar
            user={profile}
            size={104}
            radius="20px"
            sx={{ border: '3px solid #001E3C', boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}
          />
          {isSelf && (
            <Tooltip title={hasNoAvatar ? 'Add a profile picture' : 'Change profile picture'}>
              <IconButton
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 34,
                  height: 34,
                  bgcolor: '#132F4C',
                  border: '2px solid #001E3C',
                  color: '#66B2FF',
                  '&:hover': { bgcolor: '#173A5E' },
                }}
              >
                {uploading ? (
                  <CircularProgress size={16} />
                ) : (
                  <PhotoCameraIcon sx={{ fontSize: 17 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ minWidth: 0, pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography
              sx={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', textWrap: 'balance' }}
            >
              {profile.name}
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 14, color: '#66B2FF' }}>
              @{profile.username}
            </Typography>
            {profile.profile_public === false && (
              <Chip
                size="small"
                icon={<VisibilityOffIcon sx={{ fontSize: 14 }} />}
                label="Not shared"
                sx={{
                  height: 22,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  bgcolor: '#132F4C',
                  border: '1px solid #1E4976',
                  color: '#B2BAC2',
                }}
              />
            )}
          </Box>
          {profile.bio && (
            <Typography sx={{ mt: 0.9, color: '#B2BAC2', fontSize: 13.5, maxWidth: '62ch' }}>
              {profile.bio}
            </Typography>
          )}
          {profile.created_at && (
            <Typography sx={{ mt: 0.75, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Joined{' '}
              {new Date(profile.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Typography>
          )}
        </Box>
      </Box>

      {/* First-run prompt: only for your own avatar-less profile. */}
      {isSelf && hasNoAvatar && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mx: 3,
            mt: 2.5,
            p: '11px 14px',
            border: '1px solid #1E4976',
            borderLeft: '3px solid #3399FF',
            borderRadius: '8px',
            background: 'rgba(19,47,76,0.5)',
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontSize: 13, color: '#B2BAC2', flex: 1, minWidth: 200 }}>
            <b style={{ color: '#fff', fontWeight: 600 }}>Add a profile picture.</b> Right now your
            uploads show a lettered placeholder next to them.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            // Cancels the theme's -8px on small buttons, which would otherwise
            // eat most of this row's gap.
            sx={{ ml: 0 }}
          >
            Choose image
          </Button>
        </Box>
      )}

      {/* Stats */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3.25, px: 3, pt: 2.75 }}>
        <StatBlock value={stats.videos} label="Videos" />
        <StatBlock value={stats.images} label="Images" />
        <StatBlock value={stats.total_views.toLocaleString()} label="Total views" />
        <StatBlock value={stats.games} label="Games" />
        {profile.showing_private && stats.private_videos + stats.private_images > 0 && (
          <StatBlock
            value={stats.private_videos + stats.private_images}
            label="Private"
            tone="#FF6B6B"
          />
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ px: 3, mt: 2.5, borderBottom: '1px solid rgba(194,224,255,0.08)' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 0,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44, px: 0, mr: 3.25 },
          }}
        >
          <Tab
            icon={<VideoLibraryIcon sx={{ fontSize: 17 }} />}
            iconPosition="start"
            label={`Videos (${stats.videos})`}
          />
          <Tab
            icon={<PhotoLibraryIcon sx={{ fontSize: 17 }} />}
            iconPosition="start"
            label={`Images (${stats.images})`}
          />
        </Tabs>
      </Box>

      {/* Media — the existing feed components, filtered to this uploader. */}
      <Box sx={{ px: 3, pt: 2 }}>
        {tab === 0 &&
          (videos === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <VideoCards
              videos={videos}
              feedView={!authenticated}
              authenticated={authenticated}
              size={300}
              hideUploader
            />
          ))}
        {tab === 1 &&
          (images === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <ImageCards
              images={images}
              authenticated={authenticated}
              feedView={!authenticated}
              size={300}
              onImageOpen={handleImageOpen}
              hideUploader
            />
          ))}
      </Box>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>Edit profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <UserAvatar user={profile} size={64} radius="14px" />
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {profile.has_avatar ? 'Replace' : 'Upload'}
                </Button>
                {profile.has_avatar && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={removeAvatar}
                    disabled={uploading}
                  >
                    Remove
                  </Button>
                )}
              </Stack>
            </Box>

            <TextField
              label="Display name"
              placeholder={profile.username}
              value={displayNameDraft}
              onChange={(e) => setDisplayNameDraft(e.target.value.slice(0, DISPLAY_NAME_MAX))}
              fullWidth
              sx={inputSx}
              helperText={`Shown instead of @${profile.username}. Leave empty to use your username.`}
              FormHelperTextProps={{ sx: helperTextSx }}
            />

            <TextField
              label="Bio"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value.slice(0, BIO_MAX))}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              sx={inputSx}
              helperText={`${bioDraft.length} / ${BIO_MAX}`}
              FormHelperTextProps={{ sx: helperTextSx }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                border: '1px solid #1E4976',
                borderRadius: '8px',
              }}
            >
              <Switch checked={publicDraft} onChange={(e) => setPublicDraft(e.target.checked)} />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
                  Share my profile page
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#B2BAC2' }}>
                  {publicDraft
                    ? `Anyone with the link can see your public uploads at /u/${profile.username}.`
                    : 'Your profile page is hidden. Individual share links keep working.'}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} sx={{ color: '#B2BAC2' }}>
            Cancel
          </Button>
          <Button onClick={saveProfile} variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Profile
