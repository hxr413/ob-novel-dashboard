import { t } from '../i18n';
import type NovelDashboardPlugin from '../main';
import { formatSigned } from '../dashboard/sections';

/**
 * 状态栏：今日净增
 */
export class StatusBar {
	private el: HTMLElement;

	constructor(private plugin: NovelDashboardPlugin) {
		this.el = plugin.addStatusBarItem();
		this.el.addClass('nd-status-bar', 'mod-clickable');

		plugin.registerDomEvent(this.el, 'click', () => {
			void plugin.openDashboardSidebar();
		});

		this.update();
	}

	update() {
		if (!this.plugin.settings.showStatusBar) {
			this.el.hide();

			return;
		}

		const summary = this.plugin.dashboardData.getSummary();

		this.el.show();
		this.el.setText(t('statusBar', { value: formatSigned(summary.todayNet) }));
		this.el.setAttribute(
			'aria-label',
			t('statusBarTooltip', {
				net: formatSigned(summary.todayNet),
				typed: summary.todayTyped,
			}),
		);
		this.el.setAttribute('data-tooltip-position', 'top');
	}
}
