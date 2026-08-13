import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

import { findForbiddenPatternViolationList } from '@/guard';
import { parseJsoncDocument } from '@/jsonc';
import { starterManifest } from '@/manifest';

const repositoryRootDirectory = join(import.meta.dir, '..', '..');
const outputDirectory = join(import.meta.dir, 'out');
const assetsDirectory = join(import.meta.dir, 'assets');

const wranglerConfigurationSchema = z
  .object({
    durable_objects: z.object({
      bindings: z.array(
        z.object({ name: z.string(), class_name: z.string() }).passthrough(),
      ),
    }),
    migrations: z.array(
      z
        .object({
          tag: z.string(),
          new_sqlite_classes: z.array(z.string()).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const packageManifestSchema = z
  .object({
    packageManager: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

async function readRepositoryTextFile(relativePath: string): Promise<string> {
  return Bun.file(join(repositoryRootDirectory, relativePath)).text();
}

async function writeOutputTextFile(relativePath: string, content: string): Promise<void> {
  await Bun.write(join(outputDirectory, relativePath), content);
}

function applyRewriteList(
  content: string,
  rewriteList: readonly { readonly from: string; readonly to: string }[],
): string {
  let rewrittenContent = content;
  for (const rewrite of rewriteList) {
    rewrittenContent = rewrittenContent.replaceAll(rewrite.from, rewrite.to);
  }
  return rewrittenContent;
}

function copyAgentSources(): void {
  for (const copyEntry of starterManifest.agentCopyList) {
    cpSync(
      join(repositoryRootDirectory, starterManifest.agentDirectory, copyEntry),
      join(outputDirectory, copyEntry),
      { recursive: true },
    );
  }
  for (const copyEntry of starterManifest.rootCopyList) {
    cpSync(join(repositoryRootDirectory, copyEntry), join(outputDirectory, copyEntry));
  }
}

async function applyIdentityPlaceholderSwap(): Promise<void> {
  const swap = starterManifest.identityPlaceholderSwap;
  const identityFilePath = join(outputDirectory, swap.relativePath);
  const identityContent = await Bun.file(identityFilePath).text();
  if (!identityContent.includes(swap.from)) {
    throw new Error(
      `identity placeholder drift: ${swap.relativePath} no longer contains the expected voice id line`,
    );
  }
  await Bun.write(identityFilePath, identityContent.replace(swap.from, swap.to));
}

async function emitStarterWranglerConfiguration(): Promise<void> {
  const monorepoConfigurationText = await readRepositoryTextFile(
    join(starterManifest.agentDirectory, 'wrangler.jsonc'),
  );
  const configuration = wranglerConfigurationSchema.parse(
    parseJsoncDocument(monorepoConfigurationText),
  );
  const removedClassSet = new Set<string>(
    starterManifest.wranglerRemovedDurableObjectClassList,
  );

  const {
    routes: _removedRouteList,
    containers: _removedContainerList,
    ...keptConfiguration
  } = configuration;
  const starterConfiguration = {
    ...keptConfiguration,
    workers_dev: true,
    durable_objects: {
      bindings: configuration.durable_objects.bindings.filter(
        (binding) => !removedClassSet.has(binding.class_name),
      ),
    },
    migrations: configuration.migrations
      .map((migration) => ({
        ...migration,
        new_sqlite_classes: migration.new_sqlite_classes?.filter(
          (className) => !removedClassSet.has(className),
        ),
      }))
      .filter(
        (migration) =>
          migration.new_sqlite_classes === undefined ||
          migration.new_sqlite_classes.length > 0,
      ),
  };

  const headerCommentText = [
    '// apollo-starter wrangler configuration — generated from the Apollo monorepo.',
    '// Containers and the Sandbox binding (the coding opt-in) are deliberately absent;',
    '// the re-enable runbook lives in .claude/skills/apollo-tooling/SKILL.md.',
  ].join('\n');
  await writeOutputTextFile(
    'wrangler.jsonc',
    `${headerCommentText}\n${JSON.stringify(starterConfiguration, null, 2)}\n`,
  );
}

async function emitStarterPackageManifest(): Promise<void> {
  const agentPackage = packageManifestSchema.parse(
    JSON.parse(
      await readRepositoryTextFile(join(starterManifest.agentDirectory, 'package.json')),
    ),
  );
  const rootPackage = packageManifestSchema.parse(
    JSON.parse(await readRepositoryTextFile('package.json')),
  );
  const wranglerVersion = agentPackage.devDependencies?.wrangler;
  const typescriptVersion = rootPackage.devDependencies?.typescript;
  const bunTypesVersion = rootPackage.devDependencies?.['@types/bun'];
  if (
    wranglerVersion === undefined ||
    typescriptVersion === undefined ||
    bunTypesVersion === undefined
  ) {
    throw new Error(
      'package manifest drift: expected wrangler, typescript, and @types/bun versions upstream',
    );
  }

  const starterPackage = {
    name: starterManifest.starterName,
    private: true,
    type: 'module',
    packageManager: rootPackage.packageManager,
    scripts: {
      dev: 'wrangler dev',
      deploy: 'wrangler deploy',
      types: 'wrangler types',
      typecheck: 'tsc --noEmit',
      test: 'bun test',
      check: 'bun run types && bun run typecheck && bun run test',
      bootstrap: 'bun scripts/bootstrap.ts',
      probe: 'bun scripts/probe.ts',
    },
    dependencies: agentPackage.dependencies,
    devDependencies: {
      '@types/bun': bunTypesVersion,
      typescript: typescriptVersion,
      wrangler: wranglerVersion,
    },
  };
  await writeOutputTextFile(
    'package.json',
    `${JSON.stringify(starterPackage, null, 2)}\n`,
  );
}

function listFilesRecursively(rootDirectory: string): readonly string[] {
  const relativePathList: string[] = [];
  const walkDirectory = (currentRelativePath: string): void => {
    const entryList = readdirSync(join(rootDirectory, currentRelativePath), {
      withFileTypes: true,
    });
    for (const entry of entryList) {
      const entryRelativePath = currentRelativePath
        ? join(currentRelativePath, entry.name)
        : entry.name;
      if (entry.isDirectory()) {
        walkDirectory(entryRelativePath);
      } else {
        relativePathList.push(entryRelativePath);
      }
    }
  };
  walkDirectory('');
  return relativePathList;
}

async function emitDocumentation(): Promise<void> {
  const documentationRoot = join(
    repositoryRootDirectory,
    starterManifest.documentationDirectory,
  );
  const excludedPathList = starterManifest.documentationExcludeList;
  for (const relativePath of listFilesRecursively(documentationRoot)) {
    const isExcluded = excludedPathList.some(
      (excludedPath) =>
        relativePath === excludedPath || relativePath.startsWith(`${excludedPath}/`),
    );
    if (isExcluded) {
      continue;
    }
    const originalContent = await Bun.file(join(documentationRoot, relativePath)).text();
    const rewrittenContent = applyRewriteList(
      originalContent,
      starterManifest.documentationRewriteList,
    );
    const keptLineList = rewrittenContent
      .split('\n')
      .filter(
        (line) =>
          !starterManifest.documentationDroppedLineMarkerList.some((marker) =>
            line.includes(marker),
          ),
      );
    await writeOutputTextFile(
      join('documentation', relativePath),
      keptLineList.join('\n'),
    );
  }
}

async function emitSkills(): Promise<void> {
  const skillsRoot = join(repositoryRootDirectory, starterManifest.skillsDirectory);
  for (const skillFileName of readdirSync(skillsRoot)) {
    const skillContent = await Bun.file(join(skillsRoot, skillFileName)).text();
    const skillNameMatch = skillContent.match(/^name:\s*(\S+)$/m);
    if (skillNameMatch === null) {
      throw new Error(`skill ${skillFileName} is missing a frontmatter name`);
    }
    await writeOutputTextFile(
      join('.claude', 'skills', skillNameMatch[1], 'SKILL.md'),
      skillContent,
    );
  }
}

async function emitAssets(): Promise<void> {
  for (const assetFileName of ['README.md', 'tsconfig.json']) {
    cpSync(join(assetsDirectory, assetFileName), join(outputDirectory, assetFileName));
  }
  cpSync(join(assetsDirectory, 'gitignore'), join(outputDirectory, '.gitignore'));
  cpSync(join(assetsDirectory, 'scripts'), join(outputDirectory, 'scripts'), {
    recursive: true,
  });
  const agentGuideContent = await Bun.file(join(assetsDirectory, 'CLAUDE.md')).text();
  await writeOutputTextFile('CLAUDE.md', agentGuideContent);
  await writeOutputTextFile('AGENTS.md', agentGuideContent);
}

async function runForbiddenPatternGuard(): Promise<void> {
  const fileContentByRelativePath = new Map<string, string>();
  for (const relativePath of listFilesRecursively(outputDirectory)) {
    fileContentByRelativePath.set(
      relativePath,
      await Bun.file(join(outputDirectory, relativePath)).text(),
    );
  }
  const violationList = findForbiddenPatternViolationList({
    fileContentByRelativePath,
    ruleList: starterManifest.forbiddenPatternList,
  });
  if (violationList.length > 0) {
    const violationSummary = violationList
      .map((violation) => `${violation.relativePath}: ${violation.pattern}`)
      .join('\n');
    throw new Error(`forbidden strings in starter output:\n${violationSummary}`);
  }
}

function runCommandInDirectory(
  commandArgumentList: readonly string[],
  workingDirectory: string,
): void {
  const spawnResult = Bun.spawnSync([...commandArgumentList], {
    cwd: workingDirectory,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (spawnResult.exitCode !== 0) {
    throw new Error(
      `smoke step failed (exit ${spawnResult.exitCode}): ${commandArgumentList.join(' ')}`,
    );
  }
}

function runSmokeBuild(): void {
  const smokeDirectory = mkdtempSync(join(tmpdir(), 'apollo-starter-smoke-'));
  cpSync(outputDirectory, smokeDirectory, { recursive: true });
  console.log(`smoke: ${smokeDirectory}`);
  runCommandInDirectory(['bun', 'install'], smokeDirectory);
  runCommandInDirectory(['bun', 'run', 'check'], smokeDirectory);
  runCommandInDirectory(['bunx', 'wrangler', 'deploy', '--dry-run'], smokeDirectory);
  rmSync(smokeDirectory, { recursive: true, force: true });
}

async function buildStarter(): Promise<void> {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  copyAgentSources();
  await applyIdentityPlaceholderSwap();
  await emitStarterWranglerConfiguration();
  await emitStarterPackageManifest();
  await emitDocumentation();
  await emitSkills();
  await emitAssets();
  await runForbiddenPatternGuard();
  console.log(`starter generated at ${outputDirectory}`);
  if (Bun.argv.includes('--smoke')) {
    runSmokeBuild();
    console.log('smoke build passed');
  }
}

await buildStarter();
