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

  const previewVideoHeight =
    video.info?.width && video.info?.height ? cardWidth * (video.info.height / video.info.width) : cardWidth / 1.77

  return (
    <Grid item sx={{ width: cardWidth, ml: 0.75, mr: 0.75, mb: 1.5 }} ref={nodeRef}>
      {isVisible ? (
        <CompactVideoCard
          visible={false}
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
      ) : (
        <div
          // calculate the rendered cards height based on the video dimesions and our css styling heights
          style={{
            width: cardWidth,
            background: '#000e393b',
            height: previewVideoHeight + 32,
          }}
        />
      )}
    </Grid>
  )
}
export default VisibilityCard
