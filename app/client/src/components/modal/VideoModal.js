import React from 'react'
import { Box, Button, ButtonGroup, Grid, Modal, Typography } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import ReactPlayer from 'react-player'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl } from '../../common/utils'
import { VideoService } from '../../services'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoModal = ({ open, onClose, video }) => {
  const [vid, setVideo] = React.useState(video)

  const getRandomVideo = async () => {
    try {
      const res = (await VideoService.getRandomVideo()).data
      setVideo(res)
    } catch (err) {
      console.log(err)
    }
  }

  React.useEffect(() => setVideo(video), [video])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${vid.video_id}`, '_blank')
    }
  }

  if (!vid) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      disableAutoFocus={true}
      BackdropProps={{
        sx: {
          background: 'rgba(0, 0, 0, 0.7)',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
        }}
      >
        <Grid container justifyContent="center">
          <Grid item xs={12} sx={{ background: 'rgba(0, 0, 0, 1)' }}>
            <Typography
              align="center"
              noWrap
              sx={{
                fontFamily: 'roboto',
                textTransform: 'uppercase',
                letterSpacing: '.1rem',
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              {vid?.info.title}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <ReactPlayer
              url={`${
                SERVED_BY === 'nginx'
                  ? `${URL}/_content/video/${vid.video_id}${vid.extension}`
                  : `${URL}/api/video?id=${vid.video_id}`
              }`}
              width="100%"
              height="auto"
              volume={0.5}
              controls
            />
          </Grid>
          <Grid item>
            <ButtonGroup variant="contained">
              <Button startIcon={<ShuffleIcon />} onClick={getRandomVideo}>
                Play Random
              </Button>
              <CopyToClipboard text={`${PURL}${vid.video_id}`}>
                <Button onMouseDown={handleMouseDown}>
                  <LinkIcon />
                </Button>
              </CopyToClipboard>
            </ButtonGroup>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  )
}

export default VideoModal
