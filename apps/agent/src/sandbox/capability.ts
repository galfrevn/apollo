// The Sandbox binding only exists when wrangler.jsonc carries the Containers
// block, which needs the Workers Paid plan — a deployment can legitimately run
// without it. Consumers check `environment.Sandbox` and answer with these
// summaries instead of assuming the namespace exists.
export const SANDBOX_UNAVAILABLE_SPOKEN_SUMMARY =
  'El sandbox no está habilitado en este despliegue: requiere Cloudflare Containers y el plan Workers Paid.';

export const CODING_UNAVAILABLE_SPOKEN_SUMMARY =
  'No puedo programar en este despliegue: el sandbox de Cloudflare Containers no está habilitado.';
