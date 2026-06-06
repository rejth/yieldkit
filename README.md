# yieldkit

Composable synchronous and asynchronous generator helpers for working with iterable data structures in a **lazy**, **memory-efficient** way, without materializing entire datasets upfront.

```ts
import { filter, map, take } from 'yieldkit/async'

async function* users() {
  for (let page = 1; ; page++) {
    const batch = await getPage(page)
    if (!batch.length) return
    yield* batch
  }
}

for await (const email of map(
  take(filter(users(), (user) => user.active), 50),
  [(user) => ({ to: user.email, subject: `Welcome, ${user.name}!` })],
)) send(email)
```

```ts
import { enumerate, zip, filter, map } from 'yieldkit/sync'

const catalog = map(
  filter(
    zip(
      enumerate(["shirts", "hats", "mugs"]),
      zip([1999, 1299, 899], [12, 0, 44]),
    ),
    ([, [, quantity]]) => quantity > 0,
  ),
  [([[i, name], [price, quantity]]) => `#${i + 1} ${name} — $${price / 100} (${quantity})`],
);

[...catalog] // ['#1 shirts — $19.99 (12)', '#3 mugs — $8.99 (44)']
```

```ts
import { on, once } from 'yieldkit'
import { watch, filter, sequence, every, any, onlyEvent } from 'yieldkit/async'

const target = document.createElement('div')

const drags = watch(() =>
  filter(
    sequence(
      once(target, 'mousedown'),
      every(
        any(on(window, 'mousemove'), on(window, 'mouseup')),
        onlyEvent('mousemove'),
      ),
    ),
    onlyEvent('mousemove'),
  ),
)

for await (const event of drags) {
  console.log(event.clientX, event.clientY)
}
```

### Lazy evaluation

`yieldkit` evaluates data **on demand** — one value at a time, as you pull it through the pipeline. That makes **streams** and **large datasets** practical to work with, synchronously or asynchronously, without holding everything in memory.

### Functional purity

The helpers are small, stateless functions that take data in and yield data out. You chain transformations declaratively — filter, then map, then take — and get code that is more **predictable, testable, and maintainable**.

### Unified composition

Whether you are chaining arrays, custom iterables, async generators, or event listeners, `yieldkit` offers a **single, consistent vocabulary** — `sequence`, `filter`, `take`, `map`, `zip`, and the rest work the same way across sync and async modules. One composition model for iterable data, instead of a different ad-hoc pattern for each source.

## Installation

```sh
npm install yieldkit
```

This package is published as ESM and includes TypeScript declarations.

## Synchronous Generators

The synchronous helpers compose regular `Iterable` values.

```ts
import { sequence, take } from 'yieldkit/sync'

const values = sequence(
  [1, 2],
  take([3, 4, 5], 2),
)

console.log([...values])
// [1, 2, 3, 4]
```

Available helpers:

- `watch(executor)` repeats an iterable-producing function forever.
- `sequence(...iterables)` yields each iterable in order.
- `filter(iterable, predicate)` yields values that pass a predicate. Supports type-predicate narrowing with `onlyEvent`.
- `every(iterable, predicate)` yields values until the predicate fails.
- `take(iterable, count)` yields a fixed number of values, stopping early if the source ends.
- `map(iterable, mappers)` applies a pipeline of mapper functions to each value.
- `slice(iterable, start, stop, step?)` yields a sliced range of values.
- `enumerate(iterable)` yields `[index, value]` pairs.
- `zip(a, b)` yields `[a, b]` pairs; `zip` with 3+ same-type iterables yields rows, stopping at the shortest one.
- `onlyEvent(eventType)` returns a type predicate for matching DOM event types.

## Asynchronous Generators

The asynchronous helpers compose `AsyncIterable` values.

```ts
import { sequence, take } from 'yieldkit/async'

async function* values(...items: number[]) {
  yield* items
}

const generated = sequence(
  values(1, 2),
  take(values(3, 4), 1),
)

for await (const value of generated) {
  console.log(value)
}
// 1
// 2
// 3
```

Available helpers:

- `watch(executor)` repeats an async iterable-producing function forever.
- `sequence(...iterables)` yields each async iterable in order.
- `filter(iterable, predicate)` yields values that pass a predicate. Supports type-predicate narrowing with `onlyEvent`.
- `every(iterable, predicate)` yields values until the predicate fails.
- `any(...iterables)` merges multiple async iterables by racing for the next value on each step. It keeps yielding until every source is exhausted — not when the first one finishes. Use `take(any(...), 1)` for a one-shot race.
- `take(iterable, count)` yields a fixed number of values, stopping early if the source ends.
- `map(iterable, mappers)` applies a pipeline of mapper functions to each value.
- `slice(iterable, start, stop, step?)` yields a sliced range of values.
- `enumerate(iterable)` yields `[index, value]` pairs.
- `zip(a, b)` yields `[a, b]` pairs; `zip` with 3+ same-type iterables yields rows, stopping at the shortest one.
- `onlyEvent(eventType)` returns a type predicate for matching DOM event types.

## DOM Events

`on` and `once` expose DOM events as async iterators. They accept a `Target` (`Window`, `Document`, or `HTMLElement`) and return iterators typed to the matching event for that target.

```ts
import { on } from 'yieldkit'

const button = document.querySelector('button')!
const clicks = on(button, 'click')

for await (const event of clicks) {
  console.log(event.type)
}
```

Use `once` when you only want the first matching event:

```ts
import { once } from 'yieldkit'

const button = document.querySelector('button')!
const firstClick = once(button, 'click')
const { value } = await firstClick.next()

console.log(value.type)
// click
```

## Drag And Drop

`dndWatcher` listens for a `mousedown` on a target element, then yields `window` `mousemove` events until a `mouseup` event occurs.

```ts
import { dndWatcher } from 'yieldkit'

const handle = document.createElement('div')
const drags = dndWatcher(handle)

for await (const event of drags) {
  console.log(event.clientX, event.clientY)
}
```

## Development

Install dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

Run TypeScript checks and linters:

```sh
npm run check
```

Lint only:

```sh
npm run lint
```

Format and auto-fix with Biome:

```sh
npm run format
npm run lint:fix
```

Build the package:

```sh
npm run build
```

## License

MIT
