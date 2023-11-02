export function _detectPlatform(canvas: any): typeof BasicPlatform | typeof DomPlatform;
import BasicPlatform from "assets/extensions/chart.js/platform/platform.basic.js";
import DomPlatform from "assets/extensions/chart.js/platform/platform.dom.js";
import BasePlatform from "assets/extensions/chart.js/platform/platform.base.js";
export { BasePlatform, BasicPlatform, DomPlatform };
