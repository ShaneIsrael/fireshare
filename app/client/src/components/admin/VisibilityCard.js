import React from 'react'
import VideoCardItem from './VideoCardItem'
import VisibilitySensor from 'react-visibility-sensor'
import { Grid } from '@mui/material'

const VisibilityCard = ({ video, openVideo, handleAlert, handleSelected, selected, cardWidth }) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <VisibilitySensor onChange={setVisible} partialVisibility={true} offset={{ botton: -350 }}>
      <Grid item xs="auto">
        <VideoCardItem
          visible={visible}
          video={video}
          openVideoHandler={openVideo}
          alertHandler={handleAlert}
          selectedHandler={handleSelected}
          selected={selected === video.video_id}
          cardWidth={cardWidth}
        />
      </Grid>
    </VisibilitySensor>
  )
}
export default VisibilityCard
