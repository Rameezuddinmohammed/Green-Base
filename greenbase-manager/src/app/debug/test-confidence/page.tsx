"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestConfidencePage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testConfidence = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/test-confidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `# New Hire Onboarding Procedures

## Overview
This document outlines the essential steps and information for new employees to complete their onboarding process.

## HR Documentation
1. Visit the HR department.
2. Request your W-2 form from Janine in HR.

## Laptop Issuance
3. Compose an email to the IT helpdesk.
4. Request your MacBook Pro.
5. Await confirmation and instructions for pickup or delivery.`
        })
      })
      
      const data = await response.json()
      setResult(data.reasoning || 'No reasoning returned')
    } catch (error) {
      setResult('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Test New Confidence Reasoning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testConfidence} disabled={loading}>
            {loading ? 'Testing...' : 'Test New Confidence Format'}
          </Button>
          
          {result && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Dan's Assessment:</h3>
              <p className="text-sm">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}