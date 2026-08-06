import { describe, expect, it } from 'bun:test';

import { listBuiltinToolDefinitionList } from '@/tools/catalog';

describe('builtin tool catalog', () => {
  it('exposes weather and intent tools, not github or gmail stubs', () => {
    const nameList = listBuiltinToolDefinitionList().map((tool) => tool.name);
    expect(nameList).toContain('weather_now');
    expect(nameList).toContain('set_weather_location');
    expect(nameList).toContain('remember_fact');
    expect(nameList).toContain('set_focus');
    expect(nameList).toContain('clear_focus');
    expect(nameList).toContain('web_search');
    expect(nameList).toContain('start_research');
    expect(nameList).toContain('recall_memory');
    expect(nameList).toContain('translate');
    expect(nameList).toContain('set_reminder');
    expect(nameList).toContain('list_reminders');
    expect(nameList).toContain('cancel_reminder');
    expect(nameList).not.toContain('github_list_prs');
    expect(nameList).not.toContain('gmail_search');
    expect(nameList).not.toContain('gmail_send');
    for (const tool of listBuiltinToolDefinitionList()) {
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe('object');
    }
  });
});
