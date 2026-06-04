export type Target = (Window & typeof globalThis) | Document | HTMLElement;

function createAsyncListener(
	target: Target,
	eventType: string,
	exhaustAfterFirst: boolean,
): AsyncIterableIterator<Event> {
	let isEventFired = false;

	return {
		[Symbol.asyncIterator]() {
			return this;
		},

		async next(): Promise<IteratorResult<Event>> {
			return new Promise((resolve) => {
				if (exhaustAfterFirst && isEventFired) {
					resolve({ done: true, value: undefined });
					return;
				}

				target.addEventListener(
					eventType,
					(event) => {
						if (exhaustAfterFirst) {
							isEventFired = true;
						}
						resolve({ done: false, value: event });
					},
					{ once: true },
				);
			});
		},
	};
}

export function on<T extends HTMLElement, E extends keyof HTMLElementEventMap>(
	target: T,
	eventType: E,
): AsyncIterableIterator<HTMLElementEventMap[E]>;

export function on<T extends Document, E extends keyof DocumentEventMap>(
	target: T,
	eventType: E,
): AsyncIterableIterator<DocumentEventMap[E]>;

export function on<
	T extends Window & typeof globalThis,
	E extends keyof WindowEventMap,
>(target: T, eventType: E): AsyncIterableIterator<WindowEventMap[E]>;

export function on(
	target: Target,
	eventType: string,
): AsyncIterableIterator<Event> {
	return createAsyncListener(target, eventType, false);
}

export function once<
	T extends HTMLElement,
	E extends keyof HTMLElementEventMap,
>(target: T, eventType: E): AsyncIterableIterator<HTMLElementEventMap[E]>;

export function once<T extends Document, E extends keyof DocumentEventMap>(
	target: T,
	eventType: E,
): AsyncIterableIterator<DocumentEventMap[E]>;

export function once<
	T extends Window & typeof globalThis,
	E extends keyof WindowEventMap,
>(target: T, eventType: E): AsyncIterableIterator<WindowEventMap[E]>;

export function once(
	target: Target,
	eventType: string,
): AsyncIterableIterator<Event> {
	return createAsyncListener(target, eventType, true);
}
