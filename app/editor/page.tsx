'use client'

import highlight from '@bytemd/plugin-highlight'
import { Editor } from '@bytemd/react'
import { useState } from 'react'
import 'bytemd/dist/index.css'

export default function EditorPage() {
  const [value, setValue] = useState('')

  return (
    <div className="markdown-body">
      <Editor
        value={value}
        plugins={[highlight()]}
        onChange={setValue}
      ></Editor>
    </div>
  )
}
