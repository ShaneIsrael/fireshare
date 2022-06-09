import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Modal from '@mui/material/Modal'
import CancelIcon from '@mui/icons-material/Cancel'
import DeleteIcon from '@mui/icons-material/Delete'

import { ButtonGroup, Stack, TextField } from '@mui/material'
import { VideoService } from '../../services'
import LightTooltip from '../misc/LightTooltip'

//
const style = {
  position: 'absolute',
  top: '50%',
  left: '49.5%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  background: '#0B2545',
  border: '2px solid #086BFF9B',
  boxShadow: 24,
  p: 4,
}

const UpdateDetailsModal = ({ open, close, videoId, currentTitle, currentDescription, alertHandler }) => {
  const [title, setTitle] = React.useState(currentTitle)
  const [description, setDescription] = React.useState(currentDescription)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const onTitleChange = (e) => setTitle(e.target.value)
  const onDescriptionChange = (e) => setDescription(e.target.value)

  const handleClose = (update) => {
    setConfirmDelete(false)
    close(update)
  }

  const handleSave = async () => {
    const update = {
      title: title || currentTitle,
      description: description || currentDescription,
    }
    try {
      await VideoService.updateDetails(videoId, update)
      alertHandler({
        open: true,
        type: 'success',
        message: 'Video details updated!',
      })
    } catch (err) {
      alertHandler({
        open: true,
        type: 'error',
        message: `${err.respnose?.data || 'An unknown error occurred attempting to save video details'}`,
      })
    }
    handleClose(update)
  }

  const handleDelete = async () => {
    try {
      await VideoService.delete(videoId)
      alertHandler({
        open: true,
        type: 'success',
        message: 'Video has been deleted.',
      })
      handleClose('delete')
    } catch (err) {
      alertHandler({
        open: true,
        type: 'error',
        message: `${err.respnose?.data || 'An unknown error occurred attempting to delete the video'}`,
      })
    }
  }

  React.useEffect(() => {
    function update() {
      setTitle(currentTitle)
      setDescription(currentDescription)
    }
    update()
  }, [currentTitle, currentDescription])

  return (
    <Modal
      open={open}
      onClose={() => handleClose(null)}
      aria-labelledby="modal-update-details-title"
      aria-describedby="modal-update-details-description"
    >
      <Box sx={style}>
        <Stack spacing={2}>
          <TextField
            id="modal-update-details-title"
            label="Video Title"
            value={title !== null ? title : currentTitle}
            onChange={onTitleChange}
          />
          <TextField
            id="modal-update-details-description"
            label="Video Description"
            value={description !== null ? description : currentDescription}
            onChange={onDescriptionChange}
            multiline
            rows={4}
          />
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>

          {confirmDelete ? (
            <ButtonGroup fullWidth>
              <Button variant="outlined" startIcon={<CancelIcon />} onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
                Delete
              </Button>
            </ButtonGroup>
          ) : (
            <LightTooltip
              title="This will delete the associated file, this action is not reverseable."
              placement="bottom"
              enterDelay={1000}
              leaveDelay={500}
              enterNextDelay={1000}
              arrow
            >
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete File
              </Button>
            </LightTooltip>
          )}
        </Stack>
      </Box>
    </Modal>
  )
}

export default UpdateDetailsModal
