import React from 'react'
import { Chip } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

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
  const accentColor = color || '#2684FF'
  const isInternalHref = href?.startsWith('/')

  const smallSx = {
    height: 22,
    fontSize: 11,
    '& .MuiChip-label': { px: 0.75 },
    '&:hover': {
      bgcolor: `${accentColor}25`,
      color: 'white',
    },
    borderRadius: '6px',
  }

  const mediumSx = {
    borderRadius: '6px',
    py: 2,
  }

  const deleteSx = onDelete ? { '& .MuiChip-deleteIcon': { color: '#FFFFFF66', '&:hover': { color: 'white' } } } : {}

  return (
    <Chip
      label={displayName}
      size={size}
      component={href ? (isInternalHref ? RouterLink : 'a') : undefined}
      to={isInternalHref ? href : undefined}
      href={isInternalHref ? undefined : href}
      onClick={href ? (e) => e.stopPropagation() : undefined}
      onDelete={onDelete}
      sx={{
        bgcolor: `${accentColor}18`,
        color: '#FFF',
        border: '1px solid',
        borderColor: `${accentColor}44`,
        // Left accent stripe
        boxShadow: `inset 3px 0 0 ${accentColor}`,
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
