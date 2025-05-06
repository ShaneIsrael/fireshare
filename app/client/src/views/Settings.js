import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from '@mui/material'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import SaveIcon from '@mui/icons-material/Save'
import SensorsIcon from '@mui/icons-material/Sensors'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { ConfigService, VideoService } from '../services'
import LightTooltip from '../components/misc/LightTooltip'

import _ from 'lodash'
import WarningService from "../services/WarningService";

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
        await checkForWarnings()
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
      setAlert({ open: true, message: 'Settings Updated! Changes may take a minute to take effect.', type: 'success' })
    } catch (err) {
      console.error(err)
      setAlert({ open: true, message: err.response.data, type: 'error' })
    }
  }

  const handleScan = async () => {
    VideoService.scan().catch((err) =>
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Unknown Error',
      }),
    )
    setAlert({
      open: true,
      type: 'info',
      message: 'Scan initiated. This could take a few minutes.',
    })
  }

  const checkForWarnings  = async () =>{
      let warnings = await WarningService.getAdminWarnings()

      if (Object.keys(warnings.data).length === 0)
          return;

      for (const warning of warnings.data) {
          setAlert({
              open: true,
              type: 'warning',
              message: warning,
          });
          await new Promise(r => setTimeout(r, 2000)); //Without this a second Warning would instantly overwrite the first...
      }
  }

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ height: '100%' }}>
        <Grid container item justifyContent="center" spacing={2}>
          <Grid item xs={12}>
            <Grid container sx={{ pr: 2, pl: 2 }}>
              <Grid item xs sx={{ display: { xs: 'flex', sm: 'none' } }}></Grid>
            </Grid>
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
                          app_config: {
                            ...prev.app_config,
                            video_defaults: { private: !prev.app_config.video_defaults.private },
                          },
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.app_config?.allow_public_upload || false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          app_config: { ...prev.app_config, allow_public_upload: e.target.checked },
                          ui_config: {
                            ...prev.ui_config,
                            show_public_upload: !e.target.checked ? false : prev.ui_config.show_public_upload,
                          },
                        }))
                      }
                    />
                  }
                  label="Allow Public Upload"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_admin_upload || false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_admin_upload: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Show Admin Upload Card"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_public_upload || false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_public_upload: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Show Public Upload Card"
                />
                <TextField
                  size="small"
                  label="Shareable Link Domain"
                  value={updatedConfig.ui_config?.shareable_link_domain || ''}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      ui_config: { ...prev.ui_config, shareable_link_domain: e.target.value },
                    }))
                  }
                />
                <TextField
                  size="small"
                  label="Public Upload Folder Name"
                  value={updatedConfig.app_config?.public_upload_folder_name || ''}
                  disabled={!updatedConfig.app_config?.allow_public_upload}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      app_config: { ...prev.app_config, public_upload_folder_name: e.target.value },
                    }))
                  }
                />
                <TextField
                  size="small"
                  label="Admin Upload Folder Name"
                  value={updatedConfig.app_config?.admin_upload_folder_name || ''}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      app_config: { ...prev.app_config, admin_upload_folder_name: e.target.value },
                    }))
                  }
                />
                <Divider></Divider>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.autoplay || false}  
                      onChange={(e) => 
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { 
                            ...prev.ui_config, 
                            autoplay: e.target.checked  
                          }
                        }))
                      }
                    />
                  }
                  label="Auto Play Videos"
                />
                <Button variant="contained" startIcon={<SaveIcon />} disabled={!updateable} onClick={handleSave}>
                  Save Changes
                </Button>
              </Stack>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ mb: 2 }} light />
            <Box sx={{ display: 'flex', width: '100%', pr: 2 }} justifyContent="flex-start">
              <Button variant="contained" startIcon={<SensorsIcon />} onClick={handleScan}>
                Scan Library
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
  )
}

export default Settings
