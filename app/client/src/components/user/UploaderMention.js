import React from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import UserAvatar from './UserAvatar'

/**
 * The clickable "uploaded by" byline shown on media cards.
 *
 * Renders nothing when the media has no uploader, which is the case for
 * anonymous public uploads and for everything indexed off disk before ownership
 * existed — a byline reading "unknown" on most of an existing library would be
 * noise rather than information.
 */
const UploaderMention = ({ uploader, size = 18, showAvatar = true, sx = {} }) => {
  if (!uploader?.username) return null

  const label = uploader.name || uploader.username

  return (
    <Box
      component={Link}
      to={`/profile/${uploader.username}`}
      onClick={(e) => e.stopPropagation()}
      title={`View ${label}'s profile`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.65,
        minWidth: 0,
        maxWidth: '100%',
        textDecoration: 'none',
        color: '#B2BAC2',
        borderRadius: '6px',
        px: showAvatar ? 0.25 : 0.5,
        py: 0.15,
        transition: 'color 0.15s, background-color 0.15s',
        '&:hover': {
          color: '#66B2FF',
          backgroundColor: 'rgba(51, 153, 255, 0.10)',
        },
        '&:focus-visible': {
          outline: '2px solid #3399FF',
          outlineOffset: 2,
        },
        ...sx,
      }}
    >
      {showAvatar && <UserAvatar user={uploader} size={size} radius="50%" />}
      <Typography
        component="span"
        sx={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

export default UploaderMention
