import { setFocusTool, clearFocusTool } from '@/tools/focus';
import { setWeatherLocationTool } from '@/tools/location';
import { recallMemoryTool, rememberFactTool } from '@/tools/memory';
import {
  cancelReminderTool,
  listRemindersTool,
  setReminderTool,
} from '@/tools/reminder';
import { buildToolDefinitionMap } from '@/tools/router';
import { startResearchTool } from '@/tools/research';
import { translateTool } from '@/tools/translate';
import { webSearchTool } from '@/tools/web';
// Sandbox tools disabled: Cloudflare Containers require the Workers Paid
// plan. Re-enable this import and the two entries below once upgraded.
// import { sandboxExecTool, sandboxRunCodeTool } from '@/tools/sandbox';
import type { ToolDefinition } from '@/tools/types';
import { weatherNowTool } from '@/tools/weather';

export function listBuiltinToolDefinitionList(): readonly ToolDefinition[] {
  return [
    weatherNowTool,
    setWeatherLocationTool,
    rememberFactTool,
    setFocusTool,
    clearFocusTool,
    webSearchTool,
    startResearchTool,
    recallMemoryTool,
    translateTool,
    setReminderTool,
    listRemindersTool,
    cancelReminderTool,
    // sandboxRunCodeTool,
    // sandboxExecTool,
  ];
}

export function createBuiltinToolDefinitionMap(): Map<string, ToolDefinition> {
  return buildToolDefinitionMap(listBuiltinToolDefinitionList());
}
