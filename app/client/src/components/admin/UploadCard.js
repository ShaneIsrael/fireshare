import React from 'react'
import { Box, Grid, Paper, Stack, Typography } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import styled from '@emotion/styled'
import { VideoService } from '../../services'
import { getSetting } from '../../common/utils'

const Input = styled('input')({
  display: 'none',
})

const numberFormat = new Intl.NumberFormat('en-US')

const UploadCard = ({ authenticated, feedView = false, publicUpload = false, fetchVideos, cardWidth, handleAlert }) => {
  const cardHeight = cardWidth / 1.77 + 32
  const [selectedFile, setSelectedFile] = React.useState()
  const [isSelected, setIsSelected] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [uploadRate, setUploadRate] = React.useState()

  const uiConfig = getSetting('ui_config')

  const changeHandler = (event) => {
    setProgress(0)
    setSelectedFile(event.target.files[0])
    setIsSelected(true)
  }

  const uploadProgress = (progress, rate) => {
    if (progress <= 1 && progress >= 0) {
      setProgress(progress)
      setUploadRate((prev) => ({ ...rate }))
    }
  }

  // Function to handle the drop event
  const dropHandler = (event) => {
    event.preventDefault()
    setProgress(0)
    const file = event.dataTransfer.files[0]
    setSelectedFile(file)
    setIsSelected(true)
  }

  // Prevent default behavior for drag events to enable dropping files
  const dragOverHandler = (event) => {
    event.preventDefault()
  }

  React.useEffect(() => {

    if (!selectedFile) return;

    const chunkSize = 90 * 1024 * 1024; // 90MB chunk size

    async function upload() {
      const formData = new FormData()
      formData.append('file', selectedFile)
      try {
        if (publicUpload) {
          await VideoService.publicUpload(formData, uploadProgress)
        }
        if (!publicUpload && authenticated) {
          await VideoService.upload(formData, uploadProgress)
        }
        handleAlert({
          type: 'success',
          message: 'Your upload will be available in a few seconds.',
          autohideDuration: 3500,
          open: true,
          onClose: () => fetchVideos(),
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
      if (!selectedFile) return;

      const totalChunks = Math.ceil(selectedFile.size / chunkSize);
      const checksum = await crypto.subtle.digest('SHA-256', await selectedFile.arrayBuffer()).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

      try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, selectedFile.size);
          const chunk = selectedFile.slice(start, end);

          const formData = new FormData();
          formData.append('blob', chunk, selectedFile.name);
          formData.append('chunkPart', chunkIndex + 1);
          formData.append('totalChunks', totalChunks);
          formData.append('checkSum', checksum);

          // const onChunkProgress = (event) => {
          //   if (event.lengthComputable) {
          //     const chunkProgress = event.loaded / event.total;
          //     const overallProgress = ((chunkIndex + chunkProgress) / totalChunks) * 100;
          //     setProgress(overallProgress);
          //     uploadProgress && uploadProgress(event);
          //   }
          // };

          //   if (publicUpload) {
          //     await VideoService.publicUploadChunked(formData, onChunkProgress);
          //   } else if (!publicUpload && authenticated) {
          //     await VideoService.uploadChunked(formData, onChunkProgress);
          //   }
          // }

          if (publicUpload) {
            await VideoService.publicUploadChunked(formData, uploadProgress);
          } else if (!publicUpload && authenticated) {
            await VideoService.uploadChunked(formData, uploadProgress, selectedFile.size, start);
          }
        }

        handleAlert({
          type: 'success',
          message: 'Your upload will be available in a few seconds.',
          autohideDuration: 3500,
          open: true,
          onClose: () => fetchVideos(),
        });
      } catch (err) {
        handleAlert({
          type: 'error',
          message: `An error occurred while uploading your video.`,
          open: true,
        });
      }

      setProgress(0);
      setUploadRate(null);
      setIsSelected(false);
    }


    if (selectedFile.size > chunkSize) {
      // TODO: remove
      handleAlert({
        type: 'info',
        message: 'Video will be uploaded in chunks.',
        autohideDuration: 3500,
        open: true,
      });
      uploadChunked()
    }
    else {
      upload()
    }
    // eslint-disable-next-line
  }, [selectedFile])

  if (feedView && !uiConfig?.show_public_upload) return null
  if (!feedView && !uiConfig?.show_admin_upload) return null

  return (
    <Grid item sx={{ ml: 0.75, mr: 0.75, mb: 1.5 }}>
      <label htmlFor="icon-button-file">
        {/* Add onDrop and onDragOver handlers */}
        <Paper
          sx={{
            position: 'relative',
            width: cardWidth,
            height: cardHeight,
            cursor: 'pointer',
            background: 'rgba(0,0,0,0)',
            overflow: 'hidden',
          }}
          variant="outlined"
          onDrop={dropHandler}
          onDragOver={dragOverHandler}
        >
          <Box sx={{ display: 'flex', p: 2, height: '100%' }} justifyContent="center" alignItems="center">
            <Stack sx={{ zIndex: 0, width: '100%' }} alignItems="center">
              {!isSelected && (
                <Input
                  id="icon-button-file"
                  accept="video/mp4,video/webm,video/mov"
                  type="file"
                  name="file"
                  onChange={changeHandler}
                />
              )}
              <CloudUploadIcon sx={{ fontSize: 75 }} />
              {progress !== 0 && progress !== 1 && (
                <>
                  <Typography component="div" variant="overline" align="center" sx={{ fontWeight: 600, fontSize: 16 }}>
                    Uploading... {(100 * progress).toFixed(0)}%
                  </Typography>
                  <Typography variant="overline" align="center" sx={{ fontWeight: 600, fontSize: 12 }}>
                    {numberFormat.format(uploadRate.loaded.toFixed(0))} /{' '}
                    {numberFormat.format(uploadRate.total.toFixed(0))} MB's
                  </Typography>
                </>
              )}
              {progress === 1 && (
                <Typography component="div" variant="overline" align="center" sx={{ fontWeight: 600, fontSize: 16 }}>
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
            </Stack>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              zIndex: -1,
              height: cardHeight,
              width: cardWidth * progress,
              backgroundImage: 'linear-gradient(90deg, #BC00E6DF, #FF3729D9)',
              borderRadius: '10px',
            }}
          />
        </Paper>
      </label>
    </Grid>
  )
}

export default UploadCard
