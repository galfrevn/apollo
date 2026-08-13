import { describe, expect, it } from 'bun:test';

import { parseDevelopmentVariableMap, upsertDevelopmentVariable } from '@/vars';

const exampleFileContent = [
  'DEVICE_SHARED_SECRET=dev-change-me',
  'OPENROUTER_API_KEY=',
  'MOCK_VOICE=1',
  '',
  '# Remote one-time setup (when you deploy):',
  '# bunx wrangler r2 bucket create apollo-media',
].join('\n');

describe('upsertDevelopmentVariable', () => {
  it('replaces an existing entry in place', () => {
    const updatedContent = upsertDevelopmentVariable(
      exampleFileContent,
      'OPENROUTER_API_KEY',
      'sk-or-123',
    );
    expect(updatedContent).toContain('OPENROUTER_API_KEY=sk-or-123');
    expect(updatedContent).toContain('# Remote one-time setup');
    expect(updatedContent.split('\n')).toHaveLength(
      exampleFileContent.split('\n').length,
    );
  });

  it('appends a missing entry above the comment block', () => {
    const updatedContent = upsertDevelopmentVariable(
      exampleFileContent,
      'APOLLO_OWNER_EMAIL',
      'owner@example.com',
    );
    const lineList = updatedContent.split('\n');
    const insertedIndex = lineList.indexOf('APOLLO_OWNER_EMAIL=owner@example.com');
    const commentIndex = lineList.findIndex((line) => line.startsWith('#'));
    expect(insertedIndex).toBeGreaterThan(-1);
    expect(insertedIndex).toBeLessThan(commentIndex);
  });

  it('round-trips with the parser', () => {
    const updatedContent = upsertDevelopmentVariable(
      exampleFileContent,
      'MOCK_VOICE',
      '',
    );
    const variableMap = parseDevelopmentVariableMap(updatedContent);
    expect(variableMap.get('MOCK_VOICE')).toBe('');
    expect(variableMap.get('DEVICE_SHARED_SECRET')).toBe('dev-change-me');
  });

  it('parses quoted multi-line values', () => {
    const variableMap = parseDevelopmentVariableMap(
      'GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"',
    );
    expect(variableMap.get('GITHUB_APP_PRIVATE_KEY')).toBe(
      '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    );
  });
});
