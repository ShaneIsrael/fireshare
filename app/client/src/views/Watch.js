import React from 'react'
import { useParams } from 'react-router-dom'

const Watch = () => {
  const { id } = useParams()
  return <div>public page - id: {id}</div>
}

export default Watch
