import React from 'react'
import {
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import { VideoService, GameService, TagService } from '../../services'
import { getSetting } from '../../common/utils'
import { dialogPaperSx, dialogTitleSx, inputSx, labelSx, checkboxSx, helperTextSx } from '../../common/modalStyles'
import logo from '../../assets/logo.png'

const Input = styled('input')({
  display: 'none',
})

const numberFormat = new Intl.NumberFormat('en-US')

const logoPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`

const borderSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const maskCss = {
  maskImage: `url(${logo})`,
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskImage: `url(${logo})`,
  WebkitMaskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
}

function LogoProgress({ progress, size = 44 }) {
  const isProcessing = progress >= 1
  const fillPct = isProcessing ? 100 : progress * 100
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* White base — full logo shape */}
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'white', ...maskCss }} />
      {/* Colored fill — clips from top, grows upward */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #FF6B00, #FF2E80, #BC00E6)',
          clipPath: `inset(${100 - fillPct}% 0 0 0)`,
          transition: isProcessing ? 'none' : 'clip-path 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)',
          animation: isProcessing ? `${logoPulse} 1.5s ease-in-out infinite` : 'none',
          ...maskCss,
        }}
      />
    </Box>
  )
}

const UploadCard = React.forwardRef(function UploadCard(
  { authenticated, handleAlert, mini, onUploadComplete, onProgress, dropOnly = false },
  ref,
) {
  const [selectedFile, setSelectedFile] = React.useState()
  const [isSelected, setIsSelected] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [uploadRate, setUploadRate] = React.useState()
  const uiConfig = getSetting('ui_config')
  const lastProgressUpdate = React.useRef(0)

  // Pre-upload metadata dialog
  const [pendingFile, setPendingFile] = React.useState(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [allGames, setAllGames] = React.useState([])
  const [allTags, setAllTags] = React.useState([])
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [selectedTags, setSelectedTags] = React.useState([])
  const [tagInput, setTagInput] = React.useState('')
  const [gameOptions, setGameOptions] = React.useState([])
  const [gameSearchLoading, setGameSearchLoading] = React.useState(false)
  const [gameCreating, setGameCreating] = React.useState(false)
  const [gameInput, setGameInput] = React.useState('')
  const [uploadToGameFolder, setUploadToGameFolder] = React.useState(false)
  const [titleInput, setTitleInput] = React.useState('')
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState('')
  const [thumbnail, setThumbnail] = React.useState(null)
  const [thumbnailReady, setThumbnailReady] = React.useState(false)
  const [availableFolders, setAvailableFolders] = React.useState([])
  const [selectedFolder, setSelectedFolder] = React.useState('')
  // Stored metadata to attach on next upload
  const pendingMetadata = React.useRef({ tag_ids: null, game_id: null, folder: null })
  const imageThumbnailUrlRef = React.useRef(null)

  React.useImperativeHandle(ref, () => ({
    openFile(file) {
      setProgress(0)
      lastProgressUpdate.current = 0
      openMetadataDialog(file)
    },
  }))

  const extractThumbnail = (file) => {
    setThumbnail(null)
    setThumbnailReady(false)
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.src = url
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(video.duration * 0.1, 5)
    })
    video.addEventListener('seeked', () => {
      requestAnimationFrame(() => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d').drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        URL.revokeObjectURL(url)
        setThumbnail(dataUrl)
        setThumbnailReady(true)
      })
    })
    video.addEventListener('error', () => {
      setThumbnailReady(true)
      URL.revokeObjectURL(url)
    })
    video.load()
  }

  const openMetadataDialog = (file) => {
    setPendingFile(file)
    setSelectedGame(null)
    setSelectedTags([])
    setTagInput('')
    setGameInput('')
    setGameOptions([])
    setUploadToGameFolder(false)
    setTitleInput('')
    setEditingTitle(false)
    setTitleDraft('')

    extractThumbnail(file)
    const foldersFetch = authenticated
      ? VideoService.getUploadFolders()
      : uiConfig?.allow_public_folder_selection
        ? VideoService.getPublicUploadFolders()
        : Promise.resolve({ data: { folders: [], default_folder: '' } })
    Promise.all([GameService.getGames(), TagService.getTags(), foldersFetch])
      .then(([gRes, tRes, fRes]) => {
        const games = gRes.data || []
        setAllGames(games)
        setGameOptions(games.map((g) => ({ ...g, _source: 'db' })))
        setAllTags(tRes.data || [])
        const folders = fRes.data?.folders || []
        const defaultFolder = fRes.data?.default_folder || ''
        setAvailableFolders(folders)
        setSelectedFolder(folders.includes(defaultFolder) ? defaultFolder : folders[0] || '')
      })
      .catch(() => {
        setAllGames([])
        setGameOptions([])
        setAllTags([])
        setAvailableFolders([])
        setSelectedFolder('')
      })
    setDialogOpen(true)
  }

  const parseTagInput = (raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const handleDialogConfirm = async () => {
    // Flush any pending typed input (user didn't press Enter or comma)
    let tagsToProcess = [...selectedTags]
    if (tagInput.trim()) {
      parseTagInput(tagInput).forEach((p) => {
        const existing = allTags.find((t) => t.name.toLowerCase() === p.toLowerCase())
        if (!tagsToProcess.find((t) => t.name.toLowerCase() === p.toLowerCase())) {
          tagsToProcess.push(existing || { name: p })
        }
      })
      setTagInput('')
    }
    // Create any new (freeSolo) tags that don't have an id yet
    const resolvedTags = await Promise.all(
      tagsToProcess.map(async (t) => {
        if (t.id) return t
        const res = await TagService.createTag({ name: t.name })
        return res.data
      }),
    )
    pendingMetadata.current = {
      tag_ids: resolvedTags.length ? resolvedTags.map((t) => t.id).join(',') : null,
      game_id: selectedGame ? selectedGame.id : null,
      folder: (uploadToGameFolder && selectedGame ? selectedGame.name : selectedFolder) || null,
      title: titleInput.trim() || null,
    }
    setDialogOpen(false)
    setSelectedFile(pendingFile)
    setIsSelected(true)
    setPendingFile(null)
    setThumbnail(null)
    setThumbnailReady(false)
    if (imageThumbnailUrlRef.current) {
      URL.revokeObjectURL(imageThumbnailUrlRef.current)
      imageThumbnailUrlRef.current = null
    }
  }

  const handleDialogCancel = () => {
    setDialogOpen(false)
    setPendingFile(null)
    setSelectedGame(null)
    setSelectedTags([])
    setTagInput('')
    setGameOptions([])
    setGameInput('')
    setUploadToGameFolder(false)
    setTitleInput('')
    setEditingTitle(false)
    setThumbnail(null)
    setThumbnailReady(false)
    if (imageThumbnailUrlRef.current) {
      URL.revokeObjectURL(imageThumbnailUrlRef.current)
      imageThumbnailUrlRef.current = null
    }
  }

  const handleGameInputChange = async (_, value) => {
    setGameInput(value)
    if (!value || value.length < 2) {
      setGameOptions(allGames.map((g) => ({ ...g, _source: 'db' })))
      return
    }
    setGameSearchLoading(true)
    try {
      const sgdbResults = (await GameService.searchSteamGrid(value)).data || []
      const dbMatches = allGames
        .filter((g) => g.name.toLowerCase().includes(value.toLowerCase()))
        .map((g) => ({ ...g, _source: 'db' }))
      const existingSgdbIds = new Set(allGames.map((g) => g.steamgriddb_id).filter(Boolean))
      const newFromSgdb = sgdbResults.filter((r) => !existingSgdbIds.has(r.id)).map((r) => ({ ...r, _source: 'sgdb' }))
      setGameOptions([...dbMatches, ...newFromSgdb])
    } catch {
      setGameOptions(allGames.map((g) => ({ ...g, _source: 'db' })))
    }
    setGameSearchLoading(false)
  }

  const handleGameChange = async (_, newValue) => {
    if (!newValue) {
      setSelectedGame(null)
      setUploadToGameFolder(false)
      return
    }
    if (newValue._source === 'db') {
      setSelectedGame(newValue)
      return
    }
    // New game from SteamGridDB — create it in the DB
    setGameCreating(true)
    try {
      const assets = (await GameService.getGameAssets(newValue.id)).data
      const gameData = {
        steamgriddb_id: newValue.id,
        name: newValue.name,
        release_date: newValue.release_date ? new Date(newValue.release_date * 1000).toISOString().split('T')[0] : null,
        hero_url: assets.hero_url,
        logo_url: assets.logo_url,
        icon_url: assets.icon_url,
      }
      const created = (await GameService.createGame(gameData)).data
      setAllGames((prev) => [...prev, created])
      setSelectedGame({ ...created, _source: 'db' })
    } catch {
      setSelectedGame(null)
    }
    setGameCreating(false)
  }

  const changeHandler = (event) => {
    setProgress(0)
    lastProgressUpdate.current = 0
    openMetadataDialog(event.target.files[0])
  }

  const uploadProgress = (progress, rate) => {
    if (progress <= 1 && progress >= 0) {
      const now = Date.now()
      if (progress === 1 || now - lastProgressUpdate.current >= 1000) {
        lastProgressUpdate.current = now
        setProgress(progress)
        setUploadRate(() => ({ ...rate }))
        onProgress?.(progress, rate)
      }
    }
  }

  const uploadProgressChunked = (progress, progressTotal, rate) => {
    const now = Date.now()
    const stale = now - lastProgressUpdate.current >= 1000
    if (progressTotal <= 1 && progressTotal >= 0) {
      if (progressTotal === 1 || stale) {
        lastProgressUpdate.current = now
        setProgress(progressTotal)
        setUploadRate(() => ({ ...rate }))
        onProgress?.(progressTotal, rate)
      }
    } else if (progress <= 1 && progress >= 0 && (progress === 1 || stale)) {
      lastProgressUpdate.current = now
      setProgress(progress)
      setUploadRate(() => ({ ...rate }))
      onProgress?.(progress, rate)
    }
  }

  // Function to handle the drop event
  const dropHandler = (event) => {
    event.preventDefault()
    setProgress(0)
    const file = event.dataTransfer.files[0]
    openMetadataDialog(file)
  }

  // Prevent default behavior for drag events to enable dropping files
  const dragOverHandler = (event) => {
    event.preventDefault()
  }

  React.useEffect(() => {
    if (!selectedFile) return

    const chunkSize = 90 * 1024 * 1024 // 90MB chunk size
    const { tag_ids, game_id, folder, title } = pendingMetadata.current

    async function upload() {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (tag_ids) formData.append('tag_ids', tag_ids)
      if (game_id) formData.append('game_id', game_id)
      if (folder) formData.append('folder', folder)
      if (title) formData.append('title', title)
      try {
        if (authenticated) {
          await VideoService.upload(formData, uploadProgress)
        } else {
          await VideoService.publicUpload(formData, uploadProgress)
        }
        handleAlert({
          type: 'success',
          message: 'Your upload will be available in a few seconds.',
          autohideDuration: 3500,
          open: true,
        })
        if (onUploadComplete) onUploadComplete()
      } catch (err) {
        handleAlert({
          type: 'error',
          message: `An error occurred while uploading your video.`,
          open: true,
        })
      }
      setProgress(0)
      setUploadRate(null)
      setIsSelected(false)
    }

    async function uploadChunked() {
      if (!selectedFile) return

      const totalChunks = Math.ceil(selectedFile.size / chunkSize)

      const fileInfo = `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`
      let checksum
      if (crypto.subtle) {
        checksum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fileInfo)).then((buf) =>
          Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        )
      } else {
        // Fallback for non-secure contexts (plain HTTP over network IP).
        // A simple hash is sufficient here — it only correlates upload chunks.
        let h = 0
        for (let i = 0; i < fileInfo.length; i++) {
          h = (Math.imul(31, h) + fileInfo.charCodeAt(i)) | 0
        }
        checksum = (h >>> 0).toString(16).padStart(8, '0')
      }

      try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * chunkSize
          const end = Math.min(start + chunkSize, selectedFile.size)
          const chunk = selectedFile.slice(start, end)

          const formData = new FormData()
          formData.append('blob', chunk, selectedFile.name)
          formData.append('chunkPart', chunkIndex + 1)
          formData.append('totalChunks', totalChunks)
          formData.append('checkSum', checksum)
          formData.append('fileName', selectedFile.name)
          formData.append('fileSize', selectedFile.size.toString())
          formData.append('lastModified', selectedFile.lastModified.toString())
          formData.append('fileType', selectedFile.type)
          if (tag_ids) formData.append('tag_ids', tag_ids)
          if (game_id) formData.append('game_id', game_id)
          if (folder) formData.append('folder', folder)
          if (title) formData.append('title', title)

          authenticated
            ? await VideoService.uploadChunked(formData, uploadProgressChunked, selectedFile.size, start)
            : await VideoService.publicUploadChunked(formData, uploadProgressChunked, selectedFile.size, start)
        }

        handleAlert({
          type: 'success',
          message: 'Your upload will be available in a few seconds.',
          autohideDuration: 3500,
          open: true,
        })
        if (onUploadComplete) onUploadComplete()
      } catch (err) {
        handleAlert({
          type: 'error',
          message: `An error occurred while uploading your video.`,
          open: true,
        })
      }

      setProgress(0)
      setUploadRate(null)
      setIsSelected(false)
    }

    if (selectedFile.size > chunkSize) {
      uploadChunked()
    } else {
      upload()
    }
    // eslint-disable-next-line
  }, [selectedFile])

  const filenameStem = pendingFile ? pendingFile.name.replace(/\.[^/.]+$/, '') : ''
  const displayTitle = titleInput || filenameStem || 'Untitled'

  const inlineTitleEl = (
    <Box sx={{ mb: 2 }}>
      {editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            setTitleInput(titleDraft.trim())
            setEditingTitle(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') {
              setTitleDraft(titleInput)
              setEditingTitle(false)
            }
          }}
          maxLength={200}
          style={{
            width: '100%',
            background: '#FFFFFF1F',
            border: 'none',
            borderRadius: '6px',
            outline: 'none',
            color: 'white',
            fontWeight: 800,
            fontSize: 22,
            lineHeight: 1.3,
            padding: '2px 6px',
            boxSizing: 'border-box',
            fontFamily: '"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
          }}
        />
      ) : (
        <Box
          onClick={() => {
            setTitleDraft(titleInput)
            setEditingTitle(true)
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'text',
            borderRadius: '6px',
            px: '6px',
            mx: '-6px',
            transition: 'background 0.15s',
            '&:hover': { background: '#FFFFFF1F' },
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: 22,
              lineHeight: 1.3,
              color: titleInput || filenameStem ? 'white' : '#FFFFFF55',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: '"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            }}
          >
            {displayTitle}
          </Typography>
        </Box>
      )}
    </Box>
  )

  const canUpload = authenticated ? !!uiConfig?.show_admin_upload : !!uiConfig?.allow_public_upload
  if (!canUpload) return null

  if (dropOnly) {
    return (
      <Dialog open={dialogOpen} onClose={handleDialogCancel} maxWidth="md" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CloudUploadIcon sx={{ color: '#2684FF', fontSize: 24, flexShrink: 0 }} />
            <Typography sx={{ ...dialogTitleSx, fontSize: 16 }}>Upload Video</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', px: 3 }}>
          {inlineTitleEl}
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            {/* Thumbnail — left column */}
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  bgcolor: '#FFFFFF0D',
                  border: '1px solid #FFFFFF14',
                  position: 'relative',
                }}
              >
                {thumbnailReady && thumbnail && (
                  <Box
                    component="img"
                    src={thumbnail}
                    alt="thumbnail"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      animation: `${fadeIn} 0.6s ease`,
                    }}
                  />
                )}
                {!thumbnailReady && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(90deg, #FFFFFF08 25%, #FFFFFF18 50%, #FFFFFF08 75%)',
                      backgroundSize: '800px 100%',
                      animation: `${shimmer} 1.4s ease-in-out infinite`,
                    }}
                  />
                )}
                {thumbnailReady && !thumbnail && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <CloudUploadIcon sx={{ color: '#FFFFFF33', fontSize: 32 }} />
                  </Box>
                )}
              </Box>
              <Typography
                sx={{
                  mt: 1,
                  fontSize: 11,
                  color: '#FFFFFF4D',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pendingFile?.name}
              </Typography>
            </Box>

            {/* Form fields — right column */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Game selector */}
              <Box>
                <Typography sx={labelSx}>Game</Typography>
                <Autocomplete
                  options={gameOptions}
                  getOptionLabel={(o) => o.name || ''}
                  groupBy={(o) => (o._source === 'db' ? 'Already in library' : 'From SteamGridDB')}
                  value={selectedGame}
                  inputValue={gameInput}
                  onInputChange={handleGameInputChange}
                  onChange={handleGameChange}
                  loading={gameSearchLoading}
                  disabled={gameCreating}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id || (option.steamgriddb_id && option.steamgriddb_id === value.steamgriddb_id)
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Search for a game..."
                      sx={inputSx}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: selectedGame?.icon_url ? (
                          <>
                            <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                              <img
                                src={selectedGame.icon_url}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                                style={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 3 }}
                              />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ) : (
                          params.InputProps.startAdornment
                        ),
                        endAdornment: (
                          <>
                            {(gameSearchLoading || gameCreating) && (
                              <InputAdornment position="end">
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                              </InputAdornment>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box
                      component="li"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      {...props}
                      key={`${option._source}-${option.id}`}
                    >
                      {option.icon_url && (
                        <img
                          src={option.icon_url}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                          style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                        />
                      )}
                      {option.name}
                      {option._source === 'sgdb' &&
                        option.release_date &&
                        ` (${new Date(option.release_date * 1000).getFullYear()})`}
                    </Box>
                  )}
                />
                {selectedGame && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={uploadToGameFolder}
                        onChange={(e) => setUploadToGameFolder(e.target.checked)}
                        size="small"
                        sx={checkboxSx}
                      />
                    }
                    label={<Typography sx={helperTextSx}>Auto-sort into game folder</Typography>}
                    sx={{ mt: 0.5, ml: 0 }}
                  />
                )}
              </Box>
              {availableFolders.length > 0 && (
                <Box sx={{ opacity: uploadToGameFolder && selectedGame ? 0.5 : 1 }}>
                  <Typography sx={labelSx}>Upload Folder</Typography>
                  <Autocomplete
                    options={availableFolders}
                    value={uploadToGameFolder && selectedGame ? selectedGame.name : selectedFolder || null}
                    onChange={(_, value) => setSelectedFolder(value || '')}
                    disableClearable={uploadToGameFolder ? true : !!selectedFolder}
                    disabled={uploadToGameFolder && !!selectedGame}
                    renderInput={(params) => <TextField {...params} size="small" sx={inputSx} />}
                  />
                </Box>
              )}
              <Box>
                <Typography sx={labelSx}>Tags</Typography>
                <Autocomplete
                  multiple
                  freeSolo
                  options={allTags.filter((t) => !selectedTags.find((s) => s.id === t.id))}
                  getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                  value={selectedTags}
                  inputValue={tagInput}
                  onInputChange={(_, v) => setTagInput(v)}
                  onChange={(_, values) => {
                    setSelectedTags(values.map((v) => (typeof v === 'string' ? { name: v } : v)))
                    setTagInput('')
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
                        size="small"
                        {...getTagProps({ index })}
                        sx={{
                          bgcolor: option.color ? `${option.color}33` : '#FFFFFF14',
                          color: 'white',
                          '& .MuiChip-deleteIcon': { color: '#FFFFFF66', '&:hover': { color: 'white' } },
                        }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Add tags..."
                      sx={inputSx}
                      inputProps={{ ...params.inputProps, maxLength: 12 }}
                      onKeyDown={(e) => {
                        if (e.key === ',') {
                          e.preventDefault()
                          const parts = parseTagInput(tagInput)
                          if (parts.length > 0) {
                            setSelectedTags((prev) => {
                              const merged = [...prev]
                              parts.forEach((p) => {
                                if (!merged.find((t) => t.name.toLowerCase() === p.toLowerCase())) {
                                  const existing = allTags.find((t) => t.name.toLowerCase() === p.toLowerCase())
                                  merged.push(existing || { name: p })
                                }
                              })
                              return merged
                            })
                            setTagInput('')
                          }
                        }
                      }}
                    />
                  )}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={handleDialogCancel}
            sx={{ color: '#FFFFFF80', '&:hover': { color: 'white', bgcolor: '#FFFFFF0F' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDialogConfirm}
            variant="contained"
            sx={{
              background: 'linear-gradient(90deg, #BC00E6, #FF3729)',
              '&:hover': { background: 'linear-gradient(90deg, #CC10F6, #FF4739)' },
              fontWeight: 600,
              px: 3,
            }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <>
      <Grid item sx={{ mx: 1, mt: 2 }}>
        <label htmlFor="icon-button-file">
          {/* Add onDrop and onDragOver handlers */}
          <Box
            sx={{
              position: 'relative',
              borderRadius: '13px',
              padding: progress > 0 ? '2px' : '0px',
              overflow: 'hidden',
              transition: 'padding 0.2s',
              '&::before': {
                content: '""',
                display: progress > 0 ? 'block' : 'none',
                position: 'absolute',
                inset: '-100%',
                background: 'conic-gradient(#BC00E6DF, #FF3729D9, #0084ff, #BC00E6DF)',
                animation: `${borderSpin} 1s linear infinite`,
              },
            }}
          >
            <Paper
              sx={{
                position: 'relative',
                width: '100%',
                height: mini ? '56px' : '90px',
                cursor: 'pointer',
                background: '#001224',
                overflow: 'hidden',
                border: '2px solid',
                borderColor: progress > 0 ? 'transparent' : 'rgba(38, 132, 255, 0.25)',
                borderRadius: '12px',
                transition: 'border-color 0.2s, background 0.2s',
                '&:hover': {
                  borderColor: progress > 0 ? 'transparent' : 'rgba(38, 132, 255, 0.5)',
                  background: progress > 0 ? 'rgb(0, 32, 73)' : 'rgba(38, 132, 255, 0.1)',
                },
              }}
              onDrop={dropHandler}
              onDragOver={dragOverHandler}
            >
              <Box sx={{ display: 'flex', height: '100%' }} justifyContent="center" alignItems="center">
                <Stack sx={{ zIndex: 0, width: '100%' }} alignItems="center" justifyContent="center" spacing={0.5}>
                  {!isSelected && (
                    <Input
                      id="icon-button-file"
                      accept="video/mp4,video/webm,video/mov"
                      type="file"
                      name="file"
                      onChange={changeHandler}
                    />
                  )}
                  {progress === 0 && !mini && (
                    <>
                      <CloudUploadIcon sx={{ fontSize: 32, color: '#fff' }} />
                      <Typography sx={{ fontSize: 12, color: '#ffffff77', fontWeight: 500, letterSpacing: 0.2 }}>
                        Click to browse or drag anywhere
                      </Typography>
                    </>
                  )}
                  {progress === 0 && mini && <CloudUploadIcon sx={{ fontSize: 20, color: '#fff' }} />}
                  {progress > 0 && (
                    <>
                      {!mini ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', px: 2 }}>
                          <LogoProgress progress={progress} size={48} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: 'white',
                                lineHeight: 1.3,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {progress < 1 ? `Uploading ${(100 * progress).toFixed(0)}%` : 'Processing...'}
                            </Typography>
                            <Typography
                              sx={{ fontSize: 11, color: '#FFFFFFAA', lineHeight: 1.3, whiteSpace: 'nowrap' }}
                            >
                              {progress < 1
                                ? `${numberFormat.format(uploadRate.loaded.toFixed(0))} / ${numberFormat.format(uploadRate.total.toFixed(0))} MB`
                                : 'Please wait...'}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'white' }}>
                          {progress < 1 ? `${(100 * progress).toFixed(0)}%` : '100%'}
                        </Typography>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Box>
        </label>
      </Grid>

      {/* Pre-upload metadata dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogCancel} maxWidth="md" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CloudUploadIcon sx={{ color: '#fff', fontSize: 24, flexShrink: 0 }} />
            <Typography sx={{ ...dialogTitleSx, fontSize: 16 }}>Upload Video</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', px: 3 }}>
          {inlineTitleEl}
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            {/* Thumbnail — left column */}
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  bgcolor: '#FFFFFF0D',
                  border: '1px solid #FFFFFF14',
                  position: 'relative',
                }}
              >
                {thumbnailReady && thumbnail && (
                  <Box
                    component="img"
                    src={thumbnail}
                    alt="thumbnail"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      animation: `${fadeIn} 0.6s ease`,
                    }}
                  />
                )}
                {!thumbnailReady && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(90deg, #FFFFFF08 25%, #FFFFFF18 50%, #FFFFFF08 75%)',
                      backgroundSize: '800px 100%',
                      animation: `${shimmer} 1.4s ease-in-out infinite`,
                    }}
                  />
                )}
                {thumbnailReady && !thumbnail && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <CloudUploadIcon sx={{ color: '#FFFFFF33', fontSize: 32 }} />
                  </Box>
                )}
              </Box>
              <Typography
                sx={{
                  mt: 1,
                  fontSize: 11,
                  color: '#FFFFFF4D',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pendingFile?.name}
              </Typography>
            </Box>

            {/* Form fields — right column */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Game selector */}
              <Box>
                <Typography sx={labelSx}>Game</Typography>
                <Autocomplete
                  options={gameOptions}
                  getOptionLabel={(o) => o.name || ''}
                  groupBy={(o) => (o._source === 'db' ? 'Already in library' : 'From SteamGridDB')}
                  value={selectedGame}
                  inputValue={gameInput}
                  onInputChange={handleGameInputChange}
                  onChange={handleGameChange}
                  loading={gameSearchLoading}
                  disabled={gameCreating}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id || (option.steamgriddb_id && option.steamgriddb_id === value.steamgriddb_id)
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Search for a game..."
                      sx={inputSx}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: selectedGame?.icon_url ? (
                          <>
                            <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                              <img
                                src={selectedGame.icon_url}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                                style={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 3 }}
                              />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ) : (
                          params.InputProps.startAdornment
                        ),
                        endAdornment: (
                          <>
                            {(gameSearchLoading || gameCreating) && (
                              <InputAdornment position="end">
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                              </InputAdornment>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box
                      component="li"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      {...props}
                      key={`${option._source}-${option.id}`}
                    >
                      {option.icon_url && (
                        <img
                          src={option.icon_url}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                          style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                        />
                      )}
                      {option.name}
                      {option._source === 'sgdb' &&
                        option.release_date &&
                        ` (${new Date(option.release_date * 1000).getFullYear()})`}
                    </Box>
                  )}
                />
                {selectedGame && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={uploadToGameFolder}
                        onChange={(e) => setUploadToGameFolder(e.target.checked)}
                        size="small"
                        sx={checkboxSx}
                      />
                    }
                    label={<Typography sx={helperTextSx}>Auto-sort into game folder</Typography>}
                    sx={{ mt: 0.5, ml: 0 }}
                  />
                )}
              </Box>

              {/* Folder selector */}
              {availableFolders.length > 0 && (
                <Box sx={{ opacity: uploadToGameFolder && selectedGame ? 0.5 : 1 }}>
                  <Typography sx={labelSx}>Upload Folder</Typography>
                  <Autocomplete
                    options={availableFolders}
                    value={uploadToGameFolder && selectedGame ? selectedGame.name : selectedFolder || null}
                    onChange={(_, value) => setSelectedFolder(value || '')}
                    disableClearable={uploadToGameFolder ? true : !!selectedFolder}
                    disabled={uploadToGameFolder && !!selectedGame}
                    renderInput={(params) => <TextField {...params} size="small" sx={inputSx} />}
                  />
                </Box>
              )}

              {/* Tag selector */}
              <Box>
                <Typography sx={labelSx}>Tags</Typography>
                <Autocomplete
                  multiple
                  freeSolo
                  options={allTags.filter((t) => !selectedTags.find((s) => s.id === t.id))}
                  getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                  value={selectedTags}
                  inputValue={tagInput}
                  onInputChange={(_, v) => setTagInput(v)}
                  onChange={(_, values) => {
                    const resolved = values.map((v) => (typeof v === 'string' ? { name: v } : v))
                    setSelectedTags(resolved)
                    setTagInput('')
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
                        size="small"
                        {...getTagProps({ index })}
                        sx={{
                          bgcolor: option.color ? `${option.color}33` : '#FFFFFF14',
                          color: 'white',
                          '& .MuiChip-deleteIcon': { color: '#FFFFFF66', '&:hover': { color: 'white' } },
                        }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Add tags..."
                      sx={inputSx}
                      inputProps={{ ...params.inputProps, maxLength: 12 }}
                      onKeyDown={(e) => {
                        if (e.key === ',') {
                          e.preventDefault()
                          const parts = parseTagInput(tagInput)
                          if (parts.length > 0) {
                            setSelectedTags((prev) => {
                              const merged = [...prev]
                              parts.forEach((p) => {
                                if (!merged.find((t) => t.name.toLowerCase() === p.toLowerCase())) {
                                  const existing = allTags.find((t) => t.name.toLowerCase() === p.toLowerCase())
                                  merged.push(existing || { name: p })
                                }
                              })
                              return merged
                            })
                            setTagInput('')
                          }
                        }
                      }}
                    />
                  )}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={handleDialogCancel}
            sx={{ color: '#FFFFFF80', '&:hover': { color: 'white', bgcolor: '#FFFFFF0F' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDialogConfirm}
            variant="contained"
            sx={{
              background: 'linear-gradient(90deg, #BC00E6, #FF3729)',
              '&:hover': { background: 'linear-gradient(90deg, #CC10F6, #FF4739)' },
              fontWeight: 600,
              px: 3,
            }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
})

export default UploadCard
