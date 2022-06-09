import React from 'react'
import Tooltip, { tooltipClasses } from '@mui/material/Tooltip'
import styled from '@emotion/styled'

const LTooltip = styled(({ className, ...props }) => <Tooltip {...props} classes={{ popper: className }} />)(
  ({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: '#ffffff',
      color: 'rgba(0, 0, 0, 0.87)',
      boxShadow: theme.shadows[1],
      fontSize: 11,
    },
  }),
)

const LightTooltip = (props) => {
  return <LTooltip {...props} />
}

export default LightTooltip
