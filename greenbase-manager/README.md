# GreenBase Manager

AI-powered living documentation management system built with Next.js, TypeScript, and Supabase.

## Project Setup Complete ✅

This project has been initialized with the following components:

### 1. Next.js Foundation
- ✅ Next.js 16 with TypeScript
- ✅ Tailwind CSS for styling
- ✅ ESLint configuration
- ✅ App Router structure

### 2. UI Components
- ✅ shadcn/ui components library initialized
- ✅ Essential components added: Button, Card, Dialog, Badge, Table, Select, Checkbox, Textarea, Tabs, AlertDialog
- ✅ Custom theme with neutral base color

### 3. Supabase Integration
- ✅ Supabase client configured with TypeScript types
- ✅ Database schema types defined
- ✅ Client and admin instances configured
- ✅ Environment variables template created

### 4. Azure Key Vault Integration
- ✅ Azure Key Vault SDK installed and configured
- ✅ Credential management for development and production
- ✅ OAuth token storage utilities
- ✅ Configuration service with Key Vault integration

## Environment Variables Required

Copy `.env.local` and fill in your actual values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Azure Key Vault Configuration
AZURE_KEY_VAULT_URL=your_azure_key_vault_url
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id

# Additional configuration for OAuth, Azure OpenAI, etc.
```

## Next Steps

1. **Database Setup**: Create Supabase database schema (Task 2.1)
2. **Authentication**: Implement Supabase Auth integration (Task 2.2)
3. **OAuth Integration**: Build Microsoft Graph and Google Drive connections (Task 3)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Architecture

- **Frontend**: Next.js 16 with TypeScript and Tailwind CSS
- **UI Components**: shadcn/ui component library
- **Database**: Supabase (PostgreSQL with pgvector)
- **Authentication**: Supabase Auth
- **Secret Management**: Azure Key Vault
- **AI Services**: Azure OpenAI and Speech Services
- **OAuth**: Microsoft Graph and Google Drive APIs

## Security

- Environment variables for development
- Azure Key Vault for production secrets
- Row Level Security (RLS) policies in Supabase
- OAuth token encryption and secure storage