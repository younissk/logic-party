import { Link, useParams } from 'react-router-dom'
import { getMinigame } from '@/engine/registry'
import { Button, Card } from '@/ui/primitives'

export function Guide() {
  const { gameId = '' } = useParams()
  const game = getMinigame(gameId)

  if (!game?.Guide) {
    return (
      <Card>
        <h1 className="text-lg font-bold">No guide for this one yet</h1>
        <p className="mt-2 text-sm font-medium text-ink-soft">
          Nothing is registered under <code>{gameId}</code>, or it has no <code>Guide</code>.
        </p>
        <Link to="/">
          <Button variant="secondary" className="mt-4 w-full">
            Back to the course
          </Button>
        </Link>
      </Card>
    )
  }

  const { Guide: GuideBody } = game

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/play/${game.id}`} className="text-sm font-bold text-ink hover:underline">
        ← {game.title}
      </Link>

      <header className="text-center">
        <span
          className="space inline-flex h-20 w-20 items-center justify-center bg-coin text-4xl"
          aria-hidden
        >
          {game.icon}
        </span>
        <h1 className="shout mt-3 text-3xl text-white">How to play</h1>
        <p className="mt-1 font-semibold text-ink">{game.title}</p>
      </header>

      <GuideBody />

      <Link to={`/play/${game.id}`}>
        <Button variant="coin" className="w-full text-xl">
          ★ Play it now
        </Button>
      </Link>
    </div>
  )
}
