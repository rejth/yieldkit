export async function* sequence<T>(
	...asyncIterables: AsyncIterable<T>[]
): AsyncGenerator<T> {
	for (const iterable of asyncIterables) {
		for await (const item of iterable) {
			yield item;
		}
	}
}

export async function* map<T>(
	asyncIterable: AsyncIterable<T>,
	mappers: Array<(value: T) => unknown>,
): AsyncGenerator<unknown> {
	for await (const value of asyncIterable) {
		const mapperIterator = mappers[Symbol.iterator]();
		let mapper = mapperIterator.next();
		let result: unknown = value;

		while (!mapper.done) {
			result = mapper.value(result as T);
			mapper = mapperIterator.next();
		}

		yield result;
	}
}

export function filter<T, S extends T>(
	asyncIterable: AsyncIterable<T>,
	onFilter: (value: T) => value is S,
): AsyncGenerator<S>;

export function filter<T>(
	asyncIterable: AsyncIterable<T>,
	onFilter: (value: T) => boolean,
): AsyncGenerator<T>;

export async function* filter<T>(
	asyncIterable: AsyncIterable<T>,
	onFilter: (value: T) => boolean,
): AsyncGenerator<T> {
	const asyncIterator = asyncIterable[Symbol.asyncIterator]();

	while (true) {
		const { done, value } = await asyncIterator.next();
		if (done) return;
		if (onFilter(value)) yield value;
	}
}

export async function* every<T>(
	asyncIterable: AsyncIterable<T>,
	predicate: (value: T) => boolean,
): AsyncGenerator<T> {
	for await (const value of asyncIterable) {
		if (!predicate(value)) break;
		yield value;
	}
}

export async function* any<T>(
	...asyncIterables: AsyncIterable<T>[]
): AsyncGenerator<T> {
	type Entry = {
		iterator: AsyncIterator<T>;
		pending?: Promise<IteratorResult<T>>;
	};

	const entries: Entry[] = asyncIterables.map((item) => ({
		iterator: item[Symbol.asyncIterator](),
	}));

	const pendingResult = async (entry: Entry) => {
		entry.pending ??= entry.iterator.next();
		return { entry, result: await entry.pending };
	};

	while (entries.length > 0) {
		const { entry, result } = await Promise.race(entries.map(pendingResult));

		entry.pending = undefined;

		if (result.done) {
			entries.splice(entries.indexOf(entry), 1);
		} else {
			yield result.value;
		}
	}
}

export async function* take<T>(
	asyncIterable: AsyncIterable<T>,
	count: number,
): AsyncGenerator<T> {
	const asyncIterator = asyncIterable[Symbol.asyncIterator]();
	let cursor = 0;

	while (cursor < count) {
		const { done, value } = await asyncIterator.next();
		if (done) return;
		yield value;
		cursor++;
	}
}

export async function* slice<T>(
	asyncIterable: AsyncIterable<T> | AsyncIterableIterator<T>,
	start: number,
	stop: number,
	step: number = 1,
): AsyncGenerator<T> {
	const iterator = asyncIterable[Symbol.asyncIterator]();

	while (start > 0) {
		const { done } = await iterator.next();
		if (done) return;
		--start;
		--stop;
	}

	while (stop > 0) {
		const current = await iterator.next();
		if (current.done) return;

		yield current.value;
		--stop;

		let n = step;
		while (n > 1) {
			const skipped = await iterator.next();
			if (skipped.done) return;
			--n;
		}
	}
}

export async function* enumerate<T>(
	asyncIterable: AsyncIterable<T> | AsyncIterableIterator<T>,
): AsyncGenerator<[number, T]> {
	const iterator = asyncIterable[Symbol.asyncIterator]();
	let cursor = 0;

	while (true) {
		const current = await iterator.next();
		if (current.done) return;

		yield [cursor++, current.value];
	}
}

export function zip<T0, T1>(
	a: AsyncIterable<T0>,
	b: AsyncIterable<T1>,
): AsyncGenerator<[T0, T1]>;

export function zip<T>(
	...asyncIterables: [AsyncIterable<T>, AsyncIterable<T>, ...AsyncIterable<T>[]]
): AsyncGenerator<T[]>;

export async function* zip(
	...asyncIterables: AsyncIterable<unknown>[]
): AsyncGenerator<unknown> {
	const iterators = asyncIterables.map((iterable) =>
		iterable[Symbol.asyncIterator](),
	);

	if (iterators.length === 0) {
		return;
	}

	while (true) {
		const results = await Promise.all(
			iterators.map((iterator) => iterator.next()),
		);

		if (results.some((result) => result.done)) {
			return;
		}

		if (iterators.length === 2) {
			yield [results[0].value, results[1].value];
		} else {
			yield results.map((result) => result.value);
		}
	}
}

export async function* watch<T>(
	executor: () => AsyncIterable<T>,
): AsyncGenerator<T> {
	while (true) {
		for await (const value of executor()) {
			yield value;
		}
	}
}

export function onlyEvent<E extends keyof HTMLElementEventMap>(
	eventType: E,
): (event: Event) => event is HTMLElementEventMap[E] {
	return (event): event is HTMLElementEventMap[E] => event.type === eventType;
}
