import { describe, expect, test } from "vitest";
import {
	asyncGenerators,
	dndWatcher,
	on,
	once,
	syncGenerators,
} from "../src/index.js";
import { enumerate, filter, map, zip } from "../src/sync-generators.js";

async function collectAsync<T>(
	iterable: AsyncIterable<T>,
	count: number,
): Promise<T[]> {
	const iterator = iterable[Symbol.asyncIterator]();
	const values: T[] = [];

	for (let cursor = 0; cursor < count; cursor++) {
		const { value } = await iterator.next();
		values.push(value);
	}

	return values;
}

async function collectUntilDone<T>(iterable: AsyncIterable<T>): Promise<T[]> {
	const iterator = iterable[Symbol.asyncIterator]();
	const values: T[] = [];

	while (true) {
		const { done, value } = await iterator.next();
		if (done) return values;
		values.push(value);
	}
}

describe("sync generators", () => {
	test("exports composable synchronous generator helpers", () => {
		const values = syncGenerators.sequence(
			[1, 2],
			syncGenerators.take([3, 4, 5], 2),
		);

		expect([...values]).toEqual([1, 2, 3, 4]);
		expect([
			...syncGenerators.filter([1, 2, 3], (value) => value !== 2),
		]).toEqual([1, 3]);
		expect([...syncGenerators.every([1, 2, 3], (value) => value < 3)]).toEqual([
			1, 2,
		]);
		expect([...syncGenerators.slice([1, 2, 3, 4, 5], 1, 4, 2)]).toEqual([2, 4]);
		expect([...syncGenerators.enumerate(["a", "b"])]).toEqual([
			[0, "a"],
			[1, "b"],
		]);
	});

	test("map applies a mapper pipeline to each value", () => {
		const mapped = syncGenerators.map(
			[1, 2],
			[(value: number) => value * 2, (value: number) => value + 1],
		);

		expect([...mapped]).toEqual([3, 5]);
	});

	test("zip groups values and stops at the shortest iterable", () => {
		const catalog = map(
			filter(
				zip(
					enumerate(["shirts", "hats", "mugs"]),
					zip([1999, 1299, 899], [12, 0, 44]),
				),
				([, [, quantity]]) => quantity > 0,
			),
			[
				([[i, name], [price, quantity]]) =>
					`#${i + 1} ${name} — $${price / 100} (${quantity})`,
			],
		);
		expect([...catalog]).toEqual([
			"#1 shirts — $19.99 (12)",
			"#3 mugs — $8.99 (44)",
		]);
		expect([...syncGenerators.zip([1, 2], [3, 4])]).toEqual([
			[1, 3],
			[2, 4],
		]);
		expect([...syncGenerators.zip([1, 2, 3], [4])]).toEqual([[1, 4]]);
		expect([...syncGenerators.zip()]).toEqual([]);
	});

	test("enumerate ends without yielding after exhaustion", () => {
		const iterator = syncGenerators.enumerate(["a"]);

		expect(iterator.next()).toEqual({ done: false, value: [0, "a"] });
		expect(iterator.next()).toEqual({ done: true, value: undefined });
	});

	test("take stops when the source ends early", () => {
		expect([...syncGenerators.take([1, 2], 5)]).toEqual([1, 2]);
		expect([...syncGenerators.take([1, 2], 0)]).toEqual([]);
	});

	test("watch restarts the executor after each iterable ends", () => {
		let generation = 0;
		const watched = syncGenerators.watch(() => [++generation]);

		expect(watched.next().value).toBe(1);
		expect(watched.next().value).toBe(2);
		expect(watched.next().value).toBe(3);
	});

	test("filter and every handle empty results", () => {
		expect([...syncGenerators.filter([1, 2, 3], () => false)]).toEqual([]);
		expect([...syncGenerators.every([1, 2, 3], (value) => value > 1)]).toEqual(
			[],
		);
	});

	test("onlyEvent narrows events passed through filter", () => {
		const events = [
			new MouseEvent("mousemove"),
			new Event("click"),
			new MouseEvent("mousemove"),
		];

		const filtered = [
			...syncGenerators.filter(events, syncGenerators.onlyEvent("mousemove")),
		];

		expect(filtered).toHaveLength(2);
		expect(filtered.every((event) => event.type === "mousemove")).toBe(true);
	});

	test("map with no mappers yields the original values", () => {
		expect([...syncGenerators.map([1, 2], [])]).toEqual([1, 2]);
	});
});

