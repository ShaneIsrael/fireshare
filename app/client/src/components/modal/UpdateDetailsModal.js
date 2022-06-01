import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Modal from '@mui/material/Modal'
import { Stack, TextField } from '@mui/material'
import { VideoService } from '../../services'

//
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  background: '#1D005F',
  border: '1px solid #fff',
  boxShadow: 24,
  p: 4,
}

const UpdateDetailsModal = ({ open, close, videoId, currentTitle, currentDescription, alertHandler }) => {
  const [title, setTitle] = React.useState(currentTitle)
  const [description, setDescription] = React.useState(currentDescription)

  const onTitleChange = (e) => setTitle(e.target.value)
  const onDescriptionChange = (e) => setDescription(e.target.value)

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
    close(update)
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
      onClose={() => close(null)}
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
        </Stack>
      </Box>
    </Modal>
  )
}

export default UpdateDetailsModal
