import { App } from 'obsidian';

export class EventManager {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	start() {
		console.log('EventManager started');
	}

	stop() {
		console.log('EventManager stopped');
	}
}
