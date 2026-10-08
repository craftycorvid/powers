// Local-directory entrypoint shim.
//
// OpenCode resolves a plugin directory by looking for `<dir>/index.{ts,js}`
// (or `server.*`); it does not consult package.json "exports" for local
// paths. Published installs resolve the package by name and use the
// "exports" map instead. This shim makes `plugins: ["/path/to/powers"]`
// load the same plugin as `opencode plugin add github:craftycorvid/powers`.
export { default } from "./opencode-plugin/index.ts"
