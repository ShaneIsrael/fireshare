import { Slider } from '@mui/material'
import React from 'react'

const SliderWrapper = ({ width, cardSize, defaultCardSize, cardSizeMultiplier, onChangeCommitted }) => {
  const [value, setValue] = React.useState((cardSize / (defaultCardSize * cardSizeMultiplier)) * 100)
  return (
    <Slider
      sx={{ width }}
      value={value}
      min={35}
      onChange={(e, newValue) => setValue(newValue)}
      onChangeCommitted={onChangeCommitted}
    />
  )
}

export default SliderWrapper
