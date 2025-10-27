"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ApprovalQueueEnhanced } from "@/components/approval-queue-enhanced"

export default function ApprovalsPage() {
  return (
    <DashboardLayout>
      <div className="container py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
            <p className="text-muted-foreground">
              Review and approve AI-processed documents from your connected sources
            </p>
          </div>

          {/* Approval Queue Component */}
          <ApprovalQueueEnhanced />
        </div>
      </div>
    </DashboardLayout>
  )
}