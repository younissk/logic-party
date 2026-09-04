import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { Play } from '@/pages/Play'

function Layout() {
  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-4 py-6 pb-16">
      <Outlet />
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/play/:gameId', element: <Play /> },
    ],
  },
])
