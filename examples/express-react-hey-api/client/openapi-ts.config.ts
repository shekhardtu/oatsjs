import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: 'axios',
  input: './swagger.json',
  output: './src',
  services: {
    asClass: true,
  },
  types: {
    enums: 'PascalCase',
  },
});