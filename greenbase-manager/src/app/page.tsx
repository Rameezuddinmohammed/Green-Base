import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Shield, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            GreenBase Manager
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            AI-powered living documentation system that automatically generates, 
            organizes, and maintains your team's knowledge base from Teams and Google Drive content.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="text-lg px-8 py-3">
                <BookOpen className="w-5 h-5 mr-2" />
                Get Started
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                AI-Powered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatically processes and structures content from your Teams channels and Google Drive folders
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-500" />
                Smart Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Confidence-based triage system helps managers review and approve documentation efficiently
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-500" />
                Team Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Seamless integration with Microsoft Teams and Google Workspace for natural content flow
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-purple-500" />
                Living Docs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Documentation that evolves with your team, automatically updated and organized by AI
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Ready to Experience Task 5?</CardTitle>
              <CardDescription>
                See the complete approval queue, source management, and knowledge base browser in action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button size="lg" className="w-full">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Launch Dashboard Demo
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
