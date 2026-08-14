import { z } from 'zod';

import { parseJsoncDocument } from '@/jsonc';
import { starterManifest } from '@/manifest';

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
    version: z.string().optional(),
    packageManager: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

export function buildStarterWranglerDocument(monorepoConfigurationText: string): string {
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
  return `${headerCommentText}\n${JSON.stringify(starterConfiguration, null, 2)}\n`;
}

export function buildStarterPackageDocument(input: {
  readonly agentPackageText: string;
  readonly rootPackageText: string;
  readonly wizardPackageText: string;
}): string {
  const agentPackage = packageManifestSchema.parse(JSON.parse(input.agentPackageText));
  const rootPackage = packageManifestSchema.parse(JSON.parse(input.rootPackageText));
  const wizardPackage = packageManifestSchema.parse(JSON.parse(input.wizardPackageText));
  const wranglerVersion = agentPackage.devDependencies?.wrangler;
  const typescriptVersion = rootPackage.devDependencies?.typescript;
  const bunTypesVersion = rootPackage.devDependencies?.['@types/bun'];
  const wizardVersion = wizardPackage.version;
  if (
    wranglerVersion === undefined ||
    typescriptVersion === undefined ||
    bunTypesVersion === undefined ||
    wizardVersion === undefined
  ) {
    throw new Error(
      'package manifest drift: expected wrangler, typescript, @types/bun, and create-heyapollo versions upstream',
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
      // Pinned so a rerun uses the wizard release that generated this scaffold,
      // not whatever the registry serves as latest.
      setup: `bunx create-heyapollo@${wizardVersion} setup`,
    },
    dependencies: agentPackage.dependencies,
    devDependencies: {
      '@types/bun': bunTypesVersion,
      typescript: typescriptVersion,
      wrangler: wranglerVersion,
    },
  };
  return `${JSON.stringify(starterPackage, null, 2)}\n`;
}
