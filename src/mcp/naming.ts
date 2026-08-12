export const MCP_TOOL_NAME_PREFIX = 'mcp_';

export const MCP_TOOL_NAME_MAX_LENGTH = 64;

const MCP_TOOL_NAME_HASH_LENGTH = 8;

function sanitizeMcpNameSegment(segment: string): string {
  return segment.replaceAll(/[^A-Za-z0-9]+/g, '_').replaceAll(/^_+|_+$/g, '');
}

function hashMcpToolNameToHex(fullName: string): string {
  let hashValue = 0x81_1c_9d_c5;
  for (let index = 0; index < fullName.length; index += 1) {
    hashValue ^= fullName.charCodeAt(index);
    hashValue = Math.imul(hashValue, 0x01_00_01_93) >>> 0;
  }
  return hashValue.toString(16).padStart(MCP_TOOL_NAME_HASH_LENGTH, '0');
}

// The OpenAI function schema accepts only /^[A-Za-z0-9_]+$/ and caps the length.
// Must stay a pure function of its inputs: `pending_confirmations` stores this
// name and the confirm turn rebuilds the tool map and looks it up again.
export function buildNamespacedMcpToolName(serverId: string, toolName: string): string {
  const fullName = `${MCP_TOOL_NAME_PREFIX}${sanitizeMcpNameSegment(serverId)}_${sanitizeMcpNameSegment(toolName)}`;
  if (fullName.length <= MCP_TOOL_NAME_MAX_LENGTH) {
    return fullName;
  }
  const truncatedLength = MCP_TOOL_NAME_MAX_LENGTH - MCP_TOOL_NAME_HASH_LENGTH - 1;
  return `${fullName.slice(0, truncatedLength)}_${hashMcpToolNameToHex(fullName)}`;
}

export function isNamespacedMcpToolName(toolName: string): boolean {
  return toolName.startsWith(MCP_TOOL_NAME_PREFIX);
}
