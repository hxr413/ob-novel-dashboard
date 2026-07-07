import { DailyWritingSummary } from '../dashboard-data';

export class WritingChart {
	static create(parent: HTMLElement, data: DailyWritingSummary[]) {
		const container = parent.createDiv({
			cls: 'novel-dashboard-chart-container',
		});

		const canvas = container.createEl('canvas', {
			cls: 'novel-dashboard-chart',
		});

		const ctx = canvas.getContext('2d');

		if (!ctx) {
			return;
		}

		const width = container.clientWidth || 350;

		const height = 240;

		const ratio = window.devicePixelRatio || 1;

		canvas.width = width * ratio;

		canvas.height = height * ratio;

		canvas.style.width = `${width}px`;

		canvas.style.height = `${height}px`;

		ctx.scale(ratio, ratio);

		/*
			Chart 区域

		*/

		const paddingLeft = 45;

		const paddingRight = 20;

		const paddingTop = 20;

		const paddingBottom = 45;

		const chartWidth = width - paddingLeft - paddingRight;

		const chartHeight = height - paddingTop - paddingBottom;

		const maxWords = Math.max(...data.map((item) => item.words), 100);

		ctx.clearRect(0, 0, width, height);

		/*
			坐标轴

		*/

		ctx.strokeStyle = 'rgba(128,128,128,0.4)';

		ctx.lineWidth = 1;

		ctx.beginPath();

		ctx.moveTo(paddingLeft, paddingTop);

		ctx.lineTo(paddingLeft, height - paddingBottom);

		ctx.lineTo(width - paddingRight, height - paddingBottom);

		ctx.stroke();

		/*
			Y 轴刻度

		*/

		ctx.fillStyle = 'var(--text-muted)';

		ctx.font = '11px sans-serif';

		const steps = 4;

		for (let i = 0; i <= steps; i++) {
			const value = Math.round((maxWords * i) / steps);

			const y = height - paddingBottom - (value / maxWords) * chartHeight;

			ctx.fillText(value.toString(), 5, y + 4);

			ctx.beginPath();

			ctx.moveTo(paddingLeft, y);

			ctx.lineTo(width - paddingRight, y);

			ctx.strokeStyle = 'rgba(128,128,128,0.15)';

			ctx.stroke();
		}

		/*
			柱子

		*/

		const gap = chartWidth / data.length;

		const barWidth = gap * 0.6;

		data.forEach((item, index) => {
			const barHeight = (item.words / maxWords) * chartHeight;

			const x = paddingLeft + index * gap + (gap - barWidth) / 2;

			const y = height - paddingBottom - barHeight;

			ctx.fillStyle =
				getComputedStyle(document.body)
					.getPropertyValue('--interactive-accent')
					.trim() || '#888';

			ctx.fillRect(x, y, barWidth, barHeight);

			/*
					X 轴日期

					30 天只显示部分

				*/

			if (index % 5 === 0 || index === data.length - 1) {
				const label = item.date.slice(5);

				ctx.save();

				ctx.translate(x + barWidth / 2, height - paddingBottom + 15);

				ctx.rotate(-0.5);

				ctx.fillStyle = 'var(--text-muted)';

				ctx.font = '10px sans-serif';

				ctx.fillText(label, 0, 0);

				ctx.restore();
			}
		});

		return container;
	}
}