describe("async generators", () => {
	async function* values(...items: number[]): AsyncGenerator<number> {
		yield* items;
	}

	test("exports composable asynchronous generator helpers", async () => {
		const generated = asyncGenerators.sequence(
			values(1, 2),
			asyncGenerators.take(values(3, 4), 1),
		);

		await expect(collectAsync(generated, 3)).resolves.toEqual([1, 2, 3]);
		await expect(
			collectAsync(
				asyncGenerators.filter(values(1, 2, 3), (value) => value !== 2),
				2,
			),
		).resolves.toEqual([1, 3]);
		await expect(
			collectAsync(
				asyncGenerators.every(values(1, 2, 3), (value) => value < 3),
				2,
			),
		).resolves.toEqual([1, 2]);
	});

	test("map applies a mapper pipeline to each value", async () => {
		const mapped = asyncGenerators.map(values(1, 2), [
			(value: number) => value * 2,
			(value: number) => value + 1,
		]);

		await expect(collectAsync(mapped, 2)).resolves.toEqual([3, 5]);
	});

	test("slice, enumerate, and zip match synchronous semantics", async () => {
		await expect(
			collectAsync(asyncGenerators.slice(values(1, 2, 3, 4, 5), 1, 4, 2), 2),
		).resolves.toEqual([2, 4]);
		await expect(
			collectAsync(asyncGenerators.enumerate(values(10, 20)), 2),
		).resolves.toEqual([
			[0, 10],
			[1, 20],
		]);
		await expect(
			collectAsync(asyncGenerators.zip(values(1, 2), values(3, 4)), 2),
		).resolves.toEqual([
			[1, 3],
			[2, 4],
		]);
		await expect(
			collectAsync(asyncGenerators.zip(values(1, 2, 3), values(4)), 1),
		).resolves.toEqual([[1, 4]]);
		await expect(collectUntilDone(asyncGenerators.zip())).resolves.toEqual([]);
	});

	test("take stops when the source ends early", async () => {
		await expect(
			collectUntilDone(asyncGenerators.take(values(1, 2), 5)),
		).resolves.toEqual([1, 2]);
		await expect(
			collectUntilDone(asyncGenerators.take(values(1, 2), 0)),
		).resolves.toEqual([]);
	});

	test("watch restarts the executor after each iterable ends", async () => {
		let generation = 0;

		async function* oneValue(): AsyncGenerator<number> {
			yield ++generation;
		}

		const watched = asyncGenerators.watch(() => oneValue());

		await expect(watched.next()).resolves.toEqual({
			done: false,
			value: 1,
		});
		await expect(watched.next()).resolves.toEqual({
			done: false,
			value: 2,
		});
		await expect(watched.next()).resolves.toEqual({
			done: false,
			value: 3,
		});
	});

	test("filter and every handle empty results", async () => {
		await expect(
			collectUntilDone(asyncGenerators.filter(values(1, 2, 3), () => false)),
		).resolves.toEqual([]);
		await expect(
			collectUntilDone(
				asyncGenerators.every(values(1, 2, 3), (value) => value > 1),
			),
		).resolves.toEqual([]);
	});

	test("onlyEvent narrows events passed through filter", async () => {
		async function* events(): AsyncGenerator<Event> {
			yield new MouseEvent("mousemove");
			yield new Event("click");
			yield new MouseEvent("mousemove");
		}

		const filtered = await collectUntilDone(
			asyncGenerators.filter(events(), asyncGenerators.onlyEvent("mousemove")),
		);

		expect(filtered).toHaveLength(2);
		expect(filtered.every((event) => event.type === "mousemove")).toBe(true);
	});

	test("map with no mappers yields the original values", async () => {
		await expect(
			collectUntilDone(asyncGenerators.map(values(1, 2), [])),
		).resolves.toEqual([1, 2]);
	});

	test("enumerate ends without yielding after exhaustion", async () => {
		const iterator = asyncGenerators.enumerate(values(10));

		await expect(iterator.next()).resolves.toEqual({
			done: false,
			value: [0, 10],
		});
		await expect(iterator.next()).resolves.toEqual({
			done: true,
			value: undefined,
		});
	});

	test("any keeps at most one pending next() per iterator", async () => {
		const calls = { fast: 0, slow: 0 };

		const createIterable = (
			name: "fast" | "slow",
			delay: number,
		): AsyncIterable<string> => ({
			[Symbol.asyncIterator]() {
				return {
					async next() {
						calls[name]++;
						await new Promise((resolve) => setTimeout(resolve, delay));
						return { done: false, value: name };
					},
				};
			},
		});

		const raced = asyncGenerators.any(
			createIterable("fast", 10),
			createIterable("slow", 100),
		);

		await raced.next();
		expect(calls).toEqual({ fast: 1, slow: 1 });

		await raced.next();
		expect(calls).toEqual({ fast: 2, slow: 1 });

		await raced.next();
		expect(calls).toEqual({ fast: 3, slow: 1 });
	});

	test("any ends when all iterators are done", async () => {
		async function* finite(...items: number[]): AsyncGenerator<number> {
			yield* items;
		}

		const raced = asyncGenerators.any(
			asyncGenerators.take(finite(1), 1),
			asyncGenerators.take(finite(2), 1),
		);

		const first = await raced.next();
		const second = await raced.next();
		const third = await raced.next();

		expect([first.value, second.value].sort()).toEqual([1, 2]);
		expect(third).toEqual({ done: true, value: undefined });
	});
});

