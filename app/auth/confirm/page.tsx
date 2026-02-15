import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function ConfirmPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-orange-50">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle>Check Your Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">We have sent you a magic link to sign in. Click the link in your email to access your account.</p>
        </CardContent>
      </Card>
    </div>
  );
}