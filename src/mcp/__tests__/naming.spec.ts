import { describe, expect, it } from 'bun:test';

import {
  buildNamespacedMcpToolName,
  isNamespacedMcpToolName,
  MCP_TOOL_NAME_MAX_LENGTH,
} from '@/mcp/naming';

describe('namespaced mcp tool name', () => {
  it('joins the server id and tool name under an mcp prefix', () => {
    expect(buildNamespacedMcpToolName('github', 'create_pull_request')).toStartWith(
      'mcp_github_create_pull_request_',
    );
  });

  it('replaces every character the openai schema rejects', () => {
    const builtName = buildNamespacedMcpToolName('GitHub MCP!', 'repo/list-branches');
    expect(builtName).toStartWith('mcp_GitHub_MCP_repo_list_branches_');
    expect(builtName).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it('keeps tool names distinct when sanitizing renders them alike', () => {
    const separatorVariantList = ['read-only', 'read_only', 'read.only', 'read only'];
    const builtNameList = separatorVariantList.map((toolName) =>
      buildNamespacedMcpToolName('server', toolName),
    );
    expect(new Set(builtNameList).size).toBe(separatorVariantList.length);
  });

  it('keeps server ids distinct when sanitizing renders them alike', () => {
    expect(buildNamespacedMcpToolName('my-server', 'tool')).not.toBe(
      buildNamespacedMcpToolName('my_server', 'tool'),
    );
  });

  it('does not let the identity boundary shift between server and tool', () => {
    expect(buildNamespacedMcpToolName('a', 'b_c')).not.toBe(
      buildNamespacedMcpToolName('a_b', 'c'),
    );
  });

  it('is a pure function of its inputs', () => {
    const firstName = buildNamespacedMcpToolName('server', 'tool');
    const secondName = buildNamespacedMcpToolName('server', 'tool');
    expect(firstName).toBe(secondName);
    const firstLongName = buildNamespacedMcpToolName('s'.repeat(60), 't'.repeat(60));
    const secondLongName = buildNamespacedMcpToolName('s'.repeat(60), 't'.repeat(60));
    expect(firstLongName).toBe(secondLongName);
  });

  it('caps the length and stays within the charset when truncating', () => {
    const builtName = buildNamespacedMcpToolName('a'.repeat(80), 'b'.repeat(80));
    expect(builtName.length).toBe(MCP_TOOL_NAME_MAX_LENGTH);
    expect(builtName).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it('does not collide when two long names share a truncated prefix', () => {
    const sharedPrefix = 'x'.repeat(70);
    const firstName = buildNamespacedMcpToolName('server', `${sharedPrefix}_alpha`);
    const secondName = buildNamespacedMcpToolName('server', `${sharedPrefix}_beta`);
    expect(firstName).not.toBe(secondName);
    expect(firstName.length).toBe(MCP_TOOL_NAME_MAX_LENGTH);
    expect(secondName.length).toBe(MCP_TOOL_NAME_MAX_LENGTH);
  });

  it('recognizes its own names and leaves builtin names alone', () => {
    expect(isNamespacedMcpToolName(buildNamespacedMcpToolName('a', 'b'))).toBe(true);
    expect(isNamespacedMcpToolName('web_search')).toBe(false);
    expect(isNamespacedMcpToolName('set_volume')).toBe(false);
  });
});
