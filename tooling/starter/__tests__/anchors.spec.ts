import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const repositoryRootDirectory = join(import.meta.dir, '..', '..', '..');

type ConstantAnchor = {
  readonly constantName: string;
  readonly sourceRelativePath: string;
  readonly skillRelativePath: string;
};

// Each anchor ties a wire constant a skill quotes to the source that defines
// it: if the value changes upstream without the skill following, this fails.
const constantAnchorList: readonly ConstantAnchor[] = [
  {
    constantName: 'MINIMUM_TURN_AUDIO_BYTE_LENGTH',
    sourceRelativePath: 'apps/agent/src/agents/apollo.ts',
    skillRelativePath: 'documentation/skills/protocol.md',
  },
  {
    constantName: 'TTS_STREAM_CHUNK_BYTE_LENGTH',
    sourceRelativePath: 'apps/agent/src/voice/wav.ts',
    skillRelativePath: 'documentation/skills/protocol.md',
  },
  {
    constantName: 'TTS_PCM_SAMPLE_RATE_HZ',
    sourceRelativePath: 'apps/agent/src/voice/elevenlabs.ts',
    skillRelativePath: 'documentation/skills/protocol.md',
  },
  {
    constantName: 'DEVICE_MIC_PCM_SAMPLE_RATE_HZ',
    sourceRelativePath: 'apps/agent/src/voice/wav.ts',
    skillRelativePath: 'documentation/skills/protocol.md',
  },
  {
    constantName: 'SPEECH_SEGMENT_MAX_CHARACTER_COUNT',
    sourceRelativePath: 'apps/agent/src/voice/segment.ts',
    skillRelativePath: 'documentation/skills/protocol.md',
  },
  {
    constantName: 'CONFIRM_TIMEOUT_MILLISECONDS',
    sourceRelativePath: 'apps/agent/src/tools/types.ts',
    skillRelativePath: 'documentation/skills/tooling.md',
  },
];

async function readRepositoryFile(relativePath: string): Promise<string> {
  return Bun.file(join(repositoryRootDirectory, relativePath)).text();
}

function buildLooseNumberPattern(numberText: string): RegExp {
  const digitList = [...numberText];
  return new RegExp(digitList.join('[\\s_\\u202f\\u00a0]?'));
}

describe('skill freshness anchors', () => {
  for (const anchor of constantAnchorList) {
    it(`${anchor.constantName} matches between source and skill`, async () => {
      const sourceContent = await readRepositoryFile(anchor.sourceRelativePath);
      const constantValueMatch = sourceContent.match(
        new RegExp(`${anchor.constantName} = ([\\d_]+)`),
      );
      expect(constantValueMatch).not.toBeNull();
      if (constantValueMatch === null) {
        return;
      }
      const constantValueDigits = constantValueMatch[1].replaceAll('_', '');
      const skillContent = await readRepositoryFile(anchor.skillRelativePath);
      expect(skillContent).toContain(anchor.constantName);
      expect(skillContent).toMatch(buildLooseNumberPattern(constantValueDigits));
    });
  }

  it('the [[escucho]] listen marker matches between the turn runner and the persona skill', async () => {
    const turnRunnerContent = await readRepositoryFile('apps/agent/src/turn/run.ts');
    const personaSkillContent = await readRepositoryFile(
      'documentation/skills/persona.md',
    );
    expect(turnRunnerContent).toContain('escucho');
    expect(personaSkillContent).toContain('[[escucho]]');
  });

  it('the Vectorize dimensions match between the bootstrap script and the setup skill', async () => {
    const bootstrapContent = await readRepositoryFile(
      'tooling/starter/assets/scripts/bootstrap.ts',
    );
    const setupSkillContent = await readRepositoryFile('documentation/skills/setup.md');
    expect(bootstrapContent).toContain('VECTORIZE_DIMENSION_COUNT = 1536');
    expect(setupSkillContent).toContain('1536');
  });
});
