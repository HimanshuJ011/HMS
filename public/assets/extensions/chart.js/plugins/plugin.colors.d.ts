import type { Chart } from 'assets/extensions/chart.js/types.js';
export interface ColorsPluginOptions {
    enabled?: boolean;
    forceOverride?: boolean;
}
declare const _default: {
    id: string;
    defaults: ColorsPluginOptions;
    beforeLayout(chart: Chart, _args: any, options: ColorsPluginOptions): void;
};
export default _default;
