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
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import styled from '@emotion/styled'
import { motion } from 'framer-motion'
import { VideoService, GameService, TagService } from '../../services'
import { getSetting } from '../../common/utils'

const Input = styled('input')({
  display: 'none',
})

const numberFormat = new Intl.NumberFormat('en-US')

const UploadCard = ({ authenticated, handleAlert, mini }) => {
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
  // Stored metadata to attach on next upload
  const pendingMetadata = React.useRef({ tag_ids: null, game_id: null })

  const openMetadataDialog = (file) => {
    setPendingFile(file)
    setSelectedGame(null)
    setSelectedTags([])
    setTagInput('')
    Promise.all([GameService.getGames(), TagService.getTags()])
      .then(([gRes, tRes]) => {
        setAllGames(gRes.data || [])
        setAllTags(tRes.data || [])
      })
      .catch(() => {
        setAllGames([])
        setAllTags([])
      })
    setDialogOpen(true)
  }

  const handleDialogConfirm = async () => {
    // Create any new (freeSolo) tags that don't have an id yet
    const resolvedTags = await Promise.all(
      selectedTags.map(async (t) => {
        if (t.id) return t
        const res = await TagService.createTag({ name: t.name })
        return res.data
      }),
    )
    pendingMetadata.current = {
      tag_ids: resolvedTags.length ? resolvedTags.map((t) => t.id).join(',') : null,
      game_id: selectedGame ? selectedGame.id : null,
    }
    setDialogOpen(false)
    setSelectedFile(pendingFile)
    setIsSelected(true)
    setPendingFile(null)
  }

  const handleDialogSkip = () => {
    pendingMetadata.current = { tag_ids: null, game_id: null }
    setDialogOpen(false)
    setSelectedFile(pendingFile)
    setIsSelected(true)
    setPendingFile(null)
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
      }
    } else if (progress <= 1 && progress >= 0 && (progress === 1 || stale)) {
      lastProgressUpdate.current = now
      setProgress(progress)
      setUploadRate(() => ({ ...rate }))
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
    const { tag_ids, game_id } = pendingMetadata.current

    async function upload() {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (tag_ids) formData.append('tag_ids', tag_ids)
      if (game_id) formData.append('game_id', game_id)
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

  if (!authenticated && !uiConfig?.allow_public_upload) return null
  if (authenticated && !uiConfig?.show_admin_upload) return null

  return (
    <>
      <Grid item sx={{ mx: 1, mt: 2 }}>
        <label htmlFor="icon-button-file">
          {/* Add onDrop and onDragOver handlers */}
          <Paper
            sx={{
              position: 'relative',
              width: '100%',
              height: '64px',
              cursor: 'pointer',
              background: 'rgba(0,0,0,0)',
              overflow: 'hidden',
            }}
            variant="outlined"
            onDrop={dropHandler}
            onDragOver={dragOverHandler}
          >
            <Box sx={{ display: 'flex', height: '100%' }} justifyContent="center" alignItems="center">
              <Stack sx={{ zIndex: 0 }} alignItems="center" justifyContent="center">
                {!isSelected && (
                  <Input
                    id="icon-button-file"
                    accept="video/mp4,video/webm,video/mov"
                    type="file"
                    name="file"
                    onChange={changeHandler}
                  />
                )}
                {progress === 0 && !mini && <CloudUploadIcon sx={{ fontSize: 32 }} />}
                {progress === 0 && mini && progress === 0 && <CloudUploadIcon sx={{ fontSize: 20 }} />}
                {progress !== 0 && progress !== 1 && (
                  <>
                    {!mini ? (
                      <>
                        <Typography
                          component="div"
                          variant="overline"
                          align="center"
                          sx={{ fontWeight: 600, fontSize: 12 }}
                        >
                          Uploading... {(100 * progress).toFixed(0)}%
                        </Typography>
                        <Typography variant="overline" align="center" sx={{ fontWeight: 600, fontSize: 12 }}>
                          {numberFormat.format(uploadRate.loaded.toFixed(0))} /{' '}
                          {numberFormat.format(uploadRate.total.toFixed(0))} MB's
                        </Typography>
                      </>
                    ) : (
                      <Typography
                        component="div"
                        variant="overline"
                        align="center"
                        justifyItems="center"
                        sx={{ fontWeight: 600, fontSize: 12 }}
                      >
                        {(100 * progress).toFixed(0)}%
                      </Typography>
                    )}
                  </>
                )}
                {progress === 1 && !mini && (
                  <Typography component="div" variant="overline" align="center" sx={{ fontWeight: 600, fontSize: 12 }}>
                    Processing...
                    <Typography
                      component="span"
                      variant="overline"
                      align="center"
                      display="block"
                      sx={{ fontWeight: 400, fontSize: 12 }}
                    >
                      This may take a few minutes
                    </Typography>
                  </Typography>
                )}
                {progress === 1 && mini && (
                  <Typography
                    component="div"
                    variant="overline"
                    align="center"
                    justifyItems="center"
                    sx={{ fontWeight: 600, fontSize: 12 }}
                  >
                    100%
                  </Typography>
                )}
              </Stack>
            </Box>
            <motion.div
              animate={{
                height: mini ? `${progress * 100}%` : '100%',
                width: mini ? '100%' : `${progress * 100}%`,
              }}
              transition={progress === 0 ? { duration: 0 } : { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: 'absolute',
                bottom: 0,
                zIndex: -1,
                backgroundImage: 'linear-gradient(90deg, #BC00E6DF, #FF3729D9)',
                borderRadius: '10px',
              }}
            />
          </Paper>
        </label>
      </Grid>

      {/* Pre-upload metadata dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogSkip} maxWidth="sm" fullWidth>
        <DialogTitle>Tag this clip before uploading</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
          {/* Game selector */}
          <Autocomplete
            options={allGames}
            getOptionLabel={(o) => o.name || ''}
            value={selectedGame}
            onChange={(_, v) => setSelectedGame(v)}
            renderInput={(params) => <TextField {...params} label="Game" size="small" placeholder="Select a game..." />}
            renderOption={(props, option) => (
              <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} {...props}>
                {option.icon_url && (
                  <img
                    src={option.icon_url}
                    alt=""
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                    style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                  />
                )}
                {option.name}
              </Box>
            )}
          />

          {/* Tag selector */}
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
              <TextField {...params} label="Tags" size="small" placeholder="Add tags..." />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogSkip}>Skip</Button>
          <Button onClick={handleDialogConfirm} variant="contained">
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UploadCard
