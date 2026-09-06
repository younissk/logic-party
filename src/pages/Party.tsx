/**
 * Party Run — the wheel, the track, and twelve stops.
 *
 * The loop is spin, read the card, play a short burst, get paid, move on. What
 * makes it more than a shuffled practice queue is that the card changes how a
 * game is played, and the payout is what makes the change matter: three
 * questions under Sudden Death are worth three times three questions taken
 * straight, and the wheel decides which you get.
 *
 * Nothing here can end a run early. A stop that goes badly pays little and the
 * track moves on — a study tool must not lock you out of the thing you are
 * worst at, which is exactly what a lives system would do.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { randomSeed } from '@/logic'
import { MINIGAMES } from '@/engine/registry'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Confetti } from '@/ui/Confetti'
import { Pop } from '@/ui/motion'
import { Avatar } from '@/ui/Avatar'
import { earnCoins, usePlayer } from '@/store/player'
import { maximumFor, payoutFor, rankFor, type Payout } from '@/party/cards'
import {
  RUN_LENGTH,
  buildRun,
  canReroll,
  canSwap,
  cardOf,
  currentWeakestTopic,
  difficultyOf,
  gameOf,
  isFork,
  isShop,
  rerollGame,
  streakOf,
  swapCard,
  totalsFor,
  type Run,
  type Stop,
  type StopRecord,
} from '@/party/run'
import {
  ITEMS,
  addItem,
  heldOf,
  itemById,
  purseOf,
  useItem,
  type Inventory,
  type ItemId,
} from '@/party/items'
import { Shop } from '@/party/Shop'
import { PartyStop, type StopOutcome } from '@/party/PartyStop'
import { Track } from '@/party/Track'
import { Wheel } from '@/party/Wheel'

type Phase = 'setup' | 'spin' | 'brief' | 'play' | 'payout' | 'shop' | 'over'

export function Party() {
  const player = usePlayer()
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [run, setRun] = useState<Run | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [at, setAt] = useState(0)
  const [choice, setChoice] = useState(0)
  const [records, setRecords] = useState<StopRecord[]>([])
  const [payout, setPayout] = useState<Payout | null>(null)
  const [burst, setBurst] = useState(0)
  const [inventory, setInventory] = useState<Inventory>({})
  const [spent, setSpent] = useState(0)
  /** Stops changed by an item, keyed by stop number. */
  const [altered, setAltered] = useState<Record<number, Stop>>({})
  /** A Shield armed for the stop about to be played. */
  const [armed, setArmed] = useState(false)
  /** Bumped by every item use, so a reroll never draws the same thing twice. */
  const [nonce, setNonce] = useState(0)

  const dealt = run === null ? null : (run.stops[Math.min(at, RUN_LENGTH - 1)] ?? null)
  const stop = dealt === null ? null : (altered[dealt.number] ?? dealt)
  const card = stop === null ? null : cardOf(stop)
  // A shop has no minigame, and asking for one throws.
  const game = stop === null || isShop(stop) ? null : gameOf(stop, choice)

  const start = useCallback(
    (seed: string) => {
      setRun(buildRun({ seed, difficulty, weakest: currentWeakestTopic() }))
      setAt(0)
      setChoice(0)
      setRecords([])
      setPayout(null)
      setInventory({})
      setSpent(0)
      setAltered({})
      setArmed(false)
      setPhase('spin')
    },
    [difficulty],
  )

  const finishStop = useCallback(
    (outcome: StopOutcome) => {
      if (run === null || stop === null || card === null || game === null) return
      const paid = payoutFor({
        card,
        correct: outcome.correct,
        asked: outcome.asked,
        elapsedMs: outcome.elapsedMs,
        streak: streakOf(records),
      })
      setRecords((previous) => [
        ...previous,
        {
          number: stop.number,
          gameId: game.id,
          cardId: card.id,
          correct: outcome.correct,
          asked: outcome.asked,
          coins: paid.total,
          perfect: paid.perfect,
        },
      ])
      setPayout(paid)
      if (paid.perfect) setBurst((count) => count + 1)
      setPhase('payout')
    },
    [card, game, records, run, stop],
  )

  const advance = useCallback(() => {
    setPayout(null)
    setChoice(0)
    setArmed(false)
    if (at + 1 >= RUN_LENGTH) {
      setAt(RUN_LENGTH)
      setPhase('over')
      return
    }
    const next = run?.stops[at + 1]
    setAt(at + 1)
    setPhase(next !== undefined && isShop(next) ? 'shop' : 'spin')
  }, [at, run])

  const spend = useCallback((id: ItemId) => {
    const item = itemById(id)
    setSpent((previous) => previous + item.price)
    setInventory((previous) => addItem(previous, id))
  }, [])

  const consume = useCallback((id: ItemId) => {
    setInventory((previous) => useItem(previous, id))
    setNonce((previous) => previous + 1)
  }, [])

  const totals = useMemo(() => totalsFor(records), [records])

  /** Whether anything in the bag can be used on the stop about to be played. */
  const holdsUsable =
    stop !== null &&
    ((heldOf(inventory, 'reroll') > 0 && canReroll(stop)) ||
      (heldOf(inventory, 'swap') > 0 && canSwap(stop)) ||
      heldOf(inventory, 'shield') > 0)

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------

  if (run === null || phase === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        <Header coins={player.coins} />

        <Card>
          <h1 className="shout text-3xl text-space-blue">Party Run</h1>
          <p className="mt-2 text-sm font-medium text-ink-soft">
            Twelve stops. The wheel picks the minigame, a rule card picks how you have to play it,
            and both decide what the stop pays. No stop can end the run — a bad one just pays less.
          </p>

          <ul className="mt-3 flex flex-col gap-1 text-sm font-semibold">
            <li>🎯 Stop 1 is a warm-up.</li>
            <li>⑂ Stop 6 is a fork — two games face up, you pick.</li>
            <li>👑 Stop 12 is the Boss: hard, five questions, triple pay.</li>
          </ul>

          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Difficulty
          </p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((level) => (
              <Button
                key={level}
                variant={difficulty === level ? 'coin' : 'secondary'}
                className="!min-h-10 !px-2 !text-sm capitalize"
                onClick={() => setDifficulty(level)}
              >
                {level}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs font-medium text-ink-soft">
            The Boss is always hard, whatever this says.
          </p>

          <Button variant="primary" className="mt-4 w-full" onClick={() => start(randomSeed())}>
            Spin the wheel
          </Button>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------
  // The end
  // ---------------------------------------------------------------------

  if (phase === 'over') {
    const rank = rankFor(purseOf(totals.coins, spent))
    return (
      <div className="flex flex-col gap-4">
        <Confetti burst={burst} pieces={110} />
        <Header coins={player.coins} />

        <Card className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">Run over</p>
          <p className="shout mt-1 text-6xl text-coin">{rank.letter}</p>
          <p className="text-base font-bold">{rank.title}</p>

          <p className="mt-3 text-4xl font-black tabular-nums text-space-blue">
            🪙 {purseOf(totals.coins, spent)}
          </p>
          <p className="text-sm font-semibold text-ink-soft">
            {totals.correct} of {totals.asked} right · {totals.perfectStops} clean stops
          </p>
          {spent > 0 && (
            <p className="text-sm font-semibold text-ink-soft">
              Earned 🪙 {totals.coins}, spent 🪙 {spent} in the shop.
            </p>
          )}
          {totals.best !== null && totals.best.coins > 0 && (
            <p className="mt-1 text-sm font-medium text-ink-soft">
              Best stop:{' '}
              <strong className="text-ink">
                {MINIGAMES.find((entry) => entry.id === totals.best?.gameId)?.title ??
                  totals.best.gameId}
              </strong>{' '}
              for 🪙 {totals.best.coins}.
            </p>
          )}
        </Card>

        <Track run={run} records={records} at={RUN_LENGTH} />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="coin" onClick={() => start(randomSeed())}>
            Another run
          </Button>
          <Link to="/me" className="contents">
            <Button variant="secondary" className="w-full">
              Spend the coins
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (stop === null || card === null) return null

  // ---------------------------------------------------------------------
  // A stop
  // ---------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      <Confetti burst={burst} pieces={90} />
      <Header coins={player.coins} banked={purseOf(totals.coins, spent)} bag={inventory} />
      <Track run={run} records={records} at={at} />

      {phase === 'shop' && (
        <Pop>
          <Shop
            earned={totals.coins}
            spent={spent}
            inventory={inventory}
            onBuy={spend}
            onLeave={advance}
          />
        </Pop>
      )}

      {phase === 'spin' && game !== null && (
        <Card>
          <p className="text-center text-xs font-bold uppercase tracking-wider text-ink-soft">
            Stop {stop.number} of {RUN_LENGTH}
          </p>
          <div className="mt-2">
            <Wheel
              key={stop.number}
              winner={gameOf(stop, 0)}
              seed={stop.seed}
              onDone={() => setPhase('brief')}
            />
          </div>
        </Card>
      )}

      {phase === 'brief' && game !== null && (
        <Pop>
          <Card>
            {/*
              Above the fork/no-fork split on purpose: Reroll and Card Swap
              are not offered at the fork, but a Shield is — the fork is still
              a stop you can get wrong.
            */}
            {holdsUsable && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {heldOf(inventory, 'reroll') > 0 && canReroll(stop) && (
                  <Button
                    variant="secondary"
                    className="!min-h-9 !px-3 !text-xs"
                    onClick={() => {
                      setAltered((previous) => ({
                        ...previous,
                        [stop.number]: rerollGame(stop, currentWeakestTopic(), nonce),
                      }))
                      consume('reroll')
                      setPhase('spin')
                    }}
                  >
                    🎲 Reroll ×{heldOf(inventory, 'reroll')}
                  </Button>
                )}
                {heldOf(inventory, 'swap') > 0 && canSwap(stop) && (
                  <Button
                    variant="secondary"
                    className="!min-h-9 !px-3 !text-xs"
                    onClick={() => {
                      setAltered((previous) => ({
                        ...previous,
                        [stop.number]: swapCard(stop, nonce),
                      }))
                      consume('swap')
                    }}
                  >
                    🃏 Swap card ×{heldOf(inventory, 'swap')}
                  </Button>
                )}
                {heldOf(inventory, 'shield') > 0 && (
                  <Button
                    variant={armed ? 'coin' : 'secondary'}
                    className="!min-h-9 !px-3 !text-xs"
                    onClick={() => setArmed((previous) => !previous)}
                  >
                    🛡️ {armed ? 'Shield armed' : `Arm a shield ×${heldOf(inventory, 'shield')}`}
                  </Button>
                )}
              </div>
            )}

            {isFork(stop) ? (
              <>
                <p className="text-center text-sm font-bold uppercase tracking-widest text-ink-soft">
                  A fork — pick your poison
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {stop.games.map((id, index) => {
                    const option = gameOf(stop, index)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          if (armed) consume('shield')
                          setChoice(index)
                          setPhase('play')
                        }}
                        className="tile flex flex-col items-center gap-1 bg-card-shade p-3 text-center"
                      >
                        <span className="text-3xl leading-none">{option.icon}</span>
                        <span className="text-sm font-black">{option.title}</span>
                        <span className="text-xs font-medium text-ink-soft">{option.tagline}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-center text-sm font-bold">
                  {card.icon} {card.name} — {card.rule}
                </p>
              </>
            ) : (
              <>
                <div className="text-center">
                  <span className="text-5xl leading-none">{game.icon}</span>
                  <h2 className="shout mt-1 text-2xl text-space-blue">{game.title}</h2>
                  <p className="text-sm font-medium text-ink-soft">{game.tagline}</p>
                </div>

                <div className="mt-3 tile bg-coin px-3 py-2 text-center">
                  <p className="text-sm font-black">
                    {card.icon} {card.name}
                  </p>
                  <p className="text-sm font-semibold">{card.rule}</p>
                </div>

                <p className="mt-2 text-center text-sm font-bold text-ink-soft">
                  {card.questions} questions · {difficultyOf(run, stop)} · up to 🪙{' '}
                  {maximumFor(card)}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link to={`/guide/${game.id}`} className="contents">
                    <Button variant="secondary" className="w-full">
                      How it works
                    </Button>
                  </Link>
                  <Button
                    variant="coin"
                    onClick={() => {
                      if (armed) consume('shield')
                      setPhase('play')
                    }}
                  >
                    Play it
                  </Button>
                </div>
              </>
            )}
          </Card>
        </Pop>
      )}

      {phase === 'play' && game !== null && (
        <PartyStop
          key={`${stop.number}:${choice}:${stop.games[0]}:${stop.cardId}`}
          game={game}
          card={card}
          difficulty={difficultyOf(run, stop)}
          seed={stop.seed}
          shielded={armed}
          canCashOut={heldOf(inventory, 'cash-out') > 0}
          onCashOut={() => consume('cash-out')}
          onDone={finishStop}
        />
      )}

      {phase === 'payout' && payout !== null && (
        <Pop>
          <Card className={payout.perfect ? 'bg-grass/25' : ''}>
            <p className="text-center text-sm font-bold uppercase tracking-widest text-ink-soft">
              {payout.perfect ? 'Clean stop' : payout.total > 0 ? 'Banked' : 'Nothing this time'}
            </p>
            <p className="mt-1 text-center text-5xl font-black tabular-nums text-space-blue">
              🪙 {payout.total}
            </p>

            <ul className="mt-3 flex flex-col gap-0.5 text-sm font-semibold">
              <li className="flex justify-between">
                <span>Correct answers</span>
                <span className="tabular-nums">{payout.base}</span>
              </li>
              {payout.allClear > 0 && (
                <li className="flex justify-between">
                  <span>All clear</span>
                  <span className="tabular-nums">{payout.allClear}</span>
                </li>
              )}
              {payout.speed > 0 && (
                <li className="flex justify-between">
                  <span>Under half the clock</span>
                  <span className="tabular-nums">{payout.speed}</span>
                </li>
              )}
              {payout.multiplier > 1 && (
                <li className="flex justify-between font-black">
                  <span>
                    {card.icon} {card.name}
                  </span>
                  <span className="tabular-nums">×{payout.multiplier}</span>
                </li>
              )}
              {payout.streak > 0 && (
                <li className="flex justify-between text-grass-deep">
                  <span>Streak</span>
                  <span className="tabular-nums">+{payout.streak}</span>
                </li>
              )}
            </ul>

            {payout.total === 0 && card.allOrNothing === true && (
              <p className="mt-2 text-center text-sm font-medium text-ink-soft">
                Double Or Nothing means nothing. It was the nothing.
              </p>
            )}

            <Button
              variant="coin"
              className="mt-3 w-full"
              onClick={() => {
                // Coins are banked once, at the end. Walking out of a run
                // forfeits it, which is what stops stop 1 being farmed.
                if (at + 1 >= RUN_LENGTH) earnCoins(purseOf(totals.coins, spent))
                advance()
              }}
            >
              {at + 1 >= RUN_LENGTH ? 'Finish the run' : `On to stop ${stop.number + 1}`}
            </Button>
          </Card>
        </Pop>
      )}
    </div>
  )
}

function Header({ coins, banked, bag }: { coins: number; banked?: number; bag?: Inventory }) {
  const player = usePlayer()
  const carried = bag === undefined ? [] : ITEMS.filter((item) => heldOf(bag, item.id) > 0)
  return (
    <div className="flex items-center justify-between gap-2">
      <Link to="/" className="text-sm font-bold text-ink-soft hover:text-ink">
        ← Games
      </Link>
      <div className="flex items-center gap-2">
        {carried.length > 0 && (
          <span className="chunky bg-card px-2 py-1 text-sm font-black" title="In the bag">
            {carried.map((item) => (
              <span key={item.id}>
                {item.icon}
                {heldOf(bag as Inventory, item.id) > 1 ? heldOf(bag as Inventory, item.id) : ''}
              </span>
            ))}
          </span>
        )}
        {banked !== undefined && (
          <span className="chunky bg-card px-3 py-1 text-sm font-black tabular-nums">
            this run 🪙 {banked}
          </span>
        )}
        <span className="chunky bg-coin px-3 py-1 text-sm font-black tabular-nums">🪙 {coins}</span>
        <Avatar style={player.style} seed={player.seed} size={32} name={player.name} />
      </div>
    </div>
  )
}
