import { createBrowserRouter, Outlet } from 'react-router-dom'
import { Category } from '@/pages/Category'
import { Guide } from '@/pages/Guide'
import { Home } from '@/pages/Home'
import { Play } from '@/pages/Play'
import { SkillTree } from '@/pages/SkillTree'

function Layout() {
  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-4 py-6 pb-16">
      <Outlet />
    </div>
  )
}

/**
 * Vite's BASE_URL is '/' locally and '/<repo>/' on GitHub Pages. Handing it to
 * the router keeps every <Link> correct in both, with no per-link fiddling.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/', element: <Home /> },
        { path: '/category/:categoryId', element: <Category /> },
        { path: '/play/:gameId', element: <Play /> },
        { path: '/guide/:gameId', element: <Guide /> },
        { path: '/tree', element: <SkillTree /> },
      ],
    },
  ],
  { basename },
)
