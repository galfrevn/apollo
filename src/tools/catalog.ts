import { startCodingTaskTool } from '@/tools/coding';
import { deviceStatusTool, setBrightnessTool, setVolumeTool } from '@/tools/device';
import { dollarRateTool } from '@/tools/dollar';
import { sendEmailTool } from '@/tools/email';
import { setFocusTool, clearFocusTool } from '@/tools/focus';
import { addToListTool, readListTool, removeFromListTool } from '@/tools/list';
import { setWeatherLocationTool } from '@/tools/location';
import { recallMemoryTool, rememberFactTool } from '@/tools/memory';
import { cancelReminderTool, listRemindersTool, setReminderTool } from '@/tools/reminder';
import { buildToolDefinitionMap } from '@/tools/router';
import { startResearchTool } from '@/tools/research';
import { sandboxExecTool, sandboxRunCodeTool } from '@/tools/sandbox';
import { setTimerTool, startPomodoroTool } from '@/tools/timer';
import { translateTool } from '@/tools/translate';
import { webSearchTool } from '@/tools/web';
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
    setTimerTool,
    startPomodoroTool,
    addToListTool,
    readListTool,
    removeFromListTool,
    dollarRateTool,
    setVolumeTool,
    setBrightnessTool,
    deviceStatusTool,
    sendEmailTool,
    sandboxRunCodeTool,
    sandboxExecTool,
    startCodingTaskTool,
  ];
}

export function createBuiltinToolDefinitionMap(): Map<string, ToolDefinition> {
  return buildToolDefinitionMap(listBuiltinToolDefinitionList());
}
