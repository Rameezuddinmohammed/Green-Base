// Quick test to see the new confidence reasoning format
const { ConfidenceScoring } = require('./src/lib/ai/confidence-scoring.ts');

// Test with sample content
const testContent = `
# New Hire Onboarding Procedures

## Overview
This document outlines the essential steps and information for new employees to complete their onboarding process.

## HR Documentation
1. Visit the HR department.
2. Request your W-2 form from Janine in HR.

## Laptop Issuance
3. Compose an email to the IT helpdesk.
4. Request your MacBook Pro.
5. Await confirmation and instructions for pickup or delivery.
`;

const result = ConfidenceScoring.calculateConfidence(testContent, [], {});
console.log('New confidence reasoning:', result.reasoning);