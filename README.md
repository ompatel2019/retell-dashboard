# Retell Dashboard

A Next.js dashboard application for managing Retell AI agents and business phone numbers.

## Features

- User authentication with Supabase
- Business management dashboard
- AI agent configuration
- Phone number management
- Role-based access control

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account and project
- Environment variables configured

### Environment Setup

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database schema:
```bash
# Run the SQL migrations in your Supabase project
# Copy the contents of supabase/migrations/*.sql to your Supabase SQL editor
```

3. Start the development server:
```bash
npm run dev
```

## Database Setup

The application requires the following database tables to be created:

- `businesses` - Company information
- `memberships` - User-business relationships
- `agents` - AI agent configurations
- `phone_numbers` - Business phone lines

Run the SQL files in `supabase/migrations/` in order:
1. `01_schema.sql` - Creates tables
2. `02_policies.sql` - Sets up Row Level Security
3. `03_seed_example.sql` - Optional example data

## Troubleshooting

### "No Business Data Found" Error

If you see this error after signing in, it means your user account doesn't have associated business data. This can happen when:

1. The database schema hasn't been set up
2. Your user account isn't linked to a business
3. There's a subscription/payment issue

#### Quick Fix for Development

Run the setup script to create test data:

```bash
# First, sign in to the dashboard in your browser
# Then run this script to create test business data
node scripts/setup-test-data.mjs
```

This script will:
- Check if you're authenticated
- Create a test business
- Link your user account to the business
- Create sample agents and phone numbers

#### Production Resolution

For production users, contact the admin at **+61490536019** to:
- Verify subscription status
- Set up business account
- Link user accounts

## Development

### Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # React components
│   ├── ui/             # UI components (shadcn/ui)
│   └── providers/      # Context providers
├── lib/                # Utility functions
│   ├── supabase/       # Supabase client setup
│   └── user/           # User and business logic
└── middleware.ts        # Auth middleware
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.
