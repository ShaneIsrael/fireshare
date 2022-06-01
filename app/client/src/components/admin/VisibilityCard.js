import React, { useRef } from 'react'
import { useIsVisible } from 'react-is-visible'
import { Grid } from '@mui/material'
import CompactVideoCard from './CompactVideoCard'

const VisibilityCard = ({
  video,
  openVideo,
  handleAlert,
  handleSelected,
  selected,
  cardWidth,
  feedView,
  authenticated,
  openDetailsModal,
}) => {
  const nodeRef = useRef()
  const isVisible = useIsVisible(nodeRef)
  return (
    <Grid item sx={{ width: cardWidth, mr: 2, mb: 2 }} ref={nodeRef}>
      <CompactVideoCard
        visible={isVisible}
        video={video}
        openVideoHandler={openVideo}
        alertHandler={handleAlert}
        selectedHandler={handleSelected}
        selected={selected === video.video_id}
        cardWidth={cardWidth}
        feedView={feedView}
        authenticated={authenticated}
        openDetailsModal={openDetailsModal}
      />
    </Grid>
  )
}
export default VisibilityCard
