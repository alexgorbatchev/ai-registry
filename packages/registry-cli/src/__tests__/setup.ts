// Registry settings exported by the developer's shell would point tests at real overlays and
// workspaces. Tests start without them and set the ones they exercise explicitly.
for (const name of Object.keys(process.env)) {
  if (name.startsWith("AI_REGISTRY_")) delete process.env[name];
}
