import React, { useRef } from 'react'
import VideoCardItem from './VideoCardItem'
import { useIsVisible } from 'react-is-visible'
import { Grid } from '@mui/material'

const VisibilityCard = ({
  video,
  openVideo,
  handleAlert,
  handleSelected,
  selected,
  cardWidth,
  feedView,
  authenticated,
}) => {
  const nodeRef = useRef()
  const isVisible = useIsVisible(nodeRef)
  return (
    <Grid item xs="auto" ref={nodeRef}>
      <VideoCardItem
        visible={isVisible}
        video={video}
        openVideoHandler={openVideo}
        alertHandler={handleAlert}
        selectedHandler={handleSelected}
        selected={selected === video.video_id}
        cardWidth={cardWidth}
        feedView={feedView}
        authenticated={authenticated}
      />
    </Grid>
  )
}
export default VisibilityCard
