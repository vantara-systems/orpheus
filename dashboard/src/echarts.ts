import { BarChart, LineChart } from "echarts/charts"
import { AriaComponent, AxisPointerComponent, BrushComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from "echarts/components"
import * as echarts from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([LineChart, BarChart, AriaComponent, AxisPointerComponent, BrushComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent, CanvasRenderer])

export default echarts
