import React from 'react'
import { Grid, IconButton, TextField } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import { lightBlue } from '@mui/material/colors'
import Autocomplete from '@mui/material/Autocomplete'
import { VideoService } from '../../services'


const UploadModal = (folders) => {
    const createSelectFolders = (items) => {
        return items.map((f) => ({ id: f, label: f }))
    }
    const inputFile = React.useRef(null)
    const [folder, setFolder] = React.useState(null)

    const handleFileUpload = (event) => {
        inputFile.current.click();

    }
    const onFolderUpdate = (event, folder) => {
        setFolder(folder.label)
    }

    const onFileUpdate = (event) => {
        var file = inputFile.current.files[0]
        var newName = `${folder}/${file.name}`
        var newFile = new File([file], newName)
        const formdata = new FormData()
        formdata.append("file", newFile)
        VideoService.upload(formdata)
        VideoService.scan()
    }

    return (
        <>
            <Grid item justifyContent="center" sx={{ pr: 2, pt: 1 }} >
                <Tooltip title="Upload">
                    <IconButton onClick={handleFileUpload} sx={{ p: 0 }}>
                        <Avatar alt="Upload" sx={{ bgcolor: lightBlue[500] }}>
                            <CloudUploadIcon />
                            <input type='file' id='file' ref={inputFile} onInput={onFileUpdate} style={{ display: 'none' }} />

                        </Avatar>
                    </IconButton>
                </Tooltip>
            </Grid>
            <Grid item xs>
                <Autocomplete id='folder_selection' onChange={onFolderUpdate} options={createSelectFolders(folders.folders)} sx={{ width: 200 }} renderInput={(params) => <TextField {...params} label="Game Folder" />} />
            </Grid>

        </>
    )
}

export default UploadModal