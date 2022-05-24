import React from 'react'
import { useParams } from 'react-router-dom'
import ReactPlayer from 'react-player'
import { Grid, Paper, Typography } from '@mui/material'
import { VideoService } from '../services'
import { getUrl } from '../common/utils'

const URL = getUrl()

const Watch = () => {
  const { id } = useParams()
  const [details, setDetails] = React.useState(null)

  React.useEffect(() => {
    async function fetch() {
      const resp = (await VideoService.getDetails(1)).data
      setDetails(resp)
    }
    if (details == null) fetch()
  }, [details])

  return (
    <Grid container>
      <Grid item xs={12}>
        <ReactPlayer url={`${URL}/api/video?id=${id}`} width="100%" height="auto" controls />
      </Grid>
      <Grid item xs={12}>
        <Paper elevation={3} width="100%" square sx={{ p: 1, mt: -0.5 }}>
          <Grid container justifyContent="center">
            <Grid item xs sx={{ ml: 2 }}>
              <Typography variant="h4">{details?.title}</Typography>
            </Grid>
            <Grid item sx={{ mr: 2 }}>
              <Typography variant="overline" color="primary" sx={{ fontSize: 14, fontWeight: 600 }}>
                Views: {details?.views}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  )
}

export default Watch