describe("event listeners", () => {
	test("on yields every matching event as an async iterator", async () => {
		const target = document.createElement("button");
		const iterator = on(target, "click");
		const first = iterator.next();
		const second = iterator.next();

		target.dispatchEvent(new Event("click"));
		target.dispatchEvent(new Event("click"));

		await expect(first).resolves.toMatchObject({
			done: false,
			value: expect.any(Event),
		});
		await expect(second).resolves.toMatchObject({
			done: false,
			value: expect.any(Event),
		});
	});

	test("once ends after the first matching event", async () => {
		const target = document.createElement("button");
		const iterator = once(target, "click");
		const first = iterator.next();

		target.dispatchEvent(new Event("click"));

		await expect(first).resolves.toMatchObject({
			done: false,
			value: expect.any(Event),
		});
		await expect(iterator.next()).resolves.toEqual({
			done: true,
			value: undefined,
		});
	});
});

describe("dndWatcher", () => {
	test("yields window mousemove events after a target mousedown until mouseup", async () => {
		const target = document.createElement("div");

		const iterator = dndWatcher(target);
		const nextDragEvent = iterator.next();

		setTimeout(() => {
			target.dispatchEvent(new MouseEvent("mousedown"));
			setTimeout(() => {
				window.dispatchEvent(new MouseEvent("mousemove"));
			}, 0);
		}, 0);

		await expect(nextDragEvent).resolves.toMatchObject({
			done: false,
			value: expect.objectContaining({ type: "mousemove" }),
		});
	});

	test("completes a drag cycle and restarts on the next mousedown", async () => {
		const target = document.createElement("div");
		const iterator = dndWatcher(target);

		const firstMove = iterator.next();
		const secondMove = iterator.next();

		setTimeout(() => {
			target.dispatchEvent(new MouseEvent("mousedown"));
			setTimeout(() => {
				window.dispatchEvent(new MouseEvent("mousemove"));
				setTimeout(() => {
					window.dispatchEvent(new MouseEvent("mouseup"));
				}, 0);
			}, 0);
		}, 0);

		await expect(firstMove).resolves.toMatchObject({
			done: false,
			value: expect.objectContaining({ type: "mousemove" }),
		});

		setTimeout(() => {
			target.dispatchEvent(new MouseEvent("mousedown"));
			setTimeout(() => {
				window.dispatchEvent(new MouseEvent("mousemove"));
			}, 0);
		}, 20);

		await expect(secondMove).resolves.toMatchObject({
			done: false,
			value: expect.objectContaining({ type: "mousemove" }),
		});
	});
});
