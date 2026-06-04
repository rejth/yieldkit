import {
	any,
	every,
	filter,
	onlyEvent,
	sequence,
	watch,
} from "./async-generators.js";
import { on, once } from "./listeners.js";

export function dndWatcher(target: HTMLElement): AsyncGenerator<MouseEvent> {
	return watch(() =>
		filter(
			sequence(
				once(target, "mousedown"),
				every(
					any(on(window, "mousemove"), on(window, "mouseup")),
					onlyEvent("mousemove"),
				),
			),
			onlyEvent("mousemove"),
		),
	);
}
