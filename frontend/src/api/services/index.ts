// frontend/src/api/services/index.ts
//
// Domain barrel for the API client. Feature code can import one domain module
// directly when it wants a narrow dependency, while legacy imports from
// `api/services` continue to work through the compatibility barrel.

export * from './auth';
export * from './catalog';
export * from './commerce';
export * from './content';
export * from './farming';
export * from './management';
export * from './marketplace';
export * from './messaging';
