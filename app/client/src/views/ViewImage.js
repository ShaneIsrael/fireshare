import React from 'react'
import { useParams } from 'react-router-dom'
import { Box, Divider, IconButton, Tooltip, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import NotFound from './NotFound'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { ImageService } from '../services'
import { getPublicImageUrl, getImageUrl, copyToClipboard } from '../common/utils'

const PURL = getPublicImageUrl()

const actionBtnSx = {
  color: '#FFFFFFB3',
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF1A',
  borderRadius: '8px',
  p: 1,
  '&:hover': { bgcolor: '#FFFFFF1A', color: 'white' },
}

const rowBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: '8px',
  px: 1.5,
  py: 1,
}

const ViewImage = ({ authenticated }) => {
  const { id } = useParams()
  const [details, setDetails] = React.useState(null)
  const [notFound, setNotFound] = React.useState(false)
  const [views, setViews] = React.useState(null)
  const [alert, setAlert] = React.useState({ open: false })
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const [gamePillColor, setGamePillColor] = React.useState(null)

  React.useEffect(() => {
    async function fetch() {
      try {
        const resp = (await ImageService.getDetails(id)).data
        const viewsResp = (await ImageService.getViews(id)).data
        setDetails(resp)
        setViews(viewsResp)
        ImageService.addView(id).catch(() => {})
      } catch (err) {
        if (err.response?.status === 404) {
          setNotFound({ title: "We're Sorry...", body: "The image you're looking for was not found." })
        } else {
          setAlert({ open: true, type: 'error', message: 'Failed to load image.' })
        }
      }
    }
    fetch()
  }, [id])

  const game = details?.game

  React.useEffect(() => {
    if (!game?.icon_url) {
      setGamePillColor(null)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const SIZE = 64
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, SIZE, SIZE)

      const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
      let bestColor = null
      let bestSaturation = -1

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]
        if (alpha < 128) continue

        const r = data[i] / 255
        const g = data[i + 1] / 255
        const b = data[i + 2] / 255

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const lightness = (max + min) / 2

        if (lightness < 0.15 || lightness > 0.92) continue

        const chroma = max - min
        const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))

        if (saturation > bestSaturation) {
          bestSaturation = saturation
          bestColor = [data[i], data[i + 1], data[i + 2]]
        }
      }

      setGamePillColor(bestSaturation > 0.2 ? bestColor : null)
    }

    img.onerror = () => setGamePillColor(null)
    img.src = game.icon_url
  }, [game?.icon_url])

  if (notFound) return <NotFound {...notFound} />

  const title = details?.info?.title || 'Untitled'
  const description = details?.info?.description || ''

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      {!details && <LoadingSpinner />}

      {details && (
        <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
          {/* Image viewer */}
          <Box
            style={{ flex: '1 1 auto', minHeight: 0, width: '100%', position: 'relative', backgroundColor: '#000' }}
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
          >
            {!imgLoaded && <LoadingSpinner />}
            <TransformWrapper
              minScale={1}
              maxScale={5}
              centerOnInit
              limitToBounds
              doubleClick={{ mode: 'toggle' }}
              panning={{ velocityDisabled: true }}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  src={getImageUrl(id)}
                  alt={title}
                  onLoad={() => setImgLoaded(true)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: imgLoaded ? 'block' : 'none',
                    userSelect: 'none',
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </Box>

          {/* Metadata panel */}
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: '#041223',
              borderTop: '1px solid #FFFFFF14',
              px: { xs: 2, sm: 3 },
              py: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              {/* Left: title + views/date */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 200 }}>
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: 16, sm: 21 },
                    color: 'white',
                    lineHeight: 1.3,
                    letterSpacing: '-0.03em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {views != null && (
                    <Typography sx={{ fontSize: 14, color: '#FFFFFF55' }}>
                      {(views.count ?? 0).toLocaleString()} {(views.count ?? 0) === 1 ? 'view' : 'views'}
                    </Typography>
                  )}
                  {details?.updated_at && (
                    <>
                      <Typography sx={{ fontSize: 14, color: '#FFFFFF55' }}>|</Typography>
                      <Typography sx={{ fontSize: 14, color: '#FFFFFF55' }}>
                        {new Date(details.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>

              {/* Right: game pill */}
              {game && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                  <Box
                    component={game.steamgriddb_id ? 'a' : 'div'}
                    href={game.steamgriddb_id ? `#/games/${game.steamgriddb_id}` : undefined}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      bgcolor: gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.15)` : '#FFFFFF14',
                      border: `1px solid ${gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.5)` : '#FFFFFF26'}`,
                      borderRadius: '8px',
                      px: 1,
                      py: 0.35,
                      textDecoration: 'none',
                      ...(game.steamgriddb_id && {
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.4)` : '#FFFFFF22',
                        },
                      }),
                    }}
                  >
                    {game.icon_url && (
                      <img
                        src={game.icon_url}
                        alt=""
                        style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                      />
                    )}
                    <Typography sx={{ fontSize: 12, color: 'white', whiteSpace: 'nowrap' }}>{game.name}</Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {description && (
              <Typography sx={{ fontSize: 14, color: '#FFFFFFB3', lineHeight: 1.6 }}>{description}</Typography>
            )}

            <Divider sx={{ borderColor: '#FFFFFF14' }} />

            {/* Share link */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ ...rowBoxSx, flex: 1 }}>
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: 12,
                    color: '#FFFFFF66',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {`${PURL}${id}`}
                </Typography>
                <Tooltip title="Copy link">
                  <IconButton
                    size="small"
                    onClick={() => {
                      copyToClipboard(PURL + id)
                      setAlert({ open: true, type: 'info', message: 'Link copied to clipboard' })
                    }}
                    sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.5, flexShrink: 0 }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Tooltip title="Download original">
                <IconButton size="small" component="a" href={`/api/image/original?id=${id}`} download sx={actionBtnSx}>
                  <DownloadIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </div>
      )}
    </>
  )
}

export default ViewImage
