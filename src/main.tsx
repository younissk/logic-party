import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    {/*
      One switch for the whole app: with `reducedMotion="user"` every animation
      in every minigame collapses to an instant state change when the operating
      system asks for less motion, rather than each screen remembering to check.
    */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
