// Load environment variables before any tests run
require('dotenv').config({ path: '.env.local' })

// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Add custom matchers or global test setup here
global.crypto = require('crypto')

// Set test environment variables if not already set
if (!process.env.AZURE_KEY_VAULT_URL) {
  process.env.AZURE_KEY_VAULT_URL = 'https://test-vault.vault.azure.net/'
}
if (!process.env.AZURE_CLIENT_ID) {
  process.env.AZURE_CLIENT_ID = 'test-client-id'
}
if (!process.env.AZURE_CLIENT_SECRET) {
  process.env.AZURE_CLIENT_SECRET = 'test-client-secret'
}
if (!process.env.AZURE_TENANT_ID) {
  process.env.AZURE_TENANT_ID = 'test-tenant-id'
}
if (!process.env.AZURE_OPENAI_ENDPOINT) {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://test-openai.openai.azure.com/'
}
if (!process.env.AZURE_OPENAI_API_KEY) {
  process.env.AZURE_OPENAI_API_KEY = 'test-api-key'
}
if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4'
}
if (!process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME) {
  process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME = 'text-embedding-ada-002'
}
if (!process.env.AZURE_SPEECH_KEY) {
  process.env.AZURE_SPEECH_KEY = 'test-speech-key'
}
if (!process.env.AZURE_SPEECH_REGION) {
  process.env.AZURE_SPEECH_REGION = 'eastus'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
}
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
}
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'test-secret'
}