import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
    }

    // Create sample draft documents
    const sampleDrafts = [
      {
        title: "Team Meeting Notes - Project Alpha",
        content: `# Team Meeting Notes - Project Alpha

## Attendees
- John Smith (Project Manager)
- Sarah Johnson (Developer)
- Mike Chen (Designer)

## Discussion Points

### Project Timeline
- Current sprint ending Friday
- Next sprint planning scheduled for Monday
- Delivery target remains Q2 2024

### Technical Updates
- API integration completed
- Frontend components 80% done
- Testing phase to begin next week

### Action Items
- [ ] Sarah to complete user authentication module
- [ ] Mike to finalize UI mockups
- [ ] John to schedule client review meeting

## Next Steps
Continue with current sprint goals and prepare for client presentation.`,
        summary: "Weekly team meeting covering Project Alpha progress, timeline updates, and action items for the development team.",
        topics: ["project management", "team meetings", "development", "timeline"],
        confidence_score: 0.85,
        confidence_reasoning: "High confidence: well-structured content with clear action items and consistent team participation.",
        triage_level: "green" as const,
        source_references: [
          {
            sourceType: "teams",
            sourceId: "msg_001",
            title: "Team Meeting - Project Alpha",
            author: "John Smith",
            createdAt: new Date().toISOString()
          }
        ],
        pii_entities_found: 0,
        processing_metadata: {
          sourceId: "test_source_001",
          itemCount: 1,
          processingTime: 1500,
          tokensUsed: 450
        },
        organization_id: user.organization_id,
        status: "pending" as const
      },
      {
        title: "API Documentation - User Authentication",
        content: `# User Authentication API

## Overview
This document describes the user authentication endpoints for our application.

## Endpoints

### POST /api/auth/login
Authenticate a user with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securepassword"
}
\`\`\`

**Response:**
\`\`\`json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "user"
  }
}
\`\`\`

### POST /api/auth/logout
Invalidate the current user session.

**Headers:**
- Authorization: Bearer {token}

**Response:**
\`\`\`json
{
  "message": "Successfully logged out"
}
\`\`\`

## Error Handling
All authentication errors return appropriate HTTP status codes with descriptive error messages.`,
        summary: "Technical documentation for user authentication API endpoints including request/response formats and error handling.",
        topics: ["API", "authentication", "documentation", "technical"],
        confidence_score: 0.92,
        confidence_reasoning: "Very high confidence: comprehensive technical documentation with clear structure and examples.",
        triage_level: "green" as const,
        source_references: [
          {
            sourceType: "google_drive",
            sourceId: "doc_001",
            title: "API Documentation Draft",
            author: "Sarah Johnson",
            createdAt: new Date().toISOString()
          }
        ],
        pii_entities_found: 0,
        processing_metadata: {
          sourceId: "test_source_002",
          itemCount: 1,
          processingTime: 1200,
          tokensUsed: 380
        },
        organization_id: user.organization_id,
        status: "pending" as const
      },
      {
        title: "Customer Feedback Summary",
        content: `# Customer Feedback Summary

## Overview
Compilation of customer feedback received through various channels during Q1 2024.

## Key Themes

### Positive Feedback
- Users appreciate the intuitive interface
- Fast loading times mentioned frequently
- Customer support response time improved

### Areas for Improvement
- Mobile app needs better offline functionality
- Some users report confusion with the checkout process
- Request for more payment options

### Feature Requests
- Dark mode for the application
- Integration with popular calendar apps
- Bulk operations for data management

## Recommendations
1. Prioritize mobile offline functionality
2. Redesign checkout flow based on user feedback
3. Implement dark mode in next release
4. Expand payment gateway options

## Next Steps
Schedule follow-up interviews with key customers to gather more detailed feedback on proposed improvements.`,
        summary: "Quarterly customer feedback analysis highlighting positive aspects, improvement areas, and feature requests with actionable recommendations.",
        topics: ["customer feedback", "user experience", "product improvement", "analysis"],
        confidence_score: 0.78,
        confidence_reasoning: "Good confidence: structured feedback analysis but could benefit from more quantitative data and specific metrics.",
        triage_level: "yellow" as const,
        source_references: [
          {
            sourceType: "teams",
            sourceId: "msg_002",
            title: "Customer Feedback Discussion",
            author: "Marketing Team",
            createdAt: new Date().toISOString()
          }
        ],
        pii_entities_found: 0,
        processing_metadata: {
          sourceId: "test_source_003",
          itemCount: 3,
          processingTime: 2100,
          tokensUsed: 520
        },
        organization_id: user.organization_id,
        status: "pending" as const
      }
    ]

    // Insert sample draft documents
    const { data: insertedDrafts, error: draftError } = await supabaseAdmin
      .from('draft_documents')
      .insert(sampleDrafts)
      .select()

    if (draftError) {
      throw draftError
    }

    // Create some approved documents as well
    const sampleApproved = [
      {
        title: "Company Onboarding Process",
        content: `# Employee Onboarding Process

## Welcome to the Team!

This document outlines the standard onboarding process for new employees.

## First Day
- Welcome meeting with HR
- IT setup and account creation
- Office tour and introductions
- Review of company handbook

## First Week
- Department-specific training
- Meet with direct manager
- Complete required compliance training
- Set up development environment (for technical roles)

## First Month
- Regular check-ins with manager
- Complete initial project assignments
- Attend team meetings and standups
- Feedback session with HR

## Resources
- Employee handbook: Available on company intranet
- IT support: help@company.com
- HR questions: hr@company.com

## Checklist
- [ ] Complete I-9 verification
- [ ] Set up direct deposit
- [ ] Enroll in benefits
- [ ] Complete security training
- [ ] Set up workspace`,
        summary: "Comprehensive guide for new employee onboarding covering first day through first month activities and resources.",
        tags: ["onboarding", "HR", "new employees", "process"],
        organization_id: user.organization_id,
        approved_by: user.id,
        version: 1
      },
      {
        title: "Git Workflow Guidelines",
        content: `# Git Workflow Guidelines

## Branch Strategy
We use a feature branch workflow with the following conventions:

### Main Branches
- \`main\`: Production-ready code
- \`develop\`: Integration branch for features

### Feature Branches
- Format: \`feature/TICKET-123-short-description\`
- Branch from: \`develop\`
- Merge to: \`develop\`

## Commit Messages
Follow conventional commit format:
- \`feat: add user authentication\`
- \`fix: resolve login redirect issue\`
- \`docs: update API documentation\`

## Pull Request Process
1. Create feature branch from develop
2. Make changes and commit with descriptive messages
3. Push branch and create pull request
4. Request review from team members
5. Address feedback and update PR
6. Merge after approval

## Code Review Guidelines
- Check for code quality and standards
- Verify tests are included and passing
- Ensure documentation is updated
- Look for potential security issues

## Release Process
1. Create release branch from develop
2. Perform final testing
3. Merge to main and tag release
4. Deploy to production
5. Merge back to develop`,
        summary: "Development team guidelines for Git workflow including branching strategy, commit conventions, and code review process.",
        tags: ["git", "development", "workflow", "code review"],
        organization_id: user.organization_id,
        approved_by: user.id,
        version: 1
      }
    ]

    const { data: insertedApproved, error: approvedError } = await supabaseAdmin
      .from('approved_documents')
      .insert(sampleApproved)
      .select()

    if (approvedError) {
      throw approvedError
    }

    return NextResponse.json({ 
      success: true, 
      created: {
        drafts: insertedDrafts?.length || 0,
        approved: insertedApproved?.length || 0
      }
    })

  } catch (error: any) {
    console.error('Create test data error:', error)
    return NextResponse.json(
      { error: 'Failed to create test data', details: error.message },
      { status: 500 }
    )
  }
}