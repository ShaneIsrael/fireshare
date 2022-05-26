import React from 'react'
import VideoCardItem from './VideoCardItem'
import VisibilitySensor from 'react-visibility-sensor'
import { Grid } from '@mui/material'

const VisibilityCard = ({ video, openVideo, handleAlert, handleSelected, selected }) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <VisibilitySensor onChange={setVisible}>
      <Grid item>
        <VideoCardItem
          visible={visible}
          video={video}
          openVideoHandler={openVideo}
          alertHandler={handleAlert}
          selectedHandler={handleSelected}
          selected={selected === video.video_id}
        />
      </Grid>
    </VisibilitySensor>
  )
}
export default VisibilityCard
