import React from 'react'
import { Box } from '@mui/material'

// Deterministic colour per username so an avatar-less account still reads as a
// distinct person, and keeps the same colour everywhere it appears.
const GRADIENTS = [
  ['#2B5C8F', '#0A1929'],
  ['#6D28D9', '#2A1B4A'],
  ['#0E7490', '#0A2A33'],
  ['#B45309', '#3A1F06'],
  ['#B91C1C', '#3A1010'],
  ['#15803D', '#0C2A17'],
  ['#A21CAF', '#3A0B3E'],
  ['#0369A1', '#082F49'],
]

const hashString = (value) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const gradientFor = (username) => GRADIENTS[hashString(username || '?') % GRADIENTS.length]

const UserAvatar = ({ user, size = 40, radius, sx = {}, fontSize }) => {
  const [broken, setBroken] = React.useState(false)
  const name = user?.name || user?.display_name || user?.username || '?'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const [from, to] = gradientFor(user?.username)
  const showImage = Boolean(user?.avatar_url) && !broken

  React.useEffect(() => {
    setBroken(false)
  }, [user?.avatar_url])

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius ?? `${Math.max(6, Math.round(size * 0.22))}px`,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: showImage ? 'transparent' : `linear-gradient(150deg, ${from}, ${to})`,
        color: '#fff',
        fontWeight: 700,
        fontSize: fontSize ?? Math.max(11, Math.round(size * 0.42)),
        lineHeight: 1,
        userSelect: 'none',
        ...sx,
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={user.avatar_url}
          alt={name}
          onError={() => setBroken(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        initial
      )}
    </Box>
  )
}

export default UserAvatar
