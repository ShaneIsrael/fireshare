import React, { useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ReactPlayer from 'react-player'
import { Grid, Paper, Typography } from '@mui/material'
import { AuthService, VideoService } from '../services'
import { getServedBy, getUrl } from '../common/utils'
import Navbar from '../components/nav/Navbar'
import { Box } from '@mui/system'

import { Helmet } from 'react-helmet'
import NotFound from './NotFound'

const URL = getUrl()
const SERVED_BY = getServedBy()

function useQuery() {
  const { search } = useLocation()

  return React.useMemo(() => new URLSearchParams(search), [search])
}

const Watch = () => {
  const { id } = useParams()
  const query = useQuery()
  const time = query.get('t')
  const [details, setDetails] = React.useState(null)
  const [loggedIn, setLoggedIn] = React.useState(false)
  const [notFound, setNotFound] = React.useState(false)
  const navigate = useNavigate()
  const videoPlayerRef = useRef(null)

  React.useEffect(() => {
    async function fetch() {
      try {
        const resp = (await VideoService.getDetails(id)).data
        setDetails(resp)
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

  React.useEffect(() => {
    try {
      async function isLoggedIn() {
        setLoggedIn((await AuthService.isLoggedIn()).data)
      }
      isLoggedIn()
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }
  const handleLogin = async () => {
    try {
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  if (notFound) return <NotFound title={notFound.title} body={notFound.body} />

  const options = [{ name: loggedIn ? 'Logout' : 'Login', handler: loggedIn ? handleLogout : handleLogin }]

  return (
    <Navbar options={options}>
      <Helmet>
        <title>{details?.info?.title}</title>
        <meta property="og:type" value="video" />
        <meta property="og:url" value={window.location.href} />
        <meta property="og:title" value={details?.info?.title} />
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
      <Grid container>
        <Grid item xs={12}>
          <ReactPlayer
            ref={videoPlayerRef}
            url={`${
              SERVED_BY === 'nginx'
                ? `${URL}/_content/video/${id}${details?.extension || '.mp4'}`
                : `${URL}/api/video?id=${id}`
            }`}
            width="100%"
            height="auto"
            playing
            config={{
              file: { forcedAudio: true, attributes: { onLoadedMetadata: () => videoPlayerRef.current.seekTo(time) } },
            }}
            controls
          />
        </Grid>
        <Grid item xs={12}>
          <Paper elevation={3} width="100%" square sx={{ p: 1, mt: -1 }}>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1 }}>
              <Grid container>
                <Grid item xs sx={{ ml: 2 }}>
                  <Typography variant="overline" noWrap sx={{ fontWeight: 600, fontSize: 16 }}>
                    {details?.info.title}
                  </Typography>
                </Grid>
                <Grid item sx={{ mr: 2 }}>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 600, fontSize: 16 }}>
                    Views: {details?.info.views || '9,439,998'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <Grid container>
                <Grid item xs={12} sx={{ textAlign: 'center' }}>
                  <Typography variant="overline" noWrap align="center" sx={{ fontWeight: 600, fontSize: 16 }}>
                    {details?.info.title}
                  </Typography>
                </Grid>
                <Grid item xs={12} sx={{ textAlign: 'center' }}>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 600, fontSize: 16 }}>
                    Views: {details?.info.views || '9,439,998'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Navbar>
  )
}

export default Watch
