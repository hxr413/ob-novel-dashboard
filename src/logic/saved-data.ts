export interface DailyStat {
	words: number;

	duration: number;
}

/**
 * Dashboard 设置
 */
export interface DashboardSettings {
	// 是否开启右侧栏

	enableSidebar: boolean;

	// 是否生成 Dashboard.md

	enableDashboardFile: boolean;

	// Dashboard 文件路径

	dashboardFilePath: string;
}

/**
 * 最近写作文件
 */
export interface RecentFile {
	// 文件路径

	path: string;

	// 最后编辑时间

	time: number;
}

/**
 * 插件数据
 */
export interface NovelDashboardData {
	settings: {
		writingFolder: string;

		dashboard: DashboardSettings;
	};

	/**
	 * 当前每个文件字数
	 */

	documentCounts: {
		[path: string]: number;
	};

	/**
	 * 当前每个文件夹字数
	 */

	folderCounts: {
		[path: string]: number;
	};

	/**
	 * 上一次扫描数据
	 *
	 * 用于计算新增字数
	 */

	previousDocumentCounts: {
		[path: string]: number;
	};

	/**
	 * 每日统计
	 *
	 * key:
	 *
	 * 2026-07-07
	 *
	 */

	dailyStats: {
		[date: string]: DailyStat;
	};

	/**
	 * 最近编辑文件
	 *
	 * Dashboard 显示
	 */

	recentFiles: RecentFile[];
}

export const DEFAULT_DATA: NovelDashboardData = {
	settings: {
		writingFolder: '写作',

		dashboard: {
			enableSidebar: true,

			enableDashboardFile: true,

			dashboardFilePath: 'Novel Dashboard.md',
		},
	},

	documentCounts: {},

	folderCounts: {},

	previousDocumentCounts: {},

	dailyStats: {},

	recentFiles: [],
};
