import React from 'react'
import { Box } from '@mui/material'

const OutlinedIconButton = React.forwardRef(function OutlinedIconButton({ icon, children, onClick, sx, ...rest }, ref) {
  return (
    <Box
      ref={ref}
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: 38,
        px: 1.5,
        border: '1px solid #FFFFFF33',
        borderRadius: '8px',
        bgcolor: 'transparent',
        color: '#FFFFFFCC',
        fontSize: 13,
        fontFamily: 'inherit',
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        outline: 'none',
        '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
        ...sx,
      }}
      {...rest}
    >
      {icon}
      {children}
    </Box>
  )
})

export default OutlinedIconButton
