import React from 'react'
import { Chip } from '@mui/material'

/**
 * Reusable tag chip. Use size="small" for video cards, default for previews.
 * Props:
 *   name   - display name (underscores replaced with spaces automatically)
 *   color  - hex color string
 *   href   - optional, makes the chip a clickable link
 *   size   - "small" (compact card style) | "medium" (default, preview style)
 */
const TagChip = ({ name, color, href, size = 'medium', onDelete, ...rest }) => {
  const displayName = name ? name.replace(/_/g, ' ') : ''
  const bg = color ? `${color}90` : '#FFFFFF14'
  const border = color ? `${color}90` : '#FFFFFF14'

  const smallSx = {
    height: 18,
    fontSize: 11,
    '& .MuiChip-label': { px: 0.75 },
    '&:hover': {
      bgcolor: color ? `${color}55` : '#FFFFFF22',
      color: 'white',
    },
  }

  const mediumSx = {
    borderRadius: 2,
    py: 2,
  }

  const deleteSx = onDelete
    ? { '& .MuiChip-deleteIcon': { color: '#FFFFFF66', '&:hover': { color: 'white' } } }
    : {}

  return (
    <Chip
      label={displayName}
      size={size}
      component={href ? 'a' : undefined}
      href={href}
      onClick={href ? (e) => e.stopPropagation() : undefined}
      onDelete={onDelete}
      sx={{
        bgcolor: bg,
        color: '#FFF',
        border: '1px solid',
        borderColor: border,
        position: 'relative',
        overflow: 'hidden',
        cursor: href ? 'pointer' : 'default',
        ...(size === 'small' ? smallSx : mediumSx),
        ...deleteSx,
      }}
      {...rest}
    />
  )
}

export default TagChip
