// agents' MCP client statically imports partyserver, which imports
// `cloudflare:workers` at module load. The Bun host never follows the one code
// path that touches it (connecting to a durable-object-hosted MCP server), so
// an inert stub satisfies the loader. Import this module before any dynamic
// import of `agents/*` in a Bun process.
// Declared as a plain function so it stays constructible for `extends`
// clauses while never being instantiable on this host.
function UnavailableOnBunHost(): never {
  throw new Error(
    'cloudflare:workers is stubbed on the Bun host; this class must never be constructed here',
  );
}

Bun.plugin({
  name: 'cloudflare-workers-stub',
  setup(build) {
    build.module('cloudflare:workers', () => ({
      loader: 'object',
      exports: {
        DurableObject: UnavailableOnBunHost,
        RpcTarget: UnavailableOnBunHost,
        WorkflowEntrypoint: UnavailableOnBunHost,
        env: {},
      },
    }));
  },
});
