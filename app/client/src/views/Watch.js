import React, { useRef } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Button, ButtonGroup, Grid, Paper, Typography, Box } from '@mui/material'
import { Helmet } from 'react-helmet'
import CopyToClipboard from 'react-copy-to-clipboard'
import LinkIcon from '@mui/icons-material/Link'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import NotFound from './NotFound'
import { VideoService } from '../services'
import { getServedBy, getUrl, getPublicWatchUrl, copyToClipboard, getVideoSources } from '../common/utils'
import VideoJSPlayer from '../components/misc/VideoJSPlayer'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

function useQuery() {
  const { search } = useLocation()

  return React.useMemo(() => new URLSearchParams(search), [search])
}

const Watch = ({ authenticated }) => {
  const { id } = useParams()
  const query = useQuery()
  const time = query.get('t')
  const [details, setDetails] = React.useState(null)
  const [notFound, setNotFound] = React.useState(false)
  const [views, setViews] = React.useState()
  const [viewAdded, setViewAdded] = React.useState(false)

  const videoPlayerRef = useRef(null)
  const videoContainerRef = React.useRef(null)
  const [alert, setAlert] = React.useState({ open: false })
  
  React.useEffect(() => {
    const container = videoContainerRef.current
    if (!container) return

    const aspectRatio = (details?.info?.width && details?.info?.height)
      ? details.info.width / details.info.height
      : 16 / 9

    const computeSize = () => {
      const availW = container.clientWidth
      const availH = container.clientHeight
      if (availW <= 0 || availH <= 0) return

      let w = availW
      let h = w / aspectRatio

      if (h > availH) {
        h = availH
        w = h * aspectRatio
      }
    }

    const observer = new ResizeObserver(computeSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [details?.info?.width, details?.info?.height])

  React.useEffect(() => {
    async function fetch() {
      try {
        const resp = (await VideoService.getDetails(id)).data
        const videoViews = (await VideoService.getViews(id)).data
        setDetails(resp)
        setViews(videoViews)
        if (!resp.info?.duration || resp.info?.duration < 10) {
          setViewAdded(true)
          VideoService.addView(id).catch((err) => console.error(err))
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setNotFound({
            title: "We're Sorry...",
            body: "But the video you're looking for was not found.",
          })
        } else {
          setNotFound({
            title: 'Oops!',
            body: 'Something somewhere went wrong.',
          })
        }
      }
    }
    if (details == null) fetch()
  }, [details, id])

  const getCurrentTime = () => {
    if (videoPlayerRef.current && typeof videoPlayerRef.current.currentTime === 'function') {
      const time = videoPlayerRef.current.currentTime()
      return (time && !isNaN(time)) ? time : 0
    }
    return 0
  }

  const copyTimestamp = () => {
    const currentTime = getCurrentTime()
    copyToClipboard(`${PURL}${details?.video_id}?t=${currentTime}`)
    setAlert({
      type: 'info',
      message: 'Time stamped link copied to clipboard',
      open: true,
    })
  }

  const handleTimeUpdate = (e) => {
    if (!viewAdded && e.playedSeconds >= 10) {
      setViewAdded(true)
      VideoService.addView(id).catch((err) => console.error(err))
    }
  }

  const getPosterUrl = () => {
    if (SERVED_BY === 'nginx') {
      return `${URL}/_content/derived/${id}/poster.jpg`
    }
    return `${URL}/api/video/poster?id=${id}`
  }

  if (notFound) return <NotFound title={notFound.title} body={notFound.body} />
  if (!details) return null

  const controls = () => (
    <>
      <ButtonGroup variant="contained" sx={{ maxWidth: '100%' }}>
        <CopyToClipboard text={`${PURL}${details?.video_id}`}>
          <Button
            onClick={() =>
              setAlert({
                type: 'info',
                message: 'Link copied to clipboard',
                open: true,
              })
            }
          >
            <LinkIcon />
          </Button>
        </CopyToClipboard>
        <Button onClick={copyTimestamp}>
          <AccessTimeIcon />
        </Button>
        <Button
          disabled
          sx={{
            '&.Mui-disabled': {
              borderRight: 'none',
              borderTop: 'none',
            },
          }}
        >
          <div
            style={{
              overflow: 'hidden',
              color: '#2AA9F2',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {`${views} ${views === 1 ? 'View' : 'Views'}`}
          </div>
        </Button>
        <Button
          disabled
          sx={{
            '&.Mui-disabled': {
              borderRight: 'none',
              borderTop: 'none',
            },
          }}
        >
          <div
            style={{
              overflow: 'hidden',
              color: 'white',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {details?.info?.title}
          </div>
        </Button>
      </ButtonGroup>
    </>
  )

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Helmet>
        <title>{details?.info?.title}</title>
        <meta name="description" value={details?.info?.description}></meta>
        <meta property="og:type" value="video" />
        <meta property="og:url" value={window.location.href} />
        <meta property="og:title" value={details?.info?.title} />
        <meta property="og:description" value={details?.info?.description} />
        <meta
          property="og:image"
          value={
            SERVED_BY === 'nginx' ? `${URL}/_content/derived/${id}/poster.jpg` : `${URL}/api/video/poster?id=${id}`
          }
        />
        <meta
          property="og:video"
          value={
            SERVED_BY === 'nginx'
              ? `${URL}/_content/video/${id}${details?.extension || '.mp4'}`
              : `${URL}/api/video?id=${id}`
          }
        />
        <meta property="og:video:width" value={details?.info?.width} />
        <meta property="og:video:height" value={details?.info?.height} />
        <meta property="og:site_name" value="Fireshare" />
      </Helmet>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'start' }}>
        <div ref={videoContainerRef} style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingLeft: 8, paddingRight: 8 }}>
          <VideoJSPlayer
            sources={getVideoSources(id, details?.info, details?.extension || '.mp4')}
            poster={getPosterUrl()}
            autoplay={true}
            controls={true}
            onTimeUpdate={handleTimeUpdate}
            onReady={(player) => {
              videoPlayerRef.current = player
            }}
            startTime={time ? parseFloat(time) : 0}
            style={{ backgroundColor: '#000' }}
            fluid={false}
            fill={true}
          />
        </div>
        <Paper square sx={{ p: 1, background: 'rgba(0, 0, 0, 0.1)', width: '100%' }}>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1 }}>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                {controls()}
              </Grid>
              {details?.info?.description && (
                <Grid item xs={12}>
                  <Paper sx={{ width: '100%', p: 2, background: 'rgba(255, 255, 255, 0.12)' }}>
                    <Typography variant="subtitle2">{details?.info?.description}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
          <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                {controls()}
              </Grid>
              {details?.info?.description && (
                <Grid item xs={12}>
                  <Paper sx={{ width: '100%', p: 2, background: 'rgba(255, 255, 255, 0.12)' }}>
                    <Typography variant="subtitle2">{details?.info?.description}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Paper>
      </div>
    </>
  )
}

export default Watch
