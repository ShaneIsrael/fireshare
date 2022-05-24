import React from 'react'
import { Box, Button, Grid, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import LinkIcon from '@mui/icons-material/Link'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl } from '../../common/utils'

const URL = getPublicWatchUrl()

const VideoListItem = ({ video, openVideoHandler, copyLinkHandler }) => {
  const [title, setTitle] = React.useState(video.info.title)

  return (
    <Paper square sx={{ height: 70, bgcolor: '#0b132b', borderBottom: '1px solid #046595' }}>
      <Grid container direction="column" sx={{ width: '100%', height: '100%' }}>
        <Grid container sx={{ width: 25, height: '100%', pl: 1 }} justifyContent="center" alignItems="center">
          <CopyToClipboard text={`${URL}${video.video_id}`}>
            <IconButton aria-label="play video" sx={{ width: 30, height: 30 }} onClick={() => copyLinkHandler(video)}>
              <LinkIcon sx={{ width: 25, height: 25, transform: 'rotate(-45deg)' }} color="primary" />
            </IconButton>
          </CopyToClipboard>
        </Grid>
        <Grid container sx={{ width: 'calc(100% - 75px)', height: '100%', pl: 1 }} alignItems="center">
          <Grid item xs>
            <TextField size="small" label="Title" defaultValue={title} onChange={(e) => setTitle(e.target.value)} />
          </Grid>
          <Grid item sx={{ pl: 1, pr: 1 }}>
            <Typography sx={{ fontWeight: 400, fontSize: 20, fontFamily: 'monospace' }}>
              {new Date(video.info.duration * 1000).toISOString().substr(11, 8)}
            </Typography>
          </Grid>
        </Grid>
        <Grid container sx={{ width: 50, height: '100%' }} justifyContent="center" alignItems="center">
          <IconButton aria-label="play video" sx={{ width: 50, height: 50 }} onClick={() => openVideoHandler(video)}>
            <PlayCircleIcon sx={{ width: 40, height: 40 }} color="primary" />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default VideoListItem
