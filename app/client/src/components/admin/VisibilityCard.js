import React from 'react'
import VideoCardItem from './VideoCardItem'
import VisibilitySensor from 'react-visibility-sensor'

const VisibilityCard = ({ video, openVideo, handleAlert, handleSelected, selected }) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <VisibilitySensor onChange={setVisible} partialVisibility={true}>
      <VideoCardItem
        sx={{ position: 'relative' }}
        visible={visible}
        video={video}
        openVideoHandler={openVideo}
        alertHandler={handleAlert}
        selectedHandler={handleSelected}
        selected={selected === video.video_id}
      />
    </VisibilitySensor>
  )
}
export default VisibilityCard
