import { describe, expect, test } from "vitest";
import { asyncGenerators, dndWatcher, on, once, syncGenerators } from "../src/index.js";

describe("sync generators", () => {
	test("exports composable synchronous generator helpers", () => {
		const { sequence, take, filter, every, slice, enumerate } = syncGenerators;

		const values = sequence([1, 2], take([3, 4, 5], 2));

		expect([...values]).toEqual([1, 2, 3, 4]);
		expect([...filter([1, 2, 3], (value) => value !== 2)]).toEqual([1, 3]);
		expect([...every([1, 2, 3], (value) => value < 3)]).toEqual([1, 2]);
		expect([...slice([1, 2, 3, 4, 5], 1, 4, 2)]).toEqual([2, 4]);
		expect([...enumerate(["a", "b"])]).toEqual([
			[0, "a"],
			[1, "b"],
		]);
	});

	test("map applies a mapper pipeline to each value", () => {
		const { map } = syncGenerators;

		const mapped = map([1, 2], [(value: number) => value * 2, (value: number) => value + 1]);

		expect([...mapped]).toEqual([3, 5]);
	});

	test("zip groups values and stops at the shortest iterable", () => {
		const { zip } = syncGenerators;

		expect([...zip([1, 2], [3, 4])]).toEqual([
			[1, 3],
			[2, 4],
		]);
		expect([...zip([1, 2, 3], [4])]).toEqual([[1, 4]]);
		expect([...zip()]).toEqual([]);
	});

	test("enumerate ends without yielding after exhaustion", () => {
		const { enumerate } = syncGenerators;

		const iterator = enumerate(["a"]);

		expect(iterator.next()).toEqual({ done: false, value: [0, "a"] });
		expect(iterator.next()).toEqual({ done: true, value: undefined });
	});

	test("take stops when the source ends early", () => {
		const { take } = syncGenerators;

		expect([...take([1, 2], 5)]).toEqual([1, 2]);
		expect([...take([1, 2], 0)]).toEqual([]);
	});

	test("watch restarts the executor after each iterable ends", () => {
		const { watch } = syncGenerators;

		let generation = 0;
		const watched = watch(() => [++generation]);

		expect(watched.next().value).toBe(1);
		expect(watched.next().value).toBe(2);
		expect(watched.next().value).toBe(3);
	});

	test("filter and every handle empty results", () => {
		const { filter, every } = syncGenerators;

		expect([...filter([1, 2, 3], () => false)]).toEqual([]);
		expect([...every([1, 2, 3], (value) => value > 1)]).toEqual([]);
	});

	test("onlyEvent narrows events passed through filter", () => {
		const { filter, onlyEvent } = syncGenerators;

		const events = [new MouseEvent("mousemove"), new Event("click"), new MouseEvent("mousemove")];

		const filtered = [...filter(events, onlyEvent("mousemove"))];

		expect(filtered).toHaveLength(2);
		expect(filtered.every((event) => event.type === "mousemove")).toBe(true);
	});

	test("map with no mappers yields the original values", () => {
		const { map } = syncGenerators;

		expect([...map([1, 2], [])]).toEqual([1, 2]);
	});
});

describe("async generators", () => {
	async function* values(...items: number[]): AsyncGenerator<number> {
		yield* items;
	}

	test("exports composable asynchronous generator helpers", async () => {
		const { sequence, take, filter, every } = asyncGenerators;

		const generated = sequence(values(1, 2), take(values(3, 4), 1));

		await expect(collect(generated, 3)).resolves.toEqual([1, 2, 3]);

		await expect(
			collect(
				filter(values(1, 2, 3), (value) => value !== 2),
				2,
			),
		).resolves.toEqual([1, 3]);

		await expect(
			collect(
				every(values(1, 2, 3), (value) => value < 3),
				2,
			),
		).resolves.toEqual([1, 2]);
	});

	test("map applies a mapper pipeline to each value", async () => {
		const { map } = asyncGenerators;

		const mapped = map(values(1, 2), [(value: number) => value * 2, (value: number) => value + 1]);

		await expect(collect(mapped, 2)).resolves.toEqual([3, 5]);
	});

	test("slice, enumerate, and zip match synchronous semantics", async () => {
		const { slice, enumerate, zip } = asyncGenerators;

		await expect(collect(slice(values(1, 2, 3, 4, 5), 1, 4, 2), 2)).resolves.toEqual([2, 4]);

		await expect(collect(enumerate(values(10, 20)), 2)).resolves.toEqual([
			[0, 10],
			[1, 20],
		]);

		await expect(collect(zip(values(1, 2), values(3, 4)), 2)).resolves.toEqual([
			[1, 3],
			[2, 4],
		]);

		await expect(collect(zip(values(1, 2, 3), values(4)), 1)).resolves.toEqual([[1, 4]]);

		await expect(collectUntilDone(zip())).resolves.toEqual([]);
	});

	test("take stops when the source ends early", async () => {
		const { take } = asyncGenerators;

		await expect(collectUntilDone(take(values(1, 2), 5))).resolves.toEqual([1, 2]);
		await expect(collectUntilDone(take(values(1, 2), 0))).resolves.toEqual([]);
	});

	test("watch restarts the executor after each iterable ends", async () => {
		const { watch } = asyncGenerators;

		let generation = 0;

		async function* oneValue(): AsyncGenerator<number> {
			yield ++generation;
		}

		const watched = watch(() => oneValue());

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
		const { filter, every } = asyncGenerators;

		await expect(collectUntilDone(filter(values(1, 2, 3), () => false))).resolves.toEqual([]);
		await expect(collectUntilDone(every(values(1, 2, 3), (value) => value > 1))).resolves.toEqual([]);
	});

	test("onlyEvent narrows events passed through filter", async () => {
		const { filter, onlyEvent } = asyncGenerators;

		async function* events(): AsyncGenerator<Event> {
			yield new MouseEvent("mousemove");
			yield new Event("click");
			yield new MouseEvent("mousemove");
		}

		const filtered = await collectUntilDone(filter(events(), onlyEvent("mousemove")));

		expect(filtered).toHaveLength(2);
		expect(filtered.every((event) => event.type === "mousemove")).toBe(true);
	});

	test("map with no mappers yields the original values", async () => {
		const { map } = asyncGenerators;

		await expect(collectUntilDone(map(values(1, 2), []))).resolves.toEqual([1, 2]);
	});

	test("enumerate ends without yielding after exhaustion", async () => {
		const { enumerate } = asyncGenerators;

		const iterator = enumerate(values(10));

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
		const { any } = asyncGenerators;
		const calls = { fast: 0, slow: 0 };

		const createIterable = (name: "fast" | "slow", delay: number): AsyncIterable<string> => ({
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

		const raced = any(createIterable("fast", 10), createIterable("slow", 100));

		await raced.next();
		expect(calls).toEqual({ fast: 1, slow: 1 });

		await raced.next();
		expect(calls).toEqual({ fast: 2, slow: 1 });

		await raced.next();
		expect(calls).toEqual({ fast: 3, slow: 1 });
	});

	test("any ends when all iterators are done", async () => {
		const { any, take } = asyncGenerators;

		async function* finite(...items: number[]): AsyncGenerator<number> {
			yield* items;
		}

		const raced = any(take(finite(1), 1), take(finite(2), 1));

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

async function collect<T>(iterable: AsyncIterable<T>, count: number): Promise<T[]> {
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
