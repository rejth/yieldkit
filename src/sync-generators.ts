export function* sequence<T>(...iterables: Iterable<T>[]): Generator<T> {
	for (const iterable of iterables) {
		for (const item of iterable) {
			yield item;
		}
	}
}

export function map<T>(
	iterable: Iterable<T>,
	mappers: Array<(value: T) => unknown>,
): IterableIterator<unknown> {
	const collectionIterator = iterable[Symbol.iterator]();

	return {
		[Symbol.iterator]() {
			return this;
		},

		next() {
			const mapperIterator = mappers[Symbol.iterator]();
			let mapper = mapperIterator.next();

			const next = collectionIterator.next();
			if (next.done) {
				return { done: true, value: undefined };
			}

			let value: unknown = next.value;

			while (!mapper.done) {
				value = mapper.value(value as T);
				mapper = mapperIterator.next();
			}

			return { done: false, value };
		},
	};
}

export function filter<T, S extends T>(
	iterable: Iterable<T>,
	onFilter: (value: T) => value is S,
): Generator<S>;

export function filter<T>(
	iterable: Iterable<T>,
	onFilter: (value: T) => boolean,
): Generator<T>;

export function* filter<T>(
	iterable: Iterable<T>,
	onFilter: (value: T) => boolean,
): Generator<T> {
	const iterator = iterable[Symbol.iterator]();

	while (true) {
		const { done, value } = iterator.next();
		if (done) return;
		if (onFilter(value)) yield value;
	}
}

export function* every<T>(
	iterable: Iterable<T>,
	predicate: (value: T) => boolean,
): Generator<T> {
	for (const value of iterable) {
		if (!predicate(value)) break;
		yield value;
	}
}

export function* take<T>(iterable: Iterable<T>, count: number): Generator<T> {
	const iterator = iterable[Symbol.iterator]();
	let cursor = 0;

	while (cursor < count) {
		const { done, value } = iterator.next();
		if (done) return;
		yield value;
		cursor++;
	}
}

export function* slice<T>(
	iterable: Iterable<T> | IterableIterator<T>,
	start: number,
	stop: number,
	step: number = 1,
): Generator<T> {
	const iterator = iterable[Symbol.iterator]();

	while (start > 0) {
		if (iterator.next().done) return;
		--start;
		--stop;
	}

	while (stop > 0) {
		const current = iterator.next();
		if (current.done) return;

		yield current.value;
		--stop;

		let n = step;
		while (n > 1) {
			if (iterator.next().done) return;
			--n;
		}
	}
}

export function enumerate<T>(
	iterable: Iterable<T> | IterableIterator<T>,
): IterableIterator<[number, T]> {
	const iterator = iterable[Symbol.iterator]();
	let cursor = 0;

	return {
		[Symbol.iterator]() {
			return this;
		},

		next() {
			const current = iterator.next();

			if (current.done) {
				return { done: true, value: undefined };
			}

			return {
				done: false,
				value: [cursor++, current.value],
			};
		},
	};
}

export function zip<T0, T1>(
	a: Iterable<T0>,
	b: Iterable<T1>,
): IterableIterator<[T0, T1]>;

export function zip<T>(
	...iterables: [Iterable<T>, Iterable<T>, ...Iterable<T>[]]
): IterableIterator<T[]>;

export function zip(
	...iterables: Iterable<unknown>[]
): IterableIterator<unknown> {
	const iterators = iterables.map((iterable) => iterable[Symbol.iterator]());

	return {
		[Symbol.iterator]() {
			return this;
		},

		next() {
			if (iterators.length === 0) {
				return { done: true, value: undefined };
			}

			const results = iterators.map((iterator) => iterator.next());

			if (results.some((result) => result.done)) {
				return { done: true, value: undefined };
			}

			const value =
				iterators.length === 2
					? [results[0].value, results[1].value]
					: results.map((result) => result.value);

			return { done: false, value };
		},
	};
}

export function* watch<T>(executor: () => Iterable<T>): Generator<T> {
	while (true) {
		for (const value of executor()) {
			yield value;
		}
	}
}

export function onlyEvent<E extends keyof HTMLElementEventMap>(
	eventType: E,
): (event: Event) => event is HTMLElementEventMap[E] {
	return (event): event is HTMLElementEventMap[E] => event.type === eventType;
}
