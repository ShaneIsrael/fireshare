import React from 'react'
import { Box, Button, Divider, Grid, Stack, TextField, ToggleButton, Typography } from '@mui/material'
import Navbar from '../components/nav/Navbar'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { ConfigService } from '../services'
import LightTooltip from '../components/misc/LightTooltip'

import _ from 'lodash'

const Settings = ({ authenticated }) => {
  const [alert, setAlert] = React.useState({ open: false })
  const [config, setConfig] = React.useState()
  const [updatedConfig, setUpdatedConfig] = React.useState({})
  const [updateable, setUpdateable] = React.useState(false)

  React.useEffect(() => {
    async function fetch() {
      try {
        const conf = (await ConfigService.getAdminConfig()).data
        setConfig(conf)
        setUpdatedConfig(conf)
      } catch (err) {
        console.error(err)
      }
    }
    fetch()
  }, [])

  React.useEffect(() => {
    setUpdateable(!_.isEqual(config, updatedConfig))
  }, [updatedConfig, config])

  const handleSave = async () => {
    try {
      await ConfigService.updateConfig(updatedConfig)
      setUpdateable(false)
      setConfig((prev) => ({ ...prev, ...updatedConfig }))
      setAlert({ open: true, message: 'Config Updated!', type: 'success' })
    } catch (err) {
      console.error(err)
      setAlert({ open: true, message: err.response.data, type: 'error' })
    }
  }
  const pages = [
    { name: 'View Admin', href: '/' },
    { name: 'View Feed', href: '/feed' },
  ]
  return (
    <Navbar pages={pages} authenticated={authenticated}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ overflow: 'hidden', height: '100%' }}>
        <Grid container item justifyContent="center" spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Grid container sx={{ pr: 2, pl: 2 }}>
              <Grid item xs sx={{ display: { xs: 'flex', sm: 'none' } }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    letterSpacing: '.2rem',
                    color: 'inherit',
                    textDecoration: 'none',
                    ml: 1,
                  }}
                >
                  Settings
                </Typography>
              </Grid>
              <Grid item xs sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    letterSpacing: '.2rem',
                    color: 'inherit',
                    textDecoration: 'none',
                    ml: 1,
                  }}
                >
                  Settings
                </Typography>
              </Grid>
            </Grid>
            <Divider light />
          </Grid>
          <Grid item>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                maxWidth: {
                  xs: 400,
                  sm: 500,
                },
                p: 4,
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <LightTooltip
                    title={updatedConfig.app_config?.video_defaults?.private ? 'Private' : 'Public'}
                    placement="top"
                    enterDelay={500}
                    leaveDelay={500}
                    enterNextDelay={1000}
                  >
                    <ToggleButton
                      size="small"
                      value="check"
                      selected={updatedConfig.app_config?.video_defaults?.private || true}
                      onChange={() => {
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          app_config: { video_defaults: { private: !prev.app_config.video_defaults.private } },
                        }))
                      }}
                      sx={{ mr: 2 }}
                    >
                      {updatedConfig.app_config?.video_defaults?.private && <VisibilityOffIcon />}
                      {!updatedConfig.app_config?.video_defaults?.private && <VisibilityIcon />}
                    </ToggleButton>
                  </LightTooltip>

                  <Typography variant="overline" sx={{ fontWeight: 700, fontSize: 14 }}>
                    Default Video Privacy
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  label="Shareable Link Domain"
                  value={updatedConfig.ui_config?.shareable_link_domain || ''}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      ui_config: { shareable_link_domain: e.target.value },
                    }))
                  }
                />
              </Stack>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ mb: 2 }} light />
            <Box sx={{ display: 'flex', width: '100%', pr: 2 }} justifyContent="flex-end">
              <Button variant="contained" startIcon={<SaveIcon />} disabled={!updateable} onClick={handleSave}>
                Save Changes
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Navbar>
  )
}

export default Settings
