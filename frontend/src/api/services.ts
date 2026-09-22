// frontend/src/api/services.ts
//
// Compatibility entrypoint. New code may import a narrow domain module from
// `api/services/<domain>`; existing imports remain stable while the client
// layer is migrated incrementally.

export * from './services/index';
