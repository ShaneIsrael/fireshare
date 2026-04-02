import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  NativeSelect,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
} from '@mui/material'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import SaveIcon from '@mui/icons-material/Save'
import SensorsIcon from '@mui/icons-material/Sensors'
import RssFeedIcon from '@mui/icons-material/RssFeed'
import SendIcon from '@mui/icons-material/Send';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import FolderIcon from '@mui/icons-material/Folder'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import { ConfigService, VideoService, GameService } from '../services'
import { setSetting } from '../common/utils'
import LightTooltip from '../components/misc/LightTooltip'
import GameSearch from '../components/game/GameSearch'

import _ from 'lodash'
import WarningService from '../services/WarningService'
import adminSSE from '../services/AdminSSE'

const isValidDiscordWebhook = (url) => {
  const regex = /^https:\/\/discord\.com\/api\/webhooks\/\d{17,20}\/[\w-]{60,}$/
  return regex.test(url)
}
const isValidJson = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};
const jsonPlaceholder = 
`#Example JSON Data:
{
  "title": "Fireshare",
  "body": "New Fireshare Video Uploaded!",
  "type": "info" 
}`;

const Settings = () => {
  const [alert, setAlert] = React.useState({ open: false })
  const [config, setConfig] = React.useState()
  const [updatedConfig, setUpdatedConfig] = React.useState({})
  const [updateable, setUpdateable] = React.useState(false)
  const [discordUrl, setDiscordUrl] = React.useState('')
  const [webhookUrl, setWebhookUrl] = React.useState('')
  const [webhookJson, setWebhookJson] = React.useState('')//needed?
  const [showSteamGridKey, setShowSteamGridKey] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(0)
  const [transcodingStatus, setTranscodingStatus] = React.useState({
    enabled: false,
    gpu_enabled: false,
    is_running: false,
  })
  const [folderRules, setFolderRules] = React.useState([])
  const [deleteMenuAnchor, setDeleteMenuAnchor] = React.useState(null)
  const [deleteMenuRuleId, setDeleteMenuRuleId] = React.useState(null)
  const [editingFolder, setEditingFolder] = React.useState(null)
  const isDiscordUsed = discordUrl.trim() !== ''
  const isWebhookUsed = webhookUrl.trim() !== ''

const handleTestDiscordWebhook = async () => {
  const urlToTest = discordUrl || updatedConfig.integrations?.discord_webhook_url;
  if (!urlToTest) {
    setAlert({ open: true, message: 'Please enter a Discord Webhook URL first', type: 'error' });
    return;
  }
  try {
    const response = await fetch('/api/test-discord-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_url: urlToTest,
        video_url: "https://fireshare.test.worked"
      }),
    });
    const result = await response.json();
    if (response.ok) {
      setAlert({ open: true, message: 'Discord Test Sent!', type: 'success' });
    } else {
      setAlert({ open: true, message: result.error || 'Discord test failed', type: 'error' });
    }
  } catch (err) {
    console.error("Connection failed:", err);
    setAlert({ open: true, message: 'Network error connecting to server', type: 'error' });
  }
};

 const handleTestWebhook = async () => {
    let payloadToTest = {};
    try {
      payloadToTest = webhookJson ? JSON.parse(webhookJson) : (updatedConfig.integrations?.generic_webhook_payload || {});
    } catch (e) {
      setAlert({ open: true, message: 'Invalid JSON in payload field', type: 'error' });
      return;
    }
    const testData = {
      webhook_url: webhookUrl, 
      video_url: "https://fireshare.test.worked",
      payload: payloadToTest 
    };
    if (!webhookUrl) {
      setAlert({ open: true, message: 'Please enter a Webhook URL first', type: 'error' });
      return;
    }
    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      const result = await response.json();
      if (response.ok) {
        setAlert({ open: true, message: 'Test Webhook Sent!', type: 'success' });
      } else {
        setAlert({ open: true, message: result.error || 'Failed to send test', type: 'error' });
      }
    } catch (err) {
      console.error("Connection failed:", err);
      setAlert({ open: true, message: 'Network error connecting to server', type: 'error' });
    }
  };

  React.useEffect(() => {
    async function fetch() {
      try {
        // Fetch folder rules in parallel with config
        const [conf, rulesRes] = await Promise.all([ConfigService.getAdminConfig(), GameService.getFolderRules()])
        setConfig(conf.data)
        setUpdatedConfig(conf.data)
        setFolderRules(rulesRes.data)
        // Set transcoding enabled/gpu from config (only changes on container restart)
        if (conf.data.transcoding_status) {
          setTranscodingStatus((prev) => ({
            ...prev,
            enabled: conf.data.transcoding_status.enabled,
            gpu_enabled: conf.data.transcoding_status.gpu_enabled,
          }))
          // SSE will provide real-time is_running updates
        }
        await checkForWarnings()
      } catch (err) {
        console.error(err)
      }
    }
    fetch()
  }, [])

  React.useEffect(() => {
    if (activeTab === 4) {
      GameService.getFolderRules()
        .then((res) => setFolderRules(res.data))
        .catch((err) => console.error(err))
    }
  }, [activeTab])

  React.useEffect(() => {
    if (config && updatedConfig) {
      setUpdateable(!_.isEqual(config, updatedConfig))
    }
  }, [updatedConfig, config])

  // Subscribe to SSE for real-time transcoding status
  React.useEffect(() => {
    if (!transcodingStatus.enabled) return
    return adminSSE.subscribeTranscoding((data) => {
      setTranscodingStatus((prev) => ({ ...prev, is_running: data.is_running }))
    })
  }, [transcodingStatus.enabled])

  React.useEffect(() => {
    if (updatedConfig.integrations?.discord_webhook_url) {
      setDiscordUrl(updatedConfig.integrations.discord_webhook_url)
    }
  }, [updatedConfig])

  React.useEffect(() => {
    if (updatedConfig.integrations) {
      if (updatedConfig.integrations.generic_webhook_url) {
        setWebhookUrl(updatedConfig.integrations.generic_webhook_url);
      }

      if (updatedConfig.integrations.generic_webhook_payload) {
        const jsonString = JSON.stringify(updatedConfig.integrations.generic_webhook_payload, null, 2);
        setWebhookJson(jsonString);
      }
    }
  }, [updatedConfig]);

  const handleSave = async () => {
    try {
      await ConfigService.updateConfig(updatedConfig)
      setUpdateable(false)
      setConfig(_.cloneDeep(updatedConfig))
      setSetting('ui_config', updatedConfig.ui_config)
      window.dispatchEvent(new Event('ui_config_updated'))
      setAlert({ open: true, message: 'Settings Updated! Changes may take a minute to take effect.', type: 'success' })
    } catch (err) {
      console.error(err)
      setAlert({ open: true, message: err.response?.data || 'Error saving settings', type: 'error' })
    }
  }

  const handleCopyRssFeedUrl = () => {
    const url = `${window.location.origin}/api/feed/rss`
    navigator.clipboard.writeText(url)
    setAlert({
      open: true,
      type: 'info',
      message: 'URL copied to clipboard',
    })
  }

  const handleScan = async () => {
    try {
      await VideoService.scan()
      setAlert({
        open: true,
        type: 'info',
        message: 'Scan initiated. This could take a few minutes.',
      })
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Unknown Error',
      })
    }
  }

  const handleScanGames = async () => {
    try {
      const response = await VideoService.scanGames()
      if (response.status === 202) {
        // Scan started - GameScanStatus will update via AdminSSE
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setAlert({
          open: true,
          type: 'warning',
          message: 'A game scan is already in progress.',
        })
      } else {
        setAlert({
          open: true,
          type: 'error',
          message: err.response?.data?.error || 'Failed to start game scan',
        })
      }
    }
  }

  const handleScanDates = async () => {
    try {
      const response = await VideoService.scanDates()
      setAlert({
        open: true,
        type: 'success',
        message: `Date scan complete! Extracted ${response.data.dates_extracted} dates from ${response.data.videos_scanned} videos.`,
      })
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data?.error || 'Failed to scan videos for dates',
      })
    }
  }

  const handleDeleteFolderRule = async (unlinkVideos = false) => {
    const ruleId = deleteMenuRuleId
    setDeleteMenuAnchor(null)
    setDeleteMenuRuleId(null)
    if (!ruleId) return

    try {
      await GameService.deleteFolderRule(ruleId, unlinkVideos)
      const rulesRes = await GameService.getFolderRules()
      setFolderRules(rulesRes.data)
      setAlert({
        open: true,
        type: 'success',
        message: unlinkVideos ? 'Folder rule deleted and videos unlinked' : 'Folder rule deleted',
      })
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data?.error || 'Failed to delete folder rule',
      })
    }
  }

  const handleUpdateFolderRule = async (folderPath, game) => {
    try {
      await GameService.createFolderRule(folderPath, game.id)
      const rulesRes = await GameService.getFolderRules()
      setFolderRules(rulesRes.data)
      setEditingFolder(null)
      setAlert({
        open: true,
        type: 'success',
        message: `Updated: ${folderPath} → ${game.name}`,
      })
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data?.error || 'Failed to update folder rule',
      })
    }
  }

  const checkForWarnings = async () => {
    let warnings = await WarningService.getAdminWarnings()

    if (Object.keys(warnings.data).length === 0) return

    for (const warning of warnings.data) {
      // Check if this is the SteamGridDB warning
      if (warning.includes('SteamGridDB API key not configured')) {
        setAlert({
          open: true,
          type: 'warning',
          message: (
            <span>
              {warning.replace('Click here to set it up.', '')}
              <a
                href="#steamgrid-settings"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab(3)
                  setTimeout(() => {
                    document
                      .getElementById('steamgrid-api-key-field')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    document.getElementById('steamgrid-api-key-field')?.focus()
                  }, 100)
                }}
                style={{ color: '#2684FF', textDecoration: 'underline', cursor: 'pointer', marginLeft: '4px' }}
              >
                Click here to set it up.
              </a>
            </span>
          ),
        })
      } else {
        setAlert({
          open: true,
          type: 'warning',
          message: warning,
        })
      }
      await new Promise((r) => setTimeout(r, 2000)) //Without this a second Warning would instantly overwrite the first...
    }
  }

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)' }}>
        {/* Vertical Tabs */}
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            minWidth: 160,
            flexShrink: 0,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              alignItems: 'flex-start',
              textAlign: 'left',
            },
          }}
        >
          <Tab label="Privacy & Upload" />
          <Tab label="Sidebar" />
          <Tab label="Integrations" />
          <Tab label="Transcoding" />
          <Tab label="Folders" />
          <Tab label="Actions" />
        </Tabs>

        {/* Tab Content Panel */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            px: 4,
            py: 2,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Scrollable content area */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Privacy & Upload */}
            {activeTab === 0 && (
              <Stack spacing={2} sx={{ maxWidth: 500, pt: 2 }}>
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
                      checked={updatedConfig.app_config?.allow_public_game_tag || false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          app_config: { ...prev.app_config, allow_public_game_tag: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Allow Public Game Tagging"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.autoplay || false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: {
                            ...prev.ui_config,
                            autoplay: e.target.checked,
                          },
                        }))
                      }
                    />
                  }
                  label="Auto Play Videos"
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
              </Stack>
            )}

            {/* Sidebar */}
            {activeTab === 1 && (
              <Stack spacing={2} sx={{ maxWidth: 500 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_my_videos !== false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_my_videos: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="My Videos"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_public_videos !== false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_public_videos: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Public Videos"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_games !== false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_games: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Games"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_tags !== false}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_tags: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Tags"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updatedConfig.ui_config?.show_folder_dropdown === true}
                      onChange={(e) =>
                        setUpdatedConfig((prev) => ({
                          ...prev,
                          ui_config: { ...prev.ui_config, show_folder_dropdown: e.target.checked },
                        }))
                      }
                    />
                  }
                  label="Folder Dropdown"
                />
              </Stack>
            )}

            {/* Integrations */}
            {activeTab === 2 && (
              <Stack spacing={2} sx={{ maxWidth: 500, pt: 2 }}>
                <header>Notifications</header>
                <TextField
                  size="small"
                  label="Discord Webhook URL"
                  value={discordUrl}
                  error={discordUrl !== '' && !isValidDiscordWebhook(discordUrl)}
                  helperText={
                    discordUrl !== '' && !isValidDiscordWebhook(discordUrl)
                      ? 'Webhook Format should look like: https://discord.com/api/webhooks/12345/fj8903k'
                      : 
                      <span>
                      Get Discord Webhook for you Server Channel - {' '}
                      <a
                        href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2684FF', textDecoration: 'none' }}
                      >
                        Docs
                      </a>
                    </span>
                  }
                  onChange={(e) => {
                    const url = e.target.value
                    setDiscordUrl(url)
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      integrations: {
                        ...prev.integrations,
                        discord_webhook_url: url,
                      },
                    }))
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  // Change this from handleCopyRssFeedUrl to your new function
                  onClick={handleTestDiscordWebhook}
                  sx={{ 
                    borderColor: 'rgba(255, 255, 255, 0.23)', 
                    color: '#fff',
                    '&:hover': {
                      borderColor: '#fff',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)'
                    }
                  }}
                >
                  Test Webhook
                </Button>



              <span></span> {/* Probably A better way to do this */}
              <span></span>
              
                <TextField
                  size="small"
                  label="Generic Webhook"
                  value={webhookUrl}
                  // error={webhookUrl !== '' && !isValidDiscordWebhook(webhookUrl)} //NEED TO VALIDATE HERE!!!!!
                  helperText={
                    <span>
                      Used for API POST to Generic Webhook Endpoint - {' '}
                      <a
                        href="https://zapier.com/blog/what-are-webhooks/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2684FF', textDecoration: 'none' }}
                      >
                        Example
                      </a>
                    </span>
                  }
                  onChange={(e) => {
                    const url = e.target.value
                    setWebhookUrl(url)
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      integrations: {
                        ...prev.integrations,
                        generic_webhook_url: url,
                      },
                    }))
                  }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  size="small"
                  label="Generic Webhook JSON Payload"
                  value={webhookJson}
                  placeholder={jsonPlaceholder}
                  error={webhookJson !== '' && !isValidJson(webhookJson)}
                  helperText={
                    webhookJson !== '' && !isValidJson(webhookJson) 
                      ? "Invalid JSON format" 
                      : "Add Valid JSON, with data from the docs of your webhook provider"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setWebhookJson(val);
                    
                    // Only update the config if the JSON is actually valid
                    if (isValidJson(val)) {
                      setUpdatedConfig((prev) => ({
                        ...prev,
                        integrations: {
                          ...prev.integrations,
                          generic_webhook_payload: JSON.parse(val),
                        },
                      }));
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  // Change this from handleCopyRssFeedUrl to your new function
                  onClick={handleTestWebhook}
                  sx={{ 
                    borderColor: 'rgba(255, 255, 255, 0.23)', 
                    color: '#fff',
                    '&:hover': {
                      borderColor: '#fff',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)'
                    }
                  }}
                >
                  Test Webhook
                </Button>
                <Divider />



                <header>Game Tagging</header>
                <TextField
                  id="steamgrid-api-key-field"
                  size="small"
                  label="SteamGridDB API Key"
                  type={showSteamGridKey ? 'text' : 'password'}
                  value={updatedConfig.integrations?.steamgriddb_api_key || ''}
                  helperText={
                    <span>
                      Get a free API key at{' '}
                      <a
                        href="https://www.steamgriddb.com/profile/preferences/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2684FF', textDecoration: 'none' }}
                      >
                        SteamGridDB
                      </a>
                    </span>
                  }
                  onChange={(e) => {
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      integrations: {
                        ...prev.integrations,
                        steamgriddb_api_key: e.target.value,
                      },
                    }))
                  }}
                  InputProps={{
                    endAdornment: (
                      <Box
                        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => setShowSteamGridKey(!showSteamGridKey)}
                      >
                        {showSteamGridKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </Box>
                    ),
                  }}
                />
                <Divider />
                <header>RSS</header>
                <TextField
                  size="small"
                  label="RSS Feed Title"
                  value={updatedConfig.rss_config?.title || ''}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      rss_config: { ...(prev.rss_config || {}), title: e.target.value },
                    }))
                  }
                />
                <TextField
                  size="small"
                  label="RSS Feed Description"
                  multiline
                  rows={2}
                  value={updatedConfig.rss_config?.description || ''}
                  onChange={(e) =>
                    setUpdatedConfig((prev) => ({
                      ...prev,
                      rss_config: { ...(prev.rss_config || {}), description: e.target.value },
                    }))
                  }
                />
                <Button
                  variant="outlined"
                  startIcon={<RssFeedIcon />}
                  fullWidth
                  onClick={handleCopyRssFeedUrl}
                  sx={{ borderColor: 'rgba(255, 255, 255, 0.23)', color: '#fff' }}
                >
                  Copy RSS Feed URL
                </Button>
              </Stack>
            )}

            {/* Transcoding */}
            {activeTab === 3 && (
              <Stack spacing={2} sx={{ maxWidth: 500, pt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Transcoding will convert your videos to multiple quality levels to allow for additional quality
                  selection options when streaming from Fireshare.
                </Typography>
                {!transcodingStatus.enabled ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Tooltip title="Set ENABLE_TRANSCODING=true in your docker container to enable.">
                      <Chip label="Disabled" color="error" size="small" sx={{ cursor: 'default' }} />
                    </Tooltip>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1 }}>
                      <Chip label="Enabled" color="success" size="small" />
                      {transcodingStatus.gpu_enabled && <Chip label="GPU Enabled" color="info" size="small" />}
                      {transcodingStatus.is_running && <Chip label="Running" color="warning" size="small" />}
                    </Box>
                    <FormControl fullWidth size="small">
                      <InputLabel variant="standard" htmlFor="encoder-preference">
                        Encoder Preference
                      </InputLabel>
                      <NativeSelect
                        value={updatedConfig.transcoding?.encoder_preference || 'auto'}
                        inputProps={{ id: 'encoder-preference' }}
                        onChange={(e) =>
                          setUpdatedConfig((prev) => ({
                            ...prev,
                            transcoding: { ...prev.transcoding, encoder_preference: e.target.value },
                          }))
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="h264">H.264</option>
                        <option value="av1">AV1</option>
                      </NativeSelect>
                    </FormControl>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">Resolutions:</Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={updatedConfig.transcoding?.enable_1080p !== false}
                            onChange={(e) =>
                              setUpdatedConfig((prev) => ({
                                ...prev,
                                transcoding: { ...prev.transcoding, enable_1080p: e.target.checked },
                              }))
                            }
                          />
                        }
                        label="1080p"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={updatedConfig.transcoding?.enable_720p !== false}
                            onChange={(e) =>
                              setUpdatedConfig((prev) => ({
                                ...prev,
                                transcoding: { ...prev.transcoding, enable_720p: e.target.checked },
                              }))
                            }
                          />
                        }
                        label="720p"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={updatedConfig.transcoding?.enable_480p !== false}
                            onChange={(e) =>
                              setUpdatedConfig((prev) => ({
                                ...prev,
                                transcoding: { ...prev.transcoding, enable_480p: e.target.checked },
                              }))
                            }
                          />
                        }
                        label="480p"
                      />
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={updatedConfig.transcoding?.auto_transcode !== false}
                          onChange={(e) =>
                            setUpdatedConfig((prev) => ({
                              ...prev,
                              transcoding: { ...prev.transcoding, auto_transcode: e.target.checked },
                            }))
                          }
                        />
                      }
                      label="Automatically transcode new videos"
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {!transcodingStatus.is_running ? (
                        <Button
                          variant="contained"
                          startIcon={<PlayArrowIcon />}
                          onClick={async () => {
                            try {
                              await ConfigService.startTranscoding()
                            } catch (err) {
                              setAlert({ open: true, message: err.response?.data || 'Failed to start', type: 'error' })
                            }
                          }}
                          fullWidth
                        >
                          Transcode All Videos
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<StopIcon />}
                          onClick={async () => {
                            try {
                              await ConfigService.cancelTranscoding()
                              window.dispatchEvent(new Event('transcodingCancelled'))
                            } catch (err) {
                              setAlert({ open: true, message: err.response?.data || 'Failed to cancel', type: 'error' })
                            }
                          }}
                          fullWidth
                        >
                          Cancel Transcoding
                        </Button>
                      )}
                    </Box>
                  </>
                )}
              </Stack>
            )}


            {/* Folders */}
            {activeTab === 4 && (
              <Stack spacing={2} sx={{ maxWidth: 500 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="overline" sx={{ fontWeight: 700, fontSize: 18 }}>
                    Folder Rules
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clips in these folders will be linked to the selected game. Modify these if your setup is not
                    detected automatically.
                  </Typography>
                </Box>
                {folderRules.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    No folders found.
                  </Typography>
                ) : (
                  <Box sx={{ maxHeight: 800, overflowY: 'auto', pr: 1 }}>
                    <Stack spacing={1}>
                      {folderRules.map((item) => (
                        <Box
                          key={item.folder_path}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            borderRadius: '8px',
                            bgcolor: '#FFFFFF0D',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                            <FolderIcon sx={{ color: '#FFFFFF66' }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
                                {item.folder_path}
                                <Typography component="span" sx={{ fontSize: 12, ml: 1, color: '#FFFFFF55' }}>
                                  ({item.video_count} videos)
                                </Typography>
                              </Typography>
                              {editingFolder === item.folder_path ? (
                                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ flex: 1 }}>
                                    <GameSearch
                                      placeholder="Search for a game..."
                                      onGameLinked={(game) => handleUpdateFolderRule(item.folder_path, game)}
                                      onError={() =>
                                        setAlert({ open: true, type: 'error', message: 'Failed to search games' })
                                      }
                                      onWarning={(msg) => setAlert({ open: true, type: 'warning', message: msg })}
                                    />
                                  </Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => setEditingFolder(null)}
                                    sx={{ color: '#FFFFFF66' }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              ) : item.rule ? (
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: '#3399FF',
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                  onClick={() => setEditingFolder(item.folder_path)}
                                >
                                  → {item.rule.game?.name || 'Unknown game'}
                                </Typography>
                              ) : item.suggested_game ? (
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: '#FFB74D',
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                  onClick={() => handleUpdateFolderRule(item.folder_path, item.suggested_game)}
                                >
                                  Suggested: {item.suggested_game.name} (click to apply)
                                </Typography>
                              ) : (
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: '#FFFFFF55',
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                  onClick={() => setEditingFolder(item.folder_path)}
                                >
                                  No game linked - click to add
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {item.rule && (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setDeleteMenuAnchor(e.currentTarget)
                                setDeleteMenuRuleId(item.rule.id)
                              }}
                              sx={{ color: '#FFFFFF66' }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
                <Menu
                  anchorEl={deleteMenuAnchor}
                  open={Boolean(deleteMenuAnchor)}
                  onClose={() => {
                    setDeleteMenuAnchor(null)
                    setDeleteMenuRuleId(null)
                  }}
                >
                  <MenuItem onClick={() => handleDeleteFolderRule(false)}>Delete rule only</MenuItem>
                  <MenuItem onClick={() => handleDeleteFolderRule(true)}>Delete rule & unlink videos</MenuItem>
                </Menu>
              </Stack>
            )}

            {/* Actions */}
            {activeTab === 5 && (
              <Stack spacing={2} sx={{ maxWidth: 500, pt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SensorsIcon />}
                  onClick={handleScan}
                  size="large"
                  sx={{ width: '100%', maxWidth: 400 }}
                >
                  Scan for New Videos
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SportsEsportsIcon />}
                  onClick={handleScanGames}
                  size="large"
                  sx={{ width: '100%', maxWidth: 400 }}
                >
                  Scan for Missing Games
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CalendarMonthIcon />}
                  onClick={handleScanDates}
                  size="large"
                  sx={{ width: '100%', maxWidth: 400 }}
                >
                  Scan for Missing Dates
                </Button>
              </Stack>
            )}
          </Box>

          {/* Save button pinned to bottom */}
          {activeTab !== 4 && activeTab !== 5 && activeTab !== 6 && (
            <Box sx={{ pt: 2, maxWidth: 500, flexShrink: 0 }}>
              <Divider sx={{ mb: 2 }} />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!updateable || (!isValidDiscordWebhook(discordUrl) && isDiscordUsed)}
                onClick={handleSave}
                fullWidth
              >
                Save Changes
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </>
  )
}

export default Settings
